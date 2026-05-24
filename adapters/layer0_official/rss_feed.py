from dataclasses import dataclass
from datetime import datetime
import feedparser

@dataclass(frozen=True)
class FeedEntry:
    title: str
    url: str
    summary: str
    published: datetime | None

def parse_feed(content: str | bytes) -> list[FeedEntry]:
    parsed = feedparser.parse(content)
    out: list[FeedEntry] = []
    for e in parsed.entries:
        published: datetime | None = None
        if getattr(e, "published_parsed", None):
            import time
            published = datetime.fromtimestamp(time.mktime(e.published_parsed))
        out.append(FeedEntry(
            title=e.get("title", ""),
            url=e.get("link", ""),
            summary=e.get("summary", e.get("description", "")),
            published=published,
        ))
    return out
