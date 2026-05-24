import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from packages.schemas.evaluation import ProductEvaluation, Confidence

class ReviewQueue:
    """Async review queue. Only AMBIGUOUS confidence items enter pending/.
    Borrowed from nashsu/llm_wiki Async Review System."""

    def __init__(self, wiki_root: Path) -> None:
        self.root = wiki_root / "review"

    def _slug(self, ev: ProductEvaluation) -> str:
        return f"{ev.product_id}__{ev.dimension_id}__{uuid.uuid4().hex[:8]}"

    def enroll(self, evaluations: list[ProductEvaluation]) -> int:
        """Write AMBIGUOUS items to pending/. Returns count enrolled."""
        pending = self.root / "pending"
        pending.mkdir(parents=True, exist_ok=True)
        n = 0
        for ev in evaluations:
            if ev.confidence != Confidence.AMBIGUOUS:
                continue
            slug = self._slug(ev)
            (pending / f"{slug}.json").write_text(
                ev.model_dump_json(indent=2), encoding="utf-8",
            )
            n += 1
        return n

    def decide(
        self, slug: str, *, decision: Literal["approved", "rejected"], reviewer: str,
    ) -> None:
        src = self.root / "pending" / f"{slug}.json"
        if not src.exists():
            raise FileNotFoundError(f"No pending review: {slug}")

        ev = ProductEvaluation.model_validate_json(src.read_text(encoding="utf-8"))
        ev = ev.model_copy(update={
            "review_status": decision,
            "review_decision_at": datetime.now(timezone.utc),
            "reviewer": reviewer,
        })

        dst_dir = self.root / decision
        dst_dir.mkdir(parents=True, exist_ok=True)
        (dst_dir / f"{slug}.json").write_text(
            ev.model_dump_json(indent=2), encoding="utf-8",
        )
        src.unlink()
