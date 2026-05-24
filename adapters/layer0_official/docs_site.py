from dataclasses import dataclass
import httpx
from packages.docs_link_collector.collector import discover_links_from_sitemap

@dataclass(frozen=True)
class DocsPage:
    url: str
    content: str  # raw HTML

async def fetch_sitemap_and_pages(
    sitemap_url: str,
    keep_prefix: str,
    *,
    client: httpx.AsyncClient | None = None,
    max_pages: int = 50,
) -> list[DocsPage]:
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=20.0, follow_redirects=True)
    try:
        sm = await client.get(sitemap_url)
        sm.raise_for_status()
        links = discover_links_from_sitemap(sm.text, keep_prefix)[:max_pages]

        pages: list[DocsPage] = []
        for url in links:
            r = await client.get(url)
            if r.status_code == 200:
                pages.append(DocsPage(url=url, content=r.text))
        return pages
    finally:
        if own_client:
            await client.aclose()
