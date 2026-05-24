"""ComparisonRequest schema for on-demand product comparison reports."""

from enum import Enum

from pydantic import BaseModel, Field, model_validator


class OutputFormat(str, Enum):
    """Supported output formats for comparison reports."""

    MARKDOWN = "markdown"
    HTML = "html"
    PPTX = "pptx"
    FEISHU = "feishu"


class ComparisonRequest(BaseModel):
    """Describes a request to compare a baseline product against N competitors.

    `dimension_filter=None` means "all dimensions from the schema".
    `output_formats` defaults to `[markdown]`.
    `title` is auto-generated downstream when None.
    """

    baseline_product_id: str
    compare_product_ids: list[str] = Field(min_length=1)
    dimension_filter: list[str] | None = None  # None = all dims
    output_formats: list[OutputFormat] = Field(
        default_factory=lambda: [OutputFormat.MARKDOWN]
    )
    title: str | None = None  # auto-generated if None

    @model_validator(mode="after")
    def _baseline_not_in_compare(self) -> "ComparisonRequest":
        if self.baseline_product_id in self.compare_product_ids:
            raise ValueError(
                "baseline_product_id must not appear in compare_product_ids"
            )
        return self
