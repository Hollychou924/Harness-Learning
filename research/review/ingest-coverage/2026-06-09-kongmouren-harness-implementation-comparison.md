---
id: coverage-kongmouren-harness-implementation-2026-06-09
type: ingest-coverage
status: triaged
updated: 2026-06-09
scope: "孔某人的低维认知 Agent Harness 实现对比系列 2 篇(Memory + Context 压缩)入库 + 去向"
---

# 入库覆盖账本 · 孔某人 Harness 实现对比(2 篇)

## 1. 总览

- 覆盖 raw: **2 篇**(`raw/community-posts/harness-implementation-comparison/`)
- 升级成品: **1 comparison + 1 concept + 1 topic + 3 entity 更新 + 1 concept 更新**
- 触发依据(SOP 3.2):同主题 ≥2 篇 → 新建/更新 concept;明确比较多产品 → 新建 comparison;同主题成体系 → topic 综述。
- 用途: 给 E4「上下文与记忆篇」补源码级一手对照,校准 compact 分级、token 估算、Codex 服务端压缩等细节。

## 2. 逐篇去向

| # | 原文 | 来源 | 去向 | 关键弹药 |
|---:|---|---|---|---|
| 1 | 主流 Agent Harness 实现对比——Memory 篇(2026-06-03) | 孔某人的低维认知 | comparison + concept(memory-synthesis-dreaming 更新)+ entity(claude-code/codex/openclaw)+ topic | 不记什么/不信什么;Claude Code 增量编辑 vs Codex 批量挖掘;召回前核实;OpenClaw RAG 实现最差;无原生记忆一档 |
| 2 | 主流 Agent Harness 实现对比——Context 压缩(2026-06-09) | 孔某人的低维认知 | comparison + concept(context-compaction 新建)+ entity(claude-code/codex)+ topic | bytes/4 估 token;Claude Code 4 种压缩;Codex 3 路服务端压缩+encrypted_content;OpenCode/Pi 模板+增量摘要;Hermes 防幽灵注入 |

## 3. 成品页清单

- 新建 `comparisons/harness-memory-compaction-implementation.md`
- 新建 `concepts/context-compaction.md`
- 新建 `topics/harness-implementation-comparison-kongmouren.md`
- 更新 `concepts/memory-synthesis-dreaming.md`(补 Coding Agent 实现级对照 + sources)
- 更新 `entities/claude-code.md` `entities/codex.md` `entities/openclaw.md`(各加 2.1 源码级细节)

## 4. SKIP+REASON

- 无 SKIP。两篇均为高信号源码级一手材料,全部升级。

## 5. 涟漪 / 待更新

- 已更新:index.md、相关页面互链、上述 5 个 entity/concept。
- 待办:E4 飞书初稿对照更新(本轮已产出对照清单,交用户决策后再改稿);该系列后续连载(Subagent/动态 workflow/非线性 context)需另行入库。
