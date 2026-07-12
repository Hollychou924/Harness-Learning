import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clearGitRootCache, resolveGitRoot } from './git-root.js'

function initRepo(dir: string): void {
  execFileSync('git', ['init', dir])
  execFileSync('git', ['-C', dir, 'config', 'user.name', '测试用户'])
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com'])
}

test('子目录能解析到仓库根', () => {
  clearGitRootCache()
  const root = mkdtempSync(join(tmpdir(), 'git-root-sub-'))
  initRepo(root)
  const nested = join(root, 'apps', 'web')
  mkdirSync(nested, { recursive: true })
  const resolved = resolveGitRoot(nested)
  assert.ok(resolved)
  assert.equal(resolved, resolveGitRoot(root))
})

test('父目录向下能找到子仓库', () => {
  clearGitRootCache()
  const parent = mkdtempSync(join(tmpdir(), 'git-root-parent-'))
  const repo = join(parent, 'my-app')
  mkdirSync(repo)
  initRepo(repo)
  writeFileSync(join(repo, 'README.md'), 'hi\n')
  const resolved = resolveGitRoot(parent)
  assert.ok(resolved)
  assert.equal(resolved, resolveGitRoot(repo))
})

test('完全无关目录返回 null', () => {
  clearGitRootCache()
  const empty = mkdtempSync(join(tmpdir(), 'git-root-empty-'))
  assert.equal(resolveGitRoot(empty), null)
})
