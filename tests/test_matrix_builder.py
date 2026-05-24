from datetime import datetime
from pathlib import Path

import pytest

from packages.competitive_analysis.matrix_builder import (
    ComparisonMatrix,
    build_matrix,
)
from packages.llm_wiki.paths import WikiLayout, init_wiki
from packages.llm_wiki.provenance import write_provenance
from packages.schemas.dimension import Dimension
from packages.schemas.evaluation import Confidence, ProductEvaluation
from packages.schemas.product import Product


def _make_eval(pid: str, did: str, value: int) -> ProductEvaluation:
    return ProductEvaluation(
        product_id=pid,
        dimension_id=did,
        value=value,
        evidence_urls=["https://x.test"],
        evaluator="llm:claude",
        confidence=Confidence.EXTRACTED,
        last_verified=datetime(2026, 5, 24),
    )


@pytest.mark.asyncio
async def test_build_matrix_basic(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)

    for pid, dim_value in [("claude-code", 3), ("cursor", 2)]:
        d = tmp_wiki / "compiled" / pid
        d.mkdir(parents=True)
        write_provenance(d, [_make_eval(pid, "E5", dim_value)])

    products = [
        Product(
            id="claude-code",
            name="Claude Code",
            category="coding",
            priority="P0",
            homepage="https://x.test",
            keywords=["x"],
        ),
        Product(
            id="cursor",
            name="Cursor",
            category="coding",
            priority="P0",
            homepage="https://x.test",
            keywords=["x"],
        ),
    ]
    dimensions = [
        Dimension(
            id="E5",
            name="Custom tools",
            group="E. Agent Harness 执行",
            importance="critical",
            weight_in_group_pct=22.0,
            evaluation_type="score_0_3",
            rubric="-",
            data_sources=["L0"],
        ),
    ]

    matrix = await build_matrix(
        layout=layout,
        baseline=products[0],
        compare=[products[1]],
        dimensions=dimensions,
    )

    assert isinstance(matrix, ComparisonMatrix)
    assert matrix.cells["E5"]["claude-code"].value == 3
    assert matrix.cells["E5"]["cursor"].value == 2
    # Baseline first
    assert matrix.product_order == ["claude-code", "cursor"]
    assert matrix.dimension_order == ["E5"]
    assert matrix.products["claude-code"].name == "Claude Code"
    assert matrix.dimensions["E5"].name == "Custom tools"
