---
id: openclaw-claude-code-hermes-comparison
type: topic
status: active
updated: 2026-05-25
sources:
  - wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md
  - wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md
  - wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md
owners: ["zhouhao"]
when_to_load: "讨论 OpenClaw、Claude Code、Hermes 三篇文章综合结论时加载"
---

# OpenClaw / Claude Code / Hermes 三篇产品拆解沉淀

> 来源: 2026 年 4 月阿里云开发者三篇文章。
> 主题: 用 Prompt / Context / Harness 三层框架拆解 3 个 Agent 系统。

## 一句话结论

OpenClaw 像“个人 Agent 操作系统”,Claude Code 像“工程任务执行平台”,Hermes 像“自进化 Agent 实验场”。三者都在做动态 Prompt、上下文管理和运行约束,但产品重心不同。

## 对比表

| 维度 | OpenClaw | Claude Code | Hermes Agent |
|---|---|---|---|
| 目标场景 | 个人助理、多渠道消息、个人设备能力 | 软件工程任务、代码库理解、命令行执行 | 自进化 Agent、经验沉淀、模型训练闭环 |
| Prompt 设计 | 模块化拼装,按 full/minimal/none 模式加载 | 静态规则 + 动态环境信息 + 工程任务规范 | 按不同模型注入不同工具使用指导 |
| Context 设计 | Markdown 文件注入、Skills、记忆、压缩 | CLAUDE.md、自动记忆、环境信息、压缩 | 比例阈值压缩、@资源注入、内外部记忆 |
| Harness 设计 | Hook、沙盒、心跳、授权发送者、消息系统 | 权限引擎、沙盒、Hook、子 Agent、长任务 | 错误分类恢复、子 Agent 隔离、插件、安全护栏 |
| 最大产品启示 | 个性化 Agent 需要文件化人格和记忆 | 工程 Agent 的核心是权限、质量和可回滚 | Agent 自进化先从 Skill 沉淀开始,再谈训练回流 |

## 三篇共同验证的趋势

1. System Prompt 正在从“单条提示词”变成“运行时组装系统”。
2. Markdown 规则文件正在成为 Agent 产品的低成本配置层。
3. 上下文压缩不再是补丁,而是长任务 Agent 的基础能力。
4. Skills / 插件 / MCP 让 Agent 从单体工具变成生态入口。
5. 子 Agent 必须有权限隔离,否则并行能力会放大安全风险。
6. 自进化不是一句口号,可落地路径是“轨迹记录 -> 经验抽象 -> Skill 复用 -> 训练反馈”。

## 对竞品分析维度库的影响

| 维度 | 应补充的观察 |
|---|---|
| E1 终端/Shell 执行 | 不只看能不能执行命令,还要看权限模式、危险操作确认、沙盒边界 |
| E5 自定义工具/Hook 系统 | Hook、Skill、插件、子 Agent 应拆开看成熟度 |
| E6 长任务持久化 | 心跳、检查点、错误恢复、上下文压缩都应进入判断 |
| F1 项目配置文件 | AGENTS.md / CLAUDE.md / SOUL.md / USER.md 等文件是产品心智入口 |
| F3 Memory + Context Compaction | 需要区分会话摘要、长期记忆、外部记忆服务和资源注入 |
| M2 训练反馈回路 | Hermes 提供了“运行轨迹 -> RL 训练”的参考路径 |

## 后续可做

- 把 OpenClaw 加入产品池,至少作为中文社区现象级 Agent 框架观察对象。
- 为 Claude Code 补充“动态 Prompt / 压缩 / 子 Agent / 权限引擎”的社区证据。
- 为 Hermes 的 `_provenance.json` 补充来自这篇中文深度拆解的证据链接。

## 已升级页面

- [OpenClaw](../entities/openclaw.md)
- [Claude Code](../entities/claude-code.md)
- [Hermes Agent](../entities/hermes-agent.md)
- [OpenClaw / Claude Code / Hermes 运行架构对比](../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)
- [Agent Harness 设计范式演进](../timelines/agent-harness-design-evolution.md)
- [只做 Prompt 不足以支撑生产级 Agent](../lessons/prompt-only-agent-is-not-production.md)

## 原文

- [深度解析 OpenClaw 在 Prompt / Context / Harness 三个维度中的设计哲学与实践](../raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md)
- [深度解析 Claude Code 在 Prompt / Context / Harness 的设计与实践](../raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md)
- [深度解析 Hermes Agent 如何实现“自进化”及其 Prompt / Context / Harness 的设计实践](../raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md)
