from datetime import datetime, timezone
from pipeline.sources.layer0_official.rss_feed import parse_feed, FeedEntry

SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Anthropic News</title>
  <item>
    <title>Claude Code v2.1.146 release</title>
    <link>https://www.anthropic.com/news/claude-code-2-1-146</link>
    <pubDate>Thu, 22 May 2026 10:00:00 GMT</pubDate>
    <description>simplify renamed to code-review</description>
  </item>
  <item>
    <title>Skills feature general availability</title>
    <link>https://www.anthropic.com/news/skills-ga</link>
    <pubDate>Thu, 15 May 2026 10:00:00 GMT</pubDate>
    <description>Skills now in stable</description>
  </item>
</channel>
</rss>
"""

def test_parse_feed_extracts_entries():
    entries = parse_feed(SAMPLE_RSS)
    assert len(entries) == 2
    assert isinstance(entries[0], FeedEntry)
    assert entries[0].title == "Claude Code v2.1.146 release"
    assert entries[0].url == "https://www.anthropic.com/news/claude-code-2-1-146"
    assert isinstance(entries[0].published, datetime)
    assert entries[0].published == datetime(2026, 5, 22, 10, 0, 0, tzinfo=timezone.utc)
    assert "simplify" in entries[0].summary

def test_parse_feed_empty():
    rss = "<?xml version='1.0'?><rss version='2.0'><channel></channel></rss>"
    assert parse_feed(rss) == []
