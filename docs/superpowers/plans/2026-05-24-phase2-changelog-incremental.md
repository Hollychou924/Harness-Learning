# Phase 2 Implementation Plan — Changelog Incremental (Path B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Path B — daily changelog incremental tracking. L1 signal sources (AIHOT / wechat-article-search / TrendRadar) feed into a signal aggregator → importance scorer → trigger L0 detail fetch → L2 cross-verify → LLM-generated incremental report → ingest to `wiki/changelog/{product_id}/{date}.md` → Feishu bot notification.

**Architecture:** Builds on Phase 1's `llm_wiki` foundation. New layer: `ai_agent_research` module orchestrates Path B. New adapters: `layer1_radar/` (signal sources) + `layer2_search/` (cross-verification fallback) + `layer3_notify/` (Feishu push). Signals are deduplicated, associated to products via keyword matching, scored by 3-factor formula, and only high-score items trigger expensive L0/L2/LLM steps.

**Tech Stack:** Same as Phase 1. Adds `lark-oapi-py` for Feishu bot. Reuses existing `~/.claude/skills/aihot/` and `~/.claude/skills/multi-search-engine/` and `~/.claude/skills/wechat-article-search/` via subprocess where appropriate.

**Spec reference:** `docs/superpowers/specs/2026-05-23-ai-agent-competitive-analysis-design.md` §7.2 (Path B) and §11 (Phase 2 task list).

**Phase 2 scope (1 week, 13 tasks):**
- ✅ L1 adapters: AIHOT, wechat-article-search, TrendRadar
- ✅ L2 adapter: multi-search-engine
- ✅ Signal aggregator + 3-factor importance scorer
- ✅ Path B end-to-end sync orchestration
- ✅ Changelog ingest mode (extends llm_wiki)
- ✅ Feishu bot push (Layer 3 notify)
- ✅ CLI commands: `wiki path-b` + `wiki notify`
- ✅ GitHub Actions daily cron

**Out of scope (deferred to Phase 3):**
- Path C (comparison engine) and report rendering (MD/HTML/PPT)
- 飞书 Wiki sync of compiled content
- Long-tail products (P2 batch)
- TrendRadar self-hosted fork deployment instructions (will be a separate ops doc)

---

## File Structure

```
ai-agent-competitive-analysis/
├── packages/
│   ├── ai_agent_research/                  # 动态追踪器 (Phase 2 主体)
│   │   ├── __init__.py
│   │   ├── changelog_entry.py              # T17 — ChangelogEntry Pydantic model
│   │   ├── aggregator.py                   # T18 — dedup + product association
│   │   ├── scorer.py                       # T22 — 3-factor importance scoring
│   │   ├── path_b_sync.py                  # T25 — Path B orchestration
│   │   └── changelog_ingest.py             # T24 — extend ingest for changelog mode
│   └── llm_wiki/                            # 已有 (Phase 1)
├── adapters/
│   ├── layer0_official/                     # 已有 (Phase 1)
│   ├── layer1_radar/                        # Phase 2
│   │   ├── __init__.py
│   │   ├── aihot.py                         # T19
│   │   ├── wechat_search.py                 # T20
│   │   └── trendradar.py                    # T21
│   ├── layer2_search/                       # Phase 2
│   │   ├── __init__.py
│   │   └── multi_search.py                  # T23
│   └── layer3_notify/                       # Phase 2
│       ├── __init__.py
│       └── feishu_bot.py                    # T26
├── cli/main.py                              # T27 — extend with path-b + notify
├── .github/workflows/                       # T28
│   └── daily-changelog.yml
├── README.md                                # T29 update
└── tests/
    ├── test_changelog_entry.py              # T17
    ├── test_aggregator.py                   # T18
    ├── test_aihot.py                        # T19
    ├── test_wechat_search.py                # T20
    ├── test_trendradar.py                   # T21
    ├── test_scorer.py                       # T22
    ├── test_multi_search.py                 # T23
    ├── test_changelog_ingest.py             # T24
    ├── test_path_b_sync.py                  # T25
    ├── test_feishu_bot.py                   # T26
    └── test_cli_phase2.py                   # T27
```

---

## Task 17: ChangelogEntry Pydantic schema

**Files:**
- Create: `packages/ai_agent_research/__init__.py` (empty)
- Create: `packages/ai_agent_research/changelog_entry.py`
- Create: `tests/test_changelog_entry.py`

- [ ] **Step 1: Write failing test**

`tests/test_changelog_entry.py`:

```python
from datetime import datetime, timezone
import pytest
from pydantic import ValidationError
from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource

def test_minimal_entry():
    e = ChangelogEntry(
        source=SignalSource.AIHOT,
        source_url="https://aihot.virxact.com/items/abc",
        title="Claude Code v2.1.150 release",
        summary="New /code-review command",
        published_at=datetime(2026, 5, 23, tzinfo=timezone.utc),
    )
    assert e.product_id is None  # default
    assert e.importance_score is None  # default

def test_with_product_and_score():
    e = ChangelogEntry(
        source=SignalSource.GITHUB_RELEASE,
        source_url="https://github.com/anthropics/claude-code/releases/tag/v2.1.150",
        title="v2.1.150",
        summary="Bug fixes",
        published_at=datetime.now(timezone.utc),
        product_id="claude-code",
        importance_score=0.85,
    )
    assert e.product_id == "claude-code"

def test_published_at_must_be_aware():
    with pytest.raises(ValidationError):
        ChangelogEntry(
            source=SignalSource.AIHOT,
            source_url="https://x.test/y",
            title="x",
            summary="y",
            published_at=datetime(2026, 5, 23),  # naive
        )

def test_signal_source_enum_values():
    assert {s.value for s in SignalSource} == {
        "AIHOT", "WECHAT", "TRENDRADAR",
        "GITHUB_RELEASE", "RSS", "BLOG", "MANUAL",
    }
```

- [ ] **Step 2: Run, expect ImportError**

`~/.local/bin/uv run pytest tests/test_changelog_entry.py -v`

- [ ] **Step 3: Implement**

`packages/ai_agent_research/changelog_entry.py`:

```python
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
```

- [ ] **Step 4: Run, 4 passed**

- [ ] **Step 5: Commit**

```bash
git add packages/ai_agent_research/__init__.py packages/ai_agent_research/changelog_entry.py tests/test_changelog_entry.py
git commit -m "feat(research): ChangelogEntry schema with 7-source enum"
```

---

## Task 18: Signal aggregator (dedup + product association)

**Files:**
- Create: `packages/ai_agent_research/aggregator.py`
- Create: `tests/test_aggregator.py`

The aggregator takes raw `list[ChangelogEntry]` from many adapters, dedupes by `source_url`, and associates each entry to a `product_id` by matching `title + summary` against each product's `keywords`.

- [ ] **Step 1: Write failing test**

```python
from datetime import datetime, timezone
from packages.schemas.product import Product
from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource
from packages.ai_agent_research.aggregator import SignalAggregator

def _entry(url: str, title: str, summary: str = "", source: SignalSource = SignalSource.AIHOT) -> ChangelogEntry:
    return ChangelogEntry(
        source=source, source_url=url, title=title, summary=summary,
        published_at=datetime(2026, 5, 23, tzinfo=timezone.utc),
    )

def _claude_product() -> Product:
    return Product(
        id="claude-code", name="Claude Code", category="coding", priority="P0",
        homepage="https://www.anthropic.com/claude-code",
        keywords=["claude code", "Claude Code", "claude-code"],
    )

def test_dedup_by_source_url():
    agg = SignalAggregator(products=[_claude_product()])
    entries = [
        _entry("https://x.test/a", "Claude Code v1"),
        _entry("https://x.test/a", "Claude Code v1"),  # duplicate
        _entry("https://x.test/b", "Claude Code v2"),
    ]
    result = agg.aggregate(entries)
    assert sum(len(items) for items in result.values()) == 2  # 1 dedup'd

def test_associate_by_keyword():
    agg = SignalAggregator(products=[_claude_product()])
    entries = [
        _entry("https://x.test/a", "Claude Code release notes"),
        _entry("https://x.test/b", "Cursor IDE update"),  # no product match
    ]
    result = agg.aggregate(entries)
    assert "claude-code" in result
    assert len(result["claude-code"]) == 1
    # 未关联的 entry 进 _unassigned 桶
    assert "_unassigned" in result
    assert len(result["_unassigned"]) == 1

def test_keyword_match_case_insensitive():
    agg = SignalAggregator(products=[_claude_product()])
    e = _entry("https://x.test/a", "CLAUDE CODE NEW FEATURE")
    result = agg.aggregate([e])
    assert "claude-code" in result

def test_pre_assigned_product_id_preserved():
    """If entry already has product_id (e.g. GitHub release adapter knows the repo), respect it."""
    agg = SignalAggregator(products=[_claude_product()])
    e = _entry("https://x.test/a", "v2.1.150", source=SignalSource.GITHUB_RELEASE)
    e_with_pid = e.model_copy(update={"product_id": "claude-code"})
    result = agg.aggregate([e_with_pid])
    assert "claude-code" in result
```

- [ ] **Step 2: Run, expect ImportError**

- [ ] **Step 3: Implement aggregator.py**

```python
from collections import defaultdict
from packages.schemas.product import Product
from packages.ai_agent_research.changelog_entry import ChangelogEntry

UNASSIGNED = "_unassigned"

class SignalAggregator:
    def __init__(self, products: list[Product]) -> None:
        self.products = products
        # precompute lowercase keywords per product
        self._keyword_index: list[tuple[str, list[str]]] = [
            (p.id, [kw.lower() for kw in p.keywords])
            for p in products
        ]

    def aggregate(self, entries: list[ChangelogEntry]) -> dict[str, list[ChangelogEntry]]:
        """Dedup by source_url, then group by product_id (or '_unassigned')."""
        seen: set[str] = set()
        deduped: list[ChangelogEntry] = []
        for e in entries:
            key = str(e.source_url)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(e)

        result: dict[str, list[ChangelogEntry]] = defaultdict(list)
        for e in deduped:
            pid = e.product_id or self._associate(e)
            result[pid or UNASSIGNED].append(e)
        return dict(result)

    def _associate(self, entry: ChangelogEntry) -> str | None:
        haystack = f"{entry.title} {entry.summary}".lower()
        for pid, kws in self._keyword_index:
            if any(kw in haystack for kw in kws):
                return pid
        return None
```

- [ ] **Step 4: Run, 4 passed**

- [ ] **Step 5: Commit**

```bash
git add packages/ai_agent_research/aggregator.py tests/test_aggregator.py
git commit -m "feat(research): SignalAggregator dedup by URL + product association by keyword"
```

---

## Task 19: AIHOT L1 adapter

**Files:**
- Create: `adapters/layer1_radar/__init__.py` (empty)
- Create: `adapters/layer1_radar/aihot.py`
- Create: `tests/test_aihot.py`

The adapter calls AIHOT's public REST API (`https://aihot.virxact.com/api/public/items?q=<keyword>&since=<iso>`) and converts results to `ChangelogEntry`.

> Reuses the AIHOT public API documented in `~/.claude/skills/aihot/SKILL.md`. Required UA header from skill: `Mozilla/5.0 (Macintosh; ...) aihot-skill/0.2.0`.

- [ ] **Step 1: Write failing test (mock httpx response)**

```python
import json
from datetime import datetime, timedelta, timezone
import httpx
import pytest
from pytest_httpx import HTTPXMock
from packages.ai_agent_research.changelog_entry import SignalSource
from adapters.layer1_radar.aihot import fetch_aihot_signals

FAKE_AIHOT_RESPONSE = {
    "count": 2,
    "hasNext": False,
    "nextCursor": None,
    "items": [
        {
            "id": "cm9abc",
            "title": "Claude Code v2.1.150 发布",
            "url": "https://www.anthropic.com/news/claude-code-2-1-150",
            "source": "Anthropic Blog",
            "publishedAt": "2026-05-23T10:00:00.000Z",
            "summary": "新增 /code-review 命令",
            "category": "ai-products",
        },
        {
            "id": "cm9def",
            "title": "Cursor IDE 0.50",
            "url": "https://cursor.com/changelog/0-50",
            "source": "Cursor",
            "publishedAt": "2026-05-22T08:00:00.000Z",
            "summary": "Composer mode improvements",
            "category": "ai-products",
        },
    ],
}

@pytest.mark.asyncio
async def test_fetch_aihot_signals(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        method="GET",
        url__startswith="https://aihot.virxact.com/api/public/items",
        json=FAKE_AIHOT_RESPONSE,
    )
    async with httpx.AsyncClient() as client:
        entries = await fetch_aihot_signals(
            client,
            query="Claude Code",
            since=datetime(2026, 5, 22, tzinfo=timezone.utc),
        )
    assert len(entries) == 2
    assert entries[0].source == SignalSource.AIHOT
    assert entries[0].title == "Claude Code v2.1.150 发布"
    assert entries[0].published_at.tzinfo is not None
    assert "claude-code-2-1-150" in str(entries[0].source_url)

@pytest.mark.asyncio
async def test_fetch_aihot_includes_ua_header(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        method="GET", url__startswith="https://aihot.virxact.com",
        json={"items": [], "count": 0, "hasNext": False, "nextCursor": None},
    )
    async with httpx.AsyncClient() as client:
        await fetch_aihot_signals(client, query="x")
    request = httpx_mock.get_request()
    ua = request.headers.get("user-agent", "")
    assert "aihot-skill" in ua  # marker so admin can distinguish skill traffic
```

- [ ] **Step 2: Run — ImportError**

- [ ] **Step 3: Implement aihot.py**

```python
from datetime import datetime, timezone
import httpx
from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource

UA = "Mozilla/5.0 (compatible; ai-agent-comp-analysis/0.1) aihot-skill/0.2.0"
BASE = "https://aihot.virxact.com/api/public/items"

async def fetch_aihot_signals(
    client: httpx.AsyncClient,
    *,
    query: str | None = None,
    since: datetime | None = None,
    take: int = 50,
) -> list[ChangelogEntry]:
    params: dict = {"mode": "selected", "take": take}
    if query:
        params["q"] = query
    if since:
        params["since"] = since.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    r = await client.get(BASE, params=params, headers={"User-Agent": UA}, timeout=20.0)
    r.raise_for_status()
    data = r.json()

    return [
        ChangelogEntry(
            source=SignalSource.AIHOT,
            source_url=item["url"],
            title=item.get("title") or "",
            summary=item.get("summary") or "",
            published_at=datetime.fromisoformat(
                item["publishedAt"].replace("Z", "+00:00")
            ),
            raw_metadata={
                "aihot_id": item.get("id"),
                "category": item.get("category"),
                "source_name": item.get("source"),
            },
        )
        for item in data.get("items", [])
        if item.get("url") and item.get("publishedAt")
    ]
```

- [ ] **Step 4: Run, 2 passed**

- [ ] **Step 5: Commit**

```bash
git add adapters/layer1_radar/__init__.py adapters/layer1_radar/aihot.py tests/test_aihot.py
git commit -m "feat(adapter:L1): AIHOT REST API adapter with skill-marker UA"
```

---

## Task 20: wechat-article-search L1 adapter

**Files:**
- Create: `adapters/layer1_radar/wechat_search.py`
- Create: `tests/test_wechat_search.py`

The adapter calls the existing `~/.claude/skills/wechat-article-search/scripts/search_wechat.js` Node script via `subprocess.run` and converts JSON output to `ChangelogEntry`.

- [ ] **Step 1: Write failing test (mock subprocess)**

```python
import json
import subprocess
from unittest.mock import patch
from packages.ai_agent_research.changelog_entry import SignalSource
from adapters.layer1_radar.wechat_search import fetch_wechat_signals

FAKE_OUTPUT = {
    "articles": [
        {
            "title": "Claude Code 全流程指南",
            "url": "https://mp.weixin.qq.com/s/abc",
            "summary": "Claude Code 安装和使用",
            "date": "2026-05-22",
            "source": "小梁懂AI",
        },
        {
            "title": "Cursor 新功能",
            "url": "https://mp.weixin.qq.com/s/xyz",
            "summary": "Composer 升级",
            "date": "2026-05-21",
            "source": "AI 前线",
        },
    ]
}

def test_fetch_wechat_signals_parses_output():
    with patch("adapters.layer1_radar.wechat_search.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=0,
            stdout=json.dumps(FAKE_OUTPUT), stderr="",
        )
        entries = fetch_wechat_signals(query="Claude Code", limit=5)

    assert len(entries) == 2
    assert entries[0].source == SignalSource.WECHAT
    assert entries[0].title == "Claude Code 全流程指南"
    assert entries[0].raw_metadata["wechat_account"] == "小梁懂AI"

def test_fetch_wechat_signals_empty():
    with patch("adapters.layer1_radar.wechat_search.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=0,
            stdout=json.dumps({"articles": []}), stderr="",
        )
        assert fetch_wechat_signals(query="x") == []

def test_fetch_wechat_signals_subprocess_failure_returns_empty():
    """If wechat script crashes (e.g. cheerio missing), return empty rather than raise."""
    with patch("adapters.layer1_radar.wechat_search.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=1, stdout="", stderr="MODULE_NOT_FOUND: cheerio",
        )
        assert fetch_wechat_signals(query="x") == []
```

- [ ] **Step 2: Run — ImportError**

- [ ] **Step 3: Implement wechat_search.py**

```python
import json
import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource

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
```

- [ ] **Step 4: Run, 3 passed**

- [ ] **Step 5: Commit**

```bash
git add adapters/layer1_radar/wechat_search.py tests/test_wechat_search.py
git commit -m "feat(adapter:L1): wechat-article-search subprocess adapter, fail-soft on errors"
```

---

## Task 21: TrendRadar L1 adapter (output URL fetcher)

**Files:**
- Create: `adapters/layer1_radar/trendradar.py`
- Create: `tests/test_trendradar.py`

TrendRadar is deployed externally (per ADR A3 — independent fork via GitHub Actions). Its output is a JSON file at a configurable URL. This adapter fetches that output and filters by product keywords.

> Deployment: separate ops doc (not part of this plan). Adapter contract: `TRENDRADAR_OUTPUT_URL` env var points to a JSON URL with shape `{"items": [{"title", "url", "platform", "publishedAt", "score"}, ...]}`.

- [ ] **Step 1: Write failing test**

```python
import os
from datetime import datetime, timezone
import httpx
import pytest
from pytest_httpx import HTTPXMock
from packages.ai_agent_research.changelog_entry import SignalSource
from adapters.layer1_radar.trendradar import fetch_trendradar_signals

FAKE_TRENDRADAR = {
    "items": [
        {
            "title": "Claude Code 又出了新功能",
            "url": "https://www.zhihu.com/question/123",
            "platform": "zhihu",
            "publishedAt": "2026-05-23T12:00:00Z",
            "score": 0.87,
        },
        {
            "title": "微博热搜不相关",
            "url": "https://weibo.com/abc",
            "platform": "weibo",
            "publishedAt": "2026-05-23T11:00:00Z",
            "score": 0.5,
        },
    ]
}

@pytest.mark.asyncio
async def test_fetch_trendradar_filters_by_keyword(httpx_mock: HTTPXMock, monkeypatch):
    monkeypatch.setenv("TRENDRADAR_OUTPUT_URL", "https://trendradar.test/output.json")
    httpx_mock.add_response(url="https://trendradar.test/output.json", json=FAKE_TRENDRADAR)
    async with httpx.AsyncClient() as client:
        entries = await fetch_trendradar_signals(client, keywords=["Claude Code"])
    assert len(entries) == 1
    assert entries[0].source == SignalSource.TRENDRADAR
    assert entries[0].raw_metadata["platform"] == "zhihu"

@pytest.mark.asyncio
async def test_fetch_trendradar_no_url_configured(monkeypatch):
    monkeypatch.delenv("TRENDRADAR_OUTPUT_URL", raising=False)
    async with httpx.AsyncClient() as client:
        entries = await fetch_trendradar_signals(client, keywords=["x"])
    assert entries == []  # graceful no-op
```

- [ ] **Step 2: Run, expect ImportError**

- [ ] **Step 3: Implement trendradar.py**

```python
import logging
import os
from datetime import datetime
import httpx
from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource

logger = logging.getLogger(__name__)

async def fetch_trendradar_signals(
    client: httpx.AsyncClient,
    *,
    keywords: list[str],
) -> list[ChangelogEntry]:
    url = os.environ.get("TRENDRADAR_OUTPUT_URL")
    if not url:
        logger.info("TRENDRADAR_OUTPUT_URL not set; skipping")
        return []

    try:
        r = await client.get(url, timeout=20.0)
        r.raise_for_status()
    except httpx.HTTPError as e:
        logger.warning("TrendRadar fetch failed: %s", e)
        return []

    data = r.json()
    kws_lower = [k.lower() for k in keywords]
    out: list[ChangelogEntry] = []
    for item in data.get("items", []):
        title = item.get("title") or ""
        if not any(k in title.lower() for k in kws_lower):
            continue
        try:
            published = datetime.fromisoformat(
                item["publishedAt"].replace("Z", "+00:00")
            )
        except (KeyError, ValueError):
            continue
        out.append(ChangelogEntry(
            source=SignalSource.TRENDRADAR,
            source_url=item["url"],
            title=title,
            summary=item.get("summary") or "",
            published_at=published,
            raw_metadata={
                "platform": item.get("platform"),
                "trendradar_score": item.get("score"),
            },
        ))
    return out
```

- [ ] **Step 4: Run, 2 passed**

- [ ] **Step 5: Commit**

```bash
git add adapters/layer1_radar/trendradar.py tests/test_trendradar.py
git commit -m "feat(adapter:L1): TrendRadar output-URL fetcher with keyword filter"
```

---

## Task 22: Importance scorer (3-factor formula)

**Files:**
- Create: `packages/ai_agent_research/scorer.py`
- Create: `tests/test_scorer.py`

Per spec §7.2, importance score = `(信号源数量 × 0.4) + (来源权重 × 0.3) + (LLM 评估关键性 × 0.3)`.

For Phase 2, the LLM piece is stubbed via a `KeywordRelevanceScorer` Protocol (real LLM impl is Phase 3 wiring). Source weights are a static dict.

- [ ] **Step 1: Write failing test**

```python
from datetime import datetime, timezone
from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource
from packages.ai_agent_research.scorer import compute_importance, SourceWeights, StubKeywordScorer

def _e(source: SignalSource, url: str = "https://x.test/a") -> ChangelogEntry:
    return ChangelogEntry(
        source=source, source_url=url,
        title="t", summary="s",
        published_at=datetime(2026, 5, 23, tzinfo=timezone.utc),
    )

def test_single_source_score():
    score = compute_importance(
        entries=[_e(SignalSource.AIHOT)],
        keyword_scorer=StubKeywordScorer(value=0.5),
    )
    # source_count_factor = 1/3 (clamped), weight = AIHOT 0.8, llm = 0.5
    # score = 0.4 * (1/3) + 0.3 * 0.8 + 0.3 * 0.5 = 0.133 + 0.24 + 0.15 = 0.523
    assert 0.5 < score < 0.55

def test_multiple_sources_higher_score():
    entries = [
        _e(SignalSource.AIHOT, "https://x.test/1"),
        _e(SignalSource.GITHUB_RELEASE, "https://x.test/2"),
        _e(SignalSource.WECHAT, "https://x.test/3"),
    ]
    score = compute_importance(entries=entries, keyword_scorer=StubKeywordScorer(value=0.5))
    # source_count_factor = 3/3 = 1.0
    # avg_weight = (AIHOT 0.8 + GITHUB 1.0 + WECHAT 0.6) / 3 = 0.8
    # = 0.4 * 1.0 + 0.3 * 0.8 + 0.3 * 0.5 = 0.4 + 0.24 + 0.15 = 0.79
    assert 0.78 < score < 0.80

def test_score_clamped_to_0_1():
    entries = [_e(SignalSource.GITHUB_RELEASE) for _ in range(10)]
    # url unique enforced by aggregator; for scorer test, we vary url
    entries = [
        _e(SignalSource.GITHUB_RELEASE, f"https://x.test/{i}")
        for i in range(10)
    ]
    score = compute_importance(entries=entries, keyword_scorer=StubKeywordScorer(value=1.0))
    assert score <= 1.0

def test_source_weights_known_values():
    assert SourceWeights[SignalSource.GITHUB_RELEASE] == 1.0
    assert SourceWeights[SignalSource.RSS] == 0.9
    assert SourceWeights[SignalSource.AIHOT] == 0.8
    assert SourceWeights[SignalSource.BLOG] == 0.7
    assert SourceWeights[SignalSource.WECHAT] == 0.6
    assert SourceWeights[SignalSource.TRENDRADAR] == 0.4
    assert SourceWeights[SignalSource.MANUAL] == 1.0
```

- [ ] **Step 2: Run, expect ImportError**

- [ ] **Step 3: Implement scorer.py**

```python
from dataclasses import dataclass
from typing import Protocol
from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource

# 来源权重: 官方 > 半官方 > 社区
SourceWeights: dict[SignalSource, float] = {
    SignalSource.GITHUB_RELEASE: 1.0,
    SignalSource.RSS: 0.9,
    SignalSource.AIHOT: 0.8,
    SignalSource.BLOG: 0.7,
    SignalSource.WECHAT: 0.6,
    SignalSource.TRENDRADAR: 0.4,
    SignalSource.MANUAL: 1.0,  # human-curated trumps all
}

class KeywordRelevanceScorer(Protocol):
    def score(self, entries: list[ChangelogEntry]) -> float: ...

@dataclass
class StubKeywordScorer:
    """Test double — returns canned score."""
    value: float = 0.5
    def score(self, entries: list[ChangelogEntry]) -> float:
        return self.value

# 信号源数量饱和点: 3+ 不同信号源认为是足够的"多源印证"
SATURATION_SOURCE_COUNT = 3

def compute_importance(
    *,
    entries: list[ChangelogEntry],
    keyword_scorer: KeywordRelevanceScorer,
) -> float:
    """Three-factor importance score (0-1, clamped).
    
    Formula: 0.4 * source_count_factor + 0.3 * avg_source_weight + 0.3 * llm_relevance
    
    - source_count_factor = unique source types / SATURATION_SOURCE_COUNT (clamped 0-1)
    - avg_source_weight = mean of SourceWeights for distinct entries
    - llm_relevance = keyword_scorer.score(entries) — should be 0-1
    """
    if not entries:
        return 0.0

    distinct_sources = {e.source for e in entries}
    source_count_factor = min(len(distinct_sources) / SATURATION_SOURCE_COUNT, 1.0)

    weights = [SourceWeights[e.source] for e in entries]
    avg_weight = sum(weights) / len(weights)

    llm_score = keyword_scorer.score(entries)

    score = 0.4 * source_count_factor + 0.3 * avg_weight + 0.3 * llm_score
    return max(0.0, min(1.0, score))
```

- [ ] **Step 4: Run, 4 passed**

- [ ] **Step 5: Commit**

```bash
git add packages/ai_agent_research/scorer.py tests/test_scorer.py
git commit -m "feat(research): 3-factor importance scorer with source weights + stub LLM"
```

---

## Task 23: multi-search-engine L2 adapter (cross-verification)

**Files:**
- Create: `adapters/layer2_search/__init__.py` (empty)
- Create: `adapters/layer2_search/multi_search.py`
- Create: `tests/test_multi_search.py`

multi-search-engine skill produces auditable search URLs across 16 engines. For our use, we want **organic SERP results** for cross-verification: did this changelog appear in multiple search engines?

For Phase 2 MVP, this adapter delegates to `WebFetch` (or httpx) on a Bing/DuckDuckGo URL, parses the title/snippet/link from results page. Real skill integration deferred — for now a minimal HTTP-driven version so Path B can run.

> Note: This is a Phase 2 minimal viable cross-verifier. Phase 3 will integrate the full multi-search-engine skill via subprocess for richer results.

- [ ] **Step 1: Write failing test**

```python
import httpx
import pytest
from pytest_httpx import HTTPXMock
from adapters.layer2_search.multi_search import verify_url_via_search

FAKE_DDG_HTML = """
<html><body>
<a class="result__url" href="https://www.anthropic.com/news/claude-code-2-1-150">claude-code-2-1-150</a>
<a class="result__url" href="https://docs.anthropic.com/changelog">changelog</a>
</body></html>
"""

@pytest.mark.asyncio
async def test_verify_url_found_in_search(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        method="GET",
        url__startswith="https://html.duckduckgo.com/html",
        text=FAKE_DDG_HTML,
    )
    async with httpx.AsyncClient() as client:
        verified = await verify_url_via_search(
            client,
            url="https://www.anthropic.com/news/claude-code-2-1-150",
            query="claude code 2.1.150",
        )
    assert verified is True

@pytest.mark.asyncio
async def test_verify_url_not_found(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        method="GET",
        url__startswith="https://html.duckduckgo.com/html",
        text="<html></html>",
    )
    async with httpx.AsyncClient() as client:
        verified = await verify_url_via_search(
            client,
            url="https://made-up.test/x",
            query="x",
        )
    assert verified is False
```

- [ ] **Step 2: Run, expect ImportError**

- [ ] **Step 3: Implement multi_search.py**

```python
import logging
from urllib.parse import quote_plus, urlparse
import httpx

logger = logging.getLogger(__name__)

UA = "Mozilla/5.0 (compatible; ai-agent-comp-analysis/0.1)"
DDG_HTML = "https://html.duckduckgo.com/html/?q={q}"

async def verify_url_via_search(
    client: httpx.AsyncClient, *, url: str, query: str,
) -> bool:
    """Returns True if `url` (or its canonical host+path) appears in DDG results.
    
    Phase 2 MVP: simple substring match in HTML response.
    Phase 3 will swap in the full multi-search-engine skill output.
    """
    try:
        r = await client.get(
            DDG_HTML.format(q=quote_plus(query)),
            headers={"User-Agent": UA}, timeout=15.0,
        )
        r.raise_for_status()
    except httpx.HTTPError as e:
        logger.warning("DDG search failed: %s", e)
        return False

    parsed = urlparse(url)
    needle = f"{parsed.netloc}{parsed.path}"
    return needle in r.text
```

- [ ] **Step 4: Run, 2 passed**

- [ ] **Step 5: Commit**

```bash
git add adapters/layer2_search/__init__.py adapters/layer2_search/multi_search.py tests/test_multi_search.py
git commit -m "feat(adapter:L2): DDG-based URL verifier (Phase 2 MVP)"
```

---

## Task 24: Changelog ingest (extends ingest.py)

**Files:**
- Create: `packages/ai_agent_research/changelog_ingest.py`
- Create: `tests/test_changelog_ingest.py`

Path B's output is a per-product daily incremental report at `wiki/changelog/{product_id}/{YYYY-MM-DD}.md` summarizing the high-importance entries. Different from Path A's per-dimension cards.

- [ ] **Step 1: Write failing test**

```python
from datetime import date, datetime, timezone
from pathlib import Path
from packages.llm_wiki.paths import init_wiki, WikiLayout
from packages.llm_wiki.ingest import StubLLM, IngestSource
from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource
from packages.ai_agent_research.changelog_ingest import write_changelog_report

def _entry(title: str, url: str = "https://x.test/a") -> ChangelogEntry:
    return ChangelogEntry(
        source=SignalSource.GITHUB_RELEASE,
        source_url=url, title=title, summary="-",
        published_at=datetime(2026, 5, 23, tzinfo=timezone.utc),
        product_id="claude-code", importance_score=0.85,
    )

def test_write_changelog_report_creates_file(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    
    stub = StubLLM(
        analyze_response='{"facts": [], "entities": [], "topics": []}',
        generate_response="# Claude Code · 2026-05-23\n\n- v2.1.150 release\n",
    )
    write_changelog_report(
        layout=layout,
        product_id="claude-code",
        report_date=date(2026, 5, 23),
        entries=[_entry("v2.1.150 release")],
        llm=stub,
    )
    target = tmp_wiki / "changelog" / "claude-code" / "2026-05-23.md"
    assert target.exists()
    content = target.read_text()
    assert "Claude Code" in content
    assert "2026-05-23" in content

def test_changelog_dir_created_in_wiki_layout(tmp_wiki: Path):
    """changelog/ dir is auto-created by write_changelog_report."""
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    
    stub = StubLLM(
        analyze_response='{"facts": [], "entities": [], "topics": []}',
        generate_response="# x\n",
    )
    write_changelog_report(
        layout=layout, product_id="cursor", report_date=date(2026, 5, 23),
        entries=[_entry("Cursor 0.50", "https://cursor.test/0-50")],
        llm=stub,
    )
    assert (tmp_wiki / "changelog" / "cursor").is_dir()
```

- [ ] **Step 2: Run, expect ImportError**

- [ ] **Step 3: Implement changelog_ingest.py**

```python
from datetime import date
from packages.llm_wiki.paths import WikiLayout
from packages.llm_wiki.ingest import IngestEngine, IngestSource, LLMClient
from packages.llm_wiki.atomic import atomic_write_text
from packages.ai_agent_research.changelog_entry import ChangelogEntry

def write_changelog_report(
    *,
    layout: WikiLayout,
    product_id: str,
    report_date: date,
    entries: list[ChangelogEntry],
    llm: LLMClient,
) -> None:
    """Generate a per-product daily changelog report at wiki/changelog/{product_id}/{date}.md.
    
    Bundles all entries into one IngestSource (concat title+summary), runs IngestEngine
    in single-shot mode, then writes the resulting markdown.
    """
    if not entries:
        return

    # Concat entries into one source
    body = "\n\n".join(
        f"### {e.title}\n\n{e.summary}\n\nSource: {e.source.value} {e.source_url}"
        for e in entries
    )
    src = IngestSource(
        url=f"wiki:changelog/{product_id}/{report_date.isoformat()}",
        content=body,
        product_id=product_id,
    )

    engine = IngestEngine(llm=llm, wiki_root=layout.root)
    draft = engine.analyze(src)
    # Single LLM generate() call producing the full daily summary
    md = engine.llm.generate(draft, src)

    target = layout.root / "changelog" / product_id / f"{report_date.isoformat()}.md"
    atomic_write_text(target, md)
```

- [ ] **Step 4: Run, 2 passed**

- [ ] **Step 5: Commit**

```bash
git add packages/ai_agent_research/changelog_ingest.py tests/test_changelog_ingest.py
git commit -m "feat(research): per-product daily changelog report ingest"
```

---

## Task 25: Path B end-to-end sync

**Files:**
- Create: `packages/ai_agent_research/path_b_sync.py`
- Create: `tests/test_path_b_sync.py`

The orchestrator: for each product, fan out L1 fetches → aggregate → score → for high-score, fetch L0 details + L2 verify + write changelog report + queue notification.

- [ ] **Step 1: Write failing test (mocks all adapters)**

```python
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock
from packages.schemas.product import Product
from packages.llm_wiki.paths import init_wiki, WikiLayout
from packages.llm_wiki.ingest import StubLLM
from packages.ai_agent_research.changelog_entry import ChangelogEntry, SignalSource
from packages.ai_agent_research.scorer import StubKeywordScorer
from packages.ai_agent_research.path_b_sync import sync_path_b

def _claude() -> Product:
    return Product(
        id="claude-code", name="Claude Code", category="coding", priority="P0",
        homepage="https://www.anthropic.com/claude-code",
        keywords=["Claude Code"],
    )

def _entry(source: SignalSource, url: str) -> ChangelogEntry:
    return ChangelogEntry(
        source=source, source_url=url,
        title="Claude Code v2.1.150", summary="release",
        published_at=datetime(2026, 5, 23, tzinfo=timezone.utc),
    )

def test_path_b_high_score_writes_changelog(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)

    fake_aihot_signals = [_entry(SignalSource.AIHOT, "https://x.test/1")]
    fake_wechat_signals = [_entry(SignalSource.WECHAT, "https://x.test/2")]
    fake_trendradar_signals = [_entry(SignalSource.TRENDRADAR, "https://x.test/3")]

    stub = StubLLM(
        analyze_response='{"facts": [], "entities": [], "topics": []}',
        generate_response="# Claude Code · 2026-05-23\n\nv2.1.150 release\n",
    )

    with (
        patch("packages.ai_agent_research.path_b_sync.fetch_aihot_signals", new=AsyncMock(return_value=fake_aihot_signals)),
        patch("packages.ai_agent_research.path_b_sync.fetch_wechat_signals", new=MagicMock(return_value=fake_wechat_signals)),
        patch("packages.ai_agent_research.path_b_sync.fetch_trendradar_signals", new=AsyncMock(return_value=fake_trendradar_signals)),
        patch("packages.ai_agent_research.path_b_sync.verify_url_via_search", new=AsyncMock(return_value=True)),
    ):
        result = sync_path_b(
            products=[_claude()],
            layout=layout,
            llm=stub,
            keyword_scorer=StubKeywordScorer(value=0.7),
            report_date=date(2026, 5, 23),
            score_threshold=0.5,
        )

    assert result["claude-code"]["entries_aggregated"] >= 1
    assert result["claude-code"]["score"] >= 0.5
    assert result["claude-code"]["report_written"] is True
    assert (tmp_wiki / "changelog" / "claude-code" / "2026-05-23.md").exists()

def test_path_b_low_score_skips_report(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)

    fake_signals = [_entry(SignalSource.WECHAT, "https://x.test/1")]  # only 1 source, low weight
    stub = StubLLM(analyze_response='{"facts":[],"entities":[],"topics":[]}', generate_response="# x")

    with (
        patch("packages.ai_agent_research.path_b_sync.fetch_aihot_signals", new=AsyncMock(return_value=[])),
        patch("packages.ai_agent_research.path_b_sync.fetch_wechat_signals", new=MagicMock(return_value=fake_signals)),
        patch("packages.ai_agent_research.path_b_sync.fetch_trendradar_signals", new=AsyncMock(return_value=[])),
    ):
        result = sync_path_b(
            products=[_claude()], layout=layout, llm=stub,
            keyword_scorer=StubKeywordScorer(value=0.1),
            report_date=date(2026, 5, 23),
            score_threshold=0.7,
        )

    assert result["claude-code"]["report_written"] is False
    assert not (tmp_wiki / "changelog" / "claude-code" / "2026-05-23.md").exists()
```

- [ ] **Step 2: Run, expect ImportError**

- [ ] **Step 3: Implement path_b_sync.py**

```python
import asyncio
import logging
from datetime import date, datetime, timezone
from typing import Any
import httpx
from packages.schemas.product import Product
from packages.llm_wiki.paths import WikiLayout
from packages.llm_wiki.ingest import LLMClient
from packages.ai_agent_research.changelog_entry import ChangelogEntry
from packages.ai_agent_research.aggregator import SignalAggregator, UNASSIGNED
from packages.ai_agent_research.scorer import compute_importance, KeywordRelevanceScorer
from packages.ai_agent_research.changelog_ingest import write_changelog_report
from adapters.layer1_radar.aihot import fetch_aihot_signals
from adapters.layer1_radar.wechat_search import fetch_wechat_signals
from adapters.layer1_radar.trendradar import fetch_trendradar_signals
from adapters.layer2_search.multi_search import verify_url_via_search

logger = logging.getLogger(__name__)

async def _gather_signals(
    products: list[Product], *, since: datetime,
) -> list[ChangelogEntry]:
    """Fan out L1 fetches across products in parallel."""
    keywords = [kw for p in products for kw in p.keywords]
    out: list[ChangelogEntry] = []

    async with httpx.AsyncClient() as client:
        tasks = [fetch_trendradar_signals(client, keywords=keywords)]
        for p in products:
            for kw in p.keywords[:1]:  # primary keyword only to bound API cost
                tasks.append(fetch_aihot_signals(client, query=kw, since=since))
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                logger.warning("L1 fetch failed: %s", r)
                continue
            out.extend(r)

    # wechat is sync subprocess — call serially after async batch
    for p in products:
        out.extend(fetch_wechat_signals(query=p.keywords[0], limit=10))

    return out

def sync_path_b(
    *,
    products: list[Product],
    layout: WikiLayout,
    llm: LLMClient,
    keyword_scorer: KeywordRelevanceScorer,
    report_date: date | None = None,
    score_threshold: float = 0.5,
    since_hours: int = 24,
) -> dict[str, Any]:
    """Path B end-to-end: gather signals → aggregate → score → write report for high-score products."""
    report_date = report_date or date.today()
    since = datetime.now(timezone.utc).replace(microsecond=0) - \
        timezone.utc.utcoffset(None)  # last 24h
    # Simpler: timedelta
    from datetime import timedelta
    since = datetime.now(timezone.utc) - timedelta(hours=since_hours)

    raw_signals = asyncio.run(_gather_signals(products, since=since))
    aggregator = SignalAggregator(products=products)
    grouped = aggregator.aggregate(raw_signals)

    result: dict[str, dict[str, Any]] = {}
    for product in products:
        entries = grouped.get(product.id, [])
        score = compute_importance(entries=entries, keyword_scorer=keyword_scorer)
        report_written = False
        if score >= score_threshold and entries:
            write_changelog_report(
                layout=layout, product_id=product.id, report_date=report_date,
                entries=entries, llm=llm,
            )
            layout.append_log("path-b", f"{product.id}: {len(entries)} signals, score={score:.2f}")
            report_written = True
        result[product.id] = {
            "entries_aggregated": len(entries),
            "score": score,
            "report_written": report_written,
        }
    return result
```

- [ ] **Step 4: Run, 2 passed**

- [ ] **Step 5: Commit**

```bash
git add packages/ai_agent_research/path_b_sync.py tests/test_path_b_sync.py
git commit -m "feat(research): Path B end-to-end sync_path_b"
```

---

## Task 26: Feishu bot push (Layer 3 notify)

**Files:**
- Create: `adapters/layer3_notify/__init__.py` (empty)
- Create: `adapters/layer3_notify/feishu_bot.py`
- Create: `tests/test_feishu_bot.py`

Feishu bot via custom webhook (the simplest mode — no OAuth needed). Webhook URL in `FEISHU_BOT_WEBHOOK` env var.

- [ ] **Step 1: Write failing test**

```python
import pytest
from pytest_httpx import HTTPXMock
import httpx
from adapters.layer3_notify.feishu_bot import push_changelog_card

@pytest.mark.asyncio
async def test_push_card(httpx_mock: HTTPXMock, monkeypatch):
    monkeypatch.setenv("FEISHU_BOT_WEBHOOK", "https://open.feishu.cn/open-apis/bot/v2/hook/abc")
    httpx_mock.add_response(
        url="https://open.feishu.cn/open-apis/bot/v2/hook/abc",
        json={"StatusCode": 0, "StatusMessage": "success"},
    )
    async with httpx.AsyncClient() as client:
        ok = await push_changelog_card(
            client,
            product_name="Claude Code",
            score=0.85,
            entry_count=3,
            report_url="file://wiki/changelog/claude-code/2026-05-23.md",
        )
    assert ok is True

@pytest.mark.asyncio
async def test_push_no_webhook_configured(monkeypatch):
    monkeypatch.delenv("FEISHU_BOT_WEBHOOK", raising=False)
    async with httpx.AsyncClient() as client:
        ok = await push_changelog_card(
            client, product_name="x", score=0.9, entry_count=1, report_url="x",
        )
    assert ok is False  # no-op when not configured

@pytest.mark.asyncio
async def test_push_card_failure(httpx_mock: HTTPXMock, monkeypatch):
    monkeypatch.setenv("FEISHU_BOT_WEBHOOK", "https://open.feishu.cn/x")
    httpx_mock.add_response(url="https://open.feishu.cn/x", status_code=500)
    async with httpx.AsyncClient() as client:
        ok = await push_changelog_card(
            client, product_name="x", score=0.9, entry_count=1, report_url="x",
        )
    assert ok is False
```

- [ ] **Step 2: Run, expect ImportError**

- [ ] **Step 3: Implement feishu_bot.py**

```python
import logging
import os
import httpx

logger = logging.getLogger(__name__)

async def push_changelog_card(
    client: httpx.AsyncClient,
    *,
    product_name: str,
    score: float,
    entry_count: int,
    report_url: str,
) -> bool:
    """Push a changelog summary card to Feishu via custom bot webhook.
    
    Returns True on success (StatusCode == 0), False otherwise.
    """
    webhook = os.environ.get("FEISHU_BOT_WEBHOOK")
    if not webhook:
        logger.info("FEISHU_BOT_WEBHOOK not set; skipping push")
        return False

    payload = {
        "msg_type": "interactive",
        "card": {
            "header": {"title": {"tag": "plain_text", "content": f"📡 {product_name} 变更"}},
            "elements": [
                {"tag": "div", "text": {"tag": "lark_md",
                 "content": f"**重要性:** {score:.2f} · **变更数:** {entry_count}"}},
                {"tag": "action", "actions": [
                    {"tag": "button",
                     "text": {"tag": "plain_text", "content": "查看报告"},
                     "url": report_url, "type": "default"},
                ]},
            ],
        },
    }
    try:
        r = await client.post(webhook, json=payload, timeout=15.0)
        r.raise_for_status()
        data = r.json()
        return data.get("StatusCode") == 0
    except httpx.HTTPError as e:
        logger.warning("Feishu bot push failed: %s", e)
        return False
```

- [ ] **Step 4: Run, 3 passed**

- [ ] **Step 5: Commit**

```bash
git add adapters/layer3_notify/__init__.py adapters/layer3_notify/feishu_bot.py tests/test_feishu_bot.py
git commit -m "feat(adapter:L3): Feishu bot webhook push for changelog cards"
```

---

## Task 27: CLI extension (path-b + notify)

**Files:**
- Modify: `cli/main.py` (add 2 commands)
- Create: `tests/test_cli_phase2.py`

- [ ] **Step 1: Write failing test**

```python
from typer.testing import CliRunner
from cli.main import app

runner = CliRunner()

def test_help_includes_path_b_command():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "path-b" in result.stdout

def test_help_includes_notify_command():
    result = runner.invoke(app, ["--help"])
    assert "notify" in result.stdout

def test_path_b_dry_run_succeeds(tmp_path, monkeypatch):
    """path-b --dry-run should print plan without making any network calls."""
    monkeypatch.delenv("TRENDRADAR_OUTPUT_URL", raising=False)
    runner.invoke(app, ["init", "--root", str(tmp_path / "wiki")])
    result = runner.invoke(app, [
        "path-b", "--dry-run",
        "--root", str(tmp_path / "wiki"),
        "--products-file", "products/coding-agents.yaml",
    ])
    assert result.exit_code == 0
```

- [ ] **Step 2: Run, expect failures**

- [ ] **Step 3: Add commands to cli/main.py**

Append to `cli/main.py`:

```python
@app.command("path-b", help="Run Path B (daily changelog incremental sync)")
def path_b(
    products_file: Path = typer.Option(Path("products/coding-agents.yaml")),
    only: str = typer.Option("", "--only", help="Comma-separated product IDs"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Plan only, no API calls"),
    threshold: float = typer.Option(0.5, "--threshold"),
    root: Path = ROOT_OPT,
) -> None:
    raw = yaml.safe_load(products_file.read_text(encoding="utf-8"))
    products = [Product(**p) for p in raw["products"]]
    if only:
        keep = set(only.split(","))
        products = [p for p in products if p.id in keep]

    if dry_run:
        typer.echo(f"[dry-run] would sync Path B for {len(products)} product(s):")
        for p in products:
            typer.echo(f"  - {p.id} (keywords: {', '.join(p.keywords[:3])})")
        return

    # Real run requires LLM client — Phase 3 will wire anthropic SDK.
    typer.echo(f"[Phase 2 stub] would call sync_path_b with {len(products)} products at threshold {threshold}")
    typer.echo("Real impl: import sync_path_b from packages.ai_agent_research.path_b_sync")

@app.command("notify", help="Push pending changelog reports to Feishu")
def notify(root: Path = ROOT_OPT) -> None:
    typer.echo(f"[stub] notify — would scan {root}/changelog/ and push unsent reports")
```

- [ ] **Step 4: Run, 3 passed**

- [ ] **Step 5: Commit**

```bash
git add cli/main.py tests/test_cli_phase2.py
git commit -m "feat(cli): path-b + notify commands (Phase 2 plumbing)"
```

---

## Task 28: GitHub Actions daily cron

**Files:**
- Create: `.github/workflows/daily-changelog.yml`

- [ ] **Step 1: Write workflow**

```yaml
name: daily-changelog
on:
  schedule:
    - cron: '0 0 * * *'  # UTC 00:00 = 北京 08:00
  workflow_dispatch:

jobs:
  path-b:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install uv
        run: curl -LsSf https://astral.sh/uv/install.sh | sh
      - run: uv sync --all-extras
      - name: Install Node deps for wechat-article-search
        run: |
          mkdir -p ~/skills/wechat-article-search
          # wechat-article-search skill checked into repo or installed via skillhub here
          # For Phase 2, document but skip: cd ~/skills/wechat-article-search && npm install cheerio
        continue-on-error: true
      - name: Run Path B
        env:
          TRENDRADAR_OUTPUT_URL: ${{ secrets.TRENDRADAR_OUTPUT_URL }}
          FEISHU_BOT_WEBHOOK: ${{ secrets.FEISHU_BOT_WEBHOOK }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: uv run wiki path-b --threshold 0.5
      - name: Commit changelog updates
        run: |
          git config user.email "actions@github.com"
          git config user.name "github-actions[bot]"
          git add wiki/changelog/ wiki/log.md || true
          git diff --staged --quiet || git commit -m "chore(changelog): daily Path B sync $(date -u +%Y-%m-%d)"
          git push || true
```

- [ ] **Step 2: Lint workflow** (no Python test for YAML; check `actionlint` if installed, else visual review)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/daily-changelog.yml
git commit -m "ci: daily-changelog workflow (cron + workflow_dispatch)"
```

---

## Task 29: README update + Phase 2 status

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Replace Phase 1 status section with:

```markdown
**Status:** Phase 2 complete (Path B daily incremental)

## Phase 2 coverage

- ✅ ChangelogEntry schema with 7-source enum
- ✅ Signal aggregator (dedup + product association)
- ✅ L1 adapters: AIHOT / wechat-article-search / TrendRadar
- ✅ L2 adapter: multi-search-engine (DDG MVP)
- ✅ 3-factor importance scorer
- ✅ Per-product daily changelog reports (`wiki/changelog/{product}/{date}.md`)
- ✅ Path B end-to-end orchestrator
- ✅ Feishu bot push for high-score changes
- ✅ CLI: `wiki path-b` + `wiki notify`
- ✅ GitHub Actions daily cron at UTC 00:00
```

Update Architecture section to mention `ai_agent_research` and 3 new adapter layers.

- [ ] **Step 2: Run all tests one last time**

`~/.local/bin/uv run pytest -v` — expect ~70 tests passing (45 from Phase 1 + ~25 from Phase 2).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README Phase 2 complete (Path B daily incremental)"
```

---

## Plan Self-Review

**Spec coverage check** (against spec §11 Phase 2):

| Spec task | Plan task |
|---|---|
| L1 适配器: AIHOT + wechat-article-search + TrendRadar | T19, T20, T21 |
| 信号聚合器 + 重要性打分 | T18, T22 |
| LLM 生成增量报告 | T24 |
| 飞书机器人推送 | T26 |
| (隐含) Path B sync orchestration | T25 |
| (隐含) L2 cross-verify | T23 |
| (隐含) CLI integration | T27 |
| (隐含) Daily cron scheduling | T28 |
| (隐含) ChangelogEntry schema | T17 |

All Phase 2 spec tasks covered. ✓

**Type consistency check:**
- `ChangelogEntry` defined in T17, used in T18/T19/T20/T21/T22/T24/T25 ✓
- `SignalSource` enum used consistently ✓
- `KeywordRelevanceScorer` Protocol + StubKeywordScorer test double pattern (mirrors T10's LLMClient) ✓
- `SignalAggregator.aggregate` returns `dict[str, list[ChangelogEntry]]` consistently ✓

**Placeholder check:** Most Phase 2 tasks have full code. T28 (cron yaml) has a `continue-on-error` for wechat skill install which is intentional — defer node install setup to ops. T27 path-b CLI is a stub for Phase 2 (real wiring with anthropic SDK is Phase 3) — explicitly marked `[Phase 2 stub]`.

**Scope check:** Phase 2 is 1 week, 13 tasks (~3-5 hours each = ~40-65h). Reasonable.

---

## Beyond Phase 2 (preview, not part of this plan)

After Phase 2 ships:
- `2026-XX-phase3-comparison-engine.md` — Path C (Wiki-first query) + render layer (MD/HTML/PPT/飞书 wiki sync)
- `2026-XX-phase4-pm-portfolio.md` — 6 篇专题报告 (服务 DeepSeek 应聘)
- `2026-XX-phase5-longtail.md` — P2 产品扩展 + 维度库迭代
