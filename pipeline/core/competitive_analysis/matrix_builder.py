"""ComparisonMatrix builder — combines WikiQuery results across products into a
2D `dim × product` grid. Missing cells are filled by `CrossSourceVerifier` so
gaps are explicit (AMBIGUOUS / UNVERIFIED) instead of silently absent.
"""

import asyncio
from dataclasses import dataclass

import httpx

from pipeline.core.competitive_analysis.verifier import CrossSourceVerifier
from pipeline.core.competitive_analysis.wiki_query import WikiQuery
from pipeline.core.llm_wiki.paths import WikiLayout
from pipeline.core.schemas.dimension import Dimension
from pipeline.core.schemas.evaluation import ProductEvaluation
from pipeline.core.schemas.product import Product


@dataclass(frozen=True)
class ComparisonMatrix:
    """Immutable dim × product matrix produced by `build_matrix`.

    Fields:
        product_order: Ordered list of product ids — baseline first, then compare list.
        dimension_order: Ordered list of dimension ids (input order preserved).
        cells: Nested dict cells[dim_id][product_id] -> ProductEvaluation.
        products: Lookup table for Product objects by id.
        dimensions: Lookup table for Dimension objects by id.
    """

    product_order: list[str]
    dimension_order: list[str]
    cells: dict[str, dict[str, ProductEvaluation]]
    products: dict[str, Product]
    dimensions: dict[str, Dimension]


async def build_matrix(
    *,
    layout: WikiLayout,
    baseline: Product,
    compare: list[Product],
    dimensions: list[Dimension],
) -> ComparisonMatrix:
    """Build a dim × product matrix.

    For each (dimension, product) cell:
        1. Read the existing evaluation from the wiki via WikiQuery.
        2. Pass it through CrossSourceVerifier (passthrough if present, else fallback
           placeholder so missing cells are explicit).
    """
    products = [baseline, *compare]
    query = WikiQuery(layout=layout)
    verifier = CrossSourceVerifier()

    # 每产品只读一次全量 provenance,再按 dim 切片(避免 N(dim) 次重复解析)
    evals_by_product = {p.id: query.read_evaluations(p.id) for p in products}

    async def build_cell(
        d: Dimension, p: Product, client: httpx.AsyncClient
    ) -> tuple[str, str, ProductEvaluation]:
        existing = evals_by_product[p.id].get(d.id)
        cell = await verifier.verify(
            product=p,
            dimension=d,
            existing_evaluation=existing,
            client=client,
        )
        return d.id, p.id, cell

    # 复用单个 client,缺失单元格的 L2 探测并发执行
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *(build_cell(d, p, client) for d in dimensions for p in products)
        )

    cells: dict[str, dict[str, ProductEvaluation]] = {d.id: {} for d in dimensions}
    for dim_id, prod_id, cell in results:
        cells[dim_id][prod_id] = cell

    return ComparisonMatrix(
        product_order=[p.id for p in products],
        dimension_order=[d.id for d in dimensions],
        cells=cells,
        products={p.id: p for p in products},
        dimensions={d.id: d for d in dimensions},
    )
