---
id: cursor
type: entity
status: active
updated: 2026-05-25
sources:
  - wiki/raw/official-posts/cursor/INDEX.md
  - wiki/raw/official-posts/cursor/2026-01-06-dynamic-context-discovery.md
  - wiki/raw/official-posts/cursor/2026-05-21-我们在构建云端智能体时学到的经验.md
  - wiki/raw/official-posts/cursor/2026-05-13-云端智能体的开发环境.md
  - wiki/raw/official-posts/cursor/2026-04-30-持续改进我们的智能体框架.md
  - wiki/raw/official-posts/cursor/2026-03-11-我们如何在-cursor-中比较模型质量.md
  - wiki/raw/official-posts/cursor/2026-04-08-bugbot-现在可通过学习规则自我改进.md
  - wiki/raw/official-posts/cursor/2026-01-27-安全地为大型代码库建立索引.md
  - wiki/compiled/cursor/_provenance.json
owners: ["zhouhao"]
when_to_load: "讨论 Cursor、IDE 型 Coding Agent、云端 Agent、Bugbot、CursorBench、动态上下文发现时加载"
---

# Cursor

> 一句话: Cursor 正在从“AI 编辑器”演进成“本地 + 云端 + 代码审查 + 自动化”的 Agent 工作区,核心 Harness 抓手是代码库索引、动态上下文发现、云端隔离环境、MCP / Skills / Rules 和 Bugbot 反馈闭环。

## 1. 是什么

Cursor 的早期心智是 IDE 里的 AI 副驾驶,但 2026 年官方文章已经把它推向更完整的 Agent 工作区:

- 本地 IDE 里做人机协作。
- 云端 Agent 在独立 VM 中跑长任务。
- Bugbot 做 PR 代码审查。
- SDK 和 Automations 让 Agent 可被程序化启动。
- MCP、Rules、Skills、插件市场承接外部能力和团队规则。

这意味着 Cursor 不只是“编辑器补全”,而是在尝试把开发者工作流拆成一组可调度、可观察、可持续改进的 Agent 任务。

## 2. 关键机制

| 机制 | 说明 | 产品含义 | 来源 |
|---|---|---|---|
| 动态上下文发现 | 长工具输出写成文件; 对话历史、终端会话、MCP 工具描述都变成 Agent 可搜索的文件; 任务需要时再读 | Cursor 的上下文策略不是“把所有东西塞进窗口”,而是让 Agent 自主找材料 | [Dynamic context discovery](../raw/official-posts/cursor/2026-01-06-dynamic-context-discovery.md) |
| Rules + Skills | Rules 提供常驻规则,Skills 提供按需加载的专用能力和工作流 | Cursor 已从 `.cursorrules` 走向更接近 Claude Skill 的能力包体系 | [使用智能体编码的最佳实践](../raw/official-posts/cursor/2026-01-09-使用智能体编码的最佳实践.md) |
| 云端 Agent 运行时 | 云端 Agent 运行在专用 VM,可并行、无人值守、跨数小时任务; Cursor 将可靠性、凭证、网络、重试和调度都视为产品问题 | 云端 Agent 的核心不是“把本地 Agent 放到服务器”,而是重新做一层操作系统式运行环境 | [我们在构建云端智能体时学到的经验](../raw/official-posts/cursor/2026-05-21-我们在构建云端智能体时学到的经验.md) |
| 开发环境即产品 | 云端 Agent 需要仓库、依赖、凭证、构建系统、网络策略、版本历史和审计日志 | Agent 能否完成任务,很大程度取决于环境准备质量 | [云端智能体的开发环境](../raw/official-posts/cursor/2026-05-13-云端智能体的开发环境.md) |
| 程序化 Agent | TypeScript SDK 可启动云端会话,并复用云端 Agent 运行时、MCP 和 `.cursor/skills/` | Cursor 正在把 Agent 从 UI 功能变成可嵌入业务流程的基础能力 | [使用 Cursor SDK 构建程序化智能体](../raw/official-posts/cursor/2026-04-29-使用-cursor-sdk-构建程序化智能体.md) |
| CursorBench + 在线评估 | Cursor 用线下 benchmark 与线上信号组合比较模型质量 | 评测不是单一排行榜,而是“离线可控 + 在线真实”的组合系统 | [我们如何在 Cursor 中比较模型质量](../raw/official-posts/cursor/2026-03-11-我们如何在-cursor-中比较模型质量.md) |
| Bugbot 学习规则 | Bugbot 从 PR 评论反馈、开发者回复、人工审查评论中抽取学习规则,并持续评估规则是否应启用或禁用 | Cursor 把代码审查变成持续学习的反馈回路,不是一次性静态规则 | [Bugbot 现在可通过学习规则自我改进](../raw/official-posts/cursor/2026-04-08-bugbot-现在可通过学习规则自我改进.md) |
| 安全代码库索引 | 通过块缓存、simhash、Merkle tree 等方式复用团队索引,同时限制用户只能看到本地实际拥有的代码结果 | 大代码库体验的关键是“快”和“权限边界”同时成立 | [安全地为大型代码库建立索引](../raw/official-posts/cursor/2026-01-27-安全地为大型代码库建立索引.md) |
| 多 Agent 实验 | Cursor 用多 Agent 系统优化 235 个 GPU kernel,报告几何平均提速 38%; 也做过“自动驾驶代码库”研究 | Cursor 在探索的不只是 IDE 交互,还有大规模 Agent 编排 | [多智能体系统将 GPU kernel 提速 38%](../raw/official-posts/cursor/2026-04-14-多智能体系统将-gpu-kernel-提速-38.md), [迈向自动驾驶代码库](../raw/official-posts/cursor/2026-02-05-迈向自动驾驶代码库.md) |

## 3. 和 Claude Code / Codex 的差异

| 维度 | Cursor | Claude Code | Codex |
|---|---|---|---|
| 产品入口 | IDE / 桌面工作区 / 云端 Agent / Bugbot | CLI、桌面、Web、IDE 插件 | CLI、云端任务、API / ChatGPT 入口 |
| 上下文抓手 | 代码库索引、Rules、Skills、动态上下文发现 | CLAUDE.md、Skills、Subagents、Hooks、压缩 | AGENTS.md、工具、云端任务上下文 |
| 长任务思路 | 云端 VM + 持久运行原语 | 本地/桌面/托管 Agent + 子 Agent / session 管理 | 云端任务和沙盒 |
| 评测抓手 | CursorBench、Bugbot、线上/线下混合评测 | Code Review、验证子 Agent、官方最佳实践 | 公开文档与任务执行评估仍需补充 |
| 最强信号 | 把 IDE 协作、云端长任务、PR 审查连成工作区 | 把工程执行规范做成可组合 Harness | 把 OpenAI 模型能力接入工程执行环境 |

## 4. 对 DeepSeek 桌面端 Agent 的启示

1. 不要只做编辑器插件。Cursor 的方向说明,桌面端 Agent 的终局更像工作区: 本地任务、云端任务、PR 审查、自动化和插件生态都要在一个入口里被看见。
2. 云端 Agent 的“开发环境”要当产品做。依赖、密钥、网络、审计、回滚、环境版本,都不是后台杂活,而是决定成功率的产品面。
3. 评测要接近真实工作流。CursorBench、Bugbot 反馈、线上信号共同说明,模型好不好不能只看公开榜,要看真实 PR、真实仓库、真实接管点。
4. 上下文应文件化、可搜索、可复用。工具结果、终端历史、MCP 描述、对话历史都可以变成 Agent 自己能搜索的材料,这比静态堆提示词更可扩展。
5. 代码审查是最佳冷启动场景之一。Bugbot 有清晰输入、清晰输出、清晰反馈信号,适合用来建立 Agent 评测和学习闭环。

## 5. 可支撑的系列章节

| 章节 | 可支撑内容 |
|---|---|
| E1 桌面端 Agent 全景图 | Cursor 从 IDE 到 Agent 工作区的定位 |
| E2 编排循环 | 本地 Agent、云端 Agent、自动化、长任务调度 |
| E3 工具系统与 MCP | MCP、插件市场、SDK、支持团队内部 MCP 用法 |
| E4 记忆与上下文 | 动态上下文发现、终端/历史/工具描述文件化 |
| E6 安全与权限 | 开发环境、网络、密钥、索引权限边界 |
| E8 评估体系 | CursorBench、Bugbot 学习规则、线上/线下混合评测 |
| E9 DeepSeek 提案 | 云端 Agent 环境、Bugbot 式代码审查、工作区入口 |

## 6. 相关页面

- [Agent 评测体系](../topics/agent-evaluation-system.md)
- [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md)
- [Harness Engineering](../concepts/harness-engineering.md)
- [Harness Engineering 中文社区 66 篇沉淀](../topics/harness-engineering-community-synthesis.md)
