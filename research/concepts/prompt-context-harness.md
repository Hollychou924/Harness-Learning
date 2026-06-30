---
id: prompt-context-harness
type: concept
status: active
updated: 2026-05-25
sources:
  - wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md
  - wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md
  - wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md
  - wiki/raw/official-posts/codex/2026-01-23-深入解析-codex-智能体循环.md
  - wiki/raw/official-posts/codex/2026-02-04-解锁-codex-运行框架-我们如何构建-app-server.md
  - wiki/raw/official-posts/codex/2026-02-11-工程技术-在智能体优先的世界中利用-codex.md
  - wiki/raw/papers/agent-harness-engineering-survey/2026-05-16-agent-harness-engineering-a-survey.md
  - wiki/raw/community-posts/harness-2026-05-28-supplement/
owners: ["zhouhao"]
when_to_load: "需要从 Prompt、Context、Harness 三层拆解 Agent 产品或框架时加载"
---

# Prompt / Context / Harness 三层框架

> 一句话定义: Prompt 负责“下指令”,Context 负责“给材料”,Harness 负责“控执行”。

## 三层分别管什么

| 层级 | 用户能感知到的表现 | 产品设计重点 |
|---|---|---|
| Prompt | Agent 知道自己是谁、怎么说话、怎么做事 | 身份、角色、规则、语气、任务流程 |
| Context | Agent 能看见项目规则、历史、工具结果、用户偏好 | 文件注入、记忆召回、上下文压缩、资源挂载 |
| Harness | Agent 能安全调用工具、长时间运行、失败恢复 | 权限、沙盒、Hook、检查点、子 Agent 隔离 |

## 新增 3 篇文章带来的补充

这 3 篇阿里云开发者文章的共同价值,是把同一个分析框架套到了 3 个具体系统上:

| 产品/框架 | Prompt 层亮点 | Context 层亮点 | Harness 层亮点 |
|---|---|---|---|
| OpenClaw | System Prompt 按模块动态拼装,不同场景有不同模式 | AGENT.md / SOUL.md / USER.md / MEMORY.md 等 Markdown 文件注入,配合压缩与记忆 | Skills、Hook、沙盒、心跳、跨渠道消息和授权发送者 |
| Claude Code | 静态规则和动态环境信息分层,强调工程任务执行规范 | 自动记忆、环境信息、CLAUDE.md 注入、微压缩和完整压缩 | 权限引擎、沙盒隔离、Hook、子 Agent、长任务保障 |
| Hermes Agent | 针对不同模型注入不同工具使用提示,兼容多种 Agent 配置文件 | 比例阈值压缩、内部记忆 + 外部记忆、@资源注入 | 错误分类恢复、子 Agent 工具限制、插件系统、安全护栏 |
| Codex | 模型指令、开发者指令、AGENTS.md、环境信息和工具定义共同构成初始提示 | 线程历史、工具结果、压缩、代码仓库文档和可观测性数据为 Agent 提供材料 | Responses API、App Server、沙箱、审批、MCP、技能、线程持久化和多端协同 |

## 产品启示

1. 不要把“提示词”当成一个长文本,成熟 Agent 的提示词更像一套动态装配系统。
2. 上下文不是越多越好,关键是分清“必须保留”“可以摘要”“按需再读”。
3. Harness 不是后端工程师的隐藏实现,它会直接影响产品体验: 能不能放心授权、能不能跑长任务、能不能失败后继续。

## 2026-05-28 补充: 三层框架和 ETCLOVG 的关系

本页的三层框架适合做“第一眼解释”: Prompt 是下指令,Context 是给材料,Harness 是控执行。论文 **Agent Harness Engineering: A Survey** 则把第三层继续拆开,形成 ETCLOVG 七层分类法: 执行环境、工具接口、上下文、生命周期、可观测、验证评测、治理安全。

更适合产品使用的说法是:

| 层级 | 解释粒度 | 适合场景 |
|---|---|---|
| Prompt / Context / Harness | 粗粒度 | 对外讲清 Agent 产品为什么不只是提示词 |
| ETCLOVG 七层 | 细粒度 | 做方案评审、竞品拆解、上线检查和失败复盘 |

这批 22 篇中文文章也强化了同一个判断: Harness 不是一个单点功能,而是规则入口、上下文缓存、工具边界、人工接管、结果验收共同组成的执行秩序。

## 适合继续展开的问题

- 哪些信息应该常驻上下文,哪些应该按需加载?
- Skills 和 Markdown 文件注入的边界在哪里?
- 子 Agent 到底应该共享多少主 Agent 的上下文和权限?
- Agent 自进化是先沉淀 Skill,还是直接回流训练模型?

## 代表性原文

- [OpenClaw 的三层设计](../raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md)
- [Claude Code 的三层设计](../raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md)
- [Hermes Agent 的三层设计](../raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md)
- [Codex 智能体循环](../raw/official-posts/codex/2026-01-23-深入解析-codex-智能体循环.md)
- [Codex 运行框架 / App Server](../raw/official-posts/codex/2026-02-04-解锁-codex-运行框架-我们如何构建-app-server.md)

## 来源映射

| 结论 | 来源 |
|---|---|
| OpenClaw 的三层亮点是模块化 Prompt、Markdown 文件注入和个人 Agent Harness | `wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md` |
| Claude Code 的三层亮点是工程任务规则、自动记忆/压缩和权限/Hook/子 Agent | `wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md` |
| Hermes 的三层亮点是模型异构 Prompt、比例阈值压缩和自进化运行闭环 | `wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md` |
| Codex 的三层亮点是 Responses API 请求结构、线程/轮次/项目模型和跨端复用的 App Server | `wiki/raw/official-posts/codex/2026-01-23-深入解析-codex-智能体循环.md` + `wiki/raw/official-posts/codex/2026-02-04-解锁-codex-运行框架-我们如何构建-app-server.md` |

## 相关页面

- [Harness Engineering](harness-engineering.md)
- [ETCLOVG Agent Harness 七层分类法](etclovg-agent-harness-taxonomy.md)
- [Codex](../entities/codex.md)
- [OpenClaw / Claude Code / Hermes 运行架构对比](../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)
- [Agent Harness 设计范式演进](../timelines/agent-harness-design-evolution.md)
