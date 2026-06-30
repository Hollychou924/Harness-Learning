from typer.testing import CliRunner
from pipeline.cli.main import app

runner = CliRunner()


def test_help_includes_path_b_command():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "path-b" in result.stdout


def test_help_includes_notify_command():
    result = runner.invoke(app, ["--help"])
    assert "notify" in result.stdout


def test_path_b_dry_run_succeeds(tmp_path, monkeypatch):
    """path-b --dry-run should print plan without making any network calls."""
    monkeypatch.delenv("TRENDRADAR_OUTPUT_URL", raising=False)
    runner.invoke(app, ["init", "--root", str(tmp_path / "wiki")])
    result = runner.invoke(app, [
        "path-b", "--dry-run",
        "--root", str(tmp_path / "wiki"),
        "--products-file", "pipeline/products/coding-agents.yaml",
    ])
    assert result.exit_code == 0
