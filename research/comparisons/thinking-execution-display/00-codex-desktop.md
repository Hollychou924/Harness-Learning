# Codex 桌面版：思考+执行交替展示逻辑调研

> 调研对象：本地安装的 Codex.app（/Applications/Codex.app）
> 源码来源：解包 app.asar（Vite 构建产物，已混淆压缩），通过国际化文案、数据结构、渲染标签反推产品逻辑
> 调研日期：2026-07-03
> 核查范围：webview/assets 全量 JS 文件，重点核查 onboarding-page、local-conversation-thread、remote-conversation-page 三个渲染主文件

---

## 一、核心结论

Codex 桌面版**确实采用"思考解说 + 执行动作按顺序交替、执行默认折叠可展开、以文字为主"的展示模式**，且实现精细度很高：

1. **数据结构天然交替**：一轮对话的内容是一个有序列表（turn.items），里面混排着"解说文本"（agentMessage，带 phase 标记）和"执行动作"（改文件/搜代码/跑命令等），按真实发生顺序排列
2. **执行态有完整状态机**：不只是"正在XXX"，还有"已XXX""已停止XXX"三态
3. **过程可折叠、可只留结论**：有"查看详情/收起/展开"交互，有"显示更多/收起"的过程折叠，有对话压缩（compact）机制
4. **文案用富文本标签渲染**：`<action>` `<status>` `<detail>` 三种标签组合出执行态行

> ⚠️ 局限说明：Codex 是混淆构建产物，渲染组件的具体 JSX 结构无法完整还原。以下逻辑是从文案体系、数据结构枚举、状态值枚举交叉验证得出的产品级行为描述，非逐行源码级确认。未确认部分会明确标注。

---

## 二、数据结构：交替排列的基础

### 2.1 轮次（Turn）结构

一轮对话 = 用户输入 + 一个有序的内容列表（items）。items 数组里混排以下类型：

| 内容类型 | 说明 | 在渲染中的角色 |
|---------|------|--------------|
| `agentMessage` | 智能体的解说文本，带 `phase` 字段 | 思考解说 / 最终结论 |
| `patch` | 文件改动（增/删/改行） | 执行动作 |
| `command` / `exec` | 命令执行 | 执行动作 |
| `search` | 代码搜索 | 执行动作 |
| `read` | 读取文件 | 执行动作 |
| `file` | 文件操作 | 执行动作 |
| `context` | 上下文加载 | 执行动作 |
| `proposal` | 提案/建议 | 执行动作 |
| `plan` | 计划 | 执行动作 |

关键发现：`agentMessage` 有 `phase` 字段，其中 `commentary` 值代表"思考过程的解说"。源码逻辑：
```
t.type===`agentMessage`||t.phase===`commentary`  → 提取为解说文本
```
这意味着 Codex 把"思考过程"作为带 phase 标记的文本块，和执行动作在同一列表里按顺序排列，天然形成"思考一段→执行一段→再思考一段"的交替。

### 2.2 状态值枚举（从源码提取的全集）

执行动作的状态有以下取值（按出现频率排序）：

| 状态值 | 含义 | 出现次数 |
|-------|------|---------|
| `completed` / `complete` / `done` | 已完成 | 44 |
| `pending` | 等待中 | 30 |
| `running` | 进行中 | 26 |
| `failed` | 失败 | 26 |
| `inProgress` / `in_progress` | 进行中 | 36 |
| `stopped` | 已停止 | 5 |
| `skipped` | 已跳过 | 5 |
| `cancelled` / `canceled` | 已取消 | 6 |
| `succeeded` | 成功 | 1 |

> 注意：以上是全局状态枚举，不同动作类型可能只用其中子集。具体每个动作用哪些状态，需结合文案确认（见第三节）。

---

## 三、执行态状态机：三态文案体系

### 3.1 文件操作（patch 类）——进行时 / 已停止

从国际化键名提取的完整文案：

| 状态 | 国际化键 | 默认文案 |
|------|---------|---------|
| 进行时 | `codex.patch.change.creating` | Creating {path}（正在创建 {路径}） |
| 进行时 | `codex.patch.change.editing` | Editing {path}（正在编辑 {路径}） |
| 进行时 | `codex.patch.change.deleting` | Deleting {path}（正在删除 {路径}） |
| 已停止 | `codex.patch.change.stoppedCreating` | （已停止创建） |
| 已停止 | `codex.patch.change.stoppedEditing` | （已停止编辑） |
| 已停止 | `codex.patch.change.stoppedDeleting` | （已停止删除） |

> 这里证实了用户说的"不只是正在XXX，还有已停止XXX"——文件操作至少有"进行时"和"已停止"两态。是否有"已完成"态，从键名看创建/编辑/删除完成后的展示可能走通用 patch 渲染而非独立文案（未完全确认）。

### 3.2 命令执行（command 类）——三态完整

用 `<action>` 标签的文案（现在时 / 过去时 / 停止态）：

| 状态 | 文案模板 | 中文含义 |
|------|---------|---------|
| 进行时 | `<action>Running</action> <detail>{command}</detail>` | 正在运行 + 命令详情 |
| 进行时 | `<action>Running command</action>` | 正在运行命令 |
| 已完成 | `<action>Ran</action> <detail>{command}</detail>` | 已运行 + 命令详情 |
| 已完成 | `<action>Ran command</action>` | 已运行命令 |
| 已停止 | `<action>Stopped</action> <detail>{command}</detail>` | 已停止 + 命令详情 |
| 已停止 | `<action>Stopped command</action>` | 已停止命令 |

### 3.3 带计时器的状态行（status 标签）

用 `<status>` 标签的文案，带 `{timer}` 计时器变量：

| 状态 | 文案模板 | 含义 |
|------|---------|------|
| 进行时 | `<status>Running command</status>{timer}` | 运行命令 + 计时 |
| 进行时 | `<status>Checking the current date and time</status>{timer}` | 正在检查时间 + 计时 |
| 已完成 | `<status>Ran command</status>{timer}` | 已运行命令 + 计时 |
| 已完成 | `<status>Ran</status> {command}{timer}` | 已运行 + 命令 + 计时 |
| 已完成 | `<status>Checked the current date and time</status>{timer}` | 已检查时间 + 计时 |
| 已停止 | `<status>Stopped command</status>{timer}` | 已停止命令 + 计时 |
| 已停止 | `<status>Stopped</status> {command}{timer}` | 已停止 + 命令 + 计时 |
| 已停止 | `<status>Stopped checking the current date and time</status>{timer}` | 已停止检查时间 + 计时 |

### 3.4 其他执行动作的完整文案

| 动作 | 进行时 | 已完成/其他 |
|------|-------|------------|
| 读取文件 | `<action>Reading</action> <detail>{target}</detail>` | — |
| 读取技能 | `<action>Reading</action> <detail>{skillName} skill</detail>` | — |
| 搜索文件 | `<action>Searching</action> <detail>files</detail>` | — |
| 搜索文件(指定目录) | `<action>Searching</action> <detail>files in {folder} folder</detail>` | — |
| 搜索内容 | `<action>Searching</action> <detail>for {query}</detail>` | — |
| 列出文件 | `<action>Listing</action> <detail>files</detail>` | — |
| 列出文件(指定目录) | `<action>Listing</action> <detail>files in {folder} folder</detail>` | — |
| 创建文件 | `<action>Creating</action> <detail>{path}</detail>` | — |
| 删除文件 | `<action>Deleting</action> <detail>{path}</detail>` | — |
| 编辑文件 | `<action>Editing</action> <detail>{path}</detail>` | — |
| 网页搜索 | `<action>Searching the web</action>` | — |
| 网页搜索(带查询) | `<action>Searching the web</action> <detail>for {query}</detail>` | — |
| 审批通过 | — | `<action>Approved</action> <detail>request</detail>` |
| 审批拒绝 | — | `<action>Denied</action> <detail>request</detail>` |

### 3.5 状态机总结图

```
                 ┌─────────────┐
                 │   pending   │ （等待开始）
                 └──────┬──────┘
                        ▼
                 ┌─────────────┐
        ┌────────│   running   │────────┐  （正在XXX + 计时器）
        │        └─────────────┘        │
        ▼                 ▼              ▼
 ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
 │  completed  │  │   stopped   │  │   failed    │  （已XXX / 已停止 / 失败）
 │  已完成     │  │  已停止     │  │  出错       │
 └─────────────┘  └─────────────┘  └─────────────┘
```

每个状态对应不同的文案动词形态：
- running → "Running / Reading / Editing / Creating / Searching"（现在进行时）
- completed → "Ran / Checked"（过去时）
- stopped → "Stopped"（停止态）
- failed → 错误展示（具体文案未完整提取，但状态值存在）

---

## 四、思考解说（Commentary）展示

### 4.1 思考解说的定位

Codex 的"思考过程"不是独立的思考块，而是 `agentMessage` 类型里 `phase === 'commentary'` 的文本。这意味着：
- 思考解说和最终回复是同一种数据类型（都是 agentMessage），只是 phase 不同
- commentary 阶段的文本会作为"过程解说"展示在执行动作之间
- 最终结论则是 phase 不同的 agentMessage

### 4.2 思考状态展示

源码中有独立的"思考"状态指示：
- 文案 `Thinking`（多处出现，绑定 GPT-5.5 Thinking 模型能力）
- 文案 `Reasoning` / `Reasoning effort`（推理强度设置）
- onboarding 里有 `csvExecutionThinking`（动画思考指示器）

> 未完全确认：commentary 文本是否带独立的折叠/计时器。从文案看有 `Thinking` 状态标签，但具体折叠规则在混淆代码中无法清晰还原。

---

## 五、过程折叠与"只留结论"机制

### 5.1 执行过程的折叠交互

从 local-conversation-thread 文件提取的相关文案：

| 文案 | 含义 |
|------|------|
| `View details` | 查看详情（展开执行过程） |
| `Collapse background agent details` | 收起后台智能体详情 |
| `Expand background agent details` | 展开后台智能体详情 |
| `Show less` | 收起（显示更少） |
| `Show {count, number} more` | 显示更多（+N 个） |
| `View all processes` | 查看全部过程 |
| `{count, plural, one {# working} other {# working}}` | N 个进行中 |
| `{count, plural, one {# done} other {# done}}` | N 个已完成 |

这说明：
- 执行过程默认是折叠的，可点"查看详情"展开
- 多个执行动作可以折叠成"N 个进行中 / N 个已完成"的计数摘要
- 有"显示更多/收起"来控制过程展示数量

### 5.2 轮次折叠（只留结论）

相关文案和机制：

| 文案 | 含义 |
|------|------|
| `Summary panel couldn't render` | 总结面板（只留结论的展示区） |
| `This turn couldn't render` | 轮次渲染失败兜底 |
| `Fork from earlier message?` | 从更早消息分叉 |
| `Compact is disabled while a task is in progress` | 任务进行中时禁止压缩 |

对话压缩（Compact）机制——这是 Codex"把过程折叠、只留结论"的核心：
| 文案 | 含义 |
|------|------|
| `Before Codex compacts the conversation` | 压缩前 |
| `After Codex compacts the conversation` | 压缩后 |
| `Context compacted` | 上下文已压缩 |
| `Context automatically compacted` | 上下文自动压缩 |
| `Compacting context` | 正在压缩上下文 |
| `Automatically compacting context` | 自动压缩上下文中 |
| `Context may automatically compact.` | 上下文可能自动压缩 |

> 压缩机制说明：当对话过长时，Codex 会自动把历史过程压缩，只保留关键信息。这不是简单的 UI 折叠，而是内容层面的压缩——前面的思考+执行过程被压缩成摘要，用户看到的是"压缩标记 + 后续新内容"。

### 5.3 后台智能体（Background Agent）

Codex 有后台智能体功能，执行过程可以折叠为后台详情：
- `Collapse background agent details` / `Expand background agent details` —— 后台智能体的执行过程可收起/展开
- 后台终端（Background terminal）有独立的运行状态展示：`Running` / `Starting…` / `Stopped` / `Stopping…` / `Stop`

---

## 六、渲染标签体系

Codex 用三种富文本标签组合出执行态行的视觉结构：

| 标签 | 作用 | 示例 |
|------|------|------|
| `<action>` | 动作词（动词，带状态色） | Running / Ran / Stopped / Reading / Editing |
| `<detail>` | 详情内容（目标对象，等宽字体） | {command} / {path} / {target} / {query} |
| `<status>` | 状态行（带计时器） | Running command + {timer} |
| `{timer}` | 计时器变量 | 实时秒数 |

典型组合：
- 执行中：`<action>Running</action> <detail>{command}</detail>` → "正在运行 命令详情"
- 已完成：`<action>Ran</action> <detail>{command}</detail>` → "已运行 命令详情"
- 带计时：`<status>Running command</status>{timer}` → "运行命令 12s"

---

## 七、产品体验总结（指导开发用）

### 7.1 用户看到的完整流程

1. 用户发消息 → 智能体开始思考 → 显示"Thinking"状态
2. 思考解说（commentary文本）出现在对话流里，说明正在想什么
3. 执行动作出现：`<action>Reading</action> <detail>{target}</detail>` → "正在读取 某文件"，默认折叠可展开看详情
4. 继续思考解说 → 继续执行动作 → 交替进行
5. 执行动作完成后，文案从"Running"变为"Ran"，计时器定格
6. 执行动作被停止时，文案变为"Stopped"
7. 多个执行动作可折叠为"N 个进行中 / N 个已完成"的计数摘要
8. 对话过长时自动压缩，历史过程变成摘要，只留关键结论

### 7.2 开发参考要点

如果要复刻 Codex 这种模式，关键设计点：

1. **数据层**：思考解说和执行动作放在同一个有序列表里，按时间排列，天然交替
2. **状态机**：每个执行动作至少三态（进行时/已完成/已停止），复杂动作还有失败/跳过/取消
3. **文案体系**：用"动词+详情"的结构，动词随状态变形（Running→Ran→Stopped），详情用等宽字体
4. **计时器**：进行时实时计时，完成/停止后定格
5. **折叠**：单个执行动作可展开看详情；多个动作可折叠成计数摘要；整段历史可压缩成结论
6. **思考解说**：不独立成块，作为带 phase 标记的文本混排在执行动作之间

### 7.3 未完全确认的部分

- commentary 思考文本是否有独立的折叠/计时（源码混淆，只看到 Thinking 状态标签）
- 文件操作的"已完成"态文案（键名只看到 creating/editing/deleting 和 stopped 三态，完成态可能走通用渲染）
- 执行动作详情展开后的具体内容结构（命令输出/diff/搜索结果的具体渲染组件未还原）
- compact 压缩后的摘要具体展示格式
