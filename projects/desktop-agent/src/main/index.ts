import { app, BrowserWindow, ipcMain, shell, nativeTheme, dialog, powerSaveBlocker, protocol } from 'electron'
import { isAbsolute, join, resolve, relative } from 'node:path'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { readdir as readdirAsync, stat as statAsync } from 'node:fs/promises'
import { agentBridge } from './agent-bridge.js'
import { startTrace, logAgentEvent, logUserAction, listTraces, getTrace, exportTracePackage, createFeedbackTicket, listFeedbackTickets, getDiagnosticsOverview, getReplayBundle, exportReplayPackage } from './trace-logger.js'
import type { StdoutMessage, AgentConfig, MessageAttachment } from '../agent/src/protocol.js'
import { getModelThinkingConfig } from '../renderer/src/components/providerPresets.js'
import { getCommitDetail, getCommitDiff, getCommitHistory } from './git-history.js'
import { RuntimeWakeLock } from './runtime-wake-lock.js'
import { ImportStore } from './import-store.js'
import { countPending, scanKnownSources } from './import-sources.js'
import type { ImportSelection } from './import-types.js'
import {
  resolveModelConfigForSave,
  sameModelSlot,
  sanitizeModelConfigForRenderer,
  sanitizeModelConfigStoreForRenderer,
  validateModelConfig,
  type ModelConfig,
  type ModelConfigStore
} from './model-config.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// 注册 imported-asset:// 协议：导入的图片资源通过这个协议从 external-imports/assets 目录读取。
// 必须在 app ready 之前声明为特权 scheme，否则渲染端加载会被安全策略拦截。
protocol.registerSchemesAsPrivileged([
  { scheme: 'imported-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

type BranchInfoResult = {
  success: boolean
  currentBranch?: string
  branches?: string[]
  changedFiles?: number
  error?: string
}

function runGit(workspaceDir: string, args: string[]): string {
  return execFileSync('git', ['-C', workspaceDir, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 4,
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function gitErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'stderr' in error) {
    const stderr = String((error as { stderr?: string | Buffer }).stderr || '').trim()
    if (stderr) return stderr.replace(/^fatal:\s*/i, '')
  }
  return error instanceof Error ? error.message : String(error || '操作失败')
}

function branchSwitchErrorMessage(error: unknown): string {
  const message = gitErrorMessage(error)
  if (/local changes.*overwritten|would be overwritten by (checkout|switch)/is.test(message)) {
    return '当前有未保存的项目修改，切换分支可能覆盖这些内容。请先提交或处理修改后再试。'
  }
  if (/untracked working tree files.*overwritten/is.test(message)) {
    return '当前有未保存的新文件，切换分支可能覆盖这些文件。请先处理后再试。'
  }
  if (/already checked out at|used by worktree/is.test(message)) {
    return '这个分支正在另一个项目窗口中使用，暂时无法切换。'
  }
  if (/invalid reference|unknown revision|did not match any file/is.test(message)) {
    return '没有找到这个分支，请刷新后重试。'
  }
  return '分支切换失败，请稍后重试。'
}

function getBranchInfo(workspaceDir: string): BranchInfoResult {
  try {
    runGit(workspaceDir, ['rev-parse', '--is-inside-work-tree'])
    const currentBranch = runGit(workspaceDir, ['branch', '--show-current'])
    const branches = runGit(workspaceDir, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
      .split('\n')
      .map((name) => name.trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    if (currentBranch) {
      const currentIndex = branches.indexOf(currentBranch)
      if (currentIndex > 0) branches.unshift(...branches.splice(currentIndex, 1))
    }
    const changedFiles = runGit(workspaceDir, ['status', '--porcelain']).split('\n').filter(Boolean).length
    return { success: true, currentBranch: currentBranch || undefined, branches, changedFiles }
  } catch (error) {
    return { success: false, error: gitErrorMessage(error) }
  }
}

function getConfigPath(): string {
  return join(app.getPath('userData'), 'model-config.json')
}

type ThemeMode = 'system' | 'light' | 'dark'

function getAppearanceConfigPath(): string {
  return join(app.getPath('userData'), 'appearance-config.json')
}

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

function loadThemeMode(): ThemeMode {
  try {
    const p = getAppearanceConfigPath()
    if (!existsSync(p)) return 'system'
    const raw = readFileSync(p, 'utf-8')
    return normalizeThemeMode(JSON.parse(raw)?.themeMode)
  } catch {
    return 'system'
  }
}

function saveThemeMode(themeMode: ThemeMode): void {
  writeFileSync(getAppearanceConfigPath(), JSON.stringify({ themeMode }, null, 2), 'utf-8')
}

function applyThemeMode(themeMode: ThemeMode): void {
  nativeTheme.themeSource = themeMode
}

// 会话消息持久化目录：~/Library/Application Support/小蓝鲸/sessions/<id>.json
function getSessionsDir(): string {
  return join(app.getPath('userData'), 'sessions')
}

function getImportStore(): ImportStore {
  return new ImportStore(join(app.getPath('userData'), 'external-imports'))
}

const ASSET_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.heic': 'image/heic', '.svg': 'image/svg+xml'
}

function inferAssetMime(filePath: string): string {
  const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
  return ASSET_MIME_BY_EXT[ext] || 'application/octet-stream'
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
  const custom = cfg.customModelId ? `-${cfg.customModelId}` : ''
  return `${cfg.providerId}${sub}${custom}-${cfg.model}-${Date.now().toString(36)}`
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

function resolveModelConfigWithSavedKey(cfg: ModelConfig): ModelConfig {
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
  return resolveModelConfigForSave(cfg, [
    ...store.configs,
    ...(legacyConfig ? [legacyConfig] : []),
    ...(envConfig ? [envConfig] : [])
  ])
}

async function testModelConnection(cfg: ModelConfig): Promise<{ success: boolean; message?: string; error?: string; latencyMs?: number }> {
  const resolvedCfg = resolveModelConfigWithSavedKey(cfg)
  const configError = validateModelConfig(resolvedCfg)
  if (configError) return { success: false, error: configError }
  if (!resolvedCfg.model.trim()) return { success: false, error: '请先填写模型 ID' }
  if (!resolvedCfg.apiBaseUrl.trim()) return { success: false, error: '请先填写连接地址' }

  // 走真实 provider 路径：让 agent 子进程用与正式对话完全相同的 client/鉴权/baseURL/stream 行为做一次最小探测，
  // 这样"测试连接"检验的就是用户真正会发送的请求形状，避免测试与真实使用形状漂移导致的假阳/假阴。
  const isMify = resolvedCfg.providerId === 'mify'
  const preset = getModelThinkingConfig(
    resolvedCfg.providerId,
    resolvedCfg.model,
    isMify,
    isMify ? resolvedCfg.customProviderId : undefined
  )
  const supportsThinking = preset?.supportsThinking === true
  const agentConfig: AgentConfig = {
    provider: resolvedCfg.apiFormat === 'anthropic' ? 'anthropic' : 'openai',
    model: resolvedCfg.model,
    apiKey: resolvedCfg.apiKey,
    apiBaseUrl: resolvedCfg.apiBaseUrl || undefined,
    maxIterations: 1,
    workspaceDir: process.env.XLJ_WORKSPACE || join(app.getPath('documents'), '小蓝鲸产出'),
    providerId: resolvedCfg.providerId,
    apiFormat: resolvedCfg.apiFormat,
    contextLimit: resolvedCfg.contextLimit,
    customProviderId: resolvedCfg.customProviderId,
    autoApproveLow: false,
    thinkingLevel: 'off',
    thinkingConfig: supportsThinking ? preset!.thinkingConfig : undefined
  }

  return agentBridge.testModel(agentConfig)
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
const runtimeWakeLock = new RuntimeWakeLock(powerSaveBlocker)

function getWindowIconPath(): string {
  const packagedIconPath = join(process.resourcesPath, 'build', 'icon.png')
  const localIconPath = join(__dirname, '../../build/icon.png')
  return existsSync(packagedIconPath) ? packagedIconPath : localIconPath
}

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
    icon: getWindowIconPath(),
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
      sandbox: false,
      scrollBounce: false
    }
  })

  // 把 Agent 子进程消息转发给渲染进程，并注入 taskId（流式事件本身不带，补上以便前端按任务隔离）
  agentBridge.onMessage((msg: StdoutMessage) => {
    const taskId = activeTaskId
    const traceId = activeTraceId
    if (traceId) {
      logAgentEvent(traceId, msg)
      if (msg.type === 'completed' || msg.type === 'error' || (msg.type === 'turn_completed' && msg.status === 'cancelled')) {
        const finishedTaskId = msg.type === 'completed' ? msg.task_id : taskId
        if (finishedTaskId) runtimeWakeLock.taskFinished(finishedTaskId)
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
  applyThemeMode(loadThemeMode())
  // 解析 imported-asset://<assetId> 到 external-imports/assets/<assetId> 文件。
  // assetId 形如 asset-<24位十六进制>，由导入流程稳定生成；非法的 id 直接返回 404，避免越权读取其他文件。
  protocol.handle('imported-asset', async (request) => {
    const assetId = request.url.hostname || request.url.pathname.replace(/^\/+/, '')
    const store = getImportStore()
    const filePath = store.assetPath(assetId)
    if (!filePath) return new Response('资源不存在', { status: 404 })
    try {
      const info = await stat(filePath)
      const mime = inferAssetMime(filePath)
      return new Response(createReadStream(filePath) as unknown as BodyInit, {
        status: 200, headers: { 'Content-Type': mime, 'Content-Length': String(info.size), 'Cache-Control': 'immutable, max-age=31536000' }
      })
    } catch {
      return new Response('资源读取失败', { status: 404 })
    }
  })
  agentBridge.onExit(() => {
    runtimeWakeLock.releaseAll()
    activeTaskId = null
    activeTraceId = null
  })
  agentBridge.start()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  runtimeWakeLock.releaseAll()
  agentBridge.stop()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  runtimeWakeLock.releaseAll()
})

// IPC 通道（依据 docs/09 第二章）
ipcMain.handle('agent:startTask', async (_e, args: { mode: 'work' | 'code'; message: string; workspaceDir?: string; maxIterations?: number; approvalMode?: 'always_ask' | 'risk_only' | 'auto'; autoApproveLow?: boolean; sessionId?: string; history?: unknown[]; attachments?: unknown[] }) => {
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
  if (args.approvalMode) config.approvalMode = args.approvalMode
  if (args.autoApproveLow !== undefined) config.autoApproveLow = args.autoApproveLow
  // 输出目录：优先用用户指定，否则用系统文档目录下的「小蓝鲸产出」
  const outputDir = args.workspaceDir || join(app.getPath('documents'), '小蓝鲸产出')
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
    approvalMode: config.approvalMode,
    autoApproveLow: config.autoApproveLow ?? false,
    apiKey: config.apiKey,
    apiBaseUrl: config.apiBaseUrl,
    providerId: config.providerId,
    customProviderId: config.customProviderId,
    attachmentCount: Array.isArray(args.attachments) ? args.attachments.length : 0,
    historyCount: Array.isArray(args.history) ? args.history.length : 0,
    workspaceDir: outputDir
  })
  try {
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
    activeTaskId = sessionId
    activeTraceId = traceId
    runtimeWakeLock.taskStarted(sessionId)
    agentBridge.startTask(sessionId, args.message, config, outputDir, args.history, args.attachments as MessageAttachment[] | undefined)
    return { taskId: sessionId, traceId }
  } catch (error) {
    runtimeWakeLock.taskFinished(sessionId)
    activeTaskId = null
    activeTraceId = null
    return { taskId: sessionId, traceId, error: error instanceof Error ? error.message : String(error) }
  }
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
  if (key === 'themeMode') return loadThemeMode()
  return null
})

ipcMain.handle('power:setPreventSleepEnabled', async (_e, enabled: boolean) => {
  runtimeWakeLock.setEnabled(enabled === true)
  return { success: true, enabled: enabled === true }
})

ipcMain.handle('appearance:setThemeMode', async (_e, themeMode: ThemeMode) => {
  const normalized = normalizeThemeMode(themeMode)
  saveThemeMode(normalized)
  applyThemeMode(normalized)
  return { success: true, themeMode: normalized }
})

ipcMain.handle('config:saveModel', async (_e, input: ModelConfig | { cfg: ModelConfig; activate?: boolean }) => {
  const cfg = 'cfg' in input ? input.cfg : input
  const activate = 'cfg' in input ? input.activate !== false : true
  const store = loadModelsStore()
  const resolvedCfg = resolveModelConfigWithSavedKey(cfg)
  const configError = validateModelConfig(resolvedCfg)
  if (configError) return { success: false, error: configError }
  const id = generateModelId(resolvedCfg)
  const newEntry = { ...resolvedCfg, _id: id } as ModelConfig & { _id: string }
  // 同一个模型配置位直接覆盖更新，避免保存后重复出现。
  const idx = store.configs.findIndex((c) => sameModelSlot(c, resolvedCfg))
  if (idx >= 0) {
    newEntry._id = (store.configs[idx] as ModelConfig & { _id?: string })._id || id
    store.configs[idx] = newEntry
  } else {
    store.configs.push(newEntry)
  }
  if (activate) {
    store.activeId = newEntry._id
    saveConfigFile(resolvedCfg)
  }
  saveModelsStore(store)
  return { success: true, modelId: newEntry._id }
})

ipcMain.handle('config:testModel', async (_e, cfg: ModelConfig) => {
  return testModelConnection(cfg)
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

// 续跑决策响应通道（转发为 stdin continuation_response）
ipcMain.handle('agent:continuationResponse', async (_e, args: { taskId: string; decision: 'continue' | 'stop' | 'split' }) => {
  const traceId = activeTraceForTask(args.taskId)
  if (traceId) logUserAction(traceId, 'continuation_response', { taskId: args.taskId, decision: args.decision })
  agentBridge.send({ type: 'continuation_response', task_id: args.taskId, decision: args.decision })
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

ipcMain.handle('externalImport:scan', async () => {
  try {
    const result = scanKnownSources()
    const catalog = getImportStore().loadCatalog()
    for (const source of result.preview.sources) {
      const candidate = result.candidates.find((item) => item.source === source.id)
      if (!candidate) continue
      source.pending = countPending(candidate, catalog)
    }
    return { success: true, preview: result.preview }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '检查资料失败' }
  }
})

ipcMain.handle('externalImport:commit', async (_e, selection: ImportSelection) => {
  let committed: Awaited<ReturnType<ImportStore['commit']>> | undefined
  try {
    const store = getImportStore()
    const scanned = scanKnownSources()
    const existing = store.loadCatalog()
    const locallyChanged = new Set(existing.sessions
      .filter((session) => store.hasVisibleSessionChanged(session.id, getSessionsDir()))
      .map((session) => session.id))
    committed = await store.commit(scanned.candidates, selection)
    const changedIds = new Set([...committed.batch.createdSessionIds, ...committed.batch.updatedSessionIds])
    for (const session of committed.sessions) {
      if (changedIds.has(session.id) && !locallyChanged.has(session.id)) store.copySessionTo(session, getSessionsDir())
    }
    return { success: true, result: committed }
  } catch (error) {
    if (committed) {
      return {
        success: true,
        result: committed,
        warning: '资料已经保存，但部分内容暂时没有加入侧边栏；重新打开导入页面会自动补齐'
      }
    }
    return { success: false, error: error instanceof Error ? error.message : '导入失败，原资料未改动' }
  }
})

ipcMain.handle('externalImport:history', async () => {
  try {
    return { success: true, catalog: getImportStore().loadCatalog() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '读取导入记录失败' }
  }
})

ipcMain.handle('externalImport:revert', async (_e, input: { batchId: string; protectedSessionIds?: string[] }) => {
  try {
    const store = getImportStore()
    const catalog = store.loadCatalog()
    const target = catalog.batches.find((batch) => batch.id === input.batchId)
    const protectedIds = new Set(input.protectedSessionIds || [])
    for (const change of target?.sessionChanges || []) {
      if (store.hasVisibleSessionChanged(change.id, getSessionsDir())) protectedIds.add(change.id)
    }
    const result = store.revert(input.batchId, [...protectedIds])
    const currentSessionIds = new Set(result.sessions.map((session) => session.id))
    for (const change of result.batch.sessionChanges) {
      if (currentSessionIds.has(change.id)) store.copySessionTo({ id: change.id }, getSessionsDir())
      else {
        for (const suffix of ['.json', '.turns.json']) {
          const path = join(getSessionsDir(), `${change.id}${suffix}`)
          if (existsSync(path)) unlinkSync(path)
        }
      }
    }
    return { success: true, result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '撤回失败' }
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

async function buildAttachmentFile(filePath: string) {
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
  let error: string | undefined

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
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  const type = isImage ? 'image' : (isText || (isDoc && textContent)) ? 'text' : 'file'
  return {
    name: fileName,
    type,
    size,
    mime,
    dataUrl,
    textContent,
    sourcePath: filePath,
    error
  }
}

ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '常用文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'txt', 'md', 'json', 'csv', 'pdf', 'doc', 'docx', 'xlsx', 'pptx'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) return []

  return Promise.all(result.filePaths.map((filePath) => buildAttachmentFile(filePath)))
})

ipcMain.handle('dialog:readAttachmentFile', async (_e, filePath: string) => {
  if (typeof filePath !== 'string' || !filePath) {
    return { name: '未知文件', type: 'file', size: 0, mime: 'application/octet-stream', error: '文件路径为空' }
  }
  return buildAttachmentFile(filePath)
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

ipcMain.handle('project:branchInfo', (_e, workspaceDir: string): BranchInfoResult => {
  if (!workspaceDir || !isAbsolute(workspaceDir)) return { success: false, error: '当前项目没有绑定本地文件夹' }
  return getBranchInfo(workspaceDir)
})

ipcMain.handle('project:switchBranch', (_e, args: { workspaceDir: string; branchName: string }): BranchInfoResult => {
  if (!args?.workspaceDir || !isAbsolute(args.workspaceDir)) return { success: false, error: '当前项目没有绑定本地文件夹' }
  try {
    runGit(args.workspaceDir, ['switch', '--', args.branchName])
    return getBranchInfo(args.workspaceDir)
  } catch (error) {
    return { success: false, error: branchSwitchErrorMessage(error) }
  }
})

ipcMain.handle('project:createBranch', (_e, args: { workspaceDir: string; branchName: string }): BranchInfoResult => {
  if (!args?.workspaceDir || !isAbsolute(args.workspaceDir)) return { success: false, error: '当前项目没有绑定本地文件夹' }
  const branchName = args.branchName?.trim()
  if (!branchName) return { success: false, error: '请输入分支名称' }
  try {
    runGit(args.workspaceDir, ['check-ref-format', '--branch', branchName])
    runGit(args.workspaceDir, ['switch', '-c', branchName])
    return getBranchInfo(args.workspaceDir)
  } catch (error) {
    return { success: false, error: gitErrorMessage(error) }
  }
})

ipcMain.handle('project:commitHistory', (_e, args: { workspaceDir: string; offset?: number; limit?: number }) =>
  getCommitHistory(args?.workspaceDir, args?.offset, args?.limit))

ipcMain.handle('project:commitDetail', (_e, args: { workspaceDir: string; hash: string }) =>
  getCommitDetail(args?.workspaceDir, args?.hash))

ipcMain.handle('project:commitDiff', (_e, args: { workspaceDir: string; fromHash: string; toHash?: string; filePath?: string }) =>
  getCommitDiff(args?.workspaceDir, args?.fromHash, args?.toHash, args?.filePath))
