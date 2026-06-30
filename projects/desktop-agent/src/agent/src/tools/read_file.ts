import { z } from 'zod'
import { readFile, stat } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'
import { homedir } from 'node:os'
import type { AgentTool } from './index.js'

const ReadFileSchema = z.object({
  path: z.string().min(1, 'path 不能为空')
})

// read_file：读取文件内容，只读，low 风险
export function readFileTool(workspaceDir?: string): AgentTool {
  const root = workspaceDir ? resolve(workspaceDir) : join(homedir(), 'Desktop')
  return {
    name: 'read_file',
    description: '读取指定文件的文本内容。path 可相对工作区根目录。单文件最多返回前 12000 字。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要读取的文件路径，可相对工作区根目录' }
      },
      required: ['path']
    },
    riskLevel: 'low',
    async execute(args) {
      const parsed = ReadFileSchema.safeParse(args)
      if (!parsed.success) {
        return JSON.stringify({ error: parsed.error.issues[0]?.message ?? '入参校验失败' })
      }
      const { path } = parsed.data
      const abs = path.startsWith('/') ? resolve(path) : resolve(root, path)
      if (!abs.startsWith(root) && !abs.startsWith(homedir())) {
        return JSON.stringify({ error: '工作目录越界，已拒绝', path, root })
      }
      try {
        const s = await stat(abs)
        if (!s.isFile()) {
          return JSON.stringify({ error: '目标不是文件', path: abs })
        }
        const raw = await readFile(abs, 'utf8')
        const content = raw.length > 12000 ? raw.slice(0, 12000) + '\n<!-- truncated -->' : raw
        return JSON.stringify({ path: abs, size: s.size, content })
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : String(e), path: abs })
      }
    }
  }
}
