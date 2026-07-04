# 思考+执行交替展示模式：竞品调研总览

> 调研主题：任务执行中，"正在XXX，可看详情，默认折叠" + "思考过程文字" + "执行过程"交替展示的产品模式
> 调研对象：Codex 桌面版 + 6 个桌面端竞品
> 调研日期：2026-07-03
> 文档目录：research/comparisons/thinking-execution-display/

---

## 一、调研对象一览

| 对象 | 版本 | 技术栈 | 是否完整源码 | 详细文档 |
|------|------|--------|------------|---------|
| Codex 桌面版 | 当前安装版 | React+Vite+Electron（混淆产物） | 否（app.asar解包） | [00-codex-desktop.md](00-codex-desktop.md) |
| opencowork | v1.0.0 | React+TS+Electron | 是 | [01-opencowork.md](01-opencowork.md) |
| MyAgents | v0.2.44 | React+TS+Electron | 是 | [02-myagents.md](02-myagents.md) |
| Kun | v0.1.0 | React+TS+Electron | 是 | [03-kun.md](03-kun.md) |
| AionUi | v2.1.27 | React+TS+Arco Design | 是 | [04-aionui.md](04-aionui.md) |
| lobsterai | v2026.6.30 | React+TS+Heroicons | 是 | [05-lobsterai.md](05-lobsterai.md) |
| harnessclaw | v0.0.23 | React+TS | 是 | [06-harnessclaw.md](06-harnessclaw.md) |

> 另有 hexclaw-desktop（Vue）和 kuse-cowork（SolidJS）经核查仅在数据层/store 层处理 thinking，无独立的思考展示渲染组件，不属于此类模式，未出独立文档。

---

## 二、模式分类

### 2.1 完整交替折叠型（推荐参考）

**opencowork、MyAgents、Kun** —— 这三个实现了完整的"思考+执行交替、默认折叠、可看详情"模式，且各有特色：

- **opencowork**：交替最自然（switch 按块顺序渲染），思考块最精细（实时计时+完成自动收起），工具分组最智能（定制摘要）
- **MyAgents**：过程组折叠最独特（head+tail 模式），状态机最完整（思考四态+工具五态），纯手动展开（避免跳动）
- **Kun**：结构化最高（显式分段），折叠优先级最精细（四层），虚拟分页最完善（自动折叠阈值）

### 2.2 简化交替型

**AionUi、lobsterai** —— 有思考块+工具展示的交替，但实现相对简化：

- **AionUi**：类型分发清晰，think 标签兼容好，但无工具分组
- **lobsterai**：轮次组织清晰，工具结果三层折叠好，有压缩分隔器

### 2.3 状态指示型（非交替）

**harnessclaw** —— 不做交替折叠流，而是底部状态指示（三层降级），但有独特的 agent.intent 进度句和丰富的错误分类

### 2.4 文案驱动型

**Codex 桌面版** —— 用 `<action>` `<status>` `<detail>` 富文本标签驱动执行态展示，三态状态机（进行/完成/停止），有压缩机制

---

## 三、核心维度横向对比

### 3.1 数据结构

| 对象 | 交替基础 | 思考块定位 |
|------|---------|-----------|
| Codex | turn.items 有序列表混排 | agentMessage 的 phase=commentary |
| opencowork | ContentBlock[] 按 type 顺序 | 独立 thinking 块 + text 内嵌 think 标签 |
| MyAgents | ContentBlock[] 分组（text vs 过程组） | thinking 块（归入过程组） |
| Kun | ChatBlock[] 显式分段 | reasoning 块 → reasoning 段 |
| AionUi | TMessage[] 按 type 分发 | thinking 类型消息 |
| lobsterai | ConversationTurn.assistantItems[] | assistant 项里的思考消息 |
| harnessclaw | 非交替（底部指示） | currentThinking 状态 |

### 3.2 执行态状态机

| 对象 | 状态数 | 状态值 |
|------|--------|--------|
| Codex | ≥3 | running / completed（Ran）/ stopped（Stopped）+ failed |
| opencowork | 6 | streaming / pending_approval / running / completed / error / canceled |
| MyAgents | 5（工具）/ 4（思考） | 活跃 / 失败 / 已停止 / 错误 / 完成 |
| Kun | 3+ | running / success / error + pending/submitting/allowed/denied |
| AionUi | 3 | completed / error / running |
| lobsterai | 2+ | streaming / 完成 |
| harnessclaw | 4 | ok / failed / cancelled / skipped + 10种错误类型 |

### 3.3 思考块展开折叠

| 对象 | 默认状态 | 自动行为 | 计时器 |
|------|---------|---------|--------|
| Codex | 未完全确认 | 有 Thinking 状态 | 有（timer） |
| opencowork | 思考中展开，完成折叠 | 完成自动收起 | 实时+完成定格 |
| MyAgents | 始终折叠 | 纯手动（不自动） | 实时+完成定格 |
| Kun | 活跃思考段展开 | 活跃展开，完成折叠 | reasoningDurationMs |
| AionUi | 思考中展开，完成折叠 | 完成自动收起 | 实时+完成定格 |
| lobsterai | 流式展开，结束折叠 | 结束自动收起 | 无（仅埋点） |
| harnessclaw | 折叠 | 手动展开 | 无 |

### 3.4 过程折叠（只留结论）

| 对象 | 折叠方式 | 机制 |
|------|---------|------|
| Codex | 计数摘要 + compact 压缩 | N working/done + 上下文压缩 |
| opencowork | 工具分组 + compact-summary | 智能分组摘要 + 压缩摘要项 |
| MyAgents | head+tail 模式 | 首2尾2可见 + "+N"按钮 |
| Kun | 虚拟分页 + 自动折叠 | 18轮/页 + 24轮阈值 + 手动折叠 |
| AionUi | 无 | — |
| lobsterai | 虚拟化 + 压缩分隔器 | 最近3轮 + LazyRenderTurn + ContextCompactionDivider |
| harnessclaw | 无 | — |

### 3.5 工具展示特色

| 对象 | 特色 |
|------|------|
| Codex | action+detail 富文本标签，动词随状态变形 |
| opencowork | 智能分组（Read N files / Grep N matches），状态色徽章 |
| MyAgents | 统一行组件（思考+工具），状态圆点+摘要节点 |
| Kun | 段落图标（Brain/Terminal/Wrench），双层折叠 |
| AionUi | diff 预览（替换类工具直接生成 diff） |
| lobsterai | 工具结果三层折叠（4KB/64KB），工具特化视图（Todo/Diff/媒体） |
| harnessclaw | agent.intent 进度句，错误分类+重试倒计时 |

---

## 四、开发参考建议

### 4.1 如果要复刻 Codex 风格（文案驱动）

参考 Codex 文档：
- 用"动词+详情"结构，动词随状态变形（Running→Ran→Stopped）
- 详情用等宽字体
- 执行态带计时器
- 用 compact 机制做历史压缩

### 4.2 如果要复刻完整交替折叠（推荐）

参考 opencowork + MyAgents + Kun：
- **数据层**：content 是块数组，thinking 和 tool_use 按 type 区分，按顺序排列（opencowork）
- **思考块**：独立组件，思考时展开+计时，完成自动收起（opencowork/AionUi）
- **工具状态机**：至少 4 态（running/completed/error/canceled），最好 6 态（加 streaming/pending_approval）（opencowork）
- **工具分组**：连续相同工具合并，智能摘要（opencowork）
- **过程折叠**：head+tail 模式（MyAgents）或虚拟分页（Kun）
- **错误处理**：错误默认展开但可收起，有独立色系（Kun）

### 4.3 关键设计决策点

| 决策点 | 选项 A | 选项 B | 参考 |
|--------|--------|--------|------|
| 思考展开策略 | 思考时自动展开，完成自动收起 | 纯手动展开 | A: opencowork；B: MyAgents |
| 过程折叠 | head+tail（保上下文） | 虚拟分页（保性能） | A: MyAgents；B: Kun |
| 工具分组 | 智能分组+定制摘要 | 不分组 | A: opencowork；B: AionUi |
| 执行态文案 | 富文本标签（action+detail） | 状态色徽章+图标 | A: Codex；B: opencowork |
| 历史压缩 | 内容级压缩（compact） | UI级折叠（虚拟分页） | A: Codex；B: Kun |

---

## 五、文档索引

- [00-codex-desktop.md](00-codex-desktop.md) — Codex 桌面版：文案驱动的三态状态机
- [01-opencowork.md](01-opencowork.md) — opencowork：最完整的交替折叠实现
- [02-myagents.md](02-myagents.md) — MyAgents：head+tail 过程组 + 四态思考
- [03-kun.md](03-kun.md) — Kun：消息时间线 + 四层折叠优先级
- [04-aionui.md](04-aionui.md) — AionUi：类型分发 + think 标签兼容
- [05-lobsterai.md](05-lobsterai.md) — lobsterai：轮次组织 + 工具结果三层折叠
- [06-harnessclaw.md](06-harnessclaw.md) — harnessclaw：三层降级 + agent.intent 进度句
