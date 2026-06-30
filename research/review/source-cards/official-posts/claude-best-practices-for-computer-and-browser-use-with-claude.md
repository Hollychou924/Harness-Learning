---
id: source-card-official-claude-best-practices-for-computer-and-browser-use-with-claude
type: source-card
status: triaged
source: wiki/raw/official-posts/claude/2026-05-13-best-practices-for-computer-and-browser-use-with-claude.md
updated: 2026-05-25
---

# 官方文章卡 · Best practices for computer and browser use with Claude

## 原文信息

- 来源: Claude / Anthropic 官方 Blog
- 作者: -
- 发布时间: May 13, 2026
- URL: https://claude.com/blog/best-practices-for-computer-and-browser-use-with-claude
- 原文: [raw](../../../raw/official-posts/claude/2026-05-13-best-practices-for-computer-and-browser-use-with-claude.md)

## 关键线索

| 线索 | 命中次数 |
|---|---:|
| Tool Use | 113 |
| Context | 36 |
| Cache | 29 |
| Review/Eval | 15 |
| UI/UX | 14 |
| Harness | 3 |
| Cloud Agent | 3 |
| Security/Permissions | 2 |
| Subagent | 1 |

## 内容提要

- Best practices for computer and browser use with Claude
- **Getting started: resolution and scaling**
- **Ensure proper scaling**
- **Recommended resolutionsStart with 1280x720.** This is a safe, practical default for most use cases. It uses about 80% of the pixel budget, stays well within both the long edge and total pixel limits, and is a standard resolution that models have seen during training. It works well for both modern web UIs and legacy desktop applications.
- 1568 for 4.6 family, 2576 for Opus 4.7
- 1.15MP for 4.6 family, 3.75MP for Opus 4.7
- Compute max dimensions from pixel budget
- Apply long edge constraint
- Never upscale beyond native
- **Coordinate scaling**

## 触发器判定

- 触发器: 官方产品机制 / 官方最佳实践 / 官方评测或工程方法
- 当前状态: triaged, 已进入覆盖账本；其中高价值结论进入实体页或专题页。

## 已沉淀去向

- [claude-code](../../../entities/claude-code.md)
- [agent-evaluation-system](../../../topics/agent-evaluation-system.md)
- [prompt-context-harness](../../../concepts/prompt-context-harness.md)
- [harness-engineering](../../../concepts/harness-engineering.md)

## 待升级 / 待复核

- 后续若进入 E1-E9 正文写作, 需把本文关键结论转成章节证据。
