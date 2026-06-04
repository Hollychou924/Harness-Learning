# E2｜编排循环:任务怎么"跑起来"又不跑飞

> 状态:🥚 未开始 · 字数目标:3000-5000
> JD 锚点:Agent Loop / Reasoning / Planning

## 本章要回答的真实问题

1. **Q1:Agent 一直循环调工具但没进展,死循环了,怎么预防和逃出?** — 场景:腾讯 4 亿 token Day 1 多层保护全触发却像多米诺全倒。答案:四道硬闸(max_steps/max_tokens/max_duration/max_tool_calls)由 Harness 统一管控,不能让 Agent 自己判断是否继续。
2. **Q2:任务跑到一半崩了,怎么从断点续跑而不是从头重来?** — 场景:长任务 Agent 最常见、教程最少覆盖。"状态属于主业务" + 线程持久化 + checkpoint。
3. **Q3:多个 Agent 并行,代码/数据互相踩踏,怎么隔离?** — 场景:Worker 并行用 Git Worktree 解决互踩;原则=并行 Agent 不共享可写状态。
4. **Q4:让 Agent 自决下一步,还是外部系统指定?边界在哪?** — 场景:"让 Agent 出主意,让 Harness 拿决定";Planner 输出声明式计划而非命令式调用。
5. **Q5:Watchdog 说"一切正常",任务其实早卡死,怎么设计才能真发现?** — 场景:68 次巡检全说正常,实际卡死 11.6 小时。监控要看"是否有效推进",不是"进程是否活着"。

## 章节骨架

1. PM 钩子:Agent 卡住的 5 种常见死法
2. TAO 循环:Think-Act-Observe
3. 竞品锚点:Anthropic 笨循环 vs Cursor Agent Mode
4. 关键决策点:终止条件 / 超时 / 重试 / 回滚
5. 实战:100 行伪代码理解最小循环

## 支撑素材(wiki 映射)

| 问题 | wiki 素材 |
|------|----------|
| Q1/Q5 | `topics/tencent-cloud-developer-agent-harness-collection.md`(4 亿 token 案例) |
| Q2/Q4 | `concepts/quest-mode-agent-development.md`、`topics/agentway-harness-books.md`(原则 3) |
| Q3 | `topics/tencent-cloud-developer-agent-harness-collection.md`(Multi-Agent 4 天) |
| 竞品对比 | `entities/codex.md`、`entities/cursor.md`、`comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md` |

## 收尾检查清单(草稿待填)

- [ ] 四道硬闸是否给出了可直接抄的配置范围
- [ ] 是否区分了"该重试"和"该熔断"
