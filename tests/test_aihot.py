import re
from datetime import datetime, timezone

import httpx
import pytest
from pytest_httpx import HTTPXMock

from pipeline.sources.layer1_radar.aihot import fetch_aihot_signals
from pipeline.core.ai_agent_research.changelog_entry import SignalSource

AIHOT_URL_RE = re.compile(r"^https://aihot\.virxact\.com/api/public/items.*")

FAKE_AIHOT_RESPONSE = {
    "count": 2,
    "hasNext": False,
    "nextCursor": None,
    "items": [
        {
            "id": "cm9abc",
            "title": "Claude Code v2.1.150 发布",
            "url": "https://www.anthropic.com/news/claude-code-2-1-150",
            "source": "Anthropic Blog",
            "publishedAt": "2026-05-23T10:00:00.000Z",
            "summary": "新增 /code-review 命令",
            "category": "ai-products",
        },
        {
            "id": "cm9def",
            "title": "Cursor IDE 0.50",
            "url": "https://cursor.com/changelog/0-50",
            "source": "Cursor",
            "publishedAt": "2026-05-22T08:00:00.000Z",
            "summary": "Composer mode improvements",
            "category": "ai-products",
        },
    ],
}


@pytest.mark.asyncio
async def test_fetch_aihot_signals(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        method="GET",
        url=AIHOT_URL_RE,
        json=FAKE_AIHOT_RESPONSE,
    )
    async with httpx.AsyncClient() as client:
        entries = await fetch_aihot_signals(
            client,
            query="Claude Code",
            since=datetime(2026, 5, 22, tzinfo=timezone.utc),
        )
    assert len(entries) == 2
    assert entries[0].source == SignalSource.AIHOT
    assert entries[0].title == "Claude Code v2.1.150 发布"
    assert entries[0].published_at.tzinfo is not None
    assert "claude-code-2-1-150" in str(entries[0].source_url)


@pytest.mark.asyncio
async def test_fetch_aihot_includes_ua_header(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        method="GET",
        url=AIHOT_URL_RE,
        json={"items": [], "count": 0, "hasNext": False, "nextCursor": None},
    )
    async with httpx.AsyncClient() as client:
        await fetch_aihot_signals(client, query="x")
    request = httpx_mock.get_request()
    ua = request.headers.get("user-agent", "")
    assert "aihot-skill" in ua  # marker so admin can distinguish skill traffic
