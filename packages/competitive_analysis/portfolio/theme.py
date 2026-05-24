"""ReportTheme enum + PortfolioReportRequest schema for portfolio reports.

Six JD-aligned themes drive prompt/dimension selection for the portfolio
engine. Each theme carries a JD keyword (for traceability back to the
DeepSeek PM JD) and a default dimension subset (used when the request does
not override `dimension_filter`).
"""

from enum import Enum

from pydantic import BaseModel, Field

from packages.competitive_analysis.comparison_request import OutputFormat


class ReportTheme(Enum):
    """Six portfolio report themes.

    Each value is a tuple of ``(jd_keyword, default_dims)`` and is unpacked
    by ``__init__`` so callers can use ``theme.jd_keyword`` and
    ``theme.default_dims`` directly.
    """

    HARNESS_DESIGN = ("Harness Engineering", ["E1", "E4", "E5", "E6"])
    CONTEXT_ENGINEERING = ("Context Engineering", ["F1", "F3"])
    TOOL_ECOSYSTEM = ("Tool Use / MCP / Subagent", ["E4", "E5"])
    CACHE_STRATEGY = ("KV Cache / Prompt Cache", ["J5"])
    OPEN_SOURCE = ("用户社群 / 开源社区", ["N1", "N2", "N3", "N4", "N5"])
    CO_EVOLUTION = ("模型与 Harness 共同进化", ["M1", "M2", "M3", "M4", "M5"])

    def __init__(self, jd_keyword: str, default_dims: list[str]) -> None:
        self.jd_keyword = jd_keyword
        self.default_dims = default_dims


class PortfolioReportRequest(BaseModel):
    """Request describing which theme to render across which products.

    ``dimension_filter=None`` falls back to the theme's default dimensions.
    ``output_formats`` defaults to Markdown + PPTX + HTML.
    ``title`` is auto-generated downstream when ``None``.
    """

    theme: ReportTheme
    product_ids: list[str] = Field(min_length=1)
    dimension_filter: list[str] | None = None  # None → theme defaults
    output_formats: list[OutputFormat] = Field(
        default_factory=lambda: [
            OutputFormat.MARKDOWN,
            OutputFormat.PPTX,
            OutputFormat.HTML,
        ]
    )
    title: str | None = None

    model_config = {"arbitrary_types_allowed": True}

    def effective_dimensions(self) -> list[str]:
        """Return ``dimension_filter`` if set, else the theme's default dims."""
        return self.dimension_filter or self.theme.default_dims
