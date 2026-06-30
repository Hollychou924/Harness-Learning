---
id: codebuddy-cursor-claude-code-comparison
type: comparison
status: active
updated: 2026-05-25
sources:
  - wiki/entities/codebuddy.md
  - wiki/entities/cursor.md
  - wiki/entities/claude-code.md
  - wiki/raw/official-posts/codebuddy/2025-11-05-国内首家-CodeBuddy-Skills-驱动的-AI-编程实践.md
  - wiki/raw/official-posts/codebuddy/2026-02-13-CodeBuddy-Code-Agent-Teams让多个-AI-组队干活复杂任务一次搞定.md
  - wiki/raw/official-posts/cursor/INDEX.md
  - wiki/raw/official-posts/claude/INDEX.md
owners: ["zhouhao"]
when_to_load: "需要比较 CodeBuddy、Cursor、Claude Code 的产品定位、Harness、上下文和企业化路径时加载"
---

# CodeBuddy / Cursor / Claude Code 对比

## 1. 一句话差异

CodeBuddy 偏“企业流程和腾讯生态工作台”,Cursor 偏“IDE 到云端 Agent 工作区”,Claude Code 偏“工程任务执行平台”。

## 2. 对比矩阵

| 维度 | CodeBuddy | Cursor | Claude Code |
|---|---|---|---|
| 产品入口 | IDE、终端、SDK、WorkBuddy | IDE、云端 Agent、Bugbot | CLI、桌面、Web、IDE 插件 |
| 核心心智 | 把团队流程沉淀成 Skills / Commands / Hooks | 让开发工作区具备本地、云端、审查和自动化能力 | 让 Agent 在工程边界内可靠完成任务 |
| 上下文策略 | Rules / Memory、精准引用、Skills 按需加载、Sub-agent 分流、缓存优化 | 动态上下文发现、代码库索引、Rules / Skills | CLAUDE.md、Skills、Subagents、会话管理、Prompt cache |
| 流程编排 | Spec-Kit、Slash Commands、Agent Teams | 云端任务、Automations、SDK | Auto Mode、Subagents、Routines、Hooks |
| 质量闭环 | `/mr`、`/release`、构建验证、文档检查、changeset、Hooks | CursorBench、Bugbot、线上/线下信号 | Code Review、验证 Subagent、Preview / Review / Merge |
| 企业系统连接 | MCP 在线配置、SkillHub、乐享知识库、企业微信、Agent SDK | MCP、插件市场、云端开发环境 | MCP、Connectors、Managed Agents |
| 多 Agent 形态 | Agent Teams: 成员可互相通信,共享任务看板 | 多 Agent 研究与云端长任务 | Subagents: 隔离上下文,适合验证和专业任务 |

## 3. 对产品经理最重要的差异

| 问题 | 更值得看谁 | 原因 |
|---|---|---|
| 如何把 AI 编程带进公司现有流程? | CodeBuddy | 它大量讲 `/mr`、`/release`、Hooks、企业知识库、MCP 和 SDK |
| 如何把 IDE 变成开发者工作区? | Cursor | 它把本地协作、云端 Agent、Bugbot 和自动化连起来 |
| 如何让 Agent 在工程任务里更可靠? | Claude Code | 它的权限、缓存、Subagents、Code Review 和 MCP 实践更系统 |
| 如何做中文企业市场表达? | CodeBuddy | 它围绕 Skills、规约、知识库和腾讯生态给了更本土化的叙事 |

## 4. 来源映射

| 结论 | 来源 |
|---|---|
| CodeBuddy 的核心抓手是 Skills、Commands、Hooks、Spec-Kit、Agent Teams 与 SDK | `wiki/entities/codebuddy.md` |
| Cursor 的核心抓手是代码库索引、云端 Agent、Bugbot、动态上下文发现与评测闭环 | `wiki/entities/cursor.md` |
| Claude Code 的核心抓手是权限、Subagents、Prompt caching、MCP、Code Review 和会话管理 | `wiki/entities/claude-code.md` |
| CodeBuddy Agent Teams 与 Claude Subagents 的差异在于: 前者强调成员通信和共享看板,后者强调上下文隔离和验证 | `wiki/raw/official-posts/codebuddy/2026-02-13-CodeBuddy-Code-Agent-Teams让多个-AI-组队干活复杂任务一次搞定.md`, `wiki/raw/official-posts/claude/2026-04-07-how-and-when-to-use-subagents-in-claude-code.md` |

## 5. 相关页面

- [CodeBuddy](../entities/codebuddy.md)
- [Cursor](../entities/cursor.md)
- [Claude Code](../entities/claude-code.md)
- [Spec 驱动的 Agent 开发](../concepts/spec-driven-agent-development.md)
- [Agent 评测体系](../topics/agent-evaluation-system.md)
