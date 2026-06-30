from datetime import date, datetime, timezone
from pathlib import Path

from pipeline.core.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource
from pipeline.core.ai_agent_research.changelog_ingest import write_changelog_report
from pipeline.core.llm_wiki.ingest import StubLLM
from pipeline.core.llm_wiki.paths import WikiLayout, init_wiki


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
    # Header is composed by write_changelog_report (not the LLM stub) and
    # always includes the product_id + ISO date.
    assert "claude-code" in content
    assert "2026-05-23" in content
    assert "每日变更" in content


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


def test_multi_dim_cards_concatenated_with_header(tmp_wiki: Path) -> None:
    """When analyze returns facts spanning multiple dim_ids, the daily report
    concatenates one card per dim under a `# {product_id} 每日变更` header."""
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)

    analyze_payload = {
        "facts": [
            {
                "claim": "E5 fact",
                "evidence_url": "https://x.test/e5",
                "confidence": "EXTRACTED",
                "dimension_id": "E5",
            },
            {
                "claim": "F1 fact",
                "evidence_url": "https://x.test/f1",
                "confidence": "EXTRACTED",
                "dimension_id": "F1",
            },
        ],
        "entities": [],
        "topics": [],
    }
    # StubLLM.generate returns the same canned string per dim — daily report
    # should still contain the header + 2 separator-delimited card sections.
    stub = StubLLM(
        analyze_response=__import__("json").dumps(analyze_payload),
        generate_response="CARD_BODY",
    )
    write_changelog_report(
        layout=layout,
        product_id="claude-code",
        report_date=date(2026, 5, 23),
        entries=[_entry("v2.1.150 release")],
        llm=stub,
    )
    target = tmp_wiki / "changelog" / "claude-code" / "2026-05-23.md"
    content = target.read_text(encoding="utf-8")

    assert content.startswith("# claude-code 每日变更 · 2026-05-23")
    assert "**信号数:** 1 · **维度命中:** 2" in content
    # Two separator blocks — one per dim card
    assert content.count("\n---\n") == 2
    assert content.count("CARD_BODY") == 2
