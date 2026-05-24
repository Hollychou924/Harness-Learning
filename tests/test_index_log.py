from pathlib import Path
from packages.llm_wiki.paths import init_wiki, WikiLayout
from packages.llm_wiki.index_log import update_product_in_index


def test_add_product_section_to_index(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)

    update_product_in_index(layout, product_id="claude-code", summary="Anthropic 桌面编码 Agent (基准产品)")
    update_product_in_index(layout, product_id="cursor", summary="Cursor IDE 集成派代表")

    content = layout.index.read_text(encoding="utf-8")
    assert "claude-code" in content
    assert "cursor" in content
    assert content.count("- [claude-code]") == 1  # idempotent on update


def test_update_existing_product_replaces_summary(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)

    update_product_in_index(layout, product_id="claude-code", summary="v1 summary")
    update_product_in_index(layout, product_id="claude-code", summary="v2 summary")

    content = layout.index.read_text(encoding="utf-8")
    assert "v1 summary" not in content
    assert "v2 summary" in content
