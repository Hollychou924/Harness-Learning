# Phase 4 Implementation Plan — PM Portfolio Reports (6 篇 JD 对齐专题)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 产出 6 篇 PM 作品集报告，每篇对应 DeepSeek Agent Harness PM JD 的一个关键词。每篇 = (Markdown 长文 + DeepSeek 风 PPT + HTML 静态站)，用我们 Phase 1-3 攒下的 wiki/compiled 数据 + LLM 长文生成。这是你应聘时能直接交的作品。

**Architecture:** 在 Phase 3 的 path_c 渲染层之上，加一个"主题报告引擎" `portfolio_engine`：根据 ReportTheme 选择 dim 子集 + 专属 prompt + 渲染模板，调 ClaudeCliLLMClient 产出 1500-3000 字长文，再走 Marp/HTML 渲染。每篇报告 = 配置 + 数据 + 模板渲染。

**Tech Stack:** 现有 + 1 新依赖（无）。复用 ClaudeCliLLMClient（P1）、render/ 全套模板（T34-T36）、wiki_query（T31）。

**Spec reference:** `docs/superpowers/specs/2026-05-23-ai-agent-competitive-analysis-design.md` §8.2 (PM 作品集 6 篇映射) + §11 Phase 4.

**6 篇报告与 JD 关键词映射** (来自 spec §8.2):

| # | 报告 | JD 关键词 | 维度组 | 主基准 |
|---|---|---|---|---|
| 1 | 《Harness 设计模式比较》 | Harness Engineering | E (执行层 6 维) | Claude Code |
| 2 | 《项目上下文系统》 | Context Engineering | F (上下文 5 维) | Claude Code |
| 3 | 《工具与扩展生态》 | Tool Use / MCP / Subagent | E5 + N4 (生态 5 维) | Claude Code |
| 4 | 《Cache 优化策略》 | KV Cache / Prompt Cache | J5 (Cache 5 维) | Claude Code |
| 5 | 《开源策略对比》 | 用户社群 / 开源社区 | N (开源 5 维) | Hermes (open source baseline) |
| 6 | 《Eval 与训练数据回流》 | 模型与 Harness 共同进化 | M (5 维) | DeepSeek (or Claude Code) |

**Phase 4 scope (持续/不限时, 8 tasks):**
- ✅ ReportTheme + PortfolioReportRequest schema (T41)
- ✅ ThemePromptRegistry — 6 主题专属 system prompts + dim filters (T42)
- ✅ PortfolioReportEngine — 整合 wiki_query + LLM 长文生成 (T43)
- ✅ DeepSeek-style rendering — Markdown / Marp / HTML 模板调优 (T44)
- ✅ Exemplar report: 《Harness 设计模式比较》— 最 JD-aligned (T45)
- ✅ 其余 5 篇 — Context / Tools / Cache / OpenSource / Co-evolution (T46)
- ✅ CLI: `wiki portfolio` command (T47)
- ✅ README + 完整应聘材料归档 (T48)

**Out of scope:**
- 录视频 demo / 直播路演 (人工活儿)
- LinkedIn / X 发布 (Phase 5 推广)

---

## File Structure

```
ai-agent-competitive-analysis/
├── packages/competitive_analysis/
│   ├── portfolio/
│   │   ├── __init__.py
│   │   ├── theme.py              # T41 — ReportTheme enum + Request schema
│   │   ├── prompts.py            # T42 — 6 theme-specific prompts
│   │   ├── engine.py             # T43 — PortfolioReportEngine
│   │   └── exemplars/            # T45-T46 — 6 report configs
│   │       ├── harness_design.py
│   │       ├── context_engineering.py
│   │       ├── tool_ecosystem.py
│   │       ├── cache_strategy.py
│   │       ├── open_source.py
│   │       └── co_evolution.py
├── render/
│   ├── portfolio_md_renderer.py  # T44 — long-form MD with TOC
│   ├── portfolio_pptx_renderer.py # T44 — DeepSeek style Marp
│   └── templates/
│       ├── portfolio.md.j2
│       └── portfolio.pptx.md.j2  # DeepSeek 极简蓝绿风
├── wiki/reports/portfolio/       # T45-T46 output dir
│   ├── harness-design/
│   ├── context-engineering/
│   ├── tool-ecosystem/
│   ├── cache-strategy/
│   ├── open-source/
│   └── co-evolution/
├── cli/main.py                   # T47 — wiki portfolio cmd
└── tests/
    ├── test_portfolio_theme.py   # T41
    ├── test_portfolio_prompts.py # T42
    ├── test_portfolio_engine.py  # T43
    ├── test_portfolio_renderers.py # T44
    └── test_cli_phase4.py        # T47
```

---

## Task 41: ReportTheme + PortfolioReportRequest schema

**Files:**
- Create: `packages/competitive_analysis/portfolio/__init__.py` (empty)
- Create: `packages/competitive_analysis/portfolio/theme.py`
- Create: `tests/test_portfolio_theme.py`

`ReportTheme` enum (6 values), `PortfolioReportRequest` Pydantic model w/ theme + product list + output formats.

- [ ] **Step 1: Failing test**

```python
import pytest
from pydantic import ValidationError
from packages.competitive_analysis.portfolio.theme import (
    ReportTheme, PortfolioReportRequest, OutputFormat,
)

def test_six_themes_defined():
    expected = {
        "HARNESS_DESIGN", "CONTEXT_ENGINEERING", "TOOL_ECOSYSTEM",
        "CACHE_STRATEGY", "OPEN_SOURCE", "CO_EVOLUTION",
    }
    assert {t.name for t in ReportTheme} == expected

def test_theme_has_jd_keyword_attribute():
    """Each theme exposes its JD keyword for traceability."""
    assert ReportTheme.HARNESS_DESIGN.jd_keyword == "Harness Engineering"
    assert ReportTheme.CACHE_STRATEGY.jd_keyword == "KV Cache / Prompt Cache"

def test_minimal_request():
    req = PortfolioReportRequest(
        theme=ReportTheme.HARNESS_DESIGN,
        product_ids=["claude-code", "cursor", "codex"],
    )
    assert OutputFormat.MARKDOWN in req.output_formats  # default

def test_empty_products_rejected():
    with pytest.raises(ValidationError):
        PortfolioReportRequest(
            theme=ReportTheme.HARNESS_DESIGN, product_ids=[],
        )

def test_request_uses_theme_default_dims_when_unset():
    """If dimension_filter is None, theme provides default dim set."""
    req = PortfolioReportRequest(
        theme=ReportTheme.CACHE_STRATEGY,
        product_ids=["claude-code"],
    )
    # CACHE_STRATEGY's default dims include J5
    effective = req.effective_dimensions()
    assert "J5" in effective
```

- [ ] **Step 3: Implement**

```python
from enum import Enum
from pydantic import BaseModel, Field, model_validator
from packages.competitive_analysis.comparison_request import OutputFormat

class ReportTheme(Enum):
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
    theme: ReportTheme
    product_ids: list[str] = Field(min_length=1)
    dimension_filter: list[str] | None = None  # None → theme defaults
    output_formats: list[OutputFormat] = Field(
        default_factory=lambda: [OutputFormat.MARKDOWN, OutputFormat.PPTX, OutputFormat.HTML]
    )
    title: str | None = None
    
    model_config = {"arbitrary_types_allowed": True}
    
    def effective_dimensions(self) -> list[str]:
        return self.dimension_filter or self.theme.default_dims
```

- [ ] **Step 5: Commit** `feat(portfolio): ReportTheme enum (6) + PortfolioReportRequest schema`

---

## Task 42: ThemePromptRegistry — 6 专属 prompt 模板

**Files:**
- Create: `packages/competitive_analysis/portfolio/prompts.py`
- Create: `tests/test_portfolio_prompts.py`

每个 theme 有专属 system prompt — 决定报告的视角、结构、深度。

- [ ] **Step 1: Failing test**

```python
from packages.competitive_analysis.portfolio.theme import ReportTheme
from packages.competitive_analysis.portfolio.prompts import get_theme_prompt, ThemePromptSpec

def test_all_themes_have_prompts():
    for theme in ReportTheme:
        spec = get_theme_prompt(theme)
        assert isinstance(spec, ThemePromptSpec)
        assert len(spec.system_prompt) > 100  # non-trivial
        assert len(spec.report_structure) >= 3  # at least 3 sections
        assert spec.audience  # has stated audience

def test_harness_design_prompt_mentions_jd_keywords():
    spec = get_theme_prompt(ReportTheme.HARNESS_DESIGN)
    txt = spec.system_prompt.lower()
    assert "tool use" in txt or "subagent" in txt
    assert "harness" in txt

def test_cache_strategy_prompt_focuses_on_cache():
    spec = get_theme_prompt(ReportTheme.CACHE_STRATEGY)
    assert "cache" in spec.system_prompt.lower()
    assert "kv" in spec.system_prompt.lower() or "prompt cache" in spec.system_prompt.lower()
```

- [ ] **Step 3: Implement**

```python
from dataclasses import dataclass
from packages.competitive_analysis.portfolio.theme import ReportTheme

@dataclass(frozen=True)
class ThemePromptSpec:
    system_prompt: str
    report_structure: list[str]  # section names
    audience: str
    target_word_count: int

# 6 specs, each tuned to a JD keyword

HARNESS_DESIGN_PROMPT = ThemePromptSpec(
    system_prompt=(
        "你是一名 AI Agent Harness 产品经理,正在给 DeepSeek 应聘材料写"
        "《Harness 设计模式比较》。读者是 DeepSeek Harness 团队的研究员"
        "和工程师。你的任务是基于以下 wiki/compiled 数据,提炼出 4-6 种"
        "Harness 设计模式,每种模式给出代表产品 + 核心机制 + 取舍。"
        "重点关注 Tool Use 回合数、Subagent 系统、长任务持久化、Skill/Hook"
        "扩展性。语言简洁、避免营销话术、有定量证据(如 tool turns 上限)。"
    ),
    report_structure=[
        "执行摘要 (3 个核心论点)",
        "4-6 种 Harness 设计模式",
        "每模式: 代表产品 + 核心机制 + 适用场景 + 局限",
        "DeepSeek Harness 应该选择哪种模式 (基于 JD 信号)",
        "未来 12 个月的 3 个开放问题",
    ],
    audience="DeepSeek Harness 团队",
    target_word_count=2500,
)

CONTEXT_ENGINEERING_PROMPT = ThemePromptSpec(
    system_prompt=(
        "你是 AI Agent PM,写《项目上下文系统比较》。Context Engineering 是 JD 明确"
        "提名的 PM 必须有一手实践的课题。基于 wiki 数据,梳理 6 种 Context 实现路径"
        "(从 .cursor/rules 到 CLAUDE.md/AGENTS.md/Memory.md/SKILL.md 体系),"
        "对比 Memory 的'可见性、可编辑性、可分享性'三轴,以及 Compaction 策略。"
    ),
    report_structure=[
        "Context Engineering 是什么(80字定义)",
        "6 种实现路径的分类",
        "每路径: 代表产品 + 文件结构 + Memory 机制 + Compaction 策略",
        "Memory 三轴评分矩阵",
        "DeepSeek 应该如何设计 Context 系统 (3 条建议)",
    ],
    audience="DeepSeek Harness 团队 + 模型训练团队",
    target_word_count=2500,
)

TOOL_ECOSYSTEM_PROMPT = ThemePromptSpec(
    system_prompt=(
        "你是 PM,写《工具与扩展生态比较》。聚焦 MCP / Subagent / Skill / Hook 四件套"
        "的协议设计、Marketplace 数量与质量、第三方贡献者活跃度。"
        "评估每家如何处理'工具发现-安装-沙盒执行-观测'四步流程。"
    ),
    report_structure=[
        "Tool Use 协议演进时间线",
        "MCP / Subagent / Skill / Hook 四件套对比",
        "Marketplace 数量 + 健康度 (PR/月, Issue 响应)",
        "工具沙盒模型对比",
        "DeepSeek 工具生态 0→1 路径建议",
    ],
    audience="DeepSeek Harness 团队 + 开源社区运营",
    target_word_count=2500,
)

CACHE_STRATEGY_PROMPT = ThemePromptSpec(
    system_prompt=(
        "你是 PM,写《Cache 优化策略对比》。KV Cache 在 JD 中明确点名,本报告必须"
        "深入。对比每家在 Prompt Cache 命中率、Cache 失效策略、增量上下文管理"
        "上的设计选择。给出可量化指标(命中率、单次任务成本下降比)。"
    ),
    report_structure=[
        "Prompt Cache 是什么 + 为什么对 Harness 关键",
        "5 种 Cache 实现策略对比",
        "每策略: 命中率(实测/估算) + 成本下降 + 失效机制",
        "Cache 与 Subagent / Long Task 的相互作用",
        "DeepSeek Cache 设计 5 条建议",
    ],
    audience="DeepSeek Harness 团队 + 模型训练团队 + 财务/Pricing",
    target_word_count=2500,
)

OPEN_SOURCE_PROMPT = ThemePromptSpec(
    system_prompt=(
        "你是 PM,写《Agent Harness 开源策略比较》。JD 反复提'开源社区'和"
        "'用户社群'。对比 9 家产品的开源开放度(全开源 / 部分 / Skill+Hook 开放 / 闭源)"
        ",社区健康度,文档质量,贡献门槛。"
    ),
    report_structure=[
        "为什么开源策略对 Harness 是 moat",
        "5 种开源开放度模式",
        "9 家产品的开源策略矩阵",
        "社区指标对比 (stars/PR/Issue/RFC)",
        "DeepSeek 开源策略 3 个选项 + 各自代价",
    ],
    audience="DeepSeek 高管 + 社区运营 + 法务",
    target_word_count=2500,
)

CO_EVOLUTION_PROMPT = ThemePromptSpec(
    system_prompt=(
        "你是 PM,写《Eval 与训练数据回流》。这是 JD'模型与 Harness 共同进化'的"
        "具象化。对比每家如何把 Harness 跑出来的 task trace / failure log / "
        "用户接管点反哺给模型训练。这是 PM JD 的'灵魂题'。"
    ),
    report_structure=[
        "为什么模型 - Harness 共进化是新一代 Agent 的护城河",
        "5 种数据回流模式",
        "每模式: 反馈信号粒度 + 训练适用性 + 自动化程度",
        "Eval 基础设施: 内置 Eval / 灰度 / A/B 测试支持",
        "DeepSeek 共进化飞轮 0→1 设计 (PM 视角 5 条建议)",
    ],
    audience="DeepSeek Harness 团队 + 模型训练团队 + Eval 团队",
    target_word_count=2800,
)

THEME_PROMPTS: dict[ReportTheme, ThemePromptSpec] = {
    ReportTheme.HARNESS_DESIGN: HARNESS_DESIGN_PROMPT,
    ReportTheme.CONTEXT_ENGINEERING: CONTEXT_ENGINEERING_PROMPT,
    ReportTheme.TOOL_ECOSYSTEM: TOOL_ECOSYSTEM_PROMPT,
    ReportTheme.CACHE_STRATEGY: CACHE_STRATEGY_PROMPT,
    ReportTheme.OPEN_SOURCE: OPEN_SOURCE_PROMPT,
    ReportTheme.CO_EVOLUTION: CO_EVOLUTION_PROMPT,
}

def get_theme_prompt(theme: ReportTheme) -> ThemePromptSpec:
    return THEME_PROMPTS[theme]
```

- [ ] **Step 5: Commit** `feat(portfolio): 6 theme-specific prompts mapping JD keywords`

---

## Task 43: PortfolioReportEngine

**Files:**
- Create: `packages/competitive_analysis/portfolio/engine.py`
- Create: `tests/test_portfolio_engine.py`

读 wiki/compiled 数据 → build context → 调 LLM 长文生成 → 返回 markdown.

- [ ] **Step 1: Failing test**

```python
from datetime import datetime
from pathlib import Path
import pytest
from packages.schemas.evaluation import ProductEvaluation, Confidence
from packages.llm_wiki.paths import init_wiki, WikiLayout
from packages.llm_wiki.provenance import write_provenance
from packages.llm_wiki.ingest import StubLLM
from packages.competitive_analysis.portfolio.theme import ReportTheme, PortfolioReportRequest, OutputFormat
from packages.competitive_analysis.portfolio.engine import PortfolioReportEngine

@pytest.mark.asyncio
async def test_engine_generates_long_form_md(tmp_wiki: Path):
    init_wiki(tmp_wiki)
    layout = WikiLayout(tmp_wiki)
    
    # Seed minimal compiled data
    for pid in ["claude-code", "cursor"]:
        d = tmp_wiki / "compiled" / pid
        d.mkdir(parents=True)
        write_provenance(d, [
            ProductEvaluation(
                product_id=pid, dimension_id="E5", value=2,
                evidence_urls=["https://x.test"], evaluator="seed",
                confidence=Confidence.EXTRACTED,
                last_verified=datetime(2026, 5, 24),
            ),
        ])
    
    fake_md = "# 测试报告\n\n执行摘要...\n\n## 模式 1\n...\n"
    stub = StubLLM(generate_response=fake_md)
    engine = PortfolioReportEngine(layout=layout, llm=stub)
    
    req = PortfolioReportRequest(
        theme=ReportTheme.HARNESS_DESIGN,
        product_ids=["claude-code", "cursor"],
    )
    result = await engine.generate(req)
    
    assert "# 测试报告" in result
    assert len(result) > 0
```

- [ ] **Step 3: Implement**

```python
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from packages.llm_wiki.paths import WikiLayout
from packages.llm_wiki.ingest import LLMClient, IngestSource, AnalysisDraft
from packages.competitive_analysis.wiki_query import WikiQuery
from packages.competitive_analysis.portfolio.theme import PortfolioReportRequest
from packages.competitive_analysis.portfolio.prompts import get_theme_prompt

logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class PortfolioReportEngine:
    layout: WikiLayout
    llm: LLMClient
    
    async def generate(self, request: PortfolioReportRequest) -> str:
        spec = get_theme_prompt(request.theme)
        query = WikiQuery(layout=self.layout)
        
        # Gather facts from wiki/compiled for each product × selected dim
        dims = request.effective_dimensions()
        product_facts: list[str] = []
        for pid in request.product_ids:
            evals = query.read_evaluations(pid, dim_ids=dims)
            for dim_id, ev in evals.items():
                product_facts.append(
                    f"- [{pid}] {dim_id}={ev.value} "
                    f"(confidence={ev.confidence.value}, "
                    f"evidence={','.join(str(u) for u in ev.evidence_urls[:2])})"
                )
        
        if not product_facts:
            logger.warning("No wiki/compiled data for %s on dims %s",
                           request.product_ids, dims)
            return f"# {request.title or spec.audience}\n\n_暂无 wiki 数据,先跑 Path A 同步 compiled/ 再来_\n"
        
        # Compose long-form prompt
        prompt_body = (
            f"主题: {request.theme.jd_keyword}\n"
            f"目标读者: {spec.audience}\n"
            f"目标字数: {spec.target_word_count}\n\n"
            f"报告结构(必须按这个 outline 生成):\n"
            + "\n".join(f"  {i+1}. {s}" for i, s in enumerate(spec.report_structure))
            + "\n\n"
            f"产品 wiki 数据:\n"
            + "\n".join(product_facts)
            + "\n\n"
            f"系统提示:\n{spec.system_prompt}\n\n"
            f"输出: 完整的 markdown 长文,带 H1/H2/H3 层级、有具体证据 URL。"
            f"不要 markdown 围栏,直接输出。"
        )
        
        # Use llm.generate via a synthetic IngestSource
        src = IngestSource(
            url=f"portfolio:{request.theme.name}",
            content=prompt_body,
            product_id="portfolio",
        )
        # Single LLM call producing the whole long-form report
        return self.llm.generate(
            AnalysisDraft(facts=[{"role": "portfolio", "content": prompt_body}],
                          entities=[], topics=[]),
            src,
        )
```

- [ ] **Step 5: Commit** `feat(portfolio): PortfolioReportEngine generates long-form MD from wiki + theme prompt`

---

## Task 44: DeepSeek-style portfolio renderers

**Files:**
- Create: `render/portfolio_md_renderer.py` — adds TOC, footer, metadata header
- Create: `render/portfolio_pptx_renderer.py` — DeepSeek 极简风 Marp template
- Create: `render/templates/portfolio.md.j2`
- Create: `render/templates/portfolio.pptx.md.j2`
- Create: `tests/test_portfolio_renderers.py`

DeepSeek 风格视觉:
- 主色: `#0A6E6F` (DeepSeek 蓝绿)
- 极简,大量留白
- 衬线字 + 单色图表

- [ ] **Step 1-5:** 同 T34/T35/T36 的 TDD 模式. Templates 见下.

`render/templates/portfolio.pptx.md.j2`:

```jinja
---
marp: true
theme: gaia
size: 16:9
paginate: true
backgroundColor: #FAFAFA
color: #1A1A1A
style: |
  section { font-family: -apple-system, "PingFang SC", sans-serif; padding: 60px; }
  h1 { color: #0A6E6F; border-bottom: 2px solid #0A6E6F; padding-bottom: .3em; }
  h2 { color: #0A6E6F; }
  table { font-size: 0.8em; }
  th { background: #E8F4F4; }
header: "{{ title }}"
footer: "{{ author }} · {{ generated_at }}"
---

# {{ title }}

> {{ subtitle }}

**Author:** {{ author }}
**Theme:** {{ jd_keyword }}
**Audience:** {{ audience }}

---

{{ body_md }}

---

# 致谢

数据来源: 26 个 Agent 产品的 wiki/compiled (基于 Karpathy LLM Wiki 模式 +
nashsu/llm_wiki + sdyckjq-lab/llm-wiki-skill 借鉴整合)

代码与方法论开源: github.com/&lt;user&gt;/ai-agent-competitive-analysis
```

- [ ] **Step 5: Commit** `feat(render): DeepSeek-style portfolio renderers (md + pptx)`

---

## Task 45: Exemplar 报告 — 《Harness 设计模式比较》

**Files:**
- Create: `packages/competitive_analysis/portfolio/exemplars/harness_design.py` — 配置文件 (主题 + 产品列表 + 输出路径)
- Create: `tests/test_exemplar_harness.py`

- [ ] **Step 1-5:** 调用 PortfolioReportEngine + 渲染 → 写 `wiki/reports/portfolio/harness-design/`. 用真实 LLM(claude-cli) 跑一次,确认产物质量。

```python
from packages.competitive_analysis.portfolio.theme import ReportTheme, PortfolioReportRequest, OutputFormat

HARNESS_DESIGN_REQUEST = PortfolioReportRequest(
    theme=ReportTheme.HARNESS_DESIGN,
    product_ids=["claude-code", "cursor", "codex", "hermes", "manus"],
    output_formats=[OutputFormat.MARKDOWN, OutputFormat.PPTX, OutputFormat.HTML],
    title="Harness 设计模式比较",
)
```

CLI 执行: `wiki portfolio --theme harness_design`(T47 提供)

- [ ] **Step 5: Commit** `feat(portfolio): exemplar Harness Design Patterns report config + first run output`

---

## Task 46: 其余 5 篇报告 配置 + 跑通

**Files:**
- Create: 5 个 exemplar configs
- 跑 5 次 `wiki portfolio --theme <name>` 产出报告

每篇 ~5 分钟 LLM 时间. 5 篇 = 25 分钟.

- [ ] **Step 5: Commit** `feat(portfolio): 5 remaining exemplar reports (Context/Tools/Cache/OpenSource/Co-evolution)`

---

## Task 47: CLI: `wiki portfolio` 命令

**Files:**
- Modify: `cli/main.py` — 添加 `portfolio` 命令
- Create: `tests/test_cli_phase4.py`

```bash
wiki portfolio --theme harness_design
wiki portfolio --theme cache_strategy --formats markdown,pptx
wiki portfolio --all  # 跑全 6 篇
```

- [ ] **Step 5: Commit** `feat(cli): wiki portfolio command for PM portfolio reports`

---

## Task 48: README + 应聘材料归档

**Files:**
- Modify: `README.md` — Phase 4 status
- Create: `docs/job-application/` — 包含 6 篇 PPT + 1 个总览 README

```
docs/job-application/
├── README.md              # 应聘 DeepSeek 索引页
├── 01-harness-design.pptx
├── 02-context-engineering.pptx
├── 03-tool-ecosystem.pptx
├── 04-cache-strategy.pptx
├── 05-open-source.pptx
└── 06-co-evolution.pptx
```

- [ ] **Step 5: Commit** `docs: Phase 4 complete + job application portfolio archive`

---

## Plan Self-Review

**Spec coverage** (against spec §11 Phase 4):

| Spec task | Plan task |
|---|---|
| 6 篇专题报告 (按 JD 关键词) | T45, T46 |
| PPT/HTML 双版 | T44, T45, T46 (含 Marp + HTML 渲染) |
| (隐含) 主题/Prompt 框架 | T41, T42 |
| (隐含) Engine 整合 wiki + LLM | T43 |
| (隐含) CLI | T47 |
| (隐含) README + 归档 | T48 |

✓ Phase 4 spec fully covered.

---

## Beyond Phase 4

Phase 5 — P2 长尾产品扩展 + 维度库迭代 (持续)
