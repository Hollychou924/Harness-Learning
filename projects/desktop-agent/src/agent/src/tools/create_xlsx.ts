import { z } from 'zod'
import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { homedir } from 'node:os'
import type { AgentTool } from './index.js'

// create_xlsx：生成 Excel 表格（.xlsx）
// 模型根据用户需求自行判断：用户指名要 Excel，或数据适合表格呈现时使用
const XlsxSchema = z.object({
  path: z.string().min(1, 'path 不能为空'),
  sheets: z.array(z.object({
    name: z.string().optional().describe('工作表名称，默认 Sheet1'),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).min(1).describe('表格数据，第一行为表头')
  })).min(1, '至少需要一个工作表')
})

export function createXlsxTool(workspaceDir?: string): AgentTool {
  const root = workspaceDir ? resolve(workspaceDir) : resolve(homedir(), 'Documents', '小蓝鲸产出')
  return {
    name: 'create_xlsx',
    description: '生成一份 Excel 表格文件（.xlsx），支持多工作表。当用户明确要求生成 Excel 表格，或数据适合表格呈现时使用。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径，可相对工作区根目录，需以 .xlsx 结尾' },
        sheets: {
          type: 'array',
          description: '工作表列表',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: '工作表名称' },
              rows: {
                type: 'array',
                description: '表格数据，第一行为表头',
                items: {
                  type: 'array',
                  items: { type: ['string', 'number', 'boolean', 'null'] }
                }
              }
            },
            required: ['rows']
          }
        }
      },
      required: ['path', 'sheets']
    },
    riskLevel: 'medium',
    async execute(args) {
      const parsed = XlsxSchema.safeParse(args)
      if (!parsed.success) {
        return JSON.stringify({ error: parsed.error.issues[0]?.message ?? '入参校验失败' })
      }
      const { path, sheets } = parsed.data
      const abs = path.startsWith('/') ? resolve(path) : resolve(root, path)
      if (!abs.endsWith('.xlsx')) {
        return JSON.stringify({ error: '文件路径必须以 .xlsx 结尾' })
      }
      if (!abs.startsWith(root)) {
        return JSON.stringify({ error: '工作目录越界，已拒绝写入', path, root })
      }
      try {
        const ExcelJS = await import('exceljs')
        await mkdir(dirname(abs), { recursive: true })

        const wb = new ExcelJS.Workbook()
        for (const sheetData of sheets) {
          const ws = wb.addWorksheet(sheetData.name || `Sheet${wb.worksheets.length + 1}`)
          for (let r = 0; r < sheetData.rows.length; r++) {
            const row = ws.addRow(sheetData.rows[r])
            if (r === 0) {
              row.eachCell((cell) => {
                cell.font = { bold: true }
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFE8EDF3' }
                }
              })
            }
          }
          ws.columns.forEach((column) => {
            let maxLen = 10
            if (column.eachCell) {
              column.eachCell({ includeEmpty: true }, (cell) => {
                const len = cell.value != null ? String(cell.value).length : 0
                if (len > maxLen) maxLen = len
              })
            }
            column.width = Math.min(maxLen + 4, 50)
          })
        }

        const buffer = await wb.xlsx.writeBuffer()
        const { writeFile } = await import('node:fs/promises')
        await writeFile(abs, Buffer.from(buffer))
        return JSON.stringify({ ok: true, path: abs, type: 'xlsx' })
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : String(e), path: abs })
      }
    }
  }
}
