# E1｜什么是 Harness:从认知到能力模型

> 状态:✍️ 大纲已重排(按 6 问) · 字数目标:6000-8000(开门炮可放宽)
> 定位:全系列的地图与指南针 + 求职信号弹。立论 + 框架为主,9 款产品只做速览。

## 本章要回答的真实问题(2026-06 按周浩定稿重排)

1. **Q1:什么是 Harness?它怎么一步步演变出来的?** — 三层框架 + 5 阶段演进。
2. **Q2:为什么需要 Harness?它有多重要?** — 阿里成功路径 + 腾讯踩坑成本,顺带把 ROI 讲诚实。
3. **Q3:Harness 一共有哪些模块/组件?** — 五大组件(=E2-E6 目录)+ ETCLOVG 七层。
4. **Q4:怎么判断一个产品的 Harness 做得好不好?** — 把七层变成一张打分表(先给尺子)。
5. **Q5:市面上哪些产品的 Harness 做得好?** — 9 款一句话定位速览(再用尺子量)。
6. **Q6:Harness 时代对 AIPM 的能力模型提出什么要求?** — 收敛到架构设计 + 评估双核闭环。

> 顺序说明:Q4 判断标准刻意放在 Q5 产品速览之前,先给尺子再量产品,最像专业测评。

## 章节骨架(详见 outline.md)

0. 钩子:用了最强模型,效果还不如对手
1. 什么是 Harness + 5 阶段发展轨迹
2. 为什么需要 + 有多重要(阿里/腾讯 + ROI)
3. 有哪些模块:五大组件 + ETCLOVG 七层(镇文图)
4. 怎么判断好不好:七层打分表
5. 9 款产品速览(配判断标准现场点评)
6. AIPM 双核能力模型(架构设计 + 评估)+ 收尾清单

## 支撑素材(wiki 映射)

| 问题 | wiki 素材 |
|------|----------|
| Q1 | `concepts/prompt-context-harness.md`、`timelines/agent-harness-design-evolution.md` |
| Q2 | `lessons/prompt-only-agent-is-not-production.md`、`topics/aliyun-*`、`topics/tencent-*` |
| Q3 | `concepts/harness-engineering.md`、`concepts/etclovg-agent-harness-taxonomy.md` |
| Q4 | `concepts/etclovg-agent-harness-taxonomy.md`(转打分表) |
| Q5 | `entities/*.md`(含新补 github-copilot/opencode/claude-cowork)、`comparisons/*.md` |
| Q6 | 周浩定稿的双核能力模型(架构设计 + 评估)+ `concepts/harness-engineering.md` PM 用法 |

## 本轮已补的产品档案(2026-06-06 联网深搜)

- ✅ `entities/github-copilot.md` — 补全到 Agent、Cloud agent、防火墙 allowlist、提示注入缓解、自动化收敛、签名提交审计
- ✅ `entities/opencode.md` — 客户端-服务端分离 + OpenAPI、主/子 Agent 双层、allow/ask/deny 权限、provider policies、兼容 .claude/.agents skills
- ✅ `entities/claude-cowork.md` — Claude Code 能力迁移到知识工作、计划-确认-执行、定时任务、Skills 复用、企业管控

## 待你填的一手观察(求职作品集灵魂,不代写)

- [ ] 第 0 节:第一次意识到"问题不在 prompt、在 harness"的真实场景
- [ ] 第 2 节:现成产品 Harness 卡住你的具体经历
- [ ] 第 5 节:2-3 款高强度用过的产品,各一句最意外/最难受的点
- [ ] 第 6 节:对 DeepSeek 的一句留白

## 素材缺口 / 待复核

- ⚠️ Manus 暂无独立档案,速览先一句话顶。
- ⚠️ 新档案的官方 URL 易变,引用具体配置/步骤前以官方最新文档为准。

## 收尾检查清单(草稿待填)

- [ ] 五大组件 + 七层打分表是否能让读者拿去拆/打分任意一款产品
- [ ] 9 款速览是否每款都有一句原创定位,而非综述
- [ ] 双核能力模型是否落到"工程师/数据科学家/模型研究员都替代不了 AIPM"的论证
