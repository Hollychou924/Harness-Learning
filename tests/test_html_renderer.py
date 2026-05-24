"""Tests for `render.html_renderer.render_html`.

The HTML renderer turns a `ComparisonMatrix` into a self-contained HTML
document with embedded CSS (no external assets). Tests focus on:
  - DOCTYPE + `<title>` + embedded `<style>` block present
  - Comparison table with header row + data row
  - Confidence-level CSS classes per cell (.confidence-EXTRACTED etc.)
  - Per-dimension detail section with rubric and product values
  - Autoescape ON: titles containing HTML metacharacters are escaped
"""

from datetime import datetime

import pytest

from packages.competitive_analysis.matrix_builder import ComparisonMatrix
from packages.schemas.dimension import Dimension
from packages.schemas.evaluation import Confidence, ProductEvaluation
from packages.schemas.product import Product
from render.html_renderer import render_html


def _build_test_matrix() -> ComparisonMatrix:
    """Reusable two-product / one-dim fixture mirroring md_renderer test."""
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

    def _ev(pid: str, val: int, conf: Confidence = Confidence.EXTRACTED) -> ProductEvaluation:
        return ProductEvaluation(
            product_id=pid,
            dimension_id="E5",
            value=val,
            evidence_urls=[f"https://docs.{pid}.test/skills"],
            evaluator="llm:claude",
            confidence=conf,
            last_verified=datetime(2026, 5, 24),
        )

    return ComparisonMatrix(
        product_order=["claude-code", "cursor"],
        dimension_order=["E5"],
        cells={
            "E5": {
                "claude-code": _ev("claude-code", 3, Confidence.EXTRACTED),
                "cursor": _ev("cursor", 2, Confidence.INFERRED),
            }
        },
        products={"claude-code": p1, "cursor": p2},
        dimensions={"E5": dim},
    )


def test_render_html_includes_doctype_title_table_and_styles() -> None:
    matrix = _build_test_matrix()
    html = render_html(matrix, title="Test Compare")

    assert "<!DOCTYPE html>" in html
    assert "<title>Test Compare</title>" in html
    assert "<table" in html
    assert "<style" in html  # embedded CSS, not external
    assert "Claude Code" in html
    assert "Cursor" in html


def test_render_html_emits_confidence_css_classes() -> None:
    """Each per-dim detail cell carries a confidence-<LEVEL> class for styling."""
    html = render_html(_build_test_matrix(), title="Confidence Check")

    # Both confidence levels in the fixture should surface as CSS classes
    assert "confidence-EXTRACTED" in html
    assert "confidence-INFERRED" in html
    # Class definitions must exist in the embedded stylesheet
    assert ".confidence-EXTRACTED" in html
    assert ".confidence-INFERRED" in html


def test_render_html_includes_dim_rubric_and_baseline_callout() -> None:
    html = render_html(_build_test_matrix(), title="Detail Check")

    # Per-dim detail section
    assert "Custom tools" in html
    assert "0=none / 1=fn / 2=skill / 3=skill+hook" in html
    # Baseline callout names the first product
    assert "Baseline" in html
    assert "Claude Code" in html


def test_render_html_escapes_title_with_autoescape_on() -> None:
    """Autoescape ON must prevent raw `<` / `>` from titles bleeding into markup."""
    matrix = _build_test_matrix()
    html = render_html(matrix, title="<script>alert(1)</script>")

    assert "<script>alert(1)</script>" not in html
    # Escaped form should be present instead
    assert "&lt;script&gt;" in html


def test_render_html_default_title() -> None:
    html = render_html(_build_test_matrix())

    assert "<title>Product Comparison</title>" in html


@pytest.mark.parametrize(
    "confidence",
    [
        Confidence.EXTRACTED,
        Confidence.INFERRED,
        Confidence.AMBIGUOUS,
        Confidence.UNVERIFIED,
    ],
)
def test_render_html_supports_all_confidence_levels(confidence: Confidence) -> None:
    matrix = _build_test_matrix()
    cell = matrix.cells["E5"]["cursor"]
    matrix.cells["E5"]["cursor"] = cell.model_copy(update={"confidence": confidence})

    html = render_html(matrix, title="Confidence Sweep")

    assert f"confidence-{confidence.value}" in html
