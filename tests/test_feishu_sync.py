"""Tests for pipeline.renderers.feishu_sync — single-direction Feishu Wiki sync (MVP)."""

from __future__ import annotations

import subprocess
from unittest.mock import patch

from pipeline.renderers.feishu_sync import sync_to_feishu_wiki


def test_sync_to_feishu_wiki_calls_skill():
    """When feishu CLI is available and returns 0, sync returns True and invokes feishu."""
    with (
        patch("pipeline.renderers.feishu_sync.shutil.which", return_value="/usr/local/bin/feishu"),
        patch("pipeline.renderers.feishu_sync.subprocess.run") as m,
    ):
        m.return_value = subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout='{"node_token": "abc123"}',
            stderr="",
        )
        result = sync_to_feishu_wiki(
            markdown="# test\n\ncontent",
            title="Test Comparison",
            parent_node_token="parent_xyz",
        )

    assert result is True
    args = m.call_args[0][0]
    # First arg should be the feishu binary
    assert "feishu" in args[0] or args[0] == "feishu"


def test_sync_to_feishu_wiki_failure_returns_false():
    """Subprocess returncode != 0 → sync returns False (logged, not raised)."""
    with (
        patch("pipeline.renderers.feishu_sync.shutil.which", return_value="/usr/local/bin/feishu"),
        patch("pipeline.renderers.feishu_sync.subprocess.run") as m,
    ):
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=1, stdout="", stderr="auth error",
        )
        result = sync_to_feishu_wiki(
            markdown="# test", title="t", parent_node_token="x",
        )

    assert result is False


def test_sync_skipped_when_feishu_not_available():
    """If feishu CLI not in PATH, skip gracefully and return False (no exception)."""
    with patch("pipeline.renderers.feishu_sync.shutil.which", return_value=None):
        result = sync_to_feishu_wiki(
            markdown="# test", title="t", parent_node_token="x",
        )

    assert result is False
