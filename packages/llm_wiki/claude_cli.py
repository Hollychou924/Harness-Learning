"""ClaudeCliLLMClient — LLMClient implementation using `claude -p` subprocess.

Calls `claude` CLI in headless (one-shot) mode. No API key required if `claude`
CLI is already authenticated locally. Falls back to RuntimeError on failure
(caller decides whether to retry, route to review queue, or skip).
"""
import logging
import subprocess
from packages.llm_wiki.ingest import IngestSource, AnalysisDraft

logger = logging.getLogger(__name__)

ANALYZE_PROMPT_TEMPLATE = """You are extracting structured facts from a documentation source for AI agent product '{product_id}'.

Return ONLY valid JSON with this exact shape (no prose, no markdown fences):
{{
  "facts": [
    {{"claim": "...", "evidence_url": "...", "confidence": "EXTRACTED|INFERRED|AMBIGUOUS|UNVERIFIED", "dimension_id": "E1|E4|E5|E6|F1|F3"}}
  ],
  "entities": ["..."],
  "topics": ["..."]
}}

Confidence guide:
- EXTRACTED: directly stated in source
- INFERRED: derived from stated facts via reasoning
- AMBIGUOUS: source is unclear or contradicts other sources
- UNVERIFIED: speculation, do not include unless flagged

Dimension IDs (only use these for facts that match):
- E1: Terminal/Shell execution capability
- E4: MCP support
- E5: Custom tool/Hook system (Skill, SubAgent)
- E6: Long task persistence (cloud agent, checkpoint)
- F1: Project config files (CLAUDE.md, AGENTS.md, etc.)
- F3: Memory and context compaction

Source URL: {url}
Source content (truncated to 6000 chars):
{content}
"""

GENERATE_PROMPT_TEMPLATE = """You are writing a markdown dimension card for product '{product_id}' based on these extracted facts.

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


class ClaudeCliLLMClient:
    """LLMClient that calls `claude -p <prompt>` via subprocess.

    Args:
        claude_bin: Path to claude binary (default: "claude" in PATH)
        timeout: Subprocess timeout in seconds (default: 180)
        content_limit: Max chars from source.content to include in prompt (default: 6000)
    """

    def __init__(
        self,
        *,
        claude_bin: str = "claude",
        timeout: int = 180,
        content_limit: int = 6000,
    ) -> None:
        self.claude_bin = claude_bin
        self.timeout = timeout
        self.content_limit = content_limit

    def analyze(self, source: IngestSource) -> str:
        """Step 1: Extract structured facts. Returns raw JSON string."""
        prompt = ANALYZE_PROMPT_TEMPLATE.format(
            product_id=source.product_id,
            url=source.url,
            content=source.content[: self.content_limit],
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
        prompt = GENERATE_PROMPT_TEMPLATE.format(
            product_id=source.product_id,
            url=source.url,
            facts_md=facts_md,
            dimension_id=dim_id,
        )
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
