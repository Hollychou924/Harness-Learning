// 工具活动语义化文案：进行时/完成时用词不同，读起来像人在做事，不是函数调用记录
// 复刻 Codex toolSummaryForCmd.* 的文案体系(运行中用"正在xx"，完成用"已xx")
import type { ToolCallItem, ToolKind } from '../../../agent/src/items'

interface ToolPhrase {
  doing: (target: string) => string
  done: (target: string, item: ToolCallItem) => string
}

function shortenTarget(kind: ToolKind, item: ToolCallItem): string {
  const args = item.args
  if ((kind === 'fetch_page' || kind === 'parse_page') && typeof args.url === 'string') {
    try {
      const u = new URL(args.url)
      return u.hostname
    } catch {
      return args.url.slice(0, 30)
    }
  }
  if (typeof args.path === 'string') return args.path.split('/').pop() || args.path
  if (typeof args.dir === 'string') return args.dir
  return ''
}

const PHRASES: Record<ToolKind, ToolPhrase> = {
  fetch_page: {
    doing: (t) => (t ? `正在读取 ${t}` : '正在读取网页'),
    done: (t, item) => item.resultSummary || (t ? `已读取 ${t}` : '已读取网页')
  },
  parse_page: {
    doing: (t) => (t ? `正在解析 ${t}` : '正在解析网页'),
    done: (t, item) => item.resultSummary || (t ? `已解析 ${t}` : '已解析网页')
  },
  list_files: {
    doing: (t) => (t ? `正在检索 ${t}` : '正在检索文件'),
    done: (_t, item) => item.resultSummary || '已完成检索'
  },
  read_file: {
    doing: (t) => (t ? `正在读取 ${t}` : '正在读取文件'),
    done: (t, item) => item.resultSummary || (t ? `已读取 ${t}` : '已读取文件')
  },
  write_file: {
    doing: (t) => (t ? `正在写入 ${t}` : '正在写入文件'),
    done: (t, item) => item.resultSummary || (t ? `已写入 ${t}` : '已写入文件')
  },
  create_docx: {
    doing: () => '正在生成 Word 文档',
    done: (_t, item) => item.resultSummary || '已生成 Word 文档'
  },
  create_xlsx: {
    doing: () => '正在生成 Excel 表格',
    done: (_t, item) => item.resultSummary || '已生成 Excel 表格'
  },
  shell: {
    doing: (t) => (t ? `正在执行：${t}` : '正在执行命令'),
    done: (_t, item) => item.resultSummary || '命令已执行'
  },
  mcp: {
    doing: () => '正在调用外部工具',
    done: (_t, item) => item.resultSummary || '外部工具调用完成'
  },
  unknown: {
    doing: () => '正在执行',
    done: (_t, item) => item.resultSummary || '已完成'
  }
}

/** 生成一句人话描述这次工具调用在做什么/做完了什么，用于折叠态一眼看懂 */
export function describeToolCall(item: ToolCallItem): string {
  const phrase = PHRASES[item.kind] || PHRASES.unknown
  const target = shortenTarget(item.kind, item)
  if (item.status === 'running' || item.status === 'pending') return phrase.doing(target)
  if (item.status === 'failed') return item.error ? `失败：${item.error}` : '执行失败'
  return phrase.done(target, item)
}

/** 折叠摘要标题：多个同类调用合并时用，比如"读取了 3 个文件" */
const GROUP_LABELS: Record<ToolKind, { doing: string; done: string }> = {
  fetch_page: { doing: '正在读取网页', done: '已读取网页' },
  parse_page: { doing: '正在解析网页', done: '已解析网页' },
  list_files: { doing: '正在检索文件', done: '已检索文件' },
  read_file: { doing: '正在读取文件', done: '已读取文件' },
  write_file: { doing: '正在写入文件', done: '已写入文件' },
  create_docx: { doing: '正在生成文档', done: '已生成文档' },
  create_xlsx: { doing: '正在生成表格', done: '已生成表格' },
  shell: { doing: '正在执行命令', done: '已执行命令' },
  mcp: { doing: '正在调用外部工具', done: '已调用外部工具' },
  unknown: { doing: '正在执行', done: '已完成' }
}

export function describeToolGroup(kind: ToolKind, count: number, allDone: boolean): string {
  const label = GROUP_LABELS[kind] || GROUP_LABELS.unknown
  const text = allDone ? label.done : label.doing
  return count > 1 ? `${text}，共 ${count} 次` : text
}
