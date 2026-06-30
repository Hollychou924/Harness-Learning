from typing import Literal
from pydantic import BaseModel, HttpUrl, Field

class Product(BaseModel):
    id: str  # kebab-case slug, used as path segment
    name: str
    category: Literal["general", "coding"]
    priority: Literal["P0", "P1", "P2"]
    is_baseline: bool = False
    homepage: HttpUrl
    docs_root: HttpUrl | None = None
    changelog_url: HttpUrl | None = None
    rss_feed: HttpUrl | None = None
    github_repo: str | None = None  # "owner/repo"
    keywords: list[str] = Field(default_factory=list)
