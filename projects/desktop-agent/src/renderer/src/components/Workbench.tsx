import { useEffect, useRef } from 'react'
import { useTaskStore } from '../store/task'
import { getFinalAnswerOfTurn } from '../store/turns'
import { Composer } from './Composer'
import { ResultView } from './ResultView'
import { ProcessFlow } from './ProcessFlow'
import { TurnItemsView } from './TurnItemsView'
import { TurnNavigator } from './TurnNavigator'
import { ChatInput } from './ChatInput'
import { useSettingsStore } from './settings/settingsStore'
import { useDetailLevelStore, type DetailLevel } from './detailLevelStore'
import { useTimelineScroll } from './useTimelineScroll'
import { useDeferredRender } from './useDeferredRender'
import { ChevronUp } from 'lucide-react'
import { Maximize2, Minimize2, Eye } from 'lucide-react'
import type { Turn } from '../../../agent/src/items'

export function Workbench() {
  const { status, mode, goal, message, summary, messages } = useTaskStore()
  const greeting = greetingText()
  const taskTitle = status !== 'idle' ? goal || message : ''

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* 顶部栏 */}
      <div className="drag h-14 flex items-center justify-center px-6 border-b border-black/[0.06]">
        <div className="no-drag flex items-center gap-3 min-w-0">
          {taskTitle && (
            <span className="text-sm font-medium text-[var(--ink)] truncate" title={taskTitle}>
              {taskTitle}
            </span>
          )}
          {messages.length > 0 && <DetailLevelToggle />}
        </div>
      </div>

      {/* 主区域：滚动由各子视图自行管理，避免双层 overflow 导致双滚动条 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {messages.length > 0 ? (
          <ConversationView status={status} />
        ) : status === 'idle' ? (
          <div className="h-full overflow-y-auto">
            <HomeView greeting={greeting} />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <RunningView summary={summary} status={status} />
          </div>
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
      <div className="w-full max-w-4xl">
        <ChatInput
          value={message}
          onChange={setMessage}
          onSend={() => void startTask()}
          showProjectPicker
        />
      </div>

      {/* 快捷能力 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 w-full max-w-4xl mt-6">
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
  const { goal, message, currentTurn } = useTaskStore()
  const chunks = getFinalAnswerOfTurn(currentTurn)
  const userQuery = goal || message
  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
      {/* 用户消息：右侧气泡 */}
      {userQuery && (
        <div className="flex justify-end">
          <div className="glass rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[80%]">
            <p className="text-sm leading-relaxed text-[var(--ink)] whitespace-pre-wrap">{userQuery}</p>
          </div>
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
 * 对话视图：按轮次(Turn)渲染历史 + 本轮实时执行
 * 每一轮的思考/工具调用细节都在，翻回历史依然能展开看，不再只剩一句"用了N个工具"
 * 点击历史对话后，从这里"像没离开过一样"继续聊
 * ============================================================ */
function ConversationView({ status }: { status: string }) {
  const { turns, currentTurn, goal, message } = useTaskStore()
  const liveUserText = currentTurn?.items
    .filter((it) => it.type === 'userMessage')
    .flatMap((it) => it.content.filter((c) => c.type === 'text').map((c) => c.text || ''))
    .join('') || ''
  const { showThinking } = useSettingsStore()
  const chunks = getFinalAnswerOfTurn(currentTurn)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [turns.length, chunks, status])

  // 本轮正在进行：currentTurn 存在时才走实时渲染；完成后 currentTurn 置空并入 turns，交由历史轮统一渲染，避免重复
  const isLiveTurn = Boolean(currentTurn)

  // 点击导航条刻度：滚动定位到对应轮次，并高亮闪一下
  const handleJump = (turnId: string) => {
    const container = scrollRef.current
    if (!container) return
    const target = container.querySelector(`[data-turn-id="${turnId}"]`)
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      target.classList.add('turn-jump-highlight')
      window.setTimeout(() => target.classList.remove('turn-jump-highlight'), 1200)
    }
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* 左侧跨轮导航条：超过 3 轮才出现 */}
      <TurnNavigator turns={turns} onJump={handleJump} />
      <div ref={scrollRef} className="flex-1 w-full max-w-4xl mx-auto px-6 py-6 space-y-4 overflow-y-auto h-full">
        <TimelinePaged turns={turns} showThinking={showThinking} />
        {/* 本轮用户消息气泡 */}
        {isLiveTurn && liveUserText && (
          <div className="flex justify-end">
            <div className="glass rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[80%]">
              <p className="text-sm leading-relaxed text-[var(--ink)] whitespace-pre-wrap">{liveUserText}</p>
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
    </div>
  )
}

/** 一轮历史：用户消息气泡(右) + 思考/工具活动(左，可展开) + 最终回复(左)
 *  懒加载：不在视口内时只渲染用户消息占位，进入视口才渲染完整内容（来自 lobsterai LazyRenderTurn） */
function HistoryTurnView({ turn, showThinking }: { turn: Turn; showThinking: boolean }) {
  const userText = turn.items
    .filter((it) => it.type === 'userMessage')
    .flatMap((it) => it.content.filter((c) => c.type === 'text').map((c) => c.text || ''))
    .join('')
  const finalAnswer = getFinalAnswerOfTurn(turn)
  const { ref, shouldRender } = useDeferredRender<HTMLDivElement>({ rootMargin: '300px' })

  return (
    <div ref={ref} data-turn-id={turn.id} className="space-y-3 turn-target">
      {userText && (
        <div className="flex justify-end">
          <div className="glass rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[80%]">
            <p className="text-sm leading-relaxed text-[var(--ink)] whitespace-pre-wrap">{userText}</p>
          </div>
        </div>
      )}
      {shouldRender ? (
        <>
          <TurnItemsView turn={turn} showThinking={showThinking} />
          {finalAnswer && <ResultView content={finalAnswer} />}
        </>
      ) : (
        <div className="h-8" />
      )}
    </div>
  )
}

/** 虚拟分页的历史轮次渲染：超阈值自动折叠，可手动加载/折叠更早轮次（来自 Kun） */
function TimelinePaged({ turns, showThinking }: { turns: Turn[]; showThinking: boolean }) {
  const { visibleTurnCount, hasHidden, shouldShowCollapseButton, loadEarlier, collapseEarlier } = useTimelineScroll(turns.length)
  const visibleTurns = hasHidden ? turns.slice(hasHidden) : turns

  return (
    <>
      {hasHidden && (
        <div className="flex justify-center">
          <button
            onClick={loadEarlier}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-[var(--ink-soft)] hover:bg-black/[0.04] transition"
          >
            <ChevronUp size={13} />
            加载更早的 {hasHidden} 轮对话
          </button>
        </div>
      )}
      {shouldShowCollapseButton && (
        <div className="flex justify-center">
          <button
            onClick={collapseEarlier}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-[var(--ink-soft)] hover:bg-black/[0.04] transition"
          >
            <ChevronUp size={13} />
            折叠更早的轮次
          </button>
        </div>
      )}
      {visibleTurns.map((t) => (
        <HistoryTurnView key={t.id} turn={t} showThinking={showThinking} />
      ))}
    </>
  )
}

function DetailLevelToggle() {
  const { level, setLevel } = useDetailLevelStore()
  const options: { value: DetailLevel; icon: React.ReactNode; label: string }[] = [
    { value: 'conclusionOnly', icon: <Eye size={13} />, label: '只看结论' },
    { value: 'normal', icon: <Minimize2 size={13} />, label: '默认' },
    { value: 'expandAll', icon: <Maximize2 size={13} />, label: '全部展开' }
  ]
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-black/[0.04] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setLevel(opt.value)}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
            level === opt.value
              ? 'bg-white shadow-sm text-[var(--ink)]'
              : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
          }`}
          title={opt.label}
        >
          {opt.icon}
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
