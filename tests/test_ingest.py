import json
from pathlib import Path

import pytest

from pipeline.core.llm_wiki.ingest import (
    AnalysisDraft,
    IngestEngine,
    IngestError,
    IngestSource,
    StubLLM,
)

SAMPLE_DOC = """
# Skills

Claude Code Skills are reusable instructions stored in ~/.claude/skills/.
Each skill has a SKILL.md frontmatter and triggers based on user prompts.
You can install skills via `claude plugin install` or symlink them manually.
"""


def test_step1_analyze_returns_structured_draft(tmp_wiki: Path):
    stub = StubLLM(
        analyze_response=json.dumps({
            "facts": [
                {
                    "claim": "Claude Code Skills stored in ~/.claude/skills/",
                    "evidence_url": "https://docs.anthropic.com/skills#L3",
                    "confidence": "EXTRACTED",
                    "dimension_id": "E5",
                }
            ],
            "entities": ["Claude Code", "Skills"],
            "topics": ["execution"],
        })
    )
    engine = IngestEngine(llm=stub, wiki_root=tmp_wiki)
    draft = engine.analyze(IngestSource(
        url="https://docs.anthropic.com/skills",
        content=SAMPLE_DOC,
        product_id="claude-code",
    ))

    assert isinstance(draft, AnalysisDraft)
    assert len(draft.facts) == 1
    assert draft.facts[0]["confidence"] == "EXTRACTED"


def test_step2_generate_writes_dimension_card(tmp_wiki: Path):
    from pipeline.core.llm_wiki.paths import init_wiki
    init_wiki(tmp_wiki)

    stub = StubLLM(
        analyze_response=json.dumps({
            "facts": [{
                "claim": "Skills system supports SKILL.md + Hook + SubAgent",
                "evidence_url": "https://docs.anthropic.com/skills#L10",
                "confidence": "EXTRACTED",
                "dimension_id": "E5",
            }],
            "entities": ["Skills"], "topics": [],
        }),
        generate_response="# E5 自定义工具/Hook 系统\n\nClaude Code: 3 (Skill+Hook+SubAgent 完整)\n\n[evidence](https://docs.anthropic.com/skills#L10)\n",
    )
    engine = IngestEngine(llm=stub, wiki_root=tmp_wiki)
    engine.ingest(IngestSource(
        url="https://docs.anthropic.com/skills",
        content=SAMPLE_DOC,
        product_id="claude-code",
    ))

    card = tmp_wiki / "compiled" / "claude-code" / "dimensions" / "E5.md"
    assert card.exists()
    content = card.read_text(encoding="utf-8")
    assert "Skill+Hook+SubAgent" in content


def test_analyze_strips_code_fence(tmp_wiki: Path):
    stub = StubLLM(
        analyze_response='```json\n{"facts": [], "entities": [], "topics": []}\n```',
    )
    engine = IngestEngine(llm=stub, wiki_root=tmp_wiki)
    draft = engine.analyze(IngestSource(url="x", content="y", product_id="p"))
    assert draft.facts == []


def test_analyze_raises_on_malformed_json(tmp_wiki: Path):
    stub = StubLLM(analyze_response="not valid json")
    engine = IngestEngine(llm=stub, wiki_root=tmp_wiki)
    with pytest.raises(IngestError) as excinfo:
        engine.analyze(IngestSource(url="https://example.com/x", content="y", product_id="p"))
    assert excinfo.value.source_url == "https://example.com/x"
    assert "non-JSON" in str(excinfo.value)


def test_analyze_raises_on_wrong_shape(tmp_wiki: Path):
    stub = StubLLM(analyze_response='{"facts": "not a list"}')
    engine = IngestEngine(llm=stub, wiki_root=tmp_wiki)
    with pytest.raises(IngestError):
        engine.analyze(IngestSource(url="x", content="y", product_id="p"))
