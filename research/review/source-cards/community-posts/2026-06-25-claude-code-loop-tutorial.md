---
id: source-card-claude-code-loop-tutorial-2026-06-25
type: source-card
status: active
updated: 2026-07-08
source: https://mp.weixin.qq.com/s/-zNyfvaPMGAJrKThPRZWkA
url: https://mp.weixin.qq.com/s/-zNyfvaPMGAJrKThPRZWkA
account: Datawhale
author: 王大鹏
publish_time: 2026-06-25
---

# 单篇知识卡：Claude Code /loop 实操教程

## 一句话价值

用真实场景（监控公众号文章更新）从设计到运行跑通一个完整的 Loop，并用源码拆解证明"循环的智能不在基础设施里，在 prompt 里"。

## 核心观点

### Agent 被唤醒的几种方式

| 方式 | 机制 | 适用场景 |
|---|---|---|
| /loop | cron 定时触发 | 每 30 分钟检查一次部署状态 |
| /goal | 目标驱动，达标即停 | 所有测试通过、构建成功 |
| hooks | 事件确定性触发 | 编辑文件后自动跑 lint |
| spawn 子 agent | 并行执行拆分任务 | 多个 worktree 探索不同方案 |
| workflow | LLM 决定子 agent 组合 | 不确定怎么拆分时 |

实际工作流里这些形态会组合使用。

### /loop 源码机制

```text
用户输入: /loop 30m <prompt>
    ↓
loop.ts 解析: interval=30m → cron="*/30 * * * *"
    ↓
CronCreate: 创建定时任务, recurring=true
    ↓
立刻执行一次 prompt（不等第一个 tick）
    ↓
cronScheduler.ts: setInterval(check, 1000) 每秒检查
    ↓
到期 → onFire(prompt) → 注入消息队列 → agent 开始新 turn
```

本质就是 cron + prompt。没有 evaluator，没有自动判断达标的系统组件。智能在 prompt 里：什么条件下该做事、该停、该喊人。

### Loop 和 cron 脚本的关键区别

cron 脚本遇到 token 过期会静默失败，第二天才发现数据断了一天。Loop 遇到同样的错误会：
1. 判断这不是内容问题，是凭证过期
2. 不重试（关键决策）
3. 标记状态为 token_expired
4. 通知用户扫码
5. 下一轮先检测恢复再决定是否正常执行

这就是控制器判断力：区分"内容层面的问题（值得重试）"和"基础设施层面的问题（需要人介入）"。

### Loop 第一步是先写 skill

处理问题的那个 skill 得先有解决问题的方法，loop 只是让它自动重复。Claude Code 做的事情其实不复杂（调 API、比对列表、写文件），区别在异常处理的设计方式——agent 看到未预见的返回值能基于上下文做合理决策，即使 prompt 里没有逐一列举所有错误码。

## 可用于 Loop Engineering 概念页

- "循环的智能在 prompt 里"是 Loop Engineering 的核心设计哲学
- "先写 skill 再包 loop"的设计顺序可直接引用
- 状态文件（sync_state.json）是 loop 持久记忆的最简实现
- 与 momo-code 的对比：momo-code 把"智能"从 prompt 移到了代码层（Bayesian gate、Thompson sampling），是两种不同的设计哲学

## 关联页面

- ../../concepts/loop-engineering.md
- ../../concepts/harness-self-evolution.md
