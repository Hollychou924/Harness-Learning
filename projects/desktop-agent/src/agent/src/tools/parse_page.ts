import { z } from 'zod'
import * as cheerio from 'cheerio'
import type { AgentTool } from './index.js'

const ParsePageSchema = z.object({
  html: z.string().min(1, 'html 不能为空')
})

// parse_page：从 HTML 抽取正文与标题，只读，low 风险
export const parsePageTool: AgentTool = {
  name: 'parse_page',
  description:
    '从一段网页 HTML 中抽取标题、正文文字和链接。输入 html 字段（通常是 fetch_page 返回的 html）。',
  parameters: {
    type: 'object',
    properties: {
      html: { type: 'string', description: 'fetch_page 返回的 html 内容' }
    },
    required: ['html']
  },
  riskLevel: 'low',
  async execute(args) {
    const parsed = ParsePageSchema.safeParse(args)
    if (!parsed.success) {
      return JSON.stringify({ error: parsed.error.issues[0]?.message ?? '入参校验失败' })
    }
    const $ = cheerio.load(parsed.data.html)
    // 移除干扰内容
    $('script,style,noscript,svg,iframe,form,nav,footer,header').remove()
    const title = ($('title').first().text() || $('h1').first().text() || '').trim()
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 6000)
    // 抽取主要外链，便于来源追溯
    const links: Array<{ text: string; href: string }> = []
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || ''
      const t = $(el).text().trim()
      if (/^https?:\/\//i.test(href) && t) {
        links.push({ text: t.slice(0, 80), href })
      }
    })
    const dedupLinks = links.slice(0, 20)
    return JSON.stringify({ title, text, links: dedupLinks })
  }
}
