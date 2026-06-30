from pathlib import Path
from pipeline.core.llm_wiki.cache import SourceCache, content_hash

def test_content_hash_deterministic():
    assert content_hash(b"hello") == content_hash(b"hello")
    assert content_hash(b"hello") != content_hash(b"world")
    h = content_hash(b"hello")
    assert len(h) == 64  # sha256 hex

def test_cache_detects_unchanged(tmp_wiki: Path):
    cache = SourceCache(tmp_wiki / "_cache.json")
    cache.put("https://docs.anthropic.com/changelog", b"v1 content")

    # second call same content — unchanged
    assert cache.unchanged("https://docs.anthropic.com/changelog", b"v1 content") is True

def test_cache_detects_changed(tmp_wiki: Path):
    cache = SourceCache(tmp_wiki / "_cache.json")
    cache.put("https://docs.anthropic.com/changelog", b"v1 content")

    assert cache.unchanged("https://docs.anthropic.com/changelog", b"v2 content") is False

def test_cache_persists_across_instances(tmp_wiki: Path):
    cache_path = tmp_wiki / "_cache.json"
    c1 = SourceCache(cache_path)
    c1.put("u1", b"x")
    c1.flush()

    c2 = SourceCache(cache_path)
    assert c2.unchanged("u1", b"x") is True
