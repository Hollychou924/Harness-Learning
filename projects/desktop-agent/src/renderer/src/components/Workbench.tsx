import { useEffect, useState } from 'react'
import { useTaskStore } from '../store/task'
import { api } from '../api'
import { Composer } from './Composer'
import { ResultView } from './ResultView'
import { ProcessFlow } from './ProcessFlow'
import { ModelSelector } from './ModelSelector'

export function Workbench() {
  const { status, mode, goal, message, summary } = useTaskStore()
  const greeting = greetingText()
  const taskTitle = status !== 'idle' ? goal || message : ''

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* 顶部栏：工作区名 + 任务标题 + 模型，可拖拽 */}
      <div className="drag h-14 flex items-center justify-between px-6 border-b border-black/[0.06] gap-4">
        <div className="no-drag flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium flex-shrink-0">
            {mode === 'work' ? 'Work 工作台' : 'Code 工作台'}
          </span>
          {taskTitle && (
            <>
              <span className="text-black/10">/</span>
              <span
                className="text-sm text-[var(--ink-soft)] truncate"
                title={taskTitle}
              >
                {taskTitle}
              </span>
            </>
          )}
        </div>
        <ModelSelector />
      </div>

      {/* 主区域 */}
      <div className="flex-1 overflow-y-auto">
        {status === 'idle' ? (
          <HomeView greeting={greeting} />
        ) : (
          <RunningView summary={summary} status={status} />
        )}
      </div>

      {/* 底部输入区 */}
      <Composer />
    </div>
  )
}

function greetingText(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了，还在忙呀'
  if (h < 12) return '早上好呀，今天加油'
  if (h < 18) return '下午好呀，喝杯水再继续'
  return '晚上好呀，今天辛苦啦'
}


function HomeView({ greeting }: { greeting: string }) {
  const { message, setMessage, startTask, mode } = useTaskStore()
  const [hasKey, setHasKey] = useState(false)
  useEffect(() => {
    api.configGet('hasApiKey').then((v) => setHasKey(Boolean(v)))
  }, [])
  const quickActions = [
    { label: '网页读取', desc: '抓取网页内容' },
    { label: '调研分析', desc: '多源整理成报告' },
    { label: '数据挖掘', desc: '表格分析出结论' },
    { label: '文件管理', desc: '整理本地文件' }
  ]
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-10">
      <div className="text-center mb-8 select-none">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 mx-auto mb-4 shadow-lg shadow-sky-200" />
        <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
        <p className="text-sm text-[var(--ink-soft)] mt-1.5">你的桌面生产力 Agent</p>
      </div>

      {/* 大输入框 */}
      <div className="w-full max-w-2xl glass rounded-2xl p-1.5 flex items-end gap-2 shadow-lg">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void startTask()
            }
          }}
          placeholder="描述你要做的事，比如：把这3个网页整理成带来源的报告 https://... https://... https://..."
          className="flex-1 bg-transparent resize-none outline-none px-3 py-2.5 text-sm leading-relaxed max-h-40 min-h-[44px]"
          rows={2}
        />
        <button
          onClick={() => void startTask()}
          disabled={!message.trim() || !hasKey}
          className="h-9 px-4 mb-1 mr-1 rounded-xl bg-[#0071e3] text-white text-sm font-medium disabled:opacity-40 hover:brightness-110 transition flex items-center gap-1.5"
        >
          发送
        </button>
      </div>

      {!hasKey && (
        <p className="text-xs text-amber-500 mt-3">未配置模型，请点击右上角选择供应商并填写 API Key</p>
      )}

      {/* 快捷能力 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 w-full max-w-2xl mt-6">
        {quickActions.map((q) => (
          <button
            key={q.label}
            onClick={() => setMessage(`${q.label}：`)}
            className="glass-soft rounded-xl px-3 py-3 text-left hover:brightness-105 transition"
          >
            <div className="text-sm font-medium">{q.label}</div>
            <div className="text-xs text-[var(--ink-soft)] mt-0.5">{q.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function RunningView({ summary, status }: { summary: string; status: string }) {
  const { chunks, cancelTask } = useTaskStore()
  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
      {status === 'executing' && (
        <div className="flex justify-end">
          <button
            onClick={() => cancelTask()}
            className="h-8 px-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 hover:bg-red-100 transition"
          >
            停止任务
          </button>
        </div>
      )}
      <ProcessFlow />
      {status === 'completed' && summary && (
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-[var(--ink-soft)] mb-1.5 flex items-center gap-1.5">
            <span>✅ 任务总结</span>
          </div>
          <p className="text-sm leading-relaxed text-[var(--ink)]">{summary}</p>
        </div>
      )}
      {(chunks || status === 'completed') && (
        <ResultView content={chunks} />
      )}
    </div>
  )
}
