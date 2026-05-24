from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest

from packages.schemas.dimension import Dimension
from packages.schemas.evaluation import Confidence, ProductEvaluation
from packages.schemas.product import Product
from packages.competitive_analysis.verifier import CrossSourceVerifier


def _claude() -> Product:
    return Product(
        id="claude-code",
        name="Claude Code",
        category="coding",
        priority="P0",
        homepage="https://www.anthropic.com/claude-code",
        keywords=["claude code"],
    )


def _dim_e5() -> Dimension:
    return Dimension(
        id="E5",
        name="Custom tools",
        group="E. Agent Harness 执行",
        importance="critical",
        weight_in_group_pct=22.0,
        evaluation_type="score_0_3",
        rubric="0=none / 1=fn / 2=skill / 3=skill+hook",
        data_sources=["L0:official_docs", "L2:search"],
    )


@pytest.mark.asyncio
async def test_verify_falls_back_to_l2_when_wiki_misses() -> None:
    """When wiki has no eval, verifier reaches out to L2."""
    verifier = CrossSourceVerifier()
    with patch(
        "packages.competitive_analysis.verifier.verify_url_via_search",
        new=AsyncMock(return_value=True),
    ):
        result = await verifier.verify(
            product=_claude(),
            dimension=_dim_e5(),
            existing_evaluation=None,
        )

    # L2 returned True → AMBIGUOUS placeholder (needs human review)
    assert result.confidence == Confidence.AMBIGUOUS
    assert result.product_id == "claude-code"
    assert result.dimension_id == "E5"
    assert result.evaluator == "auto:verifier"


@pytest.mark.asyncio
async def test_verify_returns_existing_when_present() -> None:
    """Don't re-verify if we already have a cached high-confidence eval."""
    existing = ProductEvaluation(
        product_id="claude-code",
        dimension_id="E5",
        value=3,
        evidence_urls=["https://docs.anthropic.com/skills"],
        evaluator="llm:claude",
        confidence=Confidence.EXTRACTED,
        last_verified=datetime(2026, 5, 24),
    )
    verifier = CrossSourceVerifier()
    result = await verifier.verify(
        product=_claude(),
        dimension=_dim_e5(),
        existing_evaluation=existing,
    )
    assert result is existing  # passthrough — no L2 call


@pytest.mark.asyncio
async def test_verify_marks_unverified_when_l2_misses() -> None:
    """When L2 also can't confirm, mark UNVERIFIED placeholder."""
    verifier = CrossSourceVerifier()
    with patch(
        "packages.competitive_analysis.verifier.verify_url_via_search",
        new=AsyncMock(return_value=False),
    ):
        result = await verifier.verify(
            product=_claude(),
            dimension=_dim_e5(),
            existing_evaluation=None,
        )

    assert result.confidence == Confidence.UNVERIFIED
    assert result.evaluator == "auto:verifier"
