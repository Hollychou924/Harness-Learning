---
id: claude-code
type: entity
status: active
updated: 2026-05-25
sources:
  - wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md
  - wiki/raw/official-posts/claude/INDEX.md
  - wiki/raw/official-posts/claude/2026-04-07-how-and-when-to-use-subagents-in-claude-code.md
  - wiki/raw/official-posts/claude/2026-04-30-lessons-from-building-claude-code-prompt-caching-is-everything.md
  - wiki/raw/official-posts/claude/2026-03-24-auto-mode-for-claude-code.md
  - wiki/raw/official-posts/claude/2026-03-09-bringing-code-review-to-claude-code.md
  - wiki/raw/official-posts/claude/2026-04-22-building-agents-that-reach-production-systems-with-mcp.md
  - wiki/compiled/claude-code/_provenance.json
owners: ["zhouhao"]
when_to_load: "讨论 Claude Code、编码 Agent、权限、沙盒、Hook、子 Agent、工程任务执行时加载"
---

# Claude Code

> 一句话: Claude Code 是以软件工程任务为中心的 Agent 产品,核心不是“能写代码”,而是把写代码放进可授权、可审计、可回滚、可复核的工程流程。

## 1. 是什么

Claude Code 在当前知识库里有三类证据:

- `compiled/claude-code` 的维度数据。
- 中文社区对其 Prompt / Context / Harness 的拆解文章。
- 29 篇 Claude / Anthropic 官方文章,覆盖 Subagents、Auto Mode、Code Review、Prompt Caching、MCP、Managed Agents、Computer / Browser Use、1M Context 等。

## 2. 原有社区拆解中的关键机制

| 机制 | 说明 | 来源 |
|---|---|---|
| 静态系统规则 | 定义工程任务行为、安全边界、工具使用和输出风格 | `wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md` |
| 动态环境注入 | 注入当前目录、git 状态、语言偏好、MCP 指令、记忆和临时目录 | `wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md` |
| 自动记忆和压缩 | 通过记忆和多层压缩支撑长会话 | `wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md` |
| 权限引擎 | 工具执行受权限模式约束,高风险操作需要用户批准 | `wiki/compiled/claude-code/_provenance.json` |
| 子 Agent / Hook | 用子 Agent 分担任务,用 Hook 把团队流程接进执行链路 | `wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md` |

## 3. 官方文章补强

| 机制 | 官方材料带来的新证据 | 产品含义 | 来源 |
|---|---|---|---|
| Subagents | 子 Agent 拥有独立上下文窗口,适合研究型任务、并行任务、独立复核、提交前验证和流水线阶段 | Claude Code 的子 Agent 不是“多开几个聊天”,而是隔离上下文、压低主会话污染的执行单元 | [How and when to use subagents in Claude Code](../raw/official-posts/claude/2026-04-07-how-and-when-to-use-subagents-in-claude-code.md) |
| 多 Agent 取舍 | 官方明确说多 Agent 只有在上下文污染、可并行、专业化能提升工具选择时才值得; 多 Agent 往往会消耗 3-10 倍 token | 多 Agent 是高成本能力,不能把“多角色分工”当默认答案 | [Building multi-agent systems](../raw/official-posts/claude/2026-01-23-building-multi-agent-systems-when-and-how-to-use-them.md) |
| Auto Mode | Auto Mode 把更多执行交给 Claude Code,但仍需要围绕权限、风险和用户确认设计边界 | “更自动”必须和权限策略一起讲,否则会变成失控风险 | [Auto mode for Claude Code](../raw/official-posts/claude/2026-03-24-auto-mode-for-claude-code.md) |
| Code Review | Claude Code 把自动化预览、代码审查、合并做成桌面工作流 | 代码审查是 Agent 最容易形成闭环的场景: 有 diff、有评论、有是否合并的反馈 | [Bringing Code Review to Claude Code](../raw/official-posts/claude/2026-03-09-bringing-code-review-to-claude-code.md), [Preview / review / merge](../raw/official-posts/claude/2026-02-20-bringing-automated-preview-review-and-merge-to-claude-code-on-desktop.md) |
| Prompt caching | Claude Code 官方称其整个 Harness 围绕 prompt caching 组织; 静态 system prompt、工具、CLAUDE.md、会话上下文按稳定性排序 | 长任务 Agent 的成本、延迟和配额,不是后端小优化,而是产品可用性的基础 | [Prompt caching is everything](../raw/official-posts/claude/2026-04-30-lessons-from-building-claude-code-prompt-caching-is-everything.md) |
| 1M context 与会话管理 | 官方把 session management、长上下文和子 Agent 放在同一套实践里讲 | 大上下文不是无脑塞材料,仍然要管理会话、隔离任务和压缩历史 | [Session management and 1M context](../raw/official-posts/claude/2026-04-15-using-claude-code-session-management-and-1m-context.md) |
| MCP 到生产系统 | 官方强调 MCP 让 Agent 触达生产系统时,服务器设计、权限、审计、错误处理要一起考虑 | MCP 不是“接工具”这么简单,而是生产系统边界治理 | [Building agents that reach production systems with MCP](../raw/official-posts/claude/2026-04-22-building-agents-that-reach-production-systems-with-mcp.md) |
| Managed Agents memory | 托管 Agent 的 memory 以文件系统形式暴露,可导出、可审计、可回滚 | 记忆系统的产品关键不是“记住”,而是“谁写入、能不能查、能不能撤回” | [Built-in memory for Claude Managed Agents](../raw/official-posts/claude/2026-04-23-built-in-memory-for-claude-managed-agents.md) |
| Computer / Browser Use | 官方把计算机操作、浏览器操作、截图上下文、缓存断点、批量工具和提示注入防护放在同一篇实践里讲 | 真正生产化的 Agent 不只是代码工具,还要能安全操作真实界面 | [Best practices for computer and browser use with Claude](../raw/official-posts/claude/2026-05-13-best-practices-for-computer-and-browser-use-with-claude.md) |

## 4. 产品判断

- Claude Code 的范式是“工程任务执行平台”,而不是纯编辑器补全。
- 它把工程师日常约束直接写进系统规则,比如先读代码、少做无关改动、失败后诊断、安全优先。
- 官方文章进一步说明,Claude Code 的关键不是单个能力点,而是把子 Agent、权限、缓存、MCP、代码审查、会话管理组合成可持续运行的工程系统。
- 对竞品分析来说,Claude Code 是 E1/E5/E6/F1/F3/J5/MCP 生产化维度的高成熟度样本。

## 5. 可支撑的系列章节

| 章节 | 可支撑内容 |
|---|---|
| E2 编排循环 | Auto Mode、子 Agent、流水线工作流 |
| E3 工具系统与 MCP | MCP 触达生产系统、工具设计、Computer / Browser Use |
| E4 记忆系统 | CLAUDE.md、Managed Agents memory、1M context、session management |
| E5 Skills / Subagent / Multi-Agent | 子 Agent 使用条件、多 Agent 取舍、Routines |
| E6 安全与权限 | Auto Mode、MCP 生产系统边界、Computer Use 防护 |
| E8 评估体系 | Code Review、验证子 Agent、Preview / Review / Merge |
| E9 DeepSeek 提案 | 桌面端 Agent 的并行任务、代码审查和权限设计 |

## 6. 相关页面

- [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md)
- [OpenClaw / Claude Code / Hermes 运行架构对比](../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)
- [Agent Harness 设计范式演进](../timelines/agent-harness-design-evolution.md)
- [Agent 评测体系](../topics/agent-evaluation-system.md)
