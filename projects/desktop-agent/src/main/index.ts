import { app, BrowserWindow, ipcMain, shell, nativeTheme, dialog } from 'electron'
import { join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { readdir as readdirAsync, stat as statAsync } from 'node:fs/promises'
import { agentBridge } from './agent-bridge.js'
import { startTrace, logAgentEvent, logUserAction, listTraces, getTrace } from './trace-logger.js'
import type { StdoutMessage, AgentConfig, MessageAttachment } from '../agent/src/protocol.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

interface ModelConfig {
  providerId: string
  model: string
  apiKey: string
  apiBaseUrl: string
  apiFormat: 'openai' | 'anthropic'
  contextLimit: number
  customProviderId?: string
  autoApproveLow?: boolean
}

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

function buildAgentConfig(): AgentConfig {
  const saved = loadConfig()
  if (saved && saved.apiKey) {
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
      autoApproveLow: saved.autoApproveLow ?? false
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
let activeTraceId: string | null = null

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
    const taskId = activeTraceId
    if (taskId) {
      logAgentEvent(taskId, msg)
      if (msg.type === 'completed' || msg.type === 'error') {
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
  const config = buildAgentConfig()
  if (!config.apiKey) {
    return { taskId: sessionId, error: '未检测到模型凭证，请在环境变量配置 ANTHROPIC_API_KEY' }
  }
  if (args.maxIterations) config.maxIterations = args.maxIterations
  if (args.autoApproveLow !== undefined) config.autoApproveLow = args.autoApproveLow
  activeTraceId = sessionId
  startTrace(sessionId, {
    message: args.message,
    mode: args.mode,
    model: config.model,
    provider: config.provider,
    maxIterations: config.maxIterations,
    autoApproveLow: config.autoApproveLow ?? false,
    apiKey: config.apiKey,
    apiBaseUrl: config.apiBaseUrl,
    providerId: config.providerId,
    customProviderId: config.customProviderId
  })
  // 输出目录：优先用用户指定，否则用系统文档目录下的「小蓝鲸产出」
  const outputDir = args.workspaceDir || join(app.getPath('documents'), '小蓝鲸产出')
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  agentBridge.startTask(sessionId, args.message, config, outputDir, args.history, args.attachments as MessageAttachment[] | undefined)
  return { taskId: sessionId }
})

ipcMain.handle('config:get', async (_e, key: string) => {
  const cfg = loadConfig()
  if (key === 'hasApiKey') return Boolean(cfg?.apiKey || process.env.ANTHROPIC_API_KEY)
  if (key === 'model') return cfg?.model || process.env.XLJ_MODEL || 'claude-sonnet-4-5-20250929'
  if (key === 'modelConfig') {
    if (cfg) return cfg
    const envKey = process.env.ANTHROPIC_API_KEY
    if (envKey) {
      return {
        providerId: 'anthropic',
        model: process.env.XLJ_MODEL || 'claude-sonnet-4-5-20250929',
        apiKey: envKey,
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
  saveConfigFile(cfg)
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
  agentBridge.send({ type: 'task_control', task_id: args.taskId, action: 'pause' })
})

ipcMain.handle('agent:resume', async (_e, args: { taskId: string }) => {
  agentBridge.send({ type: 'task_control', task_id: args.taskId, action: 'resume' })
})

ipcMain.handle('agent:cancel', async (_e, args: { taskId: string }) => {
  if (activeTraceId) logUserAction(activeTraceId, 'task_cancelled', { taskId: args.taskId })
  agentBridge.send({ type: 'task_control', task_id: args.taskId, action: 'cancel' })
})

ipcMain.handle('agent:rollback', async (_e, args: { taskId: string }) => {
  agentBridge.send({ type: 'task_control', task_id: args.taskId, action: 'rollback' })
  return { success: true }
})

// 权限审批通道（转发为 stdin approval_response）
ipcMain.handle('agent:approval', async (_e, args: { requestId: string; approved: boolean }) => {
  if (activeTraceId) logUserAction(activeTraceId, 'approval_response', { requestId: args.requestId, approved: args.approved })
  agentBridge.send({ type: 'approval_response', request_id: args.requestId, approved: args.approved })
})

// 计划响应通道（转发为 stdin plan_response）
ipcMain.handle('agent:planResponse', async (_e, args: { requestId: string; decision: 'approve' | 'reject_stop' | 'reject_revise'; feedback?: string }) => {
  if (activeTraceId) logUserAction(activeTraceId, 'plan_response', { requestId: args.requestId, decision: args.decision, feedback: args.feedback })
  agentBridge.send({ type: 'plan_response', request_id: args.requestId, decision: args.decision, feedback: args.feedback })
})

// 追加指令通道（转发为 stdin append_input）
ipcMain.handle('agent:appendInput', async (_e, args: { taskId: string; message: string; mode?: 'inject' | 'queue' }) => {
  if (activeTraceId) logUserAction(activeTraceId, 'append_input', { taskId: args.taskId, message: args.message, mode: args.mode })
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

// 列出工作区目录文件(供输入框 @文件引用)
ipcMain.handle('workspace:listFiles', async (_e, subDir?: string) => {
  const root = join(app.getPath('documents'), '小蓝鲸产出')
  const target = subDir ? resolve(root, subDir) : root
  if (!target.startsWith(root)) return { error: '越界', items: [] }
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
          return { name: e.name, type: e.isDirectory() ? 'dir' : 'file', path: e.name }
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
ipcMain.handle('workspace:readFile', async (_e, relPath: string) => {
  const root = join(app.getPath('documents'), '小蓝鲸产出')
  const abs = resolve(root, relPath)
  if (!abs.startsWith(root)) return { error: '越界' }
  try {
    const content = readFileSync(abs, 'utf-8')
    return { content: content.slice(0, 50000), truncated: content.length > 50000 }
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
    // .doc / .pptx 等暂不支持解析，返回提示
    if (ext === 'doc') return '[旧版 .doc 格式暂不支持解析，建议转为 .docx]'
    if (ext === 'pptx') return '[.pptx 解析暂未实现，建议复制文字内容后发送]'
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
