---
id: source-card-claude-code-prompt-context-harness
type: source-card
status: closed
source: wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md
updated: 2026-05-25
---

# 单篇知识卡 · Claude Code 的 Prompt / Context / Harness 设计

## 原文信息

- 标题: 深度解析 Claude Code 在 Prompt / Context / Harness 的设计与实践
- 公众号: 阿里云开发者
- 作者: 飞樰
- 发布时间: 2026/04/20 08:30:00
- 原文: `wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md`

## 关键观点

1. Claude Code 的 Prompt 分为静态规则和动态上下文: 静态层管身份、任务规则、工具使用、安全、风格;动态层注入会话、环境、语言、MCP、记忆和临时目录等。
2. Claude Code 把软件工程任务执行规范写进系统层,包括先读代码、避免无关改动、遇到失败先诊断、注意安全漏洞。
3. Context 层有自动记忆、CLAUDE.md 注入、环境信息、git 状态、上下文压缩等机制。
4. Harness 层强调权限引擎、沙盒隔离、Hook、子 Agent、异步生成器主循环和长任务支撑。
5. Claude Code 的产品价值不是“会写代码”,而是把代码任务放进可审计、可回滚、可授权的工程流程。
6. 对维度库影响: E1、E5、E6、F1、F3 都应把 Claude Code 作为高成熟度参考。

## 触发器判定

| 触发器 | 是否命中 | 动作 |
|---|---|---|
| 产品/框架深度拆解 | 命中 | 新建 [Claude Code 实体页](../../entities/claude-code.md) |
| 对现有维度库有影响 | 命中 | 覆盖表记录 `compiled/claude-code` 待补社区证据 |
| 多产品比较素材 | 命中 | 进入 [三产品对比页](../../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md) |
| 运行风险/反模式 | 命中 | 进入 [Prompt-only lesson](../../lessons/prompt-only-agent-is-not-production.md) |

## 已沉淀去向

- entity: [Claude Code](../../entities/claude-code.md)
- concept: [Prompt / Context / Harness 三层框架](../../concepts/prompt-context-harness.md)
- comparison: [OpenClaw / Claude Code / Hermes 运行架构对比](../../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)
- timeline: [Agent Harness 设计范式演进](../../timelines/agent-harness-design-evolution.md)
- lesson: [只做 Prompt 不足以支撑生产级 Agent](../../lessons/prompt-only-agent-is-not-production.md)

## 未沉淀内容

| 内容 | 原因 |
|---|---|
| 文章中对内部模式和趣味细节的长段描述 | 与竞品维度关系弱,保留在 raw |
| 可能随版本变化的模型名和内部开关 | 需要官方来源复核后再进入 `compiled` |
