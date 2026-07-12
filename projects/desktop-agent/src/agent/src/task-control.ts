/**
 * 任务级协作取消：abort flag + 清空 HITL 等待
 */
import { rejectAllPendingApprovals } from './approval.js'
import { skipAllPendingQuestions, stopAllPendingContinuations } from './question.js'
import { rejectAllPendingPlans } from './tools/plan.js'

let aborted = false

export function resetTaskControl(): void {
  aborted = false
}

export function isTaskAborted(): boolean {
  return aborted
}

/** 协作式取消：拒绝所有挂起 HITL，并置 abort */
export function requestTaskCancel(): { resolved: number } {
  aborted = true
  const resolved =
    rejectAllPendingApprovals() +
    skipAllPendingQuestions() +
    rejectAllPendingPlans('用户取消任务') +
    stopAllPendingContinuations()
  return { resolved }
}
