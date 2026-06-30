#!/usr/bin/env python3
"""
Ingest OpenAI Codex official posts into the local wiki.

Run with:
  uv run --with curl_cffi --with beautifulsoup4 --with markdownify \
    python scripts/ingest_codex_official_posts.py
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup
from curl_cffi import requests
from markdownify import markdownify as to_markdown


ROOT = Path(__file__).resolve().parents[1]
RAW_BASE = ROOT / "wiki" / "raw" / "official-posts" / "codex"
CARD_BASE = ROOT / "wiki" / "review" / "source-cards" / "official-posts"
COVERAGE_PATH = (
    ROOT
    / "wiki"
    / "review"
    / "ingest-coverage"
    / "2026-05-25-codex-official-posts.md"
)

POSTS = [
    "https://openai.com/index/gartner-2026-agentic-coding-leader/",
    "https://openai.com/index/dell-codex-enterprise-partnership/",
    "https://openai.com/index/building-codex-windows-sandbox/",
    "https://openai.com/zh-Hans-CN/index/running-codex-safely/",
    "https://openai.com/zh-Hans-CN/index/openai-on-aws/",
    "https://openai.com/zh-Hans-CN/index/speeding-up-agentic-workflows-with-websockets/",
    "https://openai.com/zh-Hans-CN/index/scaling-codex-to-enterprises-worldwide/",
    "https://openai.com/zh-Hans-CN/index/codex-for-almost-everything/",
    "https://openai.com/zh-Hans-CN/index/codex-flexible-pricing-for-teams/",
    "https://openai.com/zh-Hans-CN/index/codex-security-now-in-research-preview/",
    "https://openai.com/zh-Hans-CN/index/beyond-rate-limits/",
    "https://openai.com/zh-Hans-CN/index/introducing-gpt-5-3-codex-spark/",
    "https://openai.com/zh-Hans-CN/index/harness-engineering/",
    "https://openai.com/zh-Hans-CN/index/introducing-gpt-5-3-codex/",
    "https://openai.com/zh-Hans-CN/index/gpt-5-3-codex-system-card/",
    "https://openai.com/zh-Hans-CN/index/unlocking-the-codex-harness/",
    "https://openai.com/zh-Hans-CN/index/unrolling-the-codex-agent-loop/",
    "https://openai.com/zh-Hans-CN/index/introducing-upgrades-to-codex/",
    "https://openai.com/zh-Hans-CN/index/introducing-gpt-5-2-codex/",
    "https://openai.com/index/work-with-codex-from-anywhere/",
]

SIGNALS = [
    ("Harness", r"harness|运行框架|智能体框架"),
    ("Agent Loop", r"agent loop|智能体循环|loop"),
    ("Sandbox", r"sandbox|沙箱|windows sandbox"),
    ("Safety/Security", r"safety|security|安全|权限|approval|permission"),
    ("Context", r"context|上下文|context window|compact|压缩"),
    ("Tool Use", r"tool|工具|shell|terminal|websocket|websockets"),
    ("MCP/API", r"\bMCP\b|Responses API|API|SDK|websocket"),
    ("Cloud/Enterprise", r"enterprise|企业|AWS|Dell|cloud|worldwide"),
    ("Pricing/Quota", r"pricing|rate limit|flexible pricing|定价|速率限制"),
    ("Model/System Card", r"GPT-5|system card|模型|系统卡|codex spark"),
    ("Review/Eval", r"review|eval|benchmark|Gartner|system card|评测"),
]


@dataclass
class Post:
    url: str
    final_url: str
    title: str
    author: str
    date: str
    body: str
    raw_path: Path | None = None
    card_path: Path | None = None
    destinations: list[str] | None = None


def slugify(text: str, max_len: int = 78) -> str:
    out = text.lower()
    out = re.sub(r"https?://", "", out)
    out = re.sub(r"[\s_]+", "-", out)
    out = re.sub(r'[\\/:*?"<>|]', "", out)
    out = re.sub(r"[^\w\u4e00-\u9fff-]+", "-", out)
    out = re.sub(r"-+", "-", out).strip("-")
    return (out or "untitled")[:max_len].strip("-")


def yaml_string(text: str) -> str:
    return '"' + str(text or "").replace("\\", "\\\\").replace('"', '\\"') + '"'


def date_prefix(date: str) -> str:
    if not date:
        return "undated"
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", date)
    if m:
        return "-".join(m.groups())
    m = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", date)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = re.search(r"\b([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\b", date)
    if m:
        months = {
            "jan": "01",
            "january": "01",
            "feb": "02",
            "february": "02",
            "mar": "03",
            "march": "03",
            "apr": "04",
            "april": "04",
            "may": "05",
            "jun": "06",
            "june": "06",
            "jul": "07",
            "july": "07",
            "aug": "08",
            "august": "08",
            "sep": "09",
            "sept": "09",
            "september": "09",
            "oct": "10",
            "october": "10",
            "nov": "11",
            "november": "11",
            "dec": "12",
            "december": "12",
        }
        month = months.get(m.group(1).lower())
        if month:
            return f"{m.group(3)}-{month}-{int(m.group(2)):02d}"
    return "undated"


def read_json_ld(soup: BeautifulSoup) -> list[dict]:
    out: list[dict] = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(tag.get_text())
        except Exception:
            continue
        if isinstance(data, list):
            out.extend(x for x in data if isinstance(x, dict))
        elif isinstance(data, dict) and isinstance(data.get("@graph"), list):
            out.extend(x for x in data["@graph"] if isinstance(x, dict))
        elif isinstance(data, dict):
            out.append(data)
    return out


def meta_content(soup: BeautifulSoup, *, property_name: str = "", name: str = "") -> str:
    attrs = {"property": property_name} if property_name else {"name": name}
    tag = soup.find("meta", attrs=attrs)
    return str(tag.get("content", "")).strip() if tag else ""


def metadata(soup: BeautifulSoup, url: str) -> tuple[str, str, str]:
    blog = None
    for item in read_json_ld(soup):
        kind = item.get("@type")
        kinds = kind if isinstance(kind, list) else [kind]
        if "BlogPosting" in kinds or "Article" in kinds or "NewsArticle" in kinds:
            blog = item
            break
    title = (
        (blog or {}).get("headline")
        or meta_content(soup, property_name="og:title")
        or (soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else "")
        or (soup.title.get_text(" ", strip=True) if soup.title else "")
        or url.rstrip("/").split("/")[-1]
    )
    title = re.sub(r"\s+\|\s+OpenAI$", "", str(title)).strip()
    raw_author = (blog or {}).get("author", "")
    if isinstance(raw_author, dict):
        author = raw_author.get("name", "")
    elif isinstance(raw_author, list):
        author = ", ".join(str(a.get("name", "")) for a in raw_author if isinstance(a, dict))
    else:
        author = str(raw_author or "")
    date = str((blog or {}).get("datePublished") or (blog or {}).get("dateModified") or "")
    if not date:
        text = soup.get_text("\n", strip=True)
        m = re.search(r"\d{4}年\d{1,2}月\d{1,2}日|[A-Za-z]{3,9}\s+\d{1,2},\s*\d{4}", text)
        date = m.group(0) if m else ""
    return title, author.strip(), date.strip()


def clean_markdown(md: str, title: str) -> str:
    md = re.sub(r"\n{3,}", "\n\n", md).strip()
    cut_markers = [
        "\n## 继续阅读",
        "\n## Continue reading",
        "\n继续阅读",
        "\nContinue reading",
        "\n## Our research",
        "\n## 我们的研究",
        "\nOur research",
        "\n我们的研究",
        "\nOpenAI ©",
        "\nWe use cookies",
        "\n我们使用 Cookie",
    ]
    for marker in cut_markers:
        idx = md.find(marker)
        if idx > 1200:
            md = md[:idx].strip()
    if not md.startswith("# "):
        md = f"# {title}\n\n{md}"
    return re.sub(r"\n{3,}", "\n\n", md).strip()


def fetch_post(url: str) -> Post:
    response = requests.get(
        url,
        impersonate="chrome136",
        timeout=45,
        headers={"accept-language": "zh-CN,zh;q=0.9,en;q=0.8"},
    )
    if response.status_code >= 400:
        raise RuntimeError(f"HTTP {response.status_code}")
    soup = BeautifulSoup(response.text, "html.parser")
    title, author, date = metadata(soup, str(response.url))
    main = soup.find("main") or soup.find("article") or soup.body or soup
    for tag in main.find_all(["script", "style", "svg", "nav", "footer"]):
        tag.decompose()
    body = clean_markdown(to_markdown(str(main), heading_style="ATX"), title)
    if len(body) < 800:
        raise RuntimeError(f"content too short: {len(body)}")
    return Post(url=url, final_url=str(response.url), title=title, author=author, date=date, body=body)


def hit_signals(body: str) -> list[tuple[str, int]]:
    hits: list[tuple[str, int]] = []
    for name, pattern in SIGNALS:
        count = len(re.findall(pattern, body, flags=re.I))
        if count:
            hits.append((name, count))
    return sorted(hits, key=lambda x: x[1], reverse=True)


def destinations(post: Post) -> list[str]:
    text = f"{post.title}\n{post.final_url}\n{post.body[:6000]}".lower()
    out = {"research/entities/codex.md"}
    if re.search(r"harness|agent loop|智能体循环|sandbox|沙箱|tool|工具|context|上下文|mcp", text):
        out.add("research/concepts/prompt-context-harness.md")
        out.add("research/concepts/harness-engineering.md")
    if re.search(r"security|safety|安全|system card|eval|review|gartner|rate limit|pricing|enterprise|速率|定价|访问规模", text):
        out.add("research/topics/agent-evaluation-system.md")
    return sorted(out)


def headings(md: str) -> list[str]:
    out = []
    for line in md.splitlines():
        if re.match(r"^#{1,3}\s+", line):
            text = re.sub(r"^#{1,3}\s+", "", line).strip()
            if text and text.lower() != "image":
                out.append(text)
    return out[:10]


def rel_from(path_from: Path, target: Path | str) -> str:
    target_path = Path(target)
    if not target_path.is_absolute():
        target_path = ROOT / target_path
    return os.path.relpath(target_path, path_from).replace(os.sep, "/")


def _url_hash(url: str) -> str:
    """短哈希,用于区分同日同标题但不同 URL 的帖子,避免文件名冲突覆盖。"""
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:8]


def write_raw(post: Post, fetched_at: str) -> Path:
    RAW_BASE.mkdir(parents=True, exist_ok=True)
    path = RAW_BASE / f"{date_prefix(post.date)}-{slugify(post.title)}-{_url_hash(post.url)}.md"
    front = "\n".join(
        [
            "---",
            f"title: {yaml_string(post.title)}",
            f"url: {post.url}",
            f"final_url: {post.final_url}",
            "vendor: codex",
            f"author: {yaml_string(post.author)}",
            f"publish_time: {yaml_string(post.date)}",
            f"fetched_at: {yaml_string(fetched_at)}",
            "source: official-blog",
            "---",
            "",
        ]
    )
    path.write_text(front + post.body + "\n", encoding="utf-8")
    return path


def write_card(post: Post) -> Path:
    assert post.raw_path and post.destinations is not None
    CARD_BASE.mkdir(parents=True, exist_ok=True)
    slug = f"{slugify(post.title)}-{_url_hash(post.url)}"
    path = CARD_BASE / f"codex-{slug}.md"
    signal_rows = "\n".join(f"| {name} | {count} |" for name, count in hit_signals(post.body))
    outline = "\n".join(f"- {h}" for h in headings(post.body)) or "- 无明显标题结构"
    raw_rel = rel_from(path.parent, post.raw_path)
    dest_lines = "\n".join(
        f"- [{Path(dest).stem}]({rel_from(path.parent, dest)})" for dest in post.destinations
    )
    body = "\n".join(
        [
            "---",
            f"id: source-card-official-codex-{slug}",
            "type: source-card",
            "status: triaged",
            f"source: {post.raw_path.relative_to(ROOT).as_posix()}",
            "updated: 2026-05-25",
            "---",
            "",
            f"# 官方文章卡 · {post.title}",
            "",
            "## 原文信息",
            "",
            "- 来源: OpenAI 官方 Blog",
            f"- 作者: {post.author or '-'}",
            f"- 发布时间: {post.date or '-'}",
            f"- URL: {post.url}",
            f"- 原文: [raw]({raw_rel})",
            "",
            "## 关键线索",
            "",
            "| 线索 | 命中次数 |",
            "|---|---:|",
            signal_rows or "| - | 0 |",
            "",
            "## 内容提要",
            "",
            outline,
            "",
            "## 触发器判定",
            "",
            "- 触发器: OpenAI / Codex 官方产品机制、工程方法、商业化或安全材料",
            "- 当前状态: triaged, 已进入覆盖账本；其中高价值结论进入 Codex 实体页或专题页。",
            "",
            "## 已沉淀去向",
            "",
            dest_lines,
            "",
            "## 待升级 / 待复核",
            "",
            "- 后续进入 E1-E9 正文写作时, 需按章节复核本文证据。",
        ]
    )
    path.write_text(body + "\n", encoding="utf-8")
    return path


def write_index(posts: list[Post], fetched_at: str) -> None:
    rows = [
        "# Codex / OpenAI 官方文章入库索引",
        "",
        f"- 抓取时间: {fetched_at}",
        f"- 文章数: {len(posts)}",
        "",
        "| # | 标题 | 发布时间 | 文件 |",
        "|---:|---|---|---|",
    ]
    for idx, post in enumerate(posts, 1):
        assert post.raw_path
        raw_rel = post.raw_path.relative_to(RAW_BASE).as_posix()
        rows.append(f"| {idx} | [{post.title.replace('|', '\\|')}]({raw_rel}) | {post.date or '-'} | `{raw_rel}` |")
    (RAW_BASE / "INDEX.md").write_text("\n".join(rows) + "\n", encoding="utf-8")


def write_coverage(posts: list[Post], failures: list[tuple[str, str]]) -> None:
    COVERAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "---",
        "id: coverage-codex-official-posts",
        "type: ingest-coverage",
        "status: triaged",
        "updated: 2026-05-25",
        'scope: "Codex / OpenAI 官方文章入库与 wiki 沉淀"',
        "---",
        "",
        "# 入库覆盖账本 · Codex / OpenAI 官方文章",
        "",
        "## 1. 总览",
        "",
        f"- Codex / OpenAI 官方文章: **{len(POSTS)} 篇**",
        f"- 成功入库: **{len(posts)} 篇**",
        f"- 抓取失败: **{len(failures)} 篇**",
        "- 当前状态: **triaged**。本轮完成官方原文、单篇卡、覆盖表；核心结论进入 Codex 实体页, 并补强 Harness / 评测专题。",
        "",
        "## 2. 逐篇覆盖表",
        "",
        "| # | 原文 | source-card | 当前去向 | 待升级/待复核 |",
        "|---:|---|---|---|---|",
    ]
    for idx, post in enumerate(posts, 1):
        assert post.raw_path and post.card_path and post.destinations
        raw_rel = rel_from(COVERAGE_PATH.parent, post.raw_path)
        card_rel = rel_from(COVERAGE_PATH.parent, post.card_path)
        dest = ", ".join(d.replace("research/", "") for d in post.destinations)
        lines.append(
            f"| {idx} | [{post.title}]({raw_rel}) | [card]({card_rel}) | {dest} | 进入 E1-E9 写作时按章节复核 |"
        )
    if failures:
        lines += ["", "## 3. 抓取失败", "", "| URL | 原因 |", "|---|---|"]
        for url, error in failures:
            lines.append(f"| {url} | {error.replace('|', '/')} |")
    lines += [
        "",
        "## 4. 涟漪检查",
        "",
        "| 位置 | 状态 | 说明 |",
        "|---|---|---|",
        "| `research/raw/official-posts/codex/` | 已新增 | 官方原文入库 |",
        "| `research/review/source-cards/official-posts/` | 已新增 | 每篇文章一张卡 |",
        "| `research/entities/codex.md` | 待/已更新 | 承接 Codex 官方机制 |",
        "| `research/concepts/harness-engineering.md` | 待/已更新 | 补强 OpenAI 官方 Harness 叙述 |",
        "| `research/concepts/prompt-context-harness.md` | 待/已更新 | 补强 Codex 的 Prompt / Context / Harness 拆解 |",
        "| `research/topics/agent-evaluation-system.md` | 待/已更新 | 承接安全、系统卡、企业化与评估材料 |",
        "| `research/index.md` | 待/已更新 | 增加官方文章账本和 Codex 入口 |",
    ]
    COVERAGE_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    fetched_at = datetime.now(timezone.utc).isoformat()
    posts: list[Post] = []
    failures: list[tuple[str, str]] = []
    seen: set[str] = set()
    for url in POSTS:
        if url in seen:
            continue
        seen.add(url)
        try:
            print(f"fetch {url}", flush=True)
            post = fetch_post(url)
            post.destinations = destinations(post)
            post.raw_path = write_raw(post, fetched_at)
            post.card_path = write_card(post)
            posts.append(post)
        except Exception as exc:
            failures.append((url, str(exc)))
            print(f"FAIL {url}: {exc}", flush=True)
    write_index(posts, fetched_at)
    write_coverage(posts, failures)
    print(f"success={len(posts)} failure={len(failures)} coverage={COVERAGE_PATH}")


if __name__ == "__main__":
    main()
