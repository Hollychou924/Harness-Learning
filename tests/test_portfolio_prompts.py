"""Tests for the portfolio theme prompt registry."""

from packages.competitive_analysis.portfolio.prompts import (
    ThemePromptSpec,
    get_theme_prompt,
)
from packages.competitive_analysis.portfolio.theme import ReportTheme


def test_all_themes_have_prompts() -> None:
    for theme in ReportTheme:
        spec = get_theme_prompt(theme)
        assert isinstance(spec, ThemePromptSpec)
        assert len(spec.system_prompt) > 100  # non-trivial
        assert len(spec.report_structure) >= 3  # at least 3 sections
        assert spec.audience  # has stated audience


def test_harness_design_prompt_mentions_jd_keywords() -> None:
    spec = get_theme_prompt(ReportTheme.HARNESS_DESIGN)
    txt = spec.system_prompt.lower()
    assert "tool use" in txt or "subagent" in txt
    assert "harness" in txt


def test_cache_strategy_prompt_focuses_on_cache() -> None:
    spec = get_theme_prompt(ReportTheme.CACHE_STRATEGY)
    assert "cache" in spec.system_prompt.lower()
    assert "kv" in spec.system_prompt.lower() or "prompt cache" in spec.system_prompt.lower()
