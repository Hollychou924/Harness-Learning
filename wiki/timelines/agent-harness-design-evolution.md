---
id: agent-harness-design-evolution
type: timeline
status: active
updated: 2026-05-25
sources:
  - wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md
  - wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md
  - wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md
  - wiki/raw/papers/agent-harness-engineering-survey/2026-05-16-agent-harness-engineering-a-survey.md
  - wiki/topics/harness-2026-05-28-supplement-synthesis.md
owners: ["zhouhao"]
when_to_load: "讨论 Agent Harness 从提示词、上下文到自进化的范式演进时加载"
---

# Agent Harness 设计范式演进

## 概览

这 3 篇文章共同描述了一条演进线: Agent 先从固定 Prompt 走向动态 Prompt,再从堆上下文走向上下文治理,最后从一次性执行走向经验沉淀和训练反馈。

## 时间线

| 时间 | 节点 | 变化 | 来源 |
|---|---|---|---|
| 2026-04-13 | OpenClaw 拆解 | 个人 Agent 把人格、工具、记忆、沙盒、消息、心跳打包进运行环境 | `wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md` |
| 2026-04-20 | Claude Code 拆解 | 编码 Agent 把工程任务规范、权限、Hook、子 Agent 和压缩机制产品化 | `wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md` |
| 2026-04-24 | Hermes Agent 拆解 | 自进化 Agent 把轨迹、Skill、RL 训练纳入闭环 | `wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md` |
| 2026-05-16 | Agent Harness Engineering: A Survey | Harness 从社区经验词升级为 ETCLOVG 七层学术分类法: 执行、工具、上下文、生命周期、可观测、评测、治理 | `wiki/raw/papers/agent-harness-engineering-survey/2026-05-16-agent-harness-engineering-a-survey.md` |
| 2026-05-28 | 中文 Harness 补充材料集中出现 | 社区讨论从“什么是 Harness”转向“怎么落地、哪里会失败、如何和 SDD / Context / Cache 配合” | `wiki/topics/harness-2026-05-28-supplement-synthesis.md` |

## 当前判断

- 阶段 1: 固定 Prompt,主要解决“怎么说清楚任务”。
- 阶段 2: 动态 Prompt + Context,主要解决“怎么让模型看到正确材料”。
- 阶段 3: Harness,主要解决“怎么让模型在边界里可靠执行”。
- 阶段 4: Harness Taxonomy,主要解决“怎么把执行环境拆成可评审、可验收的模块”。
- 阶段 5: Self-evolving Harness,主要解决“怎么把执行经验变成下一次的能力”。

## 已否决的隐性路径

| 路径 | 为什么不够 |
|---|---|
| 只堆长 Prompt | 不解决工具权限、失败恢复、记忆污染和长任务稳定性 |
| 只做工具调用 | 不解决上下文治理和经验复用 |
| 只做训练反馈 | 如果没有干净轨迹和明确奖励,训练回流会放大错误 |

## 相关页面

- [Harness Engineering](../concepts/harness-engineering.md)
- [ETCLOVG Agent Harness 七层分类法](../concepts/etclovg-agent-harness-taxonomy.md)
- [OpenClaw / Claude Code / Hermes 运行架构对比](../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)
- [只做 Prompt 不足以支撑生产级 Agent](../lessons/prompt-only-agent-is-not-production.md)
