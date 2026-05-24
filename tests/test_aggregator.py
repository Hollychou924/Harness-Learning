from datetime import datetime, timezone

from packages.ai_agent_research.aggregator import SignalAggregator
from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource
from packages.schemas.product import Product


def _entry(
    url: str,
    title: str,
    summary: str = "",
    source: SignalSource = SignalSource.AIHOT,
) -> ChangelogEntry:
    return ChangelogEntry(
        source=source,
        source_url=url,
        title=title,
        summary=summary,
        published_at=datetime(2026, 5, 23, tzinfo=timezone.utc),
    )


def _claude_product() -> Product:
    return Product(
        id="claude-code",
        name="Claude Code",
        category="coding",
        priority="P0",
        homepage="https://www.anthropic.com/claude-code",
        keywords=["claude code", "Claude Code", "claude-code"],
    )


def test_dedup_by_source_url():
    agg = SignalAggregator(products=[_claude_product()])
    entries = [
        _entry("https://x.test/a", "Claude Code v1"),
        _entry("https://x.test/a", "Claude Code v1"),  # duplicate
        _entry("https://x.test/b", "Claude Code v2"),
    ]
    result = agg.aggregate(entries)
    assert sum(len(items) for items in result.values()) == 2  # 1 dedup'd


def test_associate_by_keyword():
    agg = SignalAggregator(products=[_claude_product()])
    entries = [
        _entry("https://x.test/a", "Claude Code release notes"),
        _entry("https://x.test/b", "Cursor IDE update"),  # no product match
    ]
    result = agg.aggregate(entries)
    assert "claude-code" in result
    assert len(result["claude-code"]) == 1
    # 未关联的 entry 进 _unassigned 桶
    assert "_unassigned" in result
    assert len(result["_unassigned"]) == 1


def test_keyword_match_case_insensitive():
    agg = SignalAggregator(products=[_claude_product()])
    e = _entry("https://x.test/a", "CLAUDE CODE NEW FEATURE")
    result = agg.aggregate([e])
    assert "claude-code" in result


def test_pre_assigned_product_id_preserved():
    """If entry already has product_id (e.g. GitHub release adapter knows the repo), respect it."""
    agg = SignalAggregator(products=[_claude_product()])
    e = _entry("https://x.test/a", "v2.1.150", source=SignalSource.GITHUB_RELEASE)
    e_with_pid = e.model_copy(update={"product_id": "claude-code"})
    result = agg.aggregate([e_with_pid])
    assert "claude-code" in result
