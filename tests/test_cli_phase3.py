"""CLI tests for Phase 3 — real `wiki compare` implementation."""

from __future__ import annotations

from pathlib import Path

from typer.testing import CliRunner

from pipeline.cli.main import app

runner = CliRunner()


def test_compare_help_includes_format_option() -> None:
    """`wiki compare --help` exposes the new --formats / --dry-run / --feishu-parent flags."""
    result = runner.invoke(app, ["compare", "--help"])
    assert result.exit_code == 0
    assert "--formats" in result.stdout
    assert "--dry-run" in result.stdout
    assert "--feishu-parent" in result.stdout


def test_compare_dry_run_prints_plan(tmp_path: Path) -> None:
    """--dry-run should print baseline + others + formats and exit 0 without IO."""
    runner.invoke(app, ["init", "--root", str(tmp_path / "wiki")])
    result = runner.invoke(
        app,
        [
            "compare",
            "claude-code",
            "cursor",
            "--dry-run",
            "--formats",
            "markdown,html",
            "--root",
            str(tmp_path / "wiki"),
        ],
    )
    assert result.exit_code == 0
    assert "claude-code" in result.stdout
    assert "cursor" in result.stdout
    assert "markdown" in result.stdout
    assert "html" in result.stdout


def test_compare_invalid_baseline_rejected(tmp_path: Path) -> None:
    """Unknown baseline product id should exit non-zero with a clear error."""
    runner.invoke(app, ["init", "--root", str(tmp_path / "wiki")])
    result = runner.invoke(
        app,
        [
            "compare",
            "not-a-real-product",
            "cursor",
            "--dry-run",
            "--root",
            str(tmp_path / "wiki"),
        ],
    )
    assert result.exit_code != 0
    assert "not-a-real-product" in result.stdout or "not found" in result.stdout.lower()


def test_compare_invalid_compare_id_rejected(tmp_path: Path) -> None:
    """Unknown compare product id should also exit non-zero."""
    runner.invoke(app, ["init", "--root", str(tmp_path / "wiki")])
    result = runner.invoke(
        app,
        [
            "compare",
            "claude-code",
            "made-up-product",
            "--dry-run",
            "--root",
            str(tmp_path / "wiki"),
        ],
    )
    assert result.exit_code != 0
