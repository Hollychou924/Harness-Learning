"""Render a `ComparisonMatrix` as a self-contained HTML report.

The output is a single `.html` file with:
  - Embedded `<style>` block (no external CSS / fonts / JS)
  - `<h1>` title + generated_at + baseline callout
  - `<h2>Comparison Matrix</h2>` table (Dimension column + N product columns)
  - `<h2>Per-Dimension Detail</h2>` blocks with rubric, weight, and per-product
    value annotated with confidence-`<LEVEL>` CSS classes for visual distinction

This renderer uses its **own** Jinja2 environment with autoescape ON so titles
and any user-influenced text cannot inject markup. The Markdown renderer
deliberately keeps autoescape OFF to preserve table pipes and URLs.

Downstream consumers: feishu wiki HTML preview, CLI (T39), Path C orchestrator (T38).
"""

from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from pipeline.core.competitive_analysis.matrix_builder import ComparisonMatrix

TEMPLATE_DIR = Path(__file__).parent / "templates"

# HTML-safe environment: autoescape ON for `.html` and `.j2` so any string
# substitution (especially `title`) is rendered as text, not markup.
_html_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "j2"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_html(
    matrix: ComparisonMatrix,
    *,
    title: str = "Product Comparison",
) -> str:
    """Render `matrix` as a self-contained HTML document.

    Args:
        matrix: ComparisonMatrix from `build_matrix(...)`.
        title: `<h1>` and `<title>` text. Falls back to a generic label.

    Returns:
        Rendered HTML source as a string. Safe to write directly to a `.html`
        file; no external assets are referenced.
    """
    template = _html_env.get_template("comparison.html.j2")
    return template.render(
        title=title,
        generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        product_order=matrix.product_order,
        dimension_order=matrix.dimension_order,
        cells=matrix.cells,
        products=matrix.products,
        dimensions=matrix.dimensions,
    )
