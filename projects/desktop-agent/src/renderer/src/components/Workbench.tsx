import { useEffect, useRef, useState } from 'react'
import { useTaskStore, type Attachment } from '../store/task'
import { getFinalAnswerOfTurn } from '../store/turns'
import { Composer } from './Composer'
import { ResultView } from './ResultView'
import { ProcessFlow } from './ProcessFlow'
import { OutcomeFeedbackCard } from './OutcomeFeedbackCard'
import { TurnItemsView } from './TurnItemsView'
import { TurnNavigator } from './TurnNavigator'
import { ChatInput } from './ChatInput'
import { MessageActions, actionIcons, useMessageFeedback } from './MessageActions'
import { useSettingsStore } from './settings/settingsStore'
import { useTimelineScroll } from './useTimelineScroll'
import { useDeferredRender } from './useDeferredRender'
import { ChevronUp, PanelRightOpen } from 'lucide-react'
import type { Item, Turn, UserMessageContent } from '../../../agent/src/items'
import { WhaleTooltip } from './WhaleTooltip'
// @ts-ignore - 静态图片类型声明待补齐
import xiaolanjingIcon from '../assets/xiaolanjing-icon.png'

export function Workbench({
  rightCollapsed = false,
  showRightToggle = false,
  onToggleRight
}: {
  rightCollapsed?: boolean
  showRightToggle?: boolean
  onToggleRight?: () => void
}) {
  const { status, goal, message, summary, messages } = useTaskStore()
  const greeting = greetingText()
  const taskTitle = status !== 'idle' ? goal || message : ''
  const showTopDivider = status !== 'idle' || messages.length > 0

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* 顶部栏 */}
      <div className={`drag relative h-14 flex items-center justify-center px-6 ${showTopDivider ? 'border-b border-black/[0.06]' : ''}`}>
        <div className="no-drag flex items-center gap-3 min-w-0">
          {taskTitle && (
            <WhaleTooltip label={taskTitle} className="min-w-0">
              <span className="text-sm font-medium text-[var(--ink)] truncate">
                {taskTitle}
              </span>
            </WhaleTooltip>
          )}
        </div>
        {showRightToggle && rightCollapsed && onToggleRight && (
          <button
            title="展开右栏"
            onClick={onToggleRight}
            className="no-drag absolute right-4 top-1/2 z-10 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center transition bg-black/[0.06] text-[var(--ink)]"
          >
            <PanelRightOpen size={16} />
          </button>
        )}
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
        <img
          src={xiaolanjingIcon}
          alt="小蓝鲸"
          className="w-14 h-14 rounded-2xl mx-auto mb-4"
          draggable={false}
        />
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
  const { goal, message, currentTurn, startedAt } = useTaskStore()
  const { showThinking } = useSettingsStore()
  const userDraft = userDraftFromTurn(currentTurn) || { text: goal || message, attachments: [] }
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (text: string) => {
    setToast(text)
    window.setTimeout(() => setToast(null), 1800)
  }
  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
      {/* 用户消息：右侧气泡 */}
      {hasUserDraft(userDraft) && (
        <UserMessageBubble
          draft={userDraft}
          time={currentTurn?.startedAt || startedAt || undefined}
          canEdit={false}
          onCopy={() => copyDraft(userDraft, showToast)}
        />
      )}

      {/* 执行过程 + 回复：左侧，按真实顺序穿插展示 */}
      <ProcessFlow showTurnItems={false} />
      {currentTurn && (
        <TurnContentFlow
          turn={currentTurn}
          showThinking={showThinking}
          status={status}
          showToast={showToast}
          live
        />
      )}
      {toast && <FloatingToast text={toast} />}
    </div>
  )
}

/* ============================================================
 * 对话视图：按轮次(Turn)渲染历史 + 本轮实时执行
 * 每一轮的思考/工具调用细节都在，翻回历史依然能展开看，不再只剩一句"用了N个工具"
 * 点击历史对话后，从这里"像没离开过一样"继续聊
 * ============================================================ */
function ConversationView({ status }: { status: string }) {
  const { turns, currentTurn, goal, message, startedAt, taskId } = useTaskStore()
  const liveUserDraft = userDraftFromTurn(currentTurn) || { text: goal || message, attachments: [] }
  const { showThinking } = useSettingsStore()
  const liveRevision = currentTurn?.items.map((item) => {
    if (item.type === 'agentMessage') return `${item.id}:${item.text.length}`
    if (item.type === 'reasoning') return `${item.id}:${item.status}:${item.content.join('').length}`
    if (item.type === 'toolCall') return `${item.id}:${item.status}:${(item.result || '').length}`
    return item.id
  }).join('|') || ''
  const scrollRef = useRef<HTMLDivElement>(null)
  const staysAtBottomRef = useRef(true)
  const pendingJumpRef = useRef<string | null>(null)
  const timeline = useTimelineScroll(turns.length)
  const [activeTurnId, setActiveTurnId] = useState<string | null>(turns[turns.length - 1]?.id || null)
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (text: string) => {
    setToast(text)
    window.setTimeout(() => setToast(null), 1800)
  }

  useEffect(() => {
    if (scrollRef.current && staysAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [turns.length, liveRevision, status])

  useEffect(() => {
    pendingJumpRef.current = null
    staysAtBottomRef.current = true
    setActiveTurnId(turns[turns.length - 1]?.id || null)
  }, [taskId])

  useEffect(() => {
    const turnId = pendingJumpRef.current
    const container = scrollRef.current
    if (!turnId || !container) return
    const target = container.querySelector(`[data-turn-id="${CSS.escape(turnId)}"]`)
    if (!(target instanceof HTMLElement)) return

    pendingJumpRef.current = null
    const containerTop = container.getBoundingClientRect().top
    const targetTop = target.getBoundingClientRect().top
    container.scrollTo({ top: container.scrollTop + targetTop - containerTop - 24, behavior: 'smooth' })
    target.classList.add('turn-jump-highlight')
    window.setTimeout(() => target.classList.remove('turn-jump-highlight'), 900)
  }, [timeline.visibleTurnCount])

  // 本轮正在进行：currentTurn 存在时才走实时渲染；完成后 currentTurn 置空并入 turns，交由历史轮统一渲染，避免重复
  const isLiveTurn = Boolean(currentTurn)

  const handleJump = (turnId: string) => {
    const container = scrollRef.current
    if (!container) return
    const turnIndex = turns.findIndex((turn) => turn.id === turnId)
    if (turnIndex < 0) return

    pendingJumpRef.current = turnId
    setActiveTurnId(turnId)
    timeline.revealTurn(turnIndex)

    // 目标原本已显示时，轮次数不变化，直接完成定位。
    const target = container.querySelector(`[data-turn-id="${CSS.escape(turnId)}"]`)
    if (!(target instanceof HTMLElement)) return
    pendingJumpRef.current = null
    const containerTop = container.getBoundingClientRect().top
    const targetTop = target.getBoundingClientRect().top
    container.scrollTo({ top: container.scrollTop + targetTop - containerTop - 24, behavior: 'smooth' })
    target.classList.add('turn-jump-highlight')
    window.setTimeout(() => target.classList.remove('turn-jump-highlight'), 900)
  }

  const handleConversationScroll = () => {
    const container = scrollRef.current
    if (!container) return
    staysAtBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 48

    const readingLine = container.getBoundingClientRect().top + 80
    const targets = Array.from(container.querySelectorAll<HTMLElement>('[data-turn-id]'))
    let current = targets[0]
    for (const target of targets) {
      if (target.getBoundingClientRect().top <= readingLine) current = target
      else break
    }
    if (current?.dataset.turnId) setActiveTurnId(current.dataset.turnId)
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <TurnNavigator turns={turns} activeTurnId={activeTurnId} onJump={handleJump} />
      <div ref={scrollRef} onScroll={handleConversationScroll} className="flex-1 w-full max-w-4xl mx-auto px-6 py-6 space-y-4 overflow-y-auto h-full">
        <TimelinePaged
          turns={turns}
          showThinking={showThinking}
          status={status}
          showToast={showToast}
          visibleTurnCount={timeline.visibleTurnCount}
          hasHidden={timeline.hasHidden}
          shouldShowCollapseButton={timeline.shouldShowCollapseButton}
          loadEarlier={timeline.loadEarlier}
          collapseEarlier={timeline.collapseEarlier}
        />
        {/* 本轮用户消息气泡 */}
        {isLiveTurn && hasUserDraft(liveUserDraft) && (
          <UserMessageBubble
            draft={liveUserDraft}
            time={currentTurn?.startedAt || startedAt || undefined}
            canEdit={false}
            onCopy={() => copyDraft(liveUserDraft, showToast)}
          />
        )}
        {/* 本轮执行过程 + 实时回复，按真实顺序穿插展示 */}
        {isLiveTurn && <ProcessFlow showTurnItems={false} />}
        {isLiveTurn && currentTurn && (
          <TurnContentFlow
            turn={currentTurn}
            showThinking={showThinking}
            isLatest
            status={status}
            showToast={showToast}
            live
          />
        )}
        {status === 'idle' && (
          <p className="text-center text-xs text-[var(--ink-soft)] py-2">在下方输入继续对话，上下文已完整保留</p>
        )}
        {(status === 'completed' || status === 'failed') && <OutcomeFeedbackCard />}
        {toast && <FloatingToast text={toast} />}
      </div>
    </div>
  )
}

/** 一轮历史：用户消息气泡(右) + 思考/工具活动(左，可展开) + 最终回复(左)
 *  懒加载：不在视口内时只渲染用户消息占位，进入视口才渲染完整内容（来自 lobsterai LazyRenderTurn） */
function HistoryTurnView({
  turn,
  showThinking,
  isLatest,
  status,
  showToast
}: {
  turn: Turn
  showThinking: boolean
  isLatest: boolean
  status: string
  showToast: (text: string) => void
}) {
  const userDraft = userDraftFromTurn(turn)
  const finalAnswer = getFinalAnswerOfTurn(turn)
  const { ref, shouldRender } = useDeferredRender<HTMLDivElement>({ rootMargin: '300px' })

  return (
    <div ref={ref} data-turn-id={turn.id} className="space-y-1 turn-target">
      {userDraft && hasUserDraft(userDraft) && (
        <UserMessageBubble
          draft={userDraft}
          time={turn.startedAt}
          canEdit={isLatest && status !== 'executing' && Boolean(finalAnswer)}
          onCopy={() => copyDraft(userDraft, showToast)}
          onEdit={() => editDraft(userDraft, showToast)}
        />
      )}
      {shouldRender ? (
        <>
          <TurnContentFlow
            turn={turn}
            showThinking={showThinking}
            isLatest={isLatest}
            status={status}
            showToast={showToast}
          />
        </>
      ) : (
        <div className="h-8" />
      )}
    </div>
  )
}


function TurnContentFlow({
  turn,
  showThinking,
  isLatest = false,
  status,
  showToast,
  live = false
}: {
  turn: Turn
  showThinking: boolean
  isLatest?: boolean
  status: string
  showToast: (text: string) => void
  live?: boolean
}) {
  const blocks: JSX.Element[] = []
  let pendingProcessItems: Item[] = []
  const answerItems = turn.items.filter((item) => item.type === 'agentMessage' && item.phase === 'final_answer')
  const lastAnswerId = answerItems[answerItems.length - 1]?.id

  const flushProcess = (key: string) => {
    if (pendingProcessItems.length === 0) return
    blocks.push(
      <TurnItemsView
        key={key}
        turn={{ ...turn, items: pendingProcessItems }}
        showThinking={showThinking}
      />
    )
    pendingProcessItems = []
  }

  for (const item of turn.items) {
    if (item.type === 'userMessage') continue
    if (item.type === 'agentMessage' && item.phase === 'final_answer') {
      flushProcess(`process-before-${item.id}`)
      if (!item.text) continue
      const isLastAnswer = item.id === lastAnswerId
      blocks.push(
        live || !isLastAnswer ? (
          <div key={item.id} className="group/message">
            <ResultView content={item.text} />
          </div>
        ) : (
          <AssistantMessageBlock
            key={item.id}
            turn={turn}
            content={item.text}
            isLatest={isLatest}
            status={status}
            showToast={showToast}
          />
        )
      )
      continue
    }
    pendingProcessItems.push(item)
  }

  flushProcess('process-tail')
  return <div className="space-y-1">{blocks}</div>
}

/** 虚拟分页的历史轮次渲染：超阈值自动折叠，可手动加载/折叠更早轮次（来自 Kun） */
function TimelinePaged({
  turns,
  showThinking,
  status,
  showToast,
  visibleTurnCount,
  hasHidden,
  shouldShowCollapseButton,
  loadEarlier,
  collapseEarlier
}: {
  turns: Turn[]
  showThinking: boolean
  status: string
  showToast: (text: string) => void
  visibleTurnCount: number
  hasHidden: boolean
  shouldShowCollapseButton: boolean
  loadEarlier: () => void
  collapseEarlier: () => void
}) {
  const hiddenCount = Math.max(0, turns.length - visibleTurnCount)
  const visibleTurns = hasHidden ? turns.slice(hiddenCount) : turns

  return (
    <>
      {hasHidden && (
        <div className="flex justify-center">
          <button
            onClick={loadEarlier}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-[var(--ink-soft)] hover:bg-black/[0.04] transition"
          >
            <ChevronUp size={13} />
            加载更早的 {hiddenCount} 轮对话
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
        <HistoryTurnView
          key={t.id}
          turn={t}
          showThinking={showThinking}
          isLatest={turns[turns.length - 1]?.id === t.id}
          status={status}
          showToast={showToast}
        />
      ))}
    </>
  )
}

interface UserDraft {
  text: string
  attachments: Attachment[]
}

function userDraftFromTurn(turn: Turn | null): UserDraft | null {
  const item = turn?.items.find((it) => it.type === 'userMessage')
  if (!item || item.type !== 'userMessage') return null
  const text = item.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '')
    .join('')
  return {
    text,
    attachments: attachmentsFromContent(item.content)
  }
}

function attachmentsFromContent(content: UserMessageContent[]): Attachment[] {
  return content
    .filter((c) => c.type === 'image' || c.type === 'file')
    .map((c, index) => ({
      id: `draft-${Date.now()}-${index}`,
      name: c.name || (c.type === 'image' ? `图片${index + 1}.png` : `文档${index + 1}`),
      type: c.type === 'image' ? 'image' : 'text',
      size: c.size || 0,
      dataUrl: c.type === 'image' ? c.url : undefined,
      textContent: c.type === 'file' ? c.textContent : undefined,
      mime: c.mime || (c.type === 'image' ? 'image/png' : 'text/plain')
    }))
}

function hasUserDraft(draft: UserDraft): boolean {
  return Boolean(draft.text.trim() || draft.attachments.length > 0)
}

function copyTextOfDraft(draft: UserDraft): string {
  const attachmentText = draft.attachments
    .map((a) => `【${a.type === 'image' ? '图片' : '文档'} ${a.name}】`)
    .join('\n')
  return [draft.text.trim(), attachmentText].filter(Boolean).join('\n')
}

async function writeClipboard(text: string, showToast: (text: string) => void) {
  try {
    await navigator.clipboard.writeText(text)
    showToast('已复制')
  } catch {
    showToast('复制失败，请重试')
  }
}

function copyDraft(draft: UserDraft, showToast: (text: string) => void) {
  void writeClipboard(copyTextOfDraft(draft), showToast)
}

function editDraft(draft: UserDraft, showToast: (text: string) => void) {
  const { setMessage, setAttachments } = useTaskStore.getState()
  setMessage(draft.text)
  setAttachments(draft.attachments)
  showToast('已带回输入框')
}

function UserMessageBubble({
  draft,
  time,
  canEdit,
  onCopy,
  onEdit
}: {
  draft: UserDraft
  time?: number
  canEdit: boolean
  onCopy: () => void
  onEdit?: () => void
}) {
  const actions = [
    { key: 'copy' as const, label: '复制', icon: actionIcons.copy(), onClick: onCopy },
    ...(canEdit && onEdit ? [{ key: 'edit' as const, label: '编辑', icon: actionIcons.edit, onClick: onEdit }] : [])
  ]

  return (
    <div className="group/message flex justify-end">
      <div className="max-w-[80%]">
        <div className="rounded-2xl rounded-tr-md bg-black/[0.035] px-4 py-2.5">
          {draft.text.trim() && (
            <p className="text-sm leading-relaxed text-[var(--ink)] whitespace-pre-wrap">{draft.text}</p>
          )}
          {draft.attachments.length > 0 && (
            <div className={`flex flex-wrap gap-1.5 ${draft.text.trim() ? 'mt-2' : ''}`}>
              {draft.attachments.map((attachment) => (
                <AttachmentChip key={attachment.id} attachment={attachment} />
              ))}
            </div>
          )}
        </div>
        <MessageActions align="user" time={time} actions={actions} />
      </div>
    </div>
  )
}

function AttachmentChip({ attachment }: { attachment: Attachment }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-1 text-xs text-[var(--ink-soft)]">
      <span>{attachment.type === 'image' ? '图片' : '文档'}</span>
      <span className="max-w-[180px] truncate">{attachment.name}</span>
    </span>
  )
}

function AssistantMessageBlock({
  turn,
  content,
  isLatest,
  status,
  showToast
}: {
  turn: Turn
  content: string
  isLatest: boolean
  status: string
  showToast: (text: string) => void
}) {
  const { feedback, toggle } = useMessageFeedback()
  const regenerateLatestTurn = useTaskStore((s) => s.regenerateLatestTurn)
  const forkFromTurn = useTaskStore((s) => s.forkFromTurn)
  const state = feedback[turn.id] || {}
  const canRegenerate = isLatest && status !== 'executing'

  const actions = [
    { key: 'copy' as const, label: '复制', icon: actionIcons.copy(), onClick: () => void writeClipboard(content, showToast) },
    { key: 'like' as const, label: '点赞', icon: actionIcons.like(state.like), active: state.like, onClick: () => toggle(turn.id, 'like') },
    { key: 'dislike' as const, label: '点踩', icon: actionIcons.dislike(state.dislike), active: state.dislike, onClick: () => toggle(turn.id, 'dislike') },
    ...(canRegenerate ? [{
      key: 'regenerate' as const,
      label: '重新生成',
      icon: actionIcons.regenerate,
      onClick: async () => {
        showToast('正在重新生成')
        await regenerateLatestTurn()
      }
    }] : []),
    {
      key: 'fork' as const,
      label: '从此处新开对话',
      icon: actionIcons.fork,
      onClick: async () => {
        await forkFromTurn(turn.id)
        showToast('已创建新路线')
      }
    }
  ]

  return (
    <div className="group/message">
      <ResultView content={content} />
      <MessageActions align="assistant" time={turn.finishedAt} actions={actions} />
    </div>
  )
}

function FloatingToast({ text }: { text: string }) {
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full floating-toast px-3 py-1.5 text-xs text-white">
      {text}
    </div>
  )
}
