export interface QuestionResponse {
  selectedOptionIds: string[]
  customAnswer: string
  skipped: boolean
}

const pendingQuestions = new Map<string, { resolve: (response: QuestionResponse) => void; timer: ReturnType<typeof setTimeout> }>()

export function waitForQuestion(requestId: string): Promise<QuestionResponse> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingQuestions.delete(requestId)
      resolve({ selectedOptionIds: [], customAnswer: '', skipped: true })
    }, 30 * 60 * 1000)
    pendingQuestions.set(requestId, { resolve, timer })
  })
}

export function resolveQuestion(requestId: string, response: Partial<QuestionResponse>): boolean {
  const pending = pendingQuestions.get(requestId)
  if (!pending) return false
  clearTimeout(pending.timer)
  pendingQuestions.delete(requestId)
  pending.resolve({
    selectedOptionIds: response.selectedOptionIds || [],
    customAnswer: response.customAnswer || '',
    skipped: Boolean(response.skipped)
  })
  return true
}
export type ContinuationDecision = 'continue' | 'stop' | 'split'

const pendingContinuations = new Map<string, { resolve: (decision: ContinuationDecision) => void; timer: ReturnType<typeof setTimeout> }>()

export function waitForContinuation(taskId: string): Promise<ContinuationDecision> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingContinuations.delete(taskId)
      resolve('stop')
    }, 30 * 60 * 1000)
    pendingContinuations.set(taskId, { resolve, timer })
  })
}

export function resolveContinuation(taskId: string, decision: ContinuationDecision): boolean {
  const pending = pendingContinuations.get(taskId)
  if (!pending) return false
  clearTimeout(pending.timer)
  pendingContinuations.delete(taskId)
  pending.resolve(decision)
  return true
}

export function stopAllPendingContinuations(): number {
  let n = 0
  for (const [id, pending] of [...pendingContinuations.entries()]) {
    clearTimeout(pending.timer)
    pendingContinuations.delete(id)
    pending.resolve('stop')
    n += 1
  }
  return n
}

export function skipAllPendingQuestions(): number {
  let n = 0
  for (const [id, pending] of [...pendingQuestions.entries()]) {
    clearTimeout(pending.timer)
    pendingQuestions.delete(id)
    pending.resolve({ selectedOptionIds: [], customAnswer: '', skipped: true })
    n += 1
  }
  return n
}
