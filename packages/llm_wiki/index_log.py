import re
from packages.llm_wiki.paths import WikiLayout

PRODUCT_MARKER = "<!-- products section auto-managed -->"


def update_product_in_index(layout: WikiLayout, *, product_id: str, summary: str) -> None:
    """Idempotent upsert of `- [product_id](compiled/{id}/overview.md) — summary` line.
    Operates on the products section, identified by the marker comment in INDEX_HEADER."""
    content = layout.index.read_text(encoding="utf-8")
    line = f"- [{product_id}](compiled/{product_id}/overview.md) — {summary}"

    # Remove any existing line for this product
    pat = re.compile(rf"^- \[{re.escape(product_id)}\].*$", flags=re.MULTILINE)
    content = pat.sub("", content)

    # Insert after the marker
    if PRODUCT_MARKER in content:
        content = content.replace(PRODUCT_MARKER, f"{PRODUCT_MARKER}\n{line}", 1)
    else:
        content += f"\n{line}\n"

    # Collapse double-blank lines from removal
    content = re.sub(r"\n{3,}", "\n\n", content)
    layout.index.write_text(content, encoding="utf-8")
