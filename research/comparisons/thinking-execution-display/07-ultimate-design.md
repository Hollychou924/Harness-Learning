# 全网最强：思考+执行交替展示综合方案

> 目标：融合 Codex + opencowork + MyAgents + Kun + AionUi + lobsterai + harnessclaw 七家之长，设计体验最优的"思考+执行交替展示"方案
> 基于调研文档：00-codex-desktop.md ~ 06-harnessclaw.md
> 设计日期：2026-07-03

---

## 一、第一性原理：用户到底要什么

从产品视角倒推，用户看这个界面的核心需求只有五条：

| # | 核心需求 | 含义 | 失败体验 |
|---|---------|------|---------|
| 1 | **始终知道在干嘛** | 任何时刻一眼看到"现在在思考/在执行/在等审批" | 盯着空白屏不知道死没死 |
| 2 | **能看到思考过程** | 想看时能展开看 AI 在想什么，不想看时不碍眼 | 思考内容要么霸屏要么看不到 |
| 3 | **能看到执行动作** | 每个动作有清晰的状态（正在/已完成/出错/已停止） | 只有"运行中…"不知道跑了啥 |
| 4 | **能控制详细程度** | 一键看全部细节，一键收起只看结论 | 全展开信息过载，全折叠不知道发生了啥 |
| 5 | **能高效回溯历史** | 翻历史不卡，能快速定位到某次操作 | 历史越长越卡，找不到想找的 |

这五条就是设计的北极星，所有方案都围绕它们。

---

## 二、各家长处与融合策略

### 2.1 七家长处盘点

| 家 | 核心长处 | 融入方案的位置 |
|----|---------|--------------|
| **Codex** | 三态文案体系（Running→Ran→Stopped）+ `<action><detail>` 标签 + compact 压缩 | 执行态文案 + 历史压缩 |
| **opencowork** | 6 态状态机 + 思考实时计时/完成自动收起 + 智能分组（Read N files）+ 状态色徽章 | 状态机 + 思考块 + 工具分组 |
| **MyAgents** | head+tail 过程折叠 + 思考四态（加失败态）+ 纯手动 pin + 状态圆点 + 摘要节点（Edit +5 -3） | 过程折叠 + 状态指示 + 行内摘要 |
| **Kun** | 显式分段（reasoning/execution/output）+ 四层折叠优先级 + 虚拟分页 + 延迟渲染 + 错误色系 | 分段 + 折叠优先级 + 性能 |
| **AionUi** | think 标签多格式兼容 + 思考完成自动收起 + diff 预览 | 标签兼容 + 工具特化 |
| **lobsterai** | 工具结果三层折叠（4KB/64KB）+ 工具特化视图（Todo/Diff/Media）+ 压缩分隔器 | 结果折叠 + 工具特化 |
| **harnessclaw** | 三层降级展示 + agent.intent 进度句 + 10 种错误分类 + 重试倒计时 + 错误信息分层 | 进度预告 + 错误处理 |

### 2.2 融合策略总览

```
┌─────────────────────────────────────────────────────┐
│                    用户看到的界面                      │
│                                                       │
│  ┌──────────┐  ← 思考段（Brain 图标 + 计时）           │
│  │ 思考中…3s │     自动展开 → 完成收起 → 可 pin        │
│  └──────────┘                                         │
│  ┌──────────┐  ← 执行段（首2尾2+中间折叠）             │
│  │ ●正在读取 │     状态圆点 + 图标 + 标签 + 摘要       │
│  │ ●已完成   │     点击展开看详情                      │
│  │  +4 更多  │     一键展开全部                        │
│  │ ●已停止   │                                         │
│  └──────────┘                                         │
│  ┌──────────┐  ← 产出段（最终回复）                    │
│  │ 结论文本  │                                         │
│  └──────────┘                                         │
│                                                       │
│  底部状态条：当前在干嘛 + 进度句 + 计时                 │
│  历史管理：虚拟分页 + 自动折叠 + compact 压缩           │
└─────────────────────────────────────────────────────┘
```

核心融合点：
1. **数据层**：opencowork 的块数组 + Kun 的显式分段（双轨：底层块数组，上层分段视图）
2. **状态机**：opencowork 6 态 + MyAgents 思考失败态 + harnessclaw 错误分类
3. **思考块**：opencowork 自动展开/收起 + MyAgents 手动 pin（融合：自动+可pin）
4. **执行块**：Codex 文案体系 + opencowork 状态色 + MyAgents 圆点+摘要 + harnessclaw 进度句
5. **折叠**：MyAgents head+tail（过程内）+ Kun 虚拟分页（轮次间）+ Codex compact（内容压缩）三套并存
6. **错误**：harnessclaw 10 种分类 + 重试 + lobsterai 特化视图
7. **性能**：Kun 延迟渲染 + content-visibility + MyAgents 折叠卸载

---

## 三、数据模型设计

### 3.1 底层：内容块数组（ContentBlock[]）

采用 opencowork 的设计——一条消息的内容是有序块数组，按真实发生顺序排列：

```typescript
type ContentBlockType =
  | 'thinking'      // 思考块
  | 'text'          // 正文文本
  | 'tool_use'      // 工具调用
  | 'image'         // 生成图片
  | 'error'         // 错误
  | 'compact_summary' // 压缩摘要（只留结论）

interface ContentBlock {
  id: string
  type: ContentBlockType
  // thinking
  thinking?: string
  thinkingStartedAt?: number
  thinkingCompletedAt?: number
  isThinkingComplete?: boolean
  isThinkingFailed?: boolean
  isThinkingStopped?: boolean
  // text
  text?: string
  // tool_use
  tool?: {
    id: string
    name: string
    input: Record<string, unknown>
    output?: ToolResult
    status: ToolCallStatus
    startedAt?: number
    completedAt?: number
    errorType?: ErrorType       // 来自 harnessclaw
    retryable?: boolean          // 来自 harnessclaw
    retryAfterMs?: number        // 来自 harnessclaw
    attachments?: Attachment[]   // 来自 MyAgents
  }
  // compact_summary
  summary?: string
}
```

### 3.2 上层：分段视图（ProcessSection[]）

采用 Kun 的设计——渲染时把块数组分组为语义段落：

```typescript
type SectionKind = 'reasoning' | 'execution' | 'output' | 'error' | 'subagent'

interface ProcessSection {
  id: string
  kind: SectionKind
  blocks: ContentBlock[]
  // 段落级元数据
  isActive: boolean
  hasError: boolean
  hasPendingApproval: boolean
  needsUserInput: boolean
}
```

分段规则（融合 Kun + MyAgents）：
- `thinking` 块 → `reasoning` 段
- `tool_use` 块 → `execution` 段（相邻同类的合并）
- `text` 块 → `output` 段
- `error` 块 → `error` 段
- 子智能体工具 → `subagent` 段
- 相邻同段类型的块合并

### 3.3 轮次结构（ConversationTurn）

采用 lobsterai 的设计——对话按轮次组织：

```typescript
interface ConversationTurn {
  id: string
  userMessage: ContentBlock | null
  sections: ProcessSection[]    // 轮次内的分段
  status: TurnStatus            // running / completed / stopped / failed
  startedAt: number
  completedAt?: number
}
```

---

## 四、状态机设计

### 4.1 工具调用状态（融合 opencowork 6 态 + harnessclaw 错误分类）

```typescript
type ToolCallStatus =
  | 'streaming'         // 正在接收参数
  | 'pending_approval'  // 等待用户审批
  | 'running'           // 执行中
  | 'completed'         // 已完成
  | 'error'             // 出错（带 errorType 分类）
  | 'canceled'          // 已取消
  | 'stopped'           // 已停止（用户主动停）
```

> 比各家多一个 `stopped`——区分"用户主动停止"（中性灰）和"出错"（红色）。来自 Codex 的 Stopped 概念 + harnessclaw 的 cancel 中性化理念。

### 4.2 状态文案体系（融合 Codex 文案变形 + opencowork 状态色）

每个状态对应：动词形态 + 图标 + 状态色 + 计时行为

| 状态 | 动词形态 | 图标 | 状态色 | 圆点色 | 计时 |
|------|---------|------|--------|--------|------|
| streaming | "接收参数中" | Loader2 旋转 | 默认灰 | 灰脉冲 | 无 |
| pending_approval | "等待审批" | 盾牌 | 琥珀色 | 琥珀脉冲 | 无 |
| running | "正在{动作}" | Loader2 旋转 | 蓝色 | 绿脉冲 | 实时计时 |
| completed | "已{动作}" | CheckCircle2 | 绿色 | 灰 | 定格总时长 |
| error | "{动作}失败" | XCircle | 红色 | 红 | 定格 |
| canceled | "已取消" | 禁止图标 | 灰色 | 灰 | 定格 |
| stopped | "已停止" | StopCircle | 黄色 | 黄 | 定格 |

动作词随工具类型变化（来自 Codex 的 action 标签理念）：

| 工具类型 | running 文案 | completed 文案 |
|---------|-------------|---------------|
| 命令执行 | 正在运行命令 | 已运行命令 |
| 读取文件 | 正在读取 | 已读取 |
| 编辑文件 | 正在编辑 | 已编辑 |
| 搜索代码 | 正在搜索 | 已搜索 |
| 写入文件 | 正在创建 | 已创建 |
| 网页搜索 | 正在搜索网页 | 已搜索网页 |

### 4.3 思考块状态（融合 MyAgents 四态）

```typescript
type ThinkingStatus =
  | 'active'     // 思考中（实时计时）
  | 'completed'  // 已完成（显示总时长）
  | 'failed'     // 失败（红色）
  | 'stopped'    // 已停止（黄色，用户中断）
```

| 状态 | 图标 | 文案 | 圆点 |
|------|------|------|------|
| active | Loader2 旋转 | "思考中…（3s）" | 绿脉冲 |
| completed | Brain | "思考完成 · 5s" | 灰 |
| failed | XCircle | "思考失败 · 5s" | 红 |
| stopped | StopCircle | "已停止 · 3s" | 黄 |

### 4.4 错误分类（来自 harnessclaw，10 种 + 视觉映射）

```typescript
type ErrorType =
  | 'invalid_input'      // 输入无效
  | 'permission_denied'  // 权限不足
  | 'tool_timeout'       // 工具超时
  | 'user_aborted'       // 用户中止
  | 'rate_limit'         // 频率限制
  | 'overloaded'         | 'model_error'
  | 'contract_fail'      // 协议失败
  | 'dependency_fail'    // 依赖失败
  | 'internal'           // 内部错误（兜底）
```

每种错误有独立的 icon + label + color + 是否可重试：

| 错误类型 | 图标 | 色系 | 可重试 |
|---------|------|------|--------|
| invalid_input | 📋 | 琥珀 | 否 |
| permission_denied | 🔒 | 琥珀 | 否 |
| tool_timeout | ⏱ | 橙色 | 是 |
| rate_limit | ⏳ | 橙色 | 是（带倒计时） |
| overloaded | 🌐 | 橙色 | 是 |
| model_error | 🤖 | 红色 | 视情况 |
| 其他 | ⚠️ | 红色 | 否 |

---

## 五、思考块交互设计

### 5.1 展开折叠策略（融合 opencowork 自动 + MyAgents 手动 pin）

这是最关键的设计决策——两家各有道理，融合方案取两者之长：

```
状态                默认展开    自动行为              用户操作
─────────────────────────────────────────────────────────────
active（思考中）      是         流式自动展开           不可收起（强制看）
completed（刚完成）   是→否      2秒后自动收起          可立即展开/pin
completed（历史）     否         保持折叠              点击展开
failed / stopped     是         保持展开              可收起
```

核心规则（伪代码）：
```typescript
// 默认展开条件
defaultExpanded =
  isThinkingActive                          // 思考中：强制展开
  || thinkingStatus === 'failed'            // 失败：展开看原因
  || thinkingStatus === 'stopped'           // 停止：展开看中断点
  || justCompletedWithin(2000ms)            // 刚完成2秒内：展开让用户扫一眼

// 是否强制展开（不可收起）
forceExpanded = isThinkingActive

// 用户 pin（来自 MyAgents 理念）
userPinned: boolean  // 用户展开过 → pin 住，不被自动收起

// 最终展开状态
expanded = forceExpanded || userPinned || defaultExpanded
```

**为什么这样设计**：
- 思考中强制展开——满足需求1（始终知道在干嘛）
- 刚完成 2 秒内展开——满足需求2（能看到思考过程），让用户有机会扫一眼
- 2 秒后自动收起——不碍眼，满足需求4（控制详细程度）
- 用户展开过就 pin——尊重用户意图，不会被自动收起打断（来自 MyAgents 的教训）
- 失败/停止保持展开——异常情况要让用户看到

### 5.2 计时器（融合 opencowork 实时 + 完成定格）

| 状态 | 计时显示 |
|------|---------|
| active | "思考中…（3s）" 实时更新，每秒刷新 |
| completed | "思考完成 · 5s" 定格总时长 |
| failed | "思考失败 · 5s" 定格 |
| stopped | "已停止 · 3s" 定格 |

### 5.3 视觉设计

- 图标：Brain（完成）/ Loader2（活跃）/ XCircle（失败）/ StopCircle（停止）
- 主题色：紫色系（Brain 图标用 violet，来自 opencowork）
- 活跃态：图标脉冲动画 + 阴影
- 展开箭头：ChevronDown（展开）/ ChevronRight（折叠）
- 内容区：Markdown 渲染，活跃时自动滚动到底部
- 流式渲染：用渲染池（来自 opencowork 的 useStreamingRenderPool），可配置动画风格

### 5.4 think 标签兼容（来自 AionUi）

即使模型把思考内容混在正文里（用 `<think` 标签包裹），也要解析出来渲染成独立思考块：

| 标签格式 | 处理 |
|---------|------|
| `<think...</think` | 解析为独立思考块 |
| `<thinking...</thinking` | 解析为独立思考块 |
| MiniMax 风格（无开标签） | 解析首个 `</think` 之前的内容 |
| 孤立标签 | 清理掉 |

---

## 六、执行块交互设计

### 6.1 单个执行块（ProcessRow）——融合四家之长

每个执行块一行，包含以下元素（从左到右）：

```
[圆点] [图标] [主标签] [摘要节点] [计时] [展开箭头]
  │      │      │        │        │       │
  │      │      │        │        │       └─ ChevronDown/Right
  │      │      │        │        └─ "3s" / "5s"（来自 opencowork）
  │      │      │        └─ "Edit +5 -3" / "Grep 12 matches"（来自 MyAgents）
  │      │      └─ "正在读取" / "已运行命令"（来自 Codex 文案变形）
  │      └─ 工具图标 / 状态图标（来自 opencowork）
  └─ 状态圆点：绿脉冲/灰/红/黄（来自 MyAgents）
```

**状态圆点**（来自 MyAgents）：
| 状态 | 圆点 |
|------|------|
| active | 绿色 + 脉冲动画 |
| failed | 红色 |
| stopped / canceled | 黄色 / 灰色 |
| completed | 灰色（ink-muted/40） |

**摘要节点**（来自 MyAgents getToolSummaryNode）——折叠态就显示关键结果：
| 工具 | 摘要示例 |
|------|---------|
| Edit | "+5 -3"（增5行删3行） |
| Grep | "12 matches" |
| Read | "3 files" |
| Bash | "exit 0" / "exit 1" |

### 6.2 执行块默认展开/折叠（融合 opencowork + Kun 四层优先级）

```typescript
// 默认展开条件（来自 Kun 的四层优先级）
defaultExpanded =
  (isActive && hasError)                    // 进行中且出错：展开看错误
  || hasPendingApproval                     // 待审批：展开让用户决策
  || needsUserInput                         // 需用户输入：展开让用户填
  || (isActive && !isReadTextTool)          // 活跃中且非大文本：展开看进度
  || hasVisualOutput                        // 有图片等视觉输出：展开看

// 强制展开（不可收起）
forceExpanded =
  hasPendingApproval                        // 待审批强制展开
  || needsUserInput                         // 需输入强制展开

// 用户操作
userPinned: boolean                         // 用户展开过 → pin

// 最终状态
expanded = forceExpanded || userPinned || defaultExpanded
```

**特殊处理**：
- 纯文本 Read 工具：默认折叠（大输出，点开才加载，来自 opencowork）
- 从活跃变非活跃：自动收起（除非 userPinned）
- 错误：默认展开但可收起（来自 Kun）

### 6.3 工具输出折叠（来自 lobsterai 三层 + opencowork 单工具）

| 输出大小 | 展示方式 |
|---------|---------|
| ≤ 4KB | 正常显示 |
| 4KB ~ 64KB | 显示前 4KB 预览 + "展开全文"按钮 |
| > 64KB | 只显示前 4KB 预览，不提供全文（性能保护） |
| 多行输出 | 超 40 行截断 + "展开更多" |
| stderr | 默认展开（错误优先，来自 opencowork） |

### 6.4 工具特化视图（来自 lobsterai + AionUi）

不同工具类型有定制渲染：

| 工具类型 | 特化视图 |
|---------|---------|
| TodoWrite | 待办列表，每项有状态复选框（完成绿/进行中蓝/待办灰） |
| Edit / Replace | diff 视图，红绿对照，默认展开（来自 AionUi） |
| 媒体生成 | Lottie 动画 + 进度（来自 lobsterai） |
| 命令执行 | 终端模拟器，支持交互（来自 opencowork LocalTerminal） |
| 网页搜索 | 结果卡片列表，可点击跳转 |
| 文件操作 | 文件树视图 |

---

## 七、过程折叠设计（三套并存）

这是"全网最强"的关键——三套折叠机制覆盖不同场景，用户始终能控制详细程度：

### 7.1 第一套：过程组内折叠（来自 MyAgents head+tail）

当一轮内的执行块超过阈值时：

```
参数：
  FOLD_THRESHOLD = 6      // 超过 6 个触发
  VISIBLE_HEAD = 2        // 首 2 个始终可见
  VISIBLE_TAIL = 2        // 尾 2 个始终可见

折叠后：
  [块1] [块2] [+4 更多] [块5] [块6]
                    │
                    └─ 点击展开全部
```

**为什么 head+tail 而不是全折叠**：
- 首 2 个：保留上下文（为什么开始做这些）
- 尾 2 个：保留最新进展（做到哪了）
- 中间折叠：避免信息过载
- 用户展开任意行 → 整组 pin 展开（来自 MyAgents 的联动）

### 7.2 第二套：工具智能分组（来自 opencowork）

连续相同工具名的调用自动合并成组：

```
3 次连续 Read → [读取了 3 个文件 ▸]  （折叠成一行）
5 次连续 Grep → [在 8 个文件中找到 23 处匹配 ▸]
3 次连续 Bash → [运行了 3 条命令 ▸]
```

组级状态从子项聚合（优先级：error > running > streaming > pending_approval > completed）。

**与 head+tail 的关系**：先分组，再对组内应用 head+tail。即：
1. 连续相同工具先合并成组
2. 组 + 独立块一起参与 head+tail 折叠

### 7.3 第三套：历史轮次折叠（来自 Kun 虚拟分页 + Codex compact）

```
参数：
  TURN_PAGE_SIZE = 18           // 每页 18 轮
  AUTO_COLLAPSE_THRESHOLD = 24  // 超 24 轮自动折叠

行为：
  轮次 ≤ 18     → 全部显示
  轮次 19~24    → 全部显示，显示"折叠更早的轮次"按钮
  轮次 > 24     → 自动折叠，只显示最近 18 轮 + "加载更早"按钮
```

**始终渲染规则**（来自 lobsterai）：最近 3 轮始终渲染（流式/自动滚动需要），更早的懒加载。

**compact 压缩**（来自 Codex）：对话超长时，把最早的历史过程压缩成摘要文本，只保留关键信息。压缩处显示压缩分隔器（来自 lobsterai 的 ContextCompactionDivider，带动画进度条）。

### 7.4 全局详细程度控制（新增——满足需求4）

底部状态条提供全局开关：

| 按钮 | 效果 |
|------|------|
| "全部展开" | 展开所有思考块+执行块 |
| "全部收起" | 收起所有，只留标签行 |
| "只看结论" | 收起所有过程，只留最终回复 |

---

## 八、底部状态条设计（融合 harnessclaw 三层降级 + Codex 计数摘要）

### 8.1 三层降级（来自 harnessclaw）

对话底部始终有一个状态条，降级展示当前状态：

```
优先级1（最高）：当前执行动作的实时状态
  "正在读取 config.ts" + 绿脉冲圆点 + 计时 3s

优先级2：agent.intent 进度句（来自 harnessclaw）
  "正在搜索相关配置文件" + 呼吸圆点

优先级3：计数摘要（来自 Codex）
  "3 个进行中 · 5 个已完成" + 总计时

优先级4（兜底）：通用思考指示
  "思考中…" + 呼吸圆点
```

### 8.2 计数摘要（来自 Codex）

当有多个并发动作时，折叠成计数：
- "3 个进行中"（绿色脉冲）
- "5 个已完成"（灰色）
- "1 个出错"（红色）

---

## 九、错误处理设计（融合 harnessclaw + Kun + lobsterai）

### 9.1 错误展示策略

| 维度 | 设计 |
|------|------|
| 默认展开 | 是（错误优先，来自 Kun） |
| 可收起 | 是（用户可手动收起，来自 Kun） |
| 错误色系 | 红/橙/琥珀三档（来自 Kun processErrorTone） |
| 错误分类 | 10 种类型，各有图标+文案+色系（来自 harnessclaw） |
| 信息分层 | 用户信息 vs 诊断信息分离（来自 harnessclaw） |
| 可重试 | 显示"可重试"+倒计时（来自 harnessclaw） |

### 9.2 错误卡片结构

```
┌─────────────────────────────────────┐
│ ⏱ 超时 · 30s          [可重试 5s]    │  ← 错误类型 + 时长 + 重试
│ 工具执行超过 30 秒未响应              │  ← 用户可见信息
│ ┌─ 详情 ────────────────────────┐    │
│ │ error.code: TOOL_TIMEOUT       │    │  ← 诊断信息（折叠）
│ │ tool: web_fetch                │    │
│ └────────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 9.3 重试机制（来自 harnessclaw）

- `retryable: true` → 显示"可重试"按钮
- `retryAfterMs` → 显示倒计时"5 秒后自动重试"
- 手动重试 + 自动重试两种模式

---

## 十、性能设计（融合 Kun + MyAgents + lobsterai）

### 10.1 延迟渲染（来自 Kun useDeferredRender）

非活跃段展开时，延迟渲染详情内容：
- 用 `useDeferredRender` hook
- `contentVisibility: 'auto'` + `containIntrinsicSize: 'auto 220px'`
- 活跃段/执行段立即渲染，其他段延迟

### 10.2 折叠即卸载（来自 MyAgents）

折叠的内容不 mount（而非 CSS 隐藏）：
- 避免 100 个工具子树在流式 delta 时重渲染
- 折叠态只保留轻量 header（圆点/图标/标签）
- 展开时才 mount 详情

### 10.3 虚拟化（来自 Kun + lobsterai）

- 轮次级虚拟分页：每页 18 轮
- 最近 3 轮始终渲染
- 更早轮次用 LazyRenderTurn 懒加载
- 超阈值自动折叠历史

### 10.4 流式渲染优化

- 渲染池（来自 opencowork useStreamingRenderPool）：批量更新文本，避免每个 token 重渲染
- 思考内容限高滚动（max-h-300px，来自 lobsterai）
- 自动滚动到底部仅活跃时触发

---

## 十一、完整交互流程

### 11.1 一次完整任务的用户体验

```
1. 用户发消息
   → 底部状态条："思考中…" + 呼吸圆点

2. AI 开始思考
   → 思考段出现，紫色 Brain 图标 + 脉冲
   → 思考块自动展开，流式显示思考内容
   → 计时器："思考中…（1s）（2s）（3s）…"

3. AI 思考完成，开始执行
   → 思考块 2 秒后自动收起，显示"思考完成 · 5s"
   → 执行段出现
   → 第一个执行块："● 正在读取 config.ts" + 绿脉冲 + 计时
   → 底部状态条："正在读取 config.ts" + 3s

4. 连续执行多个动作
   → 多个执行块排列
   → 超过 6 个 → head+tail 折叠：[块1][块2][+4 更多][块5][块6]
   → 连续 3 次 Read → 合并成"读取了 3 个文件"

5. 某个动作出错
   → 错误块默认展开：⏱ 超时 · 30s + 红色圆点
   → 显示用户信息 + 可折叠诊断详情
   → 显示"可重试 5s"倒计时

6. AI 继续思考
   → 新思考段出现（思考+执行可交替多轮）

7. AI 输出最终回复
   → 产出段出现，Markdown 渲染

8. 用户想看细节
   → 点击任意执行块 → 展开看输入/输出/diff
   → 点击"全部展开" → 一键展开所有过程
   → 点击"只看结论" → 一键收起，只留最终回复

9. 对话变长
   → 超 24 轮 → 自动折叠历史
   → 显示"折叠更早的轮次"按钮
   → 超长 → compact 压缩最早的历史，显示压缩分隔器
```

### 11.2 状态转换全景

```
思考块：  active ──→ completed ──→ (2s后折叠)
              │           │
              ├──→ failed (保持展开)
              └──→ stopped (保持展开)

执行块：  streaming ──→ running ──→ completed (自动收起)
              │            │
              │            ├──→ error (默认展开,可收起)
              │            ├──→ stopped (保持展开)
              │            └──→ canceled (自动收起)
              └──→ pending_approval (强制展开)
```

---

## 十二、与各家对比

| 维度 | 本方案 | 最强竞品 | 优势来源 |
|------|--------|---------|---------|
| 状态机 | 7 态 + 10 种错误分类 | opencowork 6 态 | +stopped +错误分类 |
| 思考展开 | 自动+pin+2秒宽限 | opencowork 自动 / MyAgents 手动 | 融合两者 |
| 过程折叠 | 三套并存 | 各家一套 | head+tail+分组+虚拟分页+compact |
| 执行块信息 | 圆点+图标+标签+摘要+计时 | MyAgents（最全） | +Codex文案变形 |
| 错误处理 | 分类+重试+信息分层+特化视图 | harnessclaw（分类） | +lobsterai特化 |
| 工具特化 | 6 种特化视图 | lobsterai（4种） | +命令终端 |
| 性能 | 延迟渲染+卸载+虚拟化+渲染池 | Kun（延迟+虚拟化） | +MyAgents卸载+opencowork池 |
| 详细程度控制 | 全局三档开关 | 无 | 新增 |
| 底部状态条 | 四层降级+计数 | harnessclaw三层 | +Codex计数 |

---

## 十三、开发优先级建议

### 第一阶段（MVP——先能用）
1. 数据模型：ContentBlock[] + 基础分段
2. 状态机：6 态（streaming/running/completed/error/canceled/stopped）
3. 思考块：自动展开/收起 + 计时
4. 执行块：圆点+图标+标签+展开看详情
5. 基础折叠：head+tail

### 第二阶段（体验优化）
6. 工具智能分组 + 定制摘要
7. 思考块 pin + 2 秒宽限
8. 错误分类 + 重试机制
9. 工具特化视图（diff/todo）
10. 底部状态条四层降级

### 第三阶段（性能+高级）
11. 虚拟分页 + 自动折叠
12. compact 压缩 + 压缩分隔器
13. 延迟渲染 + 折叠卸载
14. 流式渲染池
15. 全局详细程度三档开关

---

## 十四、设计决策记录

### Q1：思考块该自动展开还是手动展开？
**决策：自动展开 + 2 秒宽限 + 用户可 pin**
- 思考中：强制展开（满足"始终知道在干嘛"）
- 刚完成：展开 2 秒让用户扫一眼（满足"能看到思考过程"）
- 2 秒后：自动收起（不碍眼）
- 用户展开过：pin 住不被自动收起（尊重用户意图）
- 理由：opencowork 纯自动会在完成瞬间收起用户来不及看；MyAgents 纯手动太被动。融合两者取长补短。

### Q2：过程折叠用 head+tail 还是虚拟分页？
**决策：三套并存，各管各的场景**
- head+tail：管单轮内执行块过多（6+个）
- 智能分组：管连续相同工具（3+次 Read）
- 虚拟分页+compact：管多轮对话过长（24+轮）
- 理由：它们不冲突，是不同层级的折叠。head+tail 是块级，分组是块级优化，虚拟分页是轮次级，compact 是内容级。

### Q3：stopped 和 canceled 和 error 要区分吗？
**决策：三态区分**
- stopped：用户主动停止（黄色，中性）
- canceled：系统/流程取消（灰色，中性）
- error：出错（红色，异常）
- 理由：来自 Codex 的 Stopped 概念 + harnessclaw 的 cancel 中性化。用户主动停和出错是完全不同的体验，不该混为一谈。

### Q4：错误要不要默认展开？
**决策：默认展开，可手动收起**
- 理由：来自 Kun。错误是用户最需要看到的信息，默认展开。但不要强制占屏，用户看完了可以收起。与 pending_approval 的"强制展开不可收起"区分——审批必须用户操作完才能收起，错误看完了就可以收起。

### Q5：底部状态条有必要吗？
**决策：有必要，四层降级**
- 理由：来自 harnessclaw。即使用户把所有过程都折叠了，底部状态条仍能告诉"现在在干嘛"，满足需求1。四层降级确保任何状态都有有意义的反馈，不会出现空白或无意义 spinner。
