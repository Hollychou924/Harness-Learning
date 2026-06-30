---
id: source-card-self-harness-auto-ml-2026-06-12
type: source-card
status: active
updated: 2026-06-15
source: wiki/raw/community-posts/harness-self-evolution-2026-06/2026-06-12-self-harness-auto-ml.md
url: https://mp.weixin.qq.com/s/zaLkrIdIFv5RuSoyflMyoA
account: AutoML机器学习
publish_time: 2026-06-12
---

# 单篇知识卡：Self-Harness，让 Agent 自己改自己的 Harness

## 一句话价值

这篇适合做第七章“自动改 Harness”的硬案例补充：它把自进化拆成弱点挖掘、候选修改、回归验证三步，特别适合产品经理拿来评审方案。

## 核心观点

- Self-Harness 不是直接让 Agent 随便改自己，而是基于失败过程找共性问题，再提出小范围改动。
- 第一步是 Weakness Mining：从失败过程里找反复出现的失败模式，而不是盯单个失败案例。
- 第二步是 Harness Proposal：候选改动必须绑定具体失败机制，且尽量小改。
- 第三步是 Proposal Validation：已知任务和新任务都不能变差，至少一个要变好，否则不接受。
- 文章给出的实验里，MiniMax、Qwen、GLM 三类模型都有提升；不同模型最后进化出的 Harness 不一样。

## 第七章可用弹药

可放在 Meta-Harness 后，作为更贴近“自己改自己”的案例：

```text
失败过程聚类
→ 找共性失败机制
→ 提出多个小改动
→ 跑回归验证
→ 只接受不退化的改动
→ 合并到下一版 Harness
```

适合强化一句判断：

> 自进化不是自由发挥，而是“基于证据的小改动 + 严格验证”。

## 产品经理追问

- 是否先找共性失败模式，而不是单点修补？
- 每个改动是否绑定明确失败原因？
- 是否只做小改动，避免大范围不可控？
- 是否有新旧任务同时验证？
- 通过不了的改动是否会被拒绝和记录？

## 关联页面

- ../../../../concepts/harness-self-evolution.md
- ../../../../topics/harness-self-evolution-2026-06.md
