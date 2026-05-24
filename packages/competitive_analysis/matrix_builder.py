"""ComparisonMatrix builder — combines WikiQuery results across products into a
2D `dim × product` grid. Missing cells are filled by `CrossSourceVerifier` so
gaps are explicit (AMBIGUOUS / UNVERIFIED) instead of silently absent.
"""

from dataclasses import dataclass

from packages.competitive_analysis.verifier import CrossSourceVerifier
from packages.competitive_analysis.wiki_query import WikiQuery
from packages.llm_wiki.paths import WikiLayout
from packages.schemas.dimension import Dimension
from packages.schemas.evaluation import ProductEvaluation
from packages.schemas.product import Product


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

    cells: dict[str, dict[str, ProductEvaluation]] = {}
    for d in dimensions:
        cells[d.id] = {}
        for p in products:
            evals = query.read_evaluations(p.id, dim_ids=[d.id])
            existing = evals.get(d.id)
            cell = await verifier.verify(
                product=p,
                dimension=d,
                existing_evaluation=existing,
            )
            cells[d.id][p.id] = cell

    return ComparisonMatrix(
        product_order=[p.id for p in products],
        dimension_order=[d.id for d in dimensions],
        cells=cells,
        products={p.id: p for p in products},
        dimensions={d.id: d for d in dimensions},
    )
