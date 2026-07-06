# AionUi：思考+执行交替展示逻辑调研

> 调研对象：AionUi（命令行 AI 智能体转现代聊天界面，v2.1.27，React + TypeScript + Arco Design）
> 源码位置：projects/competitor-references/01-desktop-apps/AionUi/packages/desktop/src/renderer/
> 调研日期：2026-07-03
> 核查范围：完整源码，重点核查 MessageList.tsx、MessageThinking.tsx、MessageToolCall.tsx、thinkTagFilter.ts

---

## 一、核心结论

AionUi 采用**按消息类型分发到独立组件**的模式，结构清晰但相对简单：

1. **类型分发**：用 `switch(message.type)` 把每种消息类型路由到独立组件（MessageThinking/MessageToolCall/MessageText/MessagePlan 等）
2. **思考块自动折叠**：思考时展开+实时计时，完成后自动收起，显示"思考完成 · Ns"
3. **think 标签兼容**：支持多种 think 标签格式（`<think`/`<thinking`/MiniMax 风格无开标签），兼容历史消息
4. **工具状态三态**：completed/error/running，用 Arco Badge 状态色映射
5. **无过程分组**：不像 opencowork/MyAgents 那样做工具分组，每个工具调用独立展示

---

## 二、数据结构

### 2.1 消息类型（TMessage）

消息列表是 `TMessage[]`，通过 `message.type` 区分：

| 类型 | 组件 | 说明 |
|------|------|------|
| `text` | MessageText | 正文文本 |
| `thinking` | MessageThinking | 思考块 |
| `tool_call` | MessageToolCall | 工具调用 |
| `tool_group` | ToolGroup | 工具组 |
| `plan` | MessagePlan | 计划 |
| `tips` | MessageTips | 提示 |
| `agent_status` | — | 智能体状态 |
| `permission` / `acp_permission` | — | 权限请求 |
| `acp_tool_call` | — | ACP 工具调用 |

### 2.2 思考标签格式兼容

源码位置：`utils/chat/thinkTagFilter.ts`

AionUi 需要处理模型返回的各种 think 标签变体：

| 格式 | 处理方式 |
|------|---------|
| `<think...</think` | 正则移除完整块 |
| `<thinking...</thinking` | 正则移除完整块 |
| MiniMax 风格（无开标签，只有 `</think`） | 移除首个 `</think` 及其之前所有内容 |
| 孤立闭合标签 `</think` | 单独移除标签 |
| 孤立开始标签 `<think` | 单独移除标签 |

---

## 三、思考块（MessageThinking）完整逻辑

源码位置：`pages/conversation/Messages/components/MessageThinking.tsx`

### 3.1 状态判定

```typescript
const { content: text, status, subject } = message.content
const duration = message.content.duration ?? message.content.duration_ms
const isDone = status === 'done'
```

### 3.2 展开折叠规则

| 场景 | 行为 |
|------|------|
| 思考中（!isDone） | 默认展开 |
| 思考完成（isDone） | 自动收起（useEffect 监听 isDone 变化） |
| 用户点击 | 切换展开/收起 |

```typescript
const [expanded, setExpanded] = useState(!isDone)  // 初始：思考中展开

useEffect(() => {
  if (isDone) setExpanded(false)  // 完成自动收起
}, [isDone])
```

### 3.3 计时器

- 思考中：`elapsedTime` 实时计时，每秒更新
- 完成后：显示 `duration`（总时长）

### 3.4 标题文案

| 状态 | 标题 |
|------|------|
| 思考中 | "{subject 或 '思考中…'} · {Ns}" |
| 完成 | "思考完成 · {格式化时长}" |

时长格式化：< 60秒显示"Ns"，≥ 60秒显示"Nm Ns"

### 3.5 视觉设计

- 思考中：Spin 旋转图标（12px）
- 完成：Brain 图标（14px）
- 标题栏可点击切换展开
- 展开箭头：Right 图标，展开时旋转
- 内容区：纯文本，思考中自动滚动到底部

---

## 四、工具调用（MessageToolCall）完整逻辑

源码位置：`pages/conversation/Messages/components/MessageToolCall.tsx`

### 4.1 状态映射

```typescript
const statusToBadge = (status: NormalizedToolStatus): BadgeProps['status'] => {
  switch (status) {
    case 'completed': return 'success'    // 绿色
    case 'error': return 'error'          // 红色
    case 'running': return 'processing'   // 蓝色（处理中动画）
    default: return 'default'             // 灰色
  }
}
```

### 4.2 展开折叠

```typescript
const [expanded, setExpanded] = useState(false)  // 默认折叠
```

工具调用默认折叠，点击展开看详情。

### 4.3 特殊工具渲染

- 替换类工具（有 old_string/new_string）：用 `createTwoFilesPatch` 生成 diff，用 `FileChangesPanel` 展示，默认展开
- 文件变更：`FileChangesPanel` 组件，支持点击预览 diff

---

## 五、产品体验总结

### 5.1 用户看到的完整流程

1. 用户发消息 → 正文文本显示
2. 思考出现 → 思考块展开，Spin 图标旋转，实时计时"思考中… · 3s"
3. 思考完成 → 自动收起，显示"思考完成 · 5s"，Brain 图标
4. 工具调用 → 工具卡片出现，默认折叠，显示工具名+状态徽章
5. 工具完成 → 绿色成功徽章
6. 用户点击工具卡片 → 展开看输入/输出/diff

### 5.2 开发参考要点

1. **类型分发**：每种消息类型独立组件，职责清晰
2. **think 标签兼容**：处理多种格式，兼容不同模型和历史消息
3. **思考自动折叠**：完成自动收起（与 opencowork 一致，与 MyAgents 不同）
4. **工具三态**：completed/error/running，比 opencowork 少态
5. **diff 预览**：替换类工具直接生成 diff 展示

### 5.3 与 Codex 的差异

| 维度 | Codex | AionUi |
|------|-------|--------|
| 思考块 | 混在 agentMessage | 独立 thinking 类型 |
| 工具状态 | 至少 3 态 | 3 态（completed/error/running） |
| 工具分组 | 有计数摘要 | 无分组 |
| 标签兼容 | 无（结构化块） | 多格式 think 标签 |
| 计时 | 有 | 有（实时+完成定格） |
