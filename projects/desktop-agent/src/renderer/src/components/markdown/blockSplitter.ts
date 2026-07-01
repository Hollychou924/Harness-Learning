import { marked, type Tokens } from 'marked'
import remend from 'remend'

// Block 分块器：将流式 markdown 文本拆成 stable（已完成）和 live（未完成）块
// 参考 opencode markdown-stream.ts + kilocode stable-blocks.ts

export interface Block {
  raw: string
  src: string
  mode: 'full' | 'live'
  language?: string
  complete?: boolean
}

function refs(text: string): boolean {
  return /^\[[^\]]+\]:\s+\S+/m.test(text) || /^\[\^[^\]]+\]:\s+/m.test(text)
}

function isOpenCodeFence(raw: string): boolean {
  const match = raw.match(/^[ \t]{0,3}(`{3,}|~{3,})/)
  if (!match) return false
  const mark = match[1]
  if (!mark) return false
  const char = mark[0]
  const size = mark.length
  const last = raw.trimEnd().split('\n').at(-1)?.trim() ?? ''
  return !new RegExp(`^[\\t ]{0,3}${char}{${size},}[\\t ]*$`).test(last)
}

function heal(text: string): string {
  return remend(text, { linkMode: 'text-only' })
}

function detectLanguage(raw: string): string | undefined {
  const match = raw.match(/^[ \t]{0,3}(`{3,}|~{3,})\s*(\S+)/)
  return match?.[2]?.toLowerCase()
}

export function splitBlocks(text: string, streaming: boolean): Block[] {
  if (!streaming) return [{ raw: text, src: text, mode: 'full' as const }]
  if (!text) return []

  const src = heal(text)
  if (refs(text)) return [{ raw: text, src, mode: 'live' as const }]

  const tokens = marked.lexer(text)
  const indexes = tokens.flatMap((token, index) => (token.type === 'space' ? [] : [index]))
  if (indexes.length < 2) {
    return [{ raw: text, src, mode: 'live' as const }]
  }

  // 检查最后一个 token 是否是未闭合的代码块
  const lastToken = tokens[indexes.at(-1)!]
  const lastIsOpenCode = lastToken && isOpenCodeFence(lastToken.raw)

  // 如果最后是开放代码块，stable blocks = 前面所有已完成 token
  if (lastIsOpenCode) {
    const headRaw = indexes.slice(0, -1).map((i) => tokens[i].raw).join('')
    const tailRaw = tokens[indexes.at(-1)!].raw
    const blocks: Block[] = []
    if (headRaw) {
      blocks.push({ raw: headRaw, src: heal(headRaw), mode: 'full' as const })
    }
    blocks.push({
      raw: tailRaw,
      src: tailRaw,
      mode: 'live' as const,
      language: detectLanguage(tailRaw),
      complete: false
    })
    return blocks
  }

  // 正常情况：前面都是 stable，最后一个是 live
  const stableRaws = indexes.slice(0, -1).map((i) => tokens[i].raw)
  const tailRaw = tokens[indexes.at(-1)!].raw

  const blocks: Block[] = stableRaws.map((raw) => ({ raw, src: raw, mode: 'full' as const }))

  // 如果最后一个 token 是代码块且已闭合，也作为 stable
  const lastTok = tokens[indexes.at(-1)!] as Tokens.Code
  if (lastTok?.type === 'code' && !isOpenCodeFence(lastTok.raw)) {
    blocks.push({ raw: tailRaw, src: tailRaw, mode: 'full' as const })
  } else {
    blocks.push({ raw: tailRaw, src: heal(tailRaw), mode: 'live' as const })
  }

  return blocks
}
