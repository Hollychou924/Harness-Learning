from dataclasses import dataclass
from typing import Protocol

from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource

# 来源权重: 官方 > 半官方 > 社区
SourceWeights: dict[SignalSource, float] = {
    SignalSource.GITHUB_RELEASE: 1.0,
    SignalSource.RSS: 0.9,
    SignalSource.AIHOT: 0.8,
    SignalSource.BLOG: 0.7,
    SignalSource.WECHAT: 0.6,
    SignalSource.TRENDRADAR: 0.4,
    SignalSource.MANUAL: 1.0,  # human-curated trumps all
}


class KeywordRelevanceScorer(Protocol):
    def score(self, entries: list[ChangelogEntry]) -> float: ...


@dataclass
class StubKeywordScorer:
    """Test double — returns canned score."""

    value: float = 0.5

    def score(self, entries: list[ChangelogEntry]) -> float:
        return self.value


# 信号源数量饱和点: 3+ 不同信号源认为是足够的"多源印证"
SATURATION_SOURCE_COUNT = 3


def compute_importance(
    *,
    entries: list[ChangelogEntry],
    keyword_scorer: KeywordRelevanceScorer,
) -> float:
    """Three-factor importance score (0-1, clamped).

    Formula: 0.4 * source_count_factor + 0.3 * avg_source_weight + 0.3 * llm_relevance

    - source_count_factor = unique source types / SATURATION_SOURCE_COUNT (clamped 0-1)
    - avg_source_weight = mean of SourceWeights for distinct entries
    - llm_relevance = keyword_scorer.score(entries) — should be 0-1
    """
    if not entries:
        return 0.0

    distinct_sources = {e.source for e in entries}
    source_count_factor = min(len(distinct_sources) / SATURATION_SOURCE_COUNT, 1.0)

    weights = [SourceWeights[e.source] for e in entries]
    avg_weight = sum(weights) / len(weights)

    llm_score = keyword_scorer.score(entries)

    score = 0.4 * source_count_factor + 0.3 * avg_weight + 0.3 * llm_score
    return max(0.0, min(1.0, score))
