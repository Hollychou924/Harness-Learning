import type { AgentTool } from './index.js'

let currentTodos: Array<{ id: string; content: string; status: 'pending' | 'in_progress' | 'completed' }> = []

export const todoTool: AgentTool = {
  name: 'update_todo',
  description: '更新任务清单。用于展示当前任务的进度和待办项。每次步骤完成或计划调整时调用。',
  parameters: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: '完整的任务清单（全量替换，非增量）',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '待办项内容' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: '状态' }
          },
          required: ['content', 'status']
        }
      }
    },
    required: ['todos']
  },
  riskLevel: 'low',
  execute: async (args) => {
    const rawTodos = Array.isArray(args.todos) ? args.todos : []
    currentTodos = rawTodos.map((t, i) => {
      const item = t as Record<string, unknown>
      return {
        id: `todo-${i + 1}`,
        content: typeof item.content === 'string' ? item.content : '',
        status: (['pending', 'in_progress', 'completed'].includes(item.status as string) ? item.status : 'pending') as 'pending' | 'in_progress' | 'completed'
      }
    })
    return JSON.stringify({ status: 'ok', count: currentTodos.length })
  }
}

export function getCurrentTodos() {
  return currentTodos
}

export function makeTodoExecuteHandler(onTodoUpdate: (todos: Array<{ id: string; content: string; status: 'pending' | 'in_progress' | 'completed' }>) => void) {
  return (args: Record<string, unknown>): string => {
    const rawTodos = Array.isArray(args.todos) ? args.todos : []
    const todos = rawTodos.map((t, i) => {
      const item = t as Record<string, unknown>
      return {
        id: `todo-${i + 1}`,
        content: typeof item.content === 'string' ? item.content : '',
        status: (['pending', 'in_progress', 'completed'].includes(item.status as string) ? item.status : 'pending') as 'pending' | 'in_progress' | 'completed'
      }
    })
    currentTodos = todos
    onTodoUpdate(todos)
    return JSON.stringify({ status: 'ok', count: todos.length })
  }
}
