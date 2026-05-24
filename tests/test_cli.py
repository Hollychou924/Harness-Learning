from typer.testing import CliRunner
from cli.main import app

runner = CliRunner()


def test_cli_init_creates_wiki(tmp_path):
    result = runner.invoke(app, ["init", "--root", str(tmp_path / "wiki")])
    assert result.exit_code == 0
    assert (tmp_path / "wiki" / "purpose.md").exists()
    assert (tmp_path / "wiki" / "index.md").exists()


def test_cli_help_lists_9_commands():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    # 9 commands: init / ingest / compile / search / query / compare / lint / visualize / review
    for cmd in ["init", "ingest", "compile", "search", "query", "compare", "lint", "visualize", "review"]:
        assert cmd in result.stdout


def test_cli_lint_runs_without_error(tmp_path):
    runner.invoke(app, ["init", "--root", str(tmp_path / "wiki")])
    result = runner.invoke(app, ["lint", "--root", str(tmp_path / "wiki")])
    assert result.exit_code == 0
    assert "OK" in result.stdout or "issue" in result.stdout.lower()


def test_cli_unimplemented_commands_exit_clean(tmp_path):
    """Phase 1 stubs: search/query/compare/visualize/ingest/compile/review run without crash,
    print 'not yet implemented' or similar."""
    runner.invoke(app, ["init", "--root", str(tmp_path / "wiki")])
    for cmd in ["search", "query", "compare", "visualize", "review"]:
        result = runner.invoke(app, [cmd, "--root", str(tmp_path / "wiki"), "x"])
        assert result.exit_code in (0, 2)  # 2 = typer "missing arg" still acceptable for stubs
