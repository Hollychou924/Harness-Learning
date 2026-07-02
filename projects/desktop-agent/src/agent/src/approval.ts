// 审批等待器：agent loop 发出审批条目后阻塞等待主进程回传 approval_response
// 事件发射(item_started/item_completed)由调用方(loop/react.ts)负责，这里只管等待决策本身

const pendingApprovals = new Map<string, { resolve: (approved: boolean) => void; timer: ReturnType<typeof setTimeout> }>()

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000

/** 注册一个等待中的审批，返回 Promise，超时或收到回执后 resolve */
export function waitForApproval(requestId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(requestId)
      resolve(false)
    }, APPROVAL_TIMEOUT_MS)
    pendingApprovals.set(requestId, { resolve, timer })
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
