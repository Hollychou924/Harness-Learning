---
id: source-card-hermes-agent-self-evolution
type: source-card
status: closed
source: wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md
updated: 2026-05-25
---

# 单篇知识卡 · Hermes Agent 的自进化与三层设计

## 原文信息

- 标题: 深度解析 Hermes Agent 如何实现“自进化”及其 Prompt / Context / Harness 的设计实践
- 公众号: 阿里云开发者
- 作者: 飞樰
- 发布时间: 2026/04/24 08:30:00
- 原文: `wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md`

## 关键观点

1. Hermes 的核心差异是“自进化”: 把任务轨迹、纠错经验和人工反馈沉淀为 Skill,再进一步进入训练闭环。
2. 自进化路径可以拆成: 轨迹记录 -> 轨迹压缩 -> 数据生成 -> 奖励函数 -> RL 训练。
3. Prompt 层强调模型异构适配: 对 GPT、Gemini/Gemma、Claude 等模型注入不同工具使用指导。
4. Context 层采用比例阈值压缩,并结合内部记忆文件、SQLite 对话历史和外部记忆服务。
5. Harness 层强调错误分类恢复、子 Agent 工具限制、插件系统和多层安全护栏。
6. 对维度库影响: M2“训练反馈回路”需要把 Hermes 作为重要样本,F3 需要区分内部记忆和外部记忆。

## 触发器判定

| 触发器 | 是否命中 | 动作 |
|---|---|---|
| 产品/框架深度拆解 | 命中 | 新建 [Hermes Agent 实体页](../../entities/hermes-agent.md) |
| 明确提出新机制 | 命中 | 沉淀“自进化路径”到时间线和对比页 |
| 对现有维度库有影响 | 命中 | 覆盖表记录 `compiled/hermes` 待补社区证据 |
| 运行风险/反模式 | 命中 | 进入 [Prompt-only lesson](../../lessons/prompt-only-agent-is-not-production.md) |

## 已沉淀去向

- entity: [Hermes Agent](../../entities/hermes-agent.md)
- concept: [Prompt / Context / Harness 三层框架](../../concepts/prompt-context-harness.md)
- comparison: [OpenClaw / Claude Code / Hermes 运行架构对比](../../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)
- timeline: [Agent Harness 设计范式演进](../../timelines/agent-harness-design-evolution.md)
- lesson: [只做 Prompt 不足以支撑生产级 Agent](../../lessons/prompt-only-agent-is-not-production.md)

## 未沉淀内容

| 内容 | 原因 |
|---|---|
| RL 算法细节和配置片段 | 先沉淀产品机制,算法参数需结合论文/代码再复核 |
| 外部记忆服务清单 | 后续可单独做“Agent Memory 生态”实体/对比页 |
