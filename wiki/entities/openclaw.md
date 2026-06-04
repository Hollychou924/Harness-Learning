---
id: openclaw
type: entity
status: draft
updated: 2026-05-25
sources:
  - wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md
owners: ["zhouhao"]
when_to_load: "讨论个人 Agent、OpenClaw、Skills、Markdown 文件注入、心跳、沙盒和多渠道消息时加载"
---

# OpenClaw

> 一句话: OpenClaw 是一个偏个人助理形态的 Agent 运行框架,核心价值是把人格、工具、记忆、消息、心跳和沙盒整合成个人 Agent 的运行环境。

## 1. 是什么

OpenClaw 在这批中文文章里被当作“个人 Agent 操作系统”样本。它不是单点工具,而是把 System Prompt 拼装、Markdown 文件注入、Skills、记忆、Hook、沙盒、多渠道消息和心跳机制组合在一起。

## 2. 关键机制

| 机制 | 说明 | 来源 |
|---|---|---|
| 动态 System Prompt | 按身份、工具、安全、Skills、记忆、工作区、沙盒、时间、消息等模块拼装 | `wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md` |
| Markdown 文件注入 | AGENT.md / SOUL.md / USER.md / TOOLS.md / MEMORY.md 构成可编辑配置层 | `wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md` |
| Skills 渐进式披露 | 先读技能名和描述,任务命中后再读 SKILL.md | `wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md` |
| 长期记忆 | 通过 MEMORY.md 等文件让 Agent 能跨会话保留事实 | `wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md` |
| Harness 运行保障 | Hook、沙盒、授权发送者、心跳、多渠道消息共同约束运行 | `wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md` |

## 3. 产品判断

- OpenClaw 的强项是“个人化”和“可塑性”: 用户可以通过 Markdown 文件持续塑造 Agent。
- 它的产品心智更接近“养一个个人 Agent”,而不是“开一个代码助手”。
- 风险在于能力开放后,Skills、Hook、设备权限都可能变成安全边界问题。

## 4. 相关页面

- [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md)
- [渐进式披露](../concepts/progressive-disclosure.md)
- [OpenClaw / Claude Code / Hermes 运行架构对比](../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)

