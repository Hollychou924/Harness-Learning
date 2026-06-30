import json
import logging
import subprocess
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

_GH_TIMEOUT = 30.0


@dataclass(frozen=True)
class Release:
    tag: str
    name: str
    body: str
    published_at: datetime
    url: str


def _parse_release(r: dict) -> Release | None:
    """Build a Release from one gh-api item, skipping malformed entries."""
    tag = r.get("tag_name")
    published = r.get("published_at")
    if not tag or not published:
        logger.warning("跳过缺少 tag_name/published_at 的 release: %s", r.get("id"))
        return None
    try:
        published_at = datetime.fromisoformat(published.replace("Z", "+00:00"))
    except (ValueError, AttributeError) as exc:
        logger.warning("release %s 时间解析失败: %s", tag, exc)
        return None
    return Release(
        tag=tag,
        name=r.get("name") or tag,
        body=r.get("body") or "",
        published_at=published_at,
        url=r.get("html_url") or "",
    )


def fetch_releases(repo: str, limit: int = 30) -> list[Release]:
    """Fetch releases via `gh api`. Requires gh CLI authenticated."""
    cmd = ["gh", "api", f"repos/{repo}/releases?per_page={limit}"]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=_GH_TIMEOUT
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"gh api 超时 ({_GH_TIMEOUT}s): {repo}") from exc

    if result.returncode != 0:
        raise RuntimeError(f"gh api failed: {result.stderr.strip()}")

    data = json.loads(result.stdout)
    parsed = (_parse_release(r) for r in data)
    return [rel for rel in parsed if rel is not None]
