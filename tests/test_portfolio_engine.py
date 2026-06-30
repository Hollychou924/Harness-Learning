"""Tests for PortfolioReportEngine — long-form MD generation flow."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest

from pipeline.core.competitive_analysis.portfolio.engine import PortfolioReportEngine
from pipeline.core.competitive_analysis.portfolio.theme import (
    PortfolioReportRequest,
    ReportTheme,
)
from pipeline.core.llm_wiki.ingest import StubLLM
from pipeline.core.llm_wiki.paths import WikiLayout, init_wiki
from pipeline.core.llm_wiki.provenance import write_provenance
from pipeline.core.schemas.evaluation import Confidence, ProductEvaluation


def _seed_evaluation(
    tmp_wiki: Path,
    *,
    product_id: str,
    dimension_id: str,
    value: int = 2,
) -> None:
    """Write a minimal compiled provenance record for a product × dim."""
    product_dir = tmp_wiki / "compiled" / product_id
    product_dir.mkdir(parents=True, exist_ok=True)
    write_provenance(
        product_dir,
        [
            ProductEvaluation(
                product_id=product_id,
                dimension_id=dimension_id,
                value=value,
                evidence_urls=["https://x.test/evidence"],
                evaluator="seed",
                confidence=Confidence.EXTRACTED,
                last_verified=datetime(2026, 5, 24),
            ),
        ],
    )


async def test_engine_generates_long_form_md(tmp_wiki: Path) -> None:
    """When wiki data exists, engine returns the LLM markdown verbatim."""
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    for pid in ["claude-code", "cursor"]:
        _seed_evaluation(tmp_wiki, product_id=pid, dimension_id="E5")

    fake_md = "# 测试报告\n\n执行摘要...\n\n## 模式 1\n...\n"
    stub = StubLLM(complete_response=fake_md)
    engine = PortfolioReportEngine(layout=layout, llm=stub)

    request = PortfolioReportRequest(
        theme=ReportTheme.HARNESS_DESIGN,
        product_ids=["claude-code", "cursor"],
    )
    result = await engine.generate(request)

    assert "# 测试报告" in result
    assert result == fake_md


async def test_engine_returns_placeholder_when_no_wiki_data(
    tmp_wiki: Path,
) -> None:
    """No compiled provenance → placeholder markdown, no LLM call result used."""
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)

    # Stub would return this if it were called — but the engine should
    # short-circuit before invoking the LLM at all.
    stub = StubLLM(complete_response="SHOULD_NOT_APPEAR")
    engine = PortfolioReportEngine(layout=layout, llm=stub)

    request = PortfolioReportRequest(
        theme=ReportTheme.CACHE_STRATEGY,
        product_ids=["claude-code"],
        title="缓存策略对比",
    )
    result = await engine.generate(request)

    assert "SHOULD_NOT_APPEAR" not in result
    assert result.startswith("# 缓存策略对比")
    assert "暂无 wiki 数据" in result


async def test_engine_passes_theme_outline_and_facts_to_llm(
    tmp_wiki: Path,
) -> None:
    """Engine composes prompt body containing outline + product fact lines.

    We capture the source/draft passed to ``llm.generate`` to verify the
    prompt assembly, since this is the load-bearing contract between engine
    and LLM client.
    """
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    _seed_evaluation(
        tmp_wiki, product_id="claude-code", dimension_id="J5", value=3,
    )

    captured: dict[str, object] = {}

    class CapturingLLM(StubLLM):
        def complete(self, prompt):  # type: ignore[override]
            captured["prompt"] = prompt
            return super().complete(prompt)

    stub = CapturingLLM(complete_response="# OK\n")
    engine = PortfolioReportEngine(layout=layout, llm=stub)

    request = PortfolioReportRequest(
        theme=ReportTheme.CACHE_STRATEGY,
        product_ids=["claude-code"],
    )
    await engine.generate(request)

    body = captured["prompt"]
    assert isinstance(body, str)
    assert "KV Cache / Prompt Cache" in body  # theme.jd_keyword
    assert "[claude-code] J5=3" in body  # fact line
    assert "https://x.test/evidence" in body  # evidence URL
    assert "Prompt Cache 是什么" in body  # outline section from prompt spec


async def test_engine_respects_dimension_filter_override(
    tmp_wiki: Path,
) -> None:
    """When request.dimension_filter is set, theme defaults are ignored."""
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    # Seed a dim that is NOT in HARNESS_DESIGN's defaults.
    _seed_evaluation(
        tmp_wiki, product_id="claude-code", dimension_id="Z9", value=1,
    )

    captured_body: dict[str, str] = {}

    class CapturingLLM(StubLLM):
        def complete(self, prompt):  # type: ignore[override]
            captured_body["content"] = prompt
            return super().complete(prompt)

    stub = CapturingLLM(complete_response="# OK\n")
    engine = PortfolioReportEngine(layout=layout, llm=stub)

    request = PortfolioReportRequest(
        theme=ReportTheme.HARNESS_DESIGN,
        product_ids=["claude-code"],
        dimension_filter=["Z9"],
    )
    result = await engine.generate(request)

    assert result == "# OK\n"
    assert "[claude-code] Z9=1" in captured_body["content"]
