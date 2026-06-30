import json
from pathlib import Path
from unittest.mock import patch, MagicMock
from pipeline.core.schemas.product import Product
from pipeline.core.llm_wiki.paths import init_wiki, WikiLayout
from pipeline.core.llm_wiki.ingest import StubLLM
from pipeline.core.llm_wiki.sync import sync_product_path_a

def make_claude_product() -> Product:
    return Product(
        id="claude-code", name="Claude Code", category="coding", priority="P0",
        is_baseline=True,
        homepage="https://www.anthropic.com/claude-code",
        docs_root="https://docs.anthropic.com/en/docs/claude-code",
        github_repo="anthropics/claude-code",
        keywords=["claude code"],
    )

def test_path_a_writes_raw_compiled_index_log(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)

    stub = StubLLM(
        analyze_response=json.dumps({
            "facts": [{
                "claim": "Skills system stored in ~/.claude/skills/",
                "evidence_url": "https://docs.anthropic.com/skills",
                "confidence": "EXTRACTED",
                "dimension_id": "E5",
            }],
            "entities": ["Skills"], "topics": [],
        }),
        generate_response="# E5\n\nClaude Code: Skill+Hook+SubAgent\n",
    )

    fake_pages = [
        MagicMock(url="https://docs.anthropic.com/en/docs/claude-code/skills",
                  content="<html>Skills doc</html>"),
    ]
    fake_releases = [
        MagicMock(tag="v2.1.146", name="v2.1.146", body="simplify renamed",
                  published_at=None, url="https://github.com/.../v2.1.146"),
    ]

    with (
        patch("pipeline.core.llm_wiki.sync.fetch_sitemap_and_pages", return_value=fake_pages) as m_pages,
        patch("pipeline.core.llm_wiki.sync.fetch_releases", return_value=fake_releases) as m_rel,
    ):
        result = sync_product_path_a(make_claude_product(), layout=layout, llm=stub)

    # Assertions
    assert m_pages.called
    assert m_rel.called

    # Raw written
    raw_dir = tmp_wiki / "raw" / "claude-code"
    assert raw_dir.exists()
    raw_html_files = list(raw_dir.rglob("*.html"))
    assert len(raw_html_files) >= 1

    # Compiled written (E5 card from stub)
    compiled_e5 = tmp_wiki / "compiled" / "claude-code" / "dimensions" / "E5.md"
    assert compiled_e5.exists()

    # Index updated
    assert "claude-code" in layout.index.read_text()

    # Log appended
    log_content = layout.log.read_text()
    assert "sync" in log_content
    assert "claude-code" in log_content

    # Result summary
    assert result["product_id"] == "claude-code"
    assert result["pages_fetched"] >= 1
    assert result["dimensions_compiled"] >= 1
