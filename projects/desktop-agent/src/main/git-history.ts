import { execFile } from 'node:child_process'
import { isAbsolute } from 'node:path'
import { promisify } from 'node:util'
import { gitRootMissingMessage, resolveGitRoot } from './git-root.js'

export type CommitFileChange = {
  path: string
  previousPath?: string
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'unknown'
  additions: number
  deletions: number
  binary: boolean
}

export type CommitHistoryItem = {
  hash: string
  shortHash: string
  parents: string[]
  refs: string[]
  author: string
  authorEmail: string
  timestamp: number
  subject: string
  body: string
  filesChanged: number
  additions: number
  deletions: number
  onCurrentBranch: boolean
}

export type CommitHistoryResult = {
  success: boolean
  commits?: CommitHistoryItem[]
  currentHash?: string
  currentBranch?: string
  changedFiles?: number
  hasMore?: boolean
  error?: string
}

export type CommitDetailResult = {
  success: boolean
  commit?: CommitHistoryItem
  files?: CommitFileChange[]
  error?: string
}

export type CommitDiffResult = {
  success: boolean
  fromHash?: string
  toHash?: string
  files?: CommitFileChange[]
  patch?: string
  truncated?: boolean
  error?: string
}

const RECORD = '\x1e'
const FIELD = '\x1f'
const MAX_OUTPUT = 1024 * 1024 * 16
const MAX_PATCH = 1024 * 1024
const READ_TIMEOUT = Number(process.env.XLD_GIT_READ_TIMEOUT) || 8000
const execFileAsync = promisify(execFile)

async function runGit(workspaceDir: string, args: string[], timeout = READ_TIMEOUT): Promise<string> {
  if (!workspaceDir || !isAbsolute(workspaceDir)) throw new Error('当前项目没有绑定本地文件夹')
  const { stdout } = await execFileAsync('git', ['-C', workspaceDir, ...args], {
    encoding: 'utf8',
    maxBuffer: MAX_OUTPUT,
    timeout
  })
  return stdout
}

function requireGitRoot(workspaceDir: string): string {
  if (!workspaceDir || !isAbsolute(workspaceDir)) throw new Error('当前项目没有绑定本地文件夹')
  const root = resolveGitRoot(workspaceDir)
  if (!root) throw new Error(gitRootMissingMessage())
  return root
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'killed' in error && (error as { killed?: boolean }).killed) {
    return '项目读取时间过长，请重试；如果项目位于云盘或移动硬盘，请先确认文件已经下载到本机'
  }
  if (error && typeof error === 'object' && 'stderr' in error) {
    const stderr = String((error as { stderr?: string | Buffer }).stderr || '').trim()
    if (stderr) return stderr.replace(/^fatal:\s*/i, '')
  }
  return error instanceof Error ? error.message : String(error || '读取失败')
}

function parseRefs(value: string): string[] {
  return value.split(',').map((ref) => ref.trim()).filter(Boolean)
}

function parseCount(value: string): number {
  return /^\d+$/.test(value) ? Number(value) : 0
}

export function parseHistoryOutput(output: string): CommitHistoryItem[] {
  return output.split(RECORD).map((record) => record.trim()).filter(Boolean).map((record) => {
    const [header = '', ...statLines] = record.split('\n')
    const [hash = '', parents = '', refs = '', author = '', authorEmail = '', timestamp = '0', subject = '', body = ''] = header.split(FIELD)
    let filesChanged = 0
    let additions = 0
    let deletions = 0
    for (const line of statLines) {
      const [added = '', deleted = '', filePath = ''] = line.split('\t')
      if (!filePath) continue
      filesChanged += 1
      additions += parseCount(added)
      deletions += parseCount(deleted)
    }
    return {
      hash,
      shortHash: hash.slice(0, 7),
      parents: parents.split(' ').filter(Boolean),
      refs: parseRefs(refs),
      author,
      authorEmail,
      timestamp: Number(timestamp) * 1000,
      subject,
      body: body.replace(/%n/g, '\n').trim(),
      filesChanged,
      additions,
      deletions,
      onCurrentBranch: false
    }
  })
}

function statusOf(code: string): CommitFileChange['status'] {
  if (code.startsWith('A')) return 'added'
  if (code.startsWith('M')) return 'modified'
  if (code.startsWith('D')) return 'deleted'
  if (code.startsWith('R')) return 'renamed'
  if (code.startsWith('C')) return 'copied'
  return 'unknown'
}

function parseNameStatus(output: string): Map<string, { status: CommitFileChange['status']; previousPath?: string }> {
  const result = new Map<string, { status: CommitFileChange['status']; previousPath?: string }>()
  for (const line of output.split('\n')) {
    const parts = line.split('\t')
    if (parts.length < 2) continue
    const code = parts[0]
    if ((code.startsWith('R') || code.startsWith('C')) && parts.length >= 3) {
      result.set(parts[2], { status: statusOf(code), previousPath: parts[1] })
    } else {
      result.set(parts[1], { status: statusOf(code) })
    }
  }
  return result
}

function parseNumstat(output: string, statuses: Map<string, { status: CommitFileChange['status']; previousPath?: string }>): CommitFileChange[] {
  const files: CommitFileChange[] = []
  for (const line of output.split('\n')) {
    const [added = '', deleted = '', ...pathParts] = line.split('\t')
    const path = pathParts[pathParts.length - 1]
    if (!path) continue
    const meta = statuses.get(path) || { status: 'unknown' as const }
    files.push({
      path,
      previousPath: meta.previousPath,
      status: meta.status,
      additions: parseCount(added),
      deletions: parseCount(deleted),
      binary: added === '-' || deleted === '-'
    })
  }
  return files
}

function baseCommitFormat(): string {
  return `${RECORD}%H${FIELD}%P${FIELD}%D${FIELD}%an${FIELD}%ae${FIELD}%at${FIELD}%s${FIELD}%b`
}

export async function getCommitHistory(workspaceDir: string, offset = 0, limit = 100): Promise<CommitHistoryResult> {
  try {
    const gitRoot = requireGitRoot(workspaceDir)
    await runGit(gitRoot, ['rev-parse', '--is-inside-work-tree'])
    const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0
    const safeLimit = Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.floor(limit))) : 100
    const [output, currentHashOutput, currentBranchOutput, currentBranchHashOutput] = await Promise.all([
      runGit(gitRoot, ['log', '--all', `--skip=${safeOffset}`, `--max-count=${safeLimit + 1}`, `--format=${baseCommitFormat()}`, '--date-order']),
      runGit(gitRoot, ['rev-parse', 'HEAD']),
      runGit(gitRoot, ['branch', '--show-current']),
      runGit(gitRoot, ['rev-list', `--max-count=${safeOffset + safeLimit + 1}`, 'HEAD'])
    ])
    const parsed = parseHistoryOutput(output)
    const currentHash = currentHashOutput.trim()
    const currentBranch = currentBranchOutput.trim()
    const currentBranchHashes = new Set(currentBranchHashOutput.split('\n').filter(Boolean))
    for (const commit of parsed) commit.onCurrentBranch = currentBranchHashes.has(commit.hash)
    return {
      success: true,
      commits: parsed.slice(0, safeLimit),
      currentHash,
      currentBranch: currentBranch || undefined,
      hasMore: parsed.length > safeLimit
    }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function getCommitDetail(workspaceDir: string, hash: string): Promise<CommitDetailResult> {
  try {
    const gitRoot = requireGitRoot(workspaceDir)
    const [metadata, nameStatusOutput, numstatOutput] = await Promise.all([
      runGit(gitRoot, ['show', '-s', `--format=${baseCommitFormat()}`, hash]),
      runGit(gitRoot, ['diff-tree', '--root', '--no-commit-id', '--name-status', '-r', '-M', hash]),
      runGit(gitRoot, ['diff-tree', '--root', '--no-commit-id', '--numstat', '-r', '-M', hash])
    ])
    const commit = parseHistoryOutput(metadata)[0]
    if (!commit) return { success: false, error: '没有找到这条提交记录' }
    const nameStatus = parseNameStatus(nameStatusOutput)
    const files = parseNumstat(numstatOutput, nameStatus)
    commit.filesChanged = files.length
    commit.additions = files.reduce((sum, file) => sum + file.additions, 0)
    commit.deletions = files.reduce((sum, file) => sum + file.deletions, 0)
    return { success: true, commit, files }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function getCommitDiff(workspaceDir: string, fromHash: string, toHash = 'HEAD', filePath?: string): Promise<CommitDiffResult> {
  try {
    const gitRoot = requireGitRoot(workspaceDir)
    const args = [fromHash, toHash]
    const pathArgs = filePath ? ['--', filePath] : []
    const [nameStatusOutput, numstatOutput, rawPatch] = await Promise.all([
      runGit(gitRoot, ['diff', '--name-status', '-M', ...args, ...pathArgs]),
      runGit(gitRoot, ['diff', '--numstat', '-M', ...args, ...pathArgs]),
      runGit(gitRoot, ['diff', '--no-ext-diff', '--unified=3', '--no-color', ...args, ...pathArgs])
    ])
    const nameStatus = parseNameStatus(nameStatusOutput)
    const files = parseNumstat(numstatOutput, nameStatus)
    const truncated = rawPatch.length > MAX_PATCH
    return {
      success: true,
      fromHash,
      toHash,
      files,
      patch: truncated ? `${rawPatch.slice(0, MAX_PATCH)}\n\n…内容过长，仅显示前一部分` : rawPatch,
      truncated
    }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}
