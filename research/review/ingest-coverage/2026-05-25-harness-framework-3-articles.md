---
id: coverage-harness-framework-3-articles
type: ingest-coverage
status: closed
updated: 2026-05-25
scope: "3 篇阿里云开发者定向补充文章 + 66 篇 Harness 合集统计重跑"
---

# 入库覆盖账本 · OpenClaw / Claude Code / Hermes 三篇闭环

## 1. 本批素材

| # | 原文 | 触发器 | 单篇卡 | 成品页去向 | SKIP |
|---|---|---|---|---|---|
| 1 | [OpenClaw 三层设计](../../raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md) | 产品深度拆解 / 新机制 / 对比素材 / 运行风险 | [source card](../source-cards/2026-05-25-openclaw-prompt-context-harness.md) | [entity](../../entities/openclaw.md) / [comparison](../../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md) / [timeline](../../timelines/agent-harness-design-evolution.md) / [lesson](../../lessons/prompt-only-agent-is-not-production.md) | 无 |
| 2 | [Claude Code 三层设计](../../raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md) | 产品深度拆解 / 维度库影响 / 对比素材 / 运行风险 | [source card](../source-cards/2026-05-25-claude-code-prompt-context-harness.md) | [entity](../../entities/claude-code.md) / [comparison](../../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md) / [timeline](../../timelines/agent-harness-design-evolution.md) / [lesson](../../lessons/prompt-only-agent-is-not-production.md) | 无 |
| 3 | [Hermes Agent 自进化](../../raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md) | 产品深度拆解 / 新机制 / 维度库影响 / 运行风险 | [source card](../source-cards/2026-05-25-hermes-agent-self-evolution.md) | [entity](../../entities/hermes-agent.md) / [comparison](../../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md) / [timeline](../../timelines/agent-harness-design-evolution.md) / [lesson](../../lessons/prompt-only-agent-is-not-production.md) | 无 |

## 2. 证据消化

| 成品页 | 吸收的原文 | 关键结论数 | 证据状态 |
|---|---:|---:|---|
| [OpenClaw](../../entities/openclaw.md) | 1 | 5 | 已映射到原文 |
| [Claude Code](../../entities/claude-code.md) | 2 | 5 | 已映射到原文 + compiled |
| [Hermes Agent](../../entities/hermes-agent.md) | 2 | 5 | 已映射到原文 + compiled |
| [三产品运行架构对比](../../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md) | 3 | 3 | 每个产品至少 1 条来源映射 |
| [Agent Harness 设计范式演进](../../timelines/agent-harness-design-evolution.md) | 3 | 3 | 每个时间节点有来源 |
| [Prompt-only lesson](../../lessons/prompt-only-agent-is-not-production.md) | 3 | 4 | 由 3 篇共同反推 |

## 3. 未沉淀内容与原因

| 原文 | 未沉淀内容 | reason_code | 原因 |
|---|---|---|---|
| OpenClaw | 社区热度叙事、长段 Prompt 原文 | covered-by-raw | 对竞品判断弱,原文已保留 |
| Claude Code | 可能随版本变化的内部模式、模型名、趣味细节 | pending-human-review | 需要官方来源或后续版本复核 |
| Hermes Agent | RL 参数细节、外部记忆服务长清单 | pending-human-review | 需要论文/代码复核后再进入正式机制页 |

## 4. 66 篇回头重跑结果

已重跑:

- `scripts/analyze_harness_collection.py`
- `scripts/entity_scan.py`

产物:

- [term-frequency.md](../../analysis/term-frequency.md)
- [entity-scan.md](../../analysis/entity-scan.md)

关键变化:

| 指标 | 新结果 |
|---|---:|
| 文章数 | 66 |
| OpenClaw DF / TF | 21 / 143 |
| Claude Code DF / TF | 38 / 269 |
| Hermes DF / TF | 8 / 58 |
| 渐进式披露 DF / TF | 23 / 58 |
| 评测/Eval DF / TF | 22 / 137 |

## 5. 涟漪检查

| 受影响位置 | 状态 | 说明 |
|---|---|---|
| `wiki/index.md` | 已更新 | 新增 framework / entities / comparison / timeline / lesson / source cards / coverage 入口 |
| `wiki/analysis/*` | 已更新 | 63 篇旧统计已重跑为 66 篇 |
| `wiki/topics/harness-engineering-community-synthesis.md` | 已更新 | 数字口径需要从 63 调整到 66 |
| `wiki/topics/openclaw-claude-code-hermes-comparison.md` | 已更新 | 与正式 comparison 页互链 |
| `wiki/compiled/claude-code/_provenance.json` | 待更新 | 这批是中文社区证据,不直接覆盖官方维度值 |
| `wiki/compiled/hermes/_provenance.json` | 待更新 | 后续可补 M2/F3 社区证据 |
| 6 篇 portfolio report | 待更新 | 多处仍写 63 篇旧口径,应单独开一轮报告刷新 |

## 6. 质量检查

| 检查项 | 结果 |
|---|---|
| 原文存在 | 通过 |
| 单篇卡 | 通过,3/3 |
| 成品页 | 通过,新增 6 页 |
| 证据映射 | 通过,关键结论均有来源 |
| SKIP 原因 | 通过,未沉淀内容已说明 |
| 首页入口 | 通过 |
| 日志 | 通过 |

