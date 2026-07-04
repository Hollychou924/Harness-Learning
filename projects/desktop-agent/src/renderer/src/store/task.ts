import { create } from 'zustand'
import { api } from '../api'
import { useSettingsStore } from '../components/settings/settingsStore'
import type { StdoutMessage, AgentMessage } from '../../../agent/src/protocol'
import type { Turn } from '../../../agent/src/items'
import { reduceTurnsEvent, getFinalAnswerOfTurn, deriveAgentMessages, type TurnsReducerState } from './turns'

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

export interface QuestionRequest {
  requestId: string
  question: string
  detail?: string
  options: QuestionOption[]
  multiple: boolean
  allowCustom: boolean
  allowSkip: boolean
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

export interface Attachment {
  id: string
  name: string
  type: 'image' | 'text' | 'file'
  size: number
  dataUrl?: string
  textContent?: string
  mime: string
  /** 大图用 Object URL 替代 dataURL，减少内存占用 */
  objectUrl?: string
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
  todos: TodoItem[]
  subtasks: SubtaskEntry[]
  attachments: Attachment[]
  setAttachments: (a: Attachment[]) => void
  setMode: (m: 'work' | 'code') => void
  setMessage: (s: string) => void
  setGoal: (s: string) => void
  startTask: () => Promise<void>
  continueSession: (sessionId: string) => Promise<void>
  cancelTask: () => Promise<void>
  appendInput: (text: string) => Promise<void>
  respondApproval: (approved: boolean, scope?: 'once' | 'task' | 'always') => Promise<void>
  respondQuestion: (selectedOptionIds?: string[], customAnswer?: string, skipped?: boolean) => Promise<void>
  respondPlan: (decision: 'approve' | 'reject_stop' | 'reject_revise', feedback?: string) => Promise<void>
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
}

// 各模式的状态快照，切换 Work/Code 时保存/恢复
const modeSnapshots = new Map<'work' | 'code', Omit<Partial<TaskState>, 'mode'>>()

const HISTORY_KEY = 'xld.history.v1'
const HISTORY_MAX = 20
const PROJECTS_KEY = 'xld.projects.v1'
const SESSIONS_KEY = 'xld.sessions.v1'
const ACTIVE_PROJECT_KEY = 'xld.activeProject.v1'

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
      if (Array.isArray(arr)) return arr
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
    order: i
  }))
}

function saveSessionsToStorage(s: Session[]) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
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
  todos: [] as TodoItem[],
  subtasks: [] as SubtaskEntry[],
  attachments: [] as Attachment[],
  messages: [] as AgentMessage[]
}

export const useTaskStore = create<TaskState>((set, get) => ({
  ...initial,
  history: loadHistoryFromStorage(),
  messages: [],
  runningTasks: {},
  projects: loadProjectsFromStorage(),
  sessions: loadSessionsFromStorage(),
  activeProjectId: loadActiveProject(),
  activeSessionId: null,
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
            approvalPending: s.approvalPending, pendingPlan: s.pendingPlan, pendingQuestion: s.pendingQuestion, todos: s.todos, subtasks: s.subtasks
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
      set({ ...initial, messages: [], mode: m, runningTasks: get().runningTasks, history: cur.history, projects: cur.projects, sessions: cur.sessions, activeProjectId: cur.activeProjectId, activeSessionId: cur.activeSessionId })
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
    set({ projects: next, activeProjectId: project.id, activeSessionId: null, ...initial })
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
    saveProjectsToStorage(nextProjects)
    saveSessionsToStorage(nextSessions)
    removedSessions.forEach((s) => void api.deleteSessionMessages(s.id))
    const active = get().activeProjectId === id ? DEFAULT_PROJECT_ID : get().activeProjectId
    saveActiveProject(active)
    set({ projects: nextProjects, sessions: nextSessions, activeProjectId: active })
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
      order: 0
    }
    const next = [session, ...get().sessions]
    saveSessionsToStorage(next)
    set({ sessions: next, activeSessionId: session.id })
    return session.id
  },
  renameSession: (id, title) => {
    const next = get().sessions.map((s) =>
      s.id === id ? { ...s, title: title.trim() || s.title, updatedAt: Date.now() } : s
    )
    saveSessionsToStorage(next)
    set({ sessions: next })
  },
  deleteSession: (id) => {
    const next = get().sessions.filter((s) => s.id !== id)
    saveSessionsToStorage(next)
    void api.deleteSessionMessages(id)
    set({ sessions: next, activeSessionId: get().activeSessionId === id ? null : get().activeSessionId })
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
  reset: () => {
    // 释放附件的 Object URL，防止内存泄漏
    for (const a of get().attachments) { if (a.objectUrl) URL.revokeObjectURL(a.objectUrl) }
    set({ ...initial, history: get().history, projects: get().projects, sessions: get().sessions, activeProjectId: get().activeProjectId, activeSessionId: get().activeSessionId, mode: get().mode, approvalPending: null, pendingPlan: null, pendingQuestion: null, todos: [], subtasks: [], attachments: [] })
  },
  cancelTask: async () => {
    const { taskId } = get()
    if (taskId) await api.cancelTask(taskId)
    const rt = { ...get().runningTasks }
    if (taskId) delete rt[taskId]
    set({ status: 'idle', finishedAt: Date.now(), runningTasks: rt })
  },
  appendInput: async (text: string, mode?: 'inject' | 'queue') => {
    const { taskId } = get()
    if (taskId && text.trim()) {
      await api.appendInput(taskId, text, mode)
      set({ message: '', attachments: [] })
    }
  },
  respondApproval: async (approved: boolean, scope: 'once' | 'task' | 'always' = 'once') => {
    const { approvalPending } = get()
    if (approvalPending) {
      await api.sendApproval(approvalPending.requestId, approved, scope)
      set({ approvalPending: null })
    }
  },
  respondQuestion: async (selectedOptionIds?: string[], customAnswer?: string, skipped?: boolean) => {
    const { pendingQuestion } = get()
    if (pendingQuestion) {
      await api.sendQuestionResponse(pendingQuestion.requestId, selectedOptionIds, customAnswer, skipped)
      set({ pendingQuestion: null })
    }
  },
  respondPlan: async (decision: 'approve' | 'reject_stop' | 'reject_revise', feedback?: string) => {
    const { pendingPlan } = get()
    if (pendingPlan) {
      await api.sendPlanResponse(pendingPlan.requestId, decision, feedback)
      set({ pendingPlan: null })
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
        approvalPending: null, pendingPlan: null, pendingQuestion: null, todos: [], subtasks: []
      }

      if (isTurnItemEvent(msg)) {
        const reduced = reduceTurnsEvent({ turns: base.turns, currentTurn: base.currentTurn }, msg)
        const patch: Partial<TaskRuntime> = { turns: reduced.turns, currentTurn: reduced.currentTurn, status: 'executing' }
        set((st) => ({ runningTasks: { ...st.runningTasks, [evTaskId as string]: { ...base, ...patch } } }))
        return
      }

      let patch: Partial<TaskRuntime> = {}
      switch (msg.type) {
        case 'artifact': patch = { artifacts: [...base.artifacts, { type: msg.artifact_type, filePath: msg.file_path }] }; break
        case 'usage': patch = { usage: { inputTokens: base.usage.inputTokens + msg.inputTokens, outputTokens: base.usage.outputTokens + msg.outputTokens } }; break
        case 'error': patch = { error: msg.message, status: 'failed', finishedAt: Date.now() }; break
        case 'approval_request': patch = { approvalPending: { requestId: msg.request_id, toolName: msg.tool_name, args: msg.args, riskLevel: msg.risk_level, impact: msg.impact, canRollback: msg.can_rollback } }; break
        case 'plan_proposed': patch = { pendingPlan: { requestId: msg.request_id, plan: msg.plan, steps: msg.steps } }; break
        case 'question_proposed': patch = { pendingQuestion: { requestId: msg.request_id, question: msg.question, detail: msg.detail, options: msg.options, multiple: msg.multiple, allowCustom: msg.allow_custom, allowSkip: msg.allow_skip } }; break
        case 'todo_update': patch = { todos: msg.todos }; break
        case 'completed': {
          // 后台任务完成：累积轮次落盘，但不更新全局展示
          const assistantText = getFinalAnswerOfTurn(base.currentTurn) || msg.summary || ''
          const finishedTurns = base.turns
          void api.loadSessionMessages(evTaskId as string).then((stored) => {
            const msgs = (stored as AgentMessage[]) || []
            const derivedTail = deriveAgentMessages(finishedTurns)
            const nextMessages = [...msgs, ...derivedTail]
            void api.saveSessionMessages(evTaskId as string, nextMessages)
            void api.saveSessionTurns(evTaskId as string, finishedTurns)
            // 更新会话列表标题/状态
            const gs = get()
            const sess = gs.sessions.find((x) => x.id === evTaskId)
            if (sess) {
              const nextSessions = gs.sessions.map((x) => x.id === evTaskId ? { ...x, status: 'completed' as TaskStatus, updatedAt: Date.now(), stepCount: finishedTurns.length, tokens: base.usage.inputTokens + base.usage.outputTokens, title: assistantText.slice(0, 40) || x.title } : x)
              saveSessionsToStorage(nextSessions)
              set({ sessions: nextSessions })
            }
          })
          const rtAfter = { ...get().runningTasks }
          delete rtAfter[evTaskId as string]
          set({ runningTasks: rtAfter })
          return
        }
        default: break
      }
      set((st) => ({ runningTasks: { ...st.runningTasks, [evTaskId as string]: { ...base, ...patch } } }))
      return
    }

    // 可见任务：走原有逻辑更新全局展示，同时同步到 runningTasks
    const syncRT = (extra?: Partial<TaskRuntime>) => {
      const st = get()
      const old: TaskRuntime = st.runningTasks[evTaskId] || { status: 'executing', turns: [], currentTurn: null, summary: '', artifacts: [], usage: { inputTokens: 0, outputTokens: 0 }, error: null, startedAt: Date.now(), finishedAt: null, approvalPending: null, pendingPlan: null, pendingQuestion: null, todos: [], subtasks: [] }
      set({ runningTasks: { ...st.runningTasks, [evTaskId]: { ...old, status: st.status, turns: st.turns, currentTurn: st.currentTurn, summary: st.summary, artifacts: st.artifacts, usage: st.usage, error: st.error, startedAt: st.startedAt, finishedAt: st.finishedAt, approvalPending: st.approvalPending, pendingPlan: st.pendingPlan, pendingQuestion: st.pendingQuestion, todos: st.todos, subtasks: st.subtasks, ...extra } } })
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
        set({ error: msg.message, status: 'failed', finishedAt: Date.now() })
        { const rt = { ...get().runningTasks }; delete rt[evTaskId]; set({ runningTasks: rt }) }
        break
      case 'completed': {
        const cur2 = get()
        const assistantText = getFinalAnswerOfTurn(cur2.currentTurn) || msg.summary || ''
        const derivedTail = deriveAgentMessages(cur2.turns)
        const nextMessages = [...cur2.messages, ...derivedTail]
        set({ status: 'completed', summary: msg.summary, finishedAt: Date.now(), messages: nextMessages })
        pushHistory(set, get)
        if (evTaskId) {
          void api.saveSessionMessages(evTaskId, nextMessages)
          void api.saveSessionTurns(evTaskId, get().turns)
        }
        { const rt = { ...get().runningTasks }; delete rt[evTaskId]; set({ runningTasks: rt }) }
        break
      }
      case 'approval_request':
        set({ approvalPending: { requestId: msg.request_id, toolName: msg.tool_name, args: msg.args, riskLevel: msg.risk_level, impact: msg.impact, canRollback: msg.can_rollback } })
        syncRT()
        break
      case 'plan_proposed':
        set({ pendingPlan: { requestId: msg.request_id, plan: msg.plan, steps: msg.steps } })
        syncRT()
        break
      case 'question_proposed':
        set({ pendingQuestion: { requestId: msg.request_id, question: msg.question, detail: msg.detail, options: msg.options, multiple: msg.multiple, allowCustom: msg.allow_custom, allowSkip: msg.allow_skip } })
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

  startTask: async () => {
    const { mode, message, goal, activeSessionId, messages, attachments } = get()
    if (!message.trim()) return
    // 继续已有对话：用原 sessionId + 全量历史；新建对话：无 sessionId 无 history
    const isContinue = Boolean(activeSessionId && messages.length > 0)
    const sessionId = isContinue ? (activeSessionId as string) : undefined
    // 历史只取 user/assistant/tool（不含 system，agent 会自己加 system prompt）
    const history = isContinue ? messages.filter((m) => m.role !== 'system') : undefined
    // 把本轮用户消息加入消息流
    const userMsg: AgentMessage = { role: 'user', content: message }
    set({
      status: 'executing',
      turns: isContinue ? get().turns : [],
      currentTurn: null,
      summary: '',
      artifacts: [],
      error: null,
      approvalPending: null,
      pendingPlan: null,
      pendingQuestion: null,
      todos: [],
      subtasks: [],
      attachments: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      startedAt: Date.now(),
      finishedAt: null,
      goal: goal || message,
      message: '',
      messages: [...messages, userMsg]
    })
    // 注册到隔离存储，切走后事件继续写入对应任务
    set((st) => ({ runningTasks: { ...st.runningTasks, [get().taskId as string]: { status: 'executing', turns: get().turns, currentTurn: null, summary: '', artifacts: [], usage: { inputTokens: 0, outputTokens: 0 }, error: null, startedAt: Date.now(), finishedAt: null, approvalPending: null, pendingPlan: null, pendingQuestion: null, todos: [], subtasks: [] } } }))
    const settingsState = useSettingsStore.getState()
    // 发送前把 objectUrl 图片转成 dataUrl(agent 子进程需要 base64)
    const sendAttachments = await Promise.all(attachments.map(async (a) => {
      if (a.objectUrl && !a.dataUrl && a.type === 'image') {
        try {
          const resp = await fetch(a.objectUrl)
          const blob = await resp.blob()
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          return { ...a, dataUrl }
        } catch { return a }
      }
      return a
    }))

    // 释放附件 Object URL
    for (const a of attachments) { if (a.objectUrl) URL.revokeObjectURL(a.objectUrl) }

    // 取当前项目绑定的文件夹作为工作区目录；无绑定则走主进程默认产出目录
    const curProject = get().projects.find((p) => p.id === get().activeProjectId)
    const workspaceDir = curProject?.folderPath || undefined
    const res = await api.startTask({ mode, message, workspaceDir, maxIterations: settingsState.maxIterations, autoApproveLow: settingsState.autoApproveLow, sessionId, history, attachments: sendAttachments })
    if (res.error) {
      set({ status: 'failed', error: res.error })
    } else {
      set({ taskId: res.taskId, activeSessionId: res.taskId })
      // 新对话立刻落盘用户消息，防止丢失
      if (!isContinue) {
        void api.saveSessionMessages(res.taskId, [{ role: 'user', content: message }])
      }
    }
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
            approvalPending: s.approvalPending, pendingPlan: s.pendingPlan, pendingQuestion: s.pendingQuestion, todos: s.todos, subtasks: s.subtasks
          }
        }
      }))
    }
    // 切到目标：优先从 runningTasks 恢复运行时（任务还在跑），否则读盘恢复历史(消息+轮次)
    const rt = get().runningTasks[sessionId]
    const sess = get().sessions.find((s) => s.id === sessionId)
    if (rt && rt.status === 'executing') {
      set({ ...initial, ...rt, messages: cur.messages, mode: sess?.mode || cur.mode, activeSessionId: sessionId, activeProjectId: sess?.projectId || cur.activeProjectId, taskId: sessionId, goal: sess?.title || '', runningTasks: get().runningTasks, projects: get().projects, sessions: get().sessions, history: get().history })
    } else {
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
      set({ ...initial, status: sessStatus, messages: stored || [], turns: restoredTurns, mode: sess?.mode || cur.mode, activeSessionId: sessionId, activeProjectId: sess?.projectId || cur.activeProjectId, taskId: sessionId, goal: sess?.title || '', usage: { inputTokens: sessTokens, outputTokens: 0 }, startedAt: sess?.startedAt ?? null, finishedAt: sess?.finishedAt ?? null, artifacts: deriveArtifactsFromTurns(restoredTurns), runningTasks: get().runningTasks, projects: get().projects, sessions: get().sessions, history: get().history })
    }
  }
}))

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
  let nextSessions: Session[]
  if (existing) {
    nextSessions = s.sessions.map((sess) =>
      sess.id === entry.id
        ? { ...sess, title: entry.title, status: entry.status, updatedAt: now, stepCount: entry.stepCount, tokens: entry.tokens, startedAt: s.startedAt ?? sess.startedAt, finishedAt: entry.finishedAt, durationMs: s.startedAt ? entry.finishedAt - s.startedAt : sess.durationMs }
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
      durationMs: s.startedAt ? entry.finishedAt - s.startedAt : undefined
    }
    nextSessions = [newSession, ...s.sessions]
  }
  saveSessionsToStorage(nextSessions)
  set({ history: next, sessions: nextSessions })
}
