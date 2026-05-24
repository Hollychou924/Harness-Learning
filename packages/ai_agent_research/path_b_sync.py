"""Path B end-to-end orchestration (T25).

Wires L1 signal adapters (AIHOT async + wechat-search sync subprocess +
TrendRadar async) into the SignalAggregator → 3-factor importance scorer →
write_changelog_report pipeline.

For each product, gather signals (last ``since_hours``), aggregate + dedup,
score with the supplied ``keyword_scorer``, and only when ``score >=
score_threshold`` (and there is at least one entry) write the per-product
daily changelog report and append a log line. Returns a result dict mapping
``product_id`` → ``{entries_aggregated, score, report_written}``.

L2 cross-verification (``verify_url_via_search``) is imported here so it can
be patched in tests; Phase 2 doesn't yet block on its result — Phase 3 will
fold it into the scoring path.
"""

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

from adapters.layer1_radar.aihot import fetch_aihot_signals
from adapters.layer1_radar.trendradar import fetch_trendradar_signals
from adapters.layer1_radar.wechat_search import fetch_wechat_signals
from adapters.layer2_search.multi_search import verify_url_via_search  # noqa: F401  (patched in tests)
from packages.ai_agent_research.aggregator import SignalAggregator
from packages.ai_agent_research.changelog_entry import ChangelogEntry
from packages.ai_agent_research.changelog_ingest import write_changelog_report
from packages.ai_agent_research.scorer import (
    KeywordRelevanceScorer,
    compute_importance,
)
from packages.llm_wiki.ingest import LLMClient
from packages.llm_wiki.paths import WikiLayout
from packages.schemas.product import Product

logger = logging.getLogger(__name__)


async def _gather_signals(
    products: list[Product],
    *,
    since: datetime,
) -> list[ChangelogEntry]:
    """Fan out L1 fetches across products in parallel.

    AIHOT + TrendRadar run concurrently inside a single AsyncClient.
    wechat is a sync subprocess and is called serially after the async batch.
    Failures in any single source are logged and do not abort the gather.
    """
    keywords = [kw for p in products for kw in p.keywords]
    out: list[ChangelogEntry] = []

    async with httpx.AsyncClient() as client:
        tasks = [fetch_trendradar_signals(client, keywords=keywords)]
        for p in products:
            # Use the primary keyword only to bound API cost.
            for kw in p.keywords[:1]:
                tasks.append(fetch_aihot_signals(client, query=kw, since=since))
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                logger.warning("L1 fetch failed: %s", r)
                continue
            out.extend(r)

    # wechat is a sync subprocess — call serially after the async batch.
    for p in products:
        if not p.keywords:
            continue
        try:
            out.extend(fetch_wechat_signals(query=p.keywords[0], limit=10))
        except Exception as e:  # defensive: subprocess failure shouldn't kill the run
            logger.warning("wechat fetch failed for %s: %s", p.id, e)

    return out


def sync_path_b(
    *,
    products: list[Product],
    layout: WikiLayout,
    llm: LLMClient,
    keyword_scorer: KeywordRelevanceScorer,
    report_date: date | None = None,
    score_threshold: float = 0.5,
    since_hours: int = 24,
) -> dict[str, dict[str, Any]]:
    """Path B end-to-end: gather signals → aggregate → score → write report.

    Returns a per-product summary dict::

        {
            "claude-code": {
                "entries_aggregated": 3,
                "score": 0.72,
                "report_written": True,
            },
            ...
        }
    """
    report_date = report_date or date.today()
    since = datetime.now(timezone.utc) - timedelta(hours=since_hours)

    raw_signals = asyncio.run(_gather_signals(products, since=since))
    aggregator = SignalAggregator(products=products)
    grouped = aggregator.aggregate(raw_signals)

    result: dict[str, dict[str, Any]] = {}
    for product in products:
        entries = grouped.get(product.id, [])
        score = compute_importance(entries=entries, keyword_scorer=keyword_scorer)
        report_written = False
        if score >= score_threshold and entries:
            write_changelog_report(
                layout=layout,
                product_id=product.id,
                report_date=report_date,
                entries=entries,
                llm=llm,
            )
            layout.append_log(
                "path-b",
                f"{product.id}: {len(entries)} signals, score={score:.2f}",
            )
            report_written = True
        result[product.id] = {
            "entries_aggregated": len(entries),
            "score": score,
            "report_written": report_written,
        }
    return result
