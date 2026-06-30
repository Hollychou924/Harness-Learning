---
id: hermes-agent
type: entity
status: draft
updated: 2026-05-25
sources:
  - wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md
  - wiki/compiled/hermes/_provenance.json
owners: ["zhouhao"]
when_to_load: "讨论 Hermes、自进化 Agent、轨迹学习、Skill 沉淀、训练反馈回路时加载"
---

# Hermes Agent

> 一句话: Hermes Agent 的核心差异是把 Agent 运行轨迹变成可沉淀、可复用、可训练的资产,把“会做任务”推进到“能从任务中学习”。

## 1. 是什么

Hermes Agent 在这批文章里代表“自进化 Agent”方向。它延续 OpenClaw / Claude Code 的三层结构,但重点放在任务轨迹、Skill 生成和训练反馈闭环。

## 2. 关键机制

| 机制 | 说明 | 来源 |
|---|---|---|
| 轨迹记录 | 把 Agent 执行过程组织成可分析的数据 | `wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md` |
| Skill 动态沉淀 | 从纠错和经验中抽象出可复用 Skill | `wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md` |
| RL 训练闭环 | 用轨迹数据和奖励函数支撑模型能力改进 | `wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md` |
| 模型差异化 Prompt | 对 GPT、Gemini/Gemma、Claude 等模型分别注入工具使用指导 | `wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md` |
| 子 Agent 隔离 | 限制子 Agent 递归委派、操纵记忆、消息劫持和代码执行 | `wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md` |

## 3. 产品判断

- Hermes 的价值不是“再做一个 Agent 壳”,而是尝试把使用过程变成训练和复用资产。
- 它对 M2“训练反馈回路”维度特别重要。
- 风险在于训练回流涉及隐私、安全和数据质量,不能直接把用户对话无脑拿去训练。

## 4. 相关页面

- [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md)
- [OpenClaw / Claude Code / Hermes 运行架构对比](../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)
- [Agent Harness 设计范式演进](../timelines/agent-harness-design-evolution.md)

