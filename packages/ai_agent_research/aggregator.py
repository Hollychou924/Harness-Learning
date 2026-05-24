"""Signal aggregator: dedup by source URL + associate to product by keyword."""

from collections import defaultdict

from packages.ai_agent_research.changelog_entry import ChangelogEntry
from packages.schemas.product import Product

UNASSIGNED = "_unassigned"


class SignalAggregator:
    """Dedup raw signals by source_url and group them by product_id.

    Entries with a pre-set ``product_id`` are respected (e.g. GitHub release
    adapter that already knows the repo). Otherwise, we match
    ``title + summary`` (lowercased) against each product's lowercased
    keywords. Unmatched entries land in the ``_unassigned`` bucket.
    """

    def __init__(self, products: list[Product]) -> None:
        self.products = products
        # Precompute lowercase keywords per product to avoid redoing it per entry.
        self._keyword_index: list[tuple[str, list[str]]] = [
            (p.id, [kw.lower() for kw in p.keywords])
            for p in products
        ]

    def aggregate(self, entries: list[ChangelogEntry]) -> dict[str, list[ChangelogEntry]]:
        """Dedup by source_url, then group by product_id (or '_unassigned')."""
        seen: set[str] = set()
        deduped: list[ChangelogEntry] = []
        for e in entries:
            # HttpUrl is not directly hashable across pydantic versions; coerce to str.
            key = str(e.source_url)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(e)

        result: dict[str, list[ChangelogEntry]] = defaultdict(list)
        for e in deduped:
            pid = e.product_id or self._associate(e)
            result[pid or UNASSIGNED].append(e)
        return dict(result)

    def _associate(self, entry: ChangelogEntry) -> str | None:
        haystack = f"{entry.title} {entry.summary}".lower()
        for pid, kws in self._keyword_index:
            if any(kw in haystack for kw in kws):
                return pid
        return None
