import pytest
from pytest_httpx import HTTPXMock
import httpx
from adapters.layer3_notify.feishu_bot import push_changelog_card


@pytest.mark.asyncio
async def test_push_card(httpx_mock: HTTPXMock, monkeypatch):
    monkeypatch.setenv("FEISHU_BOT_WEBHOOK", "https://open.feishu.cn/open-apis/bot/v2/hook/abc")
    httpx_mock.add_response(
        url="https://open.feishu.cn/open-apis/bot/v2/hook/abc",
        json={"StatusCode": 0, "StatusMessage": "success"},
    )
    async with httpx.AsyncClient() as client:
        ok = await push_changelog_card(
            client,
            product_name="Claude Code",
            score=0.85,
            entry_count=3,
            report_url="file://wiki/changelog/claude-code/2026-05-23.md",
        )
    assert ok is True


@pytest.mark.asyncio
async def test_push_no_webhook_configured(monkeypatch):
    monkeypatch.delenv("FEISHU_BOT_WEBHOOK", raising=False)
    async with httpx.AsyncClient() as client:
        ok = await push_changelog_card(
            client, product_name="x", score=0.9, entry_count=1, report_url="x",
        )
    assert ok is False  # no-op when not configured


@pytest.mark.asyncio
async def test_push_card_failure(httpx_mock: HTTPXMock, monkeypatch):
    monkeypatch.setenv("FEISHU_BOT_WEBHOOK", "https://open.feishu.cn/x")
    httpx_mock.add_response(url="https://open.feishu.cn/x", status_code=500)
    async with httpx.AsyncClient() as client:
        ok = await push_changelog_card(
            client, product_name="x", score=0.9, entry_count=1, report_url="x",
        )
    assert ok is False
