import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { execFileSync } from 'node:child_process'
import type { AgentMessage } from '../agent/src/protocol.js'
import type { Turn } from '../agent/src/items.js'
import { contentFingerprint, stableId } from './import-store.js'
import { normalizedProjectPath } from './import-project.js'
import type {
  ImportCandidate,
  ImportCatalog,
  ImportCategoryCounts,
  ImportCategoryId,
  ImportedProject,
  ImportedResource,
  ImportedSession,
  ImportPreview,
  ImportSourceId,
  ImportSourceSummary,
  ImportedAsset
} from './import-types.js'

type JsonRecord = Record<string, any>
type ParsedConversation = ReturnType<typeof parseCodexFile>

const conversationCache = new Map<string, { signature: string; parsed?: ParsedConversation; error?: string }>()

function filesBelow(root: string, suffix: string, depth = 8): string[] {
  if (!existsSync(root) || depth < 0) return []
  const result: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) result.push(...filesBelow(path, suffix, depth - 1))
    else if (entry.isFile() && entry.name.endsWith(suffix)) result.push(path)
  }
  return result
}

function readStableLines(path: string): JsonRecord[] {
  const before = statSync(path)
  const text = readFileSync(path, 'utf8')
  const after = statSync(path)
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('资料仍在写入，请稍后重试')
  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line) as JsonRecord)
}

function readStableJson(path: string): JsonRecord {
  const before = statSync(path)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as JsonRecord
  const after = statSync(path)
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('资料仍在写入，请稍后重试')
  return parsed
}

function time(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function textFromBlocks(value: unknown): string {
  if (typeof value === 'string') return cleanLeakedWrapperTags(stripInjectedAgentsInstructions(hideSensitiveText(value)))
  if (!Array.isArray(value)) return ''
  return value.flatMap((block) => {
    if (!block || typeof block !== 'object') return []
    if (typeof block.text === 'string' && ['input_text', 'output_text', 'text'].includes(block.type)) return [cleanLeakedWrapperTags(stripInjectedAgentsInstructions(hideSensitiveText(block.text)))]
    return []
  }).join('\n')
}

// 用户从其他工具（主要是 Cursor）复制粘贴的正文里会残留 UI 包裹标签：<user_query>、
// <timestamp>、<image_files>、[Image] 行、以及"**复制**"按钮文案。这些标签在 Codex / Claude Code
// 的原始记录里没有语义，只会污染展示；这里统一剥除包裹标签、丢弃纯元数据块、保留真正的提问正文。
// 注意：只剥"包裹标签"本身，<user_query> 内部的文字要保留，否则会丢掉用户真正输入的内容。
export function cleanLeakedWrapperTags(text: string): string {
  return text
    .replace(/<image_files>[\s\S]*?<\/image_files>/gi, '')
    .replace(/<timestamp>[\s\S]*?<\/timestamp>/gi, '')
    .replace(/<\/?(?:user_query|attached_files|environment_details)>/gi, '')
    .replace(/^\s*\[Image\]\s*$/gim, '')
    .replace(/^\s*\*\*复制\*\*\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Codex 会在每个会话的首条用户消息里注入 AGENTS.md 指令块：通常以 "# AGENTS.md instructions" 开头，
// 紧跟 <INSTRUCTIONS>…</INSTRUCTIONS>（即 AGENTS.md 正文），其后还可能带 <environment_context>…</environment_context>。
// 部分版本会在最前面再塞一段 <recommended_plugins>…</recommended_plugins> 推荐插件清单。
// 这不是用户真正输入的提问，而是来源工具塞进去的系统上下文。混在对话里既污染展示，
// 续聊时还会把整份 AGENTS.md 当成"用户说过的话"喂回模型，造成上下文错乱。
// 这里把首部整块（含可选的 recommended_plugins 前导）剥掉，只保留其后真正的提问正文；
// 若剥完后没有正文，调用方应整条丢弃。
export function stripInjectedAgentsInstructions(text: string): string {
  if (!text || !text.includes('<INSTRUCTIONS>')) return text
  const matched = text.match(/^\s*(?:<recommended_plugins>[\s\S]*?<\/recommended_plugins>\s*)?#\s*AGENTS\.md instructions[^\n]*\n[\s\S]*?<\/INSTRUCTIONS>(?:\s*<environment_context>[\s\S]*?<\/environment_context>)?/i)
  if (!matched) return text
  return text.slice(matched[0].length).replace(/^\s+/, '')
}

function hasInjectedAgentsInstructions(text: string): boolean {
  if (!text || !text.includes('<INSTRUCTIONS>')) return false
  return /^\s*(?:<recommended_plugins>[\s\S]*?<\/recommended_plugins>\s*)?#\s*AGENTS\.md instructions/i.test(text)
}

const IMAGE_MIMES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.heic': 'image/heic'
}

function assetUrl(id: string): string {
  return `imported-asset://${id}`
}

function imageAssetFromBuffer(buffer: Buffer, name: string, mime: string, sourcePath?: string): ImportedAsset {
  const id = stableId('asset', contentFingerprint(buffer.toString('base64')))
  return { id, name, mime, size: buffer.byteLength, sourcePath, base64: buffer.toString('base64') }
}

function imageAssetFromPath(path: string): ImportedAsset {
  const name = basename(path)
  const mime = IMAGE_MIMES[extname(path).toLowerCase()] || 'application/octet-stream'
  if (!existsSync(path)) {
    return {
      id: stableId('asset-missing', path), name, mime, size: 0, sourcePath: path,
      unavailableReason: '原图已不存在'
    }
  }
  try {
    return imageAssetFromBuffer(readFileSync(path), name, mime, path)
  } catch {
    return {
      id: stableId('asset-missing', path), name, mime, size: 0, sourcePath: path,
      unavailableReason: '原图无法读取'
    }
  }
}

function imageAssetFromDataUrl(dataUrl: string, fallbackName: string): ImportedAsset | undefined {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl)
  if (!match) return undefined
  try {
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64')
    if (buffer.length === 0) return undefined
    const extension = match[1].split('/')[1].replace('jpeg', 'jpg')
    return imageAssetFromBuffer(buffer, `${fallbackName}.${extension}`, match[1])
  } catch {
    return undefined
  }
}

function imageContent(asset: ImportedAsset) {
  return {
    type: 'image' as const, name: asset.name, mime: asset.mime, size: asset.size,
    url: asset.unavailableReason ? undefined : assetUrl(asset.id),
    unavailableReason: asset.unavailableReason
  }
}

function uniqueAssets(assets: ImportedAsset[]): ImportedAsset[] {
  return [...new Map(assets.map((asset) => [asset.id, asset])).values()]
}

function localImageReferences(text: string, cwd: string): Array<{ raw: string; asset: ImportedAsset }> {
  const result: Array<{ raw: string; asset: ImportedAsset }> = []
  for (const match of text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1].trim().replace(/^<|>$/g, '')
    const withoutTitle = raw.replace(/\s+["'][^"']*["']\s*$/, '')
    if (!/\.(?:png|jpe?g|webp|gif|heic)$/i.test(withoutTitle) || /^https?:/i.test(withoutTitle)) continue
    if (!isAbsolute(withoutTitle) && /(?:^|\/)\.\.?(?:\/|$)|[.…]|xxx/i.test(withoutTitle)) continue
    const path = isAbsolute(withoutTitle) ? withoutTitle : resolve(cwd, withoutTitle)
    if (!isAbsolute(withoutTitle) && !existsSync(path)) continue
    result.push({ raw, asset: imageAssetFromPath(path) })
  }
  return result
}

function attachFinalImages(messages: AgentMessage[], assets: ImportedAsset[], cwd: string): void {
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    const references = localImageReferences(message.content, cwd)
    if (references.length === 0) continue
    assets.push(...references.map((item) => item.asset))
    message.attachments = [
      ...(message.attachments || []),
      ...references.map(({ asset }) => ({
        type: 'image' as const, name: asset.name, mime: asset.mime, size: asset.size,
        dataUrl: asset.unavailableReason ? undefined : assetUrl(asset.id),
        unavailableReason: asset.unavailableReason
      }))
    ]
    for (const reference of references) message.content = message.content.replace(`](${reference.raw})`, `](${assetUrl(reference.asset.id)})`)
  }
}

function embeddedImages(value: unknown, prefix: string): ImportedAsset[] {
  const found = new Map<string, ImportedAsset>()
  const visit = (item: unknown, index = 0): void => {
    if (typeof item === 'string') {
      for (const match of item.matchAll(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+/gi)) {
        const asset = imageAssetFromDataUrl(match[0], `${prefix}-${index + 1}`)
        if (asset) found.set(asset.id, asset)
      }
      return
    }
    if (Array.isArray(item)) return item.forEach(visit)
    if (!item || typeof item !== 'object') return
    const record = item as JsonRecord
    if (record.type === 'image' && record.source?.type === 'base64' && typeof record.source.data === 'string') {
      const asset = imageAssetFromDataUrl(`data:${record.source.media_type || 'image/png'};base64,${record.source.data}`, `${prefix}-${index + 1}`)
      if (asset) found.set(asset.id, asset)
    }
    Object.values(record).forEach(visit)
  }
  visit(value)
  return [...found.values()]
}

function addProcessImages(turns: Turn[], groups: Map<number, ImportedAsset[]>, prefix: string, createdAt: number): void {
  for (const [turnIndex, assets] of groups) {
    const turn = turns[Math.max(0, Math.min(turnIndex, turns.length - 1))]
    if (!turn || assets.length === 0) continue
    const finalIndex = turn.items.findIndex((item) => item.type === 'agentMessage' && item.phase === 'final_answer')
    const item = {
      type: 'toolCall' as const, id: `${prefix}-process-images-${turnIndex}`, kind: 'read_file' as const,
      toolName: '查看图片', args: {}, status: 'completed' as const, resultSummary: `查看了 ${assets.length} 张图片`,
      images: uniqueAssets(assets).map(imageContent), startedAt: createdAt + turnIndex, finishedAt: createdAt + turnIndex
    }
    turn.items.splice(finalIndex < 0 ? turn.items.length : finalIndex, 0, item)
  }
}

function cursorUserText(content: string): { text: string; imagePaths: string[] } {
  const query = [...content.matchAll(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/gi)].at(-1)?.[1]
  const imagePaths = [...content.matchAll(/<image_files>([\s\S]*?)<\/image_files>/gi)]
    .flatMap((match) => match[1].split('\n'))
    .flatMap((line) => line.match(/^\s*\d+\.\s+(\/.*\.(?:png|jpe?g|webp|gif|heic))\s*$/i)?.[1] || [])
  if (query !== undefined) return { text: cleanLeakedWrapperTags(stripInjectedAgentsInstructions(hideSensitiveText(query.trim()))), imagePaths }
  return {
    text: cleanLeakedWrapperTags(stripInjectedAgentsInstructions(hideSensitiveText(content))),
    imagePaths
  }
}

function cleanCursorAssistantText(content: string): string {
  return cleanLeakedWrapperTags(hideSensitiveText(content
    .replace(/`?<\/?think>`?/gi, '')
    .replace(/(?:^|\n)\s*```(?:thinking)?\s*\n[\s\S]*?```\s*(?=\n|$)/gi, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()))
}

function titleFrom(messages: AgentMessage[], fallback: string): string {
  const title = messages.find((message) => message.role === 'user')?.content.replace(/\s+/g, ' ').trim()
  return title ? title.slice(0, 80) : fallback
}

// 剥离 Codex 注入的 AGENTS.md 指令块并丢弃因此变空的用户消息及其 turn 条目。
// 返回裁剪后的 messages/turns；未命中指令块时 changed=false，原样返回。
// turns 里的 userMessage/agentMessage 条目与 messages 一一对应且同序，裁掉某条消息时同步裁掉对应 turn 条目，
// 轮次变空则整轮丢弃。其他类型条目（toolCall 等）原样保留。
function pruneInjectedAgentsInstructions(messages: AgentMessage[], turns: Turn[]): { messages: AgentMessage[]; turns: Turn[]; changed: boolean } {
  const stripped: AgentMessage[] = []
  const dropFlags: boolean[] = []
  let strippedAny = false
  for (const message of messages) {
    if (message.role === 'user') {
      const raw = typeof message.content === 'string' ? message.content : ''
      if (hasInjectedAgentsInstructions(raw)) {
        const next = stripInjectedAgentsInstructions(raw)
        const hasImages = (message.attachments || []).some((a) => a.type === 'image')
        if (!next.trim() && !hasImages) {
          dropFlags.push(true)
          stripped.push(message)
          strippedAny = true
          continue
        }
        if (next !== raw) {
          stripped.push({ ...message, content: next })
          dropFlags.push(false)
          strippedAny = true
          continue
        }
      }
    }
    dropFlags.push(false)
    stripped.push(message)
  }
  if (!strippedAny) return { messages, turns, changed: false }
  const keptMessages = stripped.filter((_, i) => !dropFlags[i])
  const keptTurns: Turn[] = []
  let cursor = 0
  for (const turn of turns) {
    const items: Turn['items'] = []
    for (const item of turn.items) {
      if (item.type === 'userMessage' || item.type === 'agentMessage') {
        // turn 条目与消息按原始顺序一一对应：对应消息被丢弃时，这个 turn 条目也一起删掉，
        // 不能把后面的消息往前挪，否则会错位（userMessage 条目对上 assistant 消息等）。
        if (cursor >= stripped.length) break
        const dropped = dropFlags[cursor]
        cursor += 1
        if (dropped) continue
        items.push(item)
      } else {
        items.push(item)
      }
    }
    if (items.length) keptTurns.push({ ...turn, items })
  }
  return { messages: keptMessages, turns: keptTurns, changed: true }
}

// 修复早期导入遗留的脏数据：当时解析器既没剥 <user_query> 等 UI 包裹标签，也没提取图片。
// 这里对已经落盘的 messages/turns 做就地重洗：
// - 用户消息：从 <image_files> 里把图片路径补提取为资源并挂成附件；Cursor 来源取最后一个 <user_query> 的正文，
//   Codex/Claude 来源（可能是用户粘贴的 Cursor 内容）只剥包裹标签、保留全部正文。
// - 助手消息：扫描本地 markdown 图片引用（![](本地路径)）补提为资源并改写为 imported-asset://。
// 幂等：已是干净内容时不会再改动；已转成 imported-asset:// 的引用会被 localImageReferences 跳过。
export function repairStoredSession(
  source: ImportSourceId,
  messages: AgentMessage[],
  turns: Turn[],
  cwd: string
): { messages: AgentMessage[]; turns: Turn[]; assets: ImportedAsset[]; changed: boolean } {
  const assets: ImportedAsset[] = []
  const assetById = new Map<string, ImportedAsset>()
  const remember = (asset: ImportedAsset) => {
    if (!assetById.has(asset.id)) { assetById.set(asset.id, asset); assets.push(asset) }
  }
  const extractImageFiles = (content: string): ImportedAsset[] => {
    const paths = [...content.matchAll(/<image_files>([\s\S]*?)<\/image_files>/gi)]
      .flatMap((match) => match[1].split('\n'))
      .flatMap((line) => line.match(/^\s*\d+\.\s+(\/.*\.(?:png|jpe?g|webp|gif|heic))\s*$/i)?.[1] || [])
    return paths.map(imageAssetFromPath)
  }
  let changed = false

  // 先剥 AGENTS.md 指令块：早期导入把 Codex 注入的 "# AGENTS.md instructions ... </environment_context>"
  // 整块当成首条用户提问落盘了。这里剥掉指令块；若剥完后没有正文也没有图片，整条消息连同对应 turn 条目一起丢弃，
  // 让对话从真正的第一条提问开始，续聊时也不会把 AGENTS.md 喂回模型。
  const pruned = pruneInjectedAgentsInstructions(messages, turns)
  if (pruned.changed) { changed = true; messages = pruned.messages; turns = pruned.turns }

  const repairedMessages = messages.map((message) => {
    const raw = message.content || ''
    if (message.role === 'user') {
      const hasWrapper = /<(?:user_query|image_files|timestamp)>/i.test(raw) || /^\s*\[Image\]\s*$/m.test(raw)
      const hasAgentsBlock = hasInjectedAgentsInstructions(raw)
      if (!hasWrapper && !hasAgentsBlock && (message.attachments || []).length) return message
      const fileAssets = extractImageFiles(raw)
      fileAssets.forEach(remember)
      let text: string
      if (source === 'cursor') {
        const parsed = cursorUserText(raw)
        text = parsed.text
      } else {
        text = cleanLeakedWrapperTags(stripInjectedAgentsInstructions(hideSensitiveText(raw)))
      }
      const imageAttachments = fileAssets.map((asset) => ({
        type: 'image' as const, name: asset.name, mime: asset.mime, size: asset.size,
        dataUrl: asset.unavailableReason ? undefined : assetUrl(asset.id),
        unavailableReason: asset.unavailableReason
      }))
      const existingImageAttachments = (message.attachments || []).filter((a) => a.type === 'image' && !fileAssets.some((na) => a.name === na.name))
      const newContent = text
      const newAttachments = [...existingImageAttachments, ...imageAttachments]
      if (newContent !== raw || imageAttachments.length) {
        changed = true
        return { ...message, content: newContent, attachments: newAttachments.length ? newAttachments : message.attachments }
      }
      return message
    }
    // assistant
    const references = localImageReferences(raw, cwd)
    if (references.length) {
      references.forEach((ref) => remember(ref.asset))
      let next = raw
      for (const ref of references) next = next.replace(`](${ref.raw})`, `](${assetUrl(ref.asset.id)})`)
      const cleaned = cleanLeakedWrapperTags(hideSensitiveText(next))
      const imageAttachments = references.map(({ asset }) => ({
        type: 'image' as const, name: asset.name, mime: asset.mime, size: asset.size,
        dataUrl: asset.unavailableReason ? undefined : assetUrl(asset.id),
        unavailableReason: asset.unavailableReason
      }))
      const existing = (message.attachments || []).filter((a) => a.type === 'image' && !references.some((r) => r.asset.name === a.name))
      changed = true
      return { ...message, content: cleaned, attachments: [...existing, ...imageAttachments] }
    }
    if (/<(?:user_query|image_files|timestamp)>/i.test(raw) || /^\s*\[Image\]\s*$/m.test(raw) || /^\s*\*\*复制\*\*\s*$/m.test(raw)) {
      const cleaned = cleanLeakedWrapperTags(hideSensitiveText(raw))
      if (cleaned !== raw) { changed = true; return { ...message, content: cleaned } }
    }
    return message
  })

  // turns 里的 userMessage / agentMessage 条目按消息顺序一一对应；用修复后的消息回填它们的内容与图片。
  let cursor = 0
  for (const turn of turns) {
    for (const item of turn.items) {
      if (item.type === 'userMessage') {
        const m = repairedMessages[cursor++]
        if (!m) continue
        const textPart = m.content ? [{ type: 'text' as const, text: m.content }] : []
        const imageParts = (m.attachments || []).filter((a) => a.type === 'image').map((a) => ({
          type: 'image' as const, name: a.name, mime: a.mime, size: a.size,
          url: a.dataUrl,
          unavailableReason: (a as typeof a & { unavailableReason?: string }).unavailableReason
        }))
        const nextContent = [...textPart, ...imageParts]
        if (JSON.stringify(nextContent) !== JSON.stringify(item.content)) { changed = true; item.content = nextContent }
      } else if (item.type === 'agentMessage') {
        const m = repairedMessages[cursor++]
        if (!m) continue
        const images = (m.attachments || []).filter((a) => a.type === 'image').map((a) => ({
          type: 'image' as const, name: a.name, mime: a.mime, size: a.size,
          url: a.dataUrl,
          unavailableReason: (a as typeof a & { unavailableReason?: string }).unavailableReason
        }))
        if (m.content !== item.text || JSON.stringify(images) !== JSON.stringify(item.images || [])) {
          changed = true
          item.text = m.content; item.images = images.length ? images : item.images
        }
      }
    }
  }

  return { messages: repairedMessages, turns, assets, changed }
}

function toTurns(messages: AgentMessage[], prefix: string, createdAt: number): Turn[] {
  const turns: Turn[] = []
  for (const [index, message] of messages.entries()) {
    if (message.role === 'user' || turns.length === 0) {
      turns.push({ id: `${prefix}-turn-${turns.length + 1}`, status: 'completed', startedAt: createdAt + index, items: [] })
    }
    turns.at(-1)?.items.push(message.role === 'user'
      ? { type: 'userMessage', id: `${prefix}-item-${index}`, content: [
          ...(message.content ? [{ type: 'text' as const, text: message.content }] : []),
          ...(message.attachments || []).filter((attachment) => attachment.type === 'image').map((attachment) => ({
            type: 'image' as const, name: attachment.name, mime: attachment.mime, size: attachment.size,
            url: attachment.dataUrl,
            unavailableReason: (attachment as typeof attachment & { unavailableReason?: string }).unavailableReason
          }))
        ] }
      : { type: 'agentMessage', id: `${prefix}-item-${index}`, text: message.content, phase: 'final_answer',
          images: (message.attachments || []).filter((attachment) => attachment.type === 'image').map((attachment) => ({
            type: 'image' as const, name: attachment.name, mime: attachment.mime, size: attachment.size,
            url: attachment.dataUrl,
            unavailableReason: (attachment as typeof attachment & { unavailableReason?: string }).unavailableReason
          })) })
  }
  return turns
}

function project(source: ImportSourceId, cwd: string, createdAt: number, updatedAt: number): ImportedProject {
  const folderPath = normalizedProjectPath(cwd)
  return {
    id: stableId('project', folderPath), source, sourceProjectId: cwd,
    name: basename(folderPath) || folderPath, folderPath, createdAt, updatedAt
  }
}

function hideSensitiveText(content: string): string {
  return content
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi, '[私密凭据已隐藏]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [已隐藏]')
    .replace(/\b(?:sk|sk-ant|xai|AIza)[A-Za-z0-9_-]{12,}\b/g, '[访问配置已隐藏]')
    .replace(/\b(?:ghp_|github_pat_|glpat-|AKIA)[A-Za-z0-9_-]{12,}\b/g, '[访问配置已隐藏]')
    .replace(/((?:api[_-]?key|token|secret|password|authorization|credential)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[已隐藏]')
    .replace(/((?:--?(?:api[_-]?key|token|secret|password|authorization|credential))(?:(?:\s*=\s*)|\s+|(?=["'])))(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[已隐藏]')
    .replace(/([a-z][a-z0-9+.-]*:\/\/[^\s/:]+:)[^@\s]+@/gi, '$1[已隐藏]@')
}

function resource(source: ImportSourceId, kind: ImportedResource['kind'], path: string, projectId?: string): ImportedResource {
  const content = hideSensitiveText(readFileSync(path, 'utf8'))
  // skills 目录结构为 …/skills/<skill-name>/SKILL.md，名称必须取父目录，否则全部叫 SKILL.md，去重会只剩 1 个
  const name = kind === 'skill'
    ? (basename(dirname(path)) || basename(path))
    : basename(dirname(path)) === 'memory'
      ? basename(path)
      : basename(path)
  return {
    id: stableId('resource', `${source}:${kind}:${path}`), source, sourceId: path, projectId, kind,
    name, sourcePath: path,
    content, enabled: false, fingerprint: contentFingerprint(content)
  }
}

function safeJsonResource(source: ImportSourceId, kind: ImportedResource['kind'], path: string, projectId?: string): ImportedResource {
  const hide = (value: unknown, key = ''): unknown => {
    if (/token|secret|password|api.?key|authorization|credential|env(?:ironment)?/i.test(key)) return '[已隐藏]'
    if (Array.isArray(value)) return value.map((item) => hide(item))
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, hide(childValue, childKey)]))
    }
    return value
  }
  const content = hideSensitiveText(JSON.stringify(hide(readStableJson(path)), null, 2))
  return {
    id: stableId('resource', `${source}:${kind}:${path}`), source, sourceId: path, projectId, kind,
    name: basename(path), sourcePath: path, content, enabled: false, fingerprint: contentFingerprint(content)
  }
}

/** MCP 配置整文件导入（保留 env/密钥），导入后可直接使用 */
function mcpJsonResource(source: ImportSourceId, path: string, projectId?: string): ImportedResource {
  const raw = readFileSync(path, 'utf8')
  const content = raw.trim()
  return {
    id: stableId('resource', `${source}:mcp:${path}`), source, sourceId: path, projectId, kind: 'mcp',
    name: basename(path), sourcePath: path, content, enabled: false, fingerprint: contentFingerprint(content)
  }
}

function countMcpServersInContent(content: string | undefined): number {
  if (!content) return 0
  try {
    const parsed = JSON.parse(content) as JsonRecord
    const servers = (parsed.mcpServers || parsed) as JsonRecord
    if (servers && typeof servers === 'object' && !Array.isArray(servers)) {
      return Object.keys(servers).filter((key) => key !== 'mcpServers').length || Object.keys(servers).length
    }
  } catch {
    const headers = content.match(/^\[mcp_servers\.[^\]]+\]$/gm) || []
    const servers = new Set(headers.map((line) => line.replace(/^\[mcp_servers\.([^.\]\s]+).*$/, '$1')))
    if (servers.size > 0) return servers.size
  }
  return content.trim() ? 1 : 0
}

export function resourceCategory(resource: ImportedResource): ImportCategoryId | undefined {
  if (resource.kind === 'instruction') return resource.projectId ? 'project-rules' : 'global-rules'
  if (resource.kind === 'memory' || resource.kind === 'history-summary') return resource.projectId ? 'project-memory' : 'global-memory'
  if (resource.kind === 'mcp') return resource.projectId ? 'project-mcp' : 'global-mcp'
  if (resource.kind === 'skill') return resource.projectId ? 'project-skills' : 'global-skills'
  return undefined
}

export function buildCategoryCounts(candidate: ImportCandidate): ImportCategoryCounts {
  const counts: ImportCategoryCounts = {
    globalRules: 0, globalMemory: 0, globalMcp: 0, globalSkills: 0,
    projectRules: 0, projectMemory: 0, projectChatProjects: candidate.projects.length,
    projectChatConversations: candidate.sessions.length, projectMcp: 0, projectSkills: 0
  }
  for (const resource of candidate.resources) {
    const category = resourceCategory(resource)
    if (category === 'global-rules') counts.globalRules += 1
    else if (category === 'global-memory') counts.globalMemory += 1
    else if (category === 'global-mcp') counts.globalMcp += countMcpServersInContent(resource.content)
    else if (category === 'global-skills') counts.globalSkills += 1
    else if (category === 'project-rules') counts.projectRules += 1
    else if (category === 'project-memory') counts.projectMemory += 1
    else if (category === 'project-mcp') counts.projectMcp += countMcpServersInContent(resource.content)
    else if (category === 'project-skills') counts.projectSkills += 1
  }
  return counts
}

function safeJsonSectionResource(source: ImportSourceId, kind: ImportedResource['kind'], path: string, keys: string[]): ImportedResource | undefined {
  if (!existsSync(path)) return undefined
  const parsed = readStableJson(path)
  const selected = Object.fromEntries(keys.filter((key) => parsed[key] !== undefined).map((key) => [key, parsed[key]]))
  if (Object.keys(selected).length === 0) return undefined
  const temporary = hideSensitiveText(JSON.stringify(selected, (key, value) =>
    /token|secret|password|api.?key|authorization|credential|env(?:ironment)?/i.test(key) ? '[已隐藏]' : value, 2))
  return {
    id: stableId('resource', `${source}:${kind}:${path}:${keys.join(',')}`), source, sourceId: `${path}#${keys.join(',')}`, kind,
    name: basename(path), sourcePath: path, content: temporary, enabled: false, fingerprint: contentFingerprint(temporary)
  }
}

function codexMcpResource(path: string, projectId?: string): ImportedResource | undefined {
  if (!existsSync(path)) return undefined
  const lines = readFileSync(path, 'utf8').split('\n')
  const selected: string[] = []
  let include = false
  for (const line of lines) {
    const header = line.trim().match(/^\[([^\]]+)\]$/)?.[1]
    if (header) include = header === 'mcp_servers' || header.startsWith('mcp_servers.')
    if (!include) continue
    selected.push(line)
  }
  const content = selected.join('\n').trim()
  if (!content) return undefined
  return {
    id: stableId('resource', `codex:mcp:${path}`), source: 'codex', sourceId: `${path}#mcp_servers`, projectId, kind: 'mcp',
    name: '外部连接', sourcePath: path, content, enabled: false, fingerprint: contentFingerprint(content)
  }
}

function uniqueProjects(projects: ImportedProject[]): ImportedProject[] {
  return [...new Map(projects.map((item) => [item.id, item])).values()]
}

function projectInstructions(source: ImportSourceId, projects: ImportedProject[]): ImportedResource[] {
  const names = new Set(source === 'cursor' ? ['AGENTS.md'] : source === 'codex' ? ['AGENTS.md'] : ['CLAUDE.md', 'AGENTS.md'])
  const result: ImportedResource[] = []
  for (const item of projects) {
    if (!item.folderPath) continue
    const folders: string[] = []
    let current = item.folderPath
    for (let depth = 0; depth < 8; depth += 1) {
      folders.push(current)
      if (existsSync(join(current, '.git'))) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    for (const folder of folders.reverse()) {
      for (const name of names) {
        const path = join(folder, name)
        if (existsSync(path)) result.push(resource(source, 'instruction', path, item.id))
      }
    }
  }
  return [...new Map(result.map((item) => [item.id, item])).values()]
}

export function parseCodexFile(path: string): { project: ImportedProject; session: ImportedSession; unavailable: string[] } {
  const records = readStableLines(path)
  const meta = records.find((record) => record.type === 'session_meta')?.payload
  if (!meta?.id || !meta?.cwd) throw new Error('缺少对话编号或项目位置')
  const assets: ImportedAsset[] = []
  const processImages = new Map<number, ImportedAsset[]>()
  let userIndex = -1
  const messages: AgentMessage[] = records.flatMap((record) => {
    const payload = record.type === 'response_item' ? record.payload : undefined
    if (!payload || !['user', 'assistant'].includes(payload.role) || payload.type !== 'message') return []
    if (payload.role === 'user') userIndex += 1
    const content = textFromBlocks(payload.content)
    const imageAssets = payload.role === 'user' && Array.isArray(payload.content)
      ? payload.content.flatMap((block: JsonRecord, index: number) => {
          if (!['input_image', 'image'].includes(block?.type)) return []
          const dataUrl = block.image_url || block.url
          const asset = typeof dataUrl === 'string' ? imageAssetFromDataUrl(dataUrl, `用户图片-${index + 1}`) : undefined
          if (asset) assets.push(asset)
          return asset ? [asset] : []
        })
      : []
    return content || imageAssets.length ? [{
      role: payload.role as 'user' | 'assistant', content,
      ...(imageAssets.length ? { attachments: imageAssets.map((asset) => ({
        type: 'image' as const, name: asset.name, mime: asset.mime, size: asset.size, dataUrl: assetUrl(asset.id)
      })) } : {})
    }] : []
  })
  userIndex = -1
  for (const record of records) {
    const payload = record.type === 'response_item' ? record.payload : undefined
    if (payload?.type === 'message' && payload.role === 'user') userIndex += 1
    if (!payload || !['function_call_output', 'custom_tool_call_output'].includes(payload.type)) continue
    const found = embeddedImages(payload.output ?? payload.content, `过程图片-${userIndex + 1}`)
    if (found.length) processImages.set(Math.max(0, userIndex), [...(processImages.get(Math.max(0, userIndex)) || []), ...found])
  }
  attachFinalImages(messages, assets, String(meta.cwd))
  if (messages.length === 0) throw new Error('没有可识别的对话正文')
  const sourceId = String(meta.id)
  const createdAt = time(meta.timestamp, statSync(path).birthtimeMs)
  const updatedAt = statSync(path).mtimeMs
  const importedProject = project('codex', String(meta.cwd), createdAt, updatedAt)
  const turns = toTurns(messages, sourceId, createdAt)
  for (const images of processImages.values()) assets.push(...images)
  addProcessImages(turns, processImages, sourceId, createdAt)
  const unsupported = records.filter((record) => record.type === 'response_item' &&
    ['function_call', 'function_call_output', 'custom_tool_call', 'custom_tool_call_output'].includes(record.payload?.type)).length
  const title = titleFrom(messages, basename(path, '.jsonl'))
  const archived = path.includes('/archived_sessions/')
  return {
    project: importedProject,
    session: {
      id: stableId('session', `codex:${sourceId}`), source: 'codex', sourceSessionId: sourceId,
      sourceProjectId: String(meta.cwd), projectId: importedProject.id, title,
      createdAt, updatedAt, archived, compatibility: unsupported ? 'view-only' : 'full',
      fingerprint: contentFingerprint({ title, projectId: importedProject.id, archived, messages, turns, assets: uniqueAssets(assets).map((asset) => asset.id) }),
      messages, turns, assets: uniqueAssets(assets)
    },
    unavailable: unsupported ? [`${unsupported} 条操作过程仅保留在来源中`] : []
  }
}

export function parseClaudeFile(path: string): { project: ImportedProject; session: ImportedSession; unavailable: string[] } {
  const records = readStableLines(path)
  const base = records.find((record) => record.sessionId && record.cwd)
  if (!base?.sessionId || !base?.cwd) throw new Error('缺少对话编号或项目位置')
  const customTitle = [...records].reverse().find((record) => record.type === 'custom-title')?.customTitle
  let unsupported = 0
  const assets: ImportedAsset[] = []
  const processImages = new Map<number, ImportedAsset[]>()
  let userIndex = -1
  const messages: AgentMessage[] = records.flatMap((record) => {
    if (!['user', 'assistant'].includes(record.type) || record.isSidechain === true) return []
    const toolResultOnly = record.type === 'user' && Array.isArray(record.message?.content) &&
      record.message.content.every((block: JsonRecord) => block?.type === 'tool_result')
    if (record.type === 'user' && !toolResultOnly) userIndex += 1
    if (toolResultOnly) {
      const found = embeddedImages(record.message.content, `过程图片-${userIndex + 1}`)
      if (found.length) processImages.set(Math.max(0, userIndex), [...(processImages.get(Math.max(0, userIndex)) || []), ...found])
    }
    if (Array.isArray(record.message?.content)) {
      unsupported += record.message.content.filter((block: JsonRecord) =>
        block && !['input_text', 'output_text', 'text'].includes(block.type)).length
    }
    const content = textFromBlocks(record.message?.content)
    const imageAssets = record.type === 'user' && Array.isArray(record.message?.content)
      ? record.message.content.flatMap((block: JsonRecord, index: number) => {
          if (block?.type !== 'image' || block.source?.type !== 'base64' || typeof block.source?.data !== 'string') return []
          const dataUrl = `data:${block.source.media_type || 'image/png'};base64,${block.source.data}`
          const asset = imageAssetFromDataUrl(dataUrl, `用户图片-${index + 1}`)
          if (asset) assets.push(asset)
          return asset ? [asset] : []
        })
      : []
    if (!content && imageAssets.length === 0) {
      if (record.message?.content && !Array.isArray(record.message.content)) unsupported += 1
      return []
    }
    return [{
      role: record.type as 'user' | 'assistant', content,
      ...(imageAssets.length ? { attachments: imageAssets.map((asset) => ({
        type: 'image' as const, name: asset.name, mime: asset.mime, size: asset.size, dataUrl: assetUrl(asset.id)
      })) } : {})
    }]
  })
  attachFinalImages(messages, assets, String(base.cwd))
  if (messages.length === 0) throw new Error('没有可识别的对话正文')
  const sourceId = String(base.sessionId)
  const createdAt = Math.min(...records.map((record) => time(record.timestamp, Number.POSITIVE_INFINITY)).filter(Number.isFinite))
  const updatedAt = statSync(path).mtimeMs
  const importedProject = project('claude-code', String(base.cwd), createdAt, updatedAt)
  const turns = toTurns(messages, sourceId, createdAt)
  for (const images of processImages.values()) assets.push(...images)
  addProcessImages(turns, processImages, sourceId, createdAt)
  const title = typeof customTitle === 'string' ? customTitle : titleFrom(messages, basename(path, '.jsonl'))
  return {
    project: importedProject,
    session: {
      id: stableId('session', `claude-code:${sourceId}`), source: 'claude-code', sourceSessionId: sourceId,
      sourceProjectId: String(base.cwd), projectId: importedProject.id,
      title,
      createdAt, updatedAt, archived: false, compatibility: unsupported ? 'view-only' : 'full',
      fingerprint: contentFingerprint({ title, projectId: importedProject.id, archived: false, messages, turns, assets: uniqueAssets(assets).map((asset) => asset.id) }),
      messages, turns, assets: uniqueAssets(assets)
    },
    unavailable: unsupported ? [`${unsupported} 条思考、操作或附件记录仅保留在来源中`] : []
  }
}

function scanFiles(source: ImportSourceId, paths: string[], parser: typeof parseCodexFile): ImportCandidate {
  const projects: ImportedProject[] = []
  const sessions: ImportedSession[] = []
  const unavailable: ImportCandidate['unavailable'] = []
  for (const path of paths) {
    try {
      const file = statSync(path)
      const signature = `${file.size}:${file.mtimeMs}:${file.ctimeMs}`
      let cached = conversationCache.get(path)
      if (!cached || cached.signature !== signature) {
        try {
          cached = { signature, parsed: parser(path) }
        } catch (error) {
          cached = { signature, error: error instanceof Error ? error.message : '无法读取' }
        }
        conversationCache.set(path, cached)
      }
      if (!cached.parsed) throw new Error(cached.error || '无法读取')
      const parsed = cached.parsed
      projects.push(parsed.project)
      sessions.push(parsed.session)
      unavailable.push(...parsed.unavailable.map((reason) => ({ sourceId: parsed.session.sourceSessionId, reason, severity: 'partial' as const })))
    } catch (error) {
      unavailable.push({ sourceId: stableId('file', path), reason: error instanceof Error ? error.message : '无法读取', severity: 'failed' })
    }
  }
  return { source, projects: uniqueProjects(projects), sessions, resources: [], unavailable }
}

function projectMcpAndSkills(source: ImportSourceId, projects: ImportedProject[]): ImportedResource[] {
  const result: ImportedResource[] = []
  for (const item of projects) {
    if (!item.folderPath) continue
    if (source === 'cursor') {
      const mcpPath = join(item.folderPath, '.cursor', 'mcp.json')
      if (existsSync(mcpPath)) result.push(mcpJsonResource('cursor', mcpPath, item.id))
      for (const skill of filesBelow(join(item.folderPath, '.cursor', 'skills'), 'SKILL.md', 3)) {
        result.push(resource('cursor', 'skill', skill, item.id))
      }
    } else if (source === 'codex') {
      const mcp = codexMcpResource(join(item.folderPath, '.codex', 'config.toml'), item.id)
      if (mcp) result.push(mcp)
      for (const skill of filesBelow(join(item.folderPath, '.codex', 'skills'), 'SKILL.md', 3)) {
        result.push(resource('codex', 'skill', skill, item.id))
      }
    } else {
      const settingsPath = join(item.folderPath, '.claude', 'settings.json')
      if (existsSync(settingsPath)) {
        try {
          const parsed = readStableJson(settingsPath)
          if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
            const content = JSON.stringify({ mcpServers: parsed.mcpServers }, null, 2)
            result.push({
              id: stableId('resource', `claude-code:mcp:${settingsPath}:${item.id}`),
              source: 'claude-code', sourceId: `${settingsPath}#mcpServers`, projectId: item.id, kind: 'mcp',
              name: 'mcpServers', sourcePath: settingsPath, content, enabled: false,
              fingerprint: contentFingerprint(content)
            })
          }
        } catch { /* ignore */ }
      }
      for (const skill of filesBelow(join(item.folderPath, '.claude', 'skills'), 'SKILL.md', 3)) {
        result.push(resource('claude-code', 'skill', skill, item.id))
      }
    }
  }
  return result
}

function resourcesBelow(source: ImportSourceId, home: string, projects: ImportedProject[]): ImportedResource[] {
  const root = join(home, source === 'codex' ? '.codex' : '.claude')
  const result = projectInstructions(source, projects)
  result.push(...projectMcpAndSkills(source, projects))
  const direct = source === 'codex' ? ['AGENTS.md'] : ['CLAUDE.md', 'AGENTS.md']
  for (const name of direct) if (existsSync(join(root, name))) result.push(resource(source, 'instruction', join(root, name)))
  const memoryRoot = source === 'codex' ? join(root, 'memories') : join(root, 'projects')
  const memoryFiles = filesBelow(memoryRoot, '.md', source === 'codex' ? 2 : 3)
    .filter((path) => source === 'codex' || path.includes('/memory/'))
  for (const path of memoryFiles) {
    const kind = source === 'codex' && path.includes('/rollout_summaries/') ? 'history-summary' : 'memory'
    result.push(resource(source, kind, path))
  }
  for (const path of filesBelow(join(root, 'skills'), 'SKILL.md', 3)) result.push(resource(source, 'skill', path))
  for (const path of filesBelow(join(root, 'agents'), source === 'codex' ? '.toml' : '.md', 2)) result.push(resource(source, 'agent', path))
  if (source === 'codex') {
    const mcp = codexMcpResource(join(root, 'config.toml'))
    if (mcp) result.push(mcp)
    const hooks = safeJsonSectionResource(source, 'automation', join(root, 'hooks.json'), ['hooks'])
    if (hooks) result.push(hooks)
  } else {
    for (const path of filesBelow(join(root, 'commands'), '.md', 3)) result.push(resource(source, 'automation', path))
    for (const path of filesBelow(join(root, 'rules'), '.md', 3)) result.push(resource(source, 'instruction', path))
    const settingsHooks = safeJsonSectionResource(source, 'automation', join(root, 'settings.json'), ['hooks'])
    if (settingsHooks) result.push(settingsHooks)
    try {
      const settingsPath = join(root, 'settings.json')
      if (existsSync(settingsPath)) {
        const parsed = readStableJson(settingsPath)
        if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
          const content = JSON.stringify({ mcpServers: parsed.mcpServers }, null, 2)
          result.push({
            id: stableId('resource', `${source}:mcp:${settingsPath}`),
            source, sourceId: `${settingsPath}#mcpServers`, kind: 'mcp',
            name: 'mcpServers', sourcePath: settingsPath, content, enabled: false,
            fingerprint: contentFingerprint(content)
          })
        }
      }
    } catch { /* ignore */ }
    const mcpConfig = join(root, 'mcp-configs', 'mcp-servers.json')
    if (existsSync(mcpConfig)) result.push(mcpJsonResource(source, mcpConfig))
  }
  return [...new Map(result.map((item) => [item.id, item])).values()]
}

export function scanCodex(home = homedir()): ImportCandidate {
  const current = filesBelow(join(home, '.codex', 'sessions'), '.jsonl')
  const archived = filesBelow(join(home, '.codex', 'archived_sessions'), '.jsonl')
  const candidate = scanFiles('codex', [...new Set([...current, ...archived])], parseCodexFile)
  candidate.projects = uniqueProjects(candidate.projects)
  candidate.sessions = [...new Map(candidate.sessions.map((item) => [item.id, item])).values()]
  candidate.resources = resourcesBelow('codex', home, candidate.projects)
  return candidate
}

export function scanClaudeCode(home = homedir()): ImportCandidate {
  const candidate = scanFiles('claude-code', filesBelow(join(home, '.claude', 'projects'), '.jsonl', 3), parseClaudeFile)
  candidate.resources = resourcesBelow('claude-code', home, candidate.projects)
  return candidate
}

interface CursorComposer {
  composerId: string
  name?: string
  createdAt?: number
  lastUpdatedAt?: number
  isArchived?: boolean
  isDraft?: boolean
  workspaceIdentifier?: { uri?: { fsPath?: string } }
  draftTarget?: { environment?: { uri?: { fsPath?: string } } }
  workspacePath?: string
}

function sqliteValue(path: string, key: string): JsonRecord | undefined {
  if (!existsSync(path)) return undefined
  try {
    const output = execFileSync('sqlite3', [path, `select value from ItemTable where key='${key.replaceAll("'", "''")}';`], {
      encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 10_000
    }).trim()
    return output ? JSON.parse(output) as JsonRecord : undefined
  } catch {
    return undefined
  }
}

function hasSqliteReader(): boolean {
  try {
    execFileSync('sqlite3', ['-version'], { stdio: 'ignore', timeout: 2_000 })
    return true
  } catch {
    return false
  }
}

function cursorVersion(packagePath = '/Applications/Cursor.app/Contents/Resources/app/package.json'): string | undefined {
  try {
    return String(readStableJson(packagePath).version)
  } catch {
    return undefined
  }
}

function cursorComposers(home: string, canReadDatabase: boolean): Map<string, CursorComposer> {
  const userRoot = join(home, 'Library', 'Application Support', 'Cursor', 'User')
  const result = new Map<string, CursorComposer>()
  if (!canReadDatabase) return result
  const global = sqliteValue(join(userRoot, 'globalStorage', 'state.vscdb'), 'composer.composerHeaders')
  for (const item of global?.allComposers || []) if (item?.composerId) result.set(item.composerId, item)
  const workspaceRoot = join(userRoot, 'workspaceStorage')
  if (!existsSync(workspaceRoot)) return result
  for (const folder of readdirSync(workspaceRoot)) {
    const root = join(workspaceRoot, folder)
    let workspacePath: string | undefined
    try {
      const workspace = readStableJson(join(root, 'workspace.json'))
      const url = workspace.folder || workspace.workspace
      if (typeof url === 'string' && url.startsWith('file:')) workspacePath = decodeURIComponent(new URL(url).pathname)
    } catch {
      // Some storage folders do not represent a local project.
    }
    const data = sqliteValue(join(root, 'state.vscdb'), 'composer.composerData')
    for (const item of data?.allComposers || []) {
      if (!item?.composerId) continue
      const previous = result.get(item.composerId) || {}
      result.set(item.composerId, { ...previous, ...item, workspacePath })
    }
  }
  return result
}

function cursorProjectPath(item: CursorComposer): string | undefined {
  return item.workspaceIdentifier?.uri?.fsPath || item.draftTarget?.environment?.uri?.fsPath || item.workspacePath
}

export function parseCursorTranscript(path: string, item: CursorComposer): { project: ImportedProject; session: ImportedSession } {
  const sourceId = basename(path, '.jsonl')
  if (!sourceId || sourceId !== item.composerId) throw new Error('对话编号无法与清单对应')
  const cwd = cursorProjectPath(item)
  if (!cwd) throw new Error('无法确认对话所属项目')
  const records = readStableLines(path)
  const assets: ImportedAsset[] = []
  const messages: AgentMessage[] = records.flatMap((record) => {
    if (!['user', 'assistant'].includes(record.role)) return []
    const raw = Array.isArray(record.message?.content)
      ? record.message.content.filter((block: JsonRecord) => block?.type === 'text' && typeof block.text === 'string').map((block: JsonRecord) => block.text).join('\n')
      : typeof record.message?.content === 'string' ? record.message.content : ''
    if (record.role === 'assistant') {
      const content = cleanCursorAssistantText(raw)
      return content ? [{ role: 'assistant' as const, content }] : []
    }
    const parsed = cursorUserText(raw)
    const imageAssets = parsed.imagePaths.map(imageAssetFromPath)
    assets.push(...imageAssets)
    return parsed.text || imageAssets.length ? [{
      role: 'user' as const, content: parsed.text,
      ...(imageAssets.length ? { attachments: imageAssets.map((asset) => ({
        type: 'image' as const, name: asset.name, mime: asset.mime, size: asset.size,
        dataUrl: asset.unavailableReason ? undefined : assetUrl(asset.id),
        unavailableReason: asset.unavailableReason
      })) } : {})
    }] : []
  })
  attachFinalImages(messages, assets, cwd)
  if (messages.length === 0) throw new Error('没有可识别的对话正文')
  const createdAt = Number(item.createdAt) || statSync(path).birthtimeMs
  const updatedAt = Number(item.lastUpdatedAt) || statSync(path).mtimeMs
  const importedProject = project('cursor', cwd, createdAt, updatedAt)
  const turns = toTurns(messages, sourceId, createdAt)
  const title = item.name || titleFrom(messages, sourceId)
  const archived = item.isArchived === true
  return {
    project: importedProject,
    session: {
      id: stableId('session', `cursor:${sourceId}`), source: 'cursor', sourceSessionId: sourceId,
      sourceProjectId: cwd, projectId: importedProject.id, title,
      createdAt, updatedAt, archived, compatibility: 'view-only',
      fingerprint: contentFingerprint({ title, projectId: importedProject.id, archived, messages, turns, assets: uniqueAssets(assets).map((asset) => asset.id) }),
      messages, turns, assets: uniqueAssets(assets)
    }
  }
}

export function scanCursor(home = homedir(), installedVersion = cursorVersion(), canReadDatabase = hasSqliteReader()): ImportCandidate {
  const version = installedVersion
  const supported = version === '3.10.15'
  const root = join(home, '.cursor')
  const candidate: ImportCandidate = { source: 'cursor', projects: [], sessions: [], resources: [], unavailable: [] }
  const userRoot = join(home, 'Library', 'Application Support', 'Cursor', 'User')
  const hasDatabase = existsSync(join(userRoot, 'globalStorage', 'state.vscdb')) || existsSync(join(userRoot, 'workspaceStorage'))
  const composers = cursorComposers(home, canReadDatabase)
  if (hasDatabase && !canReadDatabase) {
    candidate.unavailable.push({ sourceId: 'cursor-database', reason: '本机缺少 Cursor 资料读取条件，只能预览文件，无法可靠还原项目和对话', severity: 'failed' })
  }
  for (const item of composers.values()) {
    const cwd = cursorProjectPath(item)
    if (cwd) candidate.projects.push(project('cursor', cwd, Number(item.createdAt) || 0, Number(item.lastUpdatedAt) || 0))
  }
  const transcripts = filesBelow(join(root, 'projects'), '.jsonl', 6)
    .filter((path) => path.includes('/agent-transcripts/') && !path.includes('/subagents/'))
  for (const path of transcripts) {
    const sourceId = basename(path, '.jsonl')
    if (!supported) {
      candidate.unavailable.push({ sourceId, reason: `Cursor ${version || '未知版本'} 尚未验证，只能预览`, severity: 'failed' })
      continue
    }
    const item = composers.get(sourceId)
    if (!item) {
      candidate.unavailable.push({ sourceId, reason: '对话没有可核对的项目清单', severity: 'failed' })
      continue
    }
    try {
      const file = statSync(path)
      const signature = `${file.size}:${file.mtimeMs}:${file.ctimeMs}:${contentFingerprint(item)}`
      let cached = conversationCache.get(path)
      if (!cached || cached.signature !== signature) {
        try {
          cached = { signature, parsed: { ...parseCursorTranscript(path, item), unavailable: ['附件、操作过程和原运行现场仅保留在来源中'] } }
        } catch (error) {
          cached = { signature, error: error instanceof Error ? error.message : '无法读取' }
        }
        conversationCache.set(path, cached)
      }
      if (!cached.parsed) throw new Error(cached.error || '无法读取')
      const parsed = cached.parsed
      candidate.projects.push(parsed.project)
      candidate.sessions.push(parsed.session)
      candidate.unavailable.push(...parsed.unavailable.map((reason) => ({ sourceId, reason, severity: 'partial' as const })))
    } catch (error) {
      candidate.unavailable.push({ sourceId, reason: error instanceof Error ? error.message : '无法读取', severity: 'failed' })
    }
  }
  candidate.projects = uniqueProjects(candidate.projects)
  candidate.resources.push(...projectInstructions('cursor', candidate.projects))
  candidate.resources.push(...projectMcpAndSkills('cursor', candidate.projects))
  for (const item of candidate.projects) {
    if (!item.folderPath) continue
    for (const rule of filesBelow(join(item.folderPath, '.cursor', 'rules'), '.md', 3)) {
      candidate.resources.push(resource('cursor', 'instruction', rule, item.id))
    }
    const legacyRule = join(item.folderPath, '.cursorrules')
    if (existsSync(legacyRule)) candidate.resources.push(resource('cursor', 'instruction', legacyRule, item.id))
  }
  const mcpPath = join(root, 'mcp.json')
  if (existsSync(mcpPath)) candidate.resources.push(mcpJsonResource('cursor', mcpPath))
  for (const skill of filesBelow(join(root, 'skills'), 'SKILL.md', 3)) candidate.resources.push(resource('cursor', 'skill', skill))
  for (const skill of filesBelow(join(root, 'skills-cursor'), 'SKILL.md', 3)) candidate.resources.push(resource('cursor', 'skill', skill))
  const hooks = safeJsonSectionResource('cursor', 'automation', join(root, 'hooks.json'), ['hooks'])
  if (hooks) candidate.resources.push(hooks)
  return candidate
}

function summary(candidate: ImportCandidate, name: string): ImportSourceSummary {
  const viewOnlyConversations = candidate.sessions.filter((session) => session.compatibility === 'view-only').length
  const failedConversations = candidate.unavailable.filter((item) => item.severity !== 'partial').length
  const categories = buildCategoryCounts(candidate)
  return {
    id: candidate.source, name, detected: candidate.projects.length > 0 || candidate.sessions.length > 0 || candidate.resources.length > 0 || candidate.unavailable.length > 0,
    compatibility: viewOnlyConversations || (candidate.sessions.length === 0 && candidate.unavailable.length > 0) ? 'view-only' : 'full', projects: candidate.projects.length,
    conversations: candidate.sessions.length, viewOnlyConversations,
    instructions: candidate.resources.filter((item) => item.kind === 'instruction').length,
    memories: candidate.resources.filter((item) => item.kind === 'memory').length,
    historySummaries: candidate.resources.filter((item) => item.kind === 'history-summary').length,
    extensions: candidate.resources.filter((item) => !['instruction', 'memory', 'history-summary'].includes(item.kind)).length,
    unavailable: candidate.unavailable.length, failedConversations, pending: 0,
    importedConversations: 0, importedProjects: 0, categories
  }
}

export function countPending(candidate: ImportCandidate, catalog: ImportCatalog): number {
  return candidate.projects.filter((item) => !catalog.projects.some((saved) => saved.id === item.id)).length +
    candidate.sessions.filter((item) => !catalog.sessions.some((saved) => saved.id === item.id && saved.fingerprint === item.fingerprint)).length +
    candidate.resources.filter((item) => !catalog.resources.some((saved) => saved.id === item.id && saved.fingerprint === item.fingerprint)).length
}

export function scanKnownSources(home = homedir(), installedCursorVersion = cursorVersion(), canReadCursorDatabase = hasSqliteReader()): { preview: ImportPreview; candidates: ImportCandidate[] } {
  const candidates = [scanCodex(home), scanClaudeCode(home), scanCursor(home, installedCursorVersion, canReadCursorDatabase)]
  const cursorSummary = summary(candidates[2], 'Cursor')
  cursorSummary.version = installedCursorVersion
  if (cursorSummary.version !== '3.10.15') {
    cursorSummary.compatibility = 'unsupported'
    cursorSummary.note = '当前版本尚未验证，只提供资料预览'
  } else if (candidates[2].unavailable.some((item) => item.sourceId === 'cursor-database')) {
    cursorSummary.compatibility = 'unsupported'
    cursorSummary.note = '本机暂时无法可靠读取 Cursor 项目和对话，只提供资料预览'
  }
  return {
    preview: { scannedAt: Date.now(), sources: [summary(candidates[0], 'Codex'), summary(candidates[1], 'Claude Code'), cursorSummary] },
    candidates
  }
}
