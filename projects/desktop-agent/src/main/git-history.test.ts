import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getCommitDetail, getCommitDiff, getCommitHistory, parseHistoryOutput } from './git-history.js'

test('解析提交、父版本、分支与文件统计', () => {
  const output = `\x1eabc123456789\x1fparent1 parent2\x1fHEAD -> main, origin/main\x1f周浩\x1fzhouhao@example.com\x1f1700000000\x1f修复问题\x1f补充说明\n2\t1\tsrc/a.ts\n-\t-\timage.png\n`
  const [commit] = parseHistoryOutput(output)
  assert.equal(commit.hash, 'abc123456789')
  assert.deepEqual(commit.parents, ['parent1', 'parent2'])
  assert.deepEqual(commit.refs, ['HEAD -> main', 'origin/main'])
  assert.equal(commit.filesChanged, 2)
  assert.equal(commit.additions, 2)
  assert.equal(commit.deletions, 1)
})

test('无提交项目给出明确结果', async () => {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'commit-history-empty-'))
  execFileSync('git', ['init', workspaceDir])
  const result = await getCommitHistory(workspaceDir)
  assert.equal(result.success, false)
  assert.match(result.error || '', /HEAD|revision|commit/i)
})

test('错误目录与异常加载数量不会造成崩溃', async () => {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'commit-history-invalid-'))
  assert.equal((await getCommitHistory(workspaceDir)).success, false)

  execFileSync('git', ['init', workspaceDir])
  execFileSync('git', ['-C', workspaceDir, 'config', 'user.name', '测试用户'])
  execFileSync('git', ['-C', workspaceDir, 'config', 'user.email', 'test@example.com'])
  writeFileSync(join(workspaceDir, 'a.txt'), '内容\n')
  execFileSync('git', ['-C', workspaceDir, 'add', 'a.txt'])
  execFileSync('git', ['-C', workspaceDir, 'commit', '-m', '首次提交'])

  const history = await getCommitHistory(workspaceDir, Number.NaN, Number.POSITIVE_INFINITY)
  assert.equal(history.success, true)
  assert.equal(history.commits?.length, 1)
  assert.equal((await getCommitDetail(workspaceDir, '不存在')).success, false)
  assert.equal((await getCommitDiff(workspaceDir, '不存在')).success, false)
})
