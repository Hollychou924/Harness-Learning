"""Tests for the TrendRadar L1 adapter."""
import httpx
import pytest
from pytest_httpx import HTTPXMock

from adapters.layer1_radar.trendradar import fetch_trendradar_signals
from packages.ai_agent_research.changelog_entry import SignalSource

FAKE_TRENDRADAR = {
    "items": [
        {
            "title": "Claude Code 又出了新功能",
            "url": "https://www.zhihu.com/question/123",
            "platform": "zhihu",
            "publishedAt": "2026-05-23T12:00:00Z",
            "score": 0.87,
        },
        {
            "title": "微博热搜不相关",
            "url": "https://weibo.com/abc",
            "platform": "weibo",
            "publishedAt": "2026-05-23T11:00:00Z",
            "score": 0.5,
        },
    ]
}


@pytest.mark.asyncio
async def test_fetch_trendradar_filters_by_keyword(
    httpx_mock: HTTPXMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("TRENDRADAR_OUTPUT_URL", "https://trendradar.test/output.json")
    httpx_mock.add_response(
        url="https://trendradar.test/output.json", json=FAKE_TRENDRADAR
    )
    async with httpx.AsyncClient() as client:
        entries = await fetch_trendradar_signals(client, keywords=["Claude Code"])
    assert len(entries) == 1
    assert entries[0].source == SignalSource.TRENDRADAR
    assert entries[0].raw_metadata["platform"] == "zhihu"


@pytest.mark.asyncio
async def test_fetch_trendradar_no_url_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("TRENDRADAR_OUTPUT_URL", raising=False)
    async with httpx.AsyncClient() as client:
        entries = await fetch_trendradar_signals(client, keywords=["x"])
    assert entries == []  # graceful no-op
