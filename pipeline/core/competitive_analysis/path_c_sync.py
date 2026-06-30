"""Path C end-to-end orchestrator — wires together the comparison pipeline.

Flow:
    1. Resolve baseline/compare Products from `products_index`.
    2. Apply optional `dimension_filter` to the dimensions input.
    3. Build a `ComparisonMatrix` via `build_matrix(...)` (WikiQuery + verifier).
    4. Render to each requested `OutputFormat` and atomically write to
       `research/reports/on-demand/{baseline}-vs-{compare}-{timestamp}/`.
    5. Optionally sync the markdown to a Feishu Wiki node when both
       `OutputFormat.FEISHU` is requested AND `feishu_parent_node` is provided.
    6. Append a `path-c` entry to `log.md`.

Returns a dict mapping result key → output path string (or `"synced"`/`"failed"`
for the feishu key). The dict only contains keys for outputs actually produced.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from pipeline.core.competitive_analysis.comparison_request import (
    ComparisonRequest,
    OutputFormat,
)
from pipeline.core.competitive_analysis.matrix_builder import build_matrix
from pipeline.core.llm_wiki.atomic import atomic_write_text
from pipeline.core.llm_wiki.paths import WikiLayout
from pipeline.core.schemas.dimension import Dimension
from pipeline.core.schemas.product import Product
from pipeline.renderers.feishu_sync import sync_to_feishu_wiki
from pipeline.renderers.html_renderer import render_html
from pipeline.renderers.md_renderer import render_markdown
from pipeline.renderers.pptx_renderer import convert_to_pptx, render_marp_markdown

logger = logging.getLogger(__name__)


def _output_dir_name(baseline_id: str, compare_ids: list[str], timestamp: str) -> str:
    """Build the on-demand output directory name.

    Format: ``{baseline}-vs-{compare1}-{compare2}-...-{timestamp}``.
    """
    return f"{baseline_id}-vs-{'-'.join(compare_ids)}-{timestamp}"


async def sync_path_c(
    *,
    request: ComparisonRequest,
    layout: WikiLayout,
    products_index: dict[str, Product],
    dimensions: list[Dimension],
    feishu_parent_node: str | None = None,
) -> dict[str, str]:
    """Run the full Path C pipeline for one ComparisonRequest.

    Args:
        request: The user's comparison request (validated `ComparisonRequest`).
        layout: WikiLayout pointing at the wiki root (for reads + writes).
        products_index: All known products keyed by id; baseline + compares are
            looked up here. KeyError surfaces if any id is missing.
        dimensions: The full dimension set; if `request.dimension_filter` is
            non-empty, only matching dims are kept (input order preserved).
        feishu_parent_node: Optional Feishu wiki parent node token. Required
            for `OutputFormat.FEISHU` to be honored — if missing while feishu
            is requested, sync is silently skipped.

    Returns:
        Dict mapping output key → string. Possible keys:
            - "markdown": absolute path to the rendered .md file.
            - "html": absolute path to the rendered .html file.
            - "marp_source": absolute path to the .marp.md source file.
            - "pptx": absolute path to the converted .pptx (only if marp CLI succeeded).
            - "feishu": "synced" or "failed".
    """
    baseline = products_index[request.baseline_product_id]
    compare = [products_index[pid] for pid in request.compare_product_ids]

    if request.dimension_filter:
        keep = set(request.dimension_filter)
        dimensions = [d for d in dimensions if d.id in keep]

    matrix = await build_matrix(
        layout=layout,
        baseline=baseline,
        compare=compare,
        dimensions=dimensions,
    )

    title = request.title or (
        f"{baseline.name} vs {', '.join(p.name for p in compare)}"
    )
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M")
    output_dir = layout.reports / "on-demand" / _output_dir_name(
        baseline.id, [p.id for p in compare], timestamp,
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    result: dict[str, str] = {}
    # Cache the markdown render so feishu sync can reuse it without
    # re-running the template engine.
    cached_markdown: str | None = None

    if OutputFormat.MARKDOWN in request.output_formats:
        cached_markdown = render_markdown(matrix, title=title)
        md_path = output_dir / "comparison.md"
        atomic_write_text(md_path, cached_markdown)
        result["markdown"] = str(md_path)

    if OutputFormat.HTML in request.output_formats:
        html = render_html(matrix, title=title)
        html_path = output_dir / "comparison.html"
        atomic_write_text(html_path, html)
        result["html"] = str(html_path)

    if OutputFormat.PPTX in request.output_formats:
        marp = render_marp_markdown(matrix, title=title)
        marp_path = output_dir / "comparison.marp.md"
        atomic_write_text(marp_path, marp)
        result["marp_source"] = str(marp_path)

        pptx_path = output_dir / "comparison.pptx"
        if convert_to_pptx(marp, pptx_path):
            result["pptx"] = str(pptx_path)

    if OutputFormat.FEISHU in request.output_formats:
        if feishu_parent_node:
            if cached_markdown is None:
                cached_markdown = render_markdown(matrix, title=title)
            ok = sync_to_feishu_wiki(
                markdown=cached_markdown,
                title=title,
                parent_node_token=feishu_parent_node,
            )
            result["feishu"] = "synced" if ok else "failed"
        else:
            logger.warning(
                "OutputFormat.FEISHU requested but feishu_parent_node not "
                "provided; skipping feishu sync"
            )

    layout.append_log("path-c", f"{title} -> {len(result)} format(s)")
    return result
