import { z } from 'zod'
import type { AgentTool } from './index.js'

const FetchPageSchema = z.object({
  url: z.string().url('url 必须是合法网址，需包含 http 或 https')
})

// fetch_page：抓取网页原始 HTML，只读，low 风险
export const fetchPageTool: AgentTool = {
  name: 'fetch_page',
  description: '抓取指定 URL 的网页原始 HTML，用于获取网页内容以便后续解析。输入一个 url。',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '要抓取的网页地址，需包含 http 或 https' }
    },
    required: ['url']
  },
  riskLevel: 'low',
  async execute(args) {
    const parsed = FetchPageSchema.safeParse(args)
    if (!parsed.success) {
      return JSON.stringify({ error: parsed.error.issues[0]?.message ?? '入参校验失败' })
    }
    const { url } = parsed.data
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 20000)
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
      })
      clearTimeout(timer)
      if (!res.ok) {
        return JSON.stringify({ error: `HTTP ${res.status}`, url })
      }
      const html = await res.text()
      const trimmed = html.length > 80000 ? html.slice(0, 80000) + '\n<!-- truncated -->' : html
      return JSON.stringify({ url, status: res.status, length: html.length, html: trimmed })
    } catch (e) {
      return JSON.stringify({ error: e instanceof Error ? e.message : String(e), url })
    }
  }
}
