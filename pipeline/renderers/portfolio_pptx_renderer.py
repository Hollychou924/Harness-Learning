"""Render a portfolio long-form report as Marp-flavored markdown for PPTX.

Layered on top of `pipeline.renderers.pptx_renderer` but tuned for the PM portfolio:
  - DeepSeek 风格视觉: 主色 `#0A6E6F` (蓝绿)，浅灰背景 `#FAFAFA`
  - 中文 sans-serif 字体优先 (PingFang SC fallback)
  - `theme: gaia` (Marp 内置极简主题)，`paginate: true` 自动页码
  - Header / Footer 自动放标题 + 作者 + 生成时间

`body_md` 来自 `PortfolioReportEngine.generate()`，原样嵌入主体幻灯片之间，由
Marp 自动按 `---` 分页。converter 复用 `pipeline.renderers.pptx_renderer.convert_to_pptx`，
因为 marp CLI 调用方式完全一致。
"""

from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATE_DIR = Path(__file__).parent / "templates"

# Marp markdown is consumed downstream by `marp` CLI — autoescape OFF for
# `.md`/`.j2` keeps URLs and pipes literal.
_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(disabled_extensions=("md", "j2")),
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_portfolio_marp(
    *,
    body_md: str,
    title: str,
    subtitle: str,
    jd_keyword: str,
    audience: str,
    author: str = "zhouhao",
) -> str:
    """Wrap an LLM-produced long-form `body_md` in DeepSeek-style Marp markdown.

    Args:
        body_md: Long-form markdown produced by `PortfolioReportEngine.generate`.
            May be empty — the deck still renders a valid title slide and 致谢.
        title: Deck title (also fills `header:` frontmatter).
        subtitle: One-line tagline beneath the title.
        jd_keyword: JD keyword the report maps to (traceability).
        audience: Stated target audience.
        author: Defaults to `zhouhao`.

    Returns:
        Marp-flavored markdown source as a string.
    """
    template = _env.get_template("portfolio.pptx.md.j2")
    return template.render(
        title=title,
        subtitle=subtitle,
        jd_keyword=jd_keyword,
        audience=audience,
        author=author,
        body_md=body_md,
        generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
