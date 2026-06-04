import asyncio
import logging
from datetime import date
from pathlib import Path
from typing import Any
from packages.schemas.product import Product
from packages.llm_wiki.paths import WikiLayout
from packages.llm_wiki.ingest import IngestEngine, IngestError, IngestSource, LLMClient
from packages.llm_wiki.cache import SourceCache, content_hash
from packages.llm_wiki.index_log import update_product_in_index
from adapters.layer0_official.docs_site import fetch_sitemap_and_pages
from adapters.layer0_official.github_releases import fetch_releases

logger = logging.getLogger(__name__)

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

    # 1. Docs pages — 只收集本次变更的页面,避免每次全量重 ingest
    pages_fetched = 0
    changed: list[tuple[str, bytes, Path]] = []  # (url, content_bytes, raw_path)
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
            # slug 加 URL 哈希,避免不同路径同名页面互相覆盖
            base = page.url.rstrip("/").rsplit("/", 1)[-1] or "index"
            slug = f"{base}-{content_hash(page.url.encode('utf-8'))[:8]}"
            raw_path = product_raw / f"{slug}.html"
            raw_path.write_text(page.content, encoding="utf-8")
            changed.append((page.url, content_bytes, raw_path))
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

    # 3. Two-step CoT ingest — 仅处理本次变更页面;单页失败跳过且不写缓存(下次重试)
    engine = IngestEngine(llm=llm, wiki_root=layout.root)
    dimensions_compiled = 0
    for url, content_bytes, raw_file in changed:
        src = IngestSource(
            url=f"file://{raw_file}",
            content=raw_file.read_text(encoding="utf-8"),
            product_id=product.id,
        )
        try:
            written = engine.ingest(src)
        except IngestError as exc:
            logger.warning("ingest 失败,跳过(下次重试) %s: %s", url, exc)
            continue
        dimensions_compiled += len(written)
        cache.put(url, content_bytes)  # 仅 ingest 成功后写缓存

    cache.flush()  # 批量结束统一持久化一次

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
