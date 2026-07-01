import DOMPurify from 'dompurify'

// Block 缓存 + DOMPurify 消毒
// 参考 opencode markdown-cache.tsx

export interface CacheEntry {
  raw: string
  hash: string
  html: string
}

const MAX_CACHE = 200
const cache = new Map<string, CacheEntry>()

const PURIFY_CONFIG: DOMPurify.Config = {
  USE_PROFILES: { html: true, mathMl: true },
  SANITIZE_NAMED_PROPS: true,
  FORBID_TAGS: ['style'],
  FORBID_CONTENTS: ['style', 'script'],
  ADD_TAGS: ['svg', 'path'],
  ADD_ATTR: ['d', 'viewBox', 'preserveAspectRatio', 'xmlns', 'target', 'rel', 'class', 'data-language']
}

// 确保 rel=noopener noreferrer
if (typeof window !== 'undefined' && DOMPurify.isSupported) {
  DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
    if (!(node instanceof HTMLAnchorElement)) return
    if (node.target !== '_blank') return
    const rel = node.getAttribute('rel') ?? ''
    const set = new Set(rel.split(/\s+/).filter(Boolean))
    set.add('noopener')
    set.add('noreferrer')
    node.setAttribute('rel', Array.from(set).join(' '))
  })
}

export function sanitize(html: string): string {
  if (!DOMPurify.isSupported) return ''
  return DOMPurify.sanitize(html, PURIFY_CONFIG)
}

export function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash.toString(16)
}

export function getCached(key: string): CacheEntry | undefined {
  return cache.get(key)
}

export function touchCache(key: string, value: CacheEntry): void {
  cache.delete(key)
  cache.set(key, value)
  if (cache.size > MAX_CACHE) {
    const first = cache.keys().next().value
    if (first) cache.delete(first)
  }
}

export function getOrRender(key: string, raw: string, src: string, parser: (src: string) => string): CacheEntry {
  const cached = getCached(key)
  if (cached && cached.raw === raw) {
    touchCache(key, cached)
    return cached
  }
  const hash = fnv1a(raw)
  const html = sanitize(parser(src))
  const entry: CacheEntry = { raw, hash, html }
  touchCache(key, entry)
  return entry
}
