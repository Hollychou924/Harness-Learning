from datetime import date

from packages.ai_agent_research.changelog_entry import ChangelogEntry
from packages.llm_wiki.atomic import atomic_write_text
from packages.llm_wiki.ingest import IngestEngine, IngestSource, LLMClient
from packages.llm_wiki.paths import WikiLayout


def write_changelog_report(
    *,
    layout: WikiLayout,
    product_id: str,
    report_date: date,
    entries: list[ChangelogEntry],
    llm: LLMClient,
) -> None:
    """Generate a per-product daily changelog report at wiki/changelog/{product_id}/{date}.md.

    Bundles all entries into one IngestSource (concat title+summary+source_url),
    runs IngestEngine.analyze, then engine.generate which groups facts by dim_id
    and renders one card per dimension. The daily markdown is composed as a
    header + per-dim sections; entries that don't hit any schema dim still get
    surfaced in the raw signals section.

    Empty entries → no-op (returns early).
    """
    if not entries:
        return

    # Concat entries into one source body
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
    # Per-dim render: engine.generate groups draft.facts by dimension_id and
    # calls llm.generate once per dim, returning {dim_id: markdown}.
    cards = engine.generate(draft, src)

    sections = [f"# {product_id} 每日变更 · {report_date.isoformat()}\n"]
    sections.append(f"**信号数:** {len(entries)} · **维度命中:** {len(cards)}\n")

    if not cards:
        sections.append(
            "\n_本日没有命中我们 schema 中任一维度。原始信号见 `entries` 段。_\n"
        )
        sections.append("\n## 原始信号\n\n" + body)
    else:
        for dim_id in sorted(cards.keys()):
            sections.append(f"\n---\n\n{cards[dim_id]}\n")

    md = "\n".join(sections)

    target = layout.root / "changelog" / product_id / f"{report_date.isoformat()}.md"
    atomic_write_text(target, md)
