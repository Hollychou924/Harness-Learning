import type { StdoutMessage } from './protocol.js'
import { send } from './protocol.js'

// 审批等待器：agent loop 发出 approval_request 后阻塞等待主进程回传 approval_response
const pendingApprovals = new Map<string, { resolve: (approved: boolean) => void; timer: ReturnType<typeof setTimeout> }>()

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000

export function requestApproval(params: {
  requestId: string
  toolName: string
  args: Record<string, unknown>
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  impact: string
  canRollback: boolean
}): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(params.requestId)
      resolve(false)
    }, APPROVAL_TIMEOUT_MS)

    pendingApprovals.set(params.requestId, { resolve, timer })

    const msg: StdoutMessage = {
      type: 'approval_request',
      request_id: params.requestId,
      tool_name: params.toolName,
      args: params.args,
      risk_level: params.riskLevel,
      impact: params.impact,
      can_rollback: params.canRollback
    }
    send(msg)
  })
}

export function resolveApproval(requestId: string, approved: boolean): boolean {
  const pending = pendingApprovals.get(requestId)
  if (!pending) return false
  clearTimeout(pending.timer)
  pendingApprovals.delete(requestId)
  pending.resolve(approved)
  return true
}
