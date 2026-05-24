from dataclasses import dataclass
from datetime import datetime, timezone
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
            published = datetime(*e.published_parsed[:6], tzinfo=timezone.utc)
        out.append(FeedEntry(
            title=e.get("title", ""),
            url=e.get("link", ""),
            summary=e.get("summary", e.get("description", "")),
            published=published,
        ))
    return out
