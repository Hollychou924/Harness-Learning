import re

import httpx
import pytest
from pytest_httpx import HTTPXMock

from pipeline.sources.layer2_search.multi_search import verify_url_via_search

DDG_URL_RE = re.compile(r"^https://html\.duckduckgo\.com/html.*")

FAKE_DDG_HTML = """
<html><body>
<a class="result__url" href="https://www.anthropic.com/news/claude-code-2-1-150">claude-code-2-1-150</a>
<a class="result__url" href="https://docs.anthropic.com/changelog">changelog</a>
</body></html>
"""


@pytest.mark.asyncio
async def test_verify_url_found_in_search(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        method="GET",
        url=DDG_URL_RE,
        text=FAKE_DDG_HTML,
    )
    async with httpx.AsyncClient() as client:
        verified = await verify_url_via_search(
            client,
            url="https://www.anthropic.com/news/claude-code-2-1-150",
            query="claude code 2.1.150",
        )
    assert verified is True


@pytest.mark.asyncio
async def test_verify_url_not_found(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        method="GET",
        url=DDG_URL_RE,
        text="<html></html>",
    )
    async with httpx.AsyncClient() as client:
        verified = await verify_url_via_search(
            client,
            url="https://made-up.test/x",
            query="x",
        )
    assert verified is False
