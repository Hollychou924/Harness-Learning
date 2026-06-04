---
id: source-card-official-claude-building-multi-agent-systems-when-and-how-to-use-them
type: source-card
status: triaged
source: wiki/raw/official-posts/claude/2026-01-23-building-multi-agent-systems-when-and-how-to-use-them.md
updated: 2026-05-25
---

# 官方文章卡 · Building multi-agent systems: When and how to use them

## 原文信息

- 来源: Claude / Anthropic 官方 Blog
- 作者: -
- 发布时间: Jan 23, 2026
- URL: https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them
- 原文: [raw](../../../raw/official-posts/claude/2026-01-23-building-multi-agent-systems-when-and-how-to-use-them.md)

## 关键线索

| 线索 | 命中次数 |
|---|---:|
| Context | 53 |
| Subagent | 52 |
| Tool Use | 41 |
| Review/Eval | 11 |
| Cloud Agent | 3 |
| Memory | 1 |
| Skills | 1 |
| Security/Permissions | 1 |
| UI/UX | 1 |

## 内容提要

- Building multi-agent systems: When and how to use them
- The case for starting with a single agent
- A decision framework for multi-agent systems
- Context protection
- Tool result adds 2000+ tokens of order history
- Context is now polluted with order details the agent doesn't need
- Separate agent with its own context
- Returns only essential information
- Get only what's needed, not full history
- Inject compact summary, not full context

## 触发器判定

- 触发器: 官方产品机制 / 官方最佳实践 / 官方评测或工程方法
- 当前状态: triaged, 已进入覆盖账本；其中高价值结论进入实体页或专题页。

## 已沉淀去向

- [claude-code](../../../entities/claude-code.md)
- [agent-evaluation-system](../../../topics/agent-evaluation-system.md)
- [prompt-context-harness](../../../concepts/prompt-context-harness.md)

## 待升级 / 待复核

- 后续若进入 E1-E9 正文写作, 需把本文关键结论转成章节证据。
