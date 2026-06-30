import json
import subprocess
from unittest.mock import patch

from pipeline.sources.layer1_radar.wechat_search import fetch_wechat_signals
from pipeline.core.ai_agent_research.changelog_entry import SignalSource

FAKE_OUTPUT = {
    "articles": [
        {
            "title": "Claude Code 全流程指南",
            "url": "https://mp.weixin.qq.com/s/abc",
            "summary": "Claude Code 安装和使用",
            "date": "2026-05-22",
            "source": "小梁懂AI",
        },
        {
            "title": "Cursor 新功能",
            "url": "https://mp.weixin.qq.com/s/xyz",
            "summary": "Composer 升级",
            "date": "2026-05-21",
            "source": "AI 前线",
        },
    ]
}


def test_fetch_wechat_signals_parses_output():
    with patch("pipeline.sources.layer1_radar.wechat_search.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=0,
            stdout=json.dumps(FAKE_OUTPUT), stderr="",
        )
        entries = fetch_wechat_signals(query="Claude Code", limit=5)

    assert len(entries) == 2
    assert entries[0].source == SignalSource.WECHAT
    assert entries[0].title == "Claude Code 全流程指南"
    assert entries[0].raw_metadata["wechat_account"] == "小梁懂AI"


def test_fetch_wechat_signals_empty():
    with patch("pipeline.sources.layer1_radar.wechat_search.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=0,
            stdout=json.dumps({"articles": []}), stderr="",
        )
        assert fetch_wechat_signals(query="x") == []


def test_fetch_wechat_signals_subprocess_failure_returns_empty():
    """If wechat script crashes (e.g. cheerio missing), return empty rather than raise."""
    with patch("pipeline.sources.layer1_radar.wechat_search.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=1, stdout="", stderr="MODULE_NOT_FOUND: cheerio",
        )
        assert fetch_wechat_signals(query="x") == []
