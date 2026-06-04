---
id: prompt-only-agent-is-not-production
type: lesson
status: active
updated: 2026-05-25
sources:
  - wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md
  - wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md
  - wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md
owners: ["zhouhao"]
when_to_load: "评估 Agent 产品是否只停留在提示词包装时加载"
---

# 只做 Prompt 不足以支撑生产级 Agent

## 背景

OpenClaw、Claude Code、Hermes 三篇拆解都说明: 成熟 Agent 的价值不在一段漂亮提示词,而在提示词之外的运行环境。

## 错误路径

常见错误是把 Agent 产品理解成“写一段角色设定 + 接几个工具”。这会导致:

- 工具能调用,但权限边界不清楚。
- 上下文能堆进去,但长任务越跑越乱。
- 任务能成功一次,但经验不能复用。
- 出错后没有恢复、回滚、审计路径。

## 正确路径

至少要补齐四件事:

1. Context: 规则文件、记忆、压缩、资源挂载。
2. Harness: 权限、沙盒、Hook、错误恢复。
3. Skill: 把可复用经验沉淀成可加载能力。
4. Evidence: 每个关键结论和能力判断都要能回到原文或官方证据。

## 代价 / 影响

如果停留在 Prompt-only,产品会在 Demo 阶段显得聪明,但在真实项目里暴露为不可控、不可复用、不可审计。

## 相关页面

- [Harness Engineering](../concepts/harness-engineering.md)
- [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md)
- [OpenClaw / Claude Code / Hermes 运行架构对比](../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)

