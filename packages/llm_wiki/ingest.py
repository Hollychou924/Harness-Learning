import json
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True)
class IngestSource:
    url: str
    content: str
    product_id: str


@dataclass(frozen=True)
class AnalysisDraft:
    facts: list[dict]
    entities: list[str]
    topics: list[str]


class LLMClient(Protocol):
    def analyze(self, source: IngestSource) -> str: ...
    def generate(self, draft: AnalysisDraft, source: IngestSource) -> str: ...


@dataclass
class StubLLM:
    """Test double — returns canned strings."""

    analyze_response: str = "{}"
    generate_response: str = ""

    def analyze(self, source: IngestSource) -> str:
        return self.analyze_response

    def generate(self, draft: AnalysisDraft, source: IngestSource) -> str:
        return self.generate_response


class IngestEngine:
    """Two-step Chain-of-Thought ingest. Borrowed from nashsu/llm_wiki pattern.

    Step 1 (analyze): LLM extracts facts/entities/topics into JSON draft.
    Step 2 (generate): LLM consumes draft + source, writes dimension cards.
    """

    def __init__(self, llm: LLMClient, wiki_root: Path) -> None:
        self.llm = llm
        self.wiki_root = wiki_root

    def analyze(self, source: IngestSource) -> AnalysisDraft:
        raw = self.llm.analyze(source)
        data = json.loads(raw)
        return AnalysisDraft(
            facts=data.get("facts", []),
            entities=data.get("entities", []),
            topics=data.get("topics", []),
        )

    def generate(self, draft: AnalysisDraft, source: IngestSource) -> dict[str, str]:
        """Returns map of dimension_id → markdown content."""
        # Group facts by dimension_id
        cards: dict[str, list[dict]] = {}
        for fact in draft.facts:
            did = fact.get("dimension_id")
            if did:
                cards.setdefault(did, []).append(fact)

        # For each dimension, ask LLM to render the card
        result: dict[str, str] = {}
        for dim_id, facts in cards.items():
            sub_draft = AnalysisDraft(
                facts=facts, entities=draft.entities, topics=draft.topics
            )
            md = self.llm.generate(sub_draft, source)
            result[dim_id] = md
        return result

    def ingest(self, source: IngestSource) -> dict[str, Path]:
        """End-to-end: analyze → generate → write to compiled/{product}/dimensions/{dim_id}.md.

        Returns map of dimension_id → file path written.
        """
        draft = self.analyze(source)
        cards = self.generate(draft, source)

        product_dir = self.wiki_root / "compiled" / source.product_id / "dimensions"
        product_dir.mkdir(parents=True, exist_ok=True)

        written: dict[str, Path] = {}
        for dim_id, md in cards.items():
            path = product_dir / f"{dim_id}.md"
            path.write_text(md, encoding="utf-8")
            written[dim_id] = path
        return written
