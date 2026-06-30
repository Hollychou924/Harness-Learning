import json
from pathlib import Path

from pipeline.core.llm_wiki.atomic import atomic_write_text
from pipeline.core.schemas.evaluation import ProductEvaluation

PROVENANCE_FILE = "_provenance.json"


def write_provenance(product_dir: Path, evaluations: list[ProductEvaluation]) -> None:
    """Write evaluations to compiled/{product}/_provenance.json indexed by dimension_id."""
    data = {ev.dimension_id: json.loads(ev.model_dump_json()) for ev in evaluations}
    atomic_write_text(
        product_dir / PROVENANCE_FILE,
        json.dumps(data, indent=2, ensure_ascii=False),
    )


def read_provenance(product_dir: Path) -> list[ProductEvaluation]:
    """Read evaluations from compiled/{product}/_provenance.json. Empty list if missing."""
    pf = product_dir / PROVENANCE_FILE
    if not pf.exists():
        return []
    raw = json.loads(pf.read_text(encoding="utf-8"))
    return [ProductEvaluation(**v) for v in raw.values()]
