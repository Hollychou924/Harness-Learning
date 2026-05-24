from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource


def test_minimal_entry():
    e = ChangelogEntry(
        source=SignalSource.AIHOT,
        source_url="https://aihot.virxact.com/items/abc",
        title="Claude Code v2.1.150 release",
        summary="New /code-review command",
        published_at=datetime(2026, 5, 23, tzinfo=timezone.utc),
    )
    assert e.product_id is None  # default
    assert e.importance_score is None  # default


def test_with_product_and_score():
    e = ChangelogEntry(
        source=SignalSource.GITHUB_RELEASE,
        source_url="https://github.com/anthropics/claude-code/releases/tag/v2.1.150",
        title="v2.1.150",
        summary="Bug fixes",
        published_at=datetime.now(timezone.utc),
        product_id="claude-code",
        importance_score=0.85,
    )
    assert e.product_id == "claude-code"


def test_published_at_must_be_aware():
    with pytest.raises(ValidationError):
        ChangelogEntry(
            source=SignalSource.AIHOT,
            source_url="https://x.test/y",
            title="x",
            summary="y",
            published_at=datetime(2026, 5, 23),  # naive
        )


def test_signal_source_enum_values():
    assert {s.value for s in SignalSource} == {
        "AIHOT",
        "WECHAT",
        "TRENDRADAR",
        "GITHUB_RELEASE",
        "RSS",
        "BLOG",
        "MANUAL",
    }
