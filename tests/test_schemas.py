from pipeline.core.schemas.product import Product

def test_product_minimal():
    p = Product(
        id="claude-code",
        name="Claude Code",
        category="coding",
        priority="P0",
        homepage="https://www.anthropic.com/claude-code",
        keywords=["claude code", "claude-code"],
    )
    assert p.id == "claude-code"
    assert p.is_baseline is False  # default

def test_product_baseline_flag():
    p = Product(
        id="claude-code", name="Claude Code", category="coding", priority="P0",
        homepage="https://www.anthropic.com/claude-code",
        keywords=["claude code"], is_baseline=True,
    )
    assert p.is_baseline is True

def test_product_invalid_category_rejected():
    import pytest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        Product(
            id="x", name="x", category="other", priority="P0",
            homepage="https://x.test", keywords=["x"],
        )

from pipeline.core.schemas.dimension import Dimension

def test_dimension_minimal():
    d = Dimension(
        id="E5",
        name="自定义工具/Hook 系统",
        group="Agent Harness 执行",
        importance="critical",
        weight_in_group_pct=20.0,
        evaluation_type="score_0_3",
        rubric="0=无 / 1=Function call / 2=Skill 系统 / 3=Skill+Hook+SubAgent",
        data_sources=["L0:official_docs", "L2:search"],
    )
    assert d.id == "E5"
    assert d.enum_values is None

def test_dimension_with_enum():
    d = Dimension(
        id="A1", name="产品形态", group="A",
        importance="medium", weight_in_group_pct=33.3,
        evaluation_type="enum",
        enum_values=["IDE 插件", "独立编辑器", "桌面客户端", "CLI"],
        rubric="见枚举",
        data_sources=["L0:official_docs"],
    )
    assert "CLI" in d.enum_values

def test_dimension_weight_must_be_in_range():
    import pytest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        Dimension(
            id="X", name="x", group="x",
            importance="low", weight_in_group_pct=150.0,
            evaluation_type="text", rubric="-",
            data_sources=[],
        )

from datetime import datetime
from pipeline.core.schemas.evaluation import ProductEvaluation, Confidence

def test_evaluation_extracted():
    ev = ProductEvaluation(
        product_id="claude-code",
        dimension_id="E5",
        value=3,
        evidence_urls=["https://docs.anthropic.com/en/docs/claude-code/skills#L42-L58"],
        evaluator="llm:claude-opus-4-7",
        confidence=Confidence.EXTRACTED,
        last_verified=datetime(2026, 5, 24),
    )
    assert ev.review_status is None  # default

def test_evaluation_ambiguous_goes_to_review():
    ev = ProductEvaluation(
        product_id="cursor", dimension_id="J5",
        value="unknown",
        evidence_urls=[], evaluator="llm:claude-opus-4-7",
        confidence=Confidence.AMBIGUOUS,
        last_verified=datetime.now(),
        review_status="pending",
    )
    assert ev.review_status == "pending"

def test_confidence_enum_values():
    assert Confidence.EXTRACTED.value == "EXTRACTED"
    assert Confidence.UNVERIFIED.value == "UNVERIFIED"
    assert {c.value for c in Confidence} == {
        "EXTRACTED", "INFERRED", "AMBIGUOUS", "UNVERIFIED"
    }
