# E7｜模型与 Harness 共同进化:谁在推着谁变好

> 状态:🥚 未开始 · 字数目标:6000-8000(JD 直接命中,可放宽)
> JD 锚点:**与研究员协作** / 训练数据-Harness 闭环
> 风险提示:本章最"虚"——多为概念框架,一手实证少。写作时务必用具体案例和数字撑住,否则容易成空泛概念文。

## 本章要回答的真实问题

1. **Q1:Agent 用着用着效果变差,怎么判断是模型退化、Harness 腐化,还是数据漂移?** — 场景:三种症状像但处理完全不同。先建基线 → 回归集定位 → "Look at your data"根因分析。
2. **Q2:Agent 犯了个错,怎么把它固化成"永远不再犯"的 Harness 改进?** — 场景:Harness Engineering 的本质定义(Hashimoto:每发现一个错误,工程化消除它再次发生的可能)。闭环:发现错误→加评测集→改 Rules/Skills/Wiki→跑回归通过→才算修好。
3. **Q3:用户真实使用行为里,哪些信号能优化 Harness?怎么采集利用?** — 场景:显式反馈(赞/踩/重试)+ 隐式反馈(成功率/放弃率/在哪步离开)。难点是把信号变成具体改进动作,而非"我们看了数据"。
4. **Q4:Skill 和规则越积越多、维护成本越来越高,怎么做"Harness 债务管理"?** — 场景:"熵的累积";安全规则互相打架、MUST 和 NEVER 矛盾。Harness 也要定期清理垃圾。
5. **Q5:什么情况该用 Harness 数据微调模型,什么情况不值得?** — 场景:Hermes 的 RL 训练闭环是一条路线,Claude Code 把秩序放 Harness 而非训练进模型是另一条。两条路线各自适用条件?

## 章节骨架

1. PM 钩子:同一个模型,为什么 Claude Code 和直接调 API 差这么多?
2. 三角闭环:训练数据 ↔ Harness 设计 ↔ 用户反馈
3. Harness 如何反向影响模型训练(工具准确率作训练信号 / 默认行为成先验 / 行为日志回流样本)
4. 模型能力如何重新定义 Harness 边界(长上下文改记忆 / Reasoning 改循环 / 多模态重塑工具集)
5. PM 在闭环中的角色:设计反馈通道,而非堆功能

## 支撑素材(wiki 映射)

| 问题 | wiki 素材 |
|------|----------|
| Q1 | `topics/agent-evaluation-deep-dive.md`、`topics/aliyun-cloud-developer-agent-collection.md`(智能运维评测) |
| Q2 | `concepts/harness-engineering.md`、`topics/aliyun-cloud-developer-agent-collection.md`(90% 闭环) |
| Q4 | `topics/tencent-cloud-developer-agent-harness-collection.md`(Skill 自训练踩坑)、`entities/codex.md`(百万行代码熵) |
| Q5 | `reports/portfolio/co-evolution/report.md`、`entities/hermes-agent.md`(RL 闭环) |

## 收尾检查清单(草稿待填)

- [ ] 三种"变差"原因是否给了可操作的区分诊断法
- [ ] "微调 vs 放 Harness"是否给了清晰决策框架
