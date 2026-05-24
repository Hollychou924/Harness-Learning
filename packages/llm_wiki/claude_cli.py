"""ClaudeCliLLMClient — LLMClient implementation using `claude -p` subprocess.

Calls `claude` CLI in headless (one-shot) mode. No API key required if `claude`
CLI is already authenticated locally. Falls back to RuntimeError on failure
(caller decides whether to retry, route to review queue, or skip).
"""
import logging
import subprocess

from packages.llm_wiki.ingest import AnalysisDraft, IngestSource
from packages.schemas.dimension import Dimension

logger = logging.getLogger(__name__)

ANALYZE_PROMPT_TEMPLATE = """You are extracting structured facts about the AI agent product '{product_id}' from a source document.

You may ONLY use these dimension IDs (do NOT invent new ones):

{dim_table}

If a fact does not clearly fit ONE of these dimensions, OMIT it from the output.

Return ONLY valid JSON (no markdown fences, no prose) with this exact shape:
{{
  "facts": [
    {{"claim": "...", "evidence_url": "...", "confidence": "EXTRACTED|INFERRED|AMBIGUOUS|UNVERIFIED", "dimension_id": "E1"}}
  ],
  "entities": ["..."],
  "topics": ["..."]
}}

Confidence guide:
- EXTRACTED: directly stated in source
- INFERRED: derived from stated facts via reasoning
- AMBIGUOUS: source is unclear or contradicts other sources
- UNVERIFIED: speculation, do not include

Source URL: {url}
Source content (truncated):
{content}
"""

GENERATE_PROMPT_TEMPLATE = """You are writing a markdown card for product '{product_id}' on dimension '{dim_id} {dim_name}'.

Dimension rubric ({eval_type}):
{rubric}

Facts gathered for this dimension:
{facts_md}

Output a concise markdown card following this structure (no code fences, no extra prose around it):

# {dim_id} {dim_name}

**Score / Value:** <derive from rubric and facts>

**Evidence:**
- <fact claim> ([source](<url>))
- <fact claim> ([source](<url>))

**Confidence:** <highest confidence level among facts>
"""

GENERATE_PROMPT_FALLBACK_TEMPLATE = """You are writing a markdown dimension card for product '{product_id}' based on these extracted facts.

Facts:
{facts_md}

Source URL: {url}

Write a concise markdown card with:
1. Heading: # {dimension_id} <dimension name>
2. Score or value (per the rubric below)
3. Evidence bullet list with [link](url) citations
4. Confidence label

Output ONLY the markdown content (no fences, no prose around it).
"""


def _build_dim_table(dims: list[Dimension]) -> str:
    """Render a markdown table of dimension IDs/names/types/rubric for prompt context."""
    if not dims:
        return "(no dimensions configured)"
    lines = [
        "| ID | Name | Type | Rubric |",
        "|---|---|---|---|",
    ]
    for d in dims:
        rubric_short = d.rubric[:120].replace("|", "\\|").replace("\n", " ")
        lines.append(f"| {d.id} | {d.name} | {d.evaluation_type} | {rubric_short} |")
    return "\n".join(lines)


class ClaudeCliLLMClient:
    """LLMClient that calls `claude -p <prompt>` via subprocess.

    Args:
        claude_bin: Path to claude binary (default: "claude" in PATH)
        timeout: Subprocess timeout in seconds (default: 180)
        content_limit: Max chars from source.content to include in prompt (default: 6000)
        dimensions: Optional list of Dimension to constrain LLM output to a known schema.
            When provided, the analyze prompt embeds the full dimension table; the
            generate prompt for each known dim_id includes its name + rubric +
            evaluation_type. Unknown dim_ids fall back to the legacy template.
    """

    def __init__(
        self,
        *,
        claude_bin: str = "claude",
        timeout: int = 180,
        content_limit: int = 6000,
        dimensions: list[Dimension] | None = None,
    ) -> None:
        self.claude_bin = claude_bin
        self.timeout = timeout
        self.content_limit = content_limit
        self.dimensions: list[Dimension] = list(dimensions) if dimensions else []
        self._dim_by_id: dict[str, Dimension] = {d.id: d for d in self.dimensions}

    def analyze(self, source: IngestSource) -> str:
        """Step 1: Extract structured facts. Returns raw JSON string."""
        prompt = ANALYZE_PROMPT_TEMPLATE.format(
            product_id=source.product_id,
            url=source.url,
            content=source.content[: self.content_limit],
            dim_table=_build_dim_table(self.dimensions),
        )
        return self._call(prompt)

    def generate(self, draft: AnalysisDraft, source: IngestSource) -> str:
        """Step 2: Render dimension card. Returns markdown string."""
        if not draft.facts:
            return ""
        # All facts in this draft share the same dimension_id (engine groups before calling)
        dim_id = draft.facts[0].get("dimension_id", "unknown")
        facts_md = "\n".join(
            f"- {f.get('claim', '')} (source: {f.get('evidence_url', 'unknown')}, "
            f"confidence: {f.get('confidence', 'UNVERIFIED')})"
            for f in draft.facts
        )

        dim = self._dim_by_id.get(dim_id)
        if dim is not None:
            prompt = GENERATE_PROMPT_TEMPLATE.format(
                product_id=source.product_id,
                dim_id=dim.id,
                dim_name=dim.name,
                eval_type=dim.evaluation_type,
                rubric=dim.rubric,
                facts_md=facts_md,
            )
        else:
            prompt = GENERATE_PROMPT_FALLBACK_TEMPLATE.format(
                product_id=source.product_id,
                url=source.url,
                facts_md=facts_md,
                dimension_id=dim_id,
            )
        return self._call(prompt)

    def complete(self, prompt: str) -> str:
        """Free-form completion: send `prompt` directly, return raw stdout.

        Used by the portfolio engine for long-form essays where the per-dimension
        card template is the wrong shape.
        """
        return self._call(prompt)

    def _call(self, prompt: str) -> str:
        try:
            result = subprocess.run(
                [self.claude_bin, "-p", prompt],
                capture_output=True,
                text=True,
                timeout=self.timeout,
            )
        except subprocess.TimeoutExpired as e:
            raise RuntimeError(f"claude CLI timeout after {self.timeout}s") from e
        except FileNotFoundError as e:
            raise RuntimeError(f"claude CLI not found at {self.claude_bin!r}") from e

        if result.returncode != 0:
            stderr = result.stderr.strip()[:500]
            raise RuntimeError(f"claude CLI failed (exit {result.returncode}): {stderr}")

        return result.stdout
