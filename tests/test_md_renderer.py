"""Tests for `pipeline.renderers.md_renderer.render_markdown`.

The renderer turns a `ComparisonMatrix` into a Markdown report consumed by
humans (and feishu wiki sync downstream). Tests focus on:
  - Title + generated_at header section
  - Comparison matrix table with N+1 columns (Dimension + each product)
  - Per-dimension detail sections with rubric / values / evidence
  - Empty matrix edge case (no dims / products beyond baseline) does not crash
"""

from datetime import datetime

import pytest

from pipeline.core.competitive_analysis.matrix_builder import ComparisonMatrix
from pipeline.core.schemas.dimension import Dimension
from pipeline.core.schemas.evaluation import Confidence, ProductEvaluation
from pipeline.core.schemas.product import Product
from pipeline.renderers.md_renderer import render_markdown


def _build_test_matrix() -> ComparisonMatrix:
    """Reusable two-product / one-dim fixture with EXTRACTED evidence."""
    p1 = Product(
        id="claude-code",
        name="Claude Code",
        category="coding",
        priority="P0",
        homepage="https://x.test",
        keywords=["x"],
    )
    p2 = Product(
        id="cursor",
        name="Cursor",
        category="coding",
        priority="P0",
        homepage="https://x.test",
        keywords=["x"],
    )
    dim = Dimension(
        id="E5",
        name="Custom tools",
        group="E. Agent Harness 执行",
        importance="critical",
        weight_in_group_pct=22.0,
        evaluation_type="score_0_3",
        rubric="0=none / 1=fn / 2=skill / 3=skill+hook",
        data_sources=["L0"],
    )

    def _ev(pid: str, val: int) -> ProductEvaluation:
        return ProductEvaluation(
            product_id=pid,
            dimension_id="E5",
            value=val,
            evidence_urls=[f"https://docs.{pid}.test/skills"],
            evaluator="llm:claude",
            confidence=Confidence.EXTRACTED,
            last_verified=datetime(2026, 5, 24),
        )

    return ComparisonMatrix(
        product_order=["claude-code", "cursor"],
        dimension_order=["E5"],
        cells={"E5": {"claude-code": _ev("claude-code", 3), "cursor": _ev("cursor", 2)}},
        products={"claude-code": p1, "cursor": p2},
        dimensions={"E5": dim},
    )


def test_render_basic_matrix_includes_title_and_table_cells() -> None:
    md = render_markdown(_build_test_matrix(), title="Test Comparison")

    assert "Test Comparison" in md
    # Header line uses the H1 prefix
    assert "# Test Comparison" in md
    # Both product names appear (table header + per-dim detail)
    assert "Claude Code" in md
    assert "Cursor" in md
    # Dim id + name surface
    assert "E5" in md
    assert "Custom tools" in md
    # Baseline value cell
    assert "| 3 |" in md
    # Compare value cell
    assert "| 2 |" in md


def test_render_includes_per_dim_detail_with_rubric_and_evidence() -> None:
    md = render_markdown(_build_test_matrix(), title="Detail Check")

    # Per-dim section header
    assert "## Per-Dimension Detail" in md
    # Rubric text passed through
    assert "0=none / 1=fn / 2=skill / 3=skill+hook" in md
    # Confidence label rendered alongside value
    assert "extracted" in md.lower()
    # Evidence URL appears as markdown link
    assert "https://docs.claude-code.test/skills" in md


def test_render_baseline_callout_uses_first_product_in_order() -> None:
    md = render_markdown(_build_test_matrix(), title="Baseline Check")

    # Generated-at preamble names baseline product
    assert "Baseline" in md
    assert "Claude Code" in md
    # Baseline appears before compare in table header
    table_section = md.split("## Comparison Matrix", 1)[1]
    baseline_idx = table_section.find("Claude Code")
    compare_idx = table_section.find("Cursor")
    assert 0 <= baseline_idx < compare_idx


def test_render_empty_matrix_does_not_crash() -> None:
    """A matrix with one product and zero dims should still render a valid header."""
    p1 = Product(
        id="claude-code",
        name="Claude Code",
        category="coding",
        priority="P0",
        homepage="https://x.test",
        keywords=["x"],
    )
    matrix = ComparisonMatrix(
        product_order=["claude-code"],
        dimension_order=[],
        cells={},
        products={"claude-code": p1},
        dimensions={},
    )

    md = render_markdown(matrix, title="Empty")

    assert "# Empty" in md
    assert "Claude Code" in md
    # No KeyError / template crash
    assert "## Comparison Matrix" in md


def test_render_default_title_when_omitted() -> None:
    md = render_markdown(_build_test_matrix())

    # Default title kicks in
    assert "# Product Comparison" in md


@pytest.mark.parametrize(
    "confidence,expected_label",
    [
        (Confidence.EXTRACTED, "extracted"),
        (Confidence.AMBIGUOUS, "ambiguous"),
        (Confidence.UNVERIFIED, "unverified"),
    ],
)
def test_render_surfaces_each_confidence_level(
    confidence: Confidence, expected_label: str
) -> None:
    matrix = _build_test_matrix()
    # Mutate the cursor cell to vary confidence (matrix dataclass is frozen but
    # `cells` dict is mutable inside it — that's fine for this test).
    cell = matrix.cells["E5"]["cursor"]
    matrix.cells["E5"]["cursor"] = cell.model_copy(update={"confidence": confidence})

    md = render_markdown(matrix, title="Confidence Check")

    assert expected_label in md.lower()
