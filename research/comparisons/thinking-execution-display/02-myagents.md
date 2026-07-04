# MyAgents：思考+执行交替展示逻辑调研

> 调研对象：MyAgents（桌面端 Claude Code，v0.2.44，React + TypeScript + Electron）
> 源码位置：projects/competitor-references/01-desktop-apps/MyAgents/src/renderer/
> 调研日期：2026-07-03
> 核查范围：完整源码，重点核查 Message.tsx、BlockGroup.tsx、ProcessRow.tsx、contentBlockDisplay.ts、toolBadgeConfig.tsx

---

## 一、核心结论

MyAgents 采用**"文字段 + 过程组"的二元结构**，实现思考+执行交替：

1. **分组策略独特**：文字块（text）单独走，连续的思考块+工具块打包成"过程组"（BlockGroup）
2. **过程组折叠用 head+tail 模式**：超过 6 个块时，首 2 尾 2 始终可见，中间折叠成"+N"按钮
3. **思考块四态完整**：活跃/失败/已停止/已完成，每态有独立图标和文案
4. **纯手动展开**：思考块和工具块默认折叠，刻意不随流式自动展开（避免页面跳动）
5. **统一行组件**：思考块和工具块用同一个 ProcessRow 渲染，状态机一致

---

## 二、数据结构

### 2.1 内容块类型（ContentBlock）

消息的 `content` 是 `ContentBlock[]` 数组，主要类型：

| 块类型 | 说明 | 是否过程块 |
|-------|------|-----------|
| `text` | 正文文本 | 否（单独走） |
| `thinking` | 思考块 | 是 |
| `tool_use` | 工具调用 | 是 |
| `server_tool_use` | 服务端工具调用 | 是 |

### 2.2 过程块判定

源码位置：`contentBlockDisplay.ts`

```typescript
isToolContentBlock = block.type === 'tool_use' || block.type === 'server_tool_use'
isProcessContentBlock = block.type === 'thinking' || isToolContentBlock(block)
```

思考块和工具块统称为"过程块"，它们会被分组到一起。

---

## 三、分组渲染逻辑

### 3.1 groupContentBlocksForDisplay

源码位置：`src/renderer/utils/contentBlockDisplay.ts`

分组规则：
1. 遍历 content 数组
2. 遇到 text 块 → 如果有正在累积的过程组，先保存；text 块单独放入结果（相邻 text 会合并）
3. 遇到过程块（thinking/tool_use）→ 加入当前过程组
4. 最后保存剩余过程组

结果是一个混合数组：`(ContentBlock | ContentBlock[])[]`，单个是 text，数组是过程组。

设计意图（源码注释）：
> "文字留在原位，相邻思考/工具块组成过程组。浮动球用同样的投影，每个过程块用紧凑单行渲染。"

### 3.2 Message.tsx 渲染入口

```typescript
const groupedBlocks = groupContentBlocksForDisplay(message.content);

groupedBlocks.map((item, index) => {
  if (!Array.isArray(item)) {
    // 单个 text 块 → Markdown 渲染
    // 检查 <widget> 标签 → 内联渲染
  } else {
    // 过程组 → <BlockGroup blocks={item} />
  }
})
```

### 3.3 流式态判定

```typescript
hasIncompleteBlocks = message.content.some(block => {
  if (block.type === 'thinking') return !block.isComplete
  if (block.type === 'tool_use' || 'server_tool_use') {
    return block.tool?.isLoading || !block.tool?.result || subagentRunning
  }
  return false
})
isAssistantStreaming = isLoading && hasIncompleteBlocks
```

---

## 四、过程组折叠（BlockGroup）

源码位置：`src/renderer/components/BlockGroup.tsx`

### 4.1 折叠阈值

```typescript
FOLD_THRESHOLD = 6      // 超过 6 个块触发折叠
VISIBLE_HEAD = 2        // 首 2 个始终可见
VISIBLE_TAIL = 2        // 尾 2 个始终可见
```

### 4.2 折叠规则

| 条件 | 行为 |
|------|------|
| 块数 ≤ 4（head+tail） | 不折叠，全部可见 |
| 块数 5 | 可折叠结构就绪（CSS Grid 过渡准备），但不折叠 |
| 块数 ≥ 6 且未手动展开 | 折叠：首 2 + 尾 2 可见，中间用"+N"按钮替代 |
| 用户点"+N"或展开任意行 | 全部展开（`isUnfolded = true`，pin 住） |

### 4.3 折叠条（Fold Bar）

折叠时中间显示一个按钮：
- `MoreHorizontal` 图标
- "展开全部"文案
- "+N" 计数徽章（被折叠的块数）

### 4.4 子行展开联动

当用户展开过程组内任意一个 ProcessRow 时，通过 `onUserExpand` 回调通知父级 BlockGroup，将整个组 pin 为展开状态——避免自动折叠把用户刚展开的行卸载掉、丢失展开状态。

### 4.5 折叠=卸载（性能优化）

源码注释明确：折叠的行不渲染（unmount），而非用 CSS 隐藏。之前用 `gridTemplateRows: 0fr` 隐藏会 mount 100 个工具子树，每个流式 delta 都重渲染。现在只在展开时 mount。

---

## 五、过程行（ProcessRow）完整逻辑

源码位置：`src/renderer/components/ProcessRow.tsx`

### 5.1 块类型判定

```typescript
isThinking = block.type === 'thinking'
isTool = block.type === 'tool_use' || block.type === 'server_tool_use'
isTaskTool = isTool && isSubagentContainerTool(block.tool.name)  // 子智能体工具
```

### 5.2 活跃态判定

```typescript
isThinkingActive = isThinking && block.isComplete !== true && isStreaming
isToolActive = isTool && isLastBlock && isStreaming && (block.tool?.isLoading || !block.tool?.result)
isTaskRunning = isTaskTool && isSubagentContainerRunning(block.tool)
isBlockActive = isThinkingActive || isToolActive || isTaskRunning
```

### 5.3 思考块四态状态机

| 状态 | 条件 | 图标 | 文案 |
|------|------|------|------|
| 活跃 | isThinkingActive | Loader2（旋转） | "思考中…（Ns）" / "思考中…" |
| 失败 | block.isFailed | XCircle（红色） | "思考失败（Ns）" / "思考失败" |
| 已停止 | block.isStopped | StopCircle（黄色） | "已停止（Ns）" / "已停止" |
| 已完成 | 其他 | Brain（脑图标） | "已完成（Ns）" |

计时器：`thinkingStartedAt` 为起点，每秒更新 `thinkingElapsed`。活跃时显示实时计时，其他态显示 `thinkingDurationMs`（总时长）。

### 5.4 工具块五态状态机

| 状态 | 条件 | 图标 |
|------|------|------|
| 活跃 | isToolActive / isTaskRunning | Loader2（旋转） |
| 失败 | block.tool.isFailed | XCircle（红色） |
| 已停止 | block.tool.isStopped | StopCircle（黄色） |
| 错误 | block.tool.isError | AlertCircle（红色） |
| 完成 | 其他 | config.icon（工具配置图标） |

### 5.5 状态指示圆点

行左侧有一个小圆点（1.5px），颜色映射状态：

| 状态 | 圆点颜色 |
|------|---------|
| 活跃 | 绿色 + 脉冲动画（animate-pulse） |
| 失败 | 红色 |
| 已停止 | 黄色 |
| 完成 | 灰色（ink-muted/40） |

### 5.6 展开折叠规则

```typescript
isExpanded = userToggled ?? false  // 纯手动，默认 false
```

设计决策（源码注释）：
> "思考块和工具块都默认折叠，只由用户手动点击展开。思考块刻意不再随 streaming 自动展开、完成后自动收起——那个'展开→收起'会在流式时让页面上下跳动，体验差。折叠态仍通过'思考中…（Xs）'标签+active指示实时反馈思考进行中，不影响可感知性。"

这与 opencowork 的设计哲学不同：opencowork 思考时自动展开，MyAgents 纯手动。

### 5.7 展开内容

- 思考块展开：Markdown 渲染思考内容 + 悬浮显示复制/导出按钮
- 工具块展开：`<ToolUse>` 组件渲染工具详情
- 过程媒体（截图等）：在折叠行内渲染，有图片计数徽章

### 5.8 行内信息元素

折叠态的每一行包含：
- 状态圆点（左）
- 状态图标
- 主标签（如"思考中…（3s）"或工具名）
- 后台任务徽章（如果是后台任务）
- 任务时长（如有）
- 副标签（工具详情，等宽字体截断）
- 过程媒体徽章（如有截图，显示图片图标+计数）
- 摘要节点（如"Edit +5 -3"、"Grep 12 matches"）
- 展开箭头（ChevronDown）

---

## 六、工具标签配置

源码位置：`src/renderer/components/tools/toolBadgeConfig.tsx`

- `getToolBadgeConfig(toolName)`：按工具名返回图标配置
- `getToolMainLabel(tool, t)`：主标签（如"编辑文件"）
- `getToolLabel(tool, t)`：完整标签
- `getToolSummaryNode(tool, t)`：摘要节点（如改动行数、匹配数）
- `formatDuration(ms)`：时长格式化

---

## 七、产品体验总结

### 7.1 用户看到的完整流程

1. 用户发消息 → 文字段直接显示
2. 思考过程出现 → 过程组里一行"思考中…（3s）"+ 绿色脉冲圆点 + 旋转图标，默认折叠
3. 执行工具 → 过程组里新增一行，显示工具名+摘要（如"Edit +5 -3"）+ 灰色圆点
4. 思考+工具交替累积 → 过程组里多行排列
5. 超过 6 行 → 首 2 尾 2 可见，中间折叠成"+4"按钮
6. 用户点击任意行 → 展开看详情（思考内容/工具输入输出）
7. 用户点击"+N" → 整个过程组展开

### 7.2 开发参考要点

1. **二元结构**：文字段 vs 过程组，过程组内思考+工具混排
2. **head+tail 折叠**：首尾各留 2 行可见，中间折叠，避免全部折叠丢失上下文
3. **纯手动展开**：不自动展开/收起，避免流式时跳动（与 opencowork 不同的设计取舍）
4. **四态思考**：活跃/失败/已停止/已完成，比 Codex 多了"失败"态
5. **统一行组件**：思考和工具用同一组件，状态机一致，降低复杂度
6. **折叠=卸载**：性能优化，折叠的行不 mount

### 7.3 与 Codex 的差异

| 维度 | Codex | MyAgents |
|------|-------|---------|
| 交替结构 | 思考解说和执行在同一列表 | 文字段+过程组二元结构 |
| 过程折叠 | 计数摘要（N working/done） | head+tail 模式（首2尾2+中间+N） |
| 思考展开 | 未完全确认 | 纯手动（不自动展开） |
| 思考状态 | 进行时（Thinking） | 四态（活跃/失败/停止/完成） |
| 行内信息 | action+detail 标签 | 圆点+图标+标签+摘要节点 |
