import ipaddress
import logging
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from pipeline.core.docs_link_collector.collector import discover_links_from_sitemap

logger = logging.getLogger(__name__)

_SAFE_SCHEMES = {"http", "https"}
_PER_REQUEST_TIMEOUT = 20.0


@dataclass(frozen=True)
class DocsPage:
    url: str
    content: str  # raw HTML


def _is_safe_url(url: str) -> bool:
    """Reject non-http(s) schemes and links that point at private/loopback IPs.

    sitemap 内容来自不可信外部源,可能被用来引导抓取内网地址 (SSRF)。
    域名型 host 依赖上层 keep_prefix 前缀过滤,这里只拦截明显的危险目标。
    """
    parsed = urlparse(url)
    if parsed.scheme not in _SAFE_SCHEMES:
        return False
    host = parsed.hostname
    if not host:
        return False
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return True  # 域名,交给 keep_prefix 过滤
    return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved)


async def fetch_sitemap_and_pages(
    sitemap_url: str,
    keep_prefix: str,
    *,
    client: httpx.AsyncClient | None = None,
    max_pages: int = 50,
) -> list[DocsPage]:
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=_PER_REQUEST_TIMEOUT, follow_redirects=True)
    try:
        sm = await client.get(sitemap_url, timeout=_PER_REQUEST_TIMEOUT)
        sm.raise_for_status()
        links = discover_links_from_sitemap(sm.text, keep_prefix)[:max_pages]

        pages: list[DocsPage] = []
        for url in links:
            if not _is_safe_url(url):
                logger.warning("跳过不安全的 sitemap 链接: %s", url)
                continue
            try:
                r = await client.get(url, timeout=_PER_REQUEST_TIMEOUT)
            except httpx.HTTPError as exc:
                logger.warning("抓取文档页失败 %s: %s", url, exc)
                continue
            if r.status_code == 200:
                pages.append(DocsPage(url=url, content=r.text))
            else:
                logger.warning("文档页返回非 200 (%s): %s", r.status_code, url)
        return pages
    finally:
        if own_client:
            await client.aclose()
