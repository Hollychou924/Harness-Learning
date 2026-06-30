import json
import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from pipeline.core.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource

logger = logging.getLogger(__name__)

SCRIPT_PATH = Path.home() / "skills" / "wechat-article-search" / "scripts" / "search_wechat.js"
# fallback to claude skills dir if user ran skillhub install with --target
ALT_PATH = Path.home() / ".claude" / "skills" / "wechat-article-search" / "scripts" / "search_wechat.js"


def _resolve_script() -> Path:
    if SCRIPT_PATH.exists():
        return SCRIPT_PATH
    if ALT_PATH.exists():
        return ALT_PATH
    raise FileNotFoundError("wechat-article-search skill not installed")


def fetch_wechat_signals(*, query: str, limit: int = 10) -> list[ChangelogEntry]:
    """Call the Node search_wechat.js script and return ChangelogEntry list.

    Returns [] on subprocess failure (logged but not raised) — Path B aggregator
    can tolerate L1 source failures.
    """
    try:
        script = _resolve_script()
    except FileNotFoundError as e:
        logger.warning("wechat-article-search skill not found: %s", e)
        return []

    cmd = ["node", str(script), query, "-n", str(limit)]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:
        logger.warning("wechat-article-search timed out for query=%r", query)
        return []
    except FileNotFoundError as e:
        logger.warning("wechat-article-search node binary missing: %s", e)
        return []

    if result.returncode != 0:
        logger.warning("wechat-article-search failed: %s", result.stderr.strip()[:200])
        return []

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        logger.warning("wechat-article-search returned non-JSON: %s", e)
        return []

    entries: list[ChangelogEntry] = []
    for art in data.get("articles", []):
        url = art.get("url")
        if not url:
            continue
        # Date may be missing or partial — fall back to "now UTC" so aggregator/scorer can still run
        published = _parse_date(art.get("date")) or datetime.now(timezone.utc)
        entries.append(ChangelogEntry(
            source=SignalSource.WECHAT,
            source_url=url,
            title=art.get("title") or "",
            summary=art.get("summary") or "",
            published_at=published,
            raw_metadata={"wechat_account": art.get("source") or "unknown"},
        ))
    return entries


def _parse_date(s: str | None) -> datetime | None:
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None
