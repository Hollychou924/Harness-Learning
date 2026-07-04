# opencowork：思考+执行交替展示逻辑调研

> 调研对象：opencowork（开源多智能体协作桌面平台，v1.0.0，React + TypeScript + Electron）
> 源码位置：projects/competitor-references/01-desktop-apps/opencowork/src/renderer/src/
> 调研日期：2026-07-03
> 核查范围：完整源码，重点核查 AssistantMessage.tsx、ThinkingBlock.tsx、ToolCallCard.tsx、ToolCallGroup.tsx、CompactToolCallHeader.tsx、agent/types.ts

---

## 一、核心结论

opencowork 是本次调研中**最贴近"思考+执行交替、默认折叠、文字为主"模式的竞品**，实现完整度最高：

1. **交替渲染**：对话消息按内容块数组顺序，用 `switch(block.type)` 逐个渲染，thinking 块和 tool_use 块天然交替
2. **思考块精细**：思考时自动展开+实时计时，完成后自动收起，显示"思考了 N 秒"
3. **工具块状态机完整**：6 种状态（streaming/pending_approval/running/completed/error/canceled），各有图标和文案
4. **智能分组**：相同工具的连续调用自动合并成组，有智能摘要（Read N files / Grep N matches / Ran N commands）
5. **双层折叠**：单工具卡片可展开看详情；整组工具可折叠；所有工具可一键收起（toolsCollapsed）

---

## 二、数据结构

### 2.1 内容块类型（ContentBlock）

AssistantMessage 接收 `UnifiedMessage`，其 `content` 是 `ContentBlock[]` 数组。每个块有 `type` 字段：

| 块类型 | 说明 |
|-------|------|
| `thinking` | 结构化思考块（独立块，有 thinking 文本 + startedAt + completedAt） |
| `text` | 正文文本（可能内嵌 `<think` 标签，需解析） |
| `tool_use` | 工具调用 |
| `image` | 生成的图片 |
| `image_error` | 图片生成失败 |
| `agent_error` | 智能体错误 |

### 2.2 工具调用状态枚举（ToolCallStatus）

源码位置：`src/renderer/src/lib/agent/types.ts:17`

```typescript
export type ToolCallStatus =
  | 'streaming'        // 正在接收参数
  | 'pending_approval' // 等待审批
  | 'running'          // 执行中
  | 'completed'        // 已完成
  | 'error'            // 出错
  | 'canceled'         // 已取消
```

对应的中文状态文案（`ToolCallCard.tsx:2712`）：
| 状态 | 文案 |
|------|------|
| streaming | 接收参数中 |
| running | 执行中 |
| pending_approval | 权限请求 |
| error | 错误 |
| completed | （无独立文案，显示完成图标） |

---

## 三、交替渲染主循环

### 3.1 渲染入口

源码位置：`AssistantMessage.tsx`，核心在 `switch(block.type)`（约 2360 行）

渲染流程：
1. 将 `content`（ContentBlock[]）归一化为 `normalizedContent`
2. 用 `normalizeContentForDisplay` 生成渲染项列表（item），每个 item 有两种 kind：
   - `block`：单个内容块（thinking/text/image/tool_use 等）
   - `group`：连续相同工具名的 tool_use 合并成组
   - `compact-summary`：压缩摘要（只留结论）
3. 遍历 item 列表，按 kind 和 type 分发渲染

### 3.2 switch 分发逻辑

```
if (item.kind === 'compact-summary') → 渲染压缩摘要（只留结论）
if (item.kind === 'block') {
  switch (block.type) {
    case 'thinking':    → <ThinkingBlock />     // 思考卡片
    case 'text':        → 解析 <think 标签 → ThinkingBlock + Markdown 交替
    case 'image':       → <ImagePreview />       // 图片
    case 'image_error': → <ImageGenerationErrorCard />
    case 'agent_error': → <AgentErrorCard />
    case 'tool_use':    → renderToolBlock()      // 工具卡片
  }
}
if (item.kind === 'group') → <ToolCallGroup />   // 工具组（可折叠）
```

### 3.3 text 块的特殊处理——内嵌思考标签

text 块里可能内嵌 `<think` 标签（非结构化思考块的情况）。处理逻辑：
1. `hasStructuredThinkingBlocks`：检查是否有独立的 thinking 块
2. 若有结构化思考块 → text 块里的 think 标签用 `stripThinkTags` 去掉（避免重复）
3. 若无 → 用 `parseThinkTags` 把 text 拆成 think 段和正文段，交替渲染
   - think 段 → `<ThinkingBlock />`
   - 正文段 → `<StreamingMarkdownContent />`

这意味着：即使模型把思考内容混在正文里（用 `<think` 标签包裹），opencowork 也能解析出来，渲染成独立的思考卡片。

---

## 四、思考块（ThinkingBlock）完整逻辑

源码位置：`src/renderer/src/components/chat/ThinkingBlock.tsx`

### 4.1 状态判定

```typescript
isThinking = isStreaming && !completedAt  // 正在思考
hasThinkingContent = thinking.trim().length > 0  // 有内容
defaultCollapsed = !isThinking && hasThinkingContent  // 非思考中且有内容 → 默认折叠
```

### 4.2 展开折叠规则

| 场景 | 行为 |
|------|------|
| 正在思考（isThinking） | 自动展开，不可手动收起（点击无效） |
| 思考完成 + 有内容 | 默认折叠，点击可展开 |
| 思考完成 + 无内容 | 不渲染（return null） |

### 4.3 计时器

- 思考中：`liveElapsed` 实时计时，每秒更新，显示"思考中…（Ns）"
- 完成后：从 `startedAt` 和 `completedAt` 计算总时长，显示"思考了 N 秒"

文案体系（i18n key `thinking.*`）：
| 状态 | 文案 |
|------|------|
| 思考中 | "深度思考中"（deepThinking） |
| 思考中+计时 | "已思考 N 秒"（thinkingFor） |
| 完成后 | "深度思考完成"（deepThought） |
| 完成后+计时 | "思考了 N 秒"（thoughtFor） |
| 完成后无计时 | "思考"（thoughts） |

### 4.4 视觉设计

- 紫色主题（BrainCircuit 图标，violet 色系）
- 思考中：图标带脉冲动画（animate-pulse）+ 阴影
- 折叠态：ChevronRight 箭头；展开态：ChevronDown 箭头
- 内容区：Markdown 渲染，思考中自动滚动到底部
- 支持流式渲染池（`useStreamingRenderPool`），可配置动画风格（`liveOutputAnimationStyle`）

---

## 五、工具卡片（ToolCallCard）完整逻辑

源码位置：`src/renderer/src/components/chat/ToolCallCard.tsx`

### 5.1 默认展开/折叠规则

```typescript
isProcessing = status === 'streaming' || status === 'running'
isActive = isProcessing || status === 'pending_approval'
hasVisualOutput = hasImageBlocks(output)
isReadTextTool = name === 'Read' && !hasVisualOutput

// 初始展开状态
open = (isActive && !isReadTextTool) || hasVisualOutput
```

| 场景 | 默认展开 |
|------|---------|
| 活跃中（streaming/running/pending_approval）且非纯文本读取 | 是 |
| 有视觉输出（图片） | 是 |
| 纯文本 Read 工具 | 否（大输出，点开才加载） |
| 从活跃变为非活跃 | 自动收起 |

### 5.2 状态色映射

源码位置：`CompactToolCallHeader.tsx`

| 状态 | 徽章色 | 含义 |
|------|--------|------|
| error | 红色（destructive） | 出错 |
| pending_approval | 琥珀色（amber） | 等待审批 |
| running | 蓝色（sky） | 执行中 |
| streaming | 默认色 | 接收参数中 |
| completed | 绿色（emerald） | 已完成 |

### 5.3 状态图标

| 状态 | 图标 |
|------|------|
| streaming / running | Loader2（旋转） |
| completed | CheckCircle2（绿色对勾） |
| error | XCircle（红色叉） |
| pending_approval | （琥珀色徽章） |

### 5.4 输出内容折叠

工具输出内容超长时的折叠规则：
- 文本输出超 500 字符：截断显示，附"展开"按钮
- 多行输出超 40 行：截断显示，附"展开"按钮
- stderr 输出：默认展开（tone="error"）

---

## 六、工具分组（ToolCallGroup）完整逻辑

源码位置：`src/renderer/src/components/chat/ToolCallGroup.tsx`

### 6.1 分组规则

连续相同工具名的 tool_use 调用自动合并成一组。例如连续 3 次 Read 调用会合并成一个"读取文件"组。

### 6.2 组级状态聚合

```typescript
function groupStatus(items): ToolCallStatus | 'completed' {
  if (items.some(i => i.status === 'error')) return 'error'           // 任一出错 → 组错误
  if (items.some(i => i.status === 'running')) return 'running'       // 任一执行中 → 组执行中
  if (items.some(i => i.status === 'streaming')) return 'streaming'   // 任一接收中 → 组接收中
  if (items.some(i => i.status === 'pending_approval')) return 'pending_approval'
  if (items.every(i => i.status === 'completed')) return 'completed'  // 全部完成 → 组完成
  return 'running'
}
```

优先级：error > running > streaming > pending_approval > completed

### 6.3 智能摘要文案

折叠后的组头部显示智能摘要：

| 工具 | 摘要文案 |
|------|---------|
| Read | 读取了 N 个文件 |
| Grep | 在 M 个文件中找到 N 处匹配（+表示有截断/超时/错误） |
| Glob | 匹配到 N 个结果（+表示有警告） |
| LS | 列出了 N 个目录 |
| Bash | 运行了 N 条命令 |

### 6.4 组折叠

- `collapsible = groupBlocks.length > 1`：只有多于 1 个才可折叠
- 折叠态：显示组摘要 + 计数；展开态：显示每个工具卡片
- 整体工具区可通过 `toolsCollapsed` 一键收起所有工具

---

## 七、压缩摘要（只留结论）

AssistantMessage 渲染循环中有 `item.kind === 'compact-summary'` 分支，用于渲染压缩后的摘要。当对话上下文被压缩时，历史过程变成摘要项，只保留关键结论。

---

## 八、产品体验总结

### 8.1 用户看到的完整流程

1. 用户发消息 → 智能体开始思考 → 紫色"深度思考中"卡片自动展开，实时计时
2. 思考完成 → 卡片自动收起，显示"思考了 N 秒"，点击可重新展开看内容
3. 执行工具 → 蓝色工具卡片出现，显示"执行中"+ 旋转图标 + 计时
4. 工具完成 → 卡片自动收起，显示绿色对勾 + 智能摘要（如"读取了 3 个文件"）
5. 连续相同工具 → 自动合并成组，折叠成一行摘要
6. 继续思考 → 继续执行 → 交替进行
7. 对话过长 → 历史过程压缩成摘要，只留结论

### 8.2 开发参考要点

1. **数据层**：content 是 ContentBlock[] 数组，thinking 和 tool_use 是不同的 type，按顺序排列
2. **思考块**：独立组件，思考时展开+计时，完成自动收起，支持结构化块和文本内嵌标签两种来源
3. **工具状态机**：6 态完整，每态有独立色+图标+文案
4. **折叠优先级**：活跃默认展开，完成默认收起，纯文本大输出延迟加载
5. **智能分组**：连续相同工具合并，组级状态从子项聚合，摘要文案按工具类型定制
6. **双层折叠**：单卡片折叠 + 组折叠 + 全局工具折叠

### 8.3 与 Codex 的差异

| 维度 | Codex | opencowork |
|------|-------|-----------|
| 思考块 | 混在 agentMessage 里，用 phase 区分 | 独立的 thinking 块类型 |
| 执行态文案 | `<action>` `<status>` `<detail>` 标签 | 状态色徽章 + 图标 + i18n 文案 |
| 状态数 | 至少 3 态（进行/完成/停止） | 6 态（streaming/pending_approval/running/completed/error/canceled） |
| 工具分组 | 有计数摘要（N working/done） | 智能分组+定制摘要（Read N files / Grep N matches） |
| 思考计时 | 有 Thinking 状态（细节未确认） | 完整（实时计时 + 完成定格 + 文案体系） |
| 压缩 | compact 机制（上下文压缩） | compact-summary 摘要项 |
