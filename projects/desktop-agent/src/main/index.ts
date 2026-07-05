import { app, BrowserWindow, ipcMain, shell, nativeTheme, dialog } from 'electron'
import { isAbsolute, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { readdir as readdirAsync, stat as statAsync } from 'node:fs/promises'
import { agentBridge } from './agent-bridge.js'
import { startTrace, logAgentEvent, logUserAction, listTraces, getTrace, exportTracePackage, createFeedbackTicket, listFeedbackTickets, getDiagnosticsOverview, getReplayBundle, exportReplayPackage } from './trace-logger.js'
import type { StdoutMessage, AgentConfig, MessageAttachment } from '../agent/src/protocol.js'
import { getModelThinkingConfig } from '../renderer/src/components/providerPresets.js'
import {
  resolveModelConfigForSave,
  sanitizeModelConfigForRenderer,
  sanitizeModelConfigStoreForRenderer,
  validateModelConfig,
  type ModelConfig,
  type ModelConfigStore
} from './model-config.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

function getConfigPath(): string {
  return join(app.getPath('userData'), 'model-config.json')
}

// 会话消息持久化目录：~/Library/Application Support/小蓝鲸/sessions/<id>.json
function getSessionsDir(): string {
  return join(app.getPath('userData'), 'sessions')
}

function getSessionPath(sessionId: string): string {
  return join(getSessionsDir(), `${sessionId}.json`)
}

function getSessionTurnsPath(sessionId: string): string {
  return join(getSessionsDir(), `${sessionId}.turns.json`)
}

function loadConfig(): ModelConfig | null {
  try {
    const p = getConfigPath()
    if (!existsSync(p)) return null
    const raw = readFileSync(p, 'utf-8')
    return JSON.parse(raw) as ModelConfig
  } catch {
    return null
  }
}

function saveConfigFile(cfg: ModelConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf-8')
}

// ── 多模型并存存储 ──────────────────────────────────────────────
// 存储"已配置模型列表" + 当前激活 id，为输入框快速切换和会话级绑定留基础
function getModelsStorePath(): string {
  return join(app.getPath('userData'), 'model-configs.json')
}

function generateModelId(cfg: ModelConfig): string {
  const sub = cfg.customProviderId ? `-${cfg.customProviderId}` : ''
  return `${cfg.providerId}${sub}-${cfg.model}-${Date.now().toString(36)}`
}

function loadModelsStore(): ModelConfigStore {
  const storePath = getModelsStorePath()
  // 新文件存在 → 直接读
  if (existsSync(storePath)) {
    try {
      const raw = readFileSync(storePath, 'utf-8')
      return JSON.parse(raw) as ModelConfigStore
    } catch { /* 损坏则走迁移 */ }
  }
  // 迁移：旧的单配置文件 → 列表第一项
  const oldCfg = loadConfig()
  if (oldCfg && oldCfg.apiKey) {
    const migrated: ModelConfigStore = {
      configs: [{ ...oldCfg }],
      activeId: null
    }
    migrated.activeId = generateModelId(oldCfg)
    ;(migrated.configs[0] as ModelConfig & { _id?: string })._id = migrated.activeId
    saveModelsStore(migrated)
    return migrated
  }
  return { configs: [], activeId: null }
}

function saveModelsStore(store: ModelConfigStore): void {
  writeFileSync(getModelsStorePath(), JSON.stringify(store, null, 2), 'utf-8')
}

function getActiveModelConfig(): ModelConfig | null {
  const store = loadModelsStore()
  if (store.configs.length === 0) return loadConfig() // 兜底旧文件
  const active = store.configs.find((c) => (c as ModelConfig & { _id?: string })._id === store.activeId)
  return active || store.configs[0] || null
}

function buildAgentConfig(): AgentConfig {
  const saved = getActiveModelConfig() || loadConfig()
  if (saved && saved.apiKey && !validateModelConfig(saved)) {
    const isMify = saved.providerId === 'mify'
    const preset = getModelThinkingConfig(
      saved.providerId,
      saved.model,
      isMify,
      isMify ? saved.customProviderId : undefined
    )
    const supportsThinking = preset?.supportsThinking === true
    return {
      provider: saved.apiFormat === 'anthropic' ? 'anthropic' : 'openai',
      model: saved.model,
      apiKey: saved.apiKey,
      apiBaseUrl: saved.apiBaseUrl || undefined,
      maxIterations: Number(process.env.XLJ_MAX_ITER || 8),
      workspaceDir: process.env.XLJ_WORKSPACE || join(app.getPath('documents'), '小蓝鲸产出'),
      providerId: saved.providerId,
      apiFormat: saved.apiFormat,
      contextLimit: saved.contextLimit,
      customProviderId: saved.customProviderId,
      autoApproveLow: saved.autoApproveLow ?? false,
      thinkingLevel: supportsThinking ? 'auto' : 'off',
      thinkingConfig: supportsThinking ? preset!.thinkingConfig : undefined
    }
  }
  // 兜底：环境变量
  return {
    provider: 'anthropic' as const,
    model: process.env.XLJ_MODEL || 'claude-sonnet-4-5-20250929',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    apiBaseUrl: process.env.ANTHROPIC_BASE_URL || undefined,
    maxIterations: Number(process.env.XLJ_MAX_ITER || 8),
    workspaceDir: process.env.XLJ_WORKSPACE || join(app.getPath('documents'), '小蓝鲸产出'),
    autoApproveLow: false
  }
}

let mainWindow: BrowserWindow | null = null
let activeTaskId: string | null = null
let activeTraceId: string | null = null

function activeTraceForTask(taskId?: string): string | null {
  if (!activeTraceId) return null
  if (!taskId) return activeTraceId
  return activeTaskId === taskId ? activeTraceId : null
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1080,
    minHeight: 640,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 13 },
    // Mac 液态玻璃：原生 vibrancy + 透明背景
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 把 Agent 子进程消息转发给渲染进程，并注入 taskId（流式事件本身不带，补上以便前端按任务隔离）
  agentBridge.onMessage((msg: StdoutMessage) => {
    const taskId = activeTaskId
    const traceId = activeTraceId
    if (traceId) {
      logAgentEvent(traceId, msg)
      if (msg.type === 'completed' || msg.type === 'error' || (msg.type === 'turn_completed' && msg.status === 'cancelled')) {
        activeTaskId = null
        activeTraceId = null
      }
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 给所有事件补上 taskId，前端据此写入对应任务的隔离存储
      mainWindow.webContents.send('agent:event', { ...msg, taskId })
    }
  })
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // 开发期加载 vite dev server，生产期加载打包文件
if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'light'
  agentBridge.start()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  agentBridge.stop()
  if (process.platform !== 'darwin') app.quit()
})

// IPC 通道（依据 docs/09 第二章）
ipcMain.handle('agent:startTask', async (_e, args: { mode: 'work' | 'code'; message: string; workspaceDir?: string; maxIterations?: number; autoApproveLow?: boolean; sessionId?: string; history?: unknown[]; attachments?: unknown[] }) => {
  const sessionId = args.sessionId || randomUUID()
  const traceId = randomUUID()
  const savedConfig = getActiveModelConfig() || loadConfig()
  const configError = savedConfig ? validateModelConfig(savedConfig) : null
  if (configError) {
    return { taskId: sessionId, traceId, error: configError }
  }
  const config = buildAgentConfig()
  if (!config.apiKey) {
    return { taskId: sessionId, traceId, error: '未检测到模型访问配置，请在模型设置里重新选择或配置模型' }
  }
  if (args.maxIterations) config.maxIterations = args.maxIterations
  if (args.autoApproveLow !== undefined) config.autoApproveLow = args.autoApproveLow
  activeTaskId = sessionId
  activeTraceId = traceId
  startTrace(traceId, {
    taskId: sessionId,
    sessionId,
    conversationId: sessionId,
    runId: traceId,
    message: args.message,
    mode: args.mode,
    model: config.model,
    provider: config.provider,
    maxIterations: config.maxIterations,
    autoApproveLow: config.autoApproveLow ?? false,
    apiKey: config.apiKey,
    apiBaseUrl: config.apiBaseUrl,
    providerId: config.providerId,
    customProviderId: config.customProviderId,
    attachmentCount: Array.isArray(args.attachments) ? args.attachments.length : 0,
    historyCount: Array.isArray(args.history) ? args.history.length : 0
  })
  // 输出目录：优先用用户指定，否则用系统文档目录下的「小蓝鲸产出」
  const outputDir = args.workspaceDir || join(app.getPath('documents'), '小蓝鲸产出')
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  agentBridge.startTask(sessionId, args.message, config, outputDir, args.history, args.attachments as MessageAttachment[] | undefined)
  return { taskId: sessionId, traceId }
})

ipcMain.handle('config:get', async (_e, key: string) => {
  const cfg = getActiveModelConfig() || loadConfig()
  if (key === 'hasApiKey') {
    const active = getActiveModelConfig()
    return Boolean((active && !validateModelConfig(active)) || process.env.ANTHROPIC_API_KEY)
  }
  if (key === 'model') return cfg?.model || process.env.XLJ_MODEL || 'claude-sonnet-4-5-20250929'
  if (key === 'modelConfig') {
    const active = sanitizeModelConfigForRenderer(getActiveModelConfig())
    if (active) return active
    const legacy = sanitizeModelConfigForRenderer(loadConfig())
    if (legacy) return legacy
    const envKey = process.env.ANTHROPIC_API_KEY
    if (envKey) {
      return {
        providerId: 'anthropic',
        model: process.env.XLJ_MODEL || 'claude-sonnet-4-5-20250929',
        apiKey: '',
        hasSavedApiKey: true,
        apiBaseUrl: process.env.ANTHROPIC_BASE_URL || '',
        apiFormat: 'anthropic',
        contextLimit: 200000,
        autoApproveLow: false
      }
    }
    return null
  }
  if (key === 'contextLimit') return cfg?.contextLimit || 200000
  if (key === 'customProviderId') return cfg?.customProviderId || null
  if (key === 'autoApproveLow') return cfg?.autoApproveLow ?? false
  if (key === 'maxIterations') return (cfg as Record<string, unknown> | null)?.maxIterations ?? null
  return null
})

ipcMain.handle('config:saveModel', async (_e, cfg: ModelConfig) => {
  const store = loadModelsStore()
  const legacyConfig = loadConfig()
  const envConfig: ModelConfig | null = process.env.ANTHROPIC_API_KEY && cfg.providerId === 'anthropic'
    ? {
        providerId: 'anthropic',
        model: process.env.XLJ_MODEL || cfg.model,
        apiKey: process.env.ANTHROPIC_API_KEY,
        apiBaseUrl: process.env.ANTHROPIC_BASE_URL || '',
        apiFormat: 'anthropic',
        contextLimit: 200000,
        autoApproveLow: false
      }
    : null
  const resolvedCfg = resolveModelConfigForSave(cfg, [
    ...store.configs,
    ...(legacyConfig ? [legacyConfig] : []),
    ...(envConfig ? [envConfig] : [])
  ])
  const configError = validateModelConfig(resolvedCfg)
  if (configError) return { success: false, error: configError }
  // 同时写入旧单配置(兼容)和多模型存储
  saveConfigFile(resolvedCfg)
  const id = generateModelId(resolvedCfg)
  const newEntry = { ...resolvedCfg, _id: id } as ModelConfig & { _id: string }
  // 同 providerId+model 视为同一条，覆盖更新
  const idx = store.configs.findIndex((c) => c.providerId === resolvedCfg.providerId && c.model === resolvedCfg.model && c.customProviderId === resolvedCfg.customProviderId)
  if (idx >= 0) {
    newEntry._id = (store.configs[idx] as ModelConfig & { _id?: string })._id || id
    store.configs[idx] = newEntry
  } else {
    store.configs.push(newEntry)
  }
  store.activeId = newEntry._id
  saveModelsStore(store)
  return { success: true }
})

// 获取已配置模型列表
ipcMain.handle('config:getModelList', async () => {
  const store = loadModelsStore()
  return sanitizeModelConfigStoreForRenderer(store)
})

// 切换激活模型（输入框快速切换，不进设置页）
ipcMain.handle('config:setActiveModel', async (_e, modelId: string) => {
  const store = loadModelsStore()
  if (store.configs.some((c) => (c as ModelConfig & { _id?: string })._id === modelId)) {
    store.activeId = modelId
    saveModelsStore(store)
    const active = store.configs.find((c) => (c as ModelConfig & { _id?: string })._id === modelId)
    if (active) saveConfigFile(active) // 同步旧文件
    return { success: true }
  }
  return { success: false }
})

// 删除已配置模型
ipcMain.handle('config:deleteModel', async (_e, modelId: string) => {
  const store = loadModelsStore()
  store.configs = store.configs.filter((c) => (c as ModelConfig & { _id?: string })._id !== modelId)
  if (store.activeId === modelId) {
    store.activeId = store.configs[0] ? (store.configs[0] as ModelConfig & { _id?: string })._id || null : null
  }
  saveModelsStore(store)
  return { success: true }
})

ipcMain.handle('shell:openExternal', async (_e, url: string) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    await shell.openExternal(url)
  }
})

// 打开本地文件（Word/Excel 等生成产物）
ipcMain.handle('shell:openPath', async (_e, filePath: string) => {
  if (typeof filePath !== 'string' || !filePath) return
  await shell.openPath(filePath)
})

// 任务控制通道（依据 docs/09 第二章，转发为 stdin task_control）
ipcMain.handle('agent:pause', async (_e, args: { taskId: string }) => {
  const traceId = activeTraceForTask(args.taskId)
  if (traceId) logUserAction(traceId, 'task_paused', { taskId: args.taskId })
  agentBridge.send({ type: 'task_control', task_id: args.taskId, action: 'pause' })
})

ipcMain.handle('agent:resume', async (_e, args: { taskId: string }) => {
  const traceId = activeTraceForTask(args.taskId)
  if (traceId) logUserAction(traceId, 'task_resumed', { taskId: args.taskId })
  agentBridge.send({ type: 'task_control', task_id: args.taskId, action: 'resume' })
})

ipcMain.handle('agent:cancel', async (_e, args: { taskId: string }) => {
  const traceId = activeTraceForTask(args.taskId)
  if (traceId) logUserAction(traceId, 'task_cancelled', { taskId: args.taskId })
  // 先尝试优雅取消（发 task_control），再补发 stopped 状态让 UI 立即反映
  agentBridge.send({ type: 'task_control', task_id: args.taskId, action: 'cancel' })
  agentBridge.cancelAndNotify()
})

ipcMain.handle('agent:rollback', async (_e, args: { taskId: string }) => {
  const traceId = activeTraceForTask(args.taskId)
  if (traceId) logUserAction(traceId, 'task_rollback', { taskId: args.taskId })
  agentBridge.send({ type: 'task_control', task_id: args.taskId, action: 'rollback' })
  return { success: true }
})

// 权限审批通道（转发为 stdin approval_response）
ipcMain.handle('agent:approval', async (_e, args: { requestId: string; approved: boolean; scope?: 'once' | 'task' | 'always' }) => {
  const traceId = activeTraceForTask()
  if (traceId) logUserAction(traceId, 'approval_response', { requestId: args.requestId, approved: args.approved, scope: args.scope })
  agentBridge.send({ type: 'approval_response', request_id: args.requestId, approved: args.approved, scope: args.scope })
})

// 反问响应通道（转发为 stdin question_response）
ipcMain.handle('agent:questionResponse', async (_e, args: { requestId: string; selectedOptionIds?: string[]; customAnswer?: string; skipped?: boolean }) => {
  const traceId = activeTraceForTask()
  if (traceId) logUserAction(traceId, 'question_response', { requestId: args.requestId, selectedOptionIds: args.selectedOptionIds, customAnswer: args.customAnswer, skipped: args.skipped })
  agentBridge.send({ type: 'question_response', request_id: args.requestId, selected_option_ids: args.selectedOptionIds, custom_answer: args.customAnswer, skipped: args.skipped })
})

// 计划响应通道（转发为 stdin plan_response）
ipcMain.handle('agent:planResponse', async (_e, args: { requestId: string; decision: 'approve' | 'reject_stop' | 'reject_revise'; feedback?: string }) => {
  const traceId = activeTraceForTask()
  if (traceId) logUserAction(traceId, 'plan_response', { requestId: args.requestId, decision: args.decision, feedback: args.feedback })
  agentBridge.send({ type: 'plan_response', request_id: args.requestId, decision: args.decision, feedback: args.feedback })
})

// 追加指令通道（转发为 stdin append_input）
ipcMain.handle('agent:appendInput', async (_e, args: { taskId: string; message: string; mode?: 'inject' | 'queue' }) => {
  const traceId = activeTraceForTask(args.taskId)
  if (traceId) logUserAction(traceId, 'append_input', { taskId: args.taskId, message: args.message, mode: args.mode })
  agentBridge.send({ type: 'append_input', task_id: args.taskId, message: args.message, mode: args.mode })
})

// 会话消息持久化：保存 / 读取 / 删除
ipcMain.handle('session:saveMessages', async (_e, args: { sessionId: string; messages: unknown[] }) => {
  try {
    const dir = getSessionsDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(getSessionPath(args.sessionId), JSON.stringify(args.messages), 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
})

ipcMain.handle('session:loadMessages', async (_e, sessionId: string) => {
  try {
    const p = getSessionPath(sessionId)
    if (!existsSync(p)) return []
    const raw = readFileSync(p, 'utf-8')
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
})

ipcMain.handle('session:deleteMessages', async (_e, sessionId: string) => {
  try {
    const p = getSessionPath(sessionId)
    if (existsSync(p)) {
      const { unlinkSync } = await import('node:fs')
      unlinkSync(p)
    }
    const turnsPath = getSessionTurnsPath(sessionId)
    if (existsSync(turnsPath)) {
      const { unlinkSync } = await import('node:fs')
      unlinkSync(turnsPath)
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
})

// 轮次(Turn/Item)持久化：历史翻看每一步思考/工具调用细节靠这个，与 messages 分开存
ipcMain.handle('session:saveTurns', async (_e, args: { sessionId: string; turns: unknown[] }) => {
  try {
    const dir = getSessionsDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(getSessionTurnsPath(args.sessionId), JSON.stringify(args.turns), 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
})

ipcMain.handle('session:loadTurns', async (_e, sessionId: string) => {
  try {
    const p = getSessionTurnsPath(sessionId)
    if (!existsSync(p)) return []
    const raw = readFileSync(p, 'utf-8')
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
})

function decodeXml(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function resolveWorkspaceRoot(workspaceDir?: string): string {
  const fallback = join(app.getPath('documents'), '小蓝鲸产出')
  if (!workspaceDir || typeof workspaceDir !== 'string') return fallback
  return resolve(workspaceDir)
}

function isInsideRoot(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

// 列出工作区目录文件(供输入框 @文件引用)
ipcMain.handle('workspace:listFiles', async (_e, args?: { workspaceDir?: string; subDir?: string } | string) => {
  const workspaceDir = typeof args === 'string' ? undefined : args?.workspaceDir
  const subDir = typeof args === 'string' ? args : args?.subDir
  const root = resolveWorkspaceRoot(workspaceDir)
  const target = subDir ? resolve(root, subDir) : root
  if (!isInsideRoot(root, target)) return { error: '不能读取工作区外的文件', items: [] }
  try {
    const entries = await readdirAsync(target, { withFileTypes: true })
    const items = await Promise.all(
      entries.map(async (e) => {
        try {
          const s = await statAsync(join(target, e.name))
          return {
            name: e.name,
            type: e.isDirectory() ? 'dir' : 'file',
            size: s.size,
            path: relative(root, join(target, e.name))
          }
        } catch {
          return { name: e.name, type: e.isDirectory() ? 'dir' : 'file', size: 0, path: e.name }
        }
      })
    )
    // 目录排前面，文件按名字排序
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return { items }
  } catch {
    return { items: [] }
  }
})

// 读取工作区文件文本内容(供 @文件引用注入上下文)
ipcMain.handle('workspace:readFile', async (_e, args: { relPath: string; workspaceDir?: string } | string) => {
  const relPath = typeof args === 'string' ? args : args?.relPath
  const workspaceDir = typeof args === 'string' ? undefined : args?.workspaceDir
  const root = resolveWorkspaceRoot(workspaceDir)
  const abs = resolve(root, relPath || '')
  if (!isInsideRoot(root, abs)) return { error: '不能读取工作区外的文件' }
  try {
    const content = readFileSync(abs, 'utf-8')
    return { content: content.slice(0, 50000), truncated: content.length > 50000 }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
})


// 预览工作区产物：文本直接读，图片返回可展示内容，Office/PDF 提取文字用于预览
ipcMain.handle('workspace:previewFile', async (_e, args: { filePath: string; workspaceDir?: string }) => {
  const filePath = args?.filePath
  const workspaceDir = args?.workspaceDir
  if (!filePath || typeof filePath !== 'string') return { error: '文件路径为空' }
  const root = resolveWorkspaceRoot(workspaceDir)
  const abs = filePath.startsWith('/') ? resolve(filePath) : resolve(root, filePath)
  if (!isInsideRoot(root, abs)) return { error: '不能预览工作区外的文件' }
  try {
    const ext = abs.split('.').pop()?.toLowerCase() || ''
    const buf = readFileSync(abs)
    const imageMime: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp'
    }
    if (imageMime[ext]) {
      return { kind: 'image', dataUrl: `data:${imageMime[ext]};base64,${buf.toString('base64')}`, size: buf.length }
    }
    if (['docx', 'xlsx', 'pdf', 'doc', 'pptx'].includes(ext)) {
      const content = await extractDocumentText(abs, ext)
      return { kind: ext === 'xlsx' ? 'table' : 'document', content: content.slice(0, 50000), truncated: content.length > 50000, size: buf.length }
    }
    const content = buf.toString('utf-8')
    return { kind: 'text', content: content.slice(0, 50000), truncated: content.length > 50000, size: buf.length }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
})

ipcMain.handle('trace:list', async (_e, limit?: number) => {
  return listTraces(limit ?? 50)
})

ipcMain.handle('trace:get', async (_e, traceId: string) => {
  return getTrace(traceId)
})

ipcMain.handle('trace:export', async (_e, traceId?: string) => {
  return exportTracePackage(traceId)
})

ipcMain.handle('feedback:create', async (_e, input: {
  traceId?: string
  category: string
  description: string
  contact?: string
  packageLevel?: 'basic' | 'enhanced' | 'full'
  includeConversation?: boolean
  includeFileSummary?: boolean
  allowDiagnosticPackage?: boolean
}) => {
  return createFeedbackTicket(input)
})

ipcMain.handle('feedback:list', async (_e, limit?: number) => {
  return listFeedbackTickets(limit ?? 50)
})

ipcMain.handle('diagnostics:overview', async (_e, limit?: number) => {
  return getDiagnosticsOverview(limit ?? 200)
})

ipcMain.handle('replay:get', async (_e, input: { traceId: string; includeConversation?: boolean; includeFileSummary?: boolean }) => {
  return getReplayBundle(input)
})

ipcMain.handle('replay:export', async (_e, input: { traceId: string; includeConversation?: boolean; includeFileSummary?: boolean }) => {
  return exportReplayPackage(input)
})

// 从 Office/PDF 文档中提取纯文本内容（供模型理解文档）
async function extractDocumentText(filePath: string, ext: string): Promise<string> {
  try {
    if (ext === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ path: filePath })
      return result.value || ''
    }
    if (ext === 'xlsx') {
      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.readFile(filePath)
      const lines: string[] = []
      wb.eachSheet((sheet) => {
        lines.push(`[工作表: ${sheet.name}]`)
        sheet.eachRow((row) => {
          const cells = row.values as unknown[]
          // values[0] 是 undefined，从 1 开始
          const text = cells.slice(1).map((c) => (c == null ? '' : String(c))).join('\t')
          lines.push(text)
        })
      })
      return lines.join('\n')
    }
    if (ext === 'pdf') {
      const { PDFParse } = await import('pdf-parse')
      const buf = readFileSync(filePath)
      const parser = new PDFParse({ data: new Uint8Array(buf) })
      const textResult = await parser.getText()
      await parser.destroy()
      return textResult.text || ''
    }
    // .doc 暂不支持解析；.pptx 用系统 unzip 读取幻灯片文字，不额外引入依赖。
    if (ext === 'doc') return '[旧版 .doc 格式暂不支持解析，建议转为 .docx]'
    if (ext === 'pptx') {
      const xml = execFileSync('unzip', ['-p', filePath, 'ppt/slides/slide*.xml'], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 })
      const text = Array.from(xml.matchAll(/<a:t>(.*?)<\/a:t>/g))
        .map((m) => decodeXml(m[1]))
        .filter(Boolean)
      return text.join('\n') || '[未提取到演示稿文字]'
    }
  } catch (e) {
    return `[文档解析失败: ${e instanceof Error ? e.message : String(e)}]`
  }
  return ''
}

ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '常用文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'txt', 'md', 'json', 'csv', 'pdf', 'doc', 'docx', 'xlsx', 'pptx'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) return []

  const results = await Promise.all(result.filePaths.map(async (filePath) => {
    const fileName = filePath.split('/').pop() || filePath
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)
    const isText = ['txt', 'md', 'json', 'csv', 'log', 'ts', 'js', 'tsx', 'jsx', 'py', 'go', 'rs', 'java', 'html', 'css', 'xml', 'yaml', 'yml', 'sh', 'sql'].includes(ext)
    const isDoc = ['docx', 'xlsx', 'pdf', 'doc', 'pptx'].includes(ext)
    const mime = isImage
      ? (ext === 'jpg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`)
      : isText ? 'text/plain'
      : isDoc ? (ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : ext === 'pdf' ? 'application/pdf'
        : ext === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        : 'application/msword')
      : 'application/octet-stream'

    let dataUrl: string | undefined
    let textContent: string | undefined
    let size = 0

    try {
      const buf = readFileSync(filePath)
      size = buf.length
      if (isImage) {
        dataUrl = `data:${mime};base64,${buf.toString('base64')}`
      } else if (isText) {
        textContent = buf.toString('utf-8')
      } else if (isDoc) {
        textContent = await extractDocumentText(filePath, ext)
      }
    } catch {
      // 读取失败
    }

    // 文档类有提取到文本就归为 text，否则 file
    const type = isImage ? 'image' : (isText || (isDoc && textContent)) ? 'text' : 'file'

    return {
      name: fileName,
      type,
      size,
      mime,
      dataUrl,
      textContent
    }
  }))

  return results
})

// 选择已有文件夹作为项目根目录（参考 Codex pickLocalWorkspaceRoots）
ipcMain.handle('project:select', async () => {
  const win = BrowserWindow.getFocusedWindow()
  const opts: Electron.OpenDialogOptions = {
    properties: ['openDirectory', 'createDirectory'],
    title: '选择项目文件夹'
  }
  const result = win
    ? await dialog.showOpenDialog(win, opts)
    : await dialog.showOpenDialog(opts)
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

// 从零新建项目：在 ~/Documents/小蓝鲸项目/YYYY-MM-DD/ 下建目录（参考 Codex nS 逻辑）
ipcMain.handle('project:create', async (_e, name: string) => {
  const input = (name || '').trim()
  if (!input) return null

  // slug 化：提取 [a-z0-9] 片段取前 6 段用 - 拼接；纯中文等无字母数字时用项目名原样
  const slugParts = input.toLowerCase().match(/[a-z0-9]+/g)
  let dirName = slugParts && slugParts.length > 0 ? slugParts.slice(0, 6).join('-') : input

  // 日期子目录 YYYY-MM-DD
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const baseDir = join(app.getPath('documents'), '小蓝鲸项目', dateStr)
  if (!existsSync(baseDir)) mkdirSync(baseDir, { recursive: true })

  // 去重：已存在则追加 -2 -3 …
  let finalPath = join(baseDir, dirName)
  let counter = 2
  while (existsSync(finalPath)) {
    finalPath = join(baseDir, `${dirName}-${counter}`)
    counter++
  }
  mkdirSync(finalPath, { recursive: true })
  return finalPath
})
