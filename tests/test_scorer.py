from datetime import datetime, timezone

from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource
from packages.ai_agent_research.scorer import (
    SourceWeights,
    StubKeywordScorer,
    compute_importance,
)


def _e(source: SignalSource, url: str = "https://x.test/a") -> ChangelogEntry:
    return ChangelogEntry(
        source=source,
        source_url=url,
        title="t",
        summary="s",
        published_at=datetime(2026, 5, 23, tzinfo=timezone.utc),
    )


def test_single_source_score():
    score = compute_importance(
        entries=[_e(SignalSource.AIHOT)],
        keyword_scorer=StubKeywordScorer(value=0.5),
    )
    # source_count_factor = 1/3 (clamped), weight = AIHOT 0.8, llm = 0.5
    # score = 0.4 * (1/3) + 0.3 * 0.8 + 0.3 * 0.5 = 0.133 + 0.24 + 0.15 = 0.523
    assert 0.5 < score < 0.55


def test_multiple_sources_higher_score():
    entries = [
        _e(SignalSource.AIHOT, "https://x.test/1"),
        _e(SignalSource.GITHUB_RELEASE, "https://x.test/2"),
        _e(SignalSource.WECHAT, "https://x.test/3"),
    ]
    score = compute_importance(
        entries=entries, keyword_scorer=StubKeywordScorer(value=0.5)
    )
    # source_count_factor = 3/3 = 1.0
    # avg_weight = (AIHOT 0.8 + GITHUB 1.0 + WECHAT 0.6) / 3 = 0.8
    # = 0.4 * 1.0 + 0.3 * 0.8 + 0.3 * 0.5 = 0.4 + 0.24 + 0.15 = 0.79
    assert 0.78 < score < 0.80


def test_score_clamped_to_0_1():
    entries = [
        _e(SignalSource.GITHUB_RELEASE, f"https://x.test/{i}") for i in range(10)
    ]
    score = compute_importance(
        entries=entries, keyword_scorer=StubKeywordScorer(value=1.0)
    )
    assert score <= 1.0


def test_source_weights_known_values():
    assert SourceWeights[SignalSource.GITHUB_RELEASE] == 1.0
    assert SourceWeights[SignalSource.RSS] == 0.9
    assert SourceWeights[SignalSource.AIHOT] == 0.8
    assert SourceWeights[SignalSource.BLOG] == 0.7
    assert SourceWeights[SignalSource.WECHAT] == 0.6
    assert SourceWeights[SignalSource.TRENDRADAR] == 0.4
    assert SourceWeights[SignalSource.MANUAL] == 1.0
