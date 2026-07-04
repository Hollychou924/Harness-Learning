import type { AgentTool } from './index.js'
import type { QuestionOptionItem } from '../items.js'

export const questionTool: AgentTool = {
  name: 'ask_question',
  description: '当任务继续前必须让用户选择或补充信息时，调用此工具显示反问卡片并等待用户回答。不要用普通文字追问关键选择；如果有多个连续问题，可以用 questions 一次给出。',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: '要问用户的问题，一句话说清楚' },
      detail: { type: 'string', description: '为什么需要这个选择，可选' },
      options: {
        type: 'array',
        description: '建议选项，2-5 个最合适',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: '选项名称' },
            description: { type: 'string', description: '选这个的影响，可选' }
          },
          required: ['label']
        }
      },
      questions: {
        type: 'array',
        description: '多个连续问题，用户会按 1 / N 逐个选择',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string', description: '要问用户的问题' },
            detail: { type: 'string', description: '为什么需要这个选择，可选' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string', description: '选项名称' },
                  description: { type: 'string', description: '选这个的影响，可选' }
                },
                required: ['label']
              }
            },
            multiple: { type: 'boolean', description: '是否允许多选，默认 false' },
            allow_custom: { type: 'boolean', description: '是否允许用户自定义输入，默认 true' },
            allow_skip: { type: 'boolean', description: '是否允许跳过，默认 true' }
          },
          required: ['question']
        }
      },
      multiple: { type: 'boolean', description: '是否允许多选，默认 false' },
      allow_custom: { type: 'boolean', description: '是否允许用户自定义输入，默认 true' },
      allow_skip: { type: 'boolean', description: '是否允许跳过，默认 true' }
    },
    required: ['question']
  },
  riskLevel: 'low',
  execute: async () => JSON.stringify({ status: 'pending_answer' })
}

export interface ParsedQuestion {
  question: string
  detail?: string
  options: QuestionOptionItem[]
  multiple: boolean
  allowCustom: boolean
  allowSkip: boolean
  prompts: Array<{
    id: string
    question: string
    detail?: string
    options: QuestionOptionItem[]
    multiple: boolean
    allowCustom: boolean
    allowSkip: boolean
  }>
}

export function parseQuestionArgs(args: Record<string, unknown>): ParsedQuestion {
  const question = typeof args.question === 'string' && args.question.trim() ? args.question.trim() : '需要你补充一个选择'
  const detail = typeof args.detail === 'string' && args.detail.trim() ? args.detail.trim() : undefined
  const rawOptions = Array.isArray(args.options) ? args.options : []
  const options = parseOptions(rawOptions, 'option')

  const parseOne = (source: Record<string, unknown>, promptIndex: number) => {
    const promptQuestion = typeof source.question === 'string' && source.question.trim() ? source.question.trim() : question
    const promptDetail = typeof source.detail === 'string' && source.detail.trim() ? source.detail.trim() : undefined
    const sourceOptions = Array.isArray(source.options) ? source.options : []
    return {
      id: `question-${promptIndex + 1}`,
      question: promptQuestion,
      ...(promptDetail ? { detail: promptDetail } : {}),
      options: parseOptions(sourceOptions, `q${promptIndex + 1}-option`),
      multiple: Boolean(source.multiple),
      allowCustom: source.allow_custom !== false,
      allowSkip: source.allow_skip !== false
    }
  }

  const rawQuestions = Array.isArray(args.questions) ? args.questions : []
  const prompts = rawQuestions.length > 0
    ? rawQuestions
        .map((raw, index) => parseOne(raw as Record<string, unknown>, index))
        .filter((prompt) => prompt.question.trim().length > 0)
        .slice(0, 8)
    : [{
        id: 'question-1',
        question,
        ...(detail ? { detail } : {}),
        options,
        multiple: Boolean(args.multiple),
        allowCustom: args.allow_custom !== false,
        allowSkip: args.allow_skip !== false
      }]

  return {
    question,
    ...(detail ? { detail } : {}),
    options,
    multiple: Boolean(args.multiple),
    allowCustom: args.allow_custom !== false,
    allowSkip: args.allow_skip !== false,
    prompts
  }
}

function parseOptions(rawOptions: unknown[], idPrefix: string): QuestionOptionItem[] {
  return rawOptions
    .map((raw, index) => {
      const option = raw as Record<string, unknown>
      const label = typeof option.label === 'string' ? option.label.trim() : ''
      if (!label) return null
      const description = typeof option.description === 'string' && option.description.trim() ? option.description.trim() : undefined
      return { id: `${idPrefix}-${index + 1}`, label, ...(description ? { description } : {}) }
    })
    .filter((item): item is QuestionOptionItem => Boolean(item))
    .slice(0, 6)
}
