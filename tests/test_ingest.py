import json
from pathlib import Path
from packages.llm_wiki.ingest import IngestEngine, IngestSource, AnalysisDraft, StubLLM

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
    from packages.llm_wiki.paths import init_wiki
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
