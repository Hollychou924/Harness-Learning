import pytest
from pydantic import ValidationError

from packages.competitive_analysis.comparison_request import (
    ComparisonRequest,
    OutputFormat,
)


def test_minimal_request():
    req = ComparisonRequest(
        baseline_product_id="claude-code",
        compare_product_ids=["cursor", "codex"],
    )
    assert req.dimension_filter is None  # default = all dims
    assert req.output_formats == [OutputFormat.MARKDOWN]  # default


def test_with_dim_filter_and_formats():
    req = ComparisonRequest(
        baseline_product_id="claude-code",
        compare_product_ids=["cursor"],
        dimension_filter=["E5", "F3"],
        output_formats=[OutputFormat.MARKDOWN, OutputFormat.HTML, OutputFormat.PPTX],
    )
    assert "E5" in req.dimension_filter
    assert OutputFormat.PPTX in req.output_formats


def test_baseline_in_compare_list_rejected():
    with pytest.raises(ValidationError):
        ComparisonRequest(
            baseline_product_id="claude-code",
            compare_product_ids=["claude-code", "cursor"],  # baseline duplicated
        )


def test_empty_compare_list_rejected():
    with pytest.raises(ValidationError):
        ComparisonRequest(
            baseline_product_id="claude-code",
            compare_product_ids=[],
        )


def test_output_format_enum_values():
    assert {f.value for f in OutputFormat} == {"markdown", "html", "pptx", "feishu"}
