from pathlib import Path
from packages.llm_wiki.paths import init_wiki, WikiLayout

def test_init_creates_full_directory_tree(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)

    assert layout.purpose.exists()
    assert layout.index.exists()
    assert layout.log.exists()
    assert layout.raw.is_dir()
    assert layout.compiled.is_dir()
    assert layout.topics.is_dir()
    assert layout.concepts.is_dir()
    assert layout.schema.is_dir()
    assert (layout.review / "pending").is_dir()
    assert (layout.review / "approved").is_dir()
    assert (layout.review / "rejected").is_dir()
    assert (layout.reports / "daily").is_dir()

def test_init_is_idempotent(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    init_wiki(tmp_wiki)  # second call must not error
    assert (tmp_wiki / "index.md").exists()

def test_log_append_format(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    layout.append_log("ingest", "Claude Code v2.1.146 release notes")

    content = layout.log.read_text(encoding="utf-8")
    assert "## [" in content
    assert "ingest" in content
    assert "Claude Code v2.1.146 release notes" in content
