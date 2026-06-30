"""Tests for ReportTheme enum and PortfolioReportRequest schema (T41)."""

import pytest
from pydantic import ValidationError

from pipeline.core.competitive_analysis.comparison_request import OutputFormat
from pipeline.core.competitive_analysis.portfolio.theme import (
    PortfolioReportRequest,
    ReportTheme,
)


def test_six_themes_defined():
    expected = {
        "HARNESS_DESIGN",
        "CONTEXT_ENGINEERING",
        "TOOL_ECOSYSTEM",
        "CACHE_STRATEGY",
        "OPEN_SOURCE",
        "CO_EVOLUTION",
    }
    assert {t.name for t in ReportTheme} == expected


def test_theme_has_jd_keyword_attribute():
    """Each theme exposes its JD keyword for traceability."""
    assert ReportTheme.HARNESS_DESIGN.jd_keyword == "Harness Engineering"
    assert ReportTheme.CACHE_STRATEGY.jd_keyword == "KV Cache / Prompt Cache"


def test_minimal_request():
    req = PortfolioReportRequest(
        theme=ReportTheme.HARNESS_DESIGN,
        product_ids=["claude-code", "cursor", "codex"],
    )
    assert OutputFormat.MARKDOWN in req.output_formats  # default


def test_empty_products_rejected():
    with pytest.raises(ValidationError):
        PortfolioReportRequest(
            theme=ReportTheme.HARNESS_DESIGN,
            product_ids=[],
        )


def test_request_uses_theme_default_dims_when_unset():
    """If dimension_filter is None, theme provides default dim set."""
    req = PortfolioReportRequest(
        theme=ReportTheme.CACHE_STRATEGY,
        product_ids=["claude-code"],
    )
    # CACHE_STRATEGY's default dims include J5
    effective = req.effective_dimensions()
    assert "J5" in effective
