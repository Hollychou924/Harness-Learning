import json
from datetime import datetime
from pathlib import Path
from pipeline.core.schemas.evaluation import ProductEvaluation, Confidence
from pipeline.core.llm_wiki.provenance import write_provenance, read_provenance


def test_write_and_read_provenance(tmp_wiki: Path):
    product_dir = tmp_wiki / "compiled" / "claude-code"
    product_dir.mkdir(parents=True)

    evals = [
        ProductEvaluation(
            product_id="claude-code", dimension_id="E5", value=3,
            evidence_urls=["https://docs.anthropic.com/skills#L10"],
            evaluator="llm:claude-opus-4-7",
            confidence=Confidence.EXTRACTED,
            last_verified=datetime(2026, 5, 24),
        ),
        ProductEvaluation(
            product_id="claude-code", dimension_id="F3", value=2,
            evidence_urls=["https://docs.anthropic.com/memory#L5"],
            evaluator="llm:claude-opus-4-7",
            confidence=Confidence.INFERRED,
            last_verified=datetime(2026, 5, 24),
        ),
    ]
    write_provenance(product_dir, evals)

    pf = product_dir / "_provenance.json"
    assert pf.exists()
    data = json.loads(pf.read_text())
    assert "E5" in data
    assert data["E5"]["confidence"] == "EXTRACTED"

    loaded = read_provenance(product_dir)
    assert len(loaded) == 2
    assert loaded[0].dimension_id in {"E5", "F3"}


def test_write_provenance_empty_overwrites_safely(tmp_wiki: Path):
    product_dir = tmp_wiki / "compiled" / "claude-code"
    product_dir.mkdir(parents=True)
    write_provenance(product_dir, [])

    assert (product_dir / "_provenance.json").exists()
    assert read_provenance(product_dir) == []
