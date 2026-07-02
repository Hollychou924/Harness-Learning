import { useEffect, useRef } from 'react'
import { useTaskStore } from '../store/task'
import { Composer } from './Composer'
import { ResultView } from './ResultView'
import { ProcessFlow } from './ProcessFlow'
import { ChatInput } from './ChatInput'

export function Workbench() {
  const { status, mode, goal, message, summary, messages } = useTaskStore()
  const greeting = greetingText()
  const taskTitle = status !== 'idle' ? goal || message : ''

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* 顶部栏 */}
      <div className="drag h-14 flex items-center justify-between px-6 border-b border-black/[0.06] gap-4">
        <div className="no-drag flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium flex-shrink-0">
            {mode === 'work' ? 'Work 工作台' : 'Code 工作台'}
          </span>
          {taskTitle && (
            <>
              <span className="text-black/10">/</span>
              <span className="text-sm text-[var(--ink-soft)] truncate" title={taskTitle}>
                {taskTitle}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 主区域 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length > 0 ? (
          <ConversationView status={status} />
        ) : status === 'idle' ? (
          <HomeView greeting={greeting} />
        ) : (
          <RunningView summary={summary} status={status} />
        )}
      </div>

      {/* 底部输入区：仅非 idle 时常驻 */}
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
  const { message, setMessage, startTask } = useTaskStore()
  const quickActions = [
    { label: '网页读取', desc: '抓取网页内容' },
    { label: '调研分析', desc: '多源整理成报告' },
    { label: '数据挖掘', desc: '表格分析出结论' },
    { label: '文件管理', desc: '整理本地文件' }
  ]
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-10">
      {/* 欢迎语 */}
      <div className="text-center mb-8 select-none">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 mx-auto mb-4 shadow-lg shadow-sky-200" />
        <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
        <p className="text-sm text-[var(--ink-soft)] mt-1.5">你的桌面生产力 Agent</p>
      </div>

      {/* 中间输入框 */}
      <div className="w-full max-w-3xl">
        <ChatInput
          value={message}
          onChange={setMessage}
          onSend={() => void startTask()}
        />
      </div>

      {/* 快捷能力 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 w-full max-w-3xl mt-6">
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
  const { goal, message, chunks, cancelTask } = useTaskStore()
  const userQuery = goal || message
  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
      {/* 用户消息：右侧气泡 */}
      {userQuery && (
        <div className="flex justify-end">
          <div className="glass rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[80%]">
            <p className="text-sm leading-relaxed text-[var(--ink)] whitespace-pre-wrap">{userQuery}</p>
          </div>
        </div>
      )}

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

      {/* 执行过程 + 回复：左侧 */}
      <ProcessFlow />
      {(chunks || status === 'completed') && (
        <ResultView content={chunks} />
      )}
    </div>
  )
}

/* ============================================================
 * 对话视图：历史消息（气泡）+ 本轮实时执行
 * 点击历史对话后，从这里"像没离开过一样"继续聊
 * ============================================================ */
function ConversationView({ status }: { status: string }) {
  const { messages, chunks, goal, message } = useTaskStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, chunks, status])

  // 恢复历史对话(idle)：全量展示，不排除任何消息
  // 本轮执行中(executing/completed)：排除最后一条 user(本轮刚发的)，单独展示 + 实时回复
  const isLiveTurn = status === 'executing' || status === 'completed'
  const lastMsg = messages[messages.length - 1]
  const isLastUser = lastMsg?.role === 'user'
  // 只有"本轮刚发了 user 且还没收到 assistant 回复"时才排除最后一条
  const excludeLast = isLiveTurn && isLastUser
  const historyMsgs = excludeLast ? messages.slice(0, -1) : messages

  return (
    <div ref={scrollRef} className="max-w-3xl mx-auto px-6 py-6 space-y-4 overflow-y-auto h-full">
      {historyMsgs.map((m, i) => (
        <MessageBubble key={i} msg={m} />
      ))}
      {/* 本轮用户消息(仅执行中单独展示，避免与输入区重复) */}
      {excludeLast && (
        <div className="flex justify-end">
          <div className="glass rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[80%]">
            <p className="text-sm leading-relaxed text-[var(--ink)] whitespace-pre-wrap">{lastMsg.content}</p>
          </div>
        </div>
      )}
      {/* 本轮执行过程 + 实时回复 */}
      {isLiveTurn && <ProcessFlow />}
      {isLiveTurn && chunks && <ResultView content={chunks} />}
      {status === 'idle' && (
        <p className="text-center text-xs text-[var(--ink-soft)] py-2">在下方输入继续对话，上下文已完整保留</p>
      )}
    </div>
  )
}

function MessageBubble({ msg }: { msg: { role: string; content: string; tool_calls?: unknown[] } }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="glass rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[80%]">
          <p className="text-sm leading-relaxed text-[var(--ink)] whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    )
  }
  if (msg.role === 'assistant') {
    return (
      <div className="flex justify-start">
        <div className="w-full max-w-[85%]">
          {msg.content && <ResultView content={msg.content} />}
          {msg.tool_calls && msg.tool_calls.length > 0 && (
            <div className="text-[11px] text-[var(--ink-soft)] mt-1 px-1">
              ↳ 使用了 {msg.tool_calls.length} 个工具
            </div>
          )}
        </div>
      </div>
    )
  }
  // tool 消息不单独展示（已在 assistant 气泡里标注）
  return null
}
