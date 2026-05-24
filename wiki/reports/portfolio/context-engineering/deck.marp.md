---
marp: true
theme: gaia
size: 16:9
paginate: true
backgroundColor: #FAFAFA
color: #1A1A1A
style: |
  section { font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", sans-serif; padding: 60px; }
  h1 { color: #0A6E6F; border-bottom: 2px solid #0A6E6F; padding-bottom: .3em; }
  h2 { color: #0A6E6F; }
  h3 { color: #0A6E6F; }
  table { font-size: 0.8em; }
  th { background: #E8F4F4; color: #0A6E6F; }
  blockquote { border-left: 4px solid #0A6E6F; color: #555; padding-left: 1em; }
  a { color: #0A6E6F; }
header: "Context Engineering — Coding Agent 横评"
footer: "zhouhao · 2026-05-24T09:03:20+00:00"
---

# Context Engineering — Coding Agent 横评

> From wiki facts to PM insights — 5 products

**作者:** zhouhao
**JD 关键词:** Context Engineering
**目标读者:** DeepSeek Agent Harness PM

---

# Context Engineering 路径比较：从 .cursor/rules 到 SKILL.md 体系

> 目标读者：DeepSeek Harness 团队 + 模型训练团队
> 作者视角：AI Agent PM
> 关键词：Context Engineering、Memory、Compaction、Skills

## 1. 什么是 Context Engineering

Context Engineering 是为 LLM Agent 系统设计「该让模型看到什么、什么时候看到、以什么形式看到」的工程实践，覆盖项目级规则、用户偏好、长期记忆与运行时压缩四层，目标是在窗口预算内保留任务相关信号、剔除噪声并支持长程任务。

## 2. 六种实现路径的全景图

把当前主流 Agent 产品的 Context 设计方法整理出来，可以归纳为六种实现路径。它们沿着「单文件 → 目录化 → 分层 → 协议化 → 能力组件化 → 云端/模型层」演进，对应不同的工程成熟度与团队边界。

| 路径 | 代表产品 | 关键载体 | 层数 (F3) | 核心思想 |
|---|---|---|---|---|
| A 单文件规则 | Cursor 早期 | `.cursorrules` | 1 | 一个文件解决所有项目偏好 |
| B 目录化规则 | Cursor 当前 | `.cursor/rules/*.mdc` | 2 | 按 glob 条件加载 |
| C 分层 Memory | Claude Code | `CLAUDE.md` 三层 | 3 | 每层独立、合并装载 |
| D 标准化协议 | Codex | `AGENTS.md` | 2 | 跨工具厂商可读的开放约定 |
| E 能力组件化 | Claude Code 高阶 | `.claude/agents/` + `.claude/skills/` | 3 | Context 即可插拔能力包 |
| F 云端/模型层 | Manus / Hermes | 后端 Agent state + 模型内蓄 | 1–2 | 不暴露文件，服务端/权重管理 |

## 3. 六种路径的解剖

### 3.1 路径 A：单文件规则（Cursor 早期 `.cursorrules`）

**代表产品**：Cursor 早期版本。
**文件结构**：仓库根目录一个无后缀文本文件，纯自然语言写规则。
**Memory 机制**：完全静态，作为 system prompt 前缀注入，无任何分层。
**Compaction 策略**：由模型窗口被动决定，规则文本本身不参与压缩。

证据：https://docs.cursor.com/context/rules-for-ai

**优点**：极低门槛，单仓库秒级落地。
**局限**：无法表达"这条规则只对测试文件生效"，规则一多就堵塞 Context。

### 3.2 路径 B：目录化规则（Cursor `.cursor/rules/`）

**代表产品**：Cursor 当前版本。
**文件结构**：`.cursor/rules/*.mdc`，每个文件携带 frontmatter（`description`、`globs`、`alwaysApply`），可分团队规则与个人规则。
**Memory 机制**：F3=2，按 glob 触发的"项目级 + 条件加载"。
**Compaction 策略**：未触发的规则不进 Prompt，本质上是"懒加载式压缩"，但触发后全文注入，无切片。

证据：https://docs.cursor.com/context/rules-for-ai

**优点**：第一次有了"条件 Context"概念，规则之间不再互相挤占预算。
**局限**：触发逻辑只能基于文件 glob，无法基于任务语义；Memory 与 Skill 边界仍模糊。

### 3.3 路径 C：分层 Memory（Claude Code `CLAUDE.md`）

**代表产品**：Claude Code。
**文件结构**：三层 `CLAUDE.md`：
1. 项目本地：`./CLAUDE.md`、`./CLAUDE.local.md`
2. 用户私有：`~/.claude/CLAUDE.md`
3. 引用拓展：`@path` 语法把任意 md 文件拉进当前层。

**Memory 机制**：F3=3，三层在会话启动合并装载，支持 `@import`。
**Compaction 策略**：分两段——`CLAUDE.md` 本体不动；运行时上下文超阈触发 auto-compact，将对话历史归纳为摘要、保留必要文件状态。

证据：https://docs.anthropic.com/en/docs/claude-code/memory

**优点**：把"项目知识、个人偏好、全局风格"分开，避免新人误改全局规则；三层都可见、可编辑。
**局限**：内容仍然全量静态注入，不会按任务语义剔除无关段落。

### 3.4 路径 D：标准化协议（Codex `AGENTS.md`）

**代表产品**：OpenAI Codex 与开源社区共推。
**文件结构**：项目根目录 `AGENTS.md`，被 Codex CLI 与多个兼容工具识别；Codex 另含会话级 memory store，F3=2。
**Memory 机制**：`AGENTS.md` 是"厂商中立的开发约定"，把 README 升级为机器可读规范。
**Compaction 策略**：会话级历史由 Codex 后端管理，类似 auto-compact；`AGENTS.md` 不参与压缩。

证据：https://platform.openai.com/docs/codex/agents、https://platform.openai.com/docs/codex/memory

**优点**：第一次出现"跨厂商"Context 标准，可被多个 IDE/CLI 同时使用。
**局限**：协议本身仍然薄，没有解决"规则按任务挑选"问题，多数项目只是把 README 改了名。

### 3.5 路径 E：能力组件化（`.claude/agents/` + `.claude/skills/`）

**代表产品**：Claude Code 高阶用法。
**文件结构**：
- `.claude/agents/*.md`：子代理定义，有独立 system prompt 与工具子集（如 typescript-reviewer、tdd-guide）。
- `.claude/skills/<name>/SKILL.md`：可召唤技能，frontmatter 携带 `description`，模型按相关度决定加载。

**Memory 机制**：F3=3 的最高形态——基础 Memory（`CLAUDE.md`）+ 能力包（Agents）+ 知识包（Skills），三者独立装填。
**Compaction 策略**：Skills 默认不在 Context 内，只在匹配时被 Skill 工具一次性读入，调用结束即释放。等于把"知识"做成"按需 RAG 文件"。

证据：https://docs.anthropic.com/en/docs/claude-code/memory

**优点**：把 Context 拆成"能力可插拔"组件，每个 Skill 都是可独立审计、可分享的小规则集，是当前最先进的工程形态。
**局限**：组件爆炸时如何让模型"选对 Skill"成为新挑战，`description` 工程化压力极大。

### 3.6 路径 F：云端/模型层（Manus、Hermes）

**代表产品**：
- **Manus**：云端通用 Agent，本地无配置文件，所有 Context 由后端 Agent runtime 管理；F3≈2（system prompt + 任务 memory）。
- **Hermes**：以 function-calling 为核心的模型家族，把工具调用约定训练进权重；F3=1。

**文件结构**：本地无 Context 文件。
**Memory 机制**：
- Manus：云端 Agent state，按 session 隔离，文件操作通过虚拟文件系统挂载。
- Hermes：Context 已"内蓄"到模型权重，运行时只需最少提示。

**Compaction 策略**：
- Manus：自研三件套——KV-cache 前缀重用、虚拟文件系统挂载、Tool Result 删减与回放。
- Hermes：主要靠模型自身窗口压缩 + 训练时短上下文偏好。

证据：https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus、https://github.com/NousResearch/hermes-function-calling

**优点**：用户零配置，云端可做激进压缩与 KV-cache 重用；Hermes 的"训练替代提示"思路在长期是更优解。
**局限**：可见性、可编辑性、可分享性最弱，不适合企业合规与高定制场景。

## 4. Memory 三轴评分矩阵

按"可见性、可编辑性、可分享性"三轴打 1–5 分（5 最好）：

| 路径 | 可见性 | 可编辑性 | 可分享性 | 总分 |
|---|---|---|---|---|
| A 单文件规则 | 5 | 5 | 4 | 14 |
| B 目录化规则 | 5 | 5 | 5 | 15 |
| C `CLAUDE.md` 分层 | 5 | 5 | 4 | 14 |
| D `AGENTS.md` 协议 | 5 | 5 | 5 | 15 |
| E Agents + Skills | 4 | 4 | 5 | 13 |
| F 云端/模型层 | 1 | 2 | 2 | 5 |

**轴解读**：
- **可见性**：用户能否直观看到"模型现在被注入了什么"。本地文件满分；云端黑盒最低。
- **可编辑性**：用户能否在不改后端的前提下调整 Context。Markdown 满分；模型权重几乎不可编辑。
- **可分享性**：能否在团队/社区复用。`AGENTS.md`、`.cursor/rules` 进 Git 仓库满分；云端 session 私有最低。

**关键洞察**：
1. 路径 B 与 D 总分并列（15），但适配场景不同——B 偏 IDE，D 偏 CLI / CI。DeepSeek Harness 应同时兼容这两条。
2. 路径 E（Skills）可见性下降一档，但带来"按需加载"——这是目前唯一能从根本上解决长上下文困境的机制。
3. 路径 F 三轴都低，但成本最低，是 ToC 通用 Agent 的合理选择；对 DeepSeek 的开发者工具产品不适配。

## 5. DeepSeek Context 系统设计的三条建议

### 5.1 建议一：三层分层 + `AGENTS.md` 协议双轨

借鉴 Claude Code 的三层职责拆分，但文件名用社区标准 `AGENTS.md` 而非自造命名：
- `./AGENTS.md`：项目级，进 Git。
- `./AGENTS.local.md`：项目内个人覆写，进 `.gitignore`。
- `~/.deepseek/AGENTS.md`：用户全局，跨项目生效。

这样同时拿到了路径 C 的"职责清晰"和路径 D 的"跨工具兼容"，是当前最低风险路线。参考：https://platform.openai.com/docs/codex/agents、https://docs.anthropic.com/en/docs/claude-code/memory

### 5.2 建议二：把 Skills 作为下一代核心，先锁协议，再建仓库

不要在 v1 就堆 50 个 Skill，应先把 `SKILL.md` 的 frontmatter 协议（`name`、`description`、触发条件、参数约定）锁死。三阶段：
- **阶段一**：发布 SKILL spec，提供 5–10 个高频官方 Skill（debugging、tdd、code-review、security-review 等），与 Claude Code 命名兼容以降低迁移成本。
- **阶段二**：开放第三方 Skill marketplace，模型按 `description` 召唤。
- **阶段三**：训练阶段把"如何挑选 Skill"作为强化学习任务，让模型获得 Skill 选取直觉，把路径 F（Hermes 内蓄）和路径 E（Claude Code 组件化）合一。

这是 DeepSeek 最有可能"超车 Claude Code"的差异化点：Claude Code 的 Skill 选取仍是 description 文本匹配，而 DeepSeek 可以用模型训练把它做成原生能力。

### 5.3 建议三：Compaction 做成"分级 + 可恢复"，借鉴 Manus 虚拟文件系统

Compaction 是 Harness 团队最容易低估的工作。Manus 的实践证明，简单"截断 + 摘要"在长任务里会丢关键状态。建议三级：
- **L1 实时 KV-cache 重用**：高频前缀（system prompt + `AGENTS.md`）做缓存，与 DeepSeek-V3 的 context cache 能力直接打通。
- **L2 文件化外存**：工具调用结果（长代码、长文档）落到虚拟文件系统，Prompt 仅保留路径与摘要，模型用"读文件"工具按需取回，这是 Manus 的核心打法。参考：https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- **L3 会话级摘要**：超过窗口才摘要，并保留"原始历史路径"以备回滚，对应 Claude Code 已有的 auto-compact 形态。

模型训练侧需要配合两件事：
1. 训练数据增加"读文件再回答"的轨迹，让模型习惯把 Context 当作可寻址外存，而不是"必须全读"。
2. 增加"自我压缩"轨迹，让模型主动写"我已知道 X，请将其从 Context 移除"这类指令。

## 结语

Context Engineering 的演进路径已经从「`.cursorrules` 的一行说明」走到「Skills 仓库 + 虚拟文件系统 + 模型内蓄」。对 DeepSeek Harness 而言，路径 C + D 的"可见 Context"（`AGENTS.md` 三层分层）是 v1 的合理目标；真正的护城河在路径 E + F 的混合——把 Skills 做成开放协议，把 Compaction 做成模型训练的一等任务。这两件事做到位，DeepSeek 不再是"另一个支持 `AGENTS.md` 的工具"，而是"第一个 Context 系统由模型本身设计的工具"。


---

# 致谢

数据来源: 26 个 Agent 产品的 wiki/compiled (基于 Karpathy LLM Wiki 模式 +
nashsu/llm_wiki + sdyckjq-lab/llm-wiki-skill 借鉴整合)

代码与方法论开源: `github.com/<user>/ai-agent-competitive-analysis`

—— zhouhao, 2026-05-24T09:03:20+00:00