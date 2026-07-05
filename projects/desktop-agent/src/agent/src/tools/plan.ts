import type { AgentTool } from './index.js'
import type { PlanStepItem } from '../items.js'

let pendingPlanRequestId: string | null = null
export type PlanDecision = 'approve' | 'reject_stop' | 'reject_revise'
export interface PlanResponse {
  decision: PlanDecision
  feedback: string
}

const pendingPlanResponses = new Map<string, { resolve: (response: PlanResponse) => void; timer: ReturnType<typeof setTimeout> }>()

export function getPendingPlanRequestId(): string | null {
  return pendingPlanRequestId
}

export function clearPendingPlanRequestId(): void {
  pendingPlanRequestId = null
}

export function waitForPlanResponse(requestId: string): Promise<PlanResponse> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingPlanResponses.delete(requestId)
      resolve({ decision: 'reject_stop', feedback: '等待确认超时，任务已停止' })
    }, 30 * 60 * 1000)
    pendingPlanResponses.set(requestId, { resolve, timer })
  })
}

export function resolvePlanResponse(requestId: string, decision: PlanDecision, feedback = ''): boolean {
  const pending = pendingPlanResponses.get(requestId)
  if (!pending) return false
  clearTimeout(pending.timer)
  pendingPlanResponses.delete(requestId)
  pending.resolve({ decision, feedback })
  return true
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
    // plan 工具不执行实际操作，结果由 loop 层拦截并构造 plan 条目
    return JSON.stringify({ status: 'pending_review' })
  }
}

export interface ParsedPlan {
  plan: string
  steps: PlanStepItem[]
  requestId: string
}

/** 从工具调用参数中解析出计划内容，不发事件、不等待，由调用方(loop)负责后续 */
export function parsePlanArgs(args: Record<string, unknown>): ParsedPlan {
  const plan = typeof args.plan === 'string' ? args.plan : ''
  const rawSteps = Array.isArray(args.steps) ? args.steps : []
  const steps: PlanStepItem[] = rawSteps.map((s, i) => ({
    step: i + 1,
    title: typeof (s as Record<string, unknown>).title === 'string' ? (s as Record<string, unknown>).title as string : '',
    status: 'pending'
  }))
  pendingPlanRequestId = `plan-${Date.now()}`
  return { plan, steps, requestId: pendingPlanRequestId }
}
