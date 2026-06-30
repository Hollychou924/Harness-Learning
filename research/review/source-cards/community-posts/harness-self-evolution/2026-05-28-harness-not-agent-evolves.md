---
id: source-card-harness-not-agent-evolves-2026-05-28
type: source-card
status: active
updated: 2026-06-15
source: wiki/raw/community-posts/harness-self-evolution-2026-06/2026-05-28-harness-not-agent-evolves.md
url: https://mp.weixin.qq.com/s/BKACFI8CCJntQAHRGDIMUA
account: 信息与反思
author: Arvin Xu
publish_time: 2026-05-28
---

# 单篇知识卡：需要自进化的不是 Agent，而是 Harness

## 一句话价值

这篇最适合做第七章开场的“反常识主线”：需要进化的不是单个 Agent，而是把模型、工具、上下文、权限、环境组织起来的 Harness。

## 核心观点

- 模型已经不是完整产品，“模型 + Harness”才是用户真正体验到的产品。
- 2026 年以后，模型分数的边际收益下降，真实体验差异更多来自 Harness 能否稳定释放模型能力。
- Harness 本身会过时：模型接口会变、工具说明会变、用户任务会变、错误模式会变。
- Harness 自进化的基础是 Tracing：必须记录任务过程、工具调用、失败原因、上下文策略、恢复动作。
- 自进化不是“产品开发者用自己的产品开发自己”，而是更高一层的系统自我演进。

## 第七章可用弹药

可作为开场判断：

> Agent 不会越用越聪明，往往不是模型不行，而是 Harness 没有长记性。

可放在“什么是真自进化”部分：

```text
任务运行
→ 过程记录
→ 失败归因
→ Harness 层更新
→ 验证
→ 下次复用
```

## 产品经理追问

- 系统记录的是最终答案，还是完整过程？
- 错误是被展示给用户，还是被系统吸收并沉淀？
- Harness 是否能识别模型、工具、上下文、环境变化带来的新失败模式？
- 有没有“过程记录 → 归因 → 改进 → 验证”的闭环？

## 关联页面

- ../../../../concepts/harness-self-evolution.md
- ../../../../topics/harness-self-evolution-2026-06.md
