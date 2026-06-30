import json
import subprocess
from unittest.mock import patch
from pipeline.sources.layer0_official.github_releases import fetch_releases, Release

FAKE_GH_OUTPUT = json.dumps([
    {
        "tag_name": "v2.1.146",
        "name": "Claude Code v2.1.146",
        "body": "/simplify renamed to /code-review",
        "published_at": "2026-05-22T10:00:00Z",
        "html_url": "https://github.com/anthropics/claude-code/releases/tag/v2.1.146",
    },
    {
        "tag_name": "v2.1.145",
        "name": "Claude Code v2.1.145",
        "body": "Bug fixes",
        "published_at": "2026-05-20T10:00:00Z",
        "html_url": "https://github.com/anthropics/claude-code/releases/tag/v2.1.145",
    },
])

def test_fetch_releases_parses_gh_output():
    with patch("pipeline.sources.layer0_official.github_releases.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout=FAKE_GH_OUTPUT, stderr="",
        )
        releases = fetch_releases("anthropics/claude-code", limit=2)

    assert len(releases) == 2
    assert isinstance(releases[0], Release)
    assert releases[0].tag == "v2.1.146"
    assert "simplify" in releases[0].body

def test_fetch_releases_empty_repo():
    with patch("pipeline.sources.layer0_official.github_releases.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="[]", stderr="",
        )
        assert fetch_releases("foo/bar") == []

def test_fetch_releases_command_failure():
    import pytest
    with patch("pipeline.sources.layer0_official.github_releases.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=1, stdout="", stderr="HTTP 404",
        )
        with pytest.raises(RuntimeError, match="gh api failed"):
            fetch_releases("foo/missing")
