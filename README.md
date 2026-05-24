# AI Agent Competitive Analysis

26 个 AI Agent 产品(14 通用 + 12 编码)的竞品分析自动化管道。基于 Karpathy LLM Wiki 模式 + JD 校准的双类目维度库。

**Status:** Phase 4 complete (PM 作品集报告管线 + 6 篇 DeepSeek 应聘材料)

## Spec & Plan

- Design spec: `docs/superpowers/specs/2026-05-23-ai-agent-competitive-analysis-design.md`
- Phase 1 plan: `docs/superpowers/plans/2026-05-24-phase1-mvp.md`
- Phase 2 plan: `docs/superpowers/plans/2026-05-24-phase2-changelog-incremental.md`
- Phase 3 plan: `docs/superpowers/plans/2026-05-24-phase3-comparison-engine.md`
- Phase 4 plan: `docs/superpowers/plans/2026-05-24-phase4-pm-portfolio.md`
- **应聘材料索引:** `docs/job-application/README.md`

## Phase 1 MVP coverage

- ✅ Pydantic schemas (Product / Dimension / ProductEvaluation w/ 4-level Confidence)
- ✅ Wiki layout (Karpathy 三件套 + topics/concepts + review)
- ✅ L0 adapters (GitHub Releases / RSS / docs sitemap)
- ✅ Two-step CoT ingest engine
- ✅ SHA256 incremental cache
- ✅ Async Review queue
- ✅ Path A end-to-end sync
- ✅ 9 slash commands CLI

Phase 1.1 hardening: atomic file writes (tempfile + os.replace), RSS timezone-aware parsing, IngestEngine error handling.

## Phase 2 coverage

- ✅ ChangelogEntry schema with 7-source enum (tz-aware validator)
- ✅ Signal aggregator (dedup by URL + product association by keyword)
- ✅ L1 adapters: AIHOT / wechat-article-search / TrendRadar
- ✅ L2 adapter: multi-search-engine (DDG MVP cross-verifier)
- ✅ 3-factor importance scorer (signal count × 0.4 + source weight × 0.3 + LLM relevance × 0.3)
- ✅ Per-product daily changelog reports (`wiki/changelog/{product}/{date}.md`)
- ✅ Path B end-to-end orchestrator (sync_path_b)
- ✅ Feishu bot push for high-score changes (Layer 3 notify)
- ✅ CLI: `wiki path-b` + `wiki notify` (11 commands total)
- ✅ GitHub Actions daily cron at UTC 00:00 (北京 08:00)

## Phase 4 coverage

- ✅ ReportTheme enum (6 JD-aligned themes) + PortfolioReportRequest schema
- ✅ 6 主题 prompts (Harness Engineering / Context Engineering / Tool Ecosystem / Cache / Open Source / Co-evolution)
- ✅ PortfolioReportEngine (wiki facts + theme prompt → free-form LLM long-form essay)
- ✅ DeepSeek-style portfolio renderers (markdown + Marp deck with 蓝绿色 palette)
- ✅ LLMClient.complete(prompt) protocol — bypasses dimension-card hardcoding
- ✅ 11-dim schema expansion (J5 cache + N1-N5 community + M1-M5 co-evolution)
- ✅ CLI: `wiki portfolio --theme <slug>` / `--all` (12 commands total)
- ✅ 6 篇真实 LLM 长文报告产出（130-225 行 MD + 150-250 行 deck），3 个 P0 产品 (claude-code/cursor/codex)
- ✅ 应聘材料归档: `docs/job-application/`

## Phase 3 coverage

- ✅ ComparisonRequest schema (baseline + compare list + dim filter + format enum)
- ✅ WikiQuery layer (reads `_provenance.json` per product, optional dim filter)
- ✅ CrossSourceVerifier (L2 fallback with UNVERIFIED placeholders for missing evals)
- ✅ ComparisonMatrix builder (dim × product grid with verifier-filled cells)
- ✅ Markdown renderer (Jinja2 template with table + per-dim detail)
- ✅ HTML renderer (self-contained single file with embedded CSS + confidence badges)
- ✅ PPTX renderer (Marp-flavored markdown → optional `marp` CLI subprocess)
- ✅ Feishu wiki sync (single-direction MVP via `feishu` skill subprocess)
- ✅ Path C end-to-end orchestrator (`sync_path_c` writes to `wiki/reports/on-demand/`)
- ✅ CLI: `wiki compare` real impl with `--formats`, `--dims`, `--feishu-parent`
- ✅ Smoke verified: 141 tests passing; `wiki compare claude-code cursor` produces md+html

## Quick start

```bash
# Install
uv sync --all-extras

# Init wiki
uv run wiki init

# Run all tests
uv run pytest

# Phase 1: Compile P0 products via Path A
uv run wiki compile --only claude-code,cursor,codex,hermes,manus

# Phase 2: Run daily changelog incremental (Path B)
uv run wiki path-b --threshold 0.5
uv run wiki notify

# Phase 3: On-demand comparison report (Path C)
uv run wiki compare claude-code cursor --formats markdown,html
uv run wiki compare claude-code cursor codex --dims E5,F3 --formats markdown,html,pptx
# Output: wiki/reports/on-demand/{baseline}-vs-{compare}-{timestamp}/comparison.{md,html,pptx}

# Phase 4: PM portfolio reports (DeepSeek 应聘作品)
uv run wiki portfolio --theme harness-design --products claude-code,cursor,codex
uv run wiki portfolio --all --products claude-code,cursor,codex
# Output: wiki/reports/portfolio/{theme}/report.md + deck.marp.md
```

## Architecture

See spec §3-§10. Key modules:

- `packages/llm_wiki/` — 知识中枢 (Karpathy wiki + ingest engine)
- `packages/docs_link_collector/` — 文档雷达
- `packages/ai_agent_research/` — 动态追踪器 (Phase 2)
  - `changelog_entry.py` — ChangelogEntry schema
  - `aggregator.py` — SignalAggregator (dedup + product association)
  - `scorer.py` — 3-factor importance scoring
  - `changelog_ingest.py` — per-product daily report writer
  - `path_b_sync.py` — Path B orchestration
- `packages/competitive_analysis/` — 对比输出引擎 (Phase 3)
  - `comparison_request.py` — ComparisonRequest schema + OutputFormat enum
  - `wiki_query.py` — WikiQuery (provenance reader)
  - `verifier.py` — CrossSourceVerifier (L2 fallback for missing evals)
  - `matrix_builder.py` — ComparisonMatrix builder (dim × product)
  - `path_c_sync.py` — Path C orchestrator (build matrix → render → write)
- `render/` — 渲染层 (Phase 3)
  - `md_renderer.py` — Jinja2 markdown comparison report
  - `html_renderer.py` — self-contained HTML with embedded CSS
  - `pptx_renderer.py` — Marp-flavored markdown + optional `marp` CLI → PPTX
  - `feishu_sync.py` — single-direction sync to 飞书 Wiki via skill subprocess
- `adapters/`:
  - `layer0_official/` — GitHub Releases / RSS / docs sitemap (Phase 1)
  - `layer1_radar/` — AIHOT / wechat-article-search / TrendRadar (Phase 2)
  - `layer2_search/` — multi-search-engine cross-verification (Phase 2)
  - `layer3_notify/` — Feishu bot webhook (Phase 2)

## Roadmap

| Phase | 时长 | 目标 | Status |
|---|---|---|---|
| 1 | 2 周 | MVP — 5 P0 产品端到端跑通 Path A | ✅ Complete |
| 2 | 1 周 | Path B 增量链 + L1/L2 数据源 | ✅ Complete |
| 3 | 2 周 | Path C 对比引擎 + 渲染层 | ✅ Complete |
| 4 | 1 天 | 6 篇 PM 作品集报告 + DeepSeek 风 PPT | ✅ Complete |
| 5 | 持续 | P2 长尾产品扩展 + 维度库迭代 (含 hermes/manus seed) | Pending |
