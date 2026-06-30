import logging
from urllib.parse import quote_plus, urlparse

import httpx

logger = logging.getLogger(__name__)

UA = "Mozilla/5.0 (compatible; ai-agent-comp-analysis/0.1)"
DDG_HTML = "https://html.duckduckgo.com/html/?q={q}"


async def verify_url_via_search(
    client: httpx.AsyncClient,
    *,
    url: str,
    query: str,
) -> bool:
    """Returns True if `url` (or its canonical host+path) appears in DDG results.

    Phase 2 MVP: simple substring match in HTML response.
    Phase 3 will swap in the full multi-search-engine skill output.
    """
    try:
        r = await client.get(
            DDG_HTML.format(q=quote_plus(query)),
            headers={"User-Agent": UA},
            timeout=15.0,
        )
        r.raise_for_status()
    except httpx.HTTPError as e:
        logger.warning("DDG search failed: %s", e)
        return False

    parsed = urlparse(url)
    needle = f"{parsed.netloc}{parsed.path}"
    return needle in r.text
