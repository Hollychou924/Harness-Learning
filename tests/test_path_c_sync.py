"""Tests for Path C end-to-end orchestrator.

Wires WikiQuery + MatrixBuilder + renderers + atomic writes + optional feishu
sync. Tests use real fixtures (provenance JSON on disk) so no verifier network
fallback is hit.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pytest

from packages.competitive_analysis.comparison_request import (
    ComparisonRequest,
    OutputFormat,
)
from packages.competitive_analysis.path_c_sync import sync_path_c
from packages.llm_wiki.paths import WikiLayout, init_wiki
from packages.llm_wiki.provenance import write_provenance
from packages.schemas.dimension import Dimension
from packages.schemas.evaluation import Confidence, ProductEvaluation
from packages.schemas.product import Product


def _make_eval(pid: str, did: str, value: int) -> ProductEvaluation:
    return ProductEvaluation(
        product_id=pid,
        dimension_id=did,
        value=value,
        evidence_urls=["https://x.test/evidence"],
        evaluator="llm:claude",
        confidence=Confidence.EXTRACTED,
        last_verified=datetime(2026, 5, 24),
    )


def _seed_wiki(wiki_root: Path, *, dim_id: str = "E5") -> None:
    """Populate compiled/<pid>/_provenance.json for two products so the
    verifier fallback never fires (no httpx calls during tests)."""
    for pid, value in [("claude-code", 3), ("cursor", 2)]:
        product_dir = wiki_root / "compiled" / pid
        product_dir.mkdir(parents=True, exist_ok=True)
        write_provenance(product_dir, [_make_eval(pid, dim_id, value)])


def _products() -> dict[str, Product]:
    return {
        "claude-code": Product(
            id="claude-code",
            name="Claude Code",
            category="coding",
            priority="P0",
            homepage="https://x.test",
            keywords=["claude"],
        ),
        "cursor": Product(
            id="cursor",
            name="Cursor",
            category="coding",
            priority="P0",
            homepage="https://x.test",
            keywords=["cursor"],
        ),
    }


def _dimensions() -> list[Dimension]:
    return [
        Dimension(
            id="E5",
            name="Custom tools",
            group="E. Agent Harness 执行",
            importance="critical",
            weight_in_group_pct=22.0,
            evaluation_type="score_0_3",
            rubric="0=none / 1=fn / 2=skill / 3=skill+hook",
            data_sources=["L0:official_docs"],
        ),
    ]


@pytest.mark.asyncio
async def test_path_c_writes_markdown_only(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    _seed_wiki(tmp_wiki)

    request = ComparisonRequest(
        baseline_product_id="claude-code",
        compare_product_ids=["cursor"],
        output_formats=[OutputFormat.MARKDOWN],
    )

    result = await sync_path_c(
        request=request,
        layout=layout,
        products_index=_products(),
        dimensions=_dimensions(),
    )

    assert "markdown" in result
    md_path = Path(result["markdown"])
    assert md_path.exists()
    content = md_path.read_text(encoding="utf-8")
    assert "Claude Code" in content
    assert "Cursor" in content
    assert "E5" in content

    # Output dir naming convention: {baseline}-vs-{compare}-{timestamp}
    assert md_path.parent.name.startswith("claude-code-vs-cursor-")
    assert md_path.parent.parent == layout.reports / "on-demand"

    # log.md should record the path-c entry
    log_text = layout.log.read_text(encoding="utf-8")
    assert "path-c" in log_text


@pytest.mark.asyncio
async def test_path_c_writes_markdown_html_and_marp(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    _seed_wiki(tmp_wiki)

    request = ComparisonRequest(
        baseline_product_id="claude-code",
        compare_product_ids=["cursor"],
        output_formats=[
            OutputFormat.MARKDOWN,
            OutputFormat.HTML,
            OutputFormat.PPTX,
        ],
        title="Claude Code vs Cursor — E5 deep dive",
    )

    # Force `marp` CLI to appear absent so the test never shells out.
    with patch("render.pptx_renderer.shutil.which", return_value=None):
        result = await sync_path_c(
            request=request,
            layout=layout,
            products_index=_products(),
            dimensions=_dimensions(),
        )

    # markdown + html + marp_source written; pptx skipped because marp CLI absent.
    assert set(result.keys()) >= {"markdown", "html", "marp_source"}
    assert "pptx" not in result

    md_path = Path(result["markdown"])
    html_path = Path(result["html"])
    marp_path = Path(result["marp_source"])
    for p in (md_path, html_path, marp_path):
        assert p.exists()
    assert md_path.parent == html_path.parent == marp_path.parent

    html_text = html_path.read_text(encoding="utf-8")
    assert "<!DOCTYPE html>" in html_text
    assert "Claude Code" in html_text

    marp_text = marp_path.read_text(encoding="utf-8")
    assert marp_text.startswith("---")
    assert "marp: true" in marp_text


@pytest.mark.asyncio
async def test_path_c_dimension_filter(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    _seed_wiki(tmp_wiki, dim_id="E5")

    # Pass two dimensions but filter to only E5 — F3 must not appear.
    dims = [
        *_dimensions(),
        Dimension(
            id="F3",
            name="Hooks",
            group="F. Lifecycle",
            importance="high",
            weight_in_group_pct=10.0,
            evaluation_type="score_0_3",
            rubric="-",
            data_sources=["L0"],
        ),
    ]

    request = ComparisonRequest(
        baseline_product_id="claude-code",
        compare_product_ids=["cursor"],
        dimension_filter=["E5"],
        output_formats=[OutputFormat.MARKDOWN],
    )

    result = await sync_path_c(
        request=request,
        layout=layout,
        products_index=_products(),
        dimensions=dims,
    )

    md_text = Path(result["markdown"]).read_text(encoding="utf-8")
    assert "E5" in md_text
    assert "F3" not in md_text


@pytest.mark.asyncio
async def test_path_c_feishu_only_when_parent_node_provided(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    _seed_wiki(tmp_wiki)

    request = ComparisonRequest(
        baseline_product_id="claude-code",
        compare_product_ids=["cursor"],
        output_formats=[OutputFormat.FEISHU],
    )

    # No feishu_parent_node passed → feishu sync must not be attempted.
    with patch(
        "packages.competitive_analysis.path_c_sync.sync_to_feishu_wiki"
    ) as mock_sync:
        result = await sync_path_c(
            request=request,
            layout=layout,
            products_index=_products(),
            dimensions=_dimensions(),
        )

    mock_sync.assert_not_called()
    assert "feishu" not in result


@pytest.mark.asyncio
async def test_path_c_feishu_sync_invoked_with_parent_node(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    _seed_wiki(tmp_wiki)

    request = ComparisonRequest(
        baseline_product_id="claude-code",
        compare_product_ids=["cursor"],
        output_formats=[OutputFormat.MARKDOWN, OutputFormat.FEISHU],
    )

    with patch(
        "packages.competitive_analysis.path_c_sync.sync_to_feishu_wiki",
        return_value=True,
    ) as mock_sync:
        result = await sync_path_c(
            request=request,
            layout=layout,
            products_index=_products(),
            dimensions=_dimensions(),
            feishu_parent_node="parent_xyz",
        )

    mock_sync.assert_called_once()
    kwargs = mock_sync.call_args.kwargs
    assert kwargs["parent_node_token"] == "parent_xyz"
    assert "Claude Code" in kwargs["markdown"]
    assert result["feishu"] == "synced"
