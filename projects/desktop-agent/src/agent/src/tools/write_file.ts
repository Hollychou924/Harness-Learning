import { z } from 'zod'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { homedir } from 'node:os'
import type { AgentTool } from './index.js'

const WriteFileSchema = z.object({
  path: z.string().min(1, 'path 不能为空'),
  content: z.string()
})

function countVisibleChars(value: string): number {
  return Array.from(value.replace(/\s/g, '')).length
}

function diffVisibleChars(before: string, after: string): { addedChars: number; deletedChars: number } {
  const oldText = before.replace(/\s/g, '')
  const newText = after.replace(/\s/g, '')
  let start = 0
  while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) start++
  let oldEnd = oldText.length - 1
  let newEnd = newText.length - 1
  while (oldEnd >= start && newEnd >= start && oldText[oldEnd] === newText[newEnd]) {
    oldEnd--
    newEnd--
  }
  return {
    addedChars: Math.max(0, newEnd - start + 1),
    deletedChars: Math.max(0, oldEnd - start + 1)
  }
}

// write_file：把内容写入文件，medium 风险（改/建文件）
// 工作目录边界：限定在 workspaceDir 或用户主目录下，越界拒绝（依据 docs/05 第六章）
export function writeFileTool(workspaceDir?: string): AgentTool {
  const root = workspaceDir ? resolve(workspaceDir) : join(homedir(), 'Desktop', '小蓝鲸产出')
  return {
    name: 'write_file',
    description:
      '把一段文本内容写入指定文件。path 可以是绝对路径或相对路径（相对工作区根目录）。已存在文件会被覆盖，建议先写入草稿或副本。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径，可相对工作区根目录' },
        content: { type: 'string', description: '要写入的文本内容' }
      },
      required: ['path', 'content']
    },
    riskLevel: 'medium',
    async execute(args) {
      const parsed = WriteFileSchema.safeParse(args)
      if (!parsed.success) {
        return JSON.stringify({ error: parsed.error.issues[0]?.message ?? '入参校验失败' })
      }
      const { path, content } = parsed.data
      const abs = path.startsWith('/') ? resolve(path) : resolve(root, path)
      if (!abs.startsWith(root)) {
        return JSON.stringify({ error: '工作目录越界，已拒绝写入', path, root })
      }
      try {
        let previous = ''
        try {
          previous = await readFile(abs, 'utf8')
        } catch {
          previous = ''
        }
        const diff = previous ? diffVisibleChars(previous, content) : { addedChars: countVisibleChars(content), deletedChars: 0 }
        await mkdir(dirname(abs), { recursive: true })
        await writeFile(abs, content, 'utf8')
        return JSON.stringify({ ok: true, path: abs, ...diff })
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : String(e), path: abs })
      }
    }
  }
}
