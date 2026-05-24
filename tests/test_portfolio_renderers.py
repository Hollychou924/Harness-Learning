"""Tests for `render.portfolio_md_renderer` and `render.portfolio_pptx_renderer`.

The portfolio renderers wrap LLM-produced long-form markdown (`body_md`) with:
  - Markdown: title + jd_keyword + author + audience metadata header, plus a
    footer pointing back to the wiki source data.
  - Marp: DeepSeek-style frontmatter (theme=gaia, color #0A6E6F, paginate=true)
    that renders as a clean shareable PPT.

Both renderers must handle empty `body_md` gracefully (no template crash) so a
half-finished LLM output does not block the rest of the pipeline.
"""

from render.portfolio_md_renderer import render_portfolio_md
from render.portfolio_pptx_renderer import render_portfolio_marp


# ---------------------------------------------------------------------------
# Markdown renderer
# ---------------------------------------------------------------------------


def test_md_renderer_includes_title_jd_keyword_author() -> None:
    out = render_portfolio_md(
        body_md="# 测试报告\n\n执行摘要…\n",
        title="Harness 设计模式比较",
        jd_keyword="Harness Engineering",
        audience="DeepSeek Harness 团队",
        author="zhouhao",
    )

    assert "Harness 设计模式比较" in out
    assert "Harness Engineering" in out
    assert "DeepSeek Harness 团队" in out
    assert "zhouhao" in out
    # body_md content surfaces verbatim
    assert "执行摘要…" in out


def test_md_renderer_default_author_is_zhouhao() -> None:
    out = render_portfolio_md(
        body_md="# x\n",
        title="t",
        jd_keyword="kw",
        audience="aud",
    )
    assert "zhouhao" in out


def test_md_renderer_empty_body_does_not_crash() -> None:
    out = render_portfolio_md(
        body_md="",
        title="Empty",
        jd_keyword="kw",
        audience="aud",
    )
    # Frontmatter / title still emitted even when body is empty
    assert "Empty" in out
    assert "kw" in out


def test_md_renderer_emits_frontmatter_metadata_header() -> None:
    out = render_portfolio_md(
        body_md="# body\n",
        title="Cache 优化策略",
        jd_keyword="KV Cache / Prompt Cache",
        audience="DeepSeek 模型训练团队",
    )
    # Metadata fields appear before the body
    head = out.split("# body", 1)[0]
    assert "Cache 优化策略" in head
    assert "KV Cache / Prompt Cache" in head
    assert "DeepSeek 模型训练团队" in head


# ---------------------------------------------------------------------------
# Marp / PPTX renderer
# ---------------------------------------------------------------------------


def test_marp_renderer_emits_deepseek_style_frontmatter() -> None:
    out = render_portfolio_marp(
        body_md="# 内容\n",
        title="Harness 设计模式",
        subtitle="6 大设计取舍",
        jd_keyword="Harness Engineering",
        audience="DeepSeek Harness 团队",
    )

    # Marp frontmatter at the top
    assert out.startswith("---")
    assert "marp: true" in out
    assert "theme: gaia" in out
    assert "paginate: true" in out
    # DeepSeek 蓝绿主色
    assert "#0A6E6F" in out
    # Chinese sans-serif font fallback
    assert "PingFang SC" in out


def test_marp_renderer_includes_title_subtitle_audience() -> None:
    out = render_portfolio_marp(
        body_md="# 正文\n",
        title="开源策略对比",
        subtitle="9 家产品的开放度矩阵",
        jd_keyword="用户社群 / 开源社区",
        audience="DeepSeek 高管",
    )
    assert "开源策略对比" in out
    assert "9 家产品的开放度矩阵" in out
    assert "用户社群 / 开源社区" in out
    assert "DeepSeek 高管" in out
    # body_md surfaces verbatim
    assert "正文" in out


def test_marp_renderer_default_author_is_zhouhao() -> None:
    out = render_portfolio_marp(
        body_md="# x\n",
        title="t",
        subtitle="s",
        jd_keyword="kw",
        audience="aud",
    )
    assert "zhouhao" in out


def test_marp_renderer_empty_body_does_not_crash() -> None:
    out = render_portfolio_marp(
        body_md="",
        title="Empty",
        subtitle="-",
        jd_keyword="kw",
        audience="aud",
    )
    assert "marp: true" in out
    assert "Empty" in out
    # Slide separator still present so the deck is valid
    assert "---" in out


def test_marp_renderer_uses_slide_separators() -> None:
    """Marp uses `---` between slides; expect frontmatter open/close + body
    separation + final acknowledgments slide."""
    out = render_portfolio_marp(
        body_md="# 章节 1\n\n内容\n",
        title="t",
        subtitle="s",
        jd_keyword="kw",
        audience="aud",
    )
    # At least: frontmatter open, frontmatter close, title→body, body→致谢
    assert out.count("\n---\n") >= 3 or out.count("---") >= 4
