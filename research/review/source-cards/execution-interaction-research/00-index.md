# 执行过程交互设计 · 调研索引

> 状态：已入库（2026-07-01，补充更新）
> 用途：为桌面 Agent 执行过程交互 PRD 提供竞品与方法论依据
> 核查范围：本目录收录 17 篇文章核心摘要（S级8 + A级5 + 方法论4），+ 项目已有 26 款产品资料库交叉验证

## 摘要文件分布

| 文件 | 收录文章 | 级别 |
|---|---|---|
| `codex-series.md` | Codex agent loop × 3（官方+Vaughan×2） | S+A |
| `claude-cursor-series.md` | 三方横评/Claude架构/Claude vs Cursor/while循环 × 4 | A |
| `ux-methodology-series.md` | 反着做/Agent UX/Smashing透明/思考图谱 × 4 | A+方法论 |
| `s-level-official-sources.md` | Codex CLI Features/Claude Desktop/Claude权限模式/Cursor3/CopilotLens/Illuminating × 6 | S |

## 一、S 级：直接作为需求文档依据（8篇）

| # | 文章 | 来源 | 支撑什么 | 摘要位置 |
|---|---|---|---|---|
| S1 | 深入解析 Codex 智能体循环 | OpenAI官方(Bolin) | Run生命周期/工具循环/上下文管理/计划/权限 | codex-series.md §01 |
| S2 | Codex CLI Features | OpenAI官方 | 终端UI/实时review/inline approve/diff/截图输入 | s-level §S-02 |
| S3 | Claude Code Desktop Docs | Claude官方 | 桌面Agent/输入框旁模式/Plan/Auto/并行session | s-level §S-03 |
| S4 | Claude Code Permission Modes | Claude官方 | 先看方案/边做边确认/自动推进 模式设计 | s-level §S-04 |
| S5 | Cursor 3 官方博客 | Cursor官方 | 高抽象主界面/任务中心/local-cloud handoff/diff review | s-level §S-05 |
| S6 | Agent UX & Transparency | Max Gherman | Answer/Evidence/Trace分层/默认轻/可下钻 | ux-methodology §09 |
| S7 | CopilotLens 论文 | arXiv:2506.20062 | 透明解释层/不直接展示原始思考链/两级界面 | s-level §S-07 |
| S8 | Illuminating LLM Coding Agents | arXiv:2508.12555 | 树状执行轨迹/三层分析(代码/迭代/agent级) | s-level §S-08 |

## 二、A 级：补充分析，不照搬（5篇）

| # | 文章 | 来源 | 吸收什么 | 注意什么 | 摘要位置 |
|---|---|---|---|---|---|
| A1 | Codex Agent Loop Explained | Daniel Vaughan | 输入后发生什么/loop阶段/展示策略/长输出 | 非官方，拆解视角 | codex-series §02 |
| A2 | Inside the Codex Agent Loop | Daniel Vaughan | 重试隐藏/截断/缓存对展示影响 | 非官方 | codex-series §03 |
| A3 | Claude Code 架构深度剖析 | 稀土掘金 | 终端渲染/权限阻塞/流式/动作块 | 需和官方交叉验证 | claude-cursor §05 |
| A4 | Claude Code 动态工作流 while循环 | 腾讯云 | while loop代替状态机的Harness思路 | 偏架构观点≠UI最佳实践 | claude-cursor §07 |
| A5 | Agent时代界面为什么反着做 | 人人都是产品经理 | "大事清楚小事糊涂"UX表达 | 体验原则≠交互规格 | ux-methodology §08 |

## 三、方法论补充（4篇）

| # | 文章 | 来源 | 核心方法 | 摘要位置 |
|---|---|---|---|---|
| M1 | 三大AI编程Agent深度横评 | CSDN | 三者执行哲学/透明-高效光谱 | claude-cursor §04 |
| M2 | Claude Code vs Cursor | ClaudHQ | 提案-审核 vs 规划-执行-验证 | claude-cursor §06 |
| M3 | Smashing: 必要透明时刻 | Smashing Magazine | Decision Node Audit/Impact-Risk矩阵 | ux-methodology §10 |
| M4 | 透明度与可解释性:思考图谱 | CSDN | 三级透明/检索依据/思考图谱 | ux-methodology §11 |
