---
id: harness-engineering
type: concept
status: active
updated: 2026-05-25
sources:
  - wiki/raw/harness-engineering/README.md
  - wiki/analysis/entity-scan.md
  - wiki/raw/harness-engineering/3_实战案例/003-QQ音乐Harness-Engineering实践.md
  - wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md
  - wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md
  - wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md
  - wiki/raw/official-posts/codex/2026-02-11-工程技术-在智能体优先的世界中利用-codex.md
  - wiki/raw/official-posts/codex/2026-05-08-在-openai-内部安全运行-codex.md
  - wiki/raw/official-posts/codex/2026-05-13-building-a-safe-effective-sandbox-to-enable-codex-on-windows.md
  - wiki/raw/official-posts/codebuddy/2025-11-05-国内首家-CodeBuddy-Skills-驱动的-AI-编程实践.md
  - wiki/raw/official-posts/codebuddy/2025-11-21-CodeBuddy-Code-Hooks-探索实践-Hooks-为你的-AI-配上随叫随到的管家.md
  - wiki/raw/official-posts/codebuddy/2026-02-03-CodeBuddy-Code-团队实践斜杠命令-Skills-让发版流程自动化且可靠.md
  - wiki/raw/official-posts/qoder/2026-05-11-终端沙箱Agent-Harness-的基础设施.md
  - wiki/raw/official-posts/qoder/2026-05-14-Qoder-CLI-上线自动权限模式不用全程盯着AI-安全地帮你干活.md
  - wiki/raw/official-posts/qoder/2026-04-09-一文详解Qoder-Hooks-核心用法-及-8个实战案例解析.md
  - wiki/raw/official-posts/qoder/2026-05-15-以-Qoder-开发-Qoder9-个月-60个版本Qoder10-来了.md
  - wiki/raw/official-posts/qoder/2026-03-13-骑到-Agent-背上去从增强的上下文工程到驾驭工程.md
  - wiki/raw/official-posts/qoder/2026-03-18-工程知识引擎Harness-Engineering体系下的工程知识底座.md
  - wiki/raw/official-posts/qoder/2026-03-26-不是换了几个-Prompt-这么简单Experts专家团背后的-Harness-Engineering-工程实践.md
  - wiki/raw/papers/agent-harness-engineering-survey/2026-05-16-agent-harness-engineering-a-survey.md
  - wiki/raw/community-posts/harness-2026-05-28-supplement/
owners: ["zhouhao"]
when_to_load: "讨论 Agent 可控性、工具调用、权限、上下文、记忆、长任务和工程化落地时加载"
---

# Harness Engineering

> 一句话定义: Harness Engineering 不是“让模型更聪明”,而是给 Agent 加上一整套可控、可审计、可复用的运行环境,让它能稳定完成长任务。

## 核心判断

从 66 篇中文社区文章看,Harness Engineering 已经从一个抽象概念,落到了 6 类具体抓手:

| 抓手 | 解决的问题 | 常见实现 |
|---|---|---|
| 权限边界 | Agent 能做什么、不能做什么 | shell 权限、沙盒、危险操作确认 |
| 工具系统 | Agent 怎么调用外部能力 | MCP、内置工具、自定义工具、插件 |
| 技能复用 | 怎么避免每次从零教 Agent | Skills、SKILL.md、按需加载 |
| 上下文管理 | 怎么避免长任务越跑越乱 | 压缩、裁剪、摘要、最近轮次保留 |
| 记忆沉淀 | 怎么让经验跨会话保留下来 | MEMORY.md、SQLite、外部记忆服务 |
| 运行保障 | 出错后怎么恢复、怎么审计 | Hook、日志、检查点、错误分类 |

2026-05-28 补充入库的论文 **Agent Harness Engineering: A Survey** 把这 6 类抓手进一步体系化为 ETCLOVG 七层: 执行环境、工具接口、上下文、生命周期、可观测、验证评测、治理安全。也就是说,原来的“权限边界、工具系统、上下文管理、运行保障”可以继续保留为产品语言,但做方案评审时应升级为七层检查清单。

| ETCLOVG 层 | 对应产品问题 | 和原有 6 类抓手的关系 |
|---|---|---|
| Execution | Agent 在哪里安全动手 | 权限边界 + 沙箱 |
| Tooling | Agent 如何调用外部能力 | 工具系统 |
| Context | Agent 每一步看什么材料 | 上下文管理 + 记忆沉淀 |
| Lifecycle | 长任务如何开始、暂停、恢复、结束 | 运行保障 |
| Observability | 失败后能否复盘 | 运行保障 + 日志 |
| Verification | 结果是否独立验收 | 评测 / 测试门禁 |
| Governance | 谁能授权 Agent 做什么 | 权限边界 + 审计 |

## 和 Prompt / Context 的关系

Agent 系统可以粗略分三层:

1. Prompt Engineering: 说清楚“你是谁、要怎么做”。
2. Context Engineering: 管好“你现在应该看什么信息”。
3. Harness Engineering: 搭好“你在什么边界和流程里行动”。

中文社区的一个共识是: Prompt 只是入口,Context 决定可用度,Harness 决定能不能进生产。

## OpenAI 官方材料的补强

Codex 官方文章把 Harness Engineering 从概念进一步落到了真实产品系统:

| 官方样本 | 补强点 | 来源 |
|---|---|---|
| Codex 内部安全部署 | 沙箱、审批、网络策略、身份凭据、规则、托管配置和智能体原生日志共同构成企业控制面 | [在 OpenAI 内部安全运行 Codex](../raw/official-posts/codex/2026-05-08-在-openai-内部安全运行-codex.md) |
| Windows 沙箱 | 为了让 Agent 安全调用本机命令,需要操作系统级隔离、写入边界和网络边界 | [Windows 沙箱](../raw/official-posts/codex/2026-05-13-building-a-safe-effective-sandbox-to-enable-codex-on-windows.md) |
| Codex Harness 实验 | 当人类不直接写代码时,工程师的工作转向环境设计、任务拆解、反馈循环、可读日志和可观测性 | [Harness Engineering](../raw/official-posts/codex/2026-02-11-工程技术-在智能体优先的世界中利用-codex.md) |

## Qoder 官方材料的补强

Qoder 的材料把 Harness 进一步落到“任务运行时 + 知识工程 + 权限基础设施”:

| 官方样本 | 补强点 | 来源 |
|---|---|---|
| Qoder 1.0 | 把聊天升级为结构化 Task Runtime,把 Memory、Repo Wiki、Knowledge Cards 下沉到任务运行时 | [Qoder 1.0](../raw/official-posts/qoder/2026-05-15-以-Qoder-开发-Qoder9-个月-60个版本Qoder10-来了.md) |
| Qoder 早期 Harness 阐释 | 将 Prompt、Context、Harness 视为递进关系;Harness 负责让 Agent 跑得稳、跑得久、能自治 | [骑到 Agent 背上去](../raw/official-posts/qoder/2026-03-13-骑到-Agent-背上去从增强的上下文工程到驾驭工程.md) |
| 工程知识引擎 | 用 Commit Graph、RepoWiki、Memory、Code Graph、Agentic Search 让 Agent 从点状检索升级为立体工程感知 | [工程知识引擎](../raw/official-posts/qoder/2026-03-18-工程知识引擎Harness-Engineering体系下的工程知识底座.md) |
| Experts 专家团 | Leader Agent 拆任务并编排 DAG,不同专家使用独立上下文、工具集、执行约束和模型选择 | [Experts Harness](../raw/official-posts/qoder/2026-03-26-不是换了几个-Prompt-这么简单Experts专家团背后的-Harness-Engineering-工程实践.md) |
| 终端沙箱 | 风险判断、命令解析、危险命令名单、命令包裹、文件和网络边界共同保护本机执行 | [终端沙箱](../raw/official-posts/qoder/2026-05-11-终端沙箱Agent-Harness-的基础设施.md) |
| 自动权限模式 | 用硬规则和智能判断分层处理权限,低风险自动执行,高风险拒绝或交回用户 | [自动权限](../raw/official-posts/qoder/2026-05-14-Qoder-CLI-上线自动权限模式不用全程盯着AI-安全地帮你干活.md) |
| Qoder Hooks | 在 Prompt、工具调用、停止等节点注入脚本,实现阻断、上下文注入、质量门禁和审计 | [Hooks 详解](../raw/official-posts/qoder/2026-04-09-一文详解Qoder-Hooks-核心用法-及-8个实战案例解析.md) |

## 中文社区的特殊视角

中文社区更常用“驾驭”这个隐喻: 模型像一股强能力,但方向不稳定;Harness 像缰绳、护栏和仪表盘,让它在正确轨道上发力。

这带来一个产品启示: 面向中文开发者做 Agent 产品时,不要只讲“智能协作”,更要讲清楚“怎么控得住、怎么复用、怎么出错可恢复”。

## 代表性原文

- [QQ音乐 Harness Engineering 实践](../raw/harness-engineering/3_实战案例/003-QQ音乐Harness-Engineering实践.md)
- [OpenClaw 的 Prompt / Context / Harness 设计](../raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md)
- [Claude Code 的 Prompt / Context / Harness 设计](../raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md)
- [Hermes Agent 的自进化与 Harness 设计](../raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md)
- [CodeBuddy Skills 驱动实践](../raw/official-posts/codebuddy/2025-11-05-国内首家-CodeBuddy-Skills-驱动的-AI-编程实践.md)
- [CodeBuddy Hooks 探索实践](../raw/official-posts/codebuddy/2025-11-21-CodeBuddy-Code-Hooks-探索实践-Hooks-为你的-AI-配上随叫随到的管家.md)
- [CodeBuddy 斜杠命令 + Skills 团队实践](../raw/official-posts/codebuddy/2026-02-03-CodeBuddy-Code-团队实践斜杠命令-Skills-让发版流程自动化且可靠.md)
- [Qoder 终端沙箱](../raw/official-posts/qoder/2026-05-11-终端沙箱Agent-Harness-的基础设施.md)
- [Qoder 自动权限模式](../raw/official-posts/qoder/2026-05-14-Qoder-CLI-上线自动权限模式不用全程盯着AI-安全地帮你干活.md)
- [Qoder Hooks 详解](../raw/official-posts/qoder/2026-04-09-一文详解Qoder-Hooks-核心用法-及-8个实战案例解析.md)
- [Qoder 工程知识引擎](../raw/official-posts/qoder/2026-03-18-工程知识引擎Harness-Engineering体系下的工程知识底座.md)
- [Qoder Experts Harness](../raw/official-posts/qoder/2026-03-26-不是换了几个-Prompt-这么简单Experts专家团背后的-Harness-Engineering-工程实践.md)
- [腾讯云开发者: Harness 六大组件全解析](../raw/community-posts/tencent-cloud-developer/2026-04-01-一文讲透如何构建Harness六大组件全解析.md)
- [腾讯云开发者: Harness 即控制论](../raw/community-posts/tencent-cloud-developer/2026-04-17-一文讲透Harness-Engineering即控制论.md)
- [腾讯云开发者: 从 Prompt、Context 到 Harness](../raw/community-posts/tencent-cloud-developer/2026-05-20-从Prompt-Context到Harness工程的三次进化与终局之战.md)
- [腾讯云开发者: 生产级 Multi-Agent Harness 全拆解](../raw/community-posts/tencent-cloud-developer/2026-05-13-从零设计生产级-Multi-Agent-Harness架构评估记忆成本与-MCP-工具接入全拆解.md)
- [腾讯云开发者: 万字干货 Harness 工程化落地](../raw/community-posts/tencent-cloud-developer/2026-04-22-万字干货Harness-Engineering如何工程化落地.md)
- [腾讯云开发者: QQ 音乐 Harness 实践](../raw/community-posts/tencent-cloud-developer/2026-05-21-QQ音乐Harness-Engineering实践.md)

## 来源映射

| 结论 | 来源 |
|---|---|
| Harness 已落到权限、工具、技能、上下文、记忆、运行保障 6 类抓手 | `wiki/analysis/entity-scan.md` + `wiki/raw/harness-engineering/README.md` |
| OpenClaw 展示个人 Agent 的文件注入、Skills、记忆、心跳和沙盒组合 | `wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md` |
| Claude Code 展示工程任务的权限、Hook、子 Agent、压缩和记忆 | `wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md` |
| Hermes 展示自进化 Agent 的轨迹、Skill、训练反馈闭环 | `wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md` |
| CodeBuddy 展示 Skills、Commands、Hooks、Spec-Kit 与 Agent Teams 组合成团队流程资产 | `wiki/raw/official-posts/codebuddy/INDEX.md` + `wiki/entities/codebuddy.md` |
| Qoder 展示 Quest 任务运行时、团队知识引擎、终端沙箱、自动权限和 Hooks 组合成 Agent Harness | `wiki/raw/official-posts/qoder/INDEX.md` + `wiki/entities/qoder.md` |
| Qoder 早期补充材料把工程知识引擎和 Experts 专家团拆成更底层的 Harness 机制 | `wiki/raw/official-posts/qoder/2026-03-18-工程知识引擎Harness-Engineering体系下的工程知识底座.md` + `wiki/raw/official-posts/qoder/2026-03-26-不是换了几个-Prompt-这么简单Experts专家团背后的-Harness-Engineering-工程实践.md` |
| 腾讯云开发者群体把 Harness 等价为控制论的工程实现,工程纪律从写代码挪到了 scaffolding | `wiki/raw/community-posts/tencent-cloud-developer/2026-04-17-一文讲透Harness-Engineering即控制论.md` + `wiki/raw/community-posts/tencent-cloud-developer/2026-03-31-Harness-Engineering-来了SDD-还有意义吗.md` |
| 生产级 Multi-Agent 系统强调"让 Agent 出主意,让 Harness 拿决定",并把架构、评估、记忆、成本、安全列为五大模块 | `wiki/raw/community-posts/tencent-cloud-developer/2026-05-13-从零设计生产级-Multi-Agent-Harness架构评估记忆成本与-MCP-工具接入全拆解.md` + `wiki/raw/community-posts/tencent-cloud-developer/2026-04-08-4亿token买来5个教训让6个AI-Agent连写4天代码发生了什么.md` |
| 真实大仓 Monorepo 工程把"代码产出 = AI 能力 × 上下文质量"作为 Harness 落地公式 | `wiki/raw/community-posts/tencent-cloud-developer/2026-05-21-QQ音乐Harness-Engineering实践.md` |
| 阿里系作者把 AI Coding 率从 24.86% 拉到 90.54% 的工程闭环: AGENTS.md + Spec + 工具化环境 + 测试门禁 + 多 Agent 评审 | `wiki/raw/community-posts/aliyun-cloud-developer/2026-05-07-Harness-Engineering耗时一周我是如何将应用的AI-Coding率提升至90%的.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-21-从玩具到生产力用真实项目讲透-AI-Agent-的-Harness-Engineering.md` |
| Java / Spring 企业仓 Harness 必须先把 SDK / 中间件 / 业务组件工具化, AI 才会"听话" | `wiki/raw/community-posts/aliyun-cloud-developer/2026-05-21-都是-AI-Coding为什么-Java-体验差了一个量级五条方法论帮你构建自己的-Harness-环境.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-05-15-首个-Java-Harness-Framework-来了｜AgentScope-把-OpenClaw-带到企业分布式场景.md` |
| 阿里商旅差旅助手 / 淘宝闪购 / C 端 AIGC / OPC 增长四个真实业务样本把 Harness 坐到生产数字 | `wiki/raw/community-posts/aliyun-cloud-developer/2026-02-14-准确率提升至-90%阿里商旅基于-AgentScope-构建多智能体差旅助手最佳实践.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-03-27-Tair-短期记忆架构实践淘宝闪购-AI-Agent-的秒级响应记忆系统.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-05-26-Harness-Engineering-C-端-AIGC-内容生产自优化实践.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-05-25-让-AI-自己做增长基于OPC和Harness思想的自主增长系统探索.md` |
| 评估是 Harness 的反馈层: Anthropic 瑞士奶酪模型 + Look at your data 心法把"评测纪律"挂进 Harness | `wiki/raw/community-posts/agent-evaluation/2026-02-01-Anthropic-的AI-Agents评估体系瑞士奶酪模型.md` + `wiki/raw/community-posts/agent-evaluation/2026-01-24-跨越三年的评估Eval心法Look-at-your-data.md` |
| 评测集是 Harness 的试金石: 阿里云智能运维"输入/代码/资源/状态"四维评测集 + LLM-as-Judge + 元评估 | `wiki/raw/community-posts/agent-evaluation/2026-03-26-突破泛化瓶颈阿里云智能运维-Agent-评测体系实践.md` + `wiki/raw/community-posts/agent-evaluation/2026-05-15-面向智能导购的Agent评测实践.md` + `wiki/raw/community-posts/agent-evaluation/2026-02-05-自动化评测的九九归一——评测agent.md` |
| AWS 八件套基建框架: 开发→沙盒→记忆→MCP→身份→评估→可观测→安全 是云厂商视角下"Agent 系统该长什么样"的标准答案 | `wiki/raw/community-posts/aws-cloud-developer/INDEX.md` (8 篇连载) |
| Agent 可观测性必须超越 Metrics+Logs+Traces 三件套, 增加"决策原因/行为链条/结果质量"三层 | `wiki/raw/community-posts/aws-cloud-developer/2025-12-24-Agentic-AI实践指南｜秘籍七Agent可观测性评估.md` |
| Agentic AI 安全是分层防护: 通用应用安全 → 生成式 AI 安全 → Agentic AI 特有威胁(身份/工具操纵/记忆投毒) | `wiki/raw/community-posts/aws-cloud-developer/2025-12-25-Agentic-AI实践指南｜秘籍八Agent应用隐私与安全.md` + `wiki/raw/community-posts/aws-cloud-developer/2025-12-22-Agentic-AI实践指南｜秘籍五Agent身份认证与授权管理.md` |
| AGENTWAY 十条原则 = Harness Engineering 高阶骨架: 把模型当不稳定部件 / Prompt 是控制面 / Query loop 是心跳 / 工具是受管接口 / 上下文是工作内存 / 错误路径就是主路径 / 恢复目标是继续工作 / 多代理把不确定性分区 / 验证必须独立 / 团队制度比个人技巧重要 | `wiki/raw/books/agentway/2026-04-01-agentway-claude-code-harness-engineering-design-guide.md` |
| Claude Code vs Codex 的两种 Harness 路线: 运行时优先 (秩序住在运行时) vs 制度层优先 (规矩住在系统外沿);Claude Code 走"纪律内化",Codex 走"制度外化" | `wiki/raw/books/agentway/2026-04-01-agentway-claude-code-vs-codex-comparative-harness-notes.md` |
| Agent Harness Engineering: A Survey 将 Harness 定义为独立系统层,并提出 ETCLOVG 七层分类法 | `wiki/raw/papers/agent-harness-engineering-survey/2026-05-16-agent-harness-engineering-a-survey.md` |
| 2026-05-28 这批 22 篇中文文章把 Harness 的社区讨论集中到规则入口、上下文缓存、SDD 关系、业务落地和失败复盘 | `wiki/topics/harness-2026-05-28-supplement-synthesis.md` |

## 相关页面

- [ETCLOVG Agent Harness 七层分类法](etclovg-agent-harness-taxonomy.md)
- [Prompt / Context / Harness 三层框架](prompt-context-harness.md)
- [渐进式披露](progressive-disclosure.md)
- [Spec 驱动的 Agent 开发](spec-driven-agent-development.md)
- [CodeBuddy](../entities/codebuddy.md)
- [Qoder](../entities/qoder.md)
- [Quest 模式的 Agent 开发](quest-mode-agent-development.md)
- [Codex](../entities/codex.md)
- [OpenClaw / Claude Code / Hermes 运行架构对比](../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)
