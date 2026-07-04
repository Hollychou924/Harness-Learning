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
    doing: () => '正在执行命令',
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
  if (item.status === 'stopped') return target ? `已停止：${target}` : '已停止'
  if (item.status === 'canceled') return '已取消'
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

/**
 * 折叠摘要标题：多个同类调用合并时用，定制摘要（来自 opencowork 智能分组）
 * 如"读取了 3 个文件"、"执行了 3 条命令"
 */
export function describeToolGroup(kind: ToolKind, count: number, allDone: boolean, items?: ToolCallItem[]): string {
  if (count <= 1) {
    const label = GROUP_LABELS[kind] || GROUP_LABELS.unknown
    return allDone ? label.done : label.doing
  }

  // 有 items 时算定制摘要
  if (items && items.length > 0) {
    const summary = computeGroupSummary(kind, items, allDone)
    if (summary) return summary
  }

  // 降级：通用"共 N 次"
  const label = GROUP_LABELS[kind] || GROUP_LABELS.unknown
  const text = allDone ? label.done : label.doing
  return `${text}，共 ${count} 次`
}

function computeGroupSummary(kind: ToolKind, items: ToolCallItem[], allDone: boolean): string | null {
  const done = allDone ? '了' : ''
  switch (kind) {
    case 'read_file': {
      const files = new Set(items.map((it) => typeof it.args.path === 'string' ? it.args.path : '').filter(Boolean))
      return `读取${done}${files.size > 0 ? files.size : items.length} 个文件`
    }
    case 'write_file': {
      const files = new Set(items.map((it) => typeof it.args.path === 'string' ? it.args.path : '').filter(Boolean))
      return `写入${done}${files.size > 0 ? files.size : items.length} 个文件`
    }
    case 'list_files': {
      return `检索${done}${items.length} 个目录`
    }
    case 'shell': {
      return `执行${done}${items.length} 条命令`
    }
    case 'fetch_page':
    case 'parse_page': {
      return `访问${done}${items.length} 个网页`
    }
    case 'create_docx': {
      return `生成${done}${items.length} 个文档`
    }
    case 'create_xlsx': {
      return `生成${done}${items.length} 个表格`
    }
    case 'mcp': {
      return `调用${done}${items.length} 次外部工具`
    }
    default:
      return null
  }
}

/**
 * 行内摘要节点：折叠态就在标签旁边显示关键结果，不用点开就知道"有没有用"
 * 来自 MyAgents getToolSummaryNode 理念，如 Edit +5 -3 / Grep 12 matches / Bash exit 0
 */
export function getToolSummaryNode(item: ToolCallItem): string | null {
  if (item.status === 'running' || item.status === 'pending') return null
  if (item.resultSummary) return item.resultSummary

  // write_file：从 content 算行数
  if (item.kind === 'write_file' && typeof item.args.content === 'string') {
    const lines = item.args.content === '' ? 0 : item.args.content.split('\n').length
    return `+${lines} 行`
  }

  // shell：从 result 提取退出码
  if (item.kind === 'shell' && item.result) {
    const match = item.result.match(/exit[_\s]*(\d+)/i)
    if (match) return `exit ${match[1]}`
    if (item.status === 'completed') return 'done'
  }

  // read_file / list_files：从 result 算行数或文件数
  if ((item.kind === 'read_file' || item.kind === 'list_files') && item.result) {
    const lines = item.result.split('\n').length
    if (lines > 1) return `${lines} 行`
  }

  return null
}

/**
 * 工具状态色系映射：每个状态对应一个 tailwind 色类
 * 来自 opencowork CompactToolCallHeader + MyAgents 圆点色
 */
export function getToolStatusColor(status: ToolCallItem['status']): {
  dot: string
  text: string
} {
  switch (status) {
    case 'running':
    case 'pending':
      return { dot: 'bg-sky-500 animate-pulse', text: 'text-sky-500' }
    case 'completed':
      return { dot: 'bg-[var(--ink-muted)]/40', text: 'text-[var(--ink)]' }
    case 'failed':
      return { dot: 'bg-red-500', text: 'text-red-500' }
    case 'stopped':
      return { dot: 'bg-amber-500', text: 'text-amber-500' }
    case 'canceled':
      return { dot: 'bg-[var(--ink-muted)]/40', text: 'text-[var(--ink-soft)]' }
    default:
      return { dot: 'bg-[var(--ink-muted)]/40', text: 'text-[var(--ink)]' }
  }
}
