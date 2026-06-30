---
id: source-card-3_实战案例-011-你不知道的-Agent原理架构与工程实践
type: source-card
status: triaged
source: wiki/raw/harness-engineering/3_实战案例/011-你不知道的-Agent原理架构与工程实践.md
updated: 2026-05-25
---

# 单篇知识卡 · 你不知道的 Agent：原理、架构与工程实践

## 原文信息

- 标题: 你不知道的 Agent：原理、架构与工程实践
- 分类: 实战案例
- 来源账号/站点: developer.aliyun.com
- 作者: -
- 发布时间: -
- 原文: [011-你不知道的-Agent原理架构与工程实践.md](../../../raw/harness-engineering/3_实战案例/011-你不知道的-Agent原理架构与工程实践.md)

## 关键线索

| 实体/机制 | 命中次数 |
|---|---:|
| Agent | 168 |
| Skills | 41 |
| 评测/Eval | 38 |
| OpenClaw | 14 |
| Sub-agent | 13 |
| Harness | 12 |
| MCP | 8 |
| Codex | 4 |

## 内容提要

- 一、Agent Loop 的基本运转方式
- 2. **路由 Routing：**对输入分类，定向到对应的专用处理流程，简单问题走轻量模型，复杂问题走强模型，技术咨询和账单查询走不同逻辑。
- 3. **并行 Parallelization：**两种变体：分段法把任务拆成独立子任务并发跑，投票法把同一任务跑多次取共识，适合高风险决策或需要多视角的场景。
- 二、为什么 Harness 比模型更关键
- 三、上下文工程为什么决定稳定性
- 低效（约 45 tokens）

## 触发器判定

- 触发器: 实践案例,应进入 lesson/comparison/topic
- 当前状态: triaged,已进入覆盖账本；是否继续升级为独立成品页见“待升级/待复核”。

## 已沉淀去向

- [prompt-only-agent-is-not-production](../../../lessons/prompt-only-agent-is-not-production.md)
- [harness-engineering-community-synthesis](../../../topics/harness-engineering-community-synthesis.md)
- [openclaw](../../../entities/openclaw.md)

## 待升级 / 待复核

- 待建实体页: Codex
- 待建概念/专题: Agent 评测体系
- 待抽取 lesson: 具体实践坑点

## SKIP+REASON

| 范围 | reason_code | 说明 |
|---|---|---|
| 独立成品页 | pending-human-review | 已标出待升级项,需要后续按主题集中升级 |
