from datetime import datetime
from pathlib import Path
from pipeline.core.schemas.evaluation import ProductEvaluation, Confidence
from pipeline.core.llm_wiki.review import ReviewQueue
from pipeline.core.llm_wiki.paths import init_wiki

def make_eval(conf: Confidence, dim: str = "E5") -> ProductEvaluation:
    return ProductEvaluation(
        product_id="claude-code", dimension_id=dim, value="?",
        evidence_urls=[], evaluator="llm:claude-opus-4-7",
        confidence=conf, last_verified=datetime(2026, 5, 24),
    )

def test_only_ambiguous_enters_pending(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    q = ReviewQueue(tmp_wiki)

    enrolled = q.enroll([
        make_eval(Confidence.EXTRACTED, "E5"),
        make_eval(Confidence.AMBIGUOUS, "E6"),
        make_eval(Confidence.UNVERIFIED, "F1"),
    ])
    assert enrolled == 1
    assert len(list((tmp_wiki / "review" / "pending").glob("*.json"))) == 1

def test_approve_moves_pending_to_approved(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    q = ReviewQueue(tmp_wiki)
    q.enroll([make_eval(Confidence.AMBIGUOUS, "E6")])
    pending = list((tmp_wiki / "review" / "pending").glob("*.json"))
    assert len(pending) == 1

    q.decide(pending[0].stem, decision="approved", reviewer="zhouhao")

    assert not pending[0].exists()
    assert len(list((tmp_wiki / "review" / "approved").glob("*.json"))) == 1
