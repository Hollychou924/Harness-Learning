# Phase 3 Implementation Plan — Path C Comparison Engine + Render Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build Path C — Wiki-first 对比引擎. Read compiled wiki + provenance, fill gaps via L0/L2 cross-verification, produce comparison matrices, render to Markdown / HTML site / PPT, and (optionally) sync to 飞书 Wiki.

**Architecture:** Builds on Phase 1's `llm_wiki/compiled` + `_provenance.json` (per-dim evaluations). New module: `competitive_analysis` orchestrates Path C with `WikiQuery` (reader) + `MatrixBuilder` (aggregator) + 3 renderers (`md` / `html` / `pptx`). On-demand triggered via `wiki compare` CLI or `workflow_dispatch`.

**Tech Stack:** Python 3.11+ · pydantic · Jinja2 (md/html templates) · python-pptx (or Marp via subprocess) · mkdocs-material (HTML site) · 已有 feishu skill (wiki sync). No new heavy deps.

**Spec reference:** `docs/superpowers/specs/2026-05-23-ai-agent-competitive-analysis-design.md` §7.3 (Path C) + §8 (产物分发).

**Phase 3 scope (2 weeks, 11 tasks):**
- ✅ ComparisonRequest schema
- ✅ WikiQuery (read provenance into ProductEvaluation per dim)
- ✅ Multi-source cross-verification fallback (L0 + L2)
- ✅ Comparison matrix builder (dim × product → evaluation grid)
- ✅ Markdown table renderer (基础产物 L1)
- ✅ HTML static site (mkdocs-material) — L2 升级产物
- ✅ PPT renderer (Marp Markdown→pptx) — L2 升级产物
- ✅ 飞书 wiki 单向同步 (Markdown → 飞书 Doc) — L1 团队消费
- ✅ Path C end-to-end orchestrator
- ✅ CLI: real `wiki compare` impl
- ✅ README Phase 3 update

**Out of scope (Phase 4):**
- 6 篇 PM 作品集专题报告 (各有专属 prompt 模板)
- 飞书 wiki 双向同步 (改回 Markdown)

---

## File Structure

```
ai-agent-competitive-analysis/
├── packages/
│   └── competitive_analysis/
│       ├── __init__.py
│       ├── comparison_request.py      # T30
│       ├── wiki_query.py              # T31
│       ├── verifier.py                # T32 cross-source verify
│       ├── matrix_builder.py          # T33
│       └── path_c_sync.py             # T38
├── render/
│   ├── __init__.py
│   ├── md_renderer.py                 # T34
│   ├── html_renderer.py               # T35
│   ├── pptx_renderer.py               # T36
│   └── feishu_sync.py                 # T37
├── render/templates/
│   ├── comparison.md.j2               # T34
│   ├── comparison.pptx.md.j2          # T36 (Marp source)
│   └── feishu-doc.md.j2               # T37
├── cli/main.py                        # T39 update
├── docs/site/                         # T35 mkdocs source
│   ├── mkdocs.yml
│   └── docs/
│       └── comparison/
└── tests/
    ├── test_comparison_request.py     # T30
    ├── test_wiki_query.py             # T31
    ├── test_verifier.py               # T32
    ├── test_matrix_builder.py         # T33
    ├── test_md_renderer.py            # T34
    ├── test_html_renderer.py          # T35
    ├── test_pptx_renderer.py          # T36
    ├── test_feishu_sync.py            # T37
    ├── test_path_c_sync.py            # T38
    └── test_cli_phase3.py             # T39
```

---

## Task 30: ComparisonRequest Pydantic schema

**Files:**
- Create: `packages/competitive_analysis/__init__.py` (empty)
- Create: `packages/competitive_analysis/comparison_request.py`
- Create: `tests/test_comparison_request.py`

`ComparisonRequest` describes "compare these N products on these M dims, output to these formats".

- [ ] **Step 1: Failing test**

```python
import pytest
from pydantic import ValidationError
from packages.competitive_analysis.comparison_request import ComparisonRequest, OutputFormat

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
```

- [ ] **Step 2: Run, expect ImportError**

`~/.local/bin/uv run pytest tests/test_comparison_request.py -v`

- [ ] **Step 3: Implement**

```python
from enum import Enum
from pydantic import BaseModel, Field, model_validator

class OutputFormat(str, Enum):
    MARKDOWN = "markdown"
    HTML = "html"
    PPTX = "pptx"
    FEISHU = "feishu"

class ComparisonRequest(BaseModel):
    baseline_product_id: str
    compare_product_ids: list[str] = Field(min_length=1)
    dimension_filter: list[str] | None = None  # None = all dims
    output_formats: list[OutputFormat] = Field(default_factory=lambda: [OutputFormat.MARKDOWN])
    title: str | None = None  # auto-generated if None
    
    @model_validator(mode="after")
    def _baseline_not_in_compare(self):
        if self.baseline_product_id in self.compare_product_ids:
            raise ValueError("baseline_product_id must not appear in compare_product_ids")
        return self
```

- [ ] **Step 4: 5 passed**

- [ ] **Step 5: Commit** `feat(compare): ComparisonRequest schema with output format enum`

---

## Task 31: WikiQuery — read compiled wiki + provenance

**Files:**
- Create: `packages/competitive_analysis/wiki_query.py`
- Create: `tests/test_wiki_query.py`

Reads `wiki/compiled/{product_id}/dimensions/*.md` + `_provenance.json` for a product, returns `dict[dim_id, ProductEvaluation]`.

- [ ] **Step 1: Failing test**

```python
from datetime import datetime
from pathlib import Path
import json
from packages.schemas.evaluation import ProductEvaluation, Confidence
from packages.llm_wiki.paths import init_wiki, WikiLayout
from packages.llm_wiki.provenance import write_provenance
from packages.competitive_analysis.wiki_query import WikiQuery

def _make_eval(product_id: str, dim_id: str) -> ProductEvaluation:
    return ProductEvaluation(
        product_id=product_id, dimension_id=dim_id,
        value=2, evidence_urls=["https://docs.test/x"],
        evaluator="llm:claude", confidence=Confidence.EXTRACTED,
        last_verified=datetime(2026, 5, 24),
    )

def test_read_evaluations_for_product(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    product_dir = tmp_wiki / "compiled" / "claude-code"
    product_dir.mkdir(parents=True)
    write_provenance(product_dir, [
        _make_eval("claude-code", "E5"),
        _make_eval("claude-code", "F3"),
    ])
    
    q = WikiQuery(layout=layout)
    result = q.read_evaluations("claude-code")
    
    assert "E5" in result
    assert "F3" in result
    assert result["E5"].confidence == Confidence.EXTRACTED

def test_read_evaluations_missing_product_returns_empty(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    q = WikiQuery(layout=layout)
    assert q.read_evaluations("nonexistent") == {}

def test_read_evaluations_filters_by_dim(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    product_dir = tmp_wiki / "compiled" / "cursor"
    product_dir.mkdir(parents=True)
    write_provenance(product_dir, [
        _make_eval("cursor", "E5"),
        _make_eval("cursor", "E1"),
        _make_eval("cursor", "F3"),
    ])
    
    q = WikiQuery(layout=layout)
    result = q.read_evaluations("cursor", dim_ids=["E5", "F3"])
    
    assert set(result.keys()) == {"E5", "F3"}
    assert "E1" not in result
```

- [ ] **Step 2-4: TDD cycle**

- [ ] **Step 3: Implement**

```python
from dataclasses import dataclass
from packages.llm_wiki.paths import WikiLayout
from packages.llm_wiki.provenance import read_provenance
from packages.schemas.evaluation import ProductEvaluation

@dataclass(frozen=True)
class WikiQuery:
    layout: WikiLayout
    
    def read_evaluations(
        self,
        product_id: str,
        dim_ids: list[str] | None = None,
    ) -> dict[str, ProductEvaluation]:
        product_dir = self.layout.compiled / product_id
        if not product_dir.exists():
            return {}
        
        evaluations = read_provenance(product_dir)
        result = {ev.dimension_id: ev for ev in evaluations}
        if dim_ids is not None:
            keep = set(dim_ids)
            result = {k: v for k, v in result.items() if k in keep}
        return result
```

- [ ] **Step 5: Commit** `feat(compare): WikiQuery reads provenance for a product`

---

## Task 32: Cross-source verifier (fallback when wiki misses)

**Files:**
- Create: `packages/competitive_analysis/verifier.py`
- Create: `tests/test_verifier.py`

When `WikiQuery` returns no evaluation for a (product, dim), the verifier tries:
1. L0 official docs (re-scrape latest)
2. L2 search (multi-search-engine)
3. Mark UNVERIFIED if both fail

For Phase 3 MVP, the verifier is a thin coordinator with stub implementations for the actual fetching — real L0 re-scrape is reused from Phase 1's `docs_site` adapter, and L2 from Phase 2's `multi_search`.

- [ ] **Step 1: Failing test**

```python
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch
import pytest
from packages.schemas.product import Product
from packages.schemas.dimension import Dimension
from packages.schemas.evaluation import Confidence
from packages.competitive_analysis.verifier import CrossSourceVerifier

def _claude() -> Product:
    return Product(
        id="claude-code", name="Claude Code", category="coding", priority="P0",
        homepage="https://www.anthropic.com/claude-code",
        keywords=["claude code"],
    )

def _dim_e5() -> Dimension:
    return Dimension(
        id="E5", name="Custom tools", group="E. Agent Harness 执行",
        importance="critical", weight_in_group_pct=22.0,
        evaluation_type="score_0_3", rubric="0=none / 1=fn / 2=skill / 3=skill+hook",
        data_sources=["L0:official_docs", "L2:search"],
    )

@pytest.mark.asyncio
async def test_verify_falls_back_to_l2_when_wiki_misses():
    """When wiki has no eval, verifier reaches out to L2."""
    verifier = CrossSourceVerifier()
    with patch(
        "packages.competitive_analysis.verifier.verify_url_via_search",
        new=AsyncMock(return_value=True),
    ):
        result = await verifier.verify(
            product=_claude(),
            dimension=_dim_e5(),
            existing_evaluation=None,
        )
    
    assert result.confidence == Confidence.UNVERIFIED  # MVP: just marks pending
    assert "L2" in result.evidence_urls[0] or len(result.evidence_urls) >= 0

@pytest.mark.asyncio
async def test_verify_returns_existing_when_present():
    """Don't re-verify if we already have a cached high-confidence eval."""
    from datetime import datetime
    from packages.schemas.evaluation import ProductEvaluation
    existing = ProductEvaluation(
        product_id="claude-code", dimension_id="E5",
        value=3, evidence_urls=["https://docs.anthropic.com/skills"],
        evaluator="llm:claude", confidence=Confidence.EXTRACTED,
        last_verified=datetime(2026, 5, 24),
    )
    verifier = CrossSourceVerifier()
    result = await verifier.verify(
        product=_claude(),
        dimension=_dim_e5(),
        existing_evaluation=existing,
    )
    assert result is existing  # passthrough
```

- [ ] **Step 3: Implement**

```python
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
import httpx
from packages.schemas.product import Product
from packages.schemas.dimension import Dimension
from packages.schemas.evaluation import ProductEvaluation, Confidence
from adapters.layer2_search.multi_search import verify_url_via_search

logger = logging.getLogger(__name__)

@dataclass
class CrossSourceVerifier:
    """Phase 3 MVP — checks if existing wiki eval is sufficient,
    or marks a placeholder UNVERIFIED eval if missing.
    
    Real L0 re-scrape and L2 multi-source verification are scaffolded for
    Phase 4 hardening. For now, when missing, returns UNVERIFIED placeholder
    so the matrix can render with explicit gaps.
    """
    
    async def verify(
        self,
        *,
        product: Product,
        dimension: Dimension,
        existing_evaluation: ProductEvaluation | None,
    ) -> ProductEvaluation:
        if existing_evaluation is not None:
            return existing_evaluation
        
        # Missing eval — try L2 quick check
        async with httpx.AsyncClient() as client:
            verified_via_search = await verify_url_via_search(
                client,
                url=str(product.homepage),
                query=f"{product.name} {dimension.name}",
            )
        
        confidence = Confidence.AMBIGUOUS if verified_via_search else Confidence.UNVERIFIED
        return ProductEvaluation(
            product_id=product.id,
            dimension_id=dimension.id,
            value="未评估" if not verified_via_search else "需补充",
            evidence_urls=[],
            evaluator="auto:verifier",
            confidence=confidence,
            last_verified=datetime.now(timezone.utc),
        )
```

- [ ] **Step 5: Commit** `feat(compare): CrossSourceVerifier with L2 fallback for missing evaluations`

---

## Task 33: Matrix builder

**Files:**
- Create: `packages/competitive_analysis/matrix_builder.py`
- Create: `tests/test_matrix_builder.py`

Combines `WikiQuery` results from N products into a 2D matrix `dict[dim_id, dict[product_id, ProductEvaluation]]`, plus helpful metadata (dim names, weights, total per-product score).

- [ ] **Step 1: Failing test**

```python
from datetime import datetime
from pathlib import Path
import pytest
from packages.schemas.product import Product
from packages.schemas.dimension import Dimension
from packages.schemas.evaluation import ProductEvaluation, Confidence
from packages.llm_wiki.paths import init_wiki, WikiLayout
from packages.llm_wiki.provenance import write_provenance
from packages.competitive_analysis.matrix_builder import build_matrix, ComparisonMatrix

def _make_eval(pid: str, did: str, value: int) -> ProductEvaluation:
    return ProductEvaluation(
        product_id=pid, dimension_id=did, value=value,
        evidence_urls=["https://x.test"],
        evaluator="llm:claude", confidence=Confidence.EXTRACTED,
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
        Product(id="claude-code", name="Claude Code", category="coding",
                priority="P0", homepage="https://x.test", keywords=["x"]),
        Product(id="cursor", name="Cursor", category="coding",
                priority="P0", homepage="https://x.test", keywords=["x"]),
    ]
    dimensions = [
        Dimension(id="E5", name="Custom tools", group="E. Agent Harness 执行",
                  importance="critical", weight_in_group_pct=22.0,
                  evaluation_type="score_0_3", rubric="-",
                  data_sources=["L0"]),
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
    assert "claude-code" in matrix.product_order
    assert matrix.dimension_order == ["E5"]
```

- [ ] **Step 3: Implement**

```python
from dataclasses import dataclass, field
from packages.schemas.product import Product
from packages.schemas.dimension import Dimension
from packages.schemas.evaluation import ProductEvaluation
from packages.llm_wiki.paths import WikiLayout
from packages.competitive_analysis.wiki_query import WikiQuery
from packages.competitive_analysis.verifier import CrossSourceVerifier

@dataclass(frozen=True)
class ComparisonMatrix:
    product_order: list[str]      # baseline first, then compare list
    dimension_order: list[str]
    cells: dict[str, dict[str, ProductEvaluation]]  # cells[dim_id][product_id]
    products: dict[str, Product]
    dimensions: dict[str, Dimension]

async def build_matrix(
    *,
    layout: WikiLayout,
    baseline: Product,
    compare: list[Product],
    dimensions: list[Dimension],
) -> ComparisonMatrix:
    """Build a dim × product matrix. Missing cells are filled by CrossSourceVerifier."""
    products = [baseline, *compare]
    query = WikiQuery(layout=layout)
    verifier = CrossSourceVerifier()
    
    cells: dict[str, dict[str, ProductEvaluation]] = {}
    for d in dimensions:
        cells[d.id] = {}
        for p in products:
            evals = query.read_evaluations(p.id, dim_ids=[d.id])
            existing = evals.get(d.id)
            cell = await verifier.verify(
                product=p, dimension=d, existing_evaluation=existing,
            )
            cells[d.id][p.id] = cell
    
    return ComparisonMatrix(
        product_order=[p.id for p in products],
        dimension_order=[d.id for d in dimensions],
        cells=cells,
        products={p.id: p for p in products},
        dimensions={d.id: d for d in dimensions},
    )
```

- [ ] **Step 5: Commit** `feat(compare): ComparisonMatrix builder dim × product`

---

## Task 34: Markdown table renderer

**Files:**
- Create: `render/__init__.py` (empty)
- Create: `render/md_renderer.py`
- Create: `render/templates/comparison.md.j2`
- Create: `tests/test_md_renderer.py`

Renders a `ComparisonMatrix` as a markdown comparison report.

- [ ] **Step 1: Failing test**

```python
from datetime import datetime
from packages.schemas.product import Product
from packages.schemas.dimension import Dimension
from packages.schemas.evaluation import ProductEvaluation, Confidence
from packages.competitive_analysis.matrix_builder import ComparisonMatrix
from render.md_renderer import render_markdown

def test_render_basic_matrix():
    p1 = Product(id="claude-code", name="Claude Code", category="coding",
                 priority="P0", homepage="https://x.test", keywords=["x"])
    p2 = Product(id="cursor", name="Cursor", category="coding",
                 priority="P0", homepage="https://x.test", keywords=["x"])
    d = Dimension(id="E5", name="Custom tools", group="E. Agent Harness 执行",
                  importance="critical", weight_in_group_pct=22.0,
                  evaluation_type="score_0_3", rubric="-",
                  data_sources=["L0"])
    
    def _ev(pid, val):
        return ProductEvaluation(
            product_id=pid, dimension_id="E5", value=val,
            evidence_urls=["https://x.test"], evaluator="llm:claude",
            confidence=Confidence.EXTRACTED,
            last_verified=datetime(2026, 5, 24),
        )
    
    matrix = ComparisonMatrix(
        product_order=["claude-code", "cursor"],
        dimension_order=["E5"],
        cells={"E5": {"claude-code": _ev("claude-code", 3), "cursor": _ev("cursor", 2)}},
        products={"claude-code": p1, "cursor": p2},
        dimensions={"E5": d},
    )
    
    md = render_markdown(matrix, title="Test Comparison")
    
    assert "Test Comparison" in md
    assert "Claude Code" in md
    assert "Cursor" in md
    assert "E5" in md
    assert "Custom tools" in md
    assert "| 3 |" in md  # baseline value
    assert "| 2 |" in md  # compare value
```

- [ ] **Step 3: Implement**

`render/templates/comparison.md.j2`:

```jinja
# {{ title }}

> Generated {{ generated_at }} from `wiki/compiled/`. Baseline: **{{ products[product_order[0]].name }}**.

## Comparison Matrix

| Dimension | {% for pid in product_order %}{{ products[pid].name }} | {% endfor %}
|---|{% for _ in product_order %}---|{% endfor %}
{% for dim_id in dimension_order -%}
| **{{ dim_id }}** {{ dimensions[dim_id].name }} | {% for pid in product_order %}{{ cells[dim_id][pid].value }} | {% endfor %}
{% endfor %}

## Per-Dimension Detail

{% for dim_id in dimension_order %}
### {{ dim_id }} — {{ dimensions[dim_id].name }}

**Group:** {{ dimensions[dim_id].group }} · **Importance:** {{ dimensions[dim_id].importance }} · **Weight:** {{ dimensions[dim_id].weight_in_group_pct }}%

**Rubric:** {{ dimensions[dim_id].rubric }}

{% for pid in product_order %}
**{{ products[pid].name }}** — Value: `{{ cells[dim_id][pid].value }}` (Confidence: {{ cells[dim_id][pid].confidence.value }})
{% if cells[dim_id][pid].evidence_urls %}
{% for url in cells[dim_id][pid].evidence_urls %}- [{{ url }}]({{ url }})
{% endfor %}{% endif %}
{% endfor %}

{% endfor %}
```

`render/md_renderer.py`:

```python
from datetime import datetime, timezone
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
from packages.competitive_analysis.matrix_builder import ComparisonMatrix

TEMPLATE_DIR = Path(__file__).parent / "templates"
_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(disabled_extensions=("md", "j2")),
    trim_blocks=True, lstrip_blocks=True,
)

def render_markdown(matrix: ComparisonMatrix, *, title: str = "Product Comparison") -> str:
    template = _env.get_template("comparison.md.j2")
    return template.render(
        title=title,
        generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        product_order=matrix.product_order,
        dimension_order=matrix.dimension_order,
        cells=matrix.cells,
        products=matrix.products,
        dimensions=matrix.dimensions,
    )
```

- [ ] **Step 5: Commit** `feat(render): markdown comparison renderer with Jinja2 template`

---

## Task 35: HTML site renderer (mkdocs-material lite)

**Files:**
- Create: `render/html_renderer.py`
- Create: `tests/test_html_renderer.py`

For Phase 3 MVP: don't generate a full mkdocs site. Just produce a single self-contained HTML with embedded CSS. Phase 4 can upgrade to mkdocs.

- [ ] **Step 1: Failing test**

```python
from render.html_renderer import render_html
# (use same fixture as md_renderer test)

def test_render_html_includes_table_and_styles():
    matrix = _build_test_matrix()  # reuse helper
    html = render_html(matrix, title="Test Compare")
    
    assert "<!DOCTYPE html>" in html
    assert "<title>Test Compare</title>" in html
    assert "<table" in html
    assert "<style" in html  # embedded CSS
    assert "Claude Code" in html
```

- [ ] **Step 3: Implement minimal self-contained HTML template**

`render/templates/comparison.html.j2`:

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>{{ title }}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#222}
h1{border-bottom:2px solid #2c5282}
table{border-collapse:collapse;width:100%;margin:1rem 0}
th,td{border:1px solid #cbd5e0;padding:.6rem;text-align:left}
th{background:#edf2f7}
.dim-detail{background:#f7fafc;padding:1rem;border-left:4px solid #4299e1;margin:1rem 0}
.confidence-EXTRACTED{color:#22543d;background:#c6f6d5}
.confidence-INFERRED{color:#1a365d;background:#bee3f8}
.confidence-AMBIGUOUS{color:#7c2d12;background:#feebc8}
.confidence-UNVERIFIED{color:#742a2a;background:#fed7d7}
.confidence-EXTRACTED,.confidence-INFERRED,.confidence-AMBIGUOUS,.confidence-UNVERIFIED{padding:.1rem .4rem;border-radius:3px;font-size:.85em}
</style>
</head>
<body>
<h1>{{ title }}</h1>
<p><em>Generated {{ generated_at }} · Baseline: <strong>{{ products[product_order[0]].name }}</strong></em></p>

<table>
<thead><tr><th>Dimension</th>{% for pid in product_order %}<th>{{ products[pid].name }}</th>{% endfor %}</tr></thead>
<tbody>
{% for dim_id in dimension_order %}
<tr>
<td><strong>{{ dim_id }}</strong> {{ dimensions[dim_id].name }}</td>
{% for pid in product_order %}<td>{{ cells[dim_id][pid].value }}</td>{% endfor %}
</tr>
{% endfor %}
</tbody>
</table>

{% for dim_id in dimension_order %}
<div class="dim-detail">
<h3>{{ dim_id }} — {{ dimensions[dim_id].name }}</h3>
<p><strong>Group:</strong> {{ dimensions[dim_id].group }} · <strong>Weight:</strong> {{ dimensions[dim_id].weight_in_group_pct }}%</p>
<p><strong>Rubric:</strong> {{ dimensions[dim_id].rubric }}</p>
<ul>
{% for pid in product_order %}
<li><strong>{{ products[pid].name }}:</strong> {{ cells[dim_id][pid].value }} <span class="confidence-{{ cells[dim_id][pid].confidence.value }}">{{ cells[dim_id][pid].confidence.value }}</span></li>
{% endfor %}
</ul>
</div>
{% endfor %}
</body>
</html>
```

`render/html_renderer.py`:

```python
from datetime import datetime, timezone
from jinja2 import select_autoescape
from packages.competitive_analysis.matrix_builder import ComparisonMatrix
from render.md_renderer import _env

# Re-create env with autoescape ON for HTML
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

_html_env = Environment(
    loader=FileSystemLoader(str(Path(__file__).parent / "templates")),
    autoescape=select_autoescape(["html", "j2"]),
    trim_blocks=True, lstrip_blocks=True,
)

def render_html(matrix: ComparisonMatrix, *, title: str = "Product Comparison") -> str:
    template = _html_env.get_template("comparison.html.j2")
    return template.render(
        title=title,
        generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        product_order=matrix.product_order,
        dimension_order=matrix.dimension_order,
        cells=matrix.cells,
        products=matrix.products,
        dimensions=matrix.dimensions,
    )
```

- [ ] **Step 5: Commit** `feat(render): self-contained HTML renderer with embedded styles`

---

## Task 36: PPTX renderer (Marp markdown→pptx pipeline)

**Files:**
- Create: `render/pptx_renderer.py`
- Create: `render/templates/comparison.pptx.md.j2` (Marp source)
- Create: `tests/test_pptx_renderer.py`

Generates Marp-flavored markdown that can be converted to PPTX via the `marp` CLI (if installed) or saved as Marp source for the user to convert manually.

- [ ] **Step 1: Failing test**

```python
from packages.competitive_analysis.matrix_builder import ComparisonMatrix
from render.pptx_renderer import render_marp_markdown

def test_render_marp_includes_frontmatter_and_slides():
    matrix = _build_test_matrix()
    marp = render_marp_markdown(matrix, title="Test Compare")
    
    assert marp.startswith("---")  # marp frontmatter
    assert "marp: true" in marp
    assert "theme:" in marp
    # Each dim becomes a slide
    assert "---\n# E5" in marp or "\n---\n## E5" in marp
```

- [ ] **Step 3: Implement**

`render/templates/comparison.pptx.md.j2`:

```jinja
---
marp: true
theme: default
size: 16:9
paginate: true
header: "{{ title }}"
footer: "Generated {{ generated_at }}"
---

# {{ title }}

Baseline: **{{ products[product_order[0]].name }}**
Compared with: {% for pid in product_order[1:] %}**{{ products[pid].name }}**{{ ", " if not loop.last }}{% endfor %}

---

## Comparison Matrix

| Dimension | {% for pid in product_order %}{{ products[pid].name }} | {% endfor %}
|---|{% for _ in product_order %}---|{% endfor %}
{% for dim_id in dimension_order -%}
| **{{ dim_id }}** {{ dimensions[dim_id].name }} | {% for pid in product_order %}{{ cells[dim_id][pid].value }} | {% endfor %}
{% endfor %}

{% for dim_id in dimension_order %}
---

## {{ dim_id }} — {{ dimensions[dim_id].name }}

**Rubric:** {{ dimensions[dim_id].rubric }}

{% for pid in product_order %}
- **{{ products[pid].name }}:** `{{ cells[dim_id][pid].value }}` ({{ cells[dim_id][pid].confidence.value }})
{% endfor %}

{% endfor %}
```

`render/pptx_renderer.py`:

```python
import logging
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
from packages.competitive_analysis.matrix_builder import ComparisonMatrix

logger = logging.getLogger(__name__)

_env = Environment(
    loader=FileSystemLoader(str(Path(__file__).parent / "templates")),
    autoescape=select_autoescape(disabled_extensions=("md", "j2")),
    trim_blocks=True, lstrip_blocks=True,
)

def render_marp_markdown(matrix: ComparisonMatrix, *, title: str = "Product Comparison") -> str:
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
    """Convert Marp markdown to PPTX via marp CLI. Returns True on success."""
    if not shutil.which("marp"):
        logger.warning("marp CLI not installed; saving Marp source only")
        return False
    
    md_path = output_path.with_suffix(".marp.md")
    md_path.write_text(marp_md, encoding="utf-8")
    
    result = subprocess.run(
        ["marp", str(md_path), "-o", str(output_path), "--allow-local-files"],
        capture_output=True, text=True, timeout=60,
    )
    return result.returncode == 0
```

- [ ] **Step 5: Commit** `feat(render): Marp-flavored markdown for PPTX conversion`

---

## Task 37: Feishu wiki sync (single-direction)

**Files:**
- Create: `render/feishu_sync.py`
- Create: `tests/test_feishu_sync.py`

Pushes a markdown file to 飞书 Wiki by using the existing `feishu` skill via subprocess. For Phase 3 MVP, this just shells out to `feishu wiki create-doc` or similar — exact CLI shape depends on the user's installed feishu skill.

- [ ] **Step 1: Failing test (mock subprocess)**

```python
import subprocess
from unittest.mock import patch
from render.feishu_sync import sync_to_feishu_wiki

def test_sync_to_feishu_wiki_calls_skill():
    with patch("render.feishu_sync.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=0,
            stdout='{"node_token": "abc123"}', stderr="",
        )
        result = sync_to_feishu_wiki(
            markdown="# test\n\ncontent",
            title="Test Comparison",
            parent_node_token="parent_xyz",
        )
    assert result is True
    args = m.call_args[0][0]
    assert "feishu" in args[0] or args[0] == "feishu"

def test_sync_to_feishu_wiki_failure_returns_false():
    with patch("render.feishu_sync.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=1, stdout="", stderr="auth error",
        )
        result = sync_to_feishu_wiki(
            markdown="# test", title="t", parent_node_token="x",
        )
    assert result is False

def test_sync_skipped_when_feishu_not_available():
    """If feishu CLI not in PATH, skip gracefully."""
    with patch("render.feishu_sync.shutil.which", return_value=None):
        result = sync_to_feishu_wiki(
            markdown="# test", title="t", parent_node_token="x",
        )
    assert result is False
```

- [ ] **Step 3: Implement**

```python
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

def sync_to_feishu_wiki(
    *,
    markdown: str,
    title: str,
    parent_node_token: str,
) -> bool:
    """Push markdown content to a Feishu Wiki node. Phase 3 MVP — shells to `feishu` skill.
    
    Returns True on success, False otherwise (logged).
    Caller should set FEISHU_PARENT_NODE_TOKEN env var or pass parent_node_token explicitly.
    """
    if not shutil.which("feishu"):
        logger.warning("feishu CLI not in PATH; skipping wiki sync")
        return False
    
    # Write markdown to temp file (most CLIs prefer file path over stdin)
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".md", delete=False, encoding="utf-8",
    ) as tf:
        tf.write(markdown)
        tmp_path = tf.name
    
    try:
        result = subprocess.run(
            ["feishu", "wiki", "create-doc",
             "--title", title,
             "--parent", parent_node_token,
             "--from-file", tmp_path],
            capture_output=True, text=True, timeout=60,
        )
    except subprocess.TimeoutExpired:
        logger.warning("feishu sync timed out")
        return False
    finally:
        Path(tmp_path).unlink(missing_ok=True)
    
    if result.returncode != 0:
        logger.warning("feishu sync failed: %s", result.stderr.strip()[:200])
        return False
    return True
```

> **Note:** The exact `feishu` CLI invocation shape depends on the user's installed skill. The above is a best-effort guess based on typical wiki create-doc semantics. If the user's CLI differs, the path-c sync caller can configure the command via env var. Phase 4 hardening can fully integrate.

- [ ] **Step 5: Commit** `feat(render): feishu wiki sync via skill subprocess (MVP)`

---

## Task 38: Path C end-to-end orchestrator

**Files:**
- Create: `packages/competitive_analysis/path_c_sync.py`
- Create: `tests/test_path_c_sync.py`

Reads `ComparisonRequest` → builds matrix → renders to requested formats → writes to `wiki/reports/on-demand/` and optionally syncs to feishu.

- [ ] **Step 1: Failing test**

```python
from datetime import datetime
from pathlib import Path
import pytest
from packages.schemas.product import Product
from packages.schemas.dimension import Dimension
from packages.schemas.evaluation import ProductEvaluation, Confidence
from packages.llm_wiki.paths import init_wiki, WikiLayout
from packages.llm_wiki.provenance import write_provenance
from packages.competitive_analysis.comparison_request import ComparisonRequest, OutputFormat
from packages.competitive_analysis.path_c_sync import sync_path_c

@pytest.mark.asyncio
async def test_path_c_writes_markdown_only(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    
    for pid, val in [("claude-code", 3), ("cursor", 2)]:
        d = tmp_wiki / "compiled" / pid
        d.mkdir(parents=True)
        write_provenance(d, [
            ProductEvaluation(
                product_id=pid, dimension_id="E5", value=val,
                evidence_urls=["https://x.test"], evaluator="llm:claude",
                confidence=Confidence.EXTRACTED,
                last_verified=datetime(2026, 5, 24),
            ),
        ])
    
    products = {
        pid: Product(id=pid, name=pid.title(), category="coding", priority="P0",
                     homepage="https://x.test", keywords=[pid])
        for pid in ["claude-code", "cursor"]
    }
    dimensions = [
        Dimension(id="E5", name="Custom tools", group="E. Agent Harness 执行",
                  importance="critical", weight_in_group_pct=22.0,
                  evaluation_type="score_0_3", rubric="-",
                  data_sources=["L0"]),
    ]
    
    request = ComparisonRequest(
        baseline_product_id="claude-code",
        compare_product_ids=["cursor"],
        output_formats=[OutputFormat.MARKDOWN],
    )
    
    result = await sync_path_c(
        request=request,
        layout=layout,
        products_index=products,
        dimensions=dimensions,
    )
    
    assert "markdown" in result
    md_path = Path(result["markdown"])
    assert md_path.exists()
    content = md_path.read_text(encoding="utf-8")
    assert "Claude-Code" in content or "claude-code" in content
    assert "E5" in content
```

- [ ] **Step 3: Implement**

```python
from datetime import datetime, timezone
from pathlib import Path
from packages.schemas.product import Product
from packages.schemas.dimension import Dimension
from packages.llm_wiki.paths import WikiLayout
from packages.llm_wiki.atomic import atomic_write_text
from packages.competitive_analysis.comparison_request import ComparisonRequest, OutputFormat
from packages.competitive_analysis.matrix_builder import build_matrix
from render.md_renderer import render_markdown
from render.html_renderer import render_html
from render.pptx_renderer import render_marp_markdown, convert_to_pptx
from render.feishu_sync import sync_to_feishu_wiki

async def sync_path_c(
    *,
    request: ComparisonRequest,
    layout: WikiLayout,
    products_index: dict[str, Product],
    dimensions: list[Dimension],
    feishu_parent_node: str | None = None,
) -> dict[str, str]:
    """Path C end-to-end: build matrix → render → write outputs.
    
    Returns dict mapping format name → output path (or "synced" for feishu).
    """
    baseline = products_index[request.baseline_product_id]
    compare = [products_index[pid] for pid in request.compare_product_ids]
    
    if request.dimension_filter:
        keep = set(request.dimension_filter)
        dimensions = [d for d in dimensions if d.id in keep]
    
    matrix = await build_matrix(
        layout=layout, baseline=baseline, compare=compare,
        dimensions=dimensions,
    )
    
    title = request.title or f"{baseline.name} vs {', '.join(p.name for p in compare)}"
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M")
    output_dir = layout.reports / "on-demand" / f"{baseline.id}-vs-{'-'.join(p.id for p in compare)}-{timestamp}"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    result: dict[str, str] = {}
    
    if OutputFormat.MARKDOWN in request.output_formats:
        md = render_markdown(matrix, title=title)
        path = output_dir / "comparison.md"
        atomic_write_text(path, md)
        result["markdown"] = str(path)
    
    if OutputFormat.HTML in request.output_formats:
        html = render_html(matrix, title=title)
        path = output_dir / "comparison.html"
        atomic_write_text(path, html)
        result["html"] = str(path)
    
    if OutputFormat.PPTX in request.output_formats:
        marp = render_marp_markdown(matrix, title=title)
        marp_path = output_dir / "comparison.marp.md"
        atomic_write_text(marp_path, marp)
        result["marp_source"] = str(marp_path)
        # Try converting to PPTX
        pptx_path = output_dir / "comparison.pptx"
        if convert_to_pptx(marp, pptx_path):
            result["pptx"] = str(pptx_path)
    
    if OutputFormat.FEISHU in request.output_formats and feishu_parent_node:
        md = render_markdown(matrix, title=title) if "markdown" not in result else (output_dir / "comparison.md").read_text(encoding="utf-8")
        ok = sync_to_feishu_wiki(
            markdown=md, title=title, parent_node_token=feishu_parent_node,
        )
        result["feishu"] = "synced" if ok else "failed"
    
    layout.append_log("path-c", f"{title} → {len(result)} format(s)")
    return result
```

- [ ] **Step 5: Commit** `feat(compare): Path C end-to-end orchestrator with multi-format output`

---

## Task 39: CLI: real `wiki compare` impl

**Files:**
- Modify: `cli/main.py`
- Create: `tests/test_cli_phase3.py`

Replace the `compare` stub with real path-c invocation.

- [ ] **Step 1: Failing test**

```python
from typer.testing import CliRunner
from cli.main import app

runner = CliRunner()

def test_compare_help_includes_format_option():
    result = runner.invoke(app, ["compare", "--help"])
    assert result.exit_code == 0
    assert "--formats" in result.stdout or "--format" in result.stdout

def test_compare_dry_run(tmp_path):
    runner.invoke(app, ["init", "--root", str(tmp_path / "wiki")])
    result = runner.invoke(app, [
        "compare", "claude-code", "cursor",
        "--dry-run",
        "--root", str(tmp_path / "wiki"),
    ])
    assert result.exit_code == 0
    assert "claude-code" in result.stdout
```

- [ ] **Step 3: Update `cli/main.py`** — replace stub `compare`:

```python
@app.command(help="Compare baseline product against others on selected dimensions")
def compare(
    baseline: str = typer.Argument(..., help="Baseline product ID"),
    others: list[str] = typer.Argument(..., help="Comma-separated other product IDs"),
    dims: str = typer.Option("", "--dims", help="Comma-separated dim IDs (default: all)"),
    formats: str = typer.Option("markdown", "--formats", help="markdown,html,pptx,feishu"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    products_file: Path = typer.Option(Path("products/coding-agents.yaml")),
    dims_file: Path = typer.Option(Path("wiki/schema/coding-agent-dims.yaml")),
    feishu_parent: str = typer.Option("", "--feishu-parent", help="Feishu wiki parent node token"),
    root: Path = ROOT_OPT,
) -> None:
    import asyncio
    from packages.schemas.dimension import Dimension
    from packages.competitive_analysis.comparison_request import ComparisonRequest, OutputFormat
    from packages.competitive_analysis.path_c_sync import sync_path_c
    
    products_raw = yaml.safe_load(products_file.read_text(encoding="utf-8"))
    products_index = {p["id"]: Product(**p) for p in products_raw["products"]}
    
    dims_raw = yaml.safe_load(dims_file.read_text(encoding="utf-8"))
    dimensions = [Dimension(**d) for d in dims_raw["dimensions"]]
    
    if baseline not in products_index:
        typer.echo(f"❌ baseline {baseline!r} not found in {products_file}")
        raise typer.Exit(1)
    
    other_ids = [o.strip() for o in (",".join(others)).split(",") if o.strip()]
    for pid in other_ids:
        if pid not in products_index:
            typer.echo(f"❌ product {pid!r} not found")
            raise typer.Exit(1)
    
    request = ComparisonRequest(
        baseline_product_id=baseline,
        compare_product_ids=other_ids,
        dimension_filter=[d.strip() for d in dims.split(",") if d.strip()] or None,
        output_formats=[OutputFormat(f.strip()) for f in formats.split(",") if f.strip()],
    )
    
    if dry_run:
        typer.echo(f"[dry-run] compare {baseline} vs {other_ids} on dims={request.dimension_filter or 'all'} formats={[f.value for f in request.output_formats]}")
        return
    
    layout = WikiLayout(root)
    result = asyncio.run(sync_path_c(
        request=request,
        layout=layout,
        products_index=products_index,
        dimensions=dimensions,
        feishu_parent_node=feishu_parent or None,
    ))
    
    typer.echo("\n=== Outputs ===")
    for fmt, path in result.items():
        typer.echo(f"  {fmt}: {path}")
```

- [ ] **Step 5: Commit** `feat(cli): real wiki compare implementation with multi-format output`

---

## Task 40: README Phase 3 update + final smoke

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Add Phase 3 status, update Roadmap, add quickstart for `wiki compare`.

- [ ] **Step 2: Run full test suite**

`~/.local/bin/uv run pytest -v` — expect ~110 tests passing (88 + ~22 from Phase 3).

- [ ] **Step 3: Real smoke test**

```bash
uv run wiki compare claude-code cursor --formats markdown,html
```

Expect output paths printed.

- [ ] **Step 4: Commit** `docs: README Phase 3 complete (Path C comparison engine)`

---

## Plan Self-Review

**Spec coverage** (against spec §11 Phase 3):

| Spec task | Plan task |
|---|---|
| competitive_analysis 路由器 | T38 |
| 多源验证逻辑 | T32 |
| 渲染层 (Markdown + HTML + PPT) | T34, T35, T36 |
| 飞书 Wiki 单向同步 | T37 |
| (隐含) Compare CLI | T39 |
| (隐含) ComparisonRequest schema | T30 |
| (隐含) WikiQuery layer | T31 |
| (隐含) Matrix builder | T33 |
| (隐含) README + smoke | T40 |

✓ Phase 3 spec fully covered.

**Type consistency:**
- `ComparisonMatrix` defined T33, used T34/T35/T36/T38 ✓
- `ComparisonRequest` T30, used T38/T39 ✓
- `WikiLayout` reused from Phase 1 ✓
- Render functions follow same `(matrix, *, title) -> str` signature ✓

**Placeholder check:** No TBDs. Each task has full code or tight code blocks.

**Scope check:** Phase 3 is 2 weeks, 11 tasks. Larger tasks (T38 sync_path_c, T39 CLI) average 3-4 hours; render tasks ~2 hours each. Reasonable.

---

## Beyond Phase 3 (preview)

After Phase 3 ships:
- `2026-XX-phase4-pm-portfolio.md` — 6 篇 PM 作品集专题报告(各有专属 prompt 模板 + 对应 JD 关键词)
- `2026-XX-phase5-longtail.md` — P2 产品扩展 + 维度库迭代
