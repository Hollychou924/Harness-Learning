"""TrendRadar L1 radar adapter.

Reads a JSON output URL from the externally-deployed TrendRadar fork and
filters items by keyword match against the title (case-insensitive).
The URL is configured via the ``TRENDRADAR_OUTPUT_URL`` env var; when
unset the adapter returns an empty list (graceful no-op) so Path B can
still run in environments without TrendRadar deployed.
"""
import logging
import os
from datetime import datetime

import httpx

from pipeline.core.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource

logger = logging.getLogger(__name__)


async def fetch_trendradar_signals(
    client: httpx.AsyncClient,
    *,
    keywords: list[str],
) -> list[ChangelogEntry]:
    """Fetch TrendRadar output JSON and convert matching items to ChangelogEntry.

    Args:
        client: shared httpx.AsyncClient.
        keywords: case-insensitive substrings matched against item titles.

    Returns:
        Empty list if ``TRENDRADAR_OUTPUT_URL`` is unset, the HTTP fetch
        fails, or no items match the keywords.
    """
    url = os.environ.get("TRENDRADAR_OUTPUT_URL")
    if not url:
        logger.info("TRENDRADAR_OUTPUT_URL not set; skipping")
        return []

    try:
        response = await client.get(url, timeout=20.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("TrendRadar fetch failed: %s", exc)
        return []

    data = response.json()
    keywords_lower = [kw.lower() for kw in keywords]
    entries: list[ChangelogEntry] = []
    for item in data.get("items", []):
        title = item.get("title") or ""
        if not any(kw in title.lower() for kw in keywords_lower):
            continue
        try:
            published_at = datetime.fromisoformat(
                item["publishedAt"].replace("Z", "+00:00")
            )
        except (KeyError, ValueError):
            continue
        entries.append(
            ChangelogEntry(
                source=SignalSource.TRENDRADAR,
                source_url=item["url"],
                title=title,
                summary=item.get("summary") or "",
                published_at=published_at,
                raw_metadata={
                    "platform": item.get("platform"),
                    "trendradar_score": item.get("score"),
                },
            )
        )
    return entries
