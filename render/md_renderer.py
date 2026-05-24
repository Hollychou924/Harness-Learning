"""Render a `ComparisonMatrix` as a Markdown report.

The output is a self-contained `.md` file with:
  - H1 title + generated_at timestamp + baseline callout
  - `## Comparison Matrix` table (Dimension column + N product columns)
  - `## Per-Dimension Detail` with rubric, importance/weight, and per-product
    value / confidence / evidence links

Downstream consumers: feishu wiki sync (T37), CLI (T39), Path C orchestrator (T38).
"""

from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from packages.competitive_analysis.matrix_builder import ComparisonMatrix

TEMPLATE_DIR = Path(__file__).parent / "templates"

# Markdown-safe environment: autoescape OFF for `.md`/`.j2` so URLs and pipes
# render as literal characters. Trim/lstrip blocks keep the output tidy.
_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(disabled_extensions=("md", "j2")),
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_markdown(
    matrix: ComparisonMatrix,
    *,
    title: str = "Product Comparison",
) -> str:
    """Render `matrix` as Markdown.

    Args:
        matrix: ComparisonMatrix from `build_matrix(...)`.
        title: H1 title. Falls back to a generic label when omitted.

    Returns:
        Rendered Markdown source as a string.
    """
    template = _env.get_template("comparison.md.j2")
    return template.render(
        title=title,
        generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        product_order=matrix.product_order,
        dimension_order=matrix.dimension_order,
        cells=matrix.cells,
        products=matrix.products,
        dimensions=matrix.dimensions,
    )
