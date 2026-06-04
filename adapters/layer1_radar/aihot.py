"""AIHOT L1 radar adapter.

Calls the public AIHOT REST API and converts items to ChangelogEntry.
The User-Agent contains the `aihot-skill` marker so the upstream admin
can distinguish skill-driven traffic from generic scrapers.
"""
import logging
from datetime import datetime, timezone

import httpx

from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource

logger = logging.getLogger(__name__)

UA = "Mozilla/5.0 (compatible; ai-agent-comp-analysis/0.1) aihot-skill/0.2.0"
BASE = "https://aihot.virxact.com/api/public/items"


async def fetch_aihot_signals(
    client: httpx.AsyncClient,
    *,
    query: str | None = None,
    since: datetime | None = None,
    take: int = 50,
) -> list[ChangelogEntry]:
    """Fetch AIHOT items and map them to ChangelogEntry.

    Args:
        client: shared httpx.AsyncClient.
        query: optional keyword filter (`q` param).
        since: only return items published after this UTC timestamp.
        take: page size cap (defaults to 50).
    """
    params: dict = {"mode": "selected", "take": take}
    if query:
        params["q"] = query
    if since:
        params["since"] = since.astimezone(timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )

    response = await client.get(
        BASE,
        params=params,
        headers={"User-Agent": UA},
        timeout=20.0,
    )
    response.raise_for_status()
    data = response.json()

    entries: list[ChangelogEntry] = []
    for item in data.get("items", []):
        if not (item.get("url") and item.get("publishedAt")):
            continue
        try:
            published_at = datetime.fromisoformat(
                item["publishedAt"].replace("Z", "+00:00")
            )
        except (ValueError, AttributeError) as exc:
            logger.warning("AIHOT item %s 时间解析失败,跳过: %s", item.get("id"), exc)
            continue
        entries.append(
            ChangelogEntry(
                source=SignalSource.AIHOT,
                source_url=item["url"],
                title=item.get("title") or "",
                summary=item.get("summary") or "",
                published_at=published_at,
                raw_metadata={
                    "aihot_id": item.get("id"),
                    "category": item.get("category"),
                    "source_name": item.get("source"),
                },
            )
        )
    return entries
