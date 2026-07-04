export type ApprovalScope = 'once' | 'task' | 'always'
export interface ApprovalDecision {
  approved: boolean
  scope: ApprovalScope
}

const pendingApprovals = new Map<string, { resolve: (decision: ApprovalDecision) => void; timer: ReturnType<typeof setTimeout> }>()
const taskApprovalMemory = new Map<string, Set<string>>()
const globalApprovalMemory = new Set<string>()

export function approvalMemoryKey(toolName: string, args: Record<string, unknown>): string {
  if (toolName === 'shell' && typeof args.command === 'string') return `shell:${args.command.trim()}`
  if ((toolName === 'write_file' || toolName === 'read_file') && typeof args.path === 'string') return `${toolName}:${args.path}`
  if (toolName === 'list_files' && typeof args.dir === 'string') return `${toolName}:${args.dir}`
  return `${toolName}:${JSON.stringify(args)}`
}

export function hasRememberedApproval(taskId: string, toolName: string, args: Record<string, unknown>): boolean {
  const key = approvalMemoryKey(toolName, args)
  return Boolean(taskApprovalMemory.get(taskId)?.has(key) || globalApprovalMemory.has(key))
}

export function rememberApproval(taskId: string, toolName: string, args: Record<string, unknown>, scope: ApprovalScope): void {
  if (scope === 'once') return
  const key = approvalMemoryKey(toolName, args)
  if (scope === 'always') {
    globalApprovalMemory.add(key)
    return
  }
  const set = taskApprovalMemory.get(taskId) || new Set<string>()
  set.add(key)
  taskApprovalMemory.set(taskId, set)
}

export function clearTaskApprovalMemory(taskId: string): void {
  taskApprovalMemory.delete(taskId)
}

export function waitForApproval(requestId: string): Promise<ApprovalDecision> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(requestId)
      resolve({ approved: false, scope: 'once' })
    }, 5 * 60 * 1000)
    pendingApprovals.set(requestId, { resolve, timer })
  })
}

export function resolveApproval(requestId: string, approved: boolean, scope: ApprovalScope = 'once'): boolean {
  const pending = pendingApprovals.get(requestId)
  if (!pending) return false
  clearTimeout(pending.timer)
  pendingApprovals.delete(requestId)
  pending.resolve({ approved, scope })
  return true
}
