---
id: source-card-book-agentway-2-claude-code-vs-codex
type: source-card
status: triaged
source: wiki/raw/books/agentway/2026-04-01-agentway-claude-code-vs-codex-comparative-harness-notes.md
updated: 2026-05-26
---

# AGENTWAY Books 卡 · Claude Code 和 Codex 的 Harness 设计哲学

## 原文信息

- 来源: agentway.dev / AGENTWAY COMPARATIVE HARNESS NOTES 系列
- 副标题: CONTROL / LOOP / POLICY / STATE / LOCAL GOVERNANCE / VERIFICATION
- 版本: 2026-04-01 rev 37dfc2
- 页数: 54
- 原文: [raw](../../raw/books/agentway/2026-04-01-agentway-claude-code-vs-codex-comparative-harness-notes.md)
- 来源 URL: https://agentway.dev

## 章节速览

- 序言 两套 Harness: Claude Code 控制流先落地 (Runtime Discipline,秩序住在运行时) vs Codex 制度层先设防 (Policy and Local Rules,规矩住在系统外沿)
- 第 1 章 为什么要把它们放在一起看: 它们比较的是对模型的"不信任",起笔位置不同
- 第 2 章 两种控制面: Claude Code = 动态装配线 / Codex = 带编号的公文系统;CLAUDE.md vs AGENTS.md 气质不同
- 第 3 章 心跳放在哪: Claude Code 把连续性压进主循环;Codex 把连续性拆成线程/rollout/状态桥
- 第 4 章 工具、沙箱与策略语言: Claude Code 重点在运行时编排和危险动作约束;Codex 重点在工具 schema、审批参数和策略引擎
- 第 5 章 技能、Hook 与本地规则: Claude Code 把局部制度做成现场记忆 (经验收编);Codex 做成结构化注入和事件系统 (制度挂载)
- 第 6 章 委派、验证与持久状态: Claude Code 多代理服务于运行时职责分区;Codex 多代理服务于显式工具化协作
- 第 7 章 殊途同归,还是各表一枝: 同归 = 都承认模型不可靠;各表 = 秩序住在不同层
- 第 8 章 如果你要自己做: 三种常见团队三种起手方向;什么该学 Claude Code,什么该学 Codex
- 附录 A 源码地图 (Claude Code + Codex 双视角)
- 附录 B 检查清单 (控制面/连续性/工具审批/本地治理/多代理验证 + "你更像哪一类" 判断 + 最后六问)

## 触发器判定

- 触发器: Claude Code vs Codex 的 Harness 设计哲学比较,源码级判断 + 路线选择建议。
- 当前状态: triaged。

## 已沉淀去向

- [topics/agentway-harness-books.md](../../topics/agentway-harness-books.md)
- [comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md](../../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)
- [concepts/harness-engineering.md](../../concepts/harness-engineering.md)
- [entities/codex.md](../../entities/codex.md)
- [entities/claude-code.md](../../entities/claude-code.md)

## 待升级 / 待复核

- DeepSeek 桌面端 Agent 选 Claude Code 路线 vs Codex 路线时按本书"如果你要自己做"章重新核验。
