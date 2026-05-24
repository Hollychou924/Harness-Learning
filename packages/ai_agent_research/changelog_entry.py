from datetime import datetime
from enum import Enum

from pydantic import BaseModel, HttpUrl, field_validator


class SignalSource(str, Enum):
    AIHOT = "AIHOT"
    WECHAT = "WECHAT"
    TRENDRADAR = "TRENDRADAR"
    GITHUB_RELEASE = "GITHUB_RELEASE"
    RSS = "RSS"
    BLOG = "BLOG"
    MANUAL = "MANUAL"


class ChangelogEntry(BaseModel):
    source: SignalSource
    source_url: HttpUrl
    title: str
    summary: str
    published_at: datetime
    product_id: str | None = None  # set by aggregator
    importance_score: float | None = None  # set by scorer (0-1)
    raw_metadata: dict = {}  # source-specific extras

    @field_validator("published_at")
    @classmethod
    def _must_be_aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("published_at must be timezone-aware")
        return v
