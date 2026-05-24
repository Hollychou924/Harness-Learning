import asyncio
from datetime import date
from pathlib import Path
from typing import Any
from packages.schemas.product import Product
from packages.llm_wiki.paths import WikiLayout
from packages.llm_wiki.ingest import IngestEngine, IngestSource, LLMClient
from packages.llm_wiki.cache import SourceCache
from packages.llm_wiki.index_log import update_product_in_index
from adapters.layer0_official.docs_site import fetch_sitemap_and_pages
from adapters.layer0_official.github_releases import fetch_releases

def sync_product_path_a(
    product: Product, *, layout: WikiLayout, llm: LLMClient,
) -> dict[str, Any]:
    """Path A — full sync for one product.

    1. fetch sitemap + pages from docs_root → wiki/raw/{product}/{date}/
    2. fetch GitHub Releases (if github_repo set)
    3. ingest via two-step CoT into wiki/compiled/{product}/dimensions/
    4. update index.md (product entry)
    5. append log.md
    """
    today = date.today().isoformat()
    product_raw = layout.raw / product.id / today
    product_raw.mkdir(parents=True, exist_ok=True)
    cache = SourceCache(layout.raw / product.id / "_cache.json")

    # 1. Docs pages
    pages_fetched = 0
    if product.docs_root:
        sitemap_url = str(product.docs_root).rstrip("/") + "/sitemap.xml"
        prefix = str(product.docs_root).rstrip("/") + "/"
        pages = asyncio.run(fetch_sitemap_and_pages(
            sitemap_url, keep_prefix=prefix, max_pages=20,
        ))
        for page in pages:
            content_bytes = page.content.encode("utf-8")
            if cache.unchanged(page.url, content_bytes):
                continue
            slug = page.url.rstrip("/").rsplit("/", 1)[-1] or "index"
            (product_raw / f"{slug}.html").write_text(page.content, encoding="utf-8")
            cache.put(page.url, content_bytes)
            pages_fetched += 1

    # 2. GitHub Releases
    releases_fetched = 0
    if product.github_repo:
        releases = fetch_releases(product.github_repo, limit=10)
        rel_dir = product_raw / "releases"
        rel_dir.mkdir(exist_ok=True)
        for r in releases:
            (rel_dir / f"{r.tag}.md").write_text(
                f"# {r.name}\n\n{r.body}\n\n[source]({r.url})\n",
                encoding="utf-8",
            )
            releases_fetched += 1

    # 3. Two-step CoT ingest — concatenate raw text and ingest as one source per page
    engine = IngestEngine(llm=llm, wiki_root=layout.root)
    dimensions_compiled = 0
    for raw_file in product_raw.rglob("*.html"):
        src = IngestSource(
            url=f"file://{raw_file}",
            content=raw_file.read_text(encoding="utf-8"),
            product_id=product.id,
        )
        written = engine.ingest(src)
        dimensions_compiled += len(written)

    # 4. Update index.md
    update_product_in_index(
        layout, product_id=product.id,
        summary=f"{product.name} — {product.priority} {'(基准)' if product.is_baseline else ''}".strip(),
    )

    # 5. Append log.md
    layout.append_log("sync", f"{product.id}: {pages_fetched} pages + {releases_fetched} releases → {dimensions_compiled} dim cards")

    return {
        "product_id": product.id,
        "pages_fetched": pages_fetched,
        "releases_fetched": releases_fetched,
        "dimensions_compiled": dimensions_compiled,
    }
