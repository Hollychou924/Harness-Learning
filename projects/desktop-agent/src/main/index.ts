import { app, BrowserWindow, ipcMain, shell, nativeTheme } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { agentBridge } from './agent-bridge.js'
import type { StdoutMessage, AgentConfig } from '../agent/src/protocol.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

interface ModelConfig {
  providerId: string
  model: string
  apiKey: string
  apiBaseUrl: string
  apiFormat: 'openai' | 'anthropic'
  contextLimit: number
  customProviderId?: string
}

function getConfigPath(): string {
  return join(app.getPath('userData'), 'model-config.json')
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

function buildAgentConfig(): AgentConfig {
  const saved = loadConfig()
  if (saved && saved.apiKey) {
    return {
      provider: saved.apiFormat === 'anthropic' ? 'anthropic' : 'openai',
      model: saved.model,
      apiKey: saved.apiKey,
      apiBaseUrl: saved.apiBaseUrl || undefined,
      maxIterations: Number(process.env.XLJ_MAX_ITER || 8),
      workspaceDir: process.env.XLJ_WORKSPACE || undefined,
      providerId: saved.providerId,
      apiFormat: saved.apiFormat,
      contextLimit: saved.contextLimit,
      customProviderId: saved.customProviderId
    }
  }
  // 兜底：环境变量
  return {
    provider: 'anthropic' as const,
    model: process.env.XLJ_MODEL || 'claude-sonnet-4-5-20250929',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    apiBaseUrl: process.env.ANTHROPIC_BASE_URL || undefined,
    maxIterations: Number(process.env.XLJ_MAX_ITER || 8),
    workspaceDir: process.env.XLJ_WORKSPACE || undefined
  }
}

let mainWindow: BrowserWindow | null = null

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

  // 把 Agent 子进程消息转发给渲染进程
  agentBridge.onMessage((msg: StdoutMessage) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:event', msg)
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
ipcMain.handle('agent:startTask', async (_e, args: { mode: 'work' | 'code'; message: string; workspaceDir?: string }) => {
  const sessionId = randomUUID()
  const config = buildAgentConfig()
  if (!config.apiKey) {
    return { taskId: sessionId, error: '未检测到模型凭证，请在环境变量配置 ANTHROPIC_API_KEY' }
  }
  agentBridge.startTask(sessionId, args.message, config, args.workspaceDir)
  return { taskId: sessionId }
})

ipcMain.handle('config:get', async (_e, key: string) => {
  const cfg = loadConfig()
  if (key === 'hasApiKey') return Boolean(cfg?.apiKey || process.env.ANTHROPIC_API_KEY)
  if (key === 'model') return cfg?.model || process.env.XLJ_MODEL || 'claude-sonnet-4-5-20250929'
  if (key === 'modelConfig') return cfg
  if (key === 'contextLimit') return cfg?.contextLimit || 200000
  if (key === 'customProviderId') return cfg?.customProviderId || null
  return null
})

ipcMain.handle('config:saveModel', async (_e, cfg: ModelConfig) => {
  saveConfigFile(cfg)
  return { success: true }
})

ipcMain.handle('shell:openExternal', async (_e, url: string) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    await shell.openExternal(url)
  }
})

// 任务控制通道（依据 docs/09 第二章，转发为 stdin task_control）
ipcMain.handle('agent:pause', async (_e, args: { taskId: string }) => {
  agentBridge.send({ type: 'task_control', task_id: args.taskId, action: 'pause' })
})

ipcMain.handle('agent:resume', async (_e, args: { taskId: string }) => {
  agentBridge.send({ type: 'task_control', task_id: args.taskId, action: 'resume' })
})

ipcMain.handle('agent:cancel', async (_e, args: { taskId: string }) => {
  agentBridge.send({ type: 'task_control', task_id: args.taskId, action: 'cancel' })
})

ipcMain.handle('agent:rollback', async (_e, args: { taskId: string }) => {
  agentBridge.send({ type: 'task_control', task_id: args.taskId, action: 'rollback' })
  return { success: true }
})

// 权限审批通道（转发为 stdin approval_response）
ipcMain.handle('agent:approval', async (_e, args: { requestId: string; approved: boolean }) => {
  agentBridge.send({ type: 'approval_response', request_id: args.requestId, approved: args.approved })
})

// 计划响应通道（转发为 stdin plan_response）
ipcMain.handle('agent:planResponse', async (_e, args: { requestId: string; decision: 'approve' | 'reject_stop' | 'reject_revise'; feedback?: string }) => {
  agentBridge.send({ type: 'plan_response', request_id: args.requestId, decision: args.decision, feedback: args.feedback })
})

// 追加指令通道（转发为 stdin append_input）
ipcMain.handle('agent:appendInput', async (_e, args: { taskId: string; message: string; mode?: 'inject' | 'queue' }) => {
  agentBridge.send({ type: 'append_input', task_id: args.taskId, message: args.message, mode: args.mode })
})
