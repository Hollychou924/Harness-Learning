# Xiaolanjing Codex Chat Iteration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让小蓝鲸对话页第一批体验对齐参考文档：运行中可补充、主按钮可停止、底部步骤提示、右侧产物/来源收敛，并修复文件引用和思考内容保留两个真实问题。

**Architecture:** 先修页面和本地能力之间的断点，再改底部控制区和过程展示。数据只在现有任务状态里补必要字段，不重做整套页面，不新增大能力。每一步都保持独立验收，避免和当前未提交改动互相覆盖。

**Tech Stack:** Electron, React, TypeScript, Zustand, pnpm, electron-vite.

## Global Constraints

- 只改本批必须位置，不重做整套对话页。
- 不新增依赖。
- 不删除历史旧代码，除非它正是这次问题根因。
- 没有真实来源数据时，右侧来源区显示空状态，不编造来源。
- 文件引用只允许读取当前工作区范围内文件，越界必须拒绝。
- 运行中追加要求如果执行层不能真正消费队列，交付时必须明确说明。
- 每个任务完成后必须运行对应检查；未验证不得标记完成。

---

## File Map

- `projects/desktop-agent/src/preload/index.ts`：补齐页面能调用的文件列表和文件读取入口。
- `projects/desktop-agent/src/renderer/src/api.ts`：补齐页面侧能力说明，让输入区能调用文件列表和读取能力。
- `projects/desktop-agent/src/main/index.ts`：让本地文件列表和读取按当前工作区执行，并加越界保护。
- `projects/desktop-agent/src/agent/src/loop/react.ts`：修复思考内容完成后丢失；补充运行中追加要求的真实提示边界。
- `projects/desktop-agent/src/renderer/src/components/ChatInput.tsx`：让主按钮支持“发送补充/停止”两种运行中状态。
- `projects/desktop-agent/src/renderer/src/components/Composer.tsx`：接入运行中停止和补充要求；展示步骤提示。
- `projects/desktop-agent/src/renderer/src/components/ProgressPill.tsx`：新增底部轻量步骤提示。
- `projects/desktop-agent/src/renderer/src/components/RightPanel.tsx`：右侧栏收敛为产物/来源，保留轻量状态摘要。
- `projects/desktop-agent/src/renderer/src/components/TurnItemsView.tsx`：微调当前动作和历史过程的默认展示节奏。
- `projects/desktop-agent/src/renderer/src/store/task.ts`：补充当前工作区记录和步骤派生信息。
- `projects/desktop-agent/src/renderer/src/store/turns.ts`：确保思考条目更新后能稳定保留内容。

---

### Task 1: Fix File Reference Bridge

**Files:**
- Modify: `projects/desktop-agent/src/preload/index.ts`
- Modify: `projects/desktop-agent/src/renderer/src/api.ts`
- Modify: `projects/desktop-agent/src/main/index.ts`
- Modify: `projects/desktop-agent/src/renderer/src/store/task.ts`
- Verify: `projects/desktop-agent/src/renderer/src/components/ChatInput.tsx`

**Interfaces:**
- Consumes: current active project folder from `useTaskStore.activeProjectId` and `projects[].folderPath`.
- Produces: `api.workspaceListFiles(workspaceDir?: string, subDir?: string)` and `api.workspaceReadFile(relPath: string, workspaceDir?: string)` available to `ChatInput`.

- [ ] **Step 1: Inspect current bridge names**

Run:

```bash
rg -n "workspaceListFiles|workspaceReadFile|workspace:listFiles|workspace:readFile" projects/desktop-agent/src
```

Expected: entries exist in page code and main process, but `preload` does not expose both page calls yet.

- [ ] **Step 2: Add page-callable entries in preload**

Edit `projects/desktop-agent/src/preload/index.ts` so the exposed object contains these entries:

```ts
  workspaceListFiles: (workspaceDir?: string, subDir?: string) =>
    ipcRenderer.invoke('workspace:listFiles', { workspaceDir, subDir }) as Promise<{ items: Array<{ name: string; type: string; size: number; path: string }>; error?: string }>,
  workspaceReadFile: (relPath: string, workspaceDir?: string) =>
    ipcRenderer.invoke('workspace:readFile', { relPath, workspaceDir }) as Promise<{ content?: string; truncated?: boolean; error?: string }>,
```

Keep the existing exposed methods unchanged.

- [ ] **Step 3: Align page-side ability shape**

Edit `projects/desktop-agent/src/renderer/src/api.ts` so the ability list matches preload:

```ts
  workspaceListFiles: (workspaceDir?: string, subDir?: string) => Promise<{ items: Array<{ name: string; type: string; size: number; path: string }>; error?: string }>
  workspaceReadFile: (relPath: string, workspaceDir?: string) => Promise<{ content?: string; truncated?: boolean; error?: string }>
```

Also update the fallback object:

```ts
  workspaceListFiles: async () => ({ items: [] }),
  workspaceReadFile: async () => ({}),
```

- [ ] **Step 4: Make local file access use the active workspace**

Edit `projects/desktop-agent/src/main/index.ts` to accept object arguments for the two file abilities.

Add this helper near the existing workspace handlers:

```ts
function resolveWorkspaceRoot(workspaceDir?: string): string {
  const fallback = join(app.getPath('documents'), '小蓝鲸产出')
  if (!workspaceDir || typeof workspaceDir !== 'string') return fallback
  return resolve(workspaceDir)
}

function isInsideRoot(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !resolve(rel).startsWith('/'))
}
```

Update `workspace:listFiles` to read `{ workspaceDir, subDir }`:

```ts
ipcMain.handle('workspace:listFiles', async (_e, args?: { workspaceDir?: string; subDir?: string }) => {
  const root = resolveWorkspaceRoot(args?.workspaceDir)
  const target = args?.subDir ? resolve(root, args.subDir) : root
  if (!isInsideRoot(root, target)) return { error: '不能读取工作区外的文件', items: [] }
  // keep the current directory reading body, using root and target above
})
```

Update `workspace:readFile` to read `{ relPath, workspaceDir }`:

```ts
ipcMain.handle('workspace:readFile', async (_e, args: { relPath: string; workspaceDir?: string }) => {
  const root = resolveWorkspaceRoot(args?.workspaceDir)
  const abs = resolve(root, args?.relPath || '')
  if (!isInsideRoot(root, abs)) return { error: '不能读取工作区外的文件' }
  // keep the current file reading body, using abs above
})
```

- [ ] **Step 5: Pass the active workspace from input box**

Edit `projects/desktop-agent/src/renderer/src/components/ChatInput.tsx` to derive the active workspace:

```ts
  const activeProject = projects.find((p) => p.id === activeProjectId)
  const activeWorkspaceDir = activeProject?.folderPath
```

Update file listing:

```ts
      const result = await api.workspaceListFiles(activeWorkspaceDir)
```

Update file reading:

```ts
      const result = await api.workspaceReadFile(item.path, activeWorkspaceDir)
```

- [ ] **Step 6: Run focused check**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes with no new TypeScript errors.

- [ ] **Step 7: Commit task**

```bash
git add projects/desktop-agent/src/preload/index.ts projects/desktop-agent/src/renderer/src/api.ts projects/desktop-agent/src/main/index.ts projects/desktop-agent/src/renderer/src/components/ChatInput.tsx
git commit -m "fix: 修复文件引用入口"
```

---

### Task 2: Preserve Thinking Content

**Files:**
- Modify: `projects/desktop-agent/src/agent/src/loop/react.ts`
- Modify: `projects/desktop-agent/src/renderer/src/store/turns.ts`
- Verify: `projects/desktop-agent/src/renderer/src/components/ReasoningBlock.tsx`

**Interfaces:**
- Consumes: provider thinking events already emitted as `ev.type === 'thinking'`.
- Produces: completed reasoning item with non-empty `summary[]` and `content[]` when thinking text exists.

- [ ] **Step 1: Confirm current issue path**

Run:

```bash
rg -n "turnThinkingText|reasoningContent|item_completed.*reasoning|ev.type === 'thinking'" projects/desktop-agent/src/agent/src/loop/react.ts projects/desktop-agent/src/renderer/src/store/turns.ts
```

Expected: thinking deltas are sent, but the running accumulator is not reliably appended before completion.

- [ ] **Step 2: Accumulate thinking content when streaming**

Edit `projects/desktop-agent/src/agent/src/loop/react.ts` inside `if (ev.type === 'thinking' && ev.thinking)`:

```ts
          turnThinkingText += ev.thinking
          if (ev.signature) turnThinkingSignature = ev.signature
          onEvent({
            type: 'item_delta',
            turn_id: turnId,
            item_id: reasoningItemId,
            target: { field: 'reasoningContent', index: reasoningContentIndex },
            delta: ev.thinking
          })
```

If the provider event type has no `signature`, keep only `turnThinkingText += ev.thinking` and do not invent signature fields.

- [ ] **Step 3: Prevent double-completion of the same thinking item**

In `projects/desktop-agent/src/agent/src/loop/react.ts`, add a flag near `let reasoningItemId`:

```ts
    let reasoningCompleted = false
```

When completing the item on first text/tool event, guard it:

```ts
        if (reasoningItemId && !reasoningCompleted && (ev.type === 'text' || ev.type === 'tool_use')) {
          reasoningCompleted = true
          const summaryText = turnThinkingText.slice(0, 80) + (turnThinkingText.length > 80 ? '…' : '')
          onEvent({
            type: 'item_completed',
            turn_id: turnId,
            item: {
              type: 'reasoning',
              id: reasoningItemId,
              summary: summaryText ? [summaryText] : [],
              content: turnThinkingText ? [turnThinkingText] : [],
              status: 'completed',
              startedAt: Date.now(),
              finishedAt: Date.now()
            }
          })
        }
```

At the fallback completion, guard it too:

```ts
    if (reasoningItemId && !reasoningCompleted) {
      reasoningCompleted = true
      const summaryText = turnThinkingText.slice(0, 80) + (turnThinkingText.length > 80 ? '…' : '')
      onEvent({
        type: 'item_completed',
        turn_id: turnId,
        item: { type: 'reasoning', id: reasoningItemId, summary: summaryText ? [summaryText] : [], content: turnThinkingText ? [turnThinkingText] : [], status: 'completed', startedAt: Date.now(), finishedAt: Date.now() }
      })
    }
```

- [ ] **Step 4: Keep existing page reducer behavior unchanged**

Open `projects/desktop-agent/src/renderer/src/store/turns.ts`. Confirm `applyItemDelta` already appends `reasoningContent`. Do not change it unless the current code differs from:

```ts
  if (item.type === 'reasoning' && target.field === 'reasoningContent') {
    const idx = target.index ?? 0
    const content = [...item.content]
    content[idx] = (content[idx] || '') + delta
    return { ...item, content } as ReasoningItem
  }
```

- [ ] **Step 5: Run focused check**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes with no new TypeScript errors.

- [ ] **Step 6: Commit task**

```bash
git add projects/desktop-agent/src/agent/src/loop/react.ts projects/desktop-agent/src/renderer/src/store/turns.ts
git commit -m "fix: 保留真实思考内容"
```

---

### Task 3: Make Composer Button Send-or-Stop

**Files:**
- Modify: `projects/desktop-agent/src/renderer/src/components/ChatInput.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/components/Composer.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/store/task.ts`

**Interfaces:**
- Consumes: `useTaskStore.status`, `message`, `taskId`, `appendInput`, `cancelTask`.
- Produces: `ChatInput` props `isRunning?: boolean` and `onStop?: () => void`.

- [ ] **Step 1: Add button mode props**

Edit `projects/desktop-agent/src/renderer/src/components/ChatInput.tsx` props:

```ts
interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop?: () => void
  isRunning?: boolean
  placeholder?: string
  showProjectPicker?: boolean
}
```

Update function signature:

```ts
export function ChatInput({ value, onChange, onSend, onStop, isRunning = false, placeholder, showProjectPicker = false }: Props) {
```

- [ ] **Step 2: Change main button behavior**

In `ChatInput.tsx`, derive whether the button stops or sends:

```ts
  const shouldStop = isRunning && !hasContent && Boolean(onStop)
```

Replace the current send button with:

```tsx
            <button
              onClick={() => {
                if (shouldStop) {
                  onStop?.()
                  return
                }
                if (hasContent) onSend()
              }}
              disabled={!hasContent && !shouldStop}
              title={shouldStop ? '停止任务' : '发送'}
              className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition ${
                hasContent || shouldStop
                  ? shouldStop
                    ? 'bg-red-500 text-white hover:brightness-110'
                    : 'bg-[#0071e3] text-white hover:brightness-110'
                  : 'bg-black/[0.06] text-[var(--ink-soft)]/40 cursor-not-allowed'
              }`}
            >
              {shouldStop ? <X size={16} /> : <ArrowUp size={16} />}
            </button>
```

`X` is already imported in this file.

- [ ] **Step 3: Pass running state from bottom composer**

Edit `projects/desktop-agent/src/renderer/src/components/Composer.tsx`:

```tsx
        <ChatInput
          value={message}
          onChange={setMessage}
          onSend={handleSend}
          onStop={() => void cancelTask()}
          isRunning={isExecuting}
          placeholder={pending ? '发送中…' : placeholder}
        />
```

Ensure `cancelTask` is pulled from the task state:

```ts
  const { status, message, setMessage, startTask, appendInput, cancelTask, taskId, messages } = useTaskStore()
```

- [ ] **Step 4: Remove duplicate running stop button in message area**

Edit `projects/desktop-agent/src/renderer/src/components/Workbench.tsx`. In `RunningView`, remove the separate “停止任务” button block so stop is concentrated in the input area.

Remove this block:

```tsx
      {status === 'executing' && (
        <div className="flex justify-end">
          <button
            onClick={() => cancelTask()}
            className="h-8 px-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 hover:bg-red-100 transition"
          >
            停止任务
          </button>
        </div>
      )}
```

Also remove `cancelTask` from the `RunningView` state destructuring if it becomes unused.

- [ ] **Step 5: Run focused check**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes with no new TypeScript errors.

- [ ] **Step 6: Commit task**

```bash
git add projects/desktop-agent/src/renderer/src/components/ChatInput.tsx projects/desktop-agent/src/renderer/src/components/Composer.tsx projects/desktop-agent/src/renderer/src/components/Workbench.tsx
git commit -m "feat: 运行中主按钮支持停止"
```

---

### Task 4: Add Bottom Progress Pill

**Files:**
- Create: `projects/desktop-agent/src/renderer/src/components/ProgressPill.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/components/Composer.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/store/task.ts`

**Interfaces:**
- Consumes: current turn items, approval pending state, task status.
- Produces: `ProgressPill` component that returns `null` when there is no useful progress to show.

- [ ] **Step 1: Create progress component**

Create `projects/desktop-agent/src/renderer/src/components/ProgressPill.tsx`:

```tsx
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { Turn, ToolCallItem } from '../../../agent/src/items'

type Props = {
  status: string
  currentTurn: Turn | null
  hasApprovalPending: boolean
}

export function ProgressPill({ status, currentTurn, hasApprovalPending }: Props) {
  if (hasApprovalPending) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs text-amber-700">
        <AlertCircle size={13} />
        等待你确认
      </div>
    )
  }

  const toolItems = (currentTurn?.items ?? []).filter((it): it is ToolCallItem => it.type === 'toolCall')
  const total = toolItems.length
  if (status !== 'executing' || total === 0) return null

  const done = toolItems.filter((it) => it.status === 'completed' || it.status === 'failed' || it.status === 'stopped' || it.status === 'canceled').length
  const current = Math.min(done + 1, total)
  const complete = done >= total

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-black/[0.06] px-2.5 py-1 text-xs text-[var(--ink-soft)] shadow-sm">
      {complete ? <CheckCircle2 size={13} className="text-green-500" /> : <Loader2 size={13} className="text-sky-500 animate-spin" />}
      <span>{complete ? `已完成 ${total} 步` : `第 ${current} / ${total} 步`}</span>
    </div>
  )
}
```

- [ ] **Step 2: Render above bottom input**

Edit `projects/desktop-agent/src/renderer/src/components/Composer.tsx`:

```ts
import { ProgressPill } from './ProgressPill'
```

Pull `currentTurn` and `approvalPending`:

```ts
  const { status, message, setMessage, startTask, appendInput, cancelTask, taskId, messages, currentTurn, approvalPending } = useTaskStore()
```

Render before `ChatInput`:

```tsx
        <div className="mb-2 flex justify-center">
          <ProgressPill status={status} currentTurn={currentTurn} hasApprovalPending={Boolean(approvalPending)} />
        </div>
```

- [ ] **Step 3: Run focused check**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes with no new TypeScript errors.

- [ ] **Step 4: Commit task**

```bash
git add projects/desktop-agent/src/renderer/src/components/ProgressPill.tsx projects/desktop-agent/src/renderer/src/components/Composer.tsx
git commit -m "feat: 增加底部步骤提示"
```

---

### Task 5: Reframe Right Panel as Outputs and Sources

**Files:**
- Modify: `projects/desktop-agent/src/renderer/src/components/RightPanel.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/store/task.ts`

**Interfaces:**
- Consumes: `artifacts`, current and historical turns.
- Produces: right panel with quiet status summary, outputs section, sources empty state.

- [ ] **Step 1: Add source entry shape**

Edit `projects/desktop-agent/src/renderer/src/store/task.ts` near `ArtifactEntry`:

```ts
export interface SourceEntry {
  type: 'file' | 'web' | 'note'
  label: string
  path?: string
  url?: string
}
```

Do not add fake data. This shape is for display only in this task.

- [ ] **Step 2: Add local source derivation in right panel**

Edit `projects/desktop-agent/src/renderer/src/components/RightPanel.tsx`, add helper:

```ts
function deriveSourcesFromTurns(turns: Turn[], currentTurn: Turn | null): SourceEntry[] {
  const allTurns = currentTurn ? [...turns, currentTurn] : turns
  const byKey = new Map<string, SourceEntry>()
  for (const turn of allTurns) {
    for (const item of turn.items) {
      if (item.type !== 'toolCall') continue
      if ((item.kind === 'read_file' || item.kind === 'list_files') && typeof item.args.path === 'string') {
        const path = item.args.path
        byKey.set(`file:${path}`, { type: 'file', label: path.split('/').pop() || path, path })
      }
      if (item.kind === 'fetch_page' && typeof item.args.url === 'string') {
        const url = item.args.url
        byKey.set(`web:${url}`, { type: 'web', label: url, url })
      }
    }
  }
  return Array.from(byKey.values()).slice(0, 20)
}
```

Import the needed type:

```ts
import type { ArtifactEntry, SourceEntry } from '../store/task'
import type { ToolCallItem, Turn } from '../../../agent/src/items'
```

- [ ] **Step 3: Reorder right panel sections**

In `RightPanel`, compute:

```ts
  const visibleArtifacts = artifacts.filter((a) => a.filePath !== 'inline')
  const sources = deriveSourcesFromTurns(turns, currentTurn)
```

Render sections in this order:

1. compact status summary
2. outputs section
3. sources section
4. usage section
5. error section

Use this outputs section:

```tsx
        <section className="glass rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <FileCode size={14} className="text-[var(--ink-soft)]" />
            <span className="text-xs font-semibold tracking-wide text-[var(--ink-soft)] uppercase">产物</span>
            {visibleArtifacts.length > 0 && <span className="ml-auto text-xs text-[var(--ink-soft)]">{visibleArtifacts.length}</span>}
          </div>
          {visibleArtifacts.length === 0 ? (
            <p className="text-xs text-[var(--ink-soft)] py-1">暂无产物</p>
          ) : (
            <ul className="space-y-1">{visibleArtifacts.map((a, i) => <ArtifactItem key={i} art={a} />)}</ul>
          )}
        </section>
```

Use this sources section:

```tsx
        <section className="glass rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <FileText size={14} className="text-[var(--ink-soft)]" />
            <span className="text-xs font-semibold tracking-wide text-[var(--ink-soft)] uppercase">来源</span>
            {sources.length > 0 && <span className="ml-auto text-xs text-[var(--ink-soft)]">{sources.length}</span>}
          </div>
          {sources.length === 0 ? (
            <p className="text-xs text-[var(--ink-soft)] py-1">暂无来源</p>
          ) : (
            <ul className="space-y-1">{sources.map((s, i) => <SourceItem key={i} source={s} />)}</ul>
          )}
        </section>
```

Add `SourceItem`:

```tsx
function SourceItem({ source }: { source: SourceEntry }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="text-[var(--ink-soft)] flex-shrink-0">{source.type === 'web' ? '🔗' : '📄'}</span>
      <span className="truncate text-[var(--ink)]" title={source.path || source.url || source.label}>{source.label}</span>
    </li>
  )
}
```

- [ ] **Step 4: Keep status compact**

Keep target/status and usage, but do not put detailed progress list above outputs. If keeping progress, place it below sources or reduce to one line:

```tsx
          <p className="text-xs text-[var(--ink-soft)]">{total > 0 ? `已完成 ${doneCount}/${total} 步` : '等待开始'}</p>
```

- [ ] **Step 5: Run focused check**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes with no new TypeScript errors.

- [ ] **Step 6: Commit task**

```bash
git add projects/desktop-agent/src/renderer/src/components/RightPanel.tsx projects/desktop-agent/src/renderer/src/store/task.ts
git commit -m "feat: 右侧栏聚焦产物和来源"
```

---

### Task 6: Quiet Historical Process Display

**Files:**
- Modify: `projects/desktop-agent/src/renderer/src/components/TurnItemsView.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/components/CollapsedTurnBar.tsx`
- Verify: `projects/desktop-agent/src/renderer/src/components/ProcessFlow.tsx`

**Interfaces:**
- Consumes: turn item state from existing reducer.
- Produces: current process remains visible; completed historical process defaults to quiet summary.

- [ ] **Step 1: Confirm current folding rule**

Run:

```bash
rg -n "shouldCollapse|CollapsedTurnBar|showStatusLine|finalAnswerStarted" projects/desktop-agent/src/renderer/src/components/TurnItemsView.tsx projects/desktop-agent/src/renderer/src/components/CollapsedTurnBar.tsx projects/desktop-agent/src/renderer/src/components/ProcessFlow.tsx
```

Expected: completed turns with final answer already collapse; current turn stays expanded.

- [ ] **Step 2: Make collapsed summary more user-facing**

Edit `projects/desktop-agent/src/renderer/src/components/CollapsedTurnBar.tsx`. Replace summary construction with:

```ts
  const summaryParts: string[] = []
  if (toolItems.length > 0) summaryParts.push(`执行了 ${toolItems.length} 个动作`)
  if (reasoningItems.length > 0) summaryParts.push(`思考 ${reasoningItems.length} 次`)
  if (hasError) summaryParts.push('有错误')
  if (hasStopped) summaryParts.push('已停止')
  if (summaryParts.length === 0) summaryParts.push(`${stepCount} 步`)
```

Button text should remain concise:

```tsx
        <span>{collapsed ? summaryParts.join(' · ') : '收起过程'}</span>
```

- [ ] **Step 3: Keep approval and plan visible**

Open `projects/desktop-agent/src/renderer/src/components/ProcessFlow.tsx`. Confirm `PlanCard`, `TodoChecklist`, `SubtaskList`, and `ApprovalCard` are outside `TurnItemsView` and therefore not hidden by historical process folding. Do not move them into `CollapsedTurnBar`.

- [ ] **Step 4: Run focused check**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes with no new TypeScript errors.

- [ ] **Step 5: Commit task**

```bash
git add projects/desktop-agent/src/renderer/src/components/TurnItemsView.tsx projects/desktop-agent/src/renderer/src/components/CollapsedTurnBar.tsx projects/desktop-agent/src/renderer/src/components/ProcessFlow.tsx
git commit -m "style: 收敛历史过程展示"
```

---

### Task 7: End-to-End Verification and Notes

**Files:**
- Modify if needed: `docs/superpowers/specs/2026-07-04-xiaolanjing-codex-chat-iteration-design.md`
- Verify: all changed files from previous tasks

**Interfaces:**
- Consumes: all task deliverables.
- Produces: verified result summary and any known limitations.

- [ ] **Step 1: Run project build**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes successfully.

- [ ] **Step 2: Run broader repository check if available**

Run:

```bash
uv run pytest
```

Expected: existing checks pass, or any unrelated historical failures are clearly listed with file names and failing cases.

- [ ] **Step 3: Manual smoke check in app**

Run:

```bash
cd projects/desktop-agent && pnpm dev
```

Manual checks:

- 首页 can submit a simple task.
- During execution, empty input button stops the task.
- During execution, typed text sends a follow-up.
- `@` file reference opens file list and selected file becomes an attachment.
- Thinking card remains readable after completion.
- Right panel shows quiet empty states when no output/source exists.
- Historical turns remain expandable.

- [ ] **Step 4: Capture limitations**

If runtime follow-up is still only acknowledged but not truly consumed by the running task, append this note to the final delivery summary:

```md
运行中补充要求的输入体验已补齐；当前执行层如果只回执“已收到”而未实际插入当前任务，我已明确标出，后续需要单独做“补充要求队列真正生效”。
```

- [ ] **Step 5: Final commit if verification notes changed docs**

```bash
git add docs/superpowers/specs/2026-07-04-xiaolanjing-codex-chat-iteration-design.md
git commit -m "docs: 补充小蓝鲸对话优化验证说明"
```

Only run this commit if the document actually changed.

---

## Execution Order

1. Task 1 fixes file reference bridge.
2. Task 2 fixes thinking content retention.
3. Task 3 changes the bottom send/stop interaction.
4. Task 4 adds the progress pill.
5. Task 5 reframes the right panel.
6. Task 6 quiets historical process display.
7. Task 7 verifies the whole flow and records limitations.

Each task must pass its own build check before the next task starts.
