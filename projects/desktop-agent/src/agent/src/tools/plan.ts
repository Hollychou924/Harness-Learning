import type { AgentTool } from './index.js'

let pendingPlanRequestId: string | null = null

export function getPendingPlanRequestId(): string | null {
  return pendingPlanRequestId
}

export function clearPendingPlanRequestId(): void {
  pendingPlanRequestId = null
}

export const planTool: AgentTool = {
  name: 'propose_plan',
  description: '提交执行计划给用户确认。调用此工具后任务暂停，等待用户批准、拒绝或要求修改。只在复杂任务开始前调用一次。',
  parameters: {
    type: 'object',
    properties: {
      plan: {
        type: 'string',
        description: '计划的自然语言概述，2-3 句话'
      },
      steps: {
        type: 'array',
        description: '计划步骤列表',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '步骤标题，不超过 20 字' }
          },
          required: ['title']
        }
      }
    },
    required: ['plan', 'steps']
  },
  riskLevel: 'low',
  execute: async () => {
    // plan 工具不执行实际操作，结果由 loop 层拦截并发送 plan_proposed 事件
    // 如果 execute 被直接调用（不该发生），返回占位
    return JSON.stringify({ status: 'pending_review' })
  }
}

export function makePlanExecuteHandler(onPlanProposed: (plan: string, steps: Array<{ step: number; title: string; status: 'pending' | 'in_progress' | 'completed' | 'removed' }>) => void) {
  return (args: Record<string, unknown>): string => {
    const plan = typeof args.plan === 'string' ? args.plan : ''
    const rawSteps = Array.isArray(args.steps) ? args.steps : []
    const steps = rawSteps.map((s, i) => ({
      step: i + 1,
      title: typeof (s as Record<string, unknown>).title === 'string' ? (s as Record<string, unknown>).title as string : '',
      status: 'pending' as const
    }))
    pendingPlanRequestId = `plan-${Date.now()}`
    onPlanProposed(plan, steps)
    return JSON.stringify({ status: 'submitted', request_id: pendingPlanRequestId })
  }
}
