# lobsterai：思考+执行交替展示逻辑调研

> 调研对象：LobsterAI（v2026.6.30，React + TypeScript + Heroicons）
> 源码位置：projects/competitor-references/01-desktop-apps/lobsterai/src/renderer/
> 调研日期：2026-07-03
> 核查范围：完整源码，重点核查 CoworkSessionDetail.tsx、AssistantTurnBlock.tsx、ThinkingBlock.tsx、ToolCallGroup.tsx、messageDisplayUtils.ts

---

## 一、核心结论

lobsterai 采用**"轮次（Turn）+ 轮次内交替"**的结构，特色在于工具结果的精细折叠和上下文压缩分隔：

1. **轮次组织**：对话按 ConversationTurn 组织（userMessage + assistantItems 数组），assistantItems 内消息/工具组/系统消息交替
2. **思考块**：思考时展开+脉冲指示，完成后收起，有分析埋点
3. **工具结果三层折叠**：预览（4KB）/ 全文显示（64KB）/ 超大只显示预览
4. **上下文压缩分隔器**：ContextCompactionDivider，带动画进度条
5. **虚拟化**：最近 3 轮始终渲染，更早的用 LazyRenderTurn 懒加载

---

## 二、数据结构

### 2.1 ConversationTurn

源码位置：`messageDisplayUtils.ts`

```typescript
type ConversationTurn = {
  id: string
  userMessage: CoworkMessage | null
  assistantItems: AssistantTurnItem[]
}

type AssistantTurnItem =
  | { type: 'assistant'; message: CoworkMessage }
  | { type: 'system'; message: CoworkMessage }
  | { type: 'tool_group'; group: ToolGroupItem }
  | { type: 'tool_result'; message: CoworkMessage }

type ToolGroupItem = {
  type: 'tool_group'
  toolUse: CoworkMessage
  toolResult?: CoworkMessage | null
  mediaPollOrdinal?: number
}
```

### 2.2 DisplayItem

```typescript
type DisplayItem =
  | { type: 'message'; message: CoworkMessage }
  | ToolGroupItem
```

---

## 三、轮次渲染逻辑

### 3.1 轮次遍历

源码位置：`CoworkSessionDetail.tsx`

```typescript
turns.map((turn, index) => {
  const isLastTurn = index === turns.length - 1
  const alwaysRender = index >= turns.length - 3 || index === forcedRailTurnIndex
  // ...
  return (
    <LazyRenderTurn key={turn.id} turnId={turn.id} alwaysRender={alwaysRender}>
      {turn.userMessage && <UserMessageItem />}
      {showAssistantBlock && <AssistantTurnBlock turn={turn} />}
    </LazyRenderTurn>
  )
})
```

### 3.2 虚拟化规则

| 条件 | 行为 |
|------|------|
| 最近 3 轮 | 始终渲染（alwaysRender） |
| 更早轮次 | LazyRenderTurn 懒加载 |
| 指定轨道轮次 | 始终渲染（forcedRailTurnIndex） |

---

## 四、轮次内交替渲染（AssistantTurnBlock）

源码位置：`AssistantTurnBlock.tsx`

### 4.1 渲染循环

```typescript
const visibleAssistantItems = getVisibleAssistantItems(turn.assistantItems)

visibleAssistantItems.map((item) => {
  if (item.type === 'media_polling_group') → MediaPollingIndicator
  if (item.type === 'assistant') {
    if (是思考消息) → <ThinkingBlock />
    else → <AssistantMessageItem />
  }
  if (item.type === 'tool_group') → <ToolCallGroup />
  if (item.type === 'system') → 系统消息（含压缩分隔器）
})
```

### 4.2 上下文压缩分隔器

ContextCompactionDivider：当上下文被压缩时，在对话流中插入一个分隔器：
- 两侧细线 + 中间压缩图标 + 标签文案
- 压缩进行中：图标脉冲动画 + 进度条
- 压缩完成：静态显示标签

---

## 五、思考块（ThinkingBlock）完整逻辑

源码位置：`src/renderer/components/cowork/ThinkingBlock.tsx`

### 5.1 展开折叠规则

```typescript
const isCurrentlyStreaming = Boolean(message.metadata?.isStreaming)
const [isExpanded, setIsExpanded] = useState(isCurrentlyStreaming)

useEffect(() => {
  setIsExpanded(isCurrentlyStreaming ? true : false)
}, [isCurrentlyStreaming])
```

| 场景 | 行为 |
|------|------|
| 流式中 | 自动展开 |
| 流式结束 | 自动收起 |
| 用户点击 | 切换展开/收起 |

### 5.2 视觉设计

- LightBulbIcon 图标（灯泡）
- "推理"文案（i18n: reasoning）
- 流式中：脉冲圆点指示器（animate-pulse）
- 展开箭头：ChevronRightIcon，展开时 rotate-90
- 内容区：max-h-[300px] 限高 + 滚动，whitespace-pre-wrap

### 5.3 分析埋点

展开/收起会触发 `reportConversationBlockAction`，记录：
- actionType: thinking_expand / thinking_collapse
- blockType: thinking
- params: isStreaming, thinkingLength, thinkingLengthBucket, thinkingLineCount

---

## 六、工具组（ToolCallGroup）完整逻辑

### 6.1 工具结果三层折叠

源码位置：`messageDisplayUtils.ts`

```typescript
TOOL_RESULT_COLLAPSED_FULL_DISPLAY_MAX_CHARS = 64 * 1024  // 64KB
TOOL_RESULT_COLLAPSED_PREVIEW_MAX_CHARS = 4 * 1024        // 4KB
```

| 结果大小 | 展示方式 |
|---------|---------|
| ≤ 4KB | 正常显示 |
| 4KB ~ 64KB | 显示预览（前 4KB）+ 可展开看全文 |
| > 64KB | 只显示预览（前 4KB），不提供全文 |

### 6.2 工具类型特化渲染

- TodoWrite 工具：渲染待办列表，每项有状态复选框（completed 绿色/in_progress 蓝色/pending 灰色）
- Bash 类工具：特殊展示
- Cron 工具：特殊展示
- 媒体生成：Lottie 动画（media-generating.json）
- Diff 工具：DiffView 组件展示代码变更

### 6.3 工具状态

- 流式中：`selectIsStreaming` 控制状态
- 完成：CheckIcon 对勾

---

## 七、产品体验总结

### 7.1 用户看到的完整流程

1. 用户发消息 → UserMessageItem 显示
2. 思考出现 → ThinkingBlock 自动展开，灯泡图标+脉冲圆点+"推理"文案
3. 思考完成 → 自动收起，点击可重新展开
4. 工具调用 → ToolCallGroup 出现，显示工具名+输入摘要
5. 工具结果 → 按大小折叠（预览/全文/超大只预览）
6. 上下文压缩 → 插入压缩分隔器，带动画进度条
7. 多轮对话 → 最近 3 轮始终可见，更早的懒加载

### 7.2 开发参考要点

1. **轮次组织**：ConversationTurn 封装一轮对话，结构清晰
2. **思考自动折叠**：流式展开，结束收起（与 opencowork/AionUi 一致）
3. **工具结果三层折叠**：按大小分级，平衡可读性和性能
4. **压缩分隔器**：视觉化上下文压缩，带动画反馈
5. **虚拟化**：最近 3 轮始终渲染，兼顾流畅和性能
6. **工具特化**：不同工具有独立渲染视图（待办/diff/媒体）

### 7.3 与 Codex 的差异

| 维度 | Codex | lobsterai |
|------|-------|-----------|
| 组织结构 | turn.items 列表 | ConversationTurn + assistantItems |
| 思考展开 | 未完全确认 | 流式展开/结束收起 |
| 工具结果折叠 | 有 View details | 三层折叠（4KB/64KB） |
| 压缩 | compact 机制 | ContextCompactionDivider 分隔器 |
| 虚拟化 | 未确认 | 最近 3 轮+懒加载 |
