import { app, BrowserWindow, ipcMain, shell, nativeTheme } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { agentBridge } from './agent-bridge.js'
import type { StdoutMessage } from '../agent/src/protocol.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// 凭证管理：只从环境变量取，不把明文 key 经 IPC 返回渲染（依据 docs/09 第五章）
function getApiKey(): string {
  return process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || ''
}

function buildAgentConfig() {
  return {
    provider: 'anthropic' as const,
    model: process.env.XLJ_MODEL || 'claude-3-5-sonnet-20241022',
    apiKey: getApiKey(),
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
  if (key === 'hasApiKey') return Boolean(getApiKey())
  if (key === 'model') return process.env.XLJ_MODEL || 'claude-3-5-sonnet-20241022'
  return null
})

ipcMain.handle('shell:openExternal', async (_e, url: string) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    await shell.openExternal(url)
  }
})
