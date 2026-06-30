"""Tests for Path B end-to-end orchestration (T25).

Mocks all 4 adapter functions at the path_b_sync module level so the
orchestrator runs without any network or subprocess work.
"""

from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from pipeline.core.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource
from pipeline.core.ai_agent_research.path_b_sync import sync_path_b
from pipeline.core.ai_agent_research.scorer import StubKeywordScorer
from pipeline.core.llm_wiki.ingest import StubLLM
from pipeline.core.llm_wiki.paths import WikiLayout, init_wiki
from pipeline.core.schemas.product import Product


def _claude() -> Product:
    return Product(
        id="claude-code",
        name="Claude Code",
        category="coding",
        priority="P0",
        homepage="https://www.anthropic.com/claude-code",
        keywords=["Claude Code"],
    )


def _entry(source: SignalSource, url: str) -> ChangelogEntry:
    return ChangelogEntry(
        source=source,
        source_url=url,
        title="Claude Code v2.1.150",
        summary="release",
        published_at=datetime(2026, 5, 23, tzinfo=timezone.utc),
    )


def test_path_b_high_score_writes_changelog(tmp_wiki: Path) -> None:
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)

    fake_aihot_signals = [_entry(SignalSource.AIHOT, "https://x.test/1")]
    fake_wechat_signals = [_entry(SignalSource.WECHAT, "https://x.test/2")]
    fake_trendradar_signals = [_entry(SignalSource.TRENDRADAR, "https://x.test/3")]

    stub = StubLLM(
        analyze_response='{"facts": [], "entities": [], "topics": []}',
        generate_response="# Claude Code · 2026-05-23\n\nv2.1.150 release\n",
    )

    with (
        patch(
            "pipeline.core.ai_agent_research.path_b_sync.fetch_aihot_signals",
            new=AsyncMock(return_value=fake_aihot_signals),
        ),
        patch(
            "pipeline.core.ai_agent_research.path_b_sync.fetch_wechat_signals",
            new=MagicMock(return_value=fake_wechat_signals),
        ),
        patch(
            "pipeline.core.ai_agent_research.path_b_sync.fetch_trendradar_signals",
            new=AsyncMock(return_value=fake_trendradar_signals),
        ),
        patch(
            "pipeline.core.ai_agent_research.path_b_sync.verify_url_via_search",
            new=AsyncMock(return_value=True),
        ),
    ):
        result = sync_path_b(
            products=[_claude()],
            layout=layout,
            llm=stub,
            keyword_scorer=StubKeywordScorer(value=0.7),
            report_date=date(2026, 5, 23),
            score_threshold=0.5,
        )

    assert result["claude-code"]["entries_aggregated"] >= 1
    assert result["claude-code"]["score"] >= 0.5
    assert result["claude-code"]["report_written"] is True
    assert (tmp_wiki / "changelog" / "claude-code" / "2026-05-23.md").exists()

    # log appended
    log_text = layout.log.read_text(encoding="utf-8")
    assert "path-b" in log_text
    assert "claude-code" in log_text


def test_path_b_low_score_skips_report(tmp_wiki: Path) -> None:
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)

    # Only 1 source (WECHAT, low weight) and a stub scorer that returns 0.1.
    fake_wechat_signals = [_entry(SignalSource.WECHAT, "https://x.test/1")]
    stub = StubLLM(
        analyze_response='{"facts":[],"entities":[],"topics":[]}',
        generate_response="# x",
    )

    with (
        patch(
            "pipeline.core.ai_agent_research.path_b_sync.fetch_aihot_signals",
            new=AsyncMock(return_value=[]),
        ),
        patch(
            "pipeline.core.ai_agent_research.path_b_sync.fetch_wechat_signals",
            new=MagicMock(return_value=fake_wechat_signals),
        ),
        patch(
            "pipeline.core.ai_agent_research.path_b_sync.fetch_trendradar_signals",
            new=AsyncMock(return_value=[]),
        ),
    ):
        result = sync_path_b(
            products=[_claude()],
            layout=layout,
            llm=stub,
            keyword_scorer=StubKeywordScorer(value=0.1),
            report_date=date(2026, 5, 23),
            score_threshold=0.7,
        )

    assert result["claude-code"]["report_written"] is False
    assert not (tmp_wiki / "changelog" / "claude-code" / "2026-05-23.md").exists()
