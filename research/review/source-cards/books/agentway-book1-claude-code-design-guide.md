---
id: source-card-book-agentway-1-claude-code-design-guide
type: source-card
status: triaged
source: wiki/raw/books/agentway/2026-04-01-agentway-claude-code-harness-engineering-design-guide.md
updated: 2026-05-26
---

# AGENTWAY Books 卡 · Claude Code 设计指南: Harness Engineering

## 原文信息

- 来源: agentway.dev / AGENTWAY HARNESS BOOKS 系列
- 副标题: CONTROL PLANE / QUERY LOOP / RECOVERY / VERIFICATION
- 版本: 2026-04-01 rev 37dfc2
- 页数: 88
- 原文: [raw](../../raw/books/agentway/2026-04-01-agentway-claude-code-harness-engineering-design-guide.md)
- 来源 URL: https://agentway.dev

## 章节速览

- 第 1 章 为什么需要 Harness Engineering: 5 层 Harness (会话约束/持续循环/工具调度/危险工具最细规矩/错误属于主路径)
- 第 2 章 Prompt 不是人格: prompt = 控制平面的宪法,不是台词;分层注入 + 优先级 + 缓存与计算成本
- 第 3 章 Query Loop = 代理系统的心跳: 状态属于主业务;治理输入;模型只是循环一段;心跳必须处理中断和恢复;停止条件不能只有一个
- 第 4 章 工具、权限与中断: 权限先于能力;StreamingToolExecutor 把中断作为一等语义;Bash 永远比别的工具更可疑
- 第 5 章 上下文治理: CLAUDE.md / MEMORY.md 是索引而非日记;auto compact 是预算治理;摘要要重建可继续工作的上下文
- 第 6 章 错误与恢复: prompt too long 是必然周期;响应式 compact;abort 中断也属于错误恢复;保护执行叙事的一致性
- 第 7 章 多代理与验证: forked agent 必须 cache-safe;状态隔离;协调者 synthesis 是稀缺能力;验证必须独立成阶段
- 第 8 章 团队落地: 先把最低边界做清楚;CLAUDE.md 稳定分层;skill 是工作流模块;approval 按风险分层;hook 不必作为第一步
- 第 9 章 Harness Engineering 十条原则
- 附录 A 检查清单 (Runtime/Prompt/Tool/Context/Recovery/Multi-Agent/Team/Review)
- 附录 B 图示 (总体控制面 / Query Loop / Tool Batch / Context Sources / Coordinator-Worker / 团队治理)
- 附录 C 源码地图 (按章对应到 Claude Code 源码位置)

## 触发器判定

- 触发器: Claude Code 源码视角的 Harness Engineering 系统化方法论;系统骨架级而非功能级。
- 当前状态: triaged。核心结论由合集 topic、harness-engineering 概念页与 OpenClaw/Claude Code/Hermes 对比页承接。

## 已沉淀去向

- [topics/agentway-harness-books.md](../../topics/agentway-harness-books.md)
- [concepts/harness-engineering.md](../../concepts/harness-engineering.md)
- [comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md](../../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)
- [topics/agent-evaluation-deep-dive.md](../../topics/agent-evaluation-deep-dive.md) (验证必须独立)

## 待升级 / 待复核

- 进入 E1-E9 章节、DeepSeek 桌面端 Agent 设计或 Claude Code 实体页深拆时按本书核验。
