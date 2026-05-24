"""CLI tests for Phase 4 — `wiki portfolio` command."""

from __future__ import annotations

from pathlib import Path

import pytest
from typer.testing import CliRunner

from cli.main import app

runner = CliRunner()


PRODUCTS_YAML = """\
products:
  - id: claude-code
    name: Claude Code
    category: coding
    priority: P0
    is_baseline: true
    homepage: https://www.anthropic.com/claude-code
  - id: cursor
    name: Cursor
    category: coding
    priority: P0
    homepage: https://cursor.sh
"""


def _write_products(tmp_path: Path) -> Path:
    path = tmp_path / "products.yaml"
    path.write_text(PRODUCTS_YAML, encoding="utf-8")
    return path


def test_portfolio_dry_run_single_theme(tmp_path: Path) -> None:
    """--dry-run --theme harness-design exits 0 and reports the resolved theme."""
    runner.invoke(app, ["init", "--root", str(tmp_path / "wiki")])
    products_file = _write_products(tmp_path)
    result = runner.invoke(
        app,
        [
            "portfolio",
            "--theme",
            "harness-design",
            "--dry-run",
            "--products-file",
            str(products_file),
            "--root",
            str(tmp_path / "wiki"),
            "--output-dir",
            str(tmp_path / "out"),
        ],
    )
    assert result.exit_code == 0, result.stdout
    assert "HARNESS_DESIGN" in result.stdout
    assert "claude-code" in result.stdout


def test_portfolio_no_flags_errors() -> None:
    """Calling with no theme + no --all should exit non-zero with an error."""
    result = runner.invoke(app, ["portfolio"])
    assert result.exit_code != 0
    combined = result.stdout + (result.stderr or "")
    assert "--theme" in combined or "--all" in combined


def test_portfolio_unknown_theme_rejected(tmp_path: Path) -> None:
    """Unknown theme slug should exit non-zero with a clear message."""
    products_file = _write_products(tmp_path)
    result = runner.invoke(
        app,
        [
            "portfolio",
            "--theme",
            "bogus-theme",
            "--products-file",
            str(products_file),
            "--root",
            str(tmp_path / "wiki"),
            "--output-dir",
            str(tmp_path / "out"),
        ],
    )
    assert result.exit_code != 0
    combined = result.stdout + (result.stderr or "")
    assert "unknown theme" in combined.lower() or "bogus" in combined.lower()


def test_portfolio_theme_and_all_mutually_exclusive(tmp_path: Path) -> None:
    """--theme and --all together should exit non-zero."""
    products_file = _write_products(tmp_path)
    result = runner.invoke(
        app,
        [
            "portfolio",
            "--theme",
            "harness-design",
            "--all",
            "--dry-run",
            "--products-file",
            str(products_file),
            "--root",
            str(tmp_path / "wiki"),
            "--output-dir",
            str(tmp_path / "out"),
        ],
    )
    assert result.exit_code != 0
    combined = result.stdout + (result.stderr or "")
    assert "mutually exclusive" in combined.lower() or "exclusive" in combined.lower()


def test_portfolio_all_dry_run_lists_six_themes(tmp_path: Path) -> None:
    """--all --dry-run prints all six theme names and exits 0."""
    products_file = _write_products(tmp_path)
    result = runner.invoke(
        app,
        [
            "portfolio",
            "--all",
            "--dry-run",
            "--products-file",
            str(products_file),
            "--root",
            str(tmp_path / "wiki"),
            "--output-dir",
            str(tmp_path / "out"),
        ],
    )
    assert result.exit_code == 0, result.stdout
    for name in [
        "HARNESS_DESIGN",
        "CONTEXT_ENGINEERING",
        "TOOL_ECOSYSTEM",
        "CACHE_STRATEGY",
        "OPEN_SOURCE",
        "CO_EVOLUTION",
    ]:
        assert name in result.stdout, f"missing {name} in dry-run output"


@pytest.mark.asyncio
async def _noop():  # pragma: no cover - helper
    return ""


def test_portfolio_real_run_writes_md_and_marp(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """With engine.generate monkeypatched, real run writes report.md + deck.marp.md."""
    runner.invoke(app, ["init", "--root", str(tmp_path / "wiki")])
    products_file = _write_products(tmp_path)
    output_dir = tmp_path / "out"

    canned_body = "## Canned portfolio body\n\nKey insight: harness matters."

    async def fake_generate(self, request):  # noqa: ANN001 - signature mirrors engine
        return canned_body

    from packages.competitive_analysis.portfolio.engine import PortfolioReportEngine

    monkeypatch.setattr(PortfolioReportEngine, "generate", fake_generate)

    result = runner.invoke(
        app,
        [
            "portfolio",
            "--theme",
            "harness-design",
            "--products",
            "claude-code",
            "--formats",
            "markdown,pptx",
            "--products-file",
            str(products_file),
            "--root",
            str(tmp_path / "wiki"),
            "--output-dir",
            str(output_dir),
        ],
    )
    assert result.exit_code == 0, result.stdout

    theme_dir = output_dir / "harness-design"
    md_path = theme_dir / "report.md"
    marp_path = theme_dir / "deck.marp.md"
    assert md_path.exists(), f"missing {md_path}"
    assert marp_path.exists(), f"missing {marp_path}"

    md_text = md_path.read_text(encoding="utf-8")
    marp_text = marp_path.read_text(encoding="utf-8")

    # Body text from the engine flows through both renderers.
    assert "Canned portfolio body" in md_text
    assert "Canned portfolio body" in marp_text
    # JD keyword from the theme appears in at least one rendered surface.
    assert "Harness Engineering" in md_text or "Harness Engineering" in marp_text
