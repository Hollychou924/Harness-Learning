# harnessclaw：思考+执行交替展示逻辑调研

> 调研对象：harnessclaw（v0.0.23，React + TypeScript）
> 源码位置：projects/competitor-references/01-desktop-apps/harnessclaw/src/renderer/src/
> 调研日期：2026-07-03
> 核查范围：完整源码，重点核查 ChatPage.tsx（ThinkingIndicator、agent.intent、ToolActivity）

---

## 一、核心结论

harnessclaw 的实现**相对简单**，不属于完整的"思考+执行交替折叠"模式，但有独特设计：

1. **三层降级展示**：ThinkingIndicator（有思考内容）→ agent.intent 进度句 → "Thinking…" 兜底
2. **agent.intent 进度句**：工具开始前显示一句话进度（如"正在搜索 vLLM 论文"），工具结束清除
3. **思考指示器**：默认折叠，点击展开看 reasoning 内容
4. **工具活动丰富状态**：ok/failed/cancelled/skipped + 错误分类 + 可重试 + 重试倒计时
5. **无交替折叠**：思考和工具不是交替折叠流，而是底部状态指示

> ⚠️ 局限说明：harnessclaw 的工具卡渲染组件未在 components 目录找到独立文件，可能内联在 ChatPage 中或通过其他机制渲染。以下基于 ChatPage.tsx 中确认的逻辑。

---

## 二、三层降级展示机制

harnessclaw 在对话底部根据状态降级展示，优先级从高到低：

### 2.1 第一层：ThinkingIndicator（有思考内容时）

```typescript
{isProcessing && currentThinking && (
  <ThinkingIndicator content={currentThinking} />
)}
```

触发条件：正在处理 + 有 currentThinking 内容

### 2.2 第二层：agent.intent 进度句（无思考内容但有 intent 时）

```typescript
{isProcessing && !isPaused && !isStopping && !currentThinking && currentIntent?.text && (
  <div>
    <span className="streaming-breathing-dot" />  {/* 呼吸闪烁圆点 */}
    <span className="chat-thinking-shimmer">{currentIntent.text}</span>  {/* 鎏金字体 */}
  </div>
)}
```

触发条件：正在处理 + 未暂停 + 未停止 + 无思考内容 + 有 intent 文本

### 2.3 第三层："Thinking…" 兜底（都没有时）

```typescript
{isProcessing && !isPaused && !isStopping && !currentThinking && !currentIntent?.text && !pendingAssistantMessage && (
  <div>
    <span className="streaming-breathing-dot" />
    <span className="chat-thinking-shimmer">Thinking…</span>
  </div>
)}
```

触发条件：正在处理 + 以上都没有

---

## 三、ThinkingIndicator 组件

源码位置：`ChatPage.tsx:11676`

### 3.1 实现

```typescript
function ThinkingIndicator({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
      <div className="flex items-center gap-2">
        <Brain size={12} className="animate-pulse text-primary" />
        <span>{t('chat.status.organizingAnswer')}</span>  {/* "正在组织回答" */}
      </div>
      <p hidden={!expanded} className="max-h-32 overflow-y-auto whitespace-pre-wrap">
        {content}
      </p>
    </button>
  )
}
```

### 3.2 展开折叠规则

| 场景 | 行为 |
|------|------|
| 默认 | 折叠，显示"正在组织回答"+ 脉冲脑图标 |
| 点击 | 展开，显示 reasoning 内容（max-h-32 限高+滚动） |

---

## 四、agent.intent 进度句机制

### 4.1 数据结构

```typescript
currentIntent?: {
  text: string       // 进度句，如"正在搜索 vLLM 论文"
  toolUseId: string  // 关联的工具调用 ID
  agentName: string  // 智能体名称
  fromSubagent: boolean  // 是否来自子智能体
}
```

### 4.2 生命周期

- **设置**：`agent_intent` 事件触发时设置，在 tool_start 之前
- **清除**：匹配的 tool_end（按 toolUseId 匹配）或 assistant turn 结束时清除
- **子智能体**：每个子智能体有独立的 currentIntent，在 subagent_end 时清除

### 4.3 视觉设计

- 呼吸闪烁圆点（streaming-breathing-dot）
- 鎏金字体（chat-thinking-shimmer）
- 文本截断（truncate），hover 显示完整（title 属性）
- aria-live="polite" 无障碍播报

---

## 五、工具活动（ToolActivity）状态体系

### 5.1 活动类型

```typescript
type ToolActivity['type'] =
  | 'hint'              // 提示
  | 'call'              // 调用
  | 'result'            // 结果
  | 'status'            // 状态
  | 'permission'        // 权限请求
  | 'permission_result' // 权限结果
  | 'question'          // 提问
  | 'question_result'   // 提问结果
  | 'step_decision'     // 步骤决策（继续/重试/取消）
  | 'step_decision_result'  // 步骤决策结果
```

### 5.2 终态状态值

```typescript
status?: string  // ok / failed / cancelled / skipped
```

| 状态 | 含义 | 渲染色 |
|------|------|--------|
| ok | 成功 | 绿色 |
| failed | 失败 | 红色/橙色 |
| cancelled | 取消 | 灰色（中性，非错误） |
| skipped | 跳过 | 灰色 |

设计决策（源码注释）：
> "cancelled 故意与 isError 解耦，使中止流程渲染为中性灰色，而非错误红色。"

### 5.3 错误分类体系

```typescript
errorType?: string  // invalid_input / permission_denied / tool_timeout / user_aborted /
                    // rate_limit / overloaded / model_error / contract_fail /
                    // dependency_fail / internal
```

10 种错误类型，未知值回退到 `internal` 展示（不抛错、不原始渲染）。

### 5.4 重试机制

```typescript
retryable?: boolean      // 是否可自动重试
retryAfterMs?: number    // 距下次重试倒计时（仅展示，非控制）
recovery?: ToolErrorRecovery  // 恢复提示（预留）
```

### 5.5 错误信息分层

- `content`：用户可见信息（来自 `error.user_message`）
- `error.message`：开发者诊断信息（如"unknown tool: WebFetch"），只在可折叠"详情"面板或 hover tooltip 显示

---

## 六、产品体验总结

### 6.1 用户看到的流程

1. 用户发消息 → 智能体开始处理
2. 有思考内容 → ThinkingIndicator 显示"正在组织回答"+ 脉冲脑图标，点击可展开看 reasoning
3. 无思考内容但工具即将开始 → 显示 agent.intent 进度句"正在搜索 XXX"+ 呼吸圆点
4. 都没有 → 显示"Thinking…"+ 呼吸圆点
5. 工具执行 → 工具活动记录（call/result/status）
6. 工具失败 → 显示错误（用户可见信息 + 可展开看诊断详情）
7. 可重试错误 → 显示重试倒计时

### 6.2 开发参考要点

1. **三层降级**：思考内容 > intent 进度句 > 兜底文案，确保用户始终有反馈
2. **intent 进度句**：工具开始前的一句话预告，比纯"Thinking…"更有信息量
3. **错误分层**：用户信息 vs 诊断信息分离，避免暴露技术细节
4. **cancel 中性化**：取消不是错误，用灰色而非红色
5. **错误分类**：10 种类型，便于针对性处理和展示

### 6.3 与 Codex 的差异

| 维度 | Codex | harnessclaw |
|------|-------|-------------|
| 展示模式 | 交替折叠流 | 底部状态指示（非交替） |
| 思考展示 | commentary 文本混排 | ThinkingIndicator 独立指示器 |
| 进度预告 | 执行态文案（action+detail） | agent.intent 进度句 |
| 工具状态 | 至少 3 态 | 4 态（ok/failed/cancelled/skipped）+ 10 种错误类型 |
| 错误处理 | failed 状态 | 分类错误+可重试+倒计时+信息分层 |
| 折叠 | 有（View details/compact） | 思考可展开，工具未确认有独立折叠 |
