import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
  'vendor',
  'Pods',
  'DerivedData'
])

const gitRootCache = new Map<string, string>()

function normalizeDir(dir: string): string {
  const absolute = resolve(dir)
  try {
    return realpathSync(absolute)
  } catch {
    return absolute
  }
}

/** 目录本身或其祖先 / 浅层子目录里是否存在 Git 元数据（含 worktree 的 .git 文件） */
export function hasGitMetadata(dir: string): boolean {
  return existsSync(join(dir, '.git'))
}

/**
 * 从项目绑定路径解析真正的 Git 仓库根目录：
 * 1. git rev-parse --show-toplevel（已在仓库内，含子目录）
 * 2. 向上查找 .git
 * 3. 向下浅层搜索（绑定的是含仓库的父目录时）
 */
export function resolveGitRoot(startDir: string, maxDepth = 3): string | null {
  if (!startDir || !isAbsolute(startDir)) return null
  const start = normalizeDir(startDir)
  const cached = gitRootCache.get(start)
  if (cached) return cached

  let found: string | null = null
  try {
    const top = execFileSync('git', ['-C', start, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000
    }).trim()
    if (top) found = normalizeDir(top)
  } catch {
    /* 不在任何仓库内，继续手工查找 */
  }

  if (!found) {
    let cur = start
    for (;;) {
      if (hasGitMetadata(cur)) {
        found = cur
        break
      }
      const parent = dirname(cur)
      if (parent === cur) break
      cur = parent
    }
  }

  if (!found) {
    try {
      if (statSync(start).isDirectory()) {
        const nested = findGitRootDown(start, maxDepth)
        if (nested) found = normalizeDir(nested)
      }
    } catch {
      found = null
    }
  }

  // 只缓存命中结果：避免「先未 init 再 init」被错误的 null 卡住
  if (found) gitRootCache.set(start, found)
  return found
}

export function clearGitRootCache(): void {
  gitRootCache.clear()
}

function findGitRootDown(dir: string, depth: number): string | null {
  if (depth < 0) return null
  if (hasGitMetadata(dir)) return dir
  if (depth === 0) return null

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return null
  }

  const childDirs: string[] = []
  for (const name of entries) {
    if (name.startsWith('.') || SKIP_DIR_NAMES.has(name)) continue
    const child = join(dir, name)
    try {
      if (!statSync(child).isDirectory()) continue
    } catch {
      continue
    }
    childDirs.push(child)
  }

  // 先扫一层：优先返回更浅的仓库
  for (const child of childDirs) {
    if (hasGitMetadata(child)) return child
  }
  for (const child of childDirs) {
    const nested = findGitRootDown(child, depth - 1)
    if (nested) return nested
  }
  return null
}

export function gitRootMissingMessage(): string {
  return '在当前项目文件夹及其上下级目录中都没有找到 Git 仓库。请绑定含有 .git 的目录，或先执行 git init。'
}
