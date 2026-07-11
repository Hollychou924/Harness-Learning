---
id: source-card-loop-engineering-practical-handbook-2026-06-21
type: source-card
status: active
updated: 2026-07-08
source: https://mp.weixin.qq.com/s/kICrdEkPCYAiyOiwI-Gt1Q
url: https://mp.weixin.qq.com/s/kICrdEkPCYAiyOiwI-Gt1Q
account: Datawhale
author: Codez
publish_time: 2026-06-21
---

# 单篇知识卡：Loop Engineering 实操手册

## 一句话价值

全网 220w 人看过的 14 步 Loop Engineering 构建路线图，从"要不要做"到"最小能跑"到"上线守住"，是最落地的实操指南。

## 核心观点

### 动手前四个问题

1. 这个任务是重复的吗？——一次性的活，好 prompt 更划算
2. 有没有东西能自动判定"干砸了"？——测试、类型检查、linter，至少一个
3. token 预算扛得住浪费吗？——loop 不产出也照样烧钱
4. Agent 能跑自己写的代码吗？——有日志、能复现、看得到哪崩
5. 附加题：你打算 review 产出的代码吗？——不打算就别建

### 五个核心构件

| 构件 | 作用 | 关键设计 |
|---|---|---|
| Automations | loop 的心跳，按节奏触发 | 停止条件要写死，别无限跑 |
| Worktrees | 并行不打架 | 每个 Agent 一份独立工作区 |
| Skills | 把背景写下来 | 项目框架、约定、踩坑存成 skill |
| Connectors | 连上真实工具链 | 通过 MCP 接 GitHub/Jira/Slack/Sentry |
| Sub-agents | 写的和验的分开 | 第二个 Agent 验收，避免自我说服 |

### 最小 Loop 的四件套

1. 一个 automation：按节奏触发，按明确条件停
2. 一个 skill：存下项目背景
3. 一个状态文件：记下做完了什么、下一步干啥
4. 一个闸门：自动拒绝坏活的测试/类型检查/构建

顺序很重要：先让一次手动运行稳定 → 做成 skill → 包成 loop → 再去调度。

### 三种翻车方式

1. **假装干完了**（Ralph Wiggum 循环）：Agent 提前发"完成"信号，活干一半就退。原因：没有硬闸门
2. **理解债务**：loop 越快交付你没写过的代码，"仓库里有什么"和"你理解什么"的差距越大
3. **认知投降**：你慢慢不再自己判断，loop 返回啥就收啥

### 安全红线

无人值守的 loop = 无人值守的攻击面：
- 生成代码未审就上线 → 闸门加 SAST、依赖审计、密钥扫描
- Skill 是注入入口 → 自动安装前先读源码
- 凭证泄露进日志 → 生产 loop 关掉 verbose 日志
- 权限蔓延 → 每 30 天复审

### 14 步路线图

第一段·先想清楚要不要做（5 步）：确认重复性、自动判定、token 预算、Agent 可运行性、打算 review
第二段·搭最小能跑的 Loop（8 步）：手动稳定→skill→状态文件→闸门→automation→worktree→connectors→sub-agents
第三段·上线之后守住（1 步）：盯住每个被接受的改动成本，定期复审权限、读 diff、别让 loop 碰架构

## 可用于 Loop Engineering 概念页

- 五个构件可直接作为 Loop Engineering 的结构骨架
- "写的和验的分开"对应 momo-code 的设计：快循环蒸馏战术，慢循环用独立 held-out 测试集验证
- "硬闸门"对应 momo-code 的 Ratchet Gate（ΔpassAt1 ≥ eps 且回归数为 0）
- "状态文件"对应 momo-code 的 ledger.jsonl（append-only 审计日志）
- "安全红线"对应 momo-code 的 Guard（forbiddenPaths、banned patterns、secret 检测）
- 三种翻车方式可用于评估 momo-code 的局限：momo-code 通过 Gate 状态机防了"假装干完了"，但没有"理解债务"和"认知投降"的应对机制

## 关联页面

- ../../concepts/loop-engineering.md
- ../../concepts/harness-self-evolution.md
