from datetime import datetime, timezone
from dataclasses import dataclass
from pathlib import Path

PURPOSE_TEMPLATE = """# Wiki Purpose

> 这是 wiki 的灵魂文件 — 描述目标、关键问题、研究范围、演化思路。
> 借鉴 nashsu/llm_wiki 的 purpose.md 设计。

## Goals
- TODO: 填写当前 wiki 的核心目标

## Key Questions
- TODO: 列出待回答的关键问题

## Scope
- TODO: 范围边界

## Evolving Thesis
- TODO: 当前对该领域的判断
"""

INDEX_HEADER = """# Wiki Index

> Content catalog. Each page listed with one-line summary. LLM reads this first.
> Updated automatically by `wiki ingest` and `wiki compile`.

## Products
<!-- products section auto-managed -->

## Topics
<!-- topics section auto-managed -->

## Concepts
<!-- concepts section auto-managed -->
"""

LOG_HEADER = """# Wiki Operation Log

> Append-only chronological record. Format: `## [YYYY-MM-DD HH:MM UTC] op | title`.
> Grep-friendly: `grep "^## \\[" log.md | tail -10` shows last 10 ops.

"""

@dataclass(frozen=True)
class WikiLayout:
    root: Path

    @property
    def purpose(self) -> Path: return self.root / "purpose.md"
    @property
    def index(self) -> Path: return self.root / "index.md"
    @property
    def log(self) -> Path: return self.root / "log.md"
    @property
    def raw(self) -> Path: return self.root / "raw"
    @property
    def compiled(self) -> Path: return self.root / "compiled"
    @property
    def topics(self) -> Path: return self.root / "topics"
    @property
    def concepts(self) -> Path: return self.root / "concepts"
    @property
    def schema(self) -> Path: return self.root / "schema"
    @property
    def review(self) -> Path: return self.root / "review"
    @property
    def reports(self) -> Path: return self.root / "reports"

    def append_log(self, op: str, title: str) -> None:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        line = f"## [{ts}] {op} | {title}\n"
        with self.log.open("a", encoding="utf-8") as f:
            f.write(line)

def init_wiki(root: Path) -> WikiLayout:
    layout = WikiLayout(root)
    root.mkdir(parents=True, exist_ok=True)

    if not layout.purpose.exists():
        layout.purpose.write_text(PURPOSE_TEMPLATE, encoding="utf-8")
    if not layout.index.exists():
        layout.index.write_text(INDEX_HEADER, encoding="utf-8")
    if not layout.log.exists():
        layout.log.write_text(LOG_HEADER, encoding="utf-8")

    for d in [layout.raw, layout.compiled, layout.topics, layout.concepts, layout.schema]:
        d.mkdir(exist_ok=True)
    for sub in ["pending", "approved", "rejected"]:
        (layout.review / sub).mkdir(parents=True, exist_ok=True)
    for sub in ["daily", "weekly", "on-demand"]:
        (layout.reports / sub).mkdir(parents=True, exist_ok=True)

    return layout
