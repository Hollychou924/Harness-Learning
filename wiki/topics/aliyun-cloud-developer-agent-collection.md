---
id: aliyun-cloud-developer-agent-collection
type: topic
status: active
updated: 2026-05-26
sources:
  - wiki/raw/community-posts/aliyun-cloud-developer/INDEX.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-05-07-Harness-Engineering耗时一周我是如何将应用的AI-Coding率提升至90%的.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-04-21-从玩具到生产力用真实项目讲透-AI-Agent-的-Harness-Engineering.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-04-03-Qoder-工程实践Harness-Engineering-指南.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-04-20-Qoder-CLI-+-Harness-Engineering-实战构建-7×24h-无人值守用户反馈自动处理系统.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-05-21-都是-AI-Coding为什么-Java-体验差了一个量级五条方法论帮你构建自己的-Harness-环境.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-05-15-首个-Java-Harness-Framework-来了｜AgentScope-把-OpenClaw-带到企业分布式场景.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-04-29-Harness-Engineering实践做了一个平台让AI一晚上自动评测和优化你的系统.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-04-09-SDD-RIPER-团队落地指南如何让整个团队在一周内跑通大模型编程.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-04-02-2026-年-AI-编码的渐进式-Spec实战指南.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-05-09-5-人-7-天干完-20-人数周的活Spec-Driven-Development-如何重新定义-AI-编程.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-04-07-「纯干货」几万字都讲不明白的Memory架构与思考.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-03-26-阿里云-Tablestore-基于-Mem0-为-OpenClaw-构建记忆系统最佳实践.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-03-27-Tair-短期记忆架构实践淘宝闪购-AI-Agent-的秒级响应记忆系统.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-04-01-Agent-Skills打通可复用专业领域知识的最后一公里.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-04-30-Qoder-Skills-完全指南从零开始让-AI-按你的标准执行.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-05-12-Agent-Skill规范构建与设计模式.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-04-27-工作流的-Skill-怎么写从-7-个顶级-Skill-中提炼的模式与最佳实践.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-05-11-Agent-烧钱如流水Agentic-OS-ANOLISA-帮你逐笔看清-Token-账单.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-05-22-代码一旦生产出来首先是负债-——-一个CIO-的AI效能实践复盘.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-05-08-Agent-时代的生产力悖论当协作本身成为最大的瓶颈.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-04-30-Agent-开发范式演进从环境工程出发简化多源实时上下文.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-05-06-一个文件让-AI-Coding-效率翻倍AGENTS.md-实践指南.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-02-14-准确率提升至-90%阿里商旅基于-AgentScope-构建多智能体差旅助手最佳实践.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-05-26-Harness-Engineering-C-端-AIGC-内容生产自优化实践.md
  - wiki/raw/community-posts/aliyun-cloud-developer/2026-05-25-让-AI-自己做增长基于OPC和Harness思想的自主增长系统探索.md
owners: ["zhouhao"]
when_to_load: "讨论 Harness Engineering、SDD/Spec、Multi-Agent、Skills、Memory、AGENTS.md、阿里系/通义/Qoder/Lingma 实践和企业 AI Coding 落地时加载"
---

# 阿里云开发者 Agent / Harness 合集 (59 篇)

> 一句话: 这 59 篇是阿里系工程师围绕 Agent 与 Harness Engineering 的工程实践合集,样本来自阿里商旅、淘宝闪购、Tablestore、Tair、Qoder、AgentScope、CIO 复盘、C 端 AIGC、增长系统等真实业务,主题覆盖从概念入门到 Multi-Agent、Skills、Memory、Spec、AGENTS.md、Token 治理和企业 Java AI Coding 的方方面面。它们和"腾讯云开发者 39 篇"互为镜像,合在一起构成中文社区"Harness 怎么落地"的最完整一手论据。

## 1. 全集结构

按主题分了 8 类。强烈建议从 A 和 B 入手,再按需要看后面的拆解和实践。

| # | 主题分类 | 代表文章 | 读完能拿到什么 |
|---|---|---|---|
| A | 概念入门 / Agent 范式演进 | [AI Agent 系列: 什么是 ReAct Agent](../raw/community-posts/aliyun-cloud-developer/2026-02-24-AI-Agent系列｜什么是-ReAct-Agent.md), [Agent vs 传统编程 vs Workflow](../raw/community-posts/aliyun-cloud-developer/2026-02-25-AI-Agent系列｜深入了解智能体工作流核心Agent-vs-传统编程-vs-Workflow-的本质区别.md), [Function Calling / MCP / Skills 本质差异](../raw/community-posts/aliyun-cloud-developer/2026-02-26-AI-Agent系列｜深入解析Function-CallingMCP和Skills的本质差异与最佳实践.md), [Agent 核心技术概念演变](../raw/community-posts/aliyun-cloud-developer/2026-05-22-Agent核心技术概念与范式发生了哪些演变以及背后的思考.md), [Agent 从一问一答到自主执行](../raw/community-posts/aliyun-cloud-developer/2026-05-13-Agent从一问一答到自主执行面临哪些挑战.md), [Agent / Skills / Teams 架构演进](../raw/community-posts/aliyun-cloud-developer/2026-03-17-AgentSkillsTeams-架构演进过程及技术选型之道.md) | 先把 ReAct / Workflow / Agent / Skills / MCP / Function Calling 区分清楚,再谈实践 |
| B | Harness 工程化落地 | [Harness 一周把 AI 代码率拉到 90%](../raw/community-posts/aliyun-cloud-developer/2026-05-07-Harness-Engineering耗时一周我是如何将应用的AI-Coding率提升至90%的.md), [从玩具到生产力](../raw/community-posts/aliyun-cloud-developer/2026-04-21-从玩具到生产力用真实项目讲透-AI-Agent-的-Harness-Engineering.md), [Qoder 工程实践 Harness 指南](../raw/community-posts/aliyun-cloud-developer/2026-04-03-Qoder-工程实践Harness-Engineering-指南.md), [Qoder CLI + Harness 7×24h 自动处理用户反馈](../raw/community-posts/aliyun-cloud-developer/2026-04-20-Qoder-CLI-+-Harness-Engineering-实战构建-7×24h-无人值守用户反馈自动处理系统.md), [Java AI Coding 五条方法论](../raw/community-posts/aliyun-cloud-developer/2026-05-21-都是-AI-Coding为什么-Java-体验差了一个量级五条方法论帮你构建自己的-Harness-环境.md), [让 AI 自己做增长 OPC + Harness](../raw/community-posts/aliyun-cloud-developer/2026-05-25-让-AI-自己做增长基于OPC和Harness思想的自主增长系统探索.md), [C 端 AIGC 内容生产自优化](../raw/community-posts/aliyun-cloud-developer/2026-05-26-Harness-Engineering-C-端-AIGC-内容生产自优化实践.md), [Harness 驾驭工程是 AI 平权的必经之路](../raw/community-posts/aliyun-cloud-developer/2026-03-30-Harness驾驭工程是AI平权的必经之路.md), [Harness 平台 一晚自动评测优化](../raw/community-posts/aliyun-cloud-developer/2026-04-29-Harness-Engineering实践做了一个平台让AI一晚上自动评测和优化你的系统.md) | 真实企业项目里 Harness 是如何把 AI 代码率从 24.86% 拉到 90.54% 的;Java / 增长 / AIGC 三种业务的差异化做法 |
| C | Spec / SDD / 流程方法论 | [SDD-RIPER 团队一周跑通](../raw/community-posts/aliyun-cloud-developer/2026-04-09-SDD-RIPER-团队落地指南如何让整个团队在一周内跑通大模型编程.md), [渐进式 Spec 实战](../raw/community-posts/aliyun-cloud-developer/2026-04-02-2026-年-AI-编码的渐进式-Spec实战指南.md), [SDD 5 人 7 天干完 20 人活](../raw/community-posts/aliyun-cloud-developer/2026-05-09-5-人-7-天干完-20-人数周的活Spec-Driven-Development-如何重新定义-AI-编程.md), [告别氛围编程 Harness + SDD](../raw/community-posts/aliyun-cloud-developer/2026-05-07-告别氛围编程基于-Harness-治理和-SDD-的团队级-AI-研发范式演进与实践.md), [一个文件让 AI Coding 效率翻倍 AGENTS.md](../raw/community-posts/aliyun-cloud-developer/2026-05-06-一个文件让-AI-Coding-效率翻倍AGENTS.md-实践指南.md), [Agent 开发范式演进 从环境工程出发](../raw/community-posts/aliyun-cloud-developer/2026-04-30-Agent-开发范式演进从环境工程出发简化多源实时上下文.md) | Spec / RIPER / 渐进式 Spec / AGENTS.md 五个落地形态;团队怎么一周跑通大模型编程 |
| D | Multi-Agent 架构 / AgentScope | [AgentScope 阿里商旅多智能体差旅助手 90%](../raw/community-posts/aliyun-cloud-developer/2026-02-14-准确率提升至-90%阿里商旅基于-AgentScope-构建多智能体差旅助手最佳实践.md), [首个 Java Harness Framework AgentScope](../raw/community-posts/aliyun-cloud-developer/2026-05-15-首个-Java-Harness-Framework-来了｜AgentScope-把-OpenClaw-带到企业分布式场景.md), [Spring AI 从 0 到 1](../raw/community-posts/aliyun-cloud-developer/2026-04-22-AI实践｜基于-Spring-AI-从0到1构建-AI-Agent.md), [构建会思考的测试 Agent](../raw/community-posts/aliyun-cloud-developer/2026-03-11-构建会思考的测试Agent从自动化到自主智能的演进.md), [浏览器自动化 GUI → OpenCLI](../raw/community-posts/aliyun-cloud-developer/2026-04-14-浏览器自动化从GUI到OpenCLI.md), [一个人一台 Mac 六个 AI Agent](../raw/community-posts/aliyun-cloud-developer/2026-04-10-OpenClaw-实战一个人一台-Mac六个-AI-Agent-—-从能聊天到能干活的工程实战.md), [从聊天窗口到多 Agent 控制台](../raw/community-posts/aliyun-cloud-developer/2026-04-16-从聊天窗口到多-Agent-控制台一次-AI-编程协作范式的转移.md) | 阿里商旅 / 淘宝闪购两个生产业务的多 Agent 架构;Java AgentScope 把 Harness 带到分布式场景 |
| E | Skills 与渐进式披露 | [Agent Skills 打通最后一公里](../raw/community-posts/aliyun-cloud-developer/2026-04-01-Agent-Skills打通可复用专业领域知识的最后一公里.md), [Qoder Skills 完全指南](../raw/community-posts/aliyun-cloud-developer/2026-04-30-Qoder-Skills-完全指南从零开始让-AI-按你的标准执行.md), [Agent Skill 规范、构建与设计模式](../raw/community-posts/aliyun-cloud-developer/2026-05-12-Agent-Skill规范构建与设计模式.md), [工作流的 Skill 怎么写](../raw/community-posts/aliyun-cloud-developer/2026-04-27-工作流的-Skill-怎么写从-7-个顶级-Skill-中提炼的模式与最佳实践.md), [Skill Factory 三天手搓技能工厂](../raw/community-posts/aliyun-cloud-developer/2026-05-14-Skill-Factory三天手搓面向Harness设计的技能工厂附AI-coding实践.md), [重新定义 Skill 开发](../raw/community-posts/aliyun-cloud-developer/2026-05-18-重新定义Skill开发保姆级教程&一站式开发助手发布.md), [从 Agent 到 Skills 范式转变](../raw/community-posts/aliyun-cloud-developer/2026-03-30-学习笔记从-Agent-到-Skills-—-AI-智能体架构的范式转变.md) | Skills 怎么写、怎么规范、怎么自己生成 Skills(Skill Factory) |
| F | Memory 与上下文 | [Memory 架构万字长文](../raw/community-posts/aliyun-cloud-developer/2026-04-07-「纯干货」几万字都讲不明白的Memory架构与思考.md), [Tablestore + Mem0 为 OpenClaw 构建记忆系统](../raw/community-posts/aliyun-cloud-developer/2026-03-26-阿里云-Tablestore-基于-Mem0-为-OpenClaw-构建记忆系统最佳实践.md), [Tair 短期记忆 淘宝闪购秒级响应](../raw/community-posts/aliyun-cloud-developer/2026-03-27-Tair-短期记忆架构实践淘宝闪购-AI-Agent-的秒级响应记忆系统.md), [OpenClaw 长期记忆 优秀管线与玄学效果](../raw/community-posts/aliyun-cloud-developer/2026-04-15-OpenClaw长期记忆优秀管线与玄学效果.md), [LLM Wiki / Obsidian-Wiki / GBrain 自组织自进化](../raw/community-posts/aliyun-cloud-developer/2026-05-13-深度解析LLM-Wiki-Obsidian-Wiki-GBrainAgent时代知识的自组织与自进化.md) | Memory 不是写一个 KV 存储,要分长短期、分层、可观测;Tablestore/Tair/Mem0 三种真实工程方案 |
| G | OpenClaw / Claude Code / Hermes / Qoder 源码拆解 | [OpenClaw 技术架构 上](../raw/community-posts/aliyun-cloud-developer/2026-03-19-深入理解OpenClaw技术架构与实现原理上.md), [OpenClaw 技术架构 下](../raw/community-posts/aliyun-cloud-developer/2026-03-26-深入理解OpenClaw技术架构与实现原理下.md), [深度解析 OpenClaw Prompt/Context/Harness](../raw/community-posts/aliyun-cloud-developer/2026-04-13-深度解析-OpenClaw-在-Prompt-Context-Harness-三个维度中的设计哲学与实践.md), [OpenClaw 越用越好用本质就是 md 文件](../raw/community-posts/aliyun-cloud-developer/2026-04-03-OpenClaw-为什么越用越好用本质就是一堆-md-文件.md), [OpenClaw 自我迭代笔记](../raw/community-posts/aliyun-cloud-developer/2026-03-27-OpenClaw构建自我迭代AI助手笔记.md), [Claude Code 源码拆解 启动到多 Agent 扩展层](../raw/community-posts/aliyun-cloud-developer/2026-04-15-Claude-Code-源码拆解从启动到多-Agent-扩展层.md), [深度解析 Claude Code Prompt/Context/Harness](../raw/community-posts/aliyun-cloud-developer/2026-04-20-深度解析-Claude-Code-在-Prompt-Context-Harness-的设计与实践.md), [赛博鸡生蛋 7h 用 Vibe Coding 一个 Mini-Claude](../raw/community-posts/aliyun-cloud-developer/2026-04-17-赛博鸡生蛋7小时用Claude-Vibe-Coding一个Mini-Claude.md), [Hermes Self-Improving 源码](../raw/community-posts/aliyun-cloud-developer/2026-04-23-深入源码Hermes-Agent-如何实现-Self-Improving.md), [深度解析 Hermes Prompt/Context/Harness](../raw/community-posts/aliyun-cloud-developer/2026-04-24-深度解析-Hermes-Agent-如何实现自进化及其-Prompt-Context-Harness-的设计实践.md), [CoPaw 源码架构](../raw/community-posts/aliyun-cloud-developer/2026-03-31-CoPaw深度解析源码架构和功能实践.md), [揭秘 Claude Code 与 Qoder CLI 实战](../raw/community-posts/aliyun-cloud-developer/2026-02-28-揭秘-Claude-Code-前沿技巧与-Qoder-CLI-日常开发实战.md), [工程知识引擎 Harness 工程知识底座](../raw/community-posts/aliyun-cloud-developer/2026-03-19-工程知识引擎Harness-Engineering体系下的工程知识底座.md) | 三大开源 Agent (OpenClaw / Claude Code / Hermes) 的源码级双视角(腾讯系 + 阿里系)拆解 |
| H | 治理 / 成本 / 团队管理 / 反思 | [Agent 烧钱如流水 Agentic OS ANOLISA Token 账单](../raw/community-posts/aliyun-cloud-developer/2026-05-11-Agent-烧钱如流水Agentic-OS-ANOLISA-帮你逐笔看清-Token-账单.md), [代码一旦生产出来首先是负债](../raw/community-posts/aliyun-cloud-developer/2026-05-22-代码一旦生产出来首先是负债-——-一个CIO-的AI效能实践复盘.md), [Agent 时代的生产力悖论](../raw/community-posts/aliyun-cloud-developer/2026-05-08-Agent-时代的生产力悖论当协作本身成为最大的瓶颈.md), [做 AI 产品三年复盘](../raw/community-posts/aliyun-cloud-developer/2026-03-12-做AI产品三年复盘我看到的变与不变.md), [AI 数据工程师返璞归真](../raw/community-posts/aliyun-cloud-developer/2026-04-08-AI数据工程师在应用中如何返璞归真.md), [你不知道的 Agent 原理架构与工程实践](../raw/community-posts/aliyun-cloud-developer/2026-04-28-你不知道的-Agent原理架构与工程实践.md) | 真实落地中"Token 谁来付钱、代码生产即负债、协作成为瓶颈"等被忽视的代价 |

## 2. 跨文章共识 (与腾讯云开发者 39 篇互证)

把这批 59 篇的核心论点整理成 12 条共识表,可以直接当 E1-E9 写作论据用,并和上一批形成"双源印证"。

| 共识 | 出处样本 | 含义 |
|---|---|---|
| Prompt 工程不能解决企业级 AI Coding,必须配 Harness | [Harness 一周 90%](../raw/community-posts/aliyun-cloud-developer/2026-05-07-Harness-Engineering耗时一周我是如何将应用的AI-Coding率提升至90%的.md), [从玩具到生产力](../raw/community-posts/aliyun-cloud-developer/2026-04-21-从玩具到生产力用真实项目讲透-AI-Agent-的-Harness-Engineering.md) | 单仓 24.86% → 90.54% AI 代码率,关键不是模型升级,而是把 Harness 体系搭起来 |
| 传统软工管"确定性",Harness 管"非确定性" | [从玩具到生产力 §一](../raw/community-posts/aliyun-cloud-developer/2026-04-21-从玩具到生产力用真实项目讲透-AI-Agent-的-Harness-Engineering.md) | Harness 的本质是把"概率引擎"嵌进"确定性流水线"的物理控制面 |
| Agent 架构边界矩阵: 四象限只看场景适配 | [从玩具到生产力 §二](../raw/community-posts/aliyun-cloud-developer/2026-04-21-从玩具到生产力用真实项目讲透-AI-Agent-的-Harness-Engineering.md) | X=静态/动态执行,Y=隐式/显式状态;Harness 在第一象限,无状态链/Prompt 驱动/传统管道各有自己的位置 |
| 程序员从"写代码的人"迁移到"控盘的人" | [从玩具到生产力 §四](../raw/community-posts/aliyun-cloud-developer/2026-04-21-从玩具到生产力用真实项目讲透-AI-Agent-的-Harness-Engineering.md), [代码一旦生产出来首先是负债](../raw/community-posts/aliyun-cloud-developer/2026-05-22-代码一旦生产出来首先是负债-——-一个CIO-的AI效能实践复盘.md) | 想放权先建 Harness;放权之后角色转向定义目标、卡边界、控节奏、做验收 |
| Java / 企业 Monorepo 的 Harness 必须先工具化环境 | [Java 五条方法论](../raw/community-posts/aliyun-cloud-developer/2026-05-21-都是-AI-Coding为什么-Java-体验差了一个量级五条方法论帮你构建自己的-Harness-环境.md), [Harness 一周 90%](../raw/community-posts/aliyun-cloud-developer/2026-05-07-Harness-Engineering耗时一周我是如何将应用的AI-Coding率提升至90%的.md) | SDK / 中间件 / 业务组件先封装成 AI 可调用的能力,Agent 才会"听话" |
| Multi-Agent 决策权在 Harness 不在 Planner | [AgentScope 差旅助手 90%](../raw/community-posts/aliyun-cloud-developer/2026-02-14-准确率提升至-90%阿里商旅基于-AgentScope-构建多智能体差旅助手最佳实践.md), [Java Harness Framework](../raw/community-posts/aliyun-cloud-developer/2026-05-15-首个-Java-Harness-Framework-来了｜AgentScope-把-OpenClaw-带到企业分布式场景.md) | 与腾讯系 Multi-Agent Harness 全拆解互相印证 |
| Memory 必须分层: 短期/中期/长期 + 多源 | [Memory 万字长文](../raw/community-posts/aliyun-cloud-developer/2026-04-07-「纯干货」几万字都讲不明白的Memory架构与思考.md), [Tair 短期记忆](../raw/community-posts/aliyun-cloud-developer/2026-03-27-Tair-短期记忆架构实践淘宝闪购-AI-Agent-的秒级响应记忆系统.md), [Tablestore + Mem0](../raw/community-posts/aliyun-cloud-developer/2026-03-26-阿里云-Tablestore-基于-Mem0-为-OpenClaw-构建记忆系统最佳实践.md) | Tair 走秒级响应,Tablestore 走长期持久化,Mem0 做语义记忆中间层 |
| Skills 是 Harness 的能力载体,Skill Factory 让 Skill 自生 Skill | [Skill Factory](../raw/community-posts/aliyun-cloud-developer/2026-05-14-Skill-Factory三天手搓面向Harness设计的技能工厂附AI-coding实践.md), [Agent Skill 规范](../raw/community-posts/aliyun-cloud-developer/2026-05-12-Agent-Skill规范构建与设计模式.md), [Skills 打通最后一公里](../raw/community-posts/aliyun-cloud-developer/2026-04-01-Agent-Skills打通可复用专业领域知识的最后一公里.md) | 与腾讯系"Skill 自训练 8 阶段 Loop"形成完整闭环视角 |
| AGENTS.md 是 AI 唯一能看到的世界 | [AGENTS.md 实践指南](../raw/community-posts/aliyun-cloud-developer/2026-05-06-一个文件让-AI-Coding-效率翻倍AGENTS.md-实践指南.md), [OpenClaw 越用越好用本质就是 md 文件](../raw/community-posts/aliyun-cloud-developer/2026-04-03-OpenClaw-为什么越用越好用本质就是一堆-md-文件.md) | 与腾讯系"Agent 看不到的就不存在"互相印证;一个 md 文件值不值钱由它写没写进决策记忆决定 |
| Spec 不是巨型文档,而是渐进式契约 | [渐进式 Spec 实战](../raw/community-posts/aliyun-cloud-developer/2026-04-02-2026-年-AI-编码的渐进式-Spec实战指南.md), [SDD 5 人 7 天 20 人活](../raw/community-posts/aliyun-cloud-developer/2026-05-09-5-人-7-天干完-20-人数周的活Spec-Driven-Development-如何重新定义-AI-编程.md), [SDD-RIPER 团队一周](../raw/community-posts/aliyun-cloud-developer/2026-04-09-SDD-RIPER-团队落地指南如何让整个团队在一周内跑通大模型编程.md) | 与腾讯系"SPEC 5 个失败模式"互补,给出"如何跑通"的正面样本 |
| Agent 的最大成本不是 Token,是协作成本 | [生产力悖论](../raw/community-posts/aliyun-cloud-developer/2026-05-08-Agent-时代的生产力悖论当协作本身成为最大的瓶颈.md), [Token 账单 ANOLISA](../raw/community-posts/aliyun-cloud-developer/2026-05-11-Agent-烧钱如流水Agentic-OS-ANOLISA-帮你逐笔看清-Token-账单.md), [代码即负债](../raw/community-posts/aliyun-cloud-developer/2026-05-22-代码一旦生产出来首先是负债-——-一个CIO-的AI效能实践复盘.md) | "效率提升 N 倍"必须扣除审查、协作和后续维护成本 |
| 企业级 Harness 必须有评测体系,且评测自身需要再评测(元评估) | [Harness 自动评测平台](../raw/community-posts/aliyun-cloud-developer/2026-04-29-Harness-Engineering实践做了一个平台让AI一晚上自动评测和优化你的系统.md), [测试 Agent 自主智能演进](../raw/community-posts/aliyun-cloud-developer/2026-03-11-构建会思考的测试Agent从自动化到自主智能的演进.md) | 与腾讯系"4 亿 token 5 教训"互印,Evaluator 必须有 Benchmark + 元评估 |

## 3. 对已有 wiki 页的支撑

| 已有页面 | 本批新增的支撑 |
|---|---|
| [Harness Engineering](../concepts/harness-engineering.md) | 阿里商旅 / 淘宝闪购 / Java 单仓 24.86% → 90.54% / C 端 AIGC / OPC 增长系统 5 个真实业务样本,把 Harness 从概念坐到生产数字 |
| [渐进式披露](../concepts/progressive-disclosure.md) | Agent Skills 系列 + Skill Factory + Qoder Skills 完全指南,补强"Skill 怎么写、怎么规范、怎么自动生成" |
| [Spec 驱动的 Agent 开发](../concepts/spec-driven-agent-development.md) | 渐进式 Spec、SDD-RIPER、AGENTS.md、5 人 7 天 SDD 四个落地样本 |
| [Agent 评测体系](agent-evaluation-system.md) | 评审能力的"元评估"框架: Benchmark + 三层评审 + 快速失败 + 评分体系 + 优化闭环;一个平台一晚上自动评测优化 |
| [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md) | Tablestore + Mem0 / Tair / Memory 万字三套记忆方案,把 Context 层从理论坐到工程 |
| [OpenClaw / Claude Code / Hermes 三篇产品拆解沉淀](openclaw-claude-code-hermes-comparison.md) | 阿里系作者的源码级双视角拆解,与腾讯系互相印证 |
| [Harness Engineering 中文社区 66 篇沉淀](harness-engineering-community-synthesis.md) | 中文社区合计已扩展到 100+ 篇双源材料 |
| [腾讯云开发者 Agent / Harness 合集](tencent-cloud-developer-agent-harness-collection.md) | 阿里系 vs 腾讯系双源对照, 共识更稳, 分歧更清晰 |

## 4. 阿里系视角与腾讯系视角的对照

| 维度 | 腾讯云开发者 (39 篇) 偏向 | 阿里云开发者 (59 篇) 偏向 |
|---|---|---|
| 落地业务 | QQ 音乐、IMA 知识库、内部 JK Launcher 等中后台与 SaaS 工具 | 阿里商旅差旅助手、淘宝闪购、CIO 复盘、C 端 AIGC、增长系统等 To-C/To-B 大流量业务 |
| 框架 | 偏 OpenClaw、Claude Code、Hermes 三大开源框架的源码拆解 | 偏 AgentScope (Java) + 自研 Harness + Qoder + Spring AI |
| 主问题 | "理念已通,落地第一步做什么" | "已经在落地,如何把代码率从 25% 拉到 90%" |
| 工具基础设施 | Hooks、AGENTS.md 目录、Multi-Agent Harness 五模块 | 环境工具化、SDK 工具化、Skill Factory、AgentScope 分布式、ANOLISA Token 账单 |
| 评测视角 | 4 亿 token 教训(负样本) + Multi-Agent Harness 评测模块图 | 评审 Agent 元评估 Benchmark + 三层评审 + 快速失败 + 19 轮自进化 |
| 反思角度 | "推翻完美架构,回到提示词本质" | "代码即负债;协作是最大瓶颈;先建 Harness 才能放权" |

## 5. 对车载小爱 / DeepSeek 桌面端 Agent 的产品启示

1. AI 代码率有 25% → 90% 这种真实跨度,但跨度不来自模型,而来自 AGENTS.md / Spec / 工具化环境 / 测试门禁 / 多 Agent 评审五件套是否齐了。
2. 多 Agent 不是 Demo,要落地必须先解决: Token 账单、状态管理、可追溯日志、人工接管点四件事;阿里 ANOLISA / 腾讯 Multi-Agent 五模块都给了图。
3. Memory 至少要分短期(秒级响应,Tair 路线)、中期(语义召回,Mem0 路线)、长期(持久化与索引,Tablestore 路线)三层,不能一把 KV 通用。
4. Skill 不是写一次就能用,要有 Skill Factory + 规范 + 评测 + 元评估,否则会随业务腐烂。
5. 评测 Agent 必须能"评评测的能力": 静态分析 + 静态质量 + 动态运行三层,Benchmark 用 code snippets + project 双层数据集,且要"快速失败优先"。
6. 程序员转控盘者是中文社区的共识,产品文案、上手引导、能力暴露和审计都要顺这个迁移走,而不是继续把用户当作"敲代码的人"。

## 6. 来源与覆盖账本

- 索引: [community-posts/aliyun-cloud-developer/INDEX.md](../raw/community-posts/aliyun-cloud-developer/INDEX.md)
- 覆盖账本: [阿里云开发者公众号 59 篇账本](../review/ingest-coverage/2026-05-26-aliyun-cloud-developer-wechat-posts.md)

## 7. 相关页面

- [Harness Engineering](../concepts/harness-engineering.md)
- [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md)
- [渐进式披露](../concepts/progressive-disclosure.md)
- [Spec 驱动的 Agent 开发](../concepts/spec-driven-agent-development.md)
- [Agent 评测体系](agent-evaluation-system.md)
- [OpenClaw / Claude Code / Hermes 三篇产品拆解沉淀](openclaw-claude-code-hermes-comparison.md)
- [腾讯云开发者 Agent / Harness 合集](tencent-cloud-developer-agent-harness-collection.md)
- [Harness Engineering 中文社区 66 篇沉淀](harness-engineering-community-synthesis.md)
