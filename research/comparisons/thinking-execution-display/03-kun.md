# Kun：思考+执行交替展示逻辑调研

> 调研对象：Kun（Kun 运行时的 Electron 工作台，v0.1.0，React + TypeScript + Electron，HTTP/SSE）
> 源码位置：projects/competitor-references/01-desktop-apps/Kun/src/renderer/src/
> 调研日期：2026-07-03
> 核查范围：完整源码，重点核查 MessageTimeline.tsx、message-timeline-process.tsx、agent/types.ts

---

## 一、核心结论

Kun 采用**"消息时间线"体系**，是本次调研中结构化程度最高的实现：

1. **显式分段**：把消息块分组为"思考段/执行段/产出段/子智能体段"四种段落（ProcessSection），相邻同类合并
2. **双层折叠**：段落级折叠（ProcessSectionRow）+ 段落内块级折叠（ProcessStackRows）
3. **四层展开优先级**：强制展开 > 用户手动 > 默认展开 > 折叠，逻辑非常精细
4. **虚拟分页+自动折叠**：每页 18 轮，超 24 轮自动折叠历史，支持"折叠更早的轮次"
5. **错误感知**：错误段默认展开但可收起，有独立错误色系

---

## 二、数据结构

### 2.1 ChatBlock 块种类全集

源码位置：`src/renderer/src/agent/types.ts:261`

| 块类型 (kind) | 说明 | 状态值 |
|--------------|------|--------|
| `user` | 用户消息 | — |
| `assistant` | 智能体回复 | — |
| `reasoning` | 思考推理 | — |
| `system` | 系统消息 | severity: info/warning/error |
| `tool` | 工具调用 | running/success/error |
| `compaction` | 上下文压缩 | running/success/error |
| `approval` | 审批请求 | pending/submitting/allowed/denied/error |
| `user_input` | 用户输入请求 | pending/submitted/cancelled/error |
| `plan` | 计划 | — |
| `review` | 代码审查 | running/success/error |
| `agent_message` / `agent_reasoning` | 智能体消息/推理 | — |

### 2.2 子智能体状态

```typescript
childStatus: 'queued' | 'running' | 'completed' | 'failed' | 'aborted'
```

### 2.3 计划步骤状态

```typescript
ThreadTodoStatus: 'pending' | 'in_progress' | 'completed'
```

---

## 三、分段逻辑（groupProcessSections）

源码位置：`src/renderer/src/components/chat/message-timeline-process.tsx`

### 3.1 段落类型

```typescript
type ProcessSection = {
  id: string
  kind: 'reasoning' | 'execution' | 'output' | 'subagent'
  blocks: ChatBlock[]
}
```

### 3.2 分段规则

遍历块数组，按 kind 分类：
1. 子智能体块（`delegate_task` 或带 child 元数据的 tool）→ `subagent` 段，相同 parentTurnId 的合并
2. reasoning 块 → `reasoning` 段
3. assistant 块 → `output` 段
4. 其他（tool/compaction/approval/user_input/system/plan/review）→ `execution` 段
5. 相邻同类的块合并到同一段

### 3.3 段落图标映射

| 段落类型 | 图标 |
|---------|------|
| reasoning | Brain（脑） |
| output | MessageSquareQuote（对话引用） |
| execution | 按块类型：Terminal（命令）/ Wrench（工具）/ Search（搜索）等 |
| subagent | SubagentGroup 组件独立渲染 |

---

## 四、段落级折叠（ProcessSectionRow）

### 4.1 展开优先级（四层）

```typescript
defaultExpanded =
  (processing && hasError) ||                           // 进行中且有错误
  sectionHasPendingApproval(section) ||                  // 有待审批
  (active && section.kind === 'reasoning') ||            // 活跃的思考段
  (processing && section.kind === 'execution' && sectionHasRequestUserInput(section))  // 执行段需用户输入

forceExpanded = sectionHasPendingApproval(section)       // 待审批强制展开

expanded = hasDetails && (forceExpanded || (userExpanded ?? defaultExpanded))
```

优先级：forceExpanded > userExpanded > defaultExpanded > 折叠

### 4.2 默认展开场景

| 场景 | 默认展开 |
|------|---------|
| 进行中且有错误 | 是 |
| 有待审批 | 是（且强制） |
| 活跃的思考段 | 是 |
| 执行段需用户输入 | 是 |
| 其他 | 否（折叠） |

### 4.3 段落标题

- reasoning 段：思考标题 + 计时（reasoningDurationMs）
- output 段：产出标题
- execution 段：取第一个块的描述

### 4.4 特殊处理

- 单个执行块：不套折叠外壳，直接渲染 `<ProcessEntryRow>`（减少嵌套）
- output 段：直接渲染 assistant 块详情，不套折叠
- subagent 段：用 `<SubagentGroup>` 独立渲染
- 延迟渲染：`useDeferredRender` 优化，非活跃段展开时延迟渲染详情

---

## 五、段落内块级折叠（ProcessStackRows）

### 5.1 块级展开优先级

```typescript
defaultOpen = isError              // 错误默认展开
forceOpen = autoOpenPending || autoOpenRequestInput  // 审批/输入强制展开
userClosed = closedBlockIds.has(block.id)            // 用户手动关闭
userOpened = openBlockId === block.id                // 用户手动打开

open = canExpand && (forceOpen || userOpened || (defaultOpen && !userClosed))
```

### 5.2 块级状态判定

| 判定 | 条件 |
|------|------|
| 运行中工具 | processing && kind==='tool' && status==='running' |
| 自动展开待定 | compaction running / approval pending / user_input pending |
| 活跃块 | 运行中工具 / 自动展开待定 / live-assistant |

### 5.3 错误色系

| 错误类型 | 文字色 | 圆点色 |
|---------|--------|--------|
| tool 错误 | 橙色（orange-700） | 橙色（orange-500） |
| 系统错误 | 红色（red-600） | 红色（red-500） |
| 无错误 | 灰色（ds-muted） | 无 |

---

## 六、虚拟分页与"只留结论"

### 6.1 分页参数

```typescript
TURN_PAGE_SIZE = 18           // 每页 18 轮
AUTO_COLLAPSE_THRESHOLD = 24  // 超过 24 轮自动折叠
```

### 6.2 useTimelineScroll

```typescript
{
  visibleTurnCount,     // 可见轮次数
  hiddenTurnCount,      // 隐藏轮次数
  loadEarlierTurns,     // 加载更早轮次
  collapseEarlierTurns  // 折叠更早轮次
}
```

### 6.3 折叠行为

| 场景 | 行为 |
|------|------|
| 轮次 > 24 且未忙碌 | 显示"折叠更早的轮次"按钮 |
| 用户点击折叠 | `collapseEarlierTurns()`，历史轮次隐藏 |
| hiddenTurnCount > 0 | 显示"加载更早的轮次"按钮 |
| 用户点击加载 | `loadEarlierTurns()`，恢复显示 |

### 6.4 始终渲染规则

```typescript
alwaysRender = index >= turns.length - 3 || index === forcedRailTurnIndex
```

最近 3 轮始终渲染（流式、自动滚动、平滑 UX 需要），更早的轮次用 `LazyRenderTurn` 懒加载。

---

## 七、产品体验总结

### 7.1 用户看到的完整流程

1. 用户发消息 → 智能体开始思考 → "思考段"出现，Brain 图标，活跃时自动展开+流式逐字
2. 思考完成 → 思考段收起，显示标题+计时
3. 执行工具 → "执行段"出现，Terminal/Wrench 图标
4. 多个工具 → 合并到同一执行段，段内每块可独立折叠
5. 产出回复 → "产出段"出现，MessageSquareQuote 图标
6. 思考+执行+产出交替 → 形成时间线
7. 超过 24 轮 → 自动折叠历史，显示"折叠更早的轮次"
8. 出错 → 错误段/块默认展开（橙色/红色），可手动收起

### 7.2 开发参考要点

1. **显式分段**：不依赖块类型交替，主动分组为语义段落，结构更清晰
2. **四层优先级**：强制>用户>默认>折叠，处理审批/错误/输入等特殊场景
3. **双层折叠**：段落级 + 块级，颗粒度更细
4. **虚拟分页**：大对话不卡，自动折叠+手动折叠+懒加载
5. **错误感知**：错误默认展开但可收起，不强制占屏
6. **延迟渲染**：非活跃段展开时延迟渲染详情，性能优化

### 7.3 与 Codex 的差异

| 维度 | Codex | Kun |
|------|-------|-----|
| 交替结构 | 列表顺序天然交替 | 显式分段（reasoning/execution/output/subagent） |
| 折叠层次 | 单层+压缩 | 双层（段落+块） |
| 展开优先级 | 未完全确认 | 四层（强制/用户/默认/折叠） |
| 历史折叠 | compact 压缩 | 虚拟分页+自动折叠阈值 |
| 错误处理 | failed 状态 | 错误默认展开+独立色系 |
