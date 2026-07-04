// 结果导向的工具摘要：从原始结果里提炼一句话，折叠态就能看出"有没有用"
// 依据 2026-07-02 复刻并超越 Codex 展示逻辑方案 · 超越点C
// 阶段1先给基础实现，阶段3针对每种工具补充更细的规则

export function summarizeToolResult(toolName: string, args: Record<string, unknown>, result: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(result)
  } catch {
    return result.length > 60 ? `${result.slice(0, 60)}…` : result
  }
  if (!parsed || typeof parsed !== 'object') return String(result).slice(0, 60)
  const obj = parsed as Record<string, unknown>
  if (typeof obj.error === 'string') return `失败：${obj.error}`

  switch (toolName) {
    case 'fetch_page':
    case 'parse_page': {
      const text = typeof obj.text === 'string' ? obj.text : typeof obj.content === 'string' ? obj.content : ''
      const title = typeof obj.title === 'string' ? obj.title : ''
      if (title) return `已读取「${title}」，共 ${text.length} 字`
      return text ? `已读取网页，共 ${text.length} 字` : '已读取网页'
    }
    case 'list_files': {
      const items = Array.isArray(obj.items) ? obj.items : []
      return `已检索到 ${items.length} 个文件`
    }
    case 'read_file': {
      const text = typeof obj.text === 'string' ? obj.text : typeof obj.content === 'string' ? obj.content : ''
      const lines = text ? text.split('\n').length : 0
      const path = typeof args.path === 'string' ? args.path.split('/').pop() : ''
      return path ? `已读取 ${path}，共 ${lines} 行` : `已读取文件，共 ${lines} 行`
    }
    case 'write_file': {
      const content = typeof args.content === 'string' ? args.content : ''
      const lines = content ? content.split('\n').length : 0
      const path = typeof args.path === 'string' ? args.path.split('/').pop() : ''
      return path ? `已写入 ${path}，共 ${lines} 行` : `已写入文件，共 ${lines} 行`
    }
    case 'create_docx':
    case 'create_xlsx': {
      const fallback = toolName === 'create_docx' ? '文档' : '表格'
      const path = typeof args.path === 'string' ? args.path.split('/').pop() || fallback : fallback
      const added = typeof obj.addedChars === 'number' ? obj.addedChars : 0
      const deleted = typeof obj.deletedChars === 'number' ? obj.deletedChars : 0
      return `已创建：${path} +${added} -${deleted}`
    }
    case 'shell': {
      const status = typeof obj.exitCode === 'number' ? obj.exitCode : null
      const stdout = typeof obj.stdout === 'string' ? obj.stdout : ''
      const stderr = typeof obj.stderr === 'string' ? obj.stderr : ''
      const outputLines = (stdout || stderr) ? `${(stdout + stderr).split('\n').filter(Boolean).length} 行输出` : '无输出'
      return status === 0 || status === null ? `命令执行成功，${outputLines}` : `命令退出码 ${status}，${outputLines}`
    }
    default:
      return '已完成'
  }
}
