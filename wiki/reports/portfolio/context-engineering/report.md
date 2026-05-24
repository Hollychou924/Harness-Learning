# Context Engineering — Coding Agent 横评

> **作者:** zhouhao · **JD 关键词:** Context Engineering · **目标读者:** DeepSeek Agent Harness PM
>
> _Generated 2026-05-24T08:35:43+00:00 from `wiki/compiled/` (DeepSeek Agent Harness PM 应聘材料)_

---

# 项目上下文系统比较：6 种 Context Engineering 实现路径

## 1. Context Engineering 是什么

Context Engineering 指为 AI agent 设计、组织、分发和压缩"工作记忆"的工程学科。它决定了 agent 在每次推理时能看到什么、记住什么、忘掉什么——本质上是把项目知识、用户偏好、工具能力、过往决策编码为可检索的上下文资产，并在有限的 token 窗口内实现最优投放。

## 2. 六种实现路径的分类

经过对主流 coding agent 产品的拆解，Context Engineering 在工业界形成了六条相对独立的实现路径。它们并非互斥，但每条路径有不同的设计哲学、文件载体和生命周期管理策略：

| 路径 | 命名 | 核心载体 | 代表产品 |
|------|------|---------|---------|
| P1 | 根目录单文件约定 | 单个 markdown | Codex / Cursor (legacy) |
| P2 | 层级化规则目录 | rules 子目录 | Cursor / Claude Code |
| P3 | 子 Agent 定义 | agents 目录 | Claude Code |
| P4 | Skill Pack 体系 | skills 目录 | Claude Code |
| P5 | 持久化 Memory 系统 | memory/ 带 frontmatter | Claude Code (auto memory) |
| P6 | 动态 Compaction | session summary | 全部主流产品 |

下文逐条拆解。

## 3. 各路径详解

### 3.1 路径 P1：根目录单文件约定

**代表产品**：OpenAI Codex (AGENTS.md)、早期 Cursor (.cursorrules)、Claude Code 的 CLAUDE.md。

**文件结构**：项目根目录放置一个纯 markdown 文件，agent 启动时自动加载到系统提示。

```
project-root/
├── AGENTS.md           # Codex 约定
├── .cursorrules        # Cursor legacy
└── CLAUDE.md           # Claude Code 主入口
```

**Memory 机制**：完全由人类手写，agent 只读不写。文件内容直接拼接到每轮对话的 system prompt 前缀，是真正意义上的"持续上下文"——但代价是占用每一次 API 调用的输入 token。

**Compaction 策略**：无内置 compaction。当文件膨胀到几千行时，唯一的优化手段是人工拆分或外链到子文档。Claude Code 文档明确建议 CLAUDE.md 控制在 200 行以内（[evidence](https://docs.anthropic.com/en/docs/claude-code/memory)）。

**优劣**：上手成本最低，约定优于配置，所有团队成员一目了然；但缺乏粒度、无法按任务激活，不适合大型多模块仓库。

### 3.2 路径 P2：层级化规则目录

**代表产品**：Cursor (.cursor/rules/)、Claude Code (.claude/ 目录)。

**文件结构**：

```
.cursor/
└── rules/
    ├── frontend.md      # 仅在前端文件激活
    ├── api.md           # 仅在后端 API 激活
    └── always.md        # 全局激活
```

每条规则带 frontmatter 声明 `globs`、`alwaysApply` 等元数据。Cursor 使用 MDC (Markdown Components) 格式（[evidence](https://docs.cursor.com/context/rules-for-ai)），Claude Code 通过文件层级实现类似效果。

**Memory 机制**：规则按文件路径或语义标签条件激活，不再"all-or-nothing"。Cursor 支持四类规则：Always、Auto Attached（按 glob）、Agent Requested（agent 自主调用）、Manual。

**Compaction 策略**：通过激活条件天然实现按需注入，从源头压缩上下文。一个 50KB 的规则库，单次实际进入 prompt 的可能只有 5KB。

**优劣**：精细化程度高，但维护成本上升。条件激活逻辑写得不好会导致"规则不生效"的 debug 噩梦。

### 3.3 路径 P3：子 Agent 定义

**代表产品**：Claude Code 的 `.claude/agents/` 目录。

**文件结构**：每个 agent 是一个独立 markdown 文件，带 frontmatter 描述其角色、可用工具、模型选择：

```
.claude/agents/
├── code-reviewer.md
├── tdd-guide.md
└── security-reviewer.md
```

**Memory 机制**：子 agent 拥有独立的上下文窗口，主 agent 通过 Task 工具委派任务。子 agent 完成后，只有最终摘要返回主上下文——这是一种**计算性 compaction**，把"过程上下文"留在子 agent 内部，"结果上下文"上交给主流程。

**Compaction 策略**：天然按角色隔离。一个 50 轮对话的 security review 可能在子 agent 内部消耗 80K token，但只给主 agent 返回 500 字摘要。

**优劣**：对复杂任务的 token 经济性极佳，但增加了系统设计复杂度——agent 之间的协议、错误传播、结果格式都需要显式约定。

### 3.4 路径 P4：Skill Pack 体系

**代表产品**：Claude Code 的 superpowers/skills 体系（[evidence](https://docs.anthropic.com/en/docs/claude-code/memory)）。

**文件结构**：

```
.claude/skills/
├── tdd-workflow/
│   ├── SKILL.md         # 入口
│   ├── references/
│   └── examples/
└── debugging/
    └── SKILL.md
```

每个 skill 是一个目录，SKILL.md 是入口文件，frontmatter 声明 `name` 和 `description`。Agent 在合适时机调用 Skill 工具，把 SKILL.md 内容**惰性加载**到当前上下文。

**Memory 机制**：skill 不进入默认 system prompt，而是在 agent "需要"时按名加载。这是把"被动 context injection"升级为"主动 capability calling"。

**Compaction 策略**：与子 agent 类似的惰性加载模型。1000 个 skills 的库可以共存，单次任务可能只激活 1-2 个。

**优劣**：可发布、可共享、可版本化，类似 npm 包。但 agent 的"主动调用判断"依赖 description 写得好不好，调用率波动大。

### 3.5 路径 P5：持久化 Memory 系统

**代表产品**：Claude Code 的 auto memory（用户级 `~/.claude/projects/<project>/memory/`）。

**文件结构**：

```
memory/
├── MEMORY.md                # 索引文件，永远入 prompt
├── user_role.md             # 用户身份
├── feedback_testing.md      # 用户反馈
├── project_q1_goals.md      # 项目状态
└── reference_grafana.md     # 外部资源
```

每个 memory 是独立文件，frontmatter 声明 `name`、`description`、`metadata.type`（user / feedback / project / reference 四类）。

**Memory 机制**：MEMORY.md 是常驻索引，单个 memory 在 description 命中时被加载。Agent 在对话中**主动写入**新 memory（用户身份、反馈、项目状态），实现跨会话学习。

**Compaction 策略**：通过分类 + 索引实现冷热分层。MEMORY.md 控制在 200 行以内（系统硬截断），单个 memory 文件按需加载。

**优劣**：是六种路径中唯一支持 agent 自主写入的，跨会话连续性最强。但记忆衰减、冲突解决、记忆"幻觉"是公开难题——一条三个月前的 memory 可能引用早已不存在的文件路径。

### 3.6 路径 P6：动态 Compaction

**代表产品**：所有主流 coding agent。

**文件结构**：无独立文件，是运行时机制。

**Memory 机制**：当对话接近上下文窗口上限，agent harness 自动触发摘要：早期消息被压缩为结构化 summary，原始消息释放。Claude Code 在 session summary 中保留任务列表、关键决策、未完成事项。

**Compaction 策略**：
- **Auto compaction**：上下文超过阈值（通常 70-80%）触发；
- **Manual compaction**：用户显式 `/compact`；
- **Session boundary compaction**：会话结束时生成 next session 摘要。

**优劣**：是上下文窗口的"最后一道防线"，但摘要本身存在信息损失风险。被压缩掉的"为什么这么做"经常比"做了什么"更难恢复。

## 4. Memory 三轴评分矩阵

将上述六条路径在三个维度上打分（1-5 分）：

| 路径 | 可见性 | 可编辑性 | 可分享性 | 综合 |
|------|--------|---------|---------|------|
| P1 单文件 | 5 | 5 | 5 | 15 |
| P2 规则目录 | 4 | 4 | 5 | 13 |
| P3 子 Agent | 4 | 4 | 5 | 13 |
| P4 Skill | 4 | 4 | 5 | 13 |
| P5 持久 Memory | 3 | 4 | 2 | 9 |
| P6 动态 Compaction | 1 | 1 | 1 | 3 |

**三轴定义**：
- **可见性**：开发者能否直接查看 agent 当前持有的 context（路径 P1 最高，因为 CLAUDE.md 就是源文件；P6 最低，因为 compaction summary 通常不展示）；
- **可编辑性**：开发者能否手动修改 context 内容（P1-P4 都是文本文件可直接编辑；P5 介于中间，因为 agent 也会写入；P6 不可编辑）；
- **可分享性**：context 能否随仓库 git commit 分发给团队（P1-P4 直接进 repo，P5 是用户级私密目录不进 repo，P6 是运行时状态）。

**关键洞察**：可见性、可编辑性、可分享性三者**正相关**——文件越显式，越容易被人类理解、修改、协作。这解释了为什么 .cursorrules 和 CLAUDE.md 这类"原始"约定能广泛传播：它们牺牲了精细化能力，换来了零理解成本。

## 5. DeepSeek 应该如何设计 Context 系统

基于以上拆解，给 DeepSeek Harness 团队和模型训练团队三条具体建议：

### 建议 1：以 P1+P2 为底盘，而非从 P5 起步

不要直接做 auto memory（P5）。auto memory 是 Claude Code 跑了一年、用户对 agent 已经形成稳定心智之后才上线的高阶功能。直接做 P5 会面临三个难题：用户看不到 agent 在记什么（可见性差）、记错了不知道改哪里（可编辑性差）、记忆的有效衰减期不明确。

**正确顺序**：先把 `DEEPSEEK.md`（根目录单文件，路径 P1）和 `.deepseek/rules/`（条件激活规则，路径 P2）跑通，让用户先建立"我可以通过编辑这些文件影响 agent 行为"的心智。然后在 6 个月后再迭代 P5 持久化 memory。

### 建议 2：用 Skill Pack（P4）做能力市场，不要做插件

Cursor 走的是"自定义 commands"路线（命令式），Claude Code 走的是 Skill Pack（声明式 + 惰性加载）。两者本质区别：Skill 由 agent 自己判断何时激活，命令由用户显式触发。

DeepSeek 应该选 Skill Pack 路线。原因：(1) DeepSeek 的强项是模型推理能力，把"激活判断"交给模型本身是发挥优势；(2) Skill Pack 是可分享、可版本化的资产，能形成生态；(3) 与训练团队协同——可以专门训练模型在 Skill description 上的 retrieval 能力，作为 evaluation 指标。

具体落地：在 v1 发布时预置 10-20 个官方 Skill（debugging、tdd、code-review、refactor），并开放 `~/.deepseek/skills/` 用户目录。

### 建议 3：把 Compaction（P6）做成显式资产，而非黑盒

P6 在所有产品里都是黑盒——压缩后的内容不展示、不可编辑、不可追溯。但这恰恰是 DeepSeek 可以差异化的地方：把 session summary 落盘为 `.deepseek/sessions/<id>/summary.md`，并在下次进入同一项目时由用户选择是否 resume。

这做了三件事：(1) 让"对话历史"成为团队资产，而不是某个工程师电脑里的临时状态；(2) 给训练团队提供干净的 trajectory 数据集（用户已经标注哪些 session 值得保留）；(3) 跨会话连续性不再依赖 P5 的 memory 推断，而是用户显式选择，可见性大幅提升。

具体设计：每个 session 结束时生成结构化摘要（任务、决策、未完成事项、引用文件），Compaction 不再是"agent 偷偷做的事"，而是 agent 和人协作生成的工程产出物。

---

**总结**：Context Engineering 的本质不是"如何塞更多东西进窗口"，而是"如何让上下文在团队、时间、任务三个维度上可治理"。Cursor 和 Claude Code 提供了两套各有侧重的范式，DeepSeek 的机会在于把 P4（Skill）和 P6（Compaction）做得比所有竞品都更显式、更资产化、更可训练——这恰好对齐了 DeepSeek 团队"模型 × 工程"双轮驱动的禀赋。


---

## 致谢与方法论

数据来源: 26 个 Agent 产品的 wiki/compiled 数据集，基于 Karpathy LLM Wiki 模式 +
nashsu/llm_wiki + sdyckjq-lab/llm-wiki-skill 三套开源借鉴整合。

代码与方法论开源: `github.com/<user>/ai-agent-competitive-analysis`

—— zhouhao, 2026-05-24T08:35:43+00:00