---
id: source-card-claude-official-loop-intro-2026-07-08
type: source-card
status: active
updated: 2026-07-08
source: https://mp.weixin.qq.com/s/w6I4MeRbwxnmZF52rd3HWg
url: https://mp.weixin.qq.com/s/w6I4MeRbwxnmZF52rd3HWg
account: steve-手搓AI
author: steve
publish_time: 2026-07-08
---

# 单篇知识卡：Claude 官方入门 Loop 文章

## 一句话价值

Claude 开发团队官方对 Loop 的定义和四层分类，是从产品视角理解 Loop Engineering 最清晰的入门框架。

## 核心观点

Loop 的定义：让 AI 反复干一件事，干到某个"停"的条件满足为止。

四种 Loop 从简单到自动：

| 类型 | 触发方式 | 人参与度 | 典型场景 |
|---|---|---|---|
| 回合制循环 | 用户每轮发指令 | 全程掌舵 | 日常编码，反复自查 |
| 目标循环 /goal | 设定目标，达标即停 | 只定目标 | Lighthouse 分数拉到 90，最多试 5 次 |
| 时间循环 /loop | cron 定时触发 | 复核结果 | 每 5 分钟检查 PR，处理审查意见 |
| 主动循环 | 事件/时间表触发 | 全程不盯 | bug 分类、issue 处理、代码迁移 |

主动循环是前三种的拼装：定时任务发现新工作 → goal 定义什么叫做完 → skill 规定怎么验证 → 工作流调度多 agent → 自动模式不卡权限确认。

## 输出质量保障三要点

1. 代码库本身得整洁，别让 loop 在垃圾堆上施工
2. 告诉 loop "什么叫合格"——给明确的自查标准
3. 文档和最佳实践要随手能翻到

## Token 经济

- 小任务别上多 agent 或复杂 loop
- 大规模任务开工前把成功标准和停止条件定死
- 小模型能干的活别用大模型
- 需要确定结果的事写脚本跑，别让 LLM 猜
- 先跑一小块探路估消耗

## 可用于 Loop Engineering 概念页

- 四层分类可作为 Loop Engineering 概念的骨架结构
- "skill 沉淀"观点与 momo-code 的 Tactic 蒸馏机制形成呼应
- "主动循环 = 前三种拼装"可用来解释 momo-code 双速循环的组合关系

## 关联页面

- ../../concepts/loop-engineering.md
- ../../concepts/harness-self-evolution.md
