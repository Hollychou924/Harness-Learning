"""PortfolioReportEngine — wires wiki/compiled data into a long-form LLM call.

The engine reads compiled provenance for each requested product (filtered by
the theme's effective dimensions), composes a long-form prompt body using the
matching ``ThemePromptSpec``, then asks the LLM to produce the full markdown
report in a single call. If no wiki/compiled data is found for the requested
products + dimensions, the engine returns a placeholder stub so callers can
still fall through to the renderers without crashing.

Design notes:
- Frozen dataclass — engines are immutable per request; callers compose new
  engines if they need to swap layout or LLM.
- ``generate`` is async by contract for future LLM clients that expose async
  APIs even though the current ``LLMClient`` protocol is sync. This keeps the
  call site stable when we move from ``StubLLM`` to ``ClaudeCliLLMClient``.
- Single LLM call per report — we do NOT shell out to per-dimension cards
  here. The portfolio report is a long-form essay, not a dimension matrix.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from packages.competitive_analysis.portfolio.prompts import get_theme_prompt
from packages.competitive_analysis.portfolio.theme import PortfolioReportRequest
from packages.competitive_analysis.wiki_query import WikiQuery
from packages.llm_wiki.ingest import LLMClient
from packages.llm_wiki.paths import WikiLayout

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PortfolioReportEngine:
    """Produces long-form portfolio markdown from wiki facts + theme prompt."""

    layout: WikiLayout
    llm: LLMClient

    async def generate(self, request: PortfolioReportRequest) -> str:
        """Render a single long-form markdown report for ``request``.

        Returns a placeholder markdown stub if no compiled wiki data matches
        the requested products × effective dimensions — this lets the renderer
        layer continue to operate even before Path A has populated data.
        """
        spec = get_theme_prompt(request.theme)
        query = WikiQuery(layout=self.layout)

        dims = request.effective_dimensions()
        product_facts: list[str] = []
        for pid in request.product_ids:
            evals = query.read_evaluations(pid, dim_ids=dims)
            for dim_id, ev in evals.items():
                evidence = ",".join(str(u) for u in ev.evidence_urls[:2])
                product_facts.append(
                    f"- [{pid}] {dim_id}={ev.value} "
                    f"(confidence={ev.confidence.value}, "
                    f"evidence={evidence})"
                )

        if not product_facts:
            logger.warning(
                "No wiki/compiled data for %s on dims %s",
                request.product_ids,
                dims,
            )
            heading = request.title or spec.audience
            return (
                f"# {heading}\n\n"
                "_暂无 wiki 数据,先跑 Path A 同步 compiled/ 再来_\n"
            )

        outline = "\n".join(
            f"  {i + 1}. {section}"
            for i, section in enumerate(spec.report_structure)
        )
        prompt_body = (
            f"主题: {request.theme.jd_keyword}\n"
            f"目标读者: {spec.audience}\n"
            f"目标字数: {spec.target_word_count}\n\n"
            "报告结构(必须按这个 outline 生成):\n"
            f"{outline}\n\n"
            "产品 wiki 数据:\n"
            f"{chr(10).join(product_facts)}\n\n"
            f"系统提示:\n{spec.system_prompt}\n\n"
            "输出: 完整的 markdown 长文,带 H1/H2/H3 层级、有具体证据 URL。"
            "不要 markdown 围栏,直接输出。"
        )

        return self.llm.complete(prompt_body)
