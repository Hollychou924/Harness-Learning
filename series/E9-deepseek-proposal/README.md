# E9｜给 DeepSeek 桌面端 Agent 的产品提案书

> 状态:🥚 未开始 · 字数目标:6000-8000(求职杀手锏,留 3 周打磨)
> JD 锚点:**UI/UX** / 路线图 / 社区运营 / 评估体系
> 定位:不是泛泛"如何设计 Agent",而是直接面向 DeepSeek 的一份产品提案。发到招聘邮箱/社区即最强简历。

## 本章要回答的真实问题(综合应用题)

1. **Q1:面试官让你现场拆解竞品 Harness 设计,你怎么讲?** — 场景:用 Prompt/Context/Harness 三层框架对任意产品现场拆。把"看别人案例"变成"我能做的分析"。
2. **Q2:下个版本 Harness 优先级排序——工具/记忆/安全/评测,先做哪个?决策逻辑?** — 场景:资源有限先补哪块短板。"三种团队起手方向" + "先基础设施再上层"。没标准答案,但判断逻辑就是考核点。
3. **Q3:产品想法"给 Agent 加个记忆能力",怎么翻译成工程师能动手的需求?** — 场景:Harness PM 和普通 PM 最大差异。用"上下文分层/hook/压缩策略"这类精确词汇表达,工程师才不会问"你到底要什么"。
4. **Q4:产品被竞品新功能打了措手不及,怎么用 Harness 视角分析并回应?** — 场景:竞品分析框架的实战应用。7 产品档案 + 13 篇横评 + 比较框架 = 一套可迁移方法论。考"我会拆"而非"我拆过某个"。
5. **Q5:三个月后回头看,这套知识改变了你判断 AI 产品的方式吗?改变了什么、没改变什么?** — 场景:首尾呼应的反思题。用真实学习后的判断回应开篇"Harness > Model",展示"我真的想清楚了"。

## 章节骨架(提案书正文)

1. 市场现状判断:DeepSeek 在桌面端 Agent 赛道的位置
2. 产品定位假设:对标 Claude Code?Cursor?还是新物种?
3. MVP 设计:编排循环 / 工具集 / 记忆设计 / 上下文设计(AGENTS.md + Skills)/ 权限矩阵
4. **UI/UX Mockup**(Figma / v0 / Lovable,5-8 张图)
5. 评估体系:离线 + 在线 + 社群信号
6. 路线图:0-3 / 3-6 / 6-12 个月
7. 开源社区运营计划
8. 风险与挑战
9. 附:飞书模板 + GitHub Demo Repo 链接

## 支撑素材(wiki 映射)

| 问题 | wiki 素材 |
|------|----------|
| Q1/Q4 | `comparisons/*.md`、`entities/*.md`(7 产品)、`topics/openclaw-claude-code-hermes-comparison.md`、`reports/portfolio/community-divergence/report.md` |
| Q2 | `topics/agentway-harness-books.md`(三种起手方向)、`reports/portfolio/harness-design/report.md` |
| Q3 | `concepts/prompt-context-harness.md`(共同语言词汇表) |
| 全章 | 本系列 E1-E8 的全部产出 |

## 配套动作(JD 加分项)

- **Code Review Agent demo**:本 repo 的可运行 demo(对应 JD "vibe coding")
- **5 分钟视频**:对着 mockup 讲产品判断
- **配套 PDF**:9 期精华压缩成 30 页操作手册,作简历附件

## 收尾检查清单(草稿待填)

- [ ] 提案是否有明确的产品定位主张(而非骑墙)
- [ ] mockup 是否真做出来了(不是文字描述)
- [ ] Q5 反思是否有真实的"认知改变",而非重复开篇结论
