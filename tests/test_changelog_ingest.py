from datetime import date, datetime, timezone
from pathlib import Path

from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource
from packages.ai_agent_research.changelog_ingest import write_changelog_report
from packages.llm_wiki.ingest import StubLLM
from packages.llm_wiki.paths import WikiLayout, init_wiki


def _entry(title: str, url: str = "https://x.test/a") -> ChangelogEntry:
    return ChangelogEntry(
        source=SignalSource.GITHUB_RELEASE,
        source_url=url,
        title=title,
        summary="-",
        published_at=datetime(2026, 5, 23, tzinfo=timezone.utc),
        product_id="claude-code",
        importance_score=0.85,
    )


def test_write_changelog_report_creates_file(tmp_wiki: Path) -> None:
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)

    stub = StubLLM(
        analyze_response='{"facts": [], "entities": [], "topics": []}',
        generate_response="# Claude Code · 2026-05-23\n\n- v2.1.150 release\n",
    )
    write_changelog_report(
        layout=layout,
        product_id="claude-code",
        report_date=date(2026, 5, 23),
        entries=[_entry("v2.1.150 release")],
        llm=stub,
    )
    target = tmp_wiki / "changelog" / "claude-code" / "2026-05-23.md"
    assert target.exists()
    content = target.read_text(encoding="utf-8")
    assert "Claude Code" in content
    assert "2026-05-23" in content


def test_changelog_dir_created_in_wiki_layout(tmp_wiki: Path) -> None:
    """changelog/ dir is auto-created by write_changelog_report."""
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)

    stub = StubLLM(
        analyze_response='{"facts": [], "entities": [], "topics": []}',
        generate_response="# x\n",
    )
    write_changelog_report(
        layout=layout,
        product_id="cursor",
        report_date=date(2026, 5, 23),
        entries=[_entry("Cursor 0.50", "https://cursor.test/0-50")],
        llm=stub,
    )
    assert (tmp_wiki / "changelog" / "cursor").is_dir()


def test_empty_entries_is_noop(tmp_wiki: Path) -> None:
    """Empty entries list returns without creating any files."""
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)

    stub = StubLLM(
        analyze_response='{"facts": [], "entities": [], "topics": []}',
        generate_response="should-not-be-called",
    )
    write_changelog_report(
        layout=layout,
        product_id="claude-code",
        report_date=date(2026, 5, 23),
        entries=[],
        llm=stub,
    )
    assert not (tmp_wiki / "changelog" / "claude-code" / "2026-05-23.md").exists()
