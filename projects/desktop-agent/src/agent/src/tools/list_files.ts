import { z } from 'zod'
import { readdir, stat } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'
import { homedir } from 'node:os'
import type { AgentTool } from './index.js'

const ListFilesSchema = z.object({
  dir: z.string().optional().default('.')
})

// list_files：列出目录下文件，只读，low 风险
export function listFilesTool(workspaceDir?: string): AgentTool {
  const root = workspaceDir ? resolve(workspaceDir) : join(homedir(), 'Desktop')
  return {
    name: 'list_files',
    description: '列出指定目录下的文件和子目录（仅一层）。dir 可相对工作区根目录，默认根目录。',
    parameters: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: '要列出的目录，可相对工作区根目录，默认根目录' }
      }
    },
    riskLevel: 'low',
    async execute(args) {
      const parsed = ListFilesSchema.safeParse(args)
      if (!parsed.success) {
        return JSON.stringify({ error: parsed.error.issues[0]?.message ?? '入参校验失败' })
      }
      const dir = parsed.data.dir
      const abs = dir.startsWith('/') ? resolve(dir) : resolve(root, dir)
      if (!abs.startsWith(root) && !abs.startsWith(homedir())) {
        return JSON.stringify({ error: '工作目录越界，已拒绝', dir, root })
      }
      try {
        const entries = await readdir(abs, { withFileTypes: true })
        const items = await Promise.all(
          entries.map(async (e) => {
            try {
              const s = await stat(join(abs, e.name))
              return {
                name: e.name,
                type: e.isDirectory() ? 'dir' : 'file',
                size: s.size,
                path: relative(root, join(abs, e.name))
              }
            } catch {
              return { name: e.name, type: e.isDirectory() ? 'dir' : 'file', path: e.name }
            }
          })
        )
        return JSON.stringify({ dir: abs, items })
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : String(e), dir: abs })
      }
    }
  }
}
