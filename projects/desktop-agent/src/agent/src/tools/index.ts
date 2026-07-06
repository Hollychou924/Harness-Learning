import { z } from 'zod'
import { fetchPageTool } from './fetch_page.js'
import { parsePageTool } from './parse_page.js'
import { writeFileTool } from './write_file.js'
import { planTool } from './plan.js'
import { todoTool } from './todo.js'
import { listFilesTool } from './list_files.js'
import { readFileTool } from './read_file.js'
import { createDocxTool } from './create_docx.js'
import { createXlsxTool } from './create_xlsx.js'
import { shellTool } from './shell.js'
import { questionTool } from './question.js'

export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  execute: (args: Record<string, unknown>) => Promise<string>
}

// SAFE 白名单：只读操作免审批（依据 docs/05 第四章）
export const SAFE_TOOLS = new Set<string>([
  'fetch_page',
  'parse_page',
  'list_files',
  'read_file',
  'ask_question'
])

// BLOCKED 黑名单：Shell 危险命令正则（依据 docs/05 第二章），一期 Work 不启用 shell 工具
export const BLOCKED_PATTERNS: RegExp[] = [
  /\brm\s+(-rf?\|--recursive)\s+[/~]/,
  /\bmkfs\b/,
  /\bdd\s+.*of=\/dev\//,
  /:\(\)\s*\{\s*:\|:&\s*\}\s*;:/,
  /\bchmod\s+(-R\s+)?777\s+\//,
  /\bshutdown\b/,
  /\breboot\b/,
  />\s*\/dev\/sd/,
  /\bcurl\b.*\|\s*(ba)?sh/,
  /\bwget\b.*\|\s*(ba)?sh/,
  /\bsudo\s+rm\s+/,
  /\bpython[23]?\s+-c\s+.*import\s+os.*system/
]

export function isBlocked(command: string): boolean {
  return BLOCKED_PATTERNS.some((re) => re.test(command))
}

export function isSafe(toolName: string): boolean {
  return SAFE_TOOLS.has(toolName)
}

export async function getAvailableTools(workspaceDir?: string): Promise<AgentTool[]> {
  return [
    fetchPageTool,
    parsePageTool,
    listFilesTool(workspaceDir),
    readFileTool(workspaceDir),
    writeFileTool(workspaceDir),
    createDocxTool(workspaceDir),
    createXlsxTool(workspaceDir),
    shellTool(),
    questionTool,
    planTool,
    todoTool
  ]
}

export { fetchPageTool, parsePageTool, writeFileTool, listFilesTool, readFileTool, createDocxTool, createXlsxTool, shellTool, questionTool }

// 导出给 provider 用的 JSON Schema 形式
export function toolToFunctionSchema(tool: AgentTool) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters
  }
}
