"""Render a `ComparisonMatrix` as Marp-flavored markdown for PPTX conversion.

Marp (https://marp.app/) reads markdown with a YAML frontmatter directive
(`marp: true`) plus `---` slide separators and produces a slide deck. We emit
the markdown source from a Jinja2 template; converting it to a real `.pptx`
requires the `marp` CLI (`npm install -g @marp-team/marp-cli`). When the CLI is
not installed, `convert_to_pptx` returns False and the caller can simply ship
the Marp source for manual conversion.

Slide layout:
  1. Title slide (H1 + baseline / compared-with callout)
  2. Comparison matrix slide (Dimension column + N product columns)
  3. One slide per dimension (rubric + per-product value/confidence)

Downstream consumers: Path C orchestrator (T38), CLI (T39).
"""

import logging
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from pipeline.core.competitive_analysis.matrix_builder import ComparisonMatrix

logger = logging.getLogger(__name__)

TEMPLATE_DIR = Path(__file__).parent / "templates"

# Marp markdown is consumed by another tool, so leave URLs and pipes literal —
# autoescape OFF for `.md`/`.j2` matches the Markdown / HTML renderers.
_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(disabled_extensions=("md", "j2")),
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_marp_markdown(
    matrix: ComparisonMatrix,
    *,
    title: str = "Product Comparison",
) -> str:
    """Render `matrix` as Marp-flavored markdown.

    Args:
        matrix: ComparisonMatrix from `build_matrix(...)`.
        title: Deck title (also fills `header:` frontmatter).

    Returns:
        Marp markdown source as a string.
    """
    template = _env.get_template("comparison.pptx.md.j2")
    return template.render(
        title=title,
        generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        product_order=matrix.product_order,
        dimension_order=matrix.dimension_order,
        cells=matrix.cells,
        products=matrix.products,
        dimensions=matrix.dimensions,
    )


def convert_to_pptx(marp_md: str, output_path: Path) -> bool:
    """Convert Marp markdown to PPTX via the `marp` CLI.

    Args:
        marp_md: Marp-flavored markdown source.
        output_path: Destination `.pptx` file path.

    Returns:
        True on successful conversion, False when `marp` CLI is unavailable
        or returns a non-zero exit code. The caller can fall back to shipping
        the Marp source as-is.
    """
    if not shutil.which("marp"):
        logger.warning("marp CLI not installed; saving Marp source only")
        return False

    output_path.parent.mkdir(parents=True, exist_ok=True)
    md_path = output_path.with_suffix(".marp.md")
    md_path.write_text(marp_md, encoding="utf-8")

    try:
        result = subprocess.run(
            ["marp", str(md_path), "-o", str(output_path), "--allow-local-files"],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        logger.warning("marp CLI invocation failed: %s", exc)
        return False

    if result.returncode != 0:
        logger.warning("marp CLI exited %s: %s", result.returncode, result.stderr.strip())
        return False
    return True
