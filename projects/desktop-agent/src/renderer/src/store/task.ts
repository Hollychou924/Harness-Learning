import { create } from 'zustand'
import { api } from '../api'
import { useSettingsStore } from '../components/settings/settingsStore'
import type { StdoutMessage, AgentMessage } from '../../../agent/src/protocol'

export type TaskStatus = 'idle' | 'executing' | 'completed' | 'failed'

export interface ToolLogEntry {
  name: string
  args: Record<string, unknown>
  result?: string
  id: string
}

export interface StepEntry {
  step: number
  total: number
  summary: string
  done: boolean
}

export interface ArtifactEntry {
  type: 'diff' | 'report' | 'file' | 'preview' | 'evidence' | 'task_summary'
  filePath: string
  added?: number
  removed?: number
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
}

export interface ApprovalRequest {
  requestId: string
  toolName: string
  args: Record<string, unknown>
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  impact: string
  canRollback: boolean
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

export interface TaskState {
  status: TaskStatus
  taskId: string | null
  mode: 'work' | 'code'
  message: string
  goal: string
  chunks: string
  summary: string
  thinking: string[]
  toolLogs: ToolLogEntry[]
  steps: StepEntry[]
  artifacts: ArtifactEntry[]
  usage: { inputTokens: number; outputTokens: number }
  error: string | null
  startedAt: number | null
  finishedAt: number | null
  history: HistoryEntry[]
  /** 当前对话的完整消息流（用于上下文恢复与全量传入） */
  messages: AgentMessage[]
  projects: Project[]
  sessions: Session[]
  activeProjectId: string
  activeSessionId: string | null
  approvalPending: ApprovalRequest | null
  pendingPlan: PendingPlan | null
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
  respondApproval: (approved: boolean) => Promise<void>
  respondPlan: (decision: 'approve' | 'reject_stop' | 'reject_revise', feedback?: string) => Promise<void>
  reset: () => void
  loadHistory: () => void
  deleteHistory: (id: string) => void
  // ---- 项目管理 ----
  createProject: (name: string, icon?: string) => string
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
  appendEvent: (msg: StdoutMessage) => void
}

// 各模式的状态快照，切换 Work/Code 时保存/恢复
const modeSnapshots = new Map<'work' | 'code', Partial<TaskState>>()

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
      if (Array.isArray(arr)) return arr
    }
  } catch {
    /* ignore */
  }
  const now = Date.now()
  return [{
    id: DEFAULT_PROJECT_ID,
    name: '默认项目',
    icon: '📁',
    createdAt: now,
    updatedAt: now,
    pinned: false,
    order: 0
  }]
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
  chunks: '',
  summary: '',
  thinking: [] as string[],
  toolLogs: [] as ToolLogEntry[],
  steps: [] as StepEntry[],
  artifacts: [] as ArtifactEntry[],
  usage: { inputTokens: 0, outputTokens: 0 },
  error: null as string | null,
  startedAt: null as number | null,
  finishedAt: null as number | null,
  approvalPending: null as ApprovalRequest | null,
  pendingPlan: null as PendingPlan | null,
  todos: [] as TodoItem[],
  subtasks: [] as SubtaskEntry[],
  attachments: [] as Attachment[],
  messages: [] as AgentMessage[]
}

export const useTaskStore = create<TaskState>((set, get) => ({
  ...initial,
  history: loadHistoryFromStorage(),
  messages: [],
  projects: loadProjectsFromStorage(),
  sessions: loadSessionsFromStorage(),
  activeProjectId: loadActiveProject(),
  activeSessionId: null,
  setMode: (m) => {
    const cur = get()
    if (cur.mode === m) return
    // 保存当前模式状态
    modeSnapshots.set(cur.mode, {
      status: cur.status, taskId: cur.taskId, message: cur.message, goal: cur.goal,
      chunks: cur.chunks, summary: cur.summary, thinking: cur.thinking, toolLogs: cur.toolLogs,
      steps: cur.steps, artifacts: cur.artifacts, usage: cur.usage, error: cur.error,
      startedAt: cur.startedAt, finishedAt: cur.finishedAt, todos: cur.todos,
      subtasks: cur.subtasks, attachments: cur.attachments,
      approvalPending: null, pendingPlan: null
    })
    // 恢复目标模式状态
    const snap = modeSnapshots.get(m)
    if (snap) {
      set({ mode: m, ...snap })
    } else {
      set({ mode: m, ...initial, history: cur.history, projects: cur.projects, sessions: cur.sessions, activeProjectId: cur.activeProjectId, activeSessionId: cur.activeSessionId })
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
  createProject: (name, icon = '📁') => {
    const now = Date.now()
    const project: Project = {
      id: uid('proj'),
      name: name.trim() || '新项目',
      icon,
      createdAt: now,
      updatedAt: now,
      pinned: false,
      order: get().projects.length
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
  reset: () => set({ ...initial, history: get().history, projects: get().projects, sessions: get().sessions, activeProjectId: get().activeProjectId, activeSessionId: get().activeSessionId, mode: get().mode, approvalPending: null, pendingPlan: null, todos: [], subtasks: [], attachments: [] }),
  cancelTask: async () => {
    const { taskId } = get()
    if (taskId) await api.cancelTask(taskId)
    set({ status: 'idle', finishedAt: Date.now() })
  },
  appendInput: async (text: string, mode?: 'inject' | 'queue') => {
    const { taskId } = get()
    if (taskId && text.trim()) {
      await api.appendInput(taskId, text, mode)
      set({ message: '', attachments: [] })
    }
  },
  respondApproval: async (approved: boolean) => {
    const { approvalPending } = get()
    if (approvalPending) {
      await api.sendApproval(approvalPending.requestId, approved)
      set({ approvalPending: null })
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
    switch (msg.type) {
      case 'chunk':
        set((s) => ({ chunks: s.chunks + msg.text, status: 'executing' }))
        break
      case 'thinking':
        set((s) => ({ thinking: [...s.thinking, msg.text], status: 'executing' }))
        break
      case 'tool_call':
        set((s) => ({
          toolLogs: [...s.toolLogs, { name: msg.name, args: msg.args, id: msg.id }],
          status: 'executing'
        }))
        break
      case 'tool_result':
        set((s) => ({
          toolLogs: s.toolLogs.map((t) =>
            t.id === msg.id && !t.result ? { ...t, result: msg.result } : t
          )
        }))
        break
      case 'step_progress':
        set((s) => {
          const existing = s.steps.findIndex((e) => e.step === msg.step && e.total === msg.total)
          const next = [...s.steps]
          if (existing >= 0) {
            next[existing] = { ...next[existing], summary: msg.summary, done: true }
          } else {
            next.push({ step: msg.step, total: msg.total, summary: msg.summary, done: true })
            // 补齐前面未显式完成的步骤为已完成态，避免 checklist 卡住
            for (let i = 1; i < msg.step; i++) {
              if (!next.find((e) => e.step === i)) {
                next.push({ step: i, total: msg.total, summary: '', done: true })
              }
            }
          }
          return { steps: next.sort((a, b) => a.step - b.step) }
        })
        break
      case 'artifact':
        set((s) => ({
          artifacts: [...s.artifacts, { type: msg.artifact_type, filePath: msg.file_path }]
        }))
        break
      case 'usage':
        set((s) => ({
          usage: {
            inputTokens: s.usage.inputTokens + msg.inputTokens,
            outputTokens: s.usage.outputTokens + msg.outputTokens
          }
        }))
        break
      case 'error':
        set({ error: msg.message, status: 'failed', finishedAt: Date.now() })
        break
      case 'completed': {
        // 把本轮 assistant 回复 + 工具调用累积进 messages，并落盘（实现"像没离开过一样"的上下文恢复）
        const cur = get()
        const assistantText = cur.chunks || msg.summary || ''
        const toolLogs = cur.toolLogs
        let nextMessages = [...cur.messages]
        if (toolLogs.length > 0) {
          // 有工具调用：assistant 消息带 tool_calls，每个工具结果单独一条 tool 消息
          const toolCalls = toolLogs.map((t) => ({
            id: t.id,
            type: 'function' as const,
            function: { name: t.name, arguments: JSON.stringify(t.args) }
          }))
          nextMessages.push({ role: 'assistant', content: assistantText, tool_calls: toolCalls })
          for (const t of toolLogs) {
            nextMessages.push({ role: 'tool', tool_call_id: t.id, content: t.result || '{}' })
          }
        } else if (assistantText) {
          // 纯文本回复
          nextMessages.push({ role: 'assistant', content: assistantText })
        }
        set({ status: 'completed', summary: msg.summary, finishedAt: Date.now(), messages: nextMessages })
        pushHistory(set, get)
        // 全量落盘，下次继续对话时完整恢复
        if (cur.taskId) {
          void api.saveSessionMessages(cur.taskId, nextMessages)
        }
        break
      }
      case 'approval_request':
        set({
          approvalPending: {
            requestId: msg.request_id,
            toolName: msg.tool_name,
            args: msg.args,
            riskLevel: msg.risk_level,
            impact: msg.impact,
            canRollback: msg.can_rollback
          }
        })
        break
      case 'plan_proposed':
        set({
          pendingPlan: {
            requestId: msg.request_id,
            plan: msg.plan,
            steps: msg.steps
          }
        })
        break
      case 'todo_update':
        set({ todos: msg.todos })
        break
      case 'subtask_started':
        set((s) => ({
          subtasks: [...s.subtasks, {
            id: msg.subtask_id,
            title: msg.title,
            status: 'running'
          }]
        }))
        break
      case 'subtask_completed':
        set((s) => ({
          subtasks: s.subtasks.map((st) =>
            st.id === msg.subtask_id
              ? { ...st, status: 'completed', durationMs: msg.duration_ms, toolCount: msg.tool_count, tokens: msg.tokens }
              : st
          )
        }))
        break
      case 'subtask_failed':
        set((s) => ({
          subtasks: s.subtasks.map((st) =>
            st.id === msg.subtask_id
              ? { ...st, status: 'failed', error: msg.error }
              : st
          )
        }))
        break
      case 'status':
        if (msg.status === 'EXECUTING') set({ status: 'executing' })
        if (msg.status === 'PAUSED') set({ status: 'idle' })
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
      chunks: '',
      summary: '',
      thinking: [],
      toolLogs: [],
      steps: [],
      artifacts: [],
      error: null,
      approvalPending: null,
      pendingPlan: null,
      todos: [],
      subtasks: [],
      attachments: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      startedAt: Date.now(),
      finishedAt: null,
      goal: goal || message,
      messages: [...messages, userMsg]
    })
    const settingsState = useSettingsStore.getState()
    const res = await api.startTask({ mode, message, maxIterations: settingsState.maxIterations, autoApproveLow: settingsState.autoApproveLow, sessionId, history, attachments })
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
    // 从磁盘恢复该会话的完整消息流，让界面"像没离开过一样"
    const stored = (await api.loadSessionMessages(sessionId)) as AgentMessage[]
    const sess = get().sessions.find((s) => s.id === sessionId)
    set({
      ...initial,
      messages: stored || [],
      mode: sess?.mode || get().mode,
      activeSessionId: sessionId,
      activeProjectId: sess?.projectId || get().activeProjectId,
      taskId: sessionId,
      goal: sess?.title || '',
      projects: get().projects,
      sessions: get().sessions,
      history: get().history
    })
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
    stepCount: s.steps.length,
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
        ? { ...sess, title: entry.title, status: entry.status, updatedAt: now, stepCount: entry.stepCount, tokens: entry.tokens }
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
      order: 0
    }
    nextSessions = [newSession, ...s.sessions]
  }
  saveSessionsToStorage(nextSessions)
  set({ history: next, sessions: nextSessions })
}

// ============================================================
// 合并逻辑 + Turn 分段（纯计算 selector，不改 store 数据结构）
// ============================================================

/** 合并后的工具日志分组：连续同类工具合并为一条 */
export interface MergedToolGroup {
  id: string
  name: string
  count: number
  entries: ToolLogEntry[]
  firstEntry: ToolLogEntry
  lastEntry: ToolLogEntry
  allDone: boolean
  anyError: boolean
}

/** 连续同类工具调用合并 */
export function getMergedToolLogs(toolLogs: ToolLogEntry[]): MergedToolGroup[] {
  const groups: MergedToolGroup[] = []
  for (const entry of toolLogs) {
    const last = groups[groups.length - 1]
    if (last && last.name === entry.name && last.allDone) {
      last.count++
      last.entries.push(entry)
      last.lastEntry = entry
      last.allDone = last.entries.every((e) => e.result)
      last.anyError = last.anyError || Boolean(entry.result?.includes('"error"'))
    } else {
      groups.push({
        id: entry.id,
        name: entry.name,
        count: 1,
        entries: [entry],
        firstEntry: entry,
        lastEntry: entry,
        allDone: Boolean(entry.result),
        anyError: Boolean(entry.result?.includes('"error"'))
      })
    }
  }
  return groups
}

/** 文件变更按路径合并 */
export interface MergedFileChange {
  path: string
  name: string
  totalLines: number
  entries: ToolLogEntry[]
}

export function getMergedFileChanges(toolLogs: ToolLogEntry[]): MergedFileChange[] {
  const writes = toolLogs.filter((t) => t.name === 'write_file' && t.result && !t.result.includes('"error"'))
  const byPath = new Map<string, MergedFileChange>()
  for (const entry of writes) {
    const rawPath = typeof entry.args.path === 'string' ? entry.args.path : ''
    const normalized = rawPath.replace(/\\/g, '/').replace(/\/+$/, '')
    const content = typeof entry.args.content === 'string' ? entry.args.content : ''
    const lines = content === '' ? 0 : content.split('\n').length
    const existing = byPath.get(normalized)
    if (existing) {
      existing.totalLines += lines
      existing.entries.push(entry)
    } else {
      byPath.set(normalized, {
        path: rawPath,
        name: normalized.split('/').pop() || normalized || '未命名',
        totalLines: lines,
        entries: [entry]
      })
    }
  }
  return Array.from(byPath.values())
}

/** Turn 三段拆分 */
export interface TurnSections {
  processBlocks: MergedToolGroup[]
  finalAnswer: string
  fileChanges: MergedFileChange[]
}

export function getTurnSections(state: {
  thinking: string[]
  chunks: string
  toolLogs: ToolLogEntry[]
  status: TaskStatus
}): TurnSections {
  const merged = getMergedToolLogs(state.toolLogs)
  const fileChanges = getMergedFileChanges(state.toolLogs)
  const finalAnswer = state.status === 'completed' ? state.chunks : ''
  return {
    processBlocks: merged,
    finalAnswer,
    fileChanges
  }
}
