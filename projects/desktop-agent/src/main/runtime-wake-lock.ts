export interface PowerSaveBlockerLike {
  start: (type: 'prevent-app-suspension') => number
  stop: (id: number) => void
  isStarted: (id: number) => boolean
}

export class RuntimeWakeLock {
  private enabled = true
  private blockerId: number | null = null
  private runningTaskIds = new Set<string>()

  constructor(private readonly blocker: PowerSaveBlockerLike) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.sync()
  }

  taskStarted(taskId: string): void {
    this.runningTaskIds.add(taskId)
    this.sync()
  }

  taskFinished(taskId: string): void {
    this.runningTaskIds.delete(taskId)
    this.sync()
  }

  releaseAll(): void {
    this.runningTaskIds.clear()
    this.stopBlocker()
  }

  private sync(): void {
    if (this.enabled && this.runningTaskIds.size > 0) {
      if (this.blockerId === null || !this.blocker.isStarted(this.blockerId)) {
        this.blockerId = this.blocker.start('prevent-app-suspension')
      }
      return
    }
    this.stopBlocker()
  }

  private stopBlocker(): void {
    if (this.blockerId === null) return
    if (this.blocker.isStarted(this.blockerId)) this.blocker.stop(this.blockerId)
    this.blockerId = null
  }
}
