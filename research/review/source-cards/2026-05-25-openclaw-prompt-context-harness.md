---
id: source-card-openclaw-prompt-context-harness
type: source-card
status: closed
source: wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md
updated: 2026-05-25
---

# 单篇知识卡 · OpenClaw 的 Prompt / Context / Harness 设计

## 原文信息

- 标题: 深度解析 OpenClaw 在 Prompt / Context / Harness 三个维度中的设计哲学与实践
- 公众号: 阿里云开发者
- 作者: 飞樰
- 发布时间: 2026/04/13 08:30:00
- 原文: `wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md`

## 关键观点

1. OpenClaw 的 System Prompt 不是一段固定提示词,而是由身份、工具、安全、Skills、记忆、工作区、沙盒、时间、消息、心跳等 20 多个模块动态拼装。
2. OpenClaw 把 AGENT.md / SOUL.md / USER.md / TOOLS.md / MEMORY.md 等 Markdown 文件当成配置和人格注入层,降低用户定制门槛。
3. Skills 采用渐进式披露: 先加载技能名称和描述,命中任务后再读取完整 SKILL.md。
4. Context 层重点解决上下文窗口爆炸,包括自动压缩、分块摘要、历史裁剪和长期记忆。
5. Harness 层把工具调用、Hook、沙盒、授权发送者、心跳、消息系统放在一起,形成个人 Agent 的运行环境。
6. 产品启示是: 个人 Agent 不只是聊天框,而是“文件化人格 + 工具系统 + 运行时护栏”的组合。

## 触发器判定

| 触发器 | 是否命中 | 动作 |
|---|---|---|
| 产品/框架深度拆解 | 命中 | 新建 [OpenClaw 实体页](../../entities/openclaw.md) |
| 明确提出新机制 | 命中 | 更新 [Prompt / Context / Harness 三层框架](../../concepts/prompt-context-harness.md) |
| 多产品比较素材 | 命中 | 进入 [三产品对比页](../../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md) |
| 运行风险/反模式 | 命中 | 进入 [Prompt-only lesson](../../lessons/prompt-only-agent-is-not-production.md) |

## 已沉淀去向

- entity: [OpenClaw](../../entities/openclaw.md)
- concept: [Prompt / Context / Harness 三层框架](../../concepts/prompt-context-harness.md)
- comparison: [OpenClaw / Claude Code / Hermes 运行架构对比](../../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)
- timeline: [Agent Harness 设计范式演进](../../timelines/agent-harness-design-evolution.md)
- lesson: [只做 Prompt 不足以支撑生产级 Agent](../../lessons/prompt-only-agent-is-not-production.md)

## 未沉淀内容

| 内容 | 原因 |
|---|---|
| 文章中大量原始 Prompt 模块全文 | 已保留在 raw,成品页只吸收结构和产品判断 |
| OpenClaw 社区热度叙事 | 对竞品维度影响较弱,暂不进入实体核心判断 |
