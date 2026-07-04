# Xiaolanjing Unified Execution Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把小鲸鱼运行中的输入接管、过程展示、命令折叠、反问面板、步骤提示、完成折叠和颜色体验统一收口。

**Architecture:** 保留现有对话页骨架，只在输入区、过程区和状态派生层做小步改造。新增少量专用展示组件，把“反问面板”“顶部过程摘要”“步骤悬浮详情”从原有过程流里拆出来，避免继续堆在同一个展示块里。

**Tech Stack:** Electron, React, TypeScript, Zustand, lucide-react, Tailwind CSS, pnpm, electron-vite.

## Global Constraints

- 不重做整套页面。
- 不新增复杂产物编辑器。
- 不新增完整富文本输入框。
- 不删除历史旧代码。
- 不把右侧栏重新设计成新产品。
- 不提前做无关能力。
- 普通强调色统一使用小鲸鱼蓝。
- 红色只保留给错误、危险、拒绝、删除等高风险动作。
- 每一步改完都运行 `cd projects/desktop-agent && pnpm build`。
- 当前已有未提交改动，动手前先查看文件内容，不覆盖已有工作。

---

## File Map

- `projects/desktop-agent/src/renderer/src/components/ChatInput.tsx`：发送按钮、停止按钮图标和运行中追加状态。
- `projects/desktop-agent/src/renderer/src/components/Composer.tsx`：输入框上方组合区，承载反问面板和步骤提示。
- `projects/desktop-agent/src/renderer/src/components/ComposerQuestionPanel.tsx`：新建反问面板，负责单题、多题、单选、多选、其他输入、跳过当前、跳过全部。
- `projects/desktop-agent/src/renderer/src/components/ProgressPill.tsx`：改为“转圈 + 第 X / X 步”，增加悬停步骤详情。
- `projects/desktop-agent/src/renderer/src/components/ExecutionSummaryBar.tsx`：新建顶部过程摘要，负责“正在思考”和“已处理 X 秒”。
- `projects/desktop-agent/src/renderer/src/components/executionExperience.ts`：新建状态派生工具，统一计算耗时、步骤、思考次数、动作次数、短文案。
- `projects/desktop-agent/src/renderer/src/components/ProcessFlow.tsx`：接入顶部过程摘要，去掉悬浮状态条，避免小白块。
- `projects/desktop-agent/src/renderer/src/components/TurnItemsView.tsx`：让反问退出过程流，保留思考、动作、文件变更。
- `projects/desktop-agent/src/renderer/src/components/ToolSpecialViews.tsx`：命令默认一行，展开后内部滚动。
- `projects/desktop-agent/src/renderer/src/components/CollapsedTurnBar.tsx`：完成折叠文案改为“思考 X 次，执行了 X 个动作，总耗时 X 分 X 秒”。
- `projects/desktop-agent/src/renderer/src/components/toolActivityText.ts`：命令和工具短文案收敛，避免一行过长。
- `projects/desktop-agent/src/renderer/src/index.css`：新增蓝色扫光、步骤悬浮和统一蓝色变量。
- `projects/desktop-agent/src/renderer/src/store/task.ts`：支持反问面板提交“跳过全部”和分题答案。
- `projects/desktop-agent/src/agent/src/items.ts`：让过程记录能保存分题反问信息。
- `projects/desktop-agent/src/agent/src/tools/question.ts`：让反问工具支持一次给出多题。
- `projects/desktop-agent/src/agent/src/protocol.ts`：补充分题反问字段。
- `projects/desktop-agent/src/agent/src/loop/react.ts`：把多题反问结果转成清晰文字回给任务继续处理。

---

### Task 1: Add Execution Display Helpers

**Files:**
- Create: `projects/desktop-agent/src/renderer/src/components/executionExperience.ts`
- Modify: `projects/desktop-agent/src/renderer/src/index.css`

**Interfaces:**
- Produces: `formatDuration(ms: number): string`
- Produces: `deriveExecutionSummary(status: string, turn: Turn | null, now: number): ExecutionSummary`
- Produces: `deriveProgressSteps(turn: Turn | null, todos: TodoItem[]): ProgressStepView[]`
- Produces: `trimStepLabel(value: string): string`

- [ ] **Step 1: Create shared display helper**

Create `projects/desktop-agent/src/renderer/src/components/executionExperience.ts` with:

```ts
import type { ReasoningItem, ToolCallItem, Turn } from '../../../agent/src/items'
import type { TodoItem } from '../store/task'
import { describeToolCall } from './toolActivityText'

export interface ExecutionSummary {
  mode: 'idle' | 'thinking' | 'processed'
  label: string
  elapsedLabel: string
  hasFirstResult: boolean
}

export interface ProgressStepView {
  id: string
  label: string
  status: 'running' | 'pending' | 'completed'
}

const DONE_STATUSES = new Set(['completed', 'failed', 'stopped', 'canceled'])

export function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000))
  if (sec < 60) return `${sec} 秒`
  const minute = Math.floor(sec / 60)
  const rest = sec % 60
  return rest > 0 ? `${minute} 分 ${rest} 秒` : `${minute} 分`
}

export function formatCompactDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000))
  if (sec < 60) return `${sec} 秒`
  const minute = Math.floor(sec / 60)
  const rest = sec % 60
  return rest > 0 ? `${minute} 分 ${rest} 秒` : `${minute} 分`
}

export function trimStepLabel(value: string): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (!clean) return '处理中'
  return clean.length > 15 ? `${clean.slice(0, 14)}…` : clean
}

export function getToolItems(turn: Turn | null): ToolCallItem[] {
  return (turn?.items ?? []).filter((item): item is ToolCallItem => item.type === 'toolCall')
}

export function getReasoningItems(turn: Turn | null): ReasoningItem[] {
  return (turn?.items ?? []).filter((item): item is ReasoningItem => item.type === 'reasoning')
}

export function deriveExecutionSummary(status: string, turn: Turn | null, now: number): ExecutionSummary {
  if (status !== 'executing' || !turn) {
    return { mode: 'idle', label: '', elapsedLabel: '', hasFirstResult: false }
  }
  const tools = getToolItems(turn)
  const reasonings = getReasoningItems(turn)
  const hasFirstResult = tools.some((item) => DONE_STATUSES.has(item.status)) ||
    reasonings.some((item) => item.status === 'completed' || Boolean(item.finishedAt)) ||
    turn.items.some((item) => item.type === 'agentMessage' && item.text.trim().length > 0)
  const elapsedLabel = formatDuration(now - turn.startedAt)
  if (!hasFirstResult) {
    return { mode: 'thinking', label: '正在思考', elapsedLabel, hasFirstResult }
  }
  return { mode: 'processed', label: `已处理 ${elapsedLabel}`, elapsedLabel, hasFirstResult }
}

export function deriveProgressSteps(turn: Turn | null, todos: TodoItem[]): ProgressStepView[] {
  if (todos.length > 0) {
    return todos.map((todo) => ({
      id: todo.id,
      label: trimStepLabel(todo.content),
      status: todo.status === 'completed' ? 'completed' : todo.status === 'in_progress' ? 'running' : 'pending'
    }))
  }

  return getToolItems(turn).map((item, index) => ({
    id: item.id,
    label: trimStepLabel(describeToolCall(item).replace(/^正在/, '').replace(/^已/, '')),
    status: item.status === 'running' || item.status === 'pending'
      ? 'running'
      : DONE_STATUSES.has(item.status)
        ? 'completed'
        : 'pending'
  })).map((step, index, all) => {
    if (step.status === 'running') return step
    const hasRunning = all.some((item) => item.status === 'running')
    if (!hasRunning && step.status === 'pending' && index === 0) return { ...step, status: 'running' }
    return step
  })
}

export function countCompletedSteps(steps: ProgressStepView[]): number {
  return steps.filter((step) => step.status === 'completed').length
}
```

- [ ] **Step 2: Add blue motion styles**

Append to `projects/desktop-agent/src/renderer/src/index.css`:

```css
:root {
  --whale-blue: #0071e3;
  --whale-blue-soft: rgba(0, 113, 227, 0.12);
}

.whale-shimmer {
  position: relative;
  overflow: hidden;
}

.whale-shimmer::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-120%);
  background: linear-gradient(90deg, transparent, rgba(0, 113, 227, 0.20), transparent);
  animation: whale-shimmer-sweep 1.4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes whale-shimmer-sweep {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(120%); }
}
```

- [ ] **Step 3: Verify build**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes without new errors.

- [ ] **Step 4: Commit task**

Run:

```bash
git add projects/desktop-agent/src/renderer/src/components/executionExperience.ts projects/desktop-agent/src/renderer/src/index.css
git commit -m "feat: 增加执行展示状态计算"
```

---

### Task 2: Update Send Button And Step Pill

**Files:**
- Modify: `projects/desktop-agent/src/renderer/src/components/ChatInput.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/components/ProgressPill.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/components/Composer.tsx`

**Interfaces:**
- Consumes: `deriveProgressSteps(turn, todos)` from Task 1.
- Produces: running empty input shows stop icon; progress pill shows spinner and hover step list.

- [ ] **Step 1: Change stop icon**

In `projects/desktop-agent/src/renderer/src/components/ChatInput.tsx`, change the lucide import so it includes `StopCircle`:

```ts
import { Plus, ArrowUp, ChevronDown, Check, X, FileText, Image as ImageIcon, Eye, AlertCircle, FolderPlus, FolderOpen, History, AtSign, Target, StopCircle } from 'lucide-react'
```

Then replace the send button icon block with:

```tsx
{shouldStop ? <StopCircle size={18} /> : <ArrowUp size={16} />}
```

Keep the existing button click behavior unchanged.

- [ ] **Step 2: Pass todos into progress pill**

In `projects/desktop-agent/src/renderer/src/components/Composer.tsx`, include `todos` from the store:

```ts
const { status, message, setMessage, startTask, appendInput, cancelTask, taskId, messages, currentTurn, approvalPending, todos } = useTaskStore()
```

Then update the progress pill call:

```tsx
<ProgressPill status={status} currentTurn={currentTurn} todos={todos} hasApprovalPending={Boolean(approvalPending)} />
```

- [ ] **Step 3: Replace progress pill implementation**

Replace `projects/desktop-agent/src/renderer/src/components/ProgressPill.tsx` with:

```tsx
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { Turn } from '../../../agent/src/items'
import type { TodoItem } from '../store/task'
import { countCompletedSteps, deriveProgressSteps } from './executionExperience'

type Props = {
  status: string
  currentTurn: Turn | null
  todos: TodoItem[]
  hasApprovalPending: boolean
}

export function ProgressPill({ status, currentTurn, todos, hasApprovalPending }: Props) {
  if (hasApprovalPending) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs text-amber-700">
        <AlertCircle size={13} />
        等待你确认
      </div>
    )
  }

  const steps = deriveProgressSteps(currentTurn, todos)
  if (status !== 'executing' || steps.length === 0) return null

  const done = countCompletedSteps(steps)
  const runningIndex = steps.findIndex((step) => step.status === 'running')
  const current = runningIndex >= 0 ? runningIndex + 1 : Math.min(done + 1, steps.length)
  const complete = done >= steps.length

  return (
    <div className="relative group/progress inline-flex">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-black/[0.06] px-2.5 py-1 text-xs text-[var(--ink-soft)] shadow-sm">
        {complete ? <CheckCircle2 size={13} className="text-green-500" /> : <Loader2 size={13} className="text-sky-500 animate-spin" />}
        <span>{complete ? `已完成 ${steps.length} 步` : `第 ${current} / ${steps.length} 步`}</span>
      </div>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden w-72 -translate-x-1/2 rounded-2xl border border-white/60 bg-white/95 p-2 shadow-xl group-hover/progress:block">
        <div className="space-y-1">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs">
              <span className={`h-2 w-2 rounded-full ${
                step.status === 'completed' ? 'bg-green-500' : step.status === 'running' ? 'bg-sky-500 animate-pulse' : 'bg-black/15'
              }`} />
              <span className="w-10 text-[var(--ink-soft)]">第 {index + 1} 步</span>
              <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{step.label}</span>
              <span className="text-[var(--ink-soft)]">
                {step.status === 'completed' ? '完成' : step.status === 'running' ? '进行中' : '未开始'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes without new errors.

- [ ] **Step 5: Commit task**

Run:

```bash
git add projects/desktop-agent/src/renderer/src/components/ChatInput.tsx projects/desktop-agent/src/renderer/src/components/ProgressPill.tsx projects/desktop-agent/src/renderer/src/components/Composer.tsx
git commit -m "feat: 优化运行中输入和步骤提示"
```

---

### Task 3: Move Questions Into Composer Panel

**Files:**
- Create: `projects/desktop-agent/src/renderer/src/components/ComposerQuestionPanel.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/components/Composer.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/components/TurnItemsView.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/store/task.ts`

**Interfaces:**
- Consumes: `pendingQuestion` and `respondQuestion(...)` from the store.
- Produces: input-adjacent question panel with single choice, multiple choice, custom answer, skip current, and close as skip all.

- [ ] **Step 1: Extend question answer function shape**

In `projects/desktop-agent/src/renderer/src/store/task.ts`, change the `respondQuestion` type:

```ts
respondQuestion: (selectedOptionIds?: string[], customAnswer?: string, skipped?: boolean, skipAll?: boolean) => Promise<void>
```

Then replace the implementation with:

```ts
respondQuestion: async (selectedOptionIds?: string[], customAnswer?: string, skipped?: boolean, skipAll?: boolean) => {
  const { pendingQuestion } = get()
  if (pendingQuestion) {
    const finalCustomAnswer = skipAll
      ? JSON.stringify({ skipped_all: true }, null, 2)
      : customAnswer
    await api.sendQuestionResponse(pendingQuestion.requestId, selectedOptionIds, finalCustomAnswer, skipped || skipAll)
    set({ pendingQuestion: null })
  }
},
```

- [ ] **Step 2: Create composer question panel**

Create `projects/desktop-agent/src/renderer/src/components/ComposerQuestionPanel.tsx` with:

```tsx
import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Edit3, X } from 'lucide-react'
import type { QuestionRequest } from '../store/task'

interface Props {
  question: QuestionRequest
  onAnswer: (selectedOptionIds: string[], customAnswer: string, skipped: boolean, skipAll?: boolean) => Promise<void>
}

interface AnswerDraft {
  selectedOptionIds: string[]
  customAnswer: string
  skipped: boolean
}

export function ComposerQuestionPanel({ question, onAnswer }: Props) {
  const prompts = useMemo(() => [question], [question])
  const [index, setIndex] = useState(0)
  const [drafts, setDrafts] = useState<Record<number, AnswerDraft>>({})
  const current = prompts[index]
  const draft = drafts[index] || { selectedOptionIds: [], customAnswer: '', skipped: false }
  const isLast = index === prompts.length - 1

  const setDraft = (next: AnswerDraft): void => {
    setDrafts((prev) => ({ ...prev, [index]: next }))
  }

  const finishCurrent = async (next: AnswerDraft): Promise<void> => {
    setDraft(next)
    if (!isLast) {
      setIndex(index + 1)
      return
    }
    await onAnswer(next.selectedOptionIds, next.customAnswer.trim(), next.skipped, false)
  }

  const toggleOption = async (optionId: string): Promise<void> => {
    if (current.multiple) {
      const selected = draft.selectedOptionIds.includes(optionId)
        ? draft.selectedOptionIds.filter((id) => id !== optionId)
        : [...draft.selectedOptionIds, optionId]
      setDraft({ ...draft, selectedOptionIds: selected, skipped: false })
      return
    }
    await finishCurrent({ selectedOptionIds: [optionId], customAnswer: '', skipped: false })
  }

  const submitCustom = async (): Promise<void> => {
    if (!draft.customAnswer.trim()) return
    await finishCurrent({ selectedOptionIds: [], customAnswer: draft.customAnswer.trim(), skipped: false })
  }

  const skipCurrent = async (): Promise<void> => {
    await finishCurrent({ selectedOptionIds: [], customAnswer: '', skipped: true })
  }

  const skipAll = async (): Promise<void> => {
    await onAnswer([], '', true, true)
  }

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/92 shadow-sm">
      <div className="flex items-center gap-3 border-b border-black/[0.04] px-5 py-4">
        <div className="min-w-0 flex-1 text-base font-semibold text-[var(--ink)]">
          {current.question}
          {current.multiple && <span className="ml-3 font-normal text-[var(--ink-soft)]">（可多选）</span>}
        </div>
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="rounded-lg p-1 text-[var(--ink-soft)] hover:bg-black/[0.04] disabled:opacity-30">
          <ChevronLeft size={20} />
        </button>
        <span className="w-12 text-center text-sm text-[var(--ink)]">{index + 1} / {prompts.length}</span>
        <button type="button" disabled={isLast} onClick={() => setIndex(index + 1)} className="rounded-lg p-1 text-[var(--ink-soft)] hover:bg-black/[0.04] disabled:opacity-30">
          <ChevronRight size={20} />
        </button>
        <button type="button" onClick={skipAll} className="rounded-lg p-1 text-[var(--ink-soft)] hover:bg-black/[0.04]" title="跳过全部">
          <X size={20} />
        </button>
      </div>

      <div className="px-5 py-3">
        {current.detail && <div className="mb-2 text-sm text-[var(--ink-soft)]">{current.detail}</div>}
        <div className="divide-y divide-black/[0.06]">
          {current.options.map((option, optionIndex) => {
            const selected = draft.selectedOptionIds.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => void toggleOption(option.id)}
                className={`group flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition ${selected ? 'bg-black/[0.06]' : 'hover:bg-black/[0.04]'}`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-semibold ${selected ? 'bg-[var(--ink)] text-white' : 'bg-black/[0.06] text-[var(--ink)]'}`}>
                  {current.multiple && selected ? <Check size={16} /> : optionIndex + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-[var(--ink)]">{option.label}</span>
                  {option.description && <span className="mt-1 block text-xs text-[var(--ink-soft)]">{option.description}</span>}
                </span>
                {current.multiple ? (
                  selected && <Check size={18} className="text-[var(--ink)]" />
                ) : (
                  <ChevronRight size={18} className="opacity-0 transition group-hover:opacity-100" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-black/[0.04] px-5 py-3">
        <Edit3 size={18} className="text-[var(--ink)]" />
        <input
          value={draft.customAnswer}
          onChange={(event) => setDraft({ ...draft, customAnswer: event.target.value, selectedOptionIds: [], skipped: false })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submitCustom()
          }}
          placeholder="填写其他内容"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--ink-soft)]"
        />
        {draft.customAnswer.trim() && (
          <button type="button" onClick={() => void submitCustom()} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-white">
            <ChevronRight size={18} />
          </button>
        )}
        <button type="button" onClick={() => void skipCurrent()} className="rounded-full border border-black/[0.06] px-4 py-2 text-sm text-[var(--ink)] hover:bg-black/[0.03]">
          跳过
        </button>
        {current.multiple && (
          <button type="button" onClick={() => void finishCurrent({ ...draft, skipped: false })} className="inline-flex items-center gap-1 rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-white">
            <Check size={15} />
            完成
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Render the panel above the input**

In `projects/desktop-agent/src/renderer/src/components/Composer.tsx`, import the panel:

```ts
import { ComposerQuestionPanel } from './ComposerQuestionPanel'
```

Include `pendingQuestion` and `respondQuestion` from the store:

```ts
const { status, message, setMessage, startTask, appendInput, cancelTask, taskId, messages, currentTurn, approvalPending, todos, pendingQuestion, respondQuestion } = useTaskStore()
```

Render above the progress pill:

```tsx
{pendingQuestion && (
  <ComposerQuestionPanel question={pendingQuestion} onAnswer={respondQuestion} />
)}
```

- [ ] **Step 4: Remove questions from process flow**

In `projects/desktop-agent/src/renderer/src/components/TurnItemsView.tsx`, remove the `QuestionCard` import and remove this block:

```tsx
{questionItems.map((q) => (
  <QuestionCard key={q.id} item={q} />
))}
```

Keep `questionItems` only for collapse decisions if needed.

- [ ] **Step 5: Verify build**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes without new errors.

- [ ] **Step 6: Commit task**

Run:

```bash
git add projects/desktop-agent/src/renderer/src/components/ComposerQuestionPanel.tsx projects/desktop-agent/src/renderer/src/components/Composer.tsx projects/desktop-agent/src/renderer/src/components/TurnItemsView.tsx projects/desktop-agent/src/renderer/src/store/task.ts
git commit -m "feat: 将反问移动到输入框上方"
```

---

### Task 4: Support Multi-Question Requests

**Files:**
- Modify: `projects/desktop-agent/src/agent/src/items.ts`
- Modify: `projects/desktop-agent/src/agent/src/tools/question.ts`
- Modify: `projects/desktop-agent/src/agent/src/protocol.ts`
- Modify: `projects/desktop-agent/src/renderer/src/store/task.ts`
- Modify: `projects/desktop-agent/src/renderer/src/components/ComposerQuestionPanel.tsx`
- Modify: `projects/desktop-agent/src/agent/src/loop/react.ts`

**Interfaces:**
- Produces: `QuestionPrompt` shape shared by renderer store and protocol.
- Produces: `ask_question` can accept either one question or `questions: [...]`.
- Produces: grouped answers are returned as one readable answer string to the task.

- [ ] **Step 1: Add question prompt type to process record**

In `projects/desktop-agent/src/agent/src/items.ts`, add:

```ts
export interface QuestionPromptItem {
  id: string
  question: string
  detail?: string
  options: QuestionOptionItem[]
  multiple: boolean
  allowCustom: boolean
  allowSkip: boolean
}
```

Then extend `QuestionItem`:

```ts
export interface QuestionItem {
  type: 'question'
  id: string
  requestId: string
  question: string
  detail?: string
  options: QuestionOptionItem[]
  multiple: boolean
  allowCustom: boolean
  allowSkip: boolean
  prompts?: QuestionPromptItem[]
  decision: 'pending' | 'answered' | 'skipped'
  selectedOptionIds?: string[]
  customAnswer?: string
}
```

- [ ] **Step 2: Add question prompt types to renderer store**

In `projects/desktop-agent/src/renderer/src/store/task.ts`, add:

```ts
export interface QuestionPrompt {
  id: string
  question: string
  detail?: string
  options: QuestionOption[]
  multiple: boolean
  allowCustom: boolean
  allowSkip: boolean
}
```

Then extend `QuestionRequest`:

```ts
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
```

- [ ] **Step 3: Extend protocol event**

In `projects/desktop-agent/src/agent/src/protocol.ts`, add:

```ts
export interface QuestionPrompt {
  id: string
  question: string
  detail?: string
  options: QuestionOption[]
  multiple: boolean
  allowCustom: boolean
  allowSkip: boolean
}
```

Then change the `question_proposed` event to:

```ts
| { type: 'question_proposed'; request_id: string; question: string; detail?: string; options: QuestionOption[]; multiple: boolean; allow_custom: boolean; allow_skip: boolean; prompts?: QuestionPrompt[] }
```

- [ ] **Step 4: Parse grouped questions**

In `projects/desktop-agent/src/agent/src/tools/question.ts`, extend `ParsedQuestion`:

```ts
export interface ParsedQuestion {
  question: string
  detail?: string
  options: QuestionOptionItem[]
  multiple: boolean
  allowCustom: boolean
  allowSkip: boolean
  prompts: Array<{
    id: string
    question: string
    detail?: string
    options: QuestionOptionItem[]
    multiple: boolean
    allowCustom: boolean
    allowSkip: boolean
  }>
}
```

Inside `parseQuestionArgs`, add this helper before the return:

```ts
  const parseOne = (source: Record<string, unknown>, promptIndex: number) => {
    const promptQuestion = typeof source.question === 'string' && source.question.trim() ? source.question.trim() : question
    const promptDetail = typeof source.detail === 'string' && source.detail.trim() ? source.detail.trim() : undefined
    const sourceOptions = Array.isArray(source.options) ? source.options : []
    const promptOptions = sourceOptions
      .map((raw, index) => {
        const option = raw as Record<string, unknown>
        const label = typeof option.label === 'string' ? option.label.trim() : ''
        if (!label) return null
        const description = typeof option.description === 'string' && option.description.trim() ? option.description.trim() : undefined
        return { id: `q${promptIndex + 1}-option-${index + 1}`, label, ...(description ? { description } : {}) }
      })
      .filter((item): item is QuestionOptionItem => Boolean(item))
      .slice(0, 6)
    return {
      id: `question-${promptIndex + 1}`,
      question: promptQuestion,
      ...(promptDetail ? { detail: promptDetail } : {}),
      options: promptOptions,
      multiple: Boolean(source.multiple),
      allowCustom: source.allow_custom !== false,
      allowSkip: source.allow_skip !== false
    }
  }

  const rawQuestions = Array.isArray(args.questions) ? args.questions : []
  const prompts = rawQuestions.length > 0
    ? rawQuestions
        .map((raw, index) => parseOne(raw as Record<string, unknown>, index))
        .filter((prompt) => prompt.question.trim().length > 0)
        .slice(0, 8)
    : [{
        id: 'question-1',
        question,
        ...(detail ? { detail } : {}),
        options,
        multiple: Boolean(args.multiple),
        allowCustom: args.allow_custom !== false,
        allowSkip: args.allow_skip !== false
      }]
```

Then return:

```ts
  return {
    question,
    ...(detail ? { detail } : {}),
    options,
    multiple: Boolean(args.multiple),
    allowCustom: args.allow_custom !== false,
    allowSkip: args.allow_skip !== false,
    prompts
  }
```

- [ ] **Step 5: Send prompts through question event**

In `projects/desktop-agent/src/agent/src/loop/react.ts`, inside the `ask_question` branch, add `prompts` to `questionItem` and the emitted event:

```ts
        prompts: parsedQuestion.prompts,
```

and:

```ts
        prompts: parsedQuestion.prompts
```

When building the tool result after `waitForQuestion`, replace the result with:

```ts
      const result = JSON.stringify({
        skipped: answer.skipped,
        selected_option_ids: answer.selectedOptionIds,
        selected_options: selectedLabels,
        custom_answer: answer.customAnswer
      })
```

Keep the existing shape so providers continue to receive one tool result.

- [ ] **Step 6: Store prompts on the renderer side**

In both `question_proposed` handlers in `projects/desktop-agent/src/renderer/src/store/task.ts`, change the patch/set payload to include:

```ts
prompts: msg.prompts
```

Full visible-task set payload:

```ts
set({ pendingQuestion: { requestId: msg.request_id, question: msg.question, detail: msg.detail, options: msg.options, multiple: msg.multiple, allowCustom: msg.allow_custom, allowSkip: msg.allow_skip, prompts: msg.prompts } })
```

- [ ] **Step 7: Render multiple prompts**

In `projects/desktop-agent/src/renderer/src/components/ComposerQuestionPanel.tsx`, replace:

```ts
const prompts = useMemo(() => [question], [question])
```

with:

```ts
const prompts = useMemo(() => question.prompts && question.prompts.length > 0 ? question.prompts : [{
  id: 'question-1',
  question: question.question,
  detail: question.detail,
  options: question.options,
  multiple: question.multiple,
  allowCustom: question.allowCustom,
  allowSkip: question.allowSkip
}], [question])
```

Then replace the final `onAnswer` call in `finishCurrent` with a grouped answer:

```ts
    const finalDrafts = { ...drafts, [index]: next }
    const customAnswer = prompts.map((prompt, promptIndex) => {
      const answer = finalDrafts[promptIndex] || { selectedOptionIds: [], customAnswer: '', skipped: true }
      const labels = prompt.options.filter((option) => answer.selectedOptionIds.includes(option.id)).map((option) => option.label)
      return {
        question: prompt.question,
        selected: labels,
        custom: answer.customAnswer,
        skipped: answer.skipped
      }
    })
    await onAnswer([], JSON.stringify(customAnswer, null, 2), false, false)
```

- [ ] **Step 8: Verify build**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes without new errors.

- [ ] **Step 9: Commit task**

Run:

```bash
git add projects/desktop-agent/src/agent/src/items.ts projects/desktop-agent/src/agent/src/tools/question.ts projects/desktop-agent/src/agent/src/protocol.ts projects/desktop-agent/src/renderer/src/store/task.ts projects/desktop-agent/src/renderer/src/components/ComposerQuestionPanel.tsx projects/desktop-agent/src/agent/src/loop/react.ts
git commit -m "feat: 支持连续反问选择"
```

---

### Task 5: Add Top Process Summary And Remove Floating White Block

**Files:**
- Create: `projects/desktop-agent/src/renderer/src/components/ExecutionSummaryBar.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/components/ProcessFlow.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/components/LiveStatusBar.tsx`

**Interfaces:**
- Consumes: `deriveExecutionSummary(status, turn, now)` from Task 1.
- Produces: fixed top summary inside process flow.
- Produces: no sticky white live status block inside the process area.

- [ ] **Step 1: Create execution summary bar**

Create `projects/desktop-agent/src/renderer/src/components/ExecutionSummaryBar.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Turn } from '../../../agent/src/items'
import { deriveExecutionSummary } from './executionExperience'

export function ExecutionSummaryBar({ status, turn }: { status: string; turn: Turn | null }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (status !== 'executing') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [status])

  const summary = deriveExecutionSummary(status, turn, now)
  if (summary.mode === 'idle') return null

  return (
    <div className="space-y-2">
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-sky-700 ${summary.mode === 'thinking' ? 'whale-shimmer bg-sky-50' : 'bg-sky-50/70'}`}>
        <Loader2 size={14} className="animate-spin" />
        <span>{summary.label}</span>
      </div>
      <div className="h-px w-full bg-black/[0.06]" />
    </div>
  )
}
```

- [ ] **Step 2: Insert summary into process flow**

In `projects/desktop-agent/src/renderer/src/components/ProcessFlow.tsx`, import:

```ts
import { ExecutionSummaryBar } from './ExecutionSummaryBar'
```

Then render it immediately after `ConnectionRecoveryBanner`:

```tsx
<ExecutionSummaryBar status={status} turn={latestTurn} />
```

- [ ] **Step 3: Remove the sticky white block**

In `projects/desktop-agent/src/renderer/src/components/ProcessFlow.tsx`, remove:

```tsx
<LiveStatusBar />
```

Also remove the import:

```ts
import { LiveStatusBar } from './LiveStatusBar'
```

Keep `LiveStatusBar.tsx` on disk for now, but do not render it in the process flow. This preserves rollback safety while removing the floating white block from the visible experience.

- [ ] **Step 4: Verify build**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes without new errors.

- [ ] **Step 5: Commit task**

Run:

```bash
git add projects/desktop-agent/src/renderer/src/components/ExecutionSummaryBar.tsx projects/desktop-agent/src/renderer/src/components/ProcessFlow.tsx
git commit -m "feat: 增加顶部过程摘要"
```

---

### Task 6: Make Command Details Quiet By Default

**Files:**
- Modify: `projects/desktop-agent/src/renderer/src/components/ToolSpecialViews.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/components/toolActivityText.ts`

**Interfaces:**
- Produces: shell command row always starts collapsed.
- Produces: details have fixed maximum height and internal scrolling.
- Produces: running command row has blue motion feedback without opening details.

- [ ] **Step 1: Keep shell command collapsed by default**

In `projects/desktop-agent/src/renderer/src/components/ToolSpecialViews.tsx`, inside `ShellOutputView`, replace:

```ts
const [open, setOpen] = useState(item.status === 'running' || item.status === 'failed')
```

with:

```ts
const [open, setOpen] = useState(false)
```

- [ ] **Step 2: Add running shimmer to shell row**

In the shell row button class, replace:

```tsx
className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-black/[0.02] transition"
```

with:

```tsx
className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-black/[0.02] transition ${isRunning ? 'whale-shimmer bg-sky-50/40' : ''}`}
```

- [ ] **Step 3: Keep detail height capped**

In the shell output detail block, keep:

```tsx
<DetailPre tone={hasError ? 'danger' : 'neutral'} maxHeight="max-h-72">
```

If the current file differs, set shell output detail max height to `max-h-72`.

- [ ] **Step 4: Shorten shell labels**

In `projects/desktop-agent/src/renderer/src/components/toolActivityText.ts`, change the shell phrase:

```ts
shell: {
  doing: () => '正在执行命令',
  done: (_t, item) => item.resultSummary || '命令已执行'
},
```

The full command still appears inside `ToolSpecialViews.tsx` as the one-line row title and expanded detail.

- [ ] **Step 5: Verify build**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes without new errors.

- [ ] **Step 6: Commit task**

Run:

```bash
git add projects/desktop-agent/src/renderer/src/components/ToolSpecialViews.tsx projects/desktop-agent/src/renderer/src/components/toolActivityText.ts
git commit -m "feat: 收敛命令执行展示"
```

---

### Task 7: Update Completion Fold Copy

**Files:**
- Modify: `projects/desktop-agent/src/renderer/src/components/CollapsedTurnBar.tsx`

**Interfaces:**
- Consumes: `formatCompactDuration(ms)` from Task 1.
- Produces: completed turn fold says `思考 X 次，执行了 X 个动作，总耗时 X`.

- [ ] **Step 1: Import duration helper**

In `projects/desktop-agent/src/renderer/src/components/CollapsedTurnBar.tsx`, add:

```ts
import { formatCompactDuration } from './executionExperience'
```

- [ ] **Step 2: Replace summary text**

Replace the `summaryParts` construction with:

```ts
  const summaryText = `思考 ${reasoningItems.length} 次，执行了 ${toolItems.length} 个动作${elapsedMs > 0 ? `，总耗时 ${formatCompactDuration(elapsedMs)}` : ''}`
```

Then replace:

```tsx
<span>{collapsed ? summaryParts.join(' · ') : '收起过程'}</span>
{elapsedMs > 0 && collapsed && <span className="text-xs">· {formatMs(elapsedMs)}</span>}
```

with:

```tsx
<span>{collapsed ? summaryText : '收起过程'}</span>
```

- [ ] **Step 3: Remove old local formatter**

Remove the old `formatMs` function from the bottom of `CollapsedTurnBar.tsx`.

- [ ] **Step 4: Verify build**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes without new errors.

- [ ] **Step 5: Commit task**

Run:

```bash
git add projects/desktop-agent/src/renderer/src/components/CollapsedTurnBar.tsx
git commit -m "feat: 优化完成后过程摘要"
```

---

### Task 8: Preserve Timeline Append And Blue Tone

**Files:**
- Modify: `projects/desktop-agent/src/renderer/src/components/TurnItemsView.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/components/ReasoningBlock.tsx`
- Modify: `projects/desktop-agent/src/renderer/src/components/markdown/markdown.css`
- Modify: `projects/desktop-agent/src/renderer/src/index.css`

**Interfaces:**
- Produces: live reasoning and tool rows remain appended in the existing order.
- Produces: ordinary markdown emphasis uses blue accents instead of red.

- [ ] **Step 1: Confirm process items are appended**

Open `projects/desktop-agent/src/renderer/src/store/turns.ts` and verify `item_started` appends:

```ts
items: [...state.currentTurn.items, msg.item]
```

If this line is present, do not change it. The process timeline already has the correct append base.

- [ ] **Step 2: Keep TurnItemsView order stable**

In `projects/desktop-agent/src/renderer/src/components/TurnItemsView.tsx`, keep the order:

```tsx
{showThinking && reasoningItems.map((r) => (
  <ReasoningBlock key={r.id} item={r} finalAnswerStarted={finalAnswerStarted} />
))}

{fileChanges.length > 0 && (
  <FileChangeSection changes={fileChanges} collapsed={isCompleted} />
)}

{groups.length > 0 && (
  <div className={`glass rounded-xl p-1.5 ${isCompleted ? 'opacity-70' : ''}`}>
    <ProcessFold>
      {groups.map((g, i) => (
        <ToolActivityGroupView key={`${g.kind}-${i}`} group={g} />
      ))}
    </ProcessFold>
  </div>
)}
```

The required change is only that question cards no longer appear in this sequence.

- [ ] **Step 3: Add shimmer to active reasoning header**

In `projects/desktop-agent/src/renderer/src/components/ReasoningBlock.tsx`, update the header button class to include shimmer while active:

```tsx
className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition ${
  forceExpanded ? 'cursor-default' : 'hover:bg-black/[0.02] cursor-pointer'
} ${isActive ? 'whale-shimmer bg-sky-50/40' : ''}`}
```

- [ ] **Step 4: Change markdown red accents to blue**

In `projects/desktop-agent/src/renderer/src/components/markdown/markdown.css`, replace ordinary red accent rules with blue accent rules:

```css
.markdown-body a {
  color: var(--whale-blue);
}

.markdown-body blockquote {
  border-left-color: var(--whale-blue);
}
```

Keep existing red classes for errors or danger if present.

- [ ] **Step 5: Verify build**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes without new errors.

- [ ] **Step 6: Commit task**

Run:

```bash
git add projects/desktop-agent/src/renderer/src/components/TurnItemsView.tsx projects/desktop-agent/src/renderer/src/components/ReasoningBlock.tsx projects/desktop-agent/src/renderer/src/components/markdown/markdown.css projects/desktop-agent/src/renderer/src/index.css
git commit -m "feat: 统一过程追加和蓝色强调"
```

---

### Task 9: Final Verification

**Files:**
- Verify only; no planned file edits.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: validated implementation report.

- [ ] **Step 1: Run full build**

Run:

```bash
cd projects/desktop-agent && pnpm build
```

Expected: build completes without new errors.

- [ ] **Step 2: Run app locally**

Run:

```bash
cd projects/desktop-agent && pnpm dev
```

Expected: the app opens and the main page loads.

- [ ] **Step 3: Manual verification checklist**

Verify these user-visible behaviors:

```text
1. 发出任务后，运行中空输入显示圆形内方块停止按钮。
2. 运行中输入内容后，按钮变为追加发送。
3. 刚开始只显示“正在思考”并有蓝色扫光。
4. 第一轮结果后，顶部显示“已处理 X 秒”。
5. 多轮过程持续追加，旧内容不消失。
6. 命令默认只显示一行。
7. 命令展开后内容不会撑爆页面。
8. 反问面板出现在输入框上方。
9. 多题反问能按 1 / 4、2 / 4 连续处理。
10. 单选、多选、其他输入、跳过当前、跳过全部都能正确继续。
11. 步骤提示能显示当前步，并能悬停查看详情。
12. 完成折叠文案为“思考 X 次，执行了 X 个动作，总耗时 X 分 X 秒”。
13. 普通强调色为蓝色，错误仍为红色。
14. 执行命令时不再出现异常悬浮白块。
15. 历史对话恢复后，过程仍可展开查看。
16. 现有发送、附件、文件引用、权限确认不被破坏。
```

- [ ] **Step 4: Commit verification note if docs changed**

If verification adds or updates a note, run:

```bash
git add docs/superpowers/plans/2026-07-05-xiaolanjing-unified-execution-experience.md
git commit -m "docs: 记录小鲸鱼执行体验验证结果"
```

If no docs changed, skip this commit.
