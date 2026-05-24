from dataclasses import dataclass

from packages.llm_wiki.paths import WikiLayout
from packages.llm_wiki.provenance import read_provenance
from packages.schemas.evaluation import ProductEvaluation


@dataclass(frozen=True)
class WikiQuery:
    """Read compiled evaluations + provenance for a product from the wiki layout."""

    layout: WikiLayout

    def read_evaluations(
        self,
        product_id: str,
        dim_ids: list[str] | None = None,
    ) -> dict[str, ProductEvaluation]:
        """Return {dim_id: ProductEvaluation} for the product, optionally filtered by dim_ids.

        Returns an empty dict if the product has no compiled directory.
        """
        product_dir = self.layout.compiled / product_id
        if not product_dir.exists():
            return {}

        evaluations = read_provenance(product_dir)
        result = {ev.dimension_id: ev for ev in evaluations}
        if dim_ids is not None:
            keep = set(dim_ids)
            result = {k: v for k, v in result.items() if k in keep}
        return result
