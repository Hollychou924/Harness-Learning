# E1｜重新理解 Agent + 桌面端 Agent 全景图

> 状态:✍️ 草稿中 · 字数目标:6000-8000(开门炮可放宽)
> 定位:全系列的**地图与指南针** + 求职信号弹。立论 + 框架为主,9 款产品只做速览,深度对比留给后续各章。

## 本章要回答的真实问题

1. **Q1:同一个任务,该用 Claude Code 直接跑、还是自建一套 Agent 系统?** — 场景:团队启动 Agent 项目的第一个决策。现成产品 Harness 固定,自建才能做业务定制——界限在哪?
2. **Q2:我的业务该接 API 模式、桌面端 Agent、还是 IDE 插件?怎么分析?** — 场景:选型不是看品牌,是看"任务需要 Agent 触达什么工具/文件/渠道/权限"。
3. **Q3:跟老板讲"Agent 化改造",ROI 怎么算才诚实?** — 场景:阿里 25%→90% 是成功路径,腾讯 4 亿 token 5 教训是踩坑路径,放一起才是诚实估算。
4. **Q4:Demo 跑得好、放真实项目就翻车,鸿沟在哪?** — 场景:"Demo 易、泛化难";"Agent 知识边界=代码库文件边界";"有监控但监控没用更危险"。
5. **Q5:做 Agent 产品,PM 的工作方式和传统软件有什么本质不同?** — 场景:从"写 PRD"变成"设计 Agent 能在什么边界里可靠干活"。

## 镇文之图

这张「上下文生命周期 + KV Cache 分层」架构图(见 `assets/`)是 E1 证明 **"Harness 不是框架,是 Agent 的操作系统"** 的核心论据——E1 放**简化版**,E4 放完整版,首尾呼应。

## 章节骨架(详见 outline.md)

1. PM 钩子:为什么用了最强模型,效果还不如对手
2. 三次范式跃迁:Prompt → Context → Harness
3. Harness = Agent 的操作系统(用简化版架构图)
4. **五大组件框架**(= E2-E6 目录):编排 / 工具 / 上下文与记忆 / 能力组织 / 安全
5. 桌面端 Agent 全景**速览表**(9 款一句话定位,不深挖)
6. Harness Engineer 能力模型 + PM 与工程师对话清单

## 支撑素材(wiki 映射)

| 问题 | wiki 素材 |
|------|----------|
| Q1/Q2/Q5 | `concepts/prompt-context-harness.md`、`concepts/harness-engineering.md` |
| Q3 | `topics/aliyun-cloud-developer-agent-collection.md`、`topics/tencent-cloud-developer-agent-harness-collection.md` |
| Q4 | `lessons/prompt-only-agent-is-not-production.md` |
| 9 款速览 | `entities/*.md`(claude-code/cursor/codex/hermes-agent/manus/openclaw/qoder)、`comparisons/*.md`、`timelines/agent-harness-design-evolution.md` |

## 素材缺口(待补)

- JD 列的 9 款里,**缺 Cowork / OpenCode / GitHub Copilot 的产品档案**(wiki 现有 7 个,且含 JD 外的 codebuddy/qoder)。E1 速览可先用一句话定位顶上,深度档案后补。

## 收尾检查清单(草稿待填)

- [ ] 五大组件框架是否能让读者拿去拆解任意一款产品
- [ ] 9 款速览是否每款都有一句"原创定位",而非综述
