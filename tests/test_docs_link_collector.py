import pytest
from packages.docs_link_collector.collector import discover_links_from_sitemap

SAMPLE_SITEMAP = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://docs.anthropic.com/en/docs/claude-code/overview</loc></url>
  <url><loc>https://docs.anthropic.com/en/docs/claude-code/skills</loc></url>
  <url><loc>https://docs.anthropic.com/en/docs/claude-code/changelog</loc></url>
  <url><loc>https://docs.anthropic.com/en/docs/claude-haiku/intro</loc></url>
</urlset>
"""

def test_discover_filters_to_prefix():
    links = discover_links_from_sitemap(
        SAMPLE_SITEMAP,
        keep_prefix="https://docs.anthropic.com/en/docs/claude-code/",
    )
    assert len(links) == 3
    assert all("claude-code" in l for l in links)
    assert all("claude-haiku" not in l for l in links)

def test_discover_returns_empty_when_no_match():
    links = discover_links_from_sitemap(
        SAMPLE_SITEMAP,
        keep_prefix="https://example.com/",
    )
    assert links == []
