"""Tests for `pipeline.renderers.pptx_renderer`.

The renderer turns a `ComparisonMatrix` into Marp-flavored markdown that the
`marp` CLI can convert to PPTX. Tests focus on:
  - Frontmatter (`marp: true`, theme, paginate) emitted correctly
  - Title slide + matrix slide + per-dimension slides separated by `---`
  - `convert_to_pptx` degrades gracefully when the `marp` CLI is missing
"""

from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pytest

from pipeline.core.competitive_analysis.matrix_builder import ComparisonMatrix
from pipeline.core.schemas.dimension import Dimension
from pipeline.core.schemas.evaluation import Confidence, ProductEvaluation
from pipeline.core.schemas.product import Product
from pipeline.renderers.pptx_renderer import convert_to_pptx, render_marp_markdown


def _build_test_matrix() -> ComparisonMatrix:
    """Two-product / one-dim fixture mirroring the markdown renderer tests."""
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


def test_render_marp_includes_frontmatter_and_slides() -> None:
    marp = render_marp_markdown(_build_test_matrix(), title="Test Compare")

    # Marp frontmatter block at the top
    assert marp.startswith("---")
    assert "marp: true" in marp
    assert "theme:" in marp
    assert "paginate: true" in marp
    # Title surfaces in header directive AND H1
    assert "Test Compare" in marp
    assert "# Test Compare" in marp


def test_render_marp_emits_per_dimension_slide_with_rubric() -> None:
    marp = render_marp_markdown(_build_test_matrix(), title="Per-Dim")

    # Each dim becomes its own slide — header form `## E5 — Custom tools`
    assert "## E5" in marp
    assert "Custom tools" in marp
    # Rubric carried through verbatim
    assert "0=none / 1=fn / 2=skill / 3=skill+hook" in marp
    # Per-product line includes value + confidence label
    assert "Claude Code" in marp
    assert "Cursor" in marp
    assert "extracted" in marp.lower()


def test_render_marp_includes_comparison_matrix_table() -> None:
    marp = render_marp_markdown(_build_test_matrix(), title="Matrix")

    assert "## Comparison Matrix" in marp
    # Table separator with N+1 cells (Dimension + 2 products)
    assert "|---|---|---|" in marp
    # Baseline value cell
    assert "| 3 |" in marp
    # Compare value cell
    assert "| 2 |" in marp


def test_render_marp_uses_slide_separators() -> None:
    """Marp uses `---` between slides; we expect at least three: frontmatter
    close, title→matrix, matrix→first dim slide."""
    marp = render_marp_markdown(_build_test_matrix(), title="Sep")

    # `---` appears at least 3 times: opening frontmatter, closing frontmatter,
    # plus separators between slides.
    assert marp.count("\n---\n") >= 2 or marp.count("---") >= 3


def test_render_marp_default_title() -> None:
    marp = render_marp_markdown(_build_test_matrix())

    assert "# Product Comparison" in marp


def test_render_marp_empty_matrix_does_not_crash() -> None:
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

    marp = render_marp_markdown(matrix, title="Empty")

    assert "marp: true" in marp
    assert "# Empty" in marp
    assert "Claude Code" in marp


def test_convert_to_pptx_returns_false_when_marp_cli_missing(tmp_path: Path) -> None:
    """Without the `marp` CLI, conversion gracefully degrades to False."""
    with patch("pipeline.renderers.pptx_renderer.shutil.which", return_value=None):
        ok = convert_to_pptx("---\nmarp: true\n---\n# X", tmp_path / "out.pptx")
    assert ok is False
    assert not (tmp_path / "out.pptx").exists()


def test_convert_to_pptx_invokes_cli_when_available(tmp_path: Path) -> None:
    """When the CLI is on PATH, `subprocess.run` is invoked with the right args."""

    class _Result:
        returncode = 0
        stderr = ""

    output = tmp_path / "out.pptx"
    with (
        patch("pipeline.renderers.pptx_renderer.shutil.which", return_value="/usr/local/bin/marp"),
        patch("pipeline.renderers.pptx_renderer.subprocess.run", return_value=_Result()) as run_mock,
    ):
        ok = convert_to_pptx("---\nmarp: true\n---\n# X", output)

    assert ok is True
    args, kwargs = run_mock.call_args
    cmd = args[0]
    assert cmd[0] == "marp"
    assert str(output) in cmd
    # Source markdown was written next to the target
    assert output.with_suffix(".marp.md").exists()


def test_convert_to_pptx_returns_false_when_cli_exits_nonzero(tmp_path: Path) -> None:
    class _Result:
        returncode = 1
        stderr = "boom"

    with (
        patch("pipeline.renderers.pptx_renderer.shutil.which", return_value="/usr/local/bin/marp"),
        patch("pipeline.renderers.pptx_renderer.subprocess.run", return_value=_Result()),
    ):
        ok = convert_to_pptx("---\nmarp: true\n---\n# X", tmp_path / "out.pptx")
    assert ok is False


@pytest.mark.parametrize(
    "confidence,expected_label",
    [
        (Confidence.EXTRACTED, "extracted"),
        (Confidence.AMBIGUOUS, "ambiguous"),
        (Confidence.UNVERIFIED, "unverified"),
    ],
)
def test_render_marp_surfaces_each_confidence_level(
    confidence: Confidence, expected_label: str
) -> None:
    matrix = _build_test_matrix()
    cell = matrix.cells["E5"]["cursor"]
    matrix.cells["E5"]["cursor"] = cell.model_copy(update={"confidence": confidence})

    marp = render_marp_markdown(matrix, title="Confidence")

    assert expected_label in marp.lower()
