import { useEffect, useState } from 'react'
import { RefreshCw, StopCircle, WifiOff } from 'lucide-react'
import { useTaskStore } from '../store/task'

const MAX_RETRIES = 5

export function ConnectionRecoveryBanner() {
  const { status, cancelTask } = useTaskStore()
  const [online, setOnline] = useState(() => navigator.onLine)
  const [hidden, setHidden] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const handleOnline = () => { setOnline(true); setAttempt(0); setHidden(false) }
    const handleOffline = () => { setOnline(false); setHidden(false); setAttempt(1) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (online || status !== 'executing' || hidden || attempt >= MAX_RETRIES) return
    const timer = window.setTimeout(() => setAttempt((v) => Math.min(MAX_RETRIES, v + 1)), 2500)
    return () => window.clearTimeout(timer)
  }, [attempt, hidden, online, status])

  if (status !== 'executing' || online || hidden) return null

  const failed = attempt >= MAX_RETRIES
  return (
    <div className="glass rounded-xl p-3 border border-amber-200 space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <WifiOff size={15} className="text-amber-600 flex-shrink-0" />
        <span className="text-[var(--ink)]">
          {failed ? '连接暂时没有恢复' : `正在重连 ${Math.max(1, attempt)}/${MAX_RETRIES}`}
        </span>
      </div>
      <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
        当前输入和已完成结果会保留。恢复后会继续当前任务；如果一直失败，你可以重试、停止，或先保留当前结果。
      </p>
      {failed && (
        <div className="flex items-center gap-2">
          <button onClick={() => { setAttempt(1); setHidden(false) }} className="h-8 px-3 rounded-lg bg-[#0071e3] text-white text-xs font-medium inline-flex items-center gap-1.5">
            <RefreshCw size={13} /> 重试
          </button>
          <button onClick={() => void cancelTask()} className="h-8 px-3 rounded-lg glass text-red-600 text-xs font-medium inline-flex items-center gap-1.5">
            <StopCircle size={13} /> 停止
          </button>
          <button onClick={() => setHidden(true)} className="h-8 px-3 rounded-lg glass text-[var(--ink-soft)] text-xs font-medium">
            保留当前结果
          </button>
        </div>
      )}
    </div>
  )
}
