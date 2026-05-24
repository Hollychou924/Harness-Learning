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
header: "Harness Engineering — Coding Agent 横评"
footer: "zhouhao · 2026-05-24T08:33:19+00:00"
---

# Harness Engineering — Coding Agent 横评

> From wiki facts to PM insights — 3 products

**作者:** zhouhao
**JD 关键词:** Harness Engineering
**目标读者:** DeepSeek Agent Harness PM

---

# Harness 设计模式比较：从 Claude Code、Cursor、Codex 看 AI Agent Harness 的架构选择

## 执行摘要

基于对 Claude Code、Cursor、Codex 三家头部产品的能力矩阵抽取（E1 Shell 访问、E4 扩展机制、E5 Skill 层级、E6 持久化模式），本文提炼出三个核心论点：

**论点一：Harness 的本质是"权限边界 + 工具回合预算 + 上下文持久化"的三角约束。** 三家头部产品在 Shell 访问（E1）和 MCP 扩展（E4）上已经收敛——全部采用"完整 Shell + 权限模式"和"原生 + Marketplace"双层扩展。差异化战场已经从"能不能调工具"转移到"能调多少回合、能在多深的上下文里保留意图"。

**论点二：Skill 层级数（E5）和持久化模式（E6）是当前 Harness 设计的两个未稳定维度。** Claude Code 用 3 层 Skill（using-superpowers / 领域 Skill / 子 Skill）构建认知层次，Cursor 和 Codex 停留在 2 层（rules + subskills）。在持久化上，三家分别选择了 Checkpoint 双模（Claude Code）、单一 IDE 内会话（Cursor）、云端断点续跑（Codex）三条不同路径。

**论点三：DeepSeek Harness 团队若要在 2026 下半年进入这个市场，最务实的切入点不是再造一个 Shell-First Harness，而是从"长任务持久化 + Skill 编排"这两个仍未收敛的维度切入差异化。** 后文给出选型建议。

## 一、Harness 设计模式分类

下文从执行边界、扩展性、上下文持久化三个维度，归纳出 6 种主流 Harness 设计模式。

### 模式 1：Shell-First Permission-Gated Harness

**代表产品**：Claude Code、Cursor、Codex

**核心机制**：Agent 直接在用户主机或受控容器中执行 shell 命令，权限控制通过"工具白名单 + 用户交互式审批 + 危险操作拦截"三层机制完成。Claude Code 通过 settings.json 中的 `allowedTools` 字段定义自动放行的命令前缀，未列入的命令在 PreToolUse 钩子里中断并向用户索取确认（参见 https://docs.anthropic.com/en/docs/claude-code/security#permissions）。Cursor 在终端面板里走类似流程，命令执行前显式标注（https://docs.cursor.com/agent/terminal）。Codex 的 sandbox 模式在 macOS 上默认走 seatbelt，在 Linux 上走 Landlock + seccomp（https://platform.openai.com/docs/codex/security）。

**适用场景**：需要让 Agent 触达完整开发工具链（git、构建、测试、容器、部署）的"Coding Agent"产品。该模式的护城河不在于"能跑 shell"，而在于权限模型的细粒度——是否能让用户在不打断流的前提下完成 review。

**局限**：(1) 跨主机协作不友好——Agent 的执行环境是用户的本地机器，多人协作时状态难以共享；(2) 长任务被本地会话寿命所限制——关掉终端，Agent 就死。

### 模式 2：MCP-Centric Extension Harness

**代表产品**：Claude Code、Cursor、Codex（三家全部采用）

**核心机制**：Harness 内置一组"原生工具"（Read、Edit、Bash、Grep 等），同时通过 MCP（Model Context Protocol）协议暴露给第三方扩展。Claude Code 的 MCP 配置在 `~/.claude.json` 或 `.mcp.json`（https://docs.anthropic.com/en/docs/claude-code/mcp），Cursor 的 MCP 在 settings 里的 mcp.json（https://docs.cursor.com/context/mcp），Codex 的 MCP 在 `~/.codex/config.toml`（https://platform.openai.com/docs/codex/mcp）。三家都已经开始建设 Marketplace——用户不再手动写 JSON，而是从应用商店一键挂载 server。

**适用场景**：希望生态化、外部开发者驱动的 Harness。该模式的胜负手在于"Marketplace 的初始供给"——若 DeepSeek 不能在 6 个月内吸引 50+ 优质 MCP server 入驻，原生 + Marketplace 的双层架构就只剩下"原生"一层在工作。

**局限**：(1) MCP 协议本身的工具调用回合数有上限，目前公开数据是 Claude Code 单会话约 100-200 回合后会触发自动压缩；(2) Marketplace 的安全审核成本——任何未审核的 MCP server 都可能成为权限模型的旁路。

### 模式 3：Hierarchical Skill Composition Harness

**代表产品**：Claude Code（E5=3 层）

**核心机制**：Skill 不是单层 prompt，而是分层认知结构。Claude Code 的 Skill 系统有三层：(1) 元 Skill（如 `using-superpowers`），定义"如何使用 Skill"本身；(2) 领域 Skill（如 `python-testing`、`golang-patterns`），定义某个具体领域的工作流；(3) 任务 Skill（如 `prp-prd`、`gan-build`），定义具体可复用的命令模板。三层之间通过 frontmatter 的 description 触发自动激活（https://docs.anthropic.com/en/docs/claude-code/skills）。

Cursor 的 Rules for AI（https://docs.cursor.com/context/rules-for-ai）和 Codex 的 AGENTS.md（https://platform.openai.com/docs/codex/agents）只有 2 层——一层全局规则，一层任务级 prompt 拼接，缺少"元 Skill 层"。

**适用场景**：面向资深工程师的 Coding Agent。元 Skill 层让用户可以"教 Agent 如何学习新 Skill"，这是把 Harness 从"工具集合"升级为"可演化系统"的关键。

**局限**：(1) 学习曲线陡——三层 Skill 对新用户是认知负担；(2) Skill 之间的优先级冲突需要显式的优先级规则，否则会出现"两个 Skill 互相覆盖"的状态空间爆炸；(3) Skill 内容默认全部加载到上下文，超过 30 个 Skill 后 prompt 头部会被显著占用。

### 模式 4：Checkpoint-Based Local Persistence Harness

**代表产品**：Claude Code（E6=2 模式）

**核心机制**：Harness 在每个工具调用前后自动创建检查点，用户可以通过 Esc-Esc 回到任意历史状态。Claude Code 的 checkpoint 实现包含两种模式：(1) 文件系统快照模式（基于 git stash 或文件 diff）；(2) 会话状态模式（保存 message history + tool result 树）。两种模式可独立或组合使用（https://docs.anthropic.com/en/docs/claude-code/checkpoints）。

**适用场景**：需要让用户对 Agent 的"激进操作"有撤销能力的本地 Coding 场景。该模式直接对标人类工程师的 git 工作流，是"信任 Agent 探索"和"承担探索失败成本"之间的桥梁。

**局限**：(1) 文件系统快照在大仓库里成本高（git status 慢、磁盘占用大）；(2) 跨会话的 checkpoint 语义不清——用户重启 Claude Code 后，旧 checkpoint 是否仍然可用，需要显式策略；(3) 与外部状态（数据库、远程 API）的交互无法回滚。

### 模式 5：Cloud-Native Long-Running Task Harness

**代表产品**：Codex（E6=3 模式）

**核心机制**：Codex Cloud（https://platform.openai.com/docs/codex/cloud）将 Agent 执行从本地 IDE 解耦到云端容器，长任务可以在用户离线后继续运行，完成后通过 GitHub PR 或邮件通知。持久化层包含三块：(1) 容器快照——任务暂停时保存完整文件系统；(2) 会话日志——所有 tool call + observation 的事件流；(3) 任务 DAG——多个子任务的依赖关系。

**适用场景**：(1) 跨小时甚至跨天的重构任务；(2) 需要并行执行多个独立子任务的"批量 PR"场景；(3) 希望 Agent 在 CI 环境（而非用户笔记本）里跑测试套件的工作流。

**局限**：(1) 云端执行天然有冷启动延迟（容器拉起 + 仓库克隆通常 30s-2min）；(2) 与本地 IDE 的交互体验割裂——用户不能在云端任务"半路"接管；(3) 安全模型重——必须假设容器内任何代码都不可信，需要严格的网络隔离和密钥隔离。

### 模式 6：IDE-Embedded Continuous Agent Harness

**代表产品**：Cursor（E6=1 模式）

**核心机制**：Agent 与编辑器深度集成，所有上下文（打开的文件、光标位置、最近编辑、终端 output）自动喂给 Agent，无需显式 attach。Cursor 的 Agent 概览页面（https://docs.cursor.com/agent/overview）显示其持久化策略简单——单一会话历史 + 编辑器状态自动捕获，没有 checkpoint，没有云端容器。

**适用场景**：偏"pair programming"的交互式开发，用户和 Agent 持续在同一窗口共事，每个 turn 都有人类 review。

**局限**：(1) 长任务能力弱——会话超过几十个回合后上下文压缩会损失早期意图；(2) 跨项目协作不友好——Agent 状态绑定在单个 IDE workspace；(3) 没有显式 checkpoint，激进操作的撤销依赖 IDE 自身的 undo 栈。

## 二、维度对比矩阵

| 维度 | Claude Code | Cursor | Codex |
|---|---|---|---|
| Shell 访问（E1） | 完整 + 权限模式 | 完整 + 权限模式 | 完整 + 权限模式 |
| 扩展机制（E4） | 原生 + Marketplace | 原生 + Marketplace | 原生 + Marketplace |
| Skill 层级数（E5） | **3** | 2 | 2 |
| 持久化模式数（E6） | 2（checkpoint 双模） | 1（单一会话） | **3**（云端容器） |

E1 和 E4 已经在三家之间完全收敛，差异化已不在这里。E5 和 E6 仍处于"竞争性探索"阶段，是 DeepSeek 入场后可争夺的设计空间。

## 三、DeepSeek Harness 应该选择哪种模式

基于上文 6 种模式和 JD 信号（DeepSeek 强工程基础设施、有 V3/R1 等长上下文模型、目标客户偏研究和重度开发），给出三条选型建议：

**建议一：在执行层（E1、E4）直接复用 Shell-First + MCP-Centric 双轨。** 这两个维度已经收敛为行业标准，自创权限模型或扩展协议在 2026 年没有 ROI。MCP 已经被 Anthropic、OpenAI、Cursor 三家事实上确认为协议层，DeepSeek 应当 day one 兼容，否则将切断与 50+ 现存 MCP server 的连接。

**建议二：在 Skill 层级（E5）跟进 3 层结构，但用 DeepSeek-R1 做 Skill 自动检索。** Claude Code 的 3 层 Skill 在 50 个以上时会出现 prompt 膨胀，根因是"description 字段被全量塞进系统 prompt"。DeepSeek 可以在第一层（元 Skill）和第二层（领域 Skill）之间插入一个 R1 驱动的语义路由——根据用户当前 query 在 Skill 库里做一次轻量 retrieval，仅注入 top-k 相关 Skill 的 description。这把 Skill 系统的 scaling ceiling 从 30 个抬到 300+，是直接对标 Claude Code 的差异化点。

**建议三：在持久化（E6）选 Cloud-Native + Local Checkpoint 双轨，明确放弃 IDE-Embedded Only 路线。** Codex 的云端模式证明了长任务有真实需求，Cursor 的 IDE-Only 模式正在该维度上失分。DeepSeek 若想在企业市场（CI 集成、批量重构、夜间任务）卡位，必须 day one 提供云端容器，同时保留本地 checkpoint 给桌面用户。这条路线的工程成本高于 Cursor 路线，但护城河也更深。

## 四、未来 12 个月的 3 个开放问题

**问题一：Tool 回合数的硬上限会被突破到什么级别？** 当前 Claude Code 实测在 100-200 回合附近触发自动压缩，Codex Cloud 因为是云端长会话可以做到 500+ 但要付出 prompt cache 失效的代价。如果 DeepSeek-R1 的长上下文+稀疏注意力可以把单会话回合数推到 1000+ 而不显著降质，这将彻底改写"何时该启动新会话"的产品规则。

**问题二：Subagent 系统应该是"独立模型实例"还是"共享上下文的角色切换"？** Claude Code 的 Task tool 走的是独立实例路线（每个 subagent 有干净 context），优点是不污染主上下文，缺点是 subagent 之间无法直接沟通、必须通过主 agent 中转。Cursor 和 Codex 目前没有显式 subagent 概念。这个设计决策直接决定了多 Agent 协作模式（DAG vs 树 vs 平面对话）的可行性。

**问题三：Skill / Hook 的安全模型如何向企业级演进？** 当前三家 Harness 的 Skill 都是"全文件读入 prompt"，Hook 是"任意 shell 命令"。在企业部署里，这两条都需要：(1) Skill 签名机制——确保第三方 Skill 没有 prompt injection；(2) Hook 沙箱——确保 Hook 命令在受限环境运行。这部分目前是行业空白，谁先做谁定义协议。

---

总结：Harness 已从"能不能跑工具"进入"如何编排长任务、如何持久化复杂状态、如何让 Skill 自演化"的下半场。DeepSeek Harness 团队若要在 2026 年 Q4 进入市场，应该把工程力量集中在 E5（Skill 层级 + 自动检索）和 E6（云端容器 + 本地 checkpoint）两个仍未收敛的维度，避免在 E1/E4 上重复造轮子。


---

# 致谢

数据来源: 26 个 Agent 产品的 wiki/compiled (基于 Karpathy LLM Wiki 模式 +
nashsu/llm_wiki + sdyckjq-lab/llm-wiki-skill 借鉴整合)

代码与方法论开源: `github.com/<user>/ai-agent-competitive-analysis`

—— zhouhao, 2026-05-24T08:33:19+00:00