import { create } from 'zustand'
import { api } from '../api'
import { useSettingsStore } from '../components/settings/settingsStore'
import type { ImportedProjectSummary, ImportedSessionSummary } from '../api'
import { mergeImportedLists, removeImportedLists } from '../importProjectMerge'
import type { StdoutMessage, AgentMessage, MessageAttachment } from '../../../agent/src/protocol'
import type { Turn } from '../../../agent/src/items'
import { reduceTurnsEvent, getFinalAnswerOfTurn, deriveAgentMessages, type TurnsReducerState } from './turns'
import { buildCompletedSessionMessages, sanitizeContinuationMessages } from './sessionHistory'
import {
  createQueuedMessage,
  enqueueQueuedMessage,
  parsePersistedQueues,
  requeueAtHead,
  removeQueuedMessage as removeMessageFromQueue,
  takeQueuedMessage,
  updateQueuedMessage as updateMessageInQueue,
  type MessageQueues,
  type QueuedMessage
} from './messageQueue'

// 从 turns 的工具调用里派生产物列表：write_file/create_docx/create_xlsx 等写文件工具的产物
// 历史会话恢复时顶层 artifacts 已清空，靠这个从持久化的 turns 里重建，右栏"产物"区不再空白
const FILE_PRODUCING_TOOLS = new Set(['write_file', 'create_docx', 'create_xlsx'])

function deriveArtifactsFromTurns(turns: Turn[]): ArtifactEntry[] {
  const out: ArtifactEntry[] = []
  for (const t of turns) {
    for (const it of t.items) {
      if (it.type !== 'toolCall') continue
      if (!FILE_PRODUCING_TOOLS.has(it.kind)) continue
      const p = it.args?.path
      if (typeof p !== 'string' || !p) continue
      out.push({ type: 'file', filePath: p })
    }
  }
  return out
}

export type TaskStatus = 'idle' | 'executing' | 'completed' | 'failed'

/** 判断一条 stdout 消息是否属于 Turn/Item 事件模型，走 reduceTurnsEvent 统一处理 */
function isTurnItemEvent(
  msg: StdoutMessage
): msg is Extract<StdoutMessage, { type: 'turn_started' | 'turn_completed' | 'item_started' | 'item_delta' | 'item_completed' | 'item_status_changed' }> {
  return (
    msg.type === 'turn_started' ||
    msg.type === 'turn_completed' ||
    msg.type === 'item_started' ||
    msg.type === 'item_delta' ||
    msg.type === 'item_completed' ||
    msg.type === 'item_status_changed'
  )
}

export interface ArtifactEntry {
  type: 'diff' | 'report' | 'file' | 'preview' | 'evidence' | 'task_summary'
  filePath: string
  added?: number
  removed?: number
}

export interface SourceEntry {
  type: 'file' | 'web' | 'note'
  label: string
  path?: string
  url?: string
}

export interface HistoryEntry {
  id: string
  title: string
  mode: 'work' | 'code'
  status: TaskStatus
  finishedAt: number
  stepCount: number
  tokens: number
}

// ---- 项目 & 会话（对话）管理模型 ----
export interface Project {
  id: string
  name: string
  /** 项目图标 emoji，默认 📁 */
  icon: string
  createdAt: number
  updatedAt: number
  /** 是否置顶（置顶项目排在最前） */
  pinned: boolean
  /** 置顶时间戳，用于多项目置顶时的排序 */
  pinnedAt?: number
  /** 排序序号（拖拽调整） */
  order: number
  /** 绑定的本地文件夹绝对路径（从零新建或选已有文件夹）；无则走默认产出目录 */
  folderPath?: string
  importedSourceName?: string
  importedSourceFolderPath?: string
}

export interface Session {
  id: string
  title: string
  mode: 'work' | 'code'
  status: TaskStatus
  /** 所属项目 id；旧数据迁移到默认项目 */
  projectId: string
  createdAt: number
  updatedAt: number
  stepCount: number
  tokens: number
  /** 是否置顶 */
  pinned: boolean
  pinnedAt?: number
  /** 是否归档（归档后折叠到「已归档」分组） */
  archived: boolean
  archivedAt?: number
  /** 手动排序序号（拖拽调整） */
  order: number
  /** 任务耗时（毫秒），完成时写入，历史会话恢复时用于右栏"耗时"展示 */
  durationMs?: number
  /** 任务开始时间戳，完成时写入 */
  startedAt?: number
  /** 任务结束时间戳，完成时写入 */
  finishedAt?: number
  /** 用户上次阅读时间 */
  lastReadAt?: number
  /** 最后一条助手回复/任务完成时间 */
  lastMessageAt?: number
  /** 是否标记为未读 */
  unread?: boolean
  /** 待用户确认的动作类型：审批/提问/计划/续跑。切到别的项目时侧边栏据此显示醒目提示 */
  pendingAction?: 'approval' | 'question' | 'plan' | 'continuation' | null
  /** 标题是否为自动派生（首条 query 或模型总结）。手动重命名后置 false，避免后续总结回填覆盖用户命名 */
  titleAuto?: boolean
  importedSourceTitle?: string
  importedSourceProjectId?: string
  importedSourceArchived?: boolean
}

export interface ApprovalRequest {
  requestId: string
  toolName: string
  args: Record<string, unknown>
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  impact: string
  canRollback: boolean
}


export interface QuestionOption {
  id: string
  label: string
  description?: string
}

export interface QuestionPrompt {
  id: string
  question: string
  detail?: string
  options: QuestionOption[]
  multiple: boolean
  allowCustom: boolean
  allowSkip: boolean
}

export interface QuestionRequest {
  requestId: string
  question: string
  detail?: string
  options: QuestionOption[]
  multiple: boolean
  allowCustom: boolean
  allowSkip: boolean
  prompts?: QuestionPrompt[]
}

export interface ContinuationRequest {
  taskId: string
  currentStep: number
  hint: string
}

export interface PlanStep {
  step: number
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'removed'
}

export interface PendingPlan {
  requestId: string
  plan: string
  steps: PlanStep[]
}

export interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}


export interface CompactNotice {
  id: string
  state: 'running' | 'done' | 'blocked' | 'failed'
  label: string
  createdAt: number
}

export interface Attachment {
  id: string
  name: string
  type: 'image' | 'text' | 'file'
  size: number
  dataUrl?: string
  textContent?: string
  mime: string
  status?: 'ready' | 'uploading' | 'failed'
  error?: string
  sourcePath?: string
  /** 大图用 Object URL 替代 dataURL，减少内存占用 */
  objectUrl?: string
  /** 拖拽或粘贴来源，仅用于当前输入框内重试，不会发送给模型 */
  sourceFile?: File
}

export interface SubtaskEntry {
  id: string
  title: string
  status: 'running' | 'completed' | 'failed'
  durationMs?: number
  toolCount?: number
  tokens?: number
  error?: string
}

export interface StartTaskDraft {
  message?: string
  attachments?: Attachment[]
  baseTurns?: Turn[]
  baseMessages?: AgentMessage[]
}

/** 单任务运行时状态（隔离存储，切走不清除，切回来恢复） */
export interface TaskRuntime {
  status: TaskStatus
  /** 已完成的轮次(每轮含思考/工具调用/最终回复等条目，历史翻看细节靠这个) */
  turns: Turn[]
  /** 正在流式生成中的当前轮次，完成后归入 turns */
  currentTurn: Turn | null
  summary: string
  artifacts: ArtifactEntry[]
  usage: { inputTokens: number; outputTokens: number }
  error: string | null
  startedAt: number | null
  finishedAt: number | null
  approvalPending: ApprovalRequest | null
  pendingPlan: PendingPlan | null
  pendingQuestion: QuestionRequest | null
  continuationPending: ContinuationRequest | null
  compactNotice: CompactNotice | null
  todos: TodoItem[]
  subtasks: SubtaskEntry[]
}

export interface TaskState {
  status: TaskStatus
  taskId: string | null
  mode: 'work' | 'code'
  message: string
  goal: string
  /** 已完成的轮次序列，是对话展示的主数据源，每个条目(思考/工具/文件变更)独立可回看 */
  turns: Turn[]
  /** 正在流式生成中的当前轮次 */
  currentTurn: Turn | null
  summary: string
  artifacts: ArtifactEntry[]
  usage: { inputTokens: number; outputTokens: number }
  error: string | null
  startedAt: number | null
  finishedAt: number | null
  history: HistoryEntry[]
  /** 由 turns 派生的精简对话历史，仅用于喂给 LLM 和判断"是否有历史对话" */
  messages: AgentMessage[]
  runningTasks: Record<string, TaskRuntime>
  projects: Project[]
  sessions: Session[]
  activeProjectId: string
  activeSessionId: string | null
  approvalPending: ApprovalRequest | null
  pendingPlan: PendingPlan | null
  pendingQuestion: QuestionRequest | null
  continuationPending: ContinuationRequest | null
  compactNotice: CompactNotice | null
  todos: TodoItem[]
  subtasks: SubtaskEntry[]
  attachments: Attachment[]
  messageQueues: MessageQueues
  requestManualCompact: () => void
  clearCompactNotice: () => void
  setAttachments: (a: Attachment[]) => void
  setMode: (m: 'work' | 'code') => void
  setMessage: (s: string) => void
  setGoal: (s: string) => void
  startTask: (draft?: StartTaskDraft) => Promise<boolean>
  continueSession: (sessionId: string) => Promise<void>
  cancelTask: () => Promise<void>
  queueMessage: (text: string, attachments: Attachment[]) => Promise<void>
  updateQueuedMessage: (messageId: string, text: string) => void
  removeQueuedMessage: (messageId: string) => void
  restoreQueuedMessageToInput: (messageId: string) => void
  sendQueuedMessageNow: (messageId: string) => Promise<void>
  dispatchQueuedMessage: (sessionId: string, messageId?: string, interruptCurrent?: boolean) => Promise<void>
  regenerateLatestTurn: () => Promise<void>
  forkFromTurn: (turnId: string) => Promise<void>
  respondApproval: (approved: boolean, scope?: 'once' | 'task' | 'always') => Promise<void>
  respondQuestion: (selectedOptionIds?: string[], customAnswer?: string, skipped?: boolean, skipAll?: boolean) => Promise<void>
  respondPlan: (decision: 'approve' | 'reject_stop' | 'reject_revise', feedback?: string) => Promise<void>
  respondContinuation: (decision: 'continue' | 'stop' | 'split') => Promise<void>
  reset: () => void
  loadHistory: () => void
  deleteHistory: (id: string) => void
  // ---- 项目管理 ----
  createProject: (name: string, icon?: string, folderPath?: string) => string
  renameProject: (id: string, name: string) => void
  deleteProject: (id: string) => void
  togglePinProject: (id: string) => void
  setActiveProject: (id: string) => void
  reorderProjects: (orderedIds: string[]) => void
  // ---- 会话管理 ----
  createSession: (projectId?: string) => string
  renameSession: (id: string, title: string) => void
  deleteSession: (id: string) => void
  togglePinSession: (id: string) => void
  archiveSession: (id: string) => void
  unarchiveSession: (id: string) => void
  setActiveSession: (id: string) => void
  reorderSessions: (orderedIds: string[]) => void
  /** 批量归档某项目下所有对话 */
  archiveAllInProject: (projectId: string) => void
  updateSessionProject: (sessionId: string, projectId: string) => void
  appendEvent: (msg: StdoutMessage) => void
  /** 标记单条会话已读/未读 */
  markSessionRead: (sessionId: string, read?: boolean) => void
  /** 批量标记项目下所有会话已读 */
  markAllReadInProject: (projectId: string) => void
  /** 将外部导入的项目和对话可靠地合并到侧边栏清单。 */
  mergeImportedData: (projects: ImportedProjectSummary[], sessions: ImportedSessionSummary[]) => void
  removeImportedData: (projectIds: string[], sessionIds: string[]) => void
  /** 统一一致性校验：对齐磁盘存在性 + import catalog，可选 title 校验与元数据重算。
   *  full=true 时读磁盘消息，修复与首轮 query 脱节的标题（如 agent.md 残留）并重算 stepCount。
   *  allTitles=true 时校验所有非手动命名的会话（仅建议在「修复历史标题」手动触发时使用）。
   *  full=false（默认）只做存在性/catalog 对齐，不读消息正文，开销小。 */
  reconcileSessions: (opts?: { full?: boolean; allTitles?: boolean }) => Promise<void>
}

// 各模式的状态快照，切换 Work/Code 时保存/恢复
const modeSnapshots = new Map<'work' | 'code', Omit<Partial<TaskState>, 'mode'>>()

const HISTORY_KEY = 'xld.history.v1'
const HISTORY_MAX = 20
const PROJECTS_KEY = 'xld.projects.v1'
const SESSIONS_KEY = 'xld.sessions.v1'
const ACTIVE_PROJECT_KEY = 'xld.activeProject.v1'
const MESSAGE_QUEUES_KEY = 'xld.messageQueues.v1'
const dispatchingQueuedSessions = new Set<string>()

/** 默认项目 id，旧历史与无项目归属的对话都放这里 */
export const DEFAULT_PROJECT_ID = 'default'

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function loadHistoryFromStorage(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as HistoryEntry[]
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : []
  } catch {
    return []
  }
}

function saveHistoryToStorage(h: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)))
  } catch {
    /* ignore quota errors */
  }
}

function loadProjectsFromStorage(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as Project[]
      if (Array.isArray(arr)) {
        // 过滤掉历史遗留的 default"对话"伪项目，只保留真实项目
        return arr.filter((p) => p.id !== DEFAULT_PROJECT_ID)
      }
    }
  } catch {
    /* ignore */
  }
  return []
}

function saveProjectsToStorage(p: Project[]) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

function loadSessionsFromStorage(): Session[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as Session[]
      if (Array.isArray(arr)) {
        // 旧数据没有 lastReadAt，默认按 updatedAt 算，避免全部显示未读
        return arr.map((s) => ({ ...s, lastReadAt: s.lastReadAt ?? s.updatedAt ?? Date.now(), unread: s.unread ?? false }))
      }
    }
  } catch {
    /* ignore */
  }
  const old = loadHistoryFromStorage()
  return old.map((h, i) => ({
    id: h.id,
    title: h.title,
    mode: h.mode,
    status: h.status,
    projectId: DEFAULT_PROJECT_ID,
    createdAt: h.finishedAt,
    updatedAt: h.finishedAt,
    stepCount: h.stepCount,
    tokens: h.tokens,
    pinned: false,
    archived: false,
    order: i,
    lastReadAt: h.finishedAt
  }))
}

function saveSessionsToStorage(s: Session[]) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

/** 新会话插到列表最前，其余 order 顺延，保证侧边栏「最新在上」 */
function prependSession(sessions: Session[], session: Session): Session[] {
  const rest = sessions.filter((s) => s.id !== session.id).map((s, i) => ({ ...s, order: i + 1 }))
  return [{ ...session, order: 0 }, ...rest]
}

function saveImportedListsOrRestore(projects: Project[], sessions: Session[]): void {
  const previousProjects = localStorage.getItem(PROJECTS_KEY)
  const previousSessions = localStorage.getItem(SESSIONS_KEY)
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
    const savedProjects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || 'null') as unknown
    const savedSessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || 'null') as unknown
    if (!Array.isArray(savedProjects) || savedProjects.length !== projects.length ||
      !Array.isArray(savedSessions) || savedSessions.length !== sessions.length) {
      throw new Error('导入清单写入后核对失败')
    }
  } catch (error) {
    if (previousProjects === null) localStorage.removeItem(PROJECTS_KEY)
    else localStorage.setItem(PROJECTS_KEY, previousProjects)
    if (previousSessions === null) localStorage.removeItem(SESSIONS_KEY)
    else localStorage.setItem(SESSIONS_KEY, previousSessions)
    throw new Error(error instanceof Error && error.name === 'QuotaExceededError'
      ? '本机可用保存空间不足，导入资料尚未加入侧边栏'
      : '导入清单保存失败，原有项目和对话已保留')
  }
}

function loadActiveProject(): string {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY) || DEFAULT_PROJECT_ID
  } catch {
    return DEFAULT_PROJECT_ID
  }
}

function saveActiveProject(id: string) {
  try {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id)
  } catch {
    /* ignore */
  }
}

function loadMessageQueues(): MessageQueues {
  try {
    return parsePersistedQueues(localStorage.getItem(MESSAGE_QUEUES_KEY))
  } catch {
    return {}
  }
}

function saveMessageQueues(queues: MessageQueues): boolean {
  try {
    localStorage.setItem(MESSAGE_QUEUES_KEY, JSON.stringify(queues))
    return true
  } catch {
    return false
  }
}

const initial = {
  status: 'idle' as TaskStatus,
  taskId: null as string | null,
  mode: 'work' as 'work' | 'code',
  message: '',
  goal: '',
  turns: [] as Turn[],
  currentTurn: null as Turn | null,
  summary: '',
  artifacts: [] as ArtifactEntry[],
  usage: { inputTokens: 0, outputTokens: 0 },
  error: null as string | null,
  startedAt: null as number | null,
  finishedAt: null as number | null,
  approvalPending: null as ApprovalRequest | null,
  pendingPlan: null as PendingPlan | null,
  pendingQuestion: null as QuestionRequest | null,
  continuationPending: null as ContinuationRequest | null,
  compactNotice: null as CompactNotice | null,
  todos: [] as TodoItem[],
  subtasks: [] as SubtaskEntry[],
  attachments: [] as Attachment[],
  messageQueues: {} as MessageQueues,
  messages: [] as AgentMessage[]
}

const COMPACT_CHAR_THRESHOLD = 60000
const COMPACT_KEEP_TAIL = 8

function messageTextLength(messages: AgentMessage[]): number {
  return messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0)
}

function compactMessagesForContext(messages: AgentMessage[]): { messages: AgentMessage[]; changed: boolean } {
  if (messageTextLength(messages) <= COMPACT_CHAR_THRESHOLD || messages.length <= COMPACT_KEEP_TAIL) {
    return { messages, changed: false }
  }
  const head = messages.slice(0, -COMPACT_KEEP_TAIL)
  const tail = messages.slice(-COMPACT_KEEP_TAIL)
  const summaryLines = head
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => `${msg.role === 'user' ? '用户' : '小蓝鲸'}：${msg.content.replace(/\s+/g, ' ').slice(0, 220)}`)
    .slice(-40)
  const summary: AgentMessage = {
    role: 'user',
    content: `以下是已自动整理过的旧对话摘要，用于继续当前任务：\n${summaryLines.join('\n')}`
  }
  return { messages: [summary, ...tail], changed: true }
}

function compactNotice(state: CompactNotice['state'], label: string): CompactNotice {
  return { id: `compact-${Date.now()}`, state, label, createdAt: Date.now() }
}

function describeAttachments(attachments: Attachment[] | MessageAttachment[]): string {
  if (attachments.length === 0) return ''
  return attachments
    .map((a, index) => `【${a.type === 'image' ? '图片' : '文档'} ${a.name || index + 1}】`)
    .join(' ')
}

function messageAttachmentsOf(attachments: Attachment[]): MessageAttachment[] {
  return attachments.filter((a) => a.status !== 'failed' && a.status !== 'uploading').map((a) => ({
    type: a.type,
    name: a.name,
    mime: a.mime,
    size: a.size,
    dataUrl: a.dataUrl,
    textContent: a.textContent
  }))
}

async function prepareAttachmentsForDispatch(attachments: Attachment[]): Promise<Attachment[]> {
  return Promise.all(attachments.map(async (attachment) => {
    if (!attachment.objectUrl || attachment.dataUrl || attachment.type !== 'image') return attachment
    const response = await fetch(attachment.objectUrl)
    const blob = await response.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return { ...attachment, dataUrl }
  }))
}

function releaseAttachmentObjectUrls(attachments: Attachment[]): void {
  for (const attachment of attachments) {
    if (attachment.objectUrl) URL.revokeObjectURL(attachment.objectUrl)
  }
}

function draftFromTurn(turn: Turn | null): { message: string; attachments: Attachment[] } | null {
  const userItem = turn?.items.find((item) => item.type === 'userMessage')
  if (!userItem || userItem.type !== 'userMessage') return null
  const message = userItem.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '')
    .join('')
  const attachments: Attachment[] = userItem.content
    .filter((c) => c.type === 'image' || c.type === 'file')
    .map((c, index) => ({
      id: `edit-${Date.now()}-${index}`,
      name: c.name || (c.type === 'image' ? `图片${index + 1}.png` : `文档${index + 1}`),
      type: c.type === 'image' ? 'image' : 'text',
      size: c.size || 0,
      dataUrl: c.type === 'image' ? c.url : undefined,
      textContent: c.type === 'file' ? c.textContent : undefined,
      mime: c.mime || (c.type === 'image' ? 'image/png' : 'text/plain')
    }))
  return { message, attachments }
}

function userContentFromDraft(message: string, attachments: Attachment[]) {
  return [
    ...(message ? [{ type: 'text' as const, text: message }] : []),
    ...attachments.map((a) => ({
      type: a.type === 'image' ? 'image' as const : 'file' as const,
      name: a.name,
      mime: a.mime,
      size: a.size,
      url: a.type === 'image' ? a.dataUrl : undefined,
      textContent: a.type !== 'image' ? a.textContent : undefined
    }))
  ]
}

export const useTaskStore = create<TaskState>((set, get) => ({
  ...initial,
  history: loadHistoryFromStorage(),
  messages: [],
  messageQueues: loadMessageQueues(),
  runningTasks: {},
  projects: loadProjectsFromStorage(),
  sessions: loadSessionsFromStorage(),
  activeProjectId: loadActiveProject(),
  activeSessionId: null,
  requestManualCompact: () => {
    const cur = get()
    if (cur.status === 'executing') {
      set({ compactNotice: compactNotice('blocked', '任务进行中，暂时不能手动整理上下文') })
      return
    }
    try {
      set({ compactNotice: compactNotice('running', '正在整理旧上下文') })
      const compacted = compactMessagesForContext(cur.messages)
      if (compacted.changed) {
        set({ messages: compacted.messages, compactNotice: compactNotice('done', '上下文已整理，后续任务会优先使用摘要和最近对话') })
      } else {
        set({ compactNotice: compactNotice('done', '当前上下文还不需要整理') })
      }
    } catch {
      set({ compactNotice: compactNotice('failed', '上下文整理失败，已保留当前对话') })
    }
  },
  clearCompactNotice: () => set({ compactNotice: null }),
  setMode: (m) => {
    const cur = get()
    if (cur.mode === m) return
    // 切走前：若当前任务还在执行，存进 runningTasks（后台继续跑）
    if (cur.taskId && cur.status === 'executing') {
      set((s) => ({
        runningTasks: {
          ...s.runningTasks,
          [cur.taskId as string]: {
            status: s.status, turns: s.turns, currentTurn: s.currentTurn, summary: s.summary, artifacts: s.artifacts, usage: s.usage,
            error: s.error, startedAt: s.startedAt, finishedAt: s.finishedAt,
            approvalPending: s.approvalPending, pendingPlan: s.pendingPlan, pendingQuestion: s.pendingQuestion, continuationPending: s.continuationPending, compactNotice: s.compactNotice, todos: s.todos, subtasks: s.subtasks
          }
        }
      }))
    }
    modeSnapshots.set(cur.mode, {
      status: cur.status, taskId: cur.taskId, message: cur.message, goal: cur.goal,
      turns: cur.turns, currentTurn: cur.currentTurn, summary: cur.summary,
      artifacts: cur.artifacts, usage: cur.usage, error: cur.error,
      startedAt: cur.startedAt, finishedAt: cur.finishedAt, todos: cur.todos,
      subtasks: cur.subtasks, attachments: cur.attachments, messages: cur.messages,
      approvalPending: null, pendingPlan: null, pendingQuestion: null
    })
    // 恢复目标模式状态
    const snap = modeSnapshots.get(m)
    if (snap) {
      // 切换模式时强制回到 idle：执行中的任务不应跨模式保留假状态，避免界面卡死无响应
      set({
        ...snap,
        mode: m,
        runningTasks: get().runningTasks
      })
    } else {
      set({ ...initial, messages: [], messageQueues: cur.messageQueues, mode: m, runningTasks: get().runningTasks, history: cur.history, projects: cur.projects, sessions: cur.sessions, activeProjectId: cur.activeProjectId, activeSessionId: cur.activeSessionId })
    }
  },
  setMessage: (s) => set({ message: s }),
  setAttachments: (a) => set({ attachments: a }),
  setGoal: (s) => set({ goal: s }),
  loadHistory: () => set({ history: loadHistoryFromStorage() }),
  deleteHistory: (id) => {
    const next = get().history.filter((h) => h.id !== id)
    saveHistoryToStorage(next)
    set({ history: next })
  },
  // ---- 项目管理 ----
  createProject: (name, icon = '📁', folderPath) => {
    const now = Date.now()
    const project: Project = {
      id: uid('proj'),
      name: name.trim() || '新项目',
      icon,
      createdAt: now,
      updatedAt: now,
      pinned: false,
      order: get().projects.length,
      folderPath
    }
    const next = [...get().projects, project]
    saveProjectsToStorage(next)
    saveActiveProject(project.id)
    set({ ...initial, projects: next, messageQueues: get().messageQueues, activeProjectId: project.id, activeSessionId: null })
    return project.id
  },
  renameProject: (id, name) => {
    const next = get().projects.map((p) =>
      p.id === id ? { ...p, name: name.trim() || p.name, updatedAt: Date.now() } : p
    )
    saveProjectsToStorage(next)
    set({ projects: next })
  },
  deleteProject: (id) => {
    if (id === DEFAULT_PROJECT_ID) return
    const nextProjects = get().projects.filter((p) => p.id !== id)
    const removedSessions = get().sessions.filter((s) => s.projectId === id)
    const nextSessions = get().sessions.filter((s) => s.projectId !== id)
    const removedSessionIds = new Set(removedSessions.map((session) => session.id))
    const nextQueues = Object.fromEntries(
      Object.entries(get().messageQueues).filter(([sessionId]) => !removedSessionIds.has(sessionId))
    )
    saveProjectsToStorage(nextProjects)
    saveSessionsToStorage(nextSessions)
    saveMessageQueues(nextQueues)
    removedSessions.forEach((s) => void api.deleteSessionMessages(s.id))
    const active = get().activeProjectId === id ? DEFAULT_PROJECT_ID : get().activeProjectId
    saveActiveProject(active)
    set({ projects: nextProjects, sessions: nextSessions, messageQueues: nextQueues, activeProjectId: active })
  },
  togglePinProject: (id) => {
    const now = Date.now()
    const next = get().projects.map((p) =>
      p.id === id ? { ...p, pinned: !p.pinned, pinnedAt: !p.pinned ? now : undefined, updatedAt: now } : p
    )
    saveProjectsToStorage(next)
    set({ projects: next })
  },
  setActiveProject: (id) => {
    saveActiveProject(id)
    set({ activeProjectId: id, activeSessionId: null })
  },
  reorderProjects: (orderedIds) => {
    const map = new Map(get().projects.map((p) => [p.id, p]))
    const next = orderedIds.map((id, i) => ({ ...(map.get(id) as Project), order: i })).filter(Boolean)
    saveProjectsToStorage(next)
    set({ projects: next })
  },
  // ---- 会话管理 ----
  createSession: (projectId) => {
    const pid = projectId || get().activeProjectId
    const now = Date.now()
    const session: Session = {
      id: uid('sess'),
      title: '新对话',
      mode: get().mode,
      status: 'idle',
      projectId: pid,
      createdAt: now,
      updatedAt: now,
      stepCount: 0,
      tokens: 0,
      pinned: false,
      archived: false,
      order: 0,
      lastReadAt: now,
      unread: false
    }
    const next = prependSession(get().sessions, session)
    saveSessionsToStorage(next)
    set({ sessions: next, activeSessionId: session.id })
    return session.id
  },
  renameSession: (id, title) => {
    const next = get().sessions.map((s) =>
      s.id === id ? { ...s, title: title.trim() || s.title, titleAuto: false, updatedAt: Date.now() } : s
    )
    saveSessionsToStorage(next)
    set({ sessions: next })
  },
  deleteSession: (id) => {
    const target = get().sessions.find((s) => s.id === id)
    const next = get().sessions.filter((s) => s.id !== id)
    const nextQueues = { ...get().messageQueues }
    delete nextQueues[id]
    saveSessionsToStorage(next)
    saveMessageQueues(nextQueues)
    void api.deleteSessionMessages(id)
    // 若该会话来自外部导入，同步从 import catalog 移除，否则重启 App 时
    // getExternalImportHistory → mergeImportedData 会把它再次加回侧边栏（磁盘正文已删，点开为空）
    if (target && (target.importedSourceTitle !== undefined || target.importedSourceId !== undefined)) {
      void api.removeImportedSession(id).catch(() => { /* catalog 清理失败不阻塞本地删除 */ })
    }
    set({ sessions: next, messageQueues: nextQueues, activeSessionId: get().activeSessionId === id ? null : get().activeSessionId })
    void get().reconcileSessions()
  },
  togglePinSession: (id) => {
    const now = Date.now()
    const next = get().sessions.map((s) =>
      s.id === id ? { ...s, pinned: !s.pinned, pinnedAt: !s.pinned ? now : undefined, updatedAt: now } : s
    )
    saveSessionsToStorage(next)
    set({ sessions: next })
  },
  archiveSession: (id) => {
    const now = Date.now()
    const next = get().sessions.map((s) =>
      s.id === id ? { ...s, archived: true, archivedAt: now, updatedAt: now } : s
    )
    saveSessionsToStorage(next)
    set({ sessions: next })
  },
  unarchiveSession: (id) => {
    const next = get().sessions.map((s) =>
      s.id === id ? { ...s, archived: false, archivedAt: undefined, updatedAt: Date.now() } : s
    )
    saveSessionsToStorage(next)
    set({ sessions: next })
  },
  setActiveSession: (id) => set({ activeSessionId: id }),
  reorderSessions: (orderedIds) => {
    const map = new Map(get().sessions.map((s) => [s.id, s]))
    const reordered = orderedIds.map((id, i) => ({ ...(map.get(id) as Session), order: i })).filter(Boolean)
    const rest = get().sessions.filter((s) => !orderedIds.includes(s.id))
    const next = [...reordered, ...rest]
    saveSessionsToStorage(next)
    set({ sessions: next })
  },
  archiveAllInProject: (projectId) => {
    const now = Date.now()
    const next = get().sessions.map((s) =>
      s.projectId === projectId && !s.archived ? { ...s, archived: true, archivedAt: now, updatedAt: now } : s
    )
    saveSessionsToStorage(next)
    set({ sessions: next })
  },
  updateSessionProject: (sessionId, projectId) => {
    const next = get().sessions.map((s) => s.id === sessionId ? { ...s, projectId, updatedAt: Date.now() } : s)
    saveSessionsToStorage(next)
    set({ sessions: next })
  },
  markSessionRead: (sessionId, read = true) => {
    const now = Date.now()
    const next = get().sessions.map((s) => {
      if (s.id !== sessionId) return s
      if (read) {
        // 已读：两条通道一起清掉，避免 explicit / timeBased 拧巴
        return { ...s, lastReadAt: now, unread: false, updatedAt: now }
      }
      // 未读：显式标记，并保证 lastMessageAt >= lastReadAt，timeBased 也能成立
      return {
        ...s,
        unread: true,
        lastMessageAt: Math.max(s.lastMessageAt ?? 0, (s.lastReadAt ?? 0) + 1, now),
        updatedAt: now
      }
    })
    saveSessionsToStorage(next)
    set({ sessions: next })
  },
  markAllReadInProject: (projectId) => {
    const now = Date.now()
    const next = get().sessions.map((s) =>
      s.projectId === projectId && !s.archived
        ? { ...s, lastReadAt: now, unread: false, updatedAt: now }
        : s
    )
    saveSessionsToStorage(next)
    set({ sessions: next })
  },
  mergeImportedData: (importedProjects, importedSessions) => {
    const currentProjects = get().projects
    const currentSessions = get().sessions
    const { projects: nextProjects, sessions: nextSessions, projectIdChanges } = mergeImportedLists(
      currentProjects, currentSessions, importedProjects, importedSessions)
    const activeProjectId = projectIdChanges.get(get().activeProjectId) || get().activeProjectId
    saveImportedListsOrRestore(nextProjects, nextSessions)
    saveActiveProject(activeProjectId)
    set({ projects: nextProjects, sessions: nextSessions, activeProjectId })
  },
  removeImportedData: (projectIds, sessionIds) => {
    const removedSessions = new Set(sessionIds)
    const { projects: nextProjects, sessions: nextSessions } = removeImportedLists(
      get().projects, get().sessions, projectIds, sessionIds)
    const remainingProjectIds = new Set(nextProjects.map((project) => project.id))
    const activeProjectId = remainingProjectIds.has(get().activeProjectId) ? get().activeProjectId : DEFAULT_PROJECT_ID
    saveImportedListsOrRestore(nextProjects, nextSessions)
    saveActiveProject(activeProjectId)
    set({
      projects: nextProjects,
      sessions: nextSessions,
      activeProjectId,
      activeSessionId: get().activeSessionId && removedSessions.has(get().activeSessionId as string) ? null : get().activeSessionId
    })
  },
  reconcileSessions: async (opts) => {
    const full = Boolean(opts?.full)
    const [diskRes, catalogRes] = await Promise.all([
      api.listSessionIds(),
      api.getExternalImportHistory()
    ])
    const diskIds = new Set(diskRes.ids || [])
    const catalog = catalogRes.success && catalogRes.catalog ? catalogRes.catalog : null

    // 1. 存在性对齐：磁盘没有正文的会话从侧边栏移除；导入来源的同步清 catalog，避免重启复活
    const toRemoveFromCatalog: string[] = []
    let next = get().sessions.filter((s) => {
      if (diskIds.has(s.id)) return true
      if (s.importedSourceTitle !== undefined || s.importedSourceId !== undefined) toRemoveFromCatalog.push(s.id)
      return false
    })
    for (const id of toRemoveFromCatalog) void api.removeImportedSession(id).catch(() => {})

    // 2. catalog 补全：catalog 里有、当前 sessions 里没有的导入会话 → 合并回侧边栏
    if (catalog && catalog.sessions.some((s) => !next.some((x) => x.id === s.id))) {
      const merged = mergeImportedLists(get().projects, next, catalog.projects, catalog.sessions)
      next = merged.sessions
      saveImportedListsOrRestore(merged.projects, next)
      set({ projects: merged.projects })
    } else {
      saveSessionsToStorage(next)
    }
    set({ sessions: next })

    // 3. full 档：对标题疑似脱节（占位/附件名/文件名）且非手动命名的会话读盘校验 + 重算 stepCount
    if (full) {
      const targets = next.filter((s) =>
        s.titleAuto !== false && (opts?.allTitles || titleLooksSuspect(s.title))
      )
      for (const s of targets) {
        try {
          const msgs = await api.loadSessionMessages(s.id) as AgentMessage[]
          reconcileSessionTitleIfNeeded(set, get, s.id, msgs)
          // 重算 stepCount（按 assistant 消息条数）；tokens 无来源不强写
          const stepCount = msgs.filter((m) => m.role === 'assistant').length
          const gs = get()
          const cur = gs.sessions.find((x) => x.id === s.id)
          if (cur && cur.stepCount !== stepCount) {
            const nextSessions = gs.sessions.map((x) => x.id === s.id ? { ...x, stepCount } : x)
            saveSessionsToStorage(nextSessions)
            set({ sessions: nextSessions })
          }
        } catch { /* 读盘失败跳过该条 */ }
      }
    }
  },
  reset: () => {
    // 释放附件的 Object URL，防止内存泄漏
    for (const a of get().attachments) { if (a.objectUrl) URL.revokeObjectURL(a.objectUrl) }
    set({ ...initial, history: get().history, projects: get().projects, sessions: get().sessions, messageQueues: get().messageQueues, activeProjectId: get().activeProjectId, activeSessionId: get().activeSessionId, mode: get().mode, approvalPending: null, pendingPlan: null, pendingQuestion: null, continuationPending: null, compactNotice: null, todos: [], subtasks: [], attachments: [] })
  },
  cancelTask: async () => {
    const { taskId, continuationPending } = get()
    if (continuationPending && taskId) {
      await api.sendContinuationResponse(taskId, 'stop')
    }
    if (taskId) await api.cancelTask(taskId)
    const rt = { ...get().runningTasks }
    if (taskId) delete rt[taskId]
    set({ status: 'idle', finishedAt: Date.now(), continuationPending: null, runningTasks: rt })
  },
  queueMessage: async (text, attachments) => {
    const sessionId = get().activeSessionId || get().taskId
    const readyAttachments = attachments.filter((attachment) => attachment.status !== 'failed' && attachment.status !== 'uploading')
    if (!sessionId || (!text.trim() && readyAttachments.length === 0)) return

    let durableAttachments: Attachment[]
    try {
      durableAttachments = await prepareAttachmentsForDispatch(readyAttachments)
    } catch {
      set({ error: '图片读取失败，未加入队列，请重新添加后再试' })
      return
    }

    const queuedMessage = createQueuedMessage({
      id: uid('queue'),
      sessionId,
      text,
      attachments: durableAttachments
    })
    const nextQueues = enqueueQueuedMessage(get().messageQueues, queuedMessage)
    if (!saveMessageQueues(nextQueues)) {
      set({ error: '本地存储空间不足，消息未加入队列，请减少附件后重试' })
      return
    }
    releaseAttachmentObjectUrls(readyAttachments)
    set({ messageQueues: nextQueues, message: '', attachments: [], error: null })
  },
  updateQueuedMessage: (messageId, text) => {
    const sessionId = get().activeSessionId || get().taskId
    if (!sessionId) return
    const nextQueues = updateMessageInQueue(get().messageQueues, sessionId, messageId, text)
    saveMessageQueues(nextQueues)
    set({ messageQueues: nextQueues })
  },
  removeQueuedMessage: (messageId) => {
    const sessionId = get().activeSessionId || get().taskId
    if (!sessionId) return
    const nextQueues = removeMessageFromQueue(get().messageQueues, sessionId, messageId)
    saveMessageQueues(nextQueues)
    set({ messageQueues: nextQueues })
  },
  restoreQueuedMessageToInput: (messageId) => {
    const sessionId = get().activeSessionId || get().taskId
    if (!sessionId) return
    const item = (get().messageQueues[sessionId] || []).find((message) => message.id === messageId)
    if (!item || item.status === 'dispatching') return
    const nextQueues = removeMessageFromQueue(get().messageQueues, sessionId, messageId)
    saveMessageQueues(nextQueues)
    set({
      messageQueues: nextQueues,
      message: item.text,
      attachments: item.attachments.map((attachment) => ({ ...attachment, status: 'ready' as const }))
    })
  },
  sendQueuedMessageNow: async (messageId) => {
    const sessionId = get().activeSessionId || get().taskId
    if (sessionId) await get().dispatchQueuedMessage(sessionId, messageId, true)
  },
  dispatchQueuedMessage: async (sessionId, messageId, interruptCurrent = false) => {
    const before = get()
    if (before.activeSessionId !== sessionId) return
    if (before.status === 'executing' && !interruptCurrent) return
    if (dispatchingQueuedSessions.has(sessionId)) return
    dispatchingQueuedSessions.add(sessionId)
    const taken = takeQueuedMessage(before.messageQueues, sessionId, messageId)
    if (!taken.item) {
      dispatchingQueuedSessions.delete(sessionId)
      return
    }
    saveMessageQueues(taken.queues)
    set({ messageQueues: taken.queues })
    try {
      if (interruptCurrent && before.status === 'executing') await get().cancelTask()
      const context = get()
      const baseTurns = context.turns
      const baseMessages = interruptCurrent && context.messages[context.messages.length - 1]?.role === 'user'
        ? context.messages.slice(0, -1)
        : context.messages
      const started = await get().startTask({
        message: taken.item.text,
        attachments: taken.item.attachments,
        baseTurns,
        baseMessages
      })
      if (!started) throw new Error(get().error || '排队消息发送失败')
    } catch (error) {
      const restoredQueues = requeueAtHead(get().messageQueues, taken.item)
      saveMessageQueues(restoredQueues)
      set({
        messageQueues: restoredQueues,
        error: error instanceof Error ? error.message : '排队消息发送失败'
      })
    } finally {
      dispatchingQueuedSessions.delete(sessionId)
    }
  },
  respondApproval: async (approved: boolean, scope: 'once' | 'task' | 'always' = 'once') => {
    const { approvalPending } = get()
    if (approvalPending) {
      await api.sendApproval(approvalPending.requestId, approved, scope)
      set({ approvalPending: null })
      setSessionPendingAction(set, get, get().activeSessionId, null)
    }
  },
  respondQuestion: async (selectedOptionIds?: string[], customAnswer?: string, skipped?: boolean, skipAll?: boolean) => {
    const { pendingQuestion } = get()
    if (pendingQuestion) {
      const finalCustomAnswer = skipAll
        ? JSON.stringify({ skipped_all: true }, null, 2)
        : customAnswer
      await api.sendQuestionResponse(pendingQuestion.requestId, selectedOptionIds, finalCustomAnswer, skipped || skipAll)
      set({ pendingQuestion: null })
      setSessionPendingAction(set, get, get().activeSessionId, null)
    }
  },
  respondPlan: async (decision: 'approve' | 'reject_stop' | 'reject_revise', feedback?: string) => {
    const { pendingPlan } = get()
    if (pendingPlan) {
      await api.sendPlanResponse(pendingPlan.requestId, decision, feedback)
      set({ pendingPlan: null })
      setSessionPendingAction(set, get, get().activeSessionId, null)
    }
  },
  respondContinuation: async (decision: 'continue' | 'stop' | 'split') => {
    const { continuationPending, taskId, summary, message, activeProjectId, sessions } = get()
    if (continuationPending && taskId) {
      await api.sendContinuationResponse(taskId, decision)
      set({ continuationPending: null })
      setSessionPendingAction(set, get, get().activeSessionId, null)
      if (decision === 'split') {
        const parent = sessions.find((s) => s.id === taskId)
        const goalSeed =
          (summary && summary.trim().slice(0, 240)) ||
          (message && message.trim().slice(0, 240)) ||
          '请基于上一任务的未完成部分继续，拆成更小可验证步骤。'
        const newId = get().createSession(activeProjectId || parent?.projectId)
        const title = `拆分自：${(parent?.title || '对话').slice(0, 24)}`
        get().renameSession(newId, title)
        set({
          message: `【接力拆分】上一任务已达步数上限。请继续完成剩余目标：\n${goalSeed}`,
          status: 'idle'
        })
      }
    }
  },
  appendEvent: (msg) => {
    const evTaskId = (msg as { taskId?: string }).taskId
    const cur = get()
    const isVisible = evTaskId === cur.activeSessionId

    // 不可见任务：只更新隔离存储 runningTasks，不碰全局展示状态
    if (!isVisible || !evTaskId) {
      const rt = cur.runningTasks[evTaskId || '']
      const base: TaskRuntime = rt || {
        status: 'executing', turns: [], currentTurn: null, summary: '',
        artifacts: [], usage: { inputTokens: 0, outputTokens: 0 },
        error: null, startedAt: Date.now(), finishedAt: null,
        approvalPending: null, pendingPlan: null, pendingQuestion: null, continuationPending: null, compactNotice: null, todos: [], subtasks: []
      }

      if (isTurnItemEvent(msg)) {
        const reduced = reduceTurnsEvent({ turns: base.turns, currentTurn: base.currentTurn }, msg)
        const patch: Partial<TaskRuntime> = { turns: reduced.turns, currentTurn: reduced.currentTurn, status: 'executing' }
        set((st) => ({ runningTasks: { ...st.runningTasks, [evTaskId as string]: { ...base, ...patch } } }))
        return
      }

      let patch: Partial<TaskRuntime> = {}
      // 后台任务收到需用户确认的事件：在侧边栏会话上标记 pendingAction，用户在别的项目也能看到
      let pendingAction: Session['pendingAction'] = null
      switch (msg.type) {
        case 'artifact': patch = { artifacts: [...base.artifacts, { type: msg.artifact_type, filePath: msg.file_path }] }; break
        case 'usage': patch = { usage: { inputTokens: base.usage.inputTokens + msg.inputTokens, outputTokens: base.usage.outputTokens + msg.outputTokens } }; break
        case 'error': {
        // 后台任务失败且用户没在看，也触发未读提示
        const gsErr = get()
        const sessErr = gsErr.sessions.find((x) => x.id === evTaskId)
        if (sessErr && gsErr.activeSessionId !== evTaskId) {
          const nowErr = Date.now()
          const nextSessionsErr = gsErr.sessions.map((x) => x.id === evTaskId ? { ...x, lastMessageAt: nowErr, updatedAt: nowErr, pendingAction: null } : x)
          saveSessionsToStorage(nextSessionsErr)
          set({ sessions: nextSessionsErr })
        }
        patch = { error: msg.message, status: 'failed', finishedAt: Date.now() }
        break
      }
        case 'approval_request': patch = { approvalPending: { requestId: msg.request_id, toolName: msg.tool_name, args: msg.args, riskLevel: msg.risk_level, impact: msg.impact, canRollback: msg.can_rollback } }; pendingAction = 'approval'; break
        case 'plan_proposed': patch = { pendingPlan: { requestId: msg.request_id, plan: msg.plan, steps: msg.steps } }; pendingAction = 'plan'; break
        case 'question_proposed': patch = { pendingQuestion: { requestId: msg.request_id, question: msg.question, detail: msg.detail, options: msg.options, multiple: msg.multiple, allowCustom: msg.allow_custom, allowSkip: msg.allow_skip, prompts: msg.prompts } }; pendingAction = 'question'; break
        case 'continuation_request': patch = { continuationPending: { taskId: msg.task_id, currentStep: msg.current_step, hint: msg.hint } }; pendingAction = 'continuation'; break
        case 'todo_update': patch = { todos: msg.todos }; break
        case 'completed': {
          // 后台任务完成：累积轮次落盘，但不更新全局展示
          const assistantText = getFinalAnswerOfTurn(base.currentTurn) || msg.summary || ''
          const finishedTurns = base.turns
          void api.loadSessionMessages(evTaskId as string).then((stored) => {
            const msgs = (stored as AgentMessage[]) || []
            const derivedTail = deriveAgentMessages(finishedTurns)
            const nextMessages = buildCompletedSessionMessages(msgs, msg.messages, derivedTail)
            void api.saveSessionMessages(evTaskId as string, nextMessages)
            void api.saveSessionTurns(evTaskId as string, finishedTurns)
            // 更新会话列表标题/状态
            const gs = get()
            const sess = gs.sessions.find((x) => x.id === evTaskId)
            if (sess) {
              const isActive = gs.activeSessionId === evTaskId
              const now = Date.now()
              const nextSessions = gs.sessions.map((x) => x.id === evTaskId ? { ...x, status: 'completed' as TaskStatus, updatedAt: now, stepCount: finishedTurns.length, tokens: base.usage.inputTokens + base.usage.outputTokens, title: x.title && x.title !== '新对话' ? x.title : (assistantText.slice(0, 40) || x.title), lastMessageAt: isActive ? x.lastMessageAt : now, lastReadAt: isActive ? now : x.lastReadAt, unread: isActive ? false : x.unread, pendingAction: null } : x)
              saveSessionsToStorage(nextSessions)
              set({ sessions: nextSessions })
            }
          })
          const rtAfter = { ...get().runningTasks }
          delete rtAfter[evTaskId as string]
          set({ runningTasks: rtAfter })
          scheduleQueueDispatch(evTaskId)
          return
        }
        default: break
      }
      set((st) => ({ runningTasks: { ...st.runningTasks, [evTaskId as string]: { ...base, ...patch } } }))
      if (msg.type === 'error') scheduleQueueDispatch(evTaskId)
      if (pendingAction) setSessionPendingAction(set, get, evTaskId as string, pendingAction)
      return
    }

    // 可见任务：走原有逻辑更新全局展示，同时同步到 runningTasks
    const syncRT = (extra?: Partial<TaskRuntime>) => {
      const st = get()
      const old: TaskRuntime = st.runningTasks[evTaskId] || { status: 'executing', turns: [], currentTurn: null, summary: '', artifacts: [], usage: { inputTokens: 0, outputTokens: 0 }, error: null, startedAt: Date.now(), finishedAt: null, approvalPending: null, pendingPlan: null, pendingQuestion: null, continuationPending: null, compactNotice: null, todos: [], subtasks: [] }
      set({ runningTasks: { ...st.runningTasks, [evTaskId]: { ...old, status: st.status, turns: st.turns, currentTurn: st.currentTurn, summary: st.summary, artifacts: st.artifacts, usage: st.usage, error: st.error, startedAt: st.startedAt, finishedAt: st.finishedAt, approvalPending: st.approvalPending, pendingPlan: st.pendingPlan, pendingQuestion: st.pendingQuestion, compactNotice: st.compactNotice, todos: st.todos, subtasks: st.subtasks, ...extra } } })
    }

    if (isTurnItemEvent(msg)) {
      const reduced = reduceTurnsEvent({ turns: cur.turns, currentTurn: cur.currentTurn }, msg)
      set({ turns: reduced.turns, currentTurn: reduced.currentTurn, status: 'executing' })
      syncRT()
      return
    }

    switch (msg.type) {
      case 'artifact':
        set((s) => ({ artifacts: [...s.artifacts, { type: msg.artifact_type, filePath: msg.file_path }] }))
        syncRT()
        break
      case 'usage':
        set((s) => ({ usage: { inputTokens: s.usage.inputTokens + msg.inputTokens, outputTokens: s.usage.outputTokens + msg.outputTokens } }))
        syncRT()
        break
      case 'error':
        set({ error: msg.message, status: 'failed', finishedAt: Date.now(), continuationPending: null })
        setSessionPendingAction(set, get, evTaskId, null)
        { const rt = { ...get().runningTasks }; delete rt[evTaskId]; set({ runningTasks: rt }) }
        scheduleQueueDispatch(evTaskId)
        break
      case 'completed': {
        const cur2 = get()
        const assistantText = getFinalAnswerOfTurn(cur2.currentTurn) || msg.summary || ''
        const derivedTail = deriveAgentMessages(cur2.turns)
        const nextMessages = buildCompletedSessionMessages(cur2.messages, msg.messages, derivedTail)
        const finalStatus: TaskStatus = cur2.status === 'failed' ? 'failed' : 'completed'
        const firstUserQuery = cur2.messages.find((m) => m.role === 'user')?.content || ''
        set({ status: finalStatus, summary: msg.summary, finishedAt: Date.now(), messages: nextMessages, continuationPending: null })
        setSessionPendingAction(set, get, evTaskId, null)
        pushHistory(set, get)
        if (evTaskId) {
          void api.saveSessionMessages(evTaskId, nextMessages)
          void api.saveSessionTurns(evTaskId, get().turns)
        }
        { const rt = { ...get().runningTasks }; delete rt[evTaskId]; set({ runningTasks: rt }) }
        // 任务成功完成：异步总结 ≤10 字短标题回填侧边栏（失败时保留原标题）
        if (finalStatus === 'completed' && evTaskId) {
          summarizeAndUpdateTitle(set, get, evTaskId, firstUserQuery, assistantText)
        }
        scheduleQueueDispatch(evTaskId)
        break
      }
      case 'approval_request':
        set({ approvalPending: { requestId: msg.request_id, toolName: msg.tool_name, args: msg.args, riskLevel: msg.risk_level, impact: msg.impact, canRollback: msg.can_rollback } })
        setSessionPendingAction(set, get, evTaskId, 'approval')
        syncRT()
        break
      case 'plan_proposed':
        set({ pendingPlan: { requestId: msg.request_id, plan: msg.plan, steps: msg.steps } })
        setSessionPendingAction(set, get, evTaskId, 'plan')
        syncRT()
        break
      case 'question_proposed':
        set({ pendingQuestion: { requestId: msg.request_id, question: msg.question, detail: msg.detail, options: msg.options, multiple: msg.multiple, allowCustom: msg.allow_custom, allowSkip: msg.allow_skip, prompts: msg.prompts } })
        setSessionPendingAction(set, get, evTaskId, 'question')
        syncRT()
        break
      case 'continuation_request':
        set({ continuationPending: { taskId: msg.task_id, currentStep: msg.current_step, hint: msg.hint } })
        setSessionPendingAction(set, get, evTaskId, 'continuation')
        syncRT()
        break
      case 'todo_update':
        set({ todos: msg.todos })
        syncRT()
        break
      case 'subtask_started':
        set((s) => ({ subtasks: [...s.subtasks, { id: msg.subtask_id, title: msg.title, status: 'running' }] }))
        syncRT()
        break
      case 'subtask_completed':
        set((s) => ({ subtasks: s.subtasks.map((st) => st.id === msg.subtask_id ? { ...st, status: 'completed', durationMs: msg.duration_ms, toolCount: msg.tool_count, tokens: msg.tokens } : st) }))
        syncRT()
        break
      case 'subtask_failed':
        set((s) => ({ subtasks: s.subtasks.map((st) => st.id === msg.subtask_id ? { ...st, status: 'failed', error: msg.error } : st) }))
        syncRT()
        break
      default:
        break
    }
  },

  startTask: async (draft) => {
    const state = get()
    const mode = state.mode
    const message = draft?.message ?? state.message
    const draftAttachments = draft?.attachments ?? state.attachments
    if (draftAttachments.some((a) => a.status === 'failed' || a.status === 'uploading')) return false
    const readyDraftAttachments = draftAttachments.filter((a) => a.status !== 'failed' && a.status !== 'uploading')
    if (!message.trim() && readyDraftAttachments.length === 0) return false

    const settingsState = useSettingsStore.getState()
    let sendAttachments: Attachment[]
    try {
      sendAttachments = await prepareAttachmentsForDispatch(readyDraftAttachments)
    } catch {
      set({ error: '图片读取失败，请重新添加后再发送' })
      return false
    }

    const baseTurns = draft?.baseTurns ?? state.turns
    const baseMessages = draft?.baseMessages ?? state.messages
    // 继续已有对话：用原 sessionId + 全量历史；新建对话：无 sessionId 无 history
    const isContinue = Boolean(state.activeSessionId && (baseMessages.length > 0 || baseTurns.length > 0))
    const sessionId = isContinue ? (state.activeSessionId as string) : undefined
    // 续聊只带用户/助手正文，过程回放里的工具细节不再反推给模型
    const rawHistory = isContinue ? sanitizeContinuationMessages(baseMessages.filter((m) => m.role !== 'system')) : undefined
    let history = rawHistory
    if (rawHistory) {
      const compacted = compactMessagesForContext(rawHistory)
      if (compacted.changed) {
        set({ compactNotice: compactNotice('running', '正在自动整理旧上下文') })
        history = compacted.messages
        set({ compactNotice: compactNotice('done', '上下文已自动整理，当前任务会继续使用最近对话') })
      }
    }

    const messageAttachments = messageAttachmentsOf(sendAttachments)
    // 标题只取用户文本，纯附件时用「新任务」占位，等任务完成 LLM 总结回填。
    // 不再用附件名（agent.md 等）做标题——附件后续被移除后标题会与实际首轮 query 脱节。
    // 标题只取用户文本，纯附件时用「新任务」占位，等任务完成 LLM 总结回填。
    // 不再用附件名（agent.md 等）做标题——附件后续被移除后标题会与实际首轮 query 脱节。
    const visibleTitle = message.trim() || '新任务'
    const userMsg: AgentMessage = {
      role: 'user',
      content: message,
      ...(messageAttachments.length > 0 ? { attachments: messageAttachments } : {})
    }

    set({
      status: 'executing',
      turns: isContinue ? baseTurns : [],
      currentTurn: null,
      summary: '',
      artifacts: [],
      error: null,
      approvalPending: null,
      pendingPlan: null,
      pendingQuestion: null,
      compactNotice: null,
      todos: [],
      subtasks: [],
      attachments: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      startedAt: Date.now(),
      finishedAt: null,
      goal: state.goal || visibleTitle,
      message: '',
      messages: [...baseMessages, userMsg]
    })
    // 注册到隔离存储，切走后事件继续写入对应任务
    set((st) => ({ runningTasks: { ...st.runningTasks, [get().taskId as string]: { status: 'executing', turns: get().turns, currentTurn: null, summary: '', artifacts: [], usage: { inputTokens: 0, outputTokens: 0 }, error: null, startedAt: Date.now(), finishedAt: null, approvalPending: null, pendingPlan: null, pendingQuestion: null, continuationPending: null, compactNotice: null, todos: [], subtasks: [] } } }))

    // 释放附件 Object URL
    releaseAttachmentObjectUrls(draftAttachments)

    // 取当前项目绑定的文件夹作为工作区目录；无绑定则走主进程默认产出目录
    const curProject = get().projects.find((p) => p.id === get().activeProjectId)
    const workspaceDir = curProject?.folderPath || undefined
    const res = await api.startTask({ mode, message, workspaceDir, maxIterations: settingsState.maxIterations, approvalMode: settingsState.approvalMode, autoApproveLow: settingsState.autoApproveLow, sessionId, history, attachments: messageAttachments })
    if (res.error) {
      const now = Date.now()
      const failureText = `模型调用失败：${res.error}`
      const failureSessionId = res.taskId || sessionId
      const failedTurn: Turn = {
        id: uid('turn'),
        status: 'failed',
        startedAt: now,
        finishedAt: now,
        items: [
          { type: 'userMessage', id: uid('userMessage'), content: userContentFromDraft(message, sendAttachments) },
          { type: 'agentMessage', id: uid('agentMessage'), text: failureText, phase: 'final_answer' }
        ]
      }
      const nextTurns = [...baseTurns, failedTurn]
      const nextMessages: AgentMessage[] = [...baseMessages, userMsg, { role: 'assistant', content: failureText }]
      set({
        status: 'failed',
        error: failureText,
        finishedAt: now,
        taskId: failureSessionId || get().taskId,
        activeSessionId: failureSessionId || get().activeSessionId,
        turns: nextTurns,
        currentTurn: null,
        messages: nextMessages
      })
      if (failureSessionId) {
        pushHistory(set, get)
        void api.saveSessionMessages(failureSessionId, nextMessages)
        void api.saveSessionTurns(failureSessionId, nextTurns)
      }
    } else {
      set({ taskId: res.taskId, activeSessionId: res.taskId })
      // 新对话：立即在侧边栏落一条 executing 记录，并显示加载图标；
      // 任务完成时 pushHistory 会按 id 命中并更新（不会重复创建）
      if (!isContinue) {
        const startNow = Date.now()
        const initialTitle = visibleTitle.slice(0, 40) || '新对话'
        const cur2 = get()
        const newSess: Session = {
          id: res.taskId,
          title: initialTitle,
          mode,
          status: 'executing',
          projectId: cur2.activeProjectId,
          createdAt: startNow,
          updatedAt: startNow,
          stepCount: 0,
          tokens: 0,
          pinned: false,
          archived: false,
          order: 0,
          lastReadAt: startNow,
          unread: false,
          startedAt: startNow,
          titleAuto: true
        }
        const nextSessions = prependSession(cur2.sessions, newSess)
        saveSessionsToStorage(nextSessions)
        set({ sessions: nextSessions })
        // 新对话立刻落盘用户消息，防止丢失
        void api.saveSessionMessages(res.taskId, [userMsg])
      }
    }
    return !res.error
  },
  regenerateLatestTurn: async () => {
    const cur = get()
    if (cur.status === 'executing') return
    const latest = cur.turns[cur.turns.length - 1]
    const draft = draftFromTurn(latest)
    if (!latest || !draft) return
    const baseTurns = cur.turns.slice(0, -1)
    await get().startTask({
      message: draft.message,
      attachments: draft.attachments,
      baseTurns,
      baseMessages: deriveAgentMessages(baseTurns)
    })
  },
  forkFromTurn: async (turnId) => {
    const cur = get()
    if (cur.status === 'executing') return
    const index = cur.turns.findIndex((turn) => turn.id === turnId)
    if (index < 0) return
    const forkTurns = cur.turns.slice(0, index + 1)
    const forkMessages = deriveAgentMessages(forkTurns)
    const source = forkTurns[index]
    const draft = draftFromTurn(source)
    const titleBase = draft?.message.trim() || describeAttachments(draft?.attachments || []) || '新路线'
    const now = Date.now()
    const session: Session = {
      id: uid('sess'),
      title: `分叉：${titleBase.slice(0, 32)}`,
      mode: cur.mode,
      status: 'completed',
      projectId: cur.activeProjectId,
      createdAt: now,
      updatedAt: now,
      stepCount: forkTurns.length,
      tokens: cur.usage.inputTokens + cur.usage.outputTokens,
      pinned: false,
      archived: false,
      order: 0,
      startedAt: forkTurns[0]?.startedAt,
      finishedAt: source.finishedAt || now,
      durationMs: forkTurns[0]?.startedAt ? (source.finishedAt || now) - forkTurns[0].startedAt : undefined
    }
    const nextSessions = prependSession(cur.sessions, session)
    saveSessionsToStorage(nextSessions)
    await api.saveSessionMessages(session.id, forkMessages)
    await api.saveSessionTurns(session.id, forkTurns)
    set({
      ...initial,
      status: 'completed',
      messageQueues: cur.messageQueues,
      mode: cur.mode,
      messages: forkMessages,
      turns: forkTurns,
      activeSessionId: session.id,
      activeProjectId: cur.activeProjectId,
      taskId: session.id,
      goal: session.title,
      usage: cur.usage,
      startedAt: session.startedAt ?? null,
      finishedAt: session.finishedAt ?? null,
      artifacts: deriveArtifactsFromTurns(forkTurns),
      runningTasks: cur.runningTasks,
      projects: cur.projects,
      sessions: nextSessions,
      history: cur.history
    })
  },
  continueSession: async (sessionId) => {
    const cur = get()
    // 切走前：若当前任务还在执行，存进 runningTasks（后台继续跑，不中断）
    if (cur.taskId && cur.status === 'executing') {
      set((s) => ({
        runningTasks: {
          ...s.runningTasks,
          [cur.taskId as string]: {
            status: s.status, turns: s.turns, currentTurn: s.currentTurn, summary: s.summary, artifacts: s.artifacts, usage: s.usage,
            error: s.error, startedAt: s.startedAt, finishedAt: s.finishedAt,
            approvalPending: s.approvalPending, pendingPlan: s.pendingPlan, pendingQuestion: s.pendingQuestion, continuationPending: s.continuationPending, compactNotice: s.compactNotice, todos: s.todos, subtasks: s.subtasks
          }
        }
      }))
    }
    // 切到目标：优先从 runningTasks 恢复运行时（任务还在跑），否则读盘恢复历史(消息+轮次)
    const rt = get().runningTasks[sessionId]
    const sess = get().sessions.find((s) => s.id === sessionId)
    // 切到这条会话即视为已读（含后台仍在跑的任务）
    const readNow = Date.now()
    const nextSessionsRead = get().sessions.map((s) =>
      s.id === sessionId ? { ...s, lastReadAt: readNow, unread: false } : s
    )
    saveSessionsToStorage(nextSessionsRead)
    if (rt && rt.status === 'executing') {
      set({ ...initial, ...rt, messages: cur.messages, messageQueues: get().messageQueues, mode: sess?.mode || cur.mode, activeSessionId: sessionId, activeProjectId: sess?.projectId || cur.activeProjectId, taskId: sessionId, goal: sess?.title || '', runningTasks: get().runningTasks, projects: get().projects, sessions: nextSessionsRead, history: get().history })
    } else {
      set({ sessions: nextSessionsRead })
      const [stored, storedTurns] = await Promise.all([
        api.loadSessionMessages(sessionId) as Promise<AgentMessage[]>,
        api.loadSessionTurns(sessionId) as Promise<Turn[]>
      ])
      const restoredTurns = storedTurns || []
      // 从 session 元数据恢复右栏展示所需字段：
      // - status：用 session 的完成态(completed/failed)，而非 idle，让右栏正常渲染、折叠按钮可用
      // - usage：session.tokens 只有总量，无法拆 input/output，总量置入 inputTokens、outputTokens 留 0（右栏合计显示总量）
      // - startedAt/finishedAt：恢复耗时展示
      // - artifacts：从 turns 派生（write_file 等写文件工具的产物），顶层 artifacts 落盘未存
      const sessStatus = (sess?.status === 'completed' || sess?.status === 'failed') ? sess.status : 'completed'
      const sessTokens = sess?.tokens ?? 0
      set({ ...initial, status: sessStatus, messages: stored || [], messageQueues: get().messageQueues, turns: restoredTurns, mode: sess?.mode || cur.mode, activeSessionId: sessionId, activeProjectId: sess?.projectId || cur.activeProjectId, taskId: sessionId, goal: sess?.title || '', usage: { inputTokens: sessTokens, outputTokens: 0 }, startedAt: sess?.startedAt ?? null, finishedAt: sess?.finishedAt ?? null, artifacts: deriveArtifactsFromTurns(restoredTurns), runningTasks: get().runningTasks, projects: get().projects, sessions: get().sessions, history: get().history })
      // 打开会话即校验标题是否与实际首轮 query 脱节（如 agent.md 这类被移除附件残留的标题），
      // 异步修复，不影响会话加载体验
      void reconcileSessionTitleIfNeeded(set, get, sessionId, stored || [])
      scheduleQueueDispatch(sessionId)
    }
  }
}))

/** 当前 turn 结束后，若目标会话仍是前台且空闲，则自动出队首条。 */
function scheduleQueueDispatch(sessionId: string): void {
  queueMicrotask(() => {
    const state = useTaskStore.getState()
    if (state.activeSessionId !== sessionId) return
    if (state.status === 'executing') return
    void state.dispatchQueuedMessage(sessionId)
  })
}

/** 更新某条会话的待确认状态，并落盘。action 传 null/undefined 表示清除。
 *  用于审批/提问/计划/续跑等待用户输入时，在侧边栏给出醒目提示（即便用户在别的项目）。
 *  未读规则：仅后台会话 bump lastMessageAt；前台正在看则同步已读，避免「人在看仍蓝点」。 */
function setSessionPendingAction(
  set: (partial: Partial<TaskState> | ((s: TaskState) => Partial<TaskState>)) => void,
  get: () => TaskState,
  sessionId: string | null | undefined,
  action: Session['pendingAction']
) {
  if (!sessionId) return
  const now = Date.now()
  const isActive = get().activeSessionId === sessionId
  const next = get().sessions.map((s) => {
    if (s.id !== sessionId) return s
    if (action) {
      if (isActive) {
        return { ...s, pendingAction: action, lastReadAt: now, unread: false }
      }
      return { ...s, pendingAction: action, lastMessageAt: now }
    }
    return { ...s, pendingAction: null }
  })
  saveSessionsToStorage(next)
  set({ sessions: next })
}

/** 任务完成后异步调用模型，把首条 query + 助手回复总结成 ≤10 字短标题回填到侧边栏。
 *  - 失败/超时/返回空：保留原标题，静默处理
 *  - 用户已手动重命名（titleAuto === false）：不覆盖
 *  - 用 userQuery（首条 query，取 session 当前标题作为输入）+ assistantReply（本轮最终回复） */
function summarizeAndUpdateTitle(
  set: (partial: Partial<TaskState> | ((s: TaskState) => Partial<TaskState>)) => void,
  get: () => TaskState,
  sessionId: string,
  userQuery: string,
  assistantReply: string
): void {
  if (!sessionId) return
  if (!userQuery && !assistantReply) return
  void api.summarizeTitle({ userQuery, assistantReply }).then((res) => {
    if (!res.success || !res.title) return
    const gs = get()
    const sess = gs.sessions.find((s) => s.id === sessionId)
    if (!sess) return
    if (sess.titleAuto === false) return // 用户已手动命名，不覆盖
    const next = gs.sessions.map((s) =>
      s.id === sessionId ? { ...s, title: res.title as string, titleAuto: true, updatedAt: Date.now() } : s
    )
    saveSessionsToStorage(next)
    set({ sessions: next })
  }).catch(() => { /* 失败保留原标题 */ })
}

/** 判断当前标题是否与实际首轮 user query 脱节、需要重新生成。
 *  触发条件（满足任一）：
 *   - 标题是占位符（新对话/新任务）
 *   - 标题来自附件描述（【图片 …】/【文档 …】或单个【…】包裹）
 *   - 标题形如纯文件名（agent.md、xxx.pdf 等）
 *   - 标题与首轮 user query 在字面上零交集（token 级别无任何重叠）
 *  仅当 titleAuto !== false（非用户手动命名）且首轮 query 非空时才认为需要重生成。 */
const FILENAME_LIKE_RE = /\.(md|txt|pdf|docx?|xlsx?|pptx?|json|ya?ml|csv|html?|css|js|jsx|ts|tsx|py|go|rs|java|c|cc|cpp|hh|hpp|sh|toml|ini|conf|log|bak)$/i

/** 标题形态是否「疑似脱节」（不需要首轮 query 参照即可判断）。
 *  占位符、附件描述包裹、纯文件名形态都算。用于决定是否值得读磁盘消息做完整校验。 */
function titleLooksSuspect(title: string): boolean {
  const t = String(title || '').trim()
  if (!t) return true
  if (t === '新对话' || t === '新任务' || t === '新路线') return true
  if (/^#?\s*Files mentioned by the user/i.test(t) || /^My request for Codex/i.test(t)) return true
  if (/^【(图片|文档)\s/.test(t) || /^【[^】]+】$/.test(t)) return true
  if (FILENAME_LIKE_RE.test(t) && !/[\u4e00-\u9fa5]/.test(t)) return true
  return false
}

function tokenizeForOverlap(text: string): Set<string> {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[\s,，。.!！?？:;；"'`'()（）【】\[\]{}<>《》/\\|@#$%^&*+=\-—~·]+/)
      .filter((t) => t.length >= 2)
  )
}

function titleNeedsReconcile(title: string, firstUserText: string): boolean {
  const t = String(title || '').trim()
  if (!t) return true
  if (titleLooksSuspect(t)) return true
  // 与首轮 query 零交集
  const fu = String(firstUserText || '').trim()
  if (!fu) return false // 无首轮文本作为参照，不强行重生成
  const tTokens = tokenizeForOverlap(t)
  const fuTokens = tokenizeForOverlap(fu)
  for (const tok of tTokens) if (fuTokens.has(tok)) return false
  return true
}

/** 从单条 user 消息提取可用文本：正文优先，其次附件 textContent。 */
function stripCodexFilesMentionedForDisplay(text: string): string {
  if (!/(?:^|\n)#?\s*Files mentioned by the user:/i.test(text)) return text
  const myRequest = text.match(/##\s*My request for Codex:\s*/i)
  const next = myRequest && myRequest.index !== undefined
    ? text.slice(myRequest.index + myRequest[0].length)
    : text.replace(/(?:^|\n)#?\s*Files mentioned by the user:[^\n]*\n(?:##\s+[^\n]+\n)*/i, '\n')
  return next.replace(/<image\b[^>]*>/gi, '').replace(/\n{3,}/g, '\n\n').trim()
}

function userTextFromMessage(m: AgentMessage): string {
  const base = typeof m.content === 'string' ? stripCodexFilesMentionedForDisplay(m.content.trim()) : ''
  if (base) return base
  const fromAttach = (m.attachments || [])
    .map((a) => a.textContent?.trim())
    .filter(Boolean)
    .join(' ')
  return fromAttach
}

/** 取磁盘消息里的首轮 user 文本与首轮 assistant 文本（均排除 system/tool）。
 *  跳过空 user 消息，取第一条有正文的 user；纯附件时尝试 attachments.textContent。 */
function firstUserAndAssistant(messages: AgentMessage[]): { userQuery: string; assistantReply: string } {
  let userQuery = ''
  let assistantReply = ''
  for (const m of messages) {
    if (m.role === 'system' || m.role === 'tool') continue
    if (!userQuery && m.role === 'user') {
      const text = userTextFromMessage(m)
      if (text) userQuery = text
    }
    if (!assistantReply && m.role === 'assistant') {
      assistantReply = typeof m.content === 'string' ? m.content.slice(0, 2000) : ''
    }
    if (userQuery && assistantReply) break
  }
  return { userQuery, assistantReply }
}

/** 打开会话或批量校验时调用：若标题与实际首轮 query 脱节，用 LLM 重总结；
 *  LLM 失败/超时/返回空时降级为首轮 query 前 40 字，绝不保留 agent.md 这类脱节标题。
 *  用户手动命名（titleAuto === false）永不覆盖。 */
function reconcileSessionTitleIfNeeded(
  set: (partial: Partial<TaskState> | ((s: TaskState) => Partial<TaskState>)) => void,
  get: () => TaskState,
  sessionId: string,
  messages: AgentMessage[]
): void {
  if (!sessionId) return
  const sess = get().sessions.find((s) => s.id === sessionId)
  if (!sess) return
  if (sess.titleAuto === false) return // 用户已手动命名
  const { userQuery, assistantReply } = firstUserAndAssistant(messages)
  const suspect = titleLooksSuspect(sess.title)
  // 纯附件首轮且正文已清空（如 agent.md 被移除）：仍可用助手回复修复脱节标题
  const effectiveQuery = userQuery || (suspect && assistantReply ? assistantReply.slice(0, 500) : '')
  if (!effectiveQuery) return
  if (!titleNeedsReconcile(sess.title, userQuery || effectiveQuery)) return
  const fallbackTitle = (userQuery || assistantReply).slice(0, 40) || '新对话'
  void api.summarizeTitle({ userQuery: userQuery || effectiveQuery, assistantReply }).then((res) => {
    const gs = get()
    const cur = gs.sessions.find((s) => s.id === sessionId)
    if (!cur || cur.titleAuto === false) return
    const newTitle = res.success && res.title ? res.title : fallbackTitle
    if (cur.title === newTitle) return
    const next = gs.sessions.map((s) =>
      s.id === sessionId ? { ...s, title: newTitle, titleAuto: true, updatedAt: Date.now() } : s
    )
    saveSessionsToStorage(next)
    set(gs.activeSessionId === sessionId ? { sessions: next, goal: newTitle } : { sessions: next })
  }).catch(() => {
    // LLM 调用本身失败：降级为截取，仍要修复脱节标题
    const gs = get()
    const cur = gs.sessions.find((s) => s.id === sessionId)
    if (!cur || cur.titleAuto === false || cur.title === fallbackTitle) return
    const next = gs.sessions.map((s) =>
      s.id === sessionId ? { ...s, title: fallbackTitle, titleAuto: true, updatedAt: Date.now() } : s
    )
    saveSessionsToStorage(next)
    set(gs.activeSessionId === sessionId ? { sessions: next, goal: fallbackTitle } : { sessions: next })
  })
}

function pushHistory(
  set: (partial: Partial<TaskState> | ((s: TaskState) => Partial<TaskState>)) => void,
  get: () => TaskState
) {
  const s = get()
  if (!s.startedAt) return
  const entry: HistoryEntry = {
    id: s.taskId || `t-${Date.now()}`,
    title: s.goal || s.message.slice(0, 40),
    mode: s.mode,
    status: s.status,
    finishedAt: s.finishedAt || Date.now(),
    stepCount: s.turns.length,
    tokens: s.usage.inputTokens + s.usage.outputTokens
  }
  const next = [entry, ...s.history.filter((h) => h.id !== entry.id)].slice(0, HISTORY_MAX)
  saveHistoryToStorage(next)

  // 同步写入会话列表：若该任务已有会话则更新，否则新建一条归到当前项目
  const existing = s.sessions.find((sess) => sess.id === entry.id)
  const now = Date.now()
  const isActive = s.activeSessionId === entry.id
  let nextSessions: Session[]
  if (existing) {
    nextSessions = s.sessions.map((sess) =>
      sess.id === entry.id
        ? {
            ...sess,
            title: entry.title,
            status: entry.status,
            updatedAt: now,
            stepCount: entry.stepCount,
            tokens: entry.tokens,
            startedAt: s.startedAt ?? sess.startedAt,
            finishedAt: entry.finishedAt,
            durationMs: s.startedAt ? entry.finishedAt - s.startedAt : sess.durationMs,
            // 前台看完：清未读；后台完成：bump lastMessageAt 触发未读
            lastMessageAt: isActive ? sess.lastMessageAt : now,
            lastReadAt: isActive ? now : sess.lastReadAt,
            unread: isActive ? false : (sess.unread ?? false)
          }
        : sess
    )
  } else {
    const newSession: Session = {
      id: entry.id,
      title: entry.title,
      mode: entry.mode,
      status: entry.status,
      projectId: s.activeProjectId,
      createdAt: entry.finishedAt,
      updatedAt: entry.finishedAt,
      stepCount: entry.stepCount,
      tokens: entry.tokens,
      pinned: false,
      archived: false,
      order: 0,
      startedAt: s.startedAt,
      finishedAt: entry.finishedAt,
      durationMs: s.startedAt ? entry.finishedAt - s.startedAt : undefined,
      lastReadAt: isActive ? entry.finishedAt : undefined,
      lastMessageAt: isActive ? undefined : entry.finishedAt,
      unread: false
    }
    nextSessions = prependSession(s.sessions, newSession)
  }
  saveSessionsToStorage(nextSessions)
  set({ history: next, sessions: nextSessions })
}
