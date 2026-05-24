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
    runs IngestEngine.analyze, then a single LLM generate() call producing the
    full daily summary markdown. Writes via atomic_write_text.

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
    # Single LLM generate() call producing the full daily summary (not per-dimension)
    md = engine.llm.generate(draft, src)

    target = layout.root / "changelog" / product_id / f"{report_date.isoformat()}.md"
    atomic_write_text(target, md)
