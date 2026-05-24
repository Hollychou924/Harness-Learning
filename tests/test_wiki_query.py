from datetime import datetime
from pathlib import Path

from packages.competitive_analysis.wiki_query import WikiQuery
from packages.llm_wiki.paths import WikiLayout, init_wiki
from packages.llm_wiki.provenance import write_provenance
from packages.schemas.evaluation import Confidence, ProductEvaluation


def _make_eval(product_id: str, dim_id: str) -> ProductEvaluation:
    return ProductEvaluation(
        product_id=product_id,
        dimension_id=dim_id,
        value=2,
        evidence_urls=["https://docs.test/x"],
        evaluator="llm:claude",
        confidence=Confidence.EXTRACTED,
        last_verified=datetime(2026, 5, 24),
    )


def test_read_evaluations_for_product(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    product_dir = tmp_wiki / "compiled" / "claude-code"
    product_dir.mkdir(parents=True)
    write_provenance(
        product_dir,
        [
            _make_eval("claude-code", "E5"),
            _make_eval("claude-code", "F3"),
        ],
    )

    q = WikiQuery(layout=layout)
    result = q.read_evaluations("claude-code")

    assert "E5" in result
    assert "F3" in result
    assert result["E5"].confidence == Confidence.EXTRACTED


def test_read_evaluations_missing_product_returns_empty(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    q = WikiQuery(layout=layout)
    assert q.read_evaluations("nonexistent") == {}


def test_read_evaluations_filters_by_dim(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    product_dir = tmp_wiki / "compiled" / "cursor"
    product_dir.mkdir(parents=True)
    write_provenance(
        product_dir,
        [
            _make_eval("cursor", "E5"),
            _make_eval("cursor", "E1"),
            _make_eval("cursor", "F3"),
        ],
    )

    q = WikiQuery(layout=layout)
    result = q.read_evaluations("cursor", dim_ids=["E5", "F3"])

    assert set(result.keys()) == {"E5", "F3"}
    assert "E1" not in result
