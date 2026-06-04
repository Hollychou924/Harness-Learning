---
id: harness-2026-05-28-supplement-synthesis
type: topic
status: active
updated: 2026-05-28
sources:
  - wiki/raw/papers/agent-harness-engineering-survey/2026-05-16-agent-harness-engineering-a-survey.md
  - wiki/raw/community-posts/harness-2026-05-28-supplement/
owners: ["zhouhao"]
when_to_load: "讨论 2026-05-28 这批 Harness 论文与中文文章补充材料时加载"
---

# 2026-05-28 Agent Harness 论文与中文文章补充沉淀

> 范围: 1 篇学术论文主页 + 22 篇微信文章。
> 用途: 把 Harness 从“社区热词”升级为“七层产品检查清单 + 失败复盘 + 落地方法论”。

## 总体判断

这批材料说明 Harness Engineering 已经进入第二阶段: 第一阶段是在说“提示词不够,需要外壳”;第二阶段开始回答“外壳到底由哪些模块组成、怎么验收、哪里最容易失败”。

最重要的新增材料是论文 Agent Harness Engineering: A Survey。它提出 ETCLOVG 七层分类法,把 Harness 拆成执行环境、工具接口、上下文、生命周期、可观测、验证评测、治理安全。中文文章则从另外一面补齐了实践经验: 规则入口、缓存命中、上下文治理、SDD 关系、业务落地和失败反模式。

## 本批材料分布

| 类型 | 数量 |
|---|---:|
| 学术综述 / 全景框架 | 1 |
| 方法论 / 搭建路径 | 3 |
| 趋势观点 / 市场表达 | 4 |
| 失败复盘 / 风险清单 | 6 |
| 上下文 / 缓存 | 3 |
| 业务实践 / 落地案例 | 3 |
| 概念比较 / 取舍 | 2 |

## 6 条共识

1. Harness 是系统工程,不是提示词包装。论文给出七层框架,中文文章反复用“壳”“操作系统”“马鞍”等说法表达同一件事: 模型只是能力来源,产品可靠性来自模型外面的执行秩序。
2. 规则要进入执行入口,不能只写在说明书里。多篇踩坑文都指向同一问题: 规则如果不能影响任务启动、工具调用、结果验收,就只是文档。
3. 上下文和缓存是长任务稳定性的底座。Context 价值、100% Cache 命中、百万行代码场景这些文章共同说明,材料怎么给、怎么复用、怎么压缩,直接决定 Agent 是否稳定。
4. SDD 和 Harness 是互补关系。SDD 更偏任务前的需求约定,Harness 更偏任务中的执行环境和验收纪律。
5. 失败复盘要沉淀为产品清单。“死亡陷阱”“凌晨三点项目炸了”“翻车”等文章虽然表达夸张,但对应的都是权限、状态、上下文、工具、验收、接管这些真实检查项。
6. 评测必须内置在 Harness 中。ETCLOVG 把 Verification 单列一层,说明评测不是后验打分,而是 Agent 产品从设计阶段就要内置的能力。

## 对现有 wiki 的增量

| 位置 | 本批补强 |
|---|---|
| [ETCLOVG 七层分类法](../concepts/etclovg-agent-harness-taxonomy.md) | 新增七层检查清单 |
| [Harness Engineering](../concepts/harness-engineering.md) | 从 6 类抓手升级为可映射七层 |
| [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md) | 明确 ETCLOVG 是 Harness 层的展开 |
| [Agent Harness 设计范式演进](../timelines/agent-harness-design-evolution.md) | 增加 2026-05-16 学术体系化节点 |
| [Agent 评测体系](agent-evaluation-system.md) | 补强“轨迹进入失败归因和回归检查”的视角 |

## 本批文章清单

| # | 原文 | 来源 / 作者 | 发布时间 | 类型 | 卡片 | 状态 |
|---:|---|---|---|---|---|---|
| 1 | [刚刚，一篇最全Agent Harness综述来了！](../raw/community-posts/harness-2026-05-28-supplement/2026-05-28-刚刚一篇最全Agent-Harness综述来了.md) | DataFunTalk / Datawhale | 2026/05/28 13:00:00 | 学术综述 / 全景框架 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/刚刚一篇最全Agent-Harness综述来了.md) | 已沉淀 |
| 2 | [Harness 完全指南：harness 是一切工作的核心（1.3万字）](../raw/community-posts/harness-2026-05-28-supplement/2026-05-15-Harness-完全指南harness-是一切工作的核心13万字.md) | 李自然说 / 李自然 | 2026/05/15 08:35:24 | 方法论 / 搭建路径 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/Harness-完全指南harness-是一切工作的核心13万字.md) | 已沉淀 |
| 3 | [一文读懂Harness Engineering：从14篇工程文章中，寻找那个让AI不再离经叛道的壳｜Hao好聊趋势](../raw/community-posts/harness-2026-05-28-supplement/2026-04-02-一文读懂Harness-Engineering从14篇工程文章中寻找那个让AI不再离经叛道的壳｜Hao好聊趋势.md) | 腾讯科技 / Yousa 博阳 | 2026/04/02 15:22:38 | 趋势观点 / 市场表达 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/一文读懂Harness-Engineering从14篇工程文章中寻找那个让AI不再离经叛道的壳｜Hao好聊趋势.md) | 已沉淀 |
| 4 | [踩坑三个月，我们总结出的 Agent Harness 实践与反思](../raw/community-posts/harness-2026-05-28-supplement/2026-04-04-踩坑三个月我们总结出的-Agent-Harness-实践与反思.md) | 十字路口Crossing / Nexad Team | 2026/04/04 16:01:58 | 失败复盘 / 风险清单 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/踩坑三个月我们总结出的-Agent-Harness-实践与反思.md) | 已沉淀 |
| 5 | [我再次深刻理解了 Context 的价值。](../raw/community-posts/harness-2026-05-28-supplement/2026-04-28-我再次深刻理解了-Context-的价值.md) | AI产品阿颖 / 阿颖 | 2026/04/28 09:59:43 | 上下文 / 缓存 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/我再次深刻理解了-Context-的价值.md) | 已沉淀 |
| 6 | [Harness 工程实践复盘：100% Cache 命中的 Agent 怎么设计？](../raw/community-posts/harness-2026-05-28-supplement/2026-05-19-Harness-工程实践复盘100-Cache-命中的-Agent-怎么设计.md) | Founder Park / 李亚飞 | 2026/05/19 16:45:44 | 上下文 / 缓存 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/Harness-工程实践复盘100-Cache-命中的-Agent-怎么设计.md) | 已沉淀 |
| 7 | [Harness，AI时代的操作系统](../raw/community-posts/harness-2026-05-28-supplement/2026-04-23-HarnessAI时代的操作系统.md) | 渔夫 AIDaily / - | 2026/04/23 08:00:00 | 趋势观点 / 市场表达 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/HarnessAI时代的操作系统.md) | 已沉淀 |
| 8 | [模型降智后，Harness要从规则加入执行入口（踩坑系列：一）](../raw/community-posts/harness-2026-05-28-supplement/2026-04-30-模型降智后Harness要从规则加入执行入口踩坑系列一.md) | 粥粥呀不粥啊 / 粥粥呀不粥啊 | 2026/04/30 19:29:00 | 失败复盘 / 风险清单 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/模型降智后Harness要从规则加入执行入口踩坑系列一.md) | 已沉淀 |
| 9 | [Harness Engineering 落地全景：五家一线团队怎么搭、踩了什么坑](../raw/community-posts/harness-2026-05-28-supplement/2026-04-20-Harness-Engineering-落地全景五家一线团队怎么搭、踩了什么坑.md) | 赋范大模型技术圈 / 运营-水水 | 2026/04/20 18:30:00 | 业务实践 / 落地案例 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/Harness-Engineering-落地全景五家一线团队怎么搭、踩了什么坑.md) | 已沉淀 |
| 10 | [面试官皱眉：“公司项目几百万行代码，Claude Code 怎么扛得住？”我：“换 Opus 4.7”，他叹气：模型是地板，harness 才是天花板](../raw/community-posts/harness-2026-05-28-supplement/2026-05-22-面试官皱眉公司项目几百万行代码Claude-Code-怎么扛得住我换-Opus-47他叹气模型是地板harness-才是天花板.md) | 小林coding / 小林coding | 2026/05/22 14:12:00 | 趋势观点 / 市场表达 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/面试官皱眉公司项目几百万行代码Claude-Code-怎么扛得住我换-Opus-47他叹气模型是地板harness-才是天花板.md) | 已沉淀 |
| 11 | [从玩具到生产力：用真实项目讲透 AI Agent 的 Harness Engineering](../raw/community-posts/harness-2026-05-28-supplement/2026-04-21-从玩具到生产力用真实项目讲透-AI-Agent-的-Harness-Engineering.md) | 阿里云开发者 / 无岳 | 2026/04/21 08:30:00 | 业务实践 / 落地案例 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/从玩具到生产力用真实项目讲透-AI-Agent-的-Harness-Engineering.md) | 已沉淀 |
| 12 | [从“换马鞍”说起：Harness 的横与纵](../raw/community-posts/harness-2026-05-28-supplement/2026-05-05-从换马鞍说起Harness-的横与纵.md) | 游走于中老年之间 / 臀控君 | 2026/05/05 16:48:26 | 概念比较 / 取舍 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/从换马鞍说起Harness-的横与纵.md) | 已沉淀 |
| 13 | [SDD vs Harness到底如何选择？ 谈谈我的思考](../raw/community-posts/harness-2026-05-28-supplement/2026-05-06-SDD-vs-Harness到底如何选择-谈谈我的思考.md) | Fly的AI研习社 / Fly | 2026/05/06 17:21:06 | 概念比较 / 取舍 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/SDD-vs-Harness到底如何选择-谈谈我的思考.md) | 已沉淀 |
| 14 | [从零搭建 Harness Engineering 框架 ：Rule、Skill、Sub-Agent等工程落完整路径](../raw/community-posts/harness-2026-05-28-supplement/2026-05-25-从零搭建-Harness-Engineering-框架-Rule、Skill、Sub-Agent等工程落完整路径.md) | DeepHub IMBA / P**nHub兄弟网站 | 2026/05/25 21:19:26 | 方法论 / 搭建路径 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/从零搭建-Harness-Engineering-框架-Rule、Skill、Sub-Agent等工程落完整路径.md) | 已沉淀 |
| 15 | [Harness，那个你一直忽略的烂摊子，才是AI项目崩盘的真正元凶](../raw/community-posts/harness-2026-05-28-supplement/2026-04-17-Harness那个你一直忽略的烂摊子才是AI项目崩盘的真正元凶.md) | DataFunTalk / DataFun | 2026/04/17 13:00:00 | 失败复盘 / 风险清单 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/Harness那个你一直忽略的烂摊子才是AI项目崩盘的真正元凶.md) | 已沉淀 |
| 16 | [Agent Harness 系列：主流框架怎么落地？7 个架构选择决定你的 Agent 能不能上生产](../raw/community-posts/harness-2026-05-28-supplement/2026-05-22-Agent-Harness-系列主流框架怎么落地7-个架构选择决定你的-Agent-能不能上生产.md) | 运维小子 / 运维小子 | 2026/05/22 07:00:00 | 方法论 / 搭建路径 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/Agent-Harness-系列主流框架怎么落地7-个架构选择决定你的-Agent-能不能上生产.md) | 已沉淀 |
| 17 | [AI产品的下一道生死线：从Prompt工程，到Harness工程](../raw/community-posts/harness-2026-05-28-supplement/2026-05-25-AI产品的下一道生死线从Prompt工程到Harness工程.md) | 莫里AI / 莫里 AI | 2026/05/25 18:35:11 | 趋势观点 / 市场表达 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/AI产品的下一道生死线从Prompt工程到Harness工程.md) | 已沉淀 |
| 18 | [做了半年电商 Agent，我把该踩的坑全踩了一遍](../raw/community-posts/harness-2026-05-28-supplement/2026-03-30-做了半年电商-Agent我把该踩的坑全踩了一遍.md) | AI Growth Studio / AI Growth Studio | 2026/03/30 18:37:40 | 业务实践 / 落地案例 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/做了半年电商-Agent我把该踩的坑全踩了一遍.md) | 已沉淀 |
| 19 | [Harness Engineering的7个死亡陷阱：为什么你的Agent做着做着就崩了](../raw/community-posts/harness-2026-05-28-supplement/2026-04-29-Harness-Engineering的7个死亡陷阱为什么你的Agent做着做着就崩了.md) | 智弈科技 / 海百纳 | 2026/04/29 08:30:00 | 失败复盘 / 风险清单 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/Harness-Engineering的7个死亡陷阱为什么你的Agent做着做着就崩了.md) | 已沉淀 |
| 20 | [Prompt、Context之后，AI工程进入Harness Engineering时代](../raw/community-posts/harness-2026-05-28-supplement/2026-03-11-Prompt、Context之后AI工程进入Harness-Engineering时代.md) | 翟星人的实验室 / 翟星人的实验室 | 2026/03/11 21:28:43 | 上下文 / 缓存 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/Prompt、Context之后AI工程进入Harness-Engineering时代.md) | 已沉淀 |
| 21 | [你的AI Agent一直'翻车'？因为缺一个'Harness'](../raw/community-posts/harness-2026-05-28-supplement/2026-05-18-你的AI-Agent一直'翻车'因为缺一个'Harness'.md) | 和解AIAgent / 九尾狐 | 2026/05/18 09:00:00 | 失败复盘 / 风险清单 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/你的AI-Agent一直'翻车'因为缺一个'Harness'.md) | 已沉淀 |
| 22 | [凌晨三点，我的AI项目炸了](../raw/community-posts/harness-2026-05-28-supplement/2026-05-19-凌晨三点我的AI项目炸了.md) | 1024氪 / 1024 | 2026/05/19 17:30:00 | 失败复盘 / 风险清单 | [card](../source-cards/community-posts/harness-2026-05-28-supplement/凌晨三点我的AI项目炸了.md) | 已沉淀 |

## 代表 source-cards

- [刚刚，一篇最全Agent Harness综述来了！](../review/source-cards/community-posts/harness-2026-05-28-supplement/刚刚一篇最全Agent-Harness综述来了.md)
- [Harness 完全指南：harness 是一切工作的核心（1.3万字）](../review/source-cards/community-posts/harness-2026-05-28-supplement/Harness-完全指南harness-是一切工作的核心13万字.md)
- [一文读懂Harness Engineering：从14篇工程文章中，寻找那个让AI不再离经叛道的壳｜Hao好聊趋势](../review/source-cards/community-posts/harness-2026-05-28-supplement/一文读懂Harness-Engineering从14篇工程文章中寻找那个让AI不再离经叛道的壳｜Hao好聊趋势.md)
- [踩坑三个月，我们总结出的 Agent Harness 实践与反思](../review/source-cards/community-posts/harness-2026-05-28-supplement/踩坑三个月我们总结出的-Agent-Harness-实践与反思.md)
- [我再次深刻理解了 Context 的价值。](../review/source-cards/community-posts/harness-2026-05-28-supplement/我再次深刻理解了-Context-的价值.md)
- [Harness 工程实践复盘：100% Cache 命中的 Agent 怎么设计？](../review/source-cards/community-posts/harness-2026-05-28-supplement/Harness-工程实践复盘100-Cache-命中的-Agent-怎么设计.md)
- [Harness，AI时代的操作系统](../review/source-cards/community-posts/harness-2026-05-28-supplement/HarnessAI时代的操作系统.md)
- [模型降智后，Harness要从规则加入执行入口（踩坑系列：一）](../review/source-cards/community-posts/harness-2026-05-28-supplement/模型降智后Harness要从规则加入执行入口踩坑系列一.md)

## 未覆盖范围

- 本批主要是 Harness 方法论与社区观点,没有新增具体商业产品的完整实体画像。
- 多数微信文章是二次解读或经验总结,强证据仍以论文主页、官方产品材料和真实项目复盘为主。
- 后续如果要写作品集报告,建议优先使用论文和“真实项目 / 缓存 / 踩坑”类文章,少引用纯趋势表达。
