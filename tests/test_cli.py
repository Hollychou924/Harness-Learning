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


def test_cli_unimplemented_commands_exit_nonzero(tmp_path):
    """未实现的 stub 命令应显式退出码 1,便于脚本/CI 检测 no-op。"""
    runner.invoke(app, ["init", "--root", str(tmp_path / "wiki")])
    for cmd in ["search", "query"]:
        result = runner.invoke(app, [cmd, "--root", str(tmp_path / "wiki"), "x"])
        assert result.exit_code == 1
        assert "未实现" in result.stdout

    # visualize 不接受位置参数
    result = runner.invoke(app, ["visualize", "--root", str(tmp_path / "wiki")])
    assert result.exit_code == 1
    assert "未实现" in result.stdout
