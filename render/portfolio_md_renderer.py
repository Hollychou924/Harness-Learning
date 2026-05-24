"""Render a portfolio long-form report as Markdown.

The portfolio report engine (`PortfolioReportEngine.generate`) returns the
LLM-produced long-form body as a markdown string. This renderer wraps that
body with:
  - H1 title
  - JD-keyword / audience / author metadata callout
  - Generated-at timestamp
  - Acknowledgements footer pointing back to the wiki source

DeepSeek 视觉风格(蓝绿/极简/留白)在 PPT 模板里体现，markdown 这里只保证
metadata 完整 + body 原样传递，方便 feishu wiki / GitHub README 直接消费。
"""

from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATE_DIR = Path(__file__).parent / "templates"

# Markdown-safe environment: autoescape OFF for `.md`/`.j2` so URLs and pipes
# render as literal characters. Mirrors `render.md_renderer`.
_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(disabled_extensions=("md", "j2")),
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_portfolio_md(
    *,
    body_md: str,
    title: str,
    jd_keyword: str,
    audience: str,
    author: str = "zhouhao",
) -> str:
    """Wrap an LLM-produced long-form `body_md` with portfolio metadata.

    Args:
        body_md: Long-form markdown produced by `PortfolioReportEngine.generate`.
            May be empty when the engine has no wiki data — the wrapper still
            emits a valid header so the file is shareable.
        title: H1 title for the report.
        jd_keyword: JD keyword the report maps to (traceability).
        audience: Stated target audience.
        author: Defaults to `zhouhao`.

    Returns:
        Rendered Markdown source as a string.
    """
    template = _env.get_template("portfolio.md.j2")
    return template.render(
        title=title,
        jd_keyword=jd_keyword,
        audience=audience,
        author=author,
        body_md=body_md,
        generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
