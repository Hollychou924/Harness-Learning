import { z } from 'zod'
import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { homedir } from 'node:os'
import type { AgentTool } from './index.js'

// create_docx：生成排版好的 Word 文档（.docx）
// 模型根据用户需求自行判断是否调用：用户指名要 Word，或内容适合文档形式时使用
const DocxSchema = z.object({
  path: z.string().min(1, 'path 不能为空'),
  title: z.string().optional(),
  sections: z.array(z.object({
    heading: z.string().optional(),
    level: z.number().min(1).max(6).optional().describe('标题层级，1=大标题，2=二级标题，默认 1'),
    paragraphs: z.array(z.string()).describe('该标题下的正文段落')
  })).min(1, '至少需要一个章节'),
  tables: z.array(z.object({
    rows: z.array(z.array(z.string())).min(1).describe('表格数据，第一行为表头')
  })).optional().describe('可选的表格列表')
})

function countVisibleChars(value: string): number {
  return Array.from(value.replace(/\s/g, '')).length
}

export function createDocxTool(workspaceDir?: string): AgentTool {
  const root = workspaceDir ? resolve(workspaceDir) : resolve(homedir(), 'Documents', '小蓝鲸产出')
  return {
    name: 'create_docx',
    description: '生成一份排版好的 Word 文档（.docx 文件），包含标题、多级章节、段落和表格。当用户明确要求生成 Word 文档，或内容适合正式文档形式时使用。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径，可相对工作区根目录，需以 .docx 结尾' },
        title: { type: 'string', description: '文档主标题（可选）' },
        sections: {
          type: 'array',
          description: '文档章节列表',
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string', description: '章节标题' },
              level: { type: 'number', description: '标题层级 1-6，默认 1' },
              paragraphs: { type: 'array', items: { type: 'string' }, description: '该章节下的正文段落' }
            },
            required: ['paragraphs']
          }
        },
        tables: {
          type: 'array',
          description: '可选的表格列表',
          items: {
            type: 'object',
            properties: {
              rows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: '表格数据，第一行为表头' }
            },
            required: ['rows']
          }
        }
      },
      required: ['path', 'sections']
    },
    riskLevel: 'medium',
    async execute(args) {
      const parsed = DocxSchema.safeParse(args)
      if (!parsed.success) {
        return JSON.stringify({ error: parsed.error.issues[0]?.message ?? '入参校验失败' })
      }
      const { path, title, sections, tables } = parsed.data
      const textParts = [
        title || '',
        ...sections.flatMap((section) => [section.heading || '', ...section.paragraphs]),
        ...(tables || []).flatMap((table) => table.rows.flatMap((row) => row))
      ]
      const addedChars = countVisibleChars(textParts.join(''))
      const abs = path.startsWith('/') ? resolve(path) : resolve(root, path)
      if (!abs.endsWith('.docx')) {
        return JSON.stringify({ error: '文件路径必须以 .docx 结尾' })
      }
      if (!abs.startsWith(root)) {
        return JSON.stringify({ error: '工作目录越界，已拒绝写入', path, root })
      }
      try {
        const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, TextRun } = await import('docx')
        await mkdir(dirname(abs), { recursive: true })

        const children: unknown[] = []

        if (title) {
          children.push(new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
            spacing: { after: 300 }
          }))
        }

        for (const section of sections) {
          if (section.heading) {
            const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
              1: HeadingLevel.HEADING_1,
              2: HeadingLevel.HEADING_2,
              3: HeadingLevel.HEADING_3,
              4: HeadingLevel.HEADING_4,
              5: HeadingLevel.HEADING_5,
              6: HeadingLevel.HEADING_6
            }
            children.push(new Paragraph({
              text: section.heading,
              heading: headingMap[section.level || 1],
              spacing: { before: 240, after: 120 }
            }))
          }
          for (const para of section.paragraphs) {
            children.push(new Paragraph({
              children: [new TextRun(para)],
              spacing: { after: 120 }
            }))
          }
        }

        if (tables) {
          for (const table of tables) {
            const rows = table.rows.map((rowCells, rowIdx) => {
              return new TableRow({
                children: rowCells.map((cellText) => {
                  return new TableCell({
                    children: [new Paragraph({
                      children: [new TextRun({ text: cellText, bold: rowIdx === 0 })]
                    })],
                    width: { size: Math.floor(100 / rowCells.length), type: WidthType.PERCENTAGE }
                  })
                }),
                tableHeader: rowIdx === 0
              })
            })
            children.push(new Paragraph({ spacing: { before: 120 } }))
            children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }))
          }
        }

        const doc = new Document({
          sections: [{ properties: {}, children: children as any }]
        })

        const buffer = await Packer.toBuffer(doc)
        const { writeFile } = await import('node:fs/promises')
        await writeFile(abs, buffer)
        return JSON.stringify({ ok: true, path: abs, type: 'docx', addedChars, deletedChars: 0 })
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : String(e), path: abs })
      }
    }
  }
}
