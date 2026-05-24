# AI Agent Competitive Analysis

26 个 AI Agent 产品(14 通用 + 12 编码)的竞品分析自动化管道。基于 Karpathy LLM Wiki 模式 + JD 校准的双类目维度库。

**Status:** Phase 1 MVP

## Spec & Plan

- Design spec: `docs/superpowers/specs/2026-05-23-ai-agent-competitive-analysis-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-24-phase1-mvp.md`

## Phase 1 MVP coverage

- ✅ Pydantic schemas (Product / Dimension / ProductEvaluation w/ 4-level Confidence)
- ✅ Wiki layout (Karpathy 三件套 + topics/concepts + review)
- ✅ L0 adapters (GitHub Releases / RSS / docs sitemap)
- ✅ Two-step CoT ingest engine
- ✅ SHA256 incremental cache
- ✅ Async Review queue
- ✅ Path A end-to-end sync
- ✅ 9 slash commands CLI

## Quick start

```bash
# Install
uv sync --all-extras

# Init wiki
uv run wiki init

# Run all tests
uv run pytest

# (Phase 2 onwards) Compile 5 P0 products
uv run wiki compile --only claude-code,cursor,codex,hermes,manus
```

## Architecture

See spec §3-§10. Key modules:
- `packages/llm_wiki/` — 知识中枢
- `packages/docs_link_collector/` — 文档雷达
- `packages/ai_agent_research/` — 动态追踪器(Phase 2)
- `packages/competitive_analysis/` — 对比输出引擎(Phase 3)
- `adapters/layer{0,1,2,3}_*/` — 数据源适配器

## Roadmap

| Phase | 时长 | 目标 |
|---|---|---|
| 1 (current) | 2 周 | MVP — 5 P0 产品端到端跑通 Path A |
| 2 | 1 周 | Path B 增量链 + L1/L2 数据源 |
| 3 | 2 周 | Path C 对比引擎 + 渲染层 |
| 4 | 持续 | 6 篇 PM 作品集报告 + DeepSeek 风 PPT |
| 5 | 持续 | P2 长尾产品扩展 + 维度库迭代 |
