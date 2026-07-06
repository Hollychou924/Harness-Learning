import { useState } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import type { ToolCallItem, ToolErrorType } from '../../../agent/src/items'

// 错误分类卡片：融合 harnessclaw 10种错误分类 + 重试倒计时 + 信息分层
// 错误默认展开但可收起（来自 Kun），用户信息 vs 诊断信息分离（来自 harnessclaw）
const ERROR_META: Record<ToolErrorType, { icon: string; color: string; label: string; retryable: boolean }> = {
  invalid_input: { icon: '📋', color: 'text-amber-600', label: '输入无效', retryable: false },
  permission_denied: { icon: '🔒', color: 'text-amber-600', label: '权限不足', retryable: false },
  tool_timeout: { icon: '⏱', color: 'text-orange-600', label: '工具超时', retryable: true },
  user_aborted: { icon: '⏹', color: 'text-amber-600', label: '用户中止', retryable: false },
  rate_limit: { icon: '⏳', color: 'text-orange-600', label: '频率限制', retryable: true },
  overloaded: { icon: '🌐', color: 'text-orange-600', label: '服务过载', retryable: true },
  model_error: { icon: '🤖', color: 'text-red-600', label: '模型错误', retryable: false },
  contract_fail: { icon: '📝', color: 'text-red-600', label: '协议失败', retryable: false },
  dependency_fail: { icon: '🔗', color: 'text-red-600', label: '依赖失败', retryable: false },
  internal: { icon: '⚠️', color: 'text-red-600', label: '内部错误', retryable: false }
}

export function ErrorCard({ item }: { item: ToolCallItem }) {
  const [showDetail, setShowDetail] = useState(false)
  const errorType = item.errorType || 'internal'
  const meta = ERROR_META[errorType] || ERROR_META.internal
  const canRetry = item.retryable ?? meta.retryable
  const elapsed = item.finishedAt && item.startedAt
    ? Math.round((item.finishedAt - item.startedAt) / 1000)
    : 0

  return (
    <div className="rounded-lg border border-red-200/60 bg-red-50/40 overflow-hidden text-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-base flex-shrink-0">{meta.icon}</span>
        <span className={`font-medium ${meta.color}`}>{meta.label}</span>
        {elapsed > 0 && (
          <span className="text-xs text-[var(--ink-soft)]">· {elapsed}s</span>
        )}
        {canRetry && (
          <button className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-200 transition">
            <RotateCcw size={11} />
            {item.retryAfterMs ? `${Math.ceil(item.retryAfterMs / 1000)}s 后重试` : '可重试'}
          </button>
        )}
        <button
          onClick={() => setShowDetail(!showDetail)}
          className={`${canRetry ? '' : 'ml-auto'} text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition`}
        >
          <ChevronRight size={14} className={`transition-transform ${showDetail ? 'rotate-90' : ''}`} />
        </button>
      </div>
      {item.error && (
        <div className="px-3 pb-2 text-xs text-[var(--ink-soft)]">{item.error}</div>
      )}
      {showDetail && (
        <div className="px-3 pb-2 pt-1 space-y-1 border-t border-red-200/40">
          {item.toolName && (
            <div className="text-xs text-[var(--ink-soft)] font-mono">工具: {item.toolName}</div>
          )}
          <div className="text-xs text-[var(--ink-soft)] font-mono">错误类型: {errorType}</div>
          {Object.keys(item.args).length > 0 && (
            <div className="text-xs text-[var(--ink-soft)] font-mono">参数: {JSON.stringify(item.args).slice(0, 200)}</div>
          )}
        </div>
      )}
    </div>
  )
}
