"""CrossSourceVerifier — Phase 3 MVP fallback for missing wiki evaluations.

When `WikiQuery` returns no evaluation for a (product, dimension) cell, the
verifier tries L2 (multi-search) as a quick check. The result is always a
placeholder `ProductEvaluation` with confidence ∈ {AMBIGUOUS, UNVERIFIED} so
the comparison matrix can render explicit gaps without silently fabricating
values.

Real L0 re-scrape and full multi-source verification are scaffolded for Phase
4 hardening.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from pipeline.sources.layer2_search.multi_search import verify_url_via_search
from pipeline.core.schemas.dimension import Dimension
from pipeline.core.schemas.evaluation import Confidence, ProductEvaluation
from pipeline.core.schemas.product import Product

logger = logging.getLogger(__name__)


@dataclass
class CrossSourceVerifier:
    """Coordinates fallback verification for missing wiki evaluations.

    Behavior:
        - If `existing_evaluation` is not None, returns it unchanged (passthrough).
        - Otherwise, performs a quick L2 search probe and returns a placeholder
          `ProductEvaluation`:
            * AMBIGUOUS when the search probe found supporting evidence
              (needs human review).
            * UNVERIFIED when neither wiki nor L2 has signal.
    """

    async def verify(
        self,
        *,
        product: Product,
        dimension: Dimension,
        existing_evaluation: ProductEvaluation | None,
        client: httpx.AsyncClient | None = None,
    ) -> ProductEvaluation:
        if existing_evaluation is not None:
            return existing_evaluation

        # Missing eval — try L2 quick check. 复用调用方传入的 client(批量场景),
        # 否则自建一个(独立调用 / 测试场景)。
        query_text = f"{product.name} {dimension.name}"
        if client is not None:
            verified_via_search = await verify_url_via_search(
                client, url=str(product.homepage), query=query_text
            )
        else:
            async with httpx.AsyncClient() as own_client:
                verified_via_search = await verify_url_via_search(
                    own_client, url=str(product.homepage), query=query_text
                )

        confidence = (
            Confidence.AMBIGUOUS if verified_via_search else Confidence.UNVERIFIED
        )
        placeholder_value = "需补充" if verified_via_search else "未评估"

        logger.info(
            "verifier fallback: product=%s dim=%s l2_hit=%s confidence=%s",
            product.id,
            dimension.id,
            verified_via_search,
            confidence.value,
        )

        return ProductEvaluation(
            product_id=product.id,
            dimension_id=dimension.id,
            value=placeholder_value,
            evidence_urls=[],
            evaluator="auto:verifier",
            confidence=confidence,
            last_verified=datetime.now(timezone.utc),
        )
