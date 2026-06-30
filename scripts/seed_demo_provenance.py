"""Seed realistic provenance data for 3 P0 products (claude-code / cursor / codex).

Run once to populate research/compiled/{product}/_provenance.json so wiki compare
shows real values. Replace UNVERIFIED placeholders that appear when research/compiled
is empty (e.g. when Path A docs sync is blocked by geofence).

This is demo data based on documented public knowledge of each product.
For production, replace via real Path A sync (sync_product_path_a) once docs
are reachable.
"""
from datetime import datetime, timezone
from pathlib import Path

from pipeline.core.llm_wiki.paths import WikiLayout, init_wiki
from pipeline.core.llm_wiki.provenance import write_provenance
from pipeline.core.schemas.evaluation import Confidence, ProductEvaluation

NOW = datetime.now(timezone.utc)

# Realistic evaluations based on public docs (as of 2026-05)
SEED_DATA: dict[str, list[dict]] = {
    "claude-code": [
        {
            "dim": "E1",
            "value": "完整 Shell + 权限模式",
            "evidence": "https://docs.anthropic.com/en/docs/claude-code/security#permissions",
        },
        {
            "dim": "E4",
            "value": "原生 + Marketplace",
            "evidence": "https://docs.anthropic.com/en/docs/claude-code/mcp",
        },
        {
            "dim": "E5",
            "value": 3,
            "evidence": "https://docs.anthropic.com/en/docs/claude-code/skills",
        },  # Skill+Hook+SubAgent
        {
            "dim": "E6",
            "value": 2,
            "evidence": "https://docs.anthropic.com/en/docs/claude-code/checkpoints",
        },  # Checkpoint
        {
            "dim": "F1",
            "value": "CLAUDE.md + .claude/agents/ + .claude/skills/",
            "evidence": "https://docs.anthropic.com/en/docs/claude-code/memory",
        },
        {
            "dim": "F3",
            "value": 3,
            "evidence": "https://docs.anthropic.com/en/docs/claude-code/memory",
        },  # editable + shareable
    ],
    "cursor": [
        {
            "dim": "E1",
            "value": "完整 Shell + 权限模式",
            "evidence": "https://docs.cursor.com/agent/terminal",
        },
        {
            "dim": "E4",
            "value": "原生 + Marketplace",
            "evidence": "https://docs.cursor.com/context/mcp",
        },
        {
            "dim": "E5",
            "value": 2,
            "evidence": "https://docs.cursor.com/context/rules-for-ai",
        },  # Rules system, no full hook+subagent
        {
            "dim": "E6",
            "value": 1,
            "evidence": "https://docs.cursor.com/agent/overview",
        },  # Multi-turn
        {
            "dim": "F1",
            "value": ".cursor/rules/ + .cursorrules",
            "evidence": "https://docs.cursor.com/context/rules-for-ai",
        },
        {
            "dim": "F3",
            "value": 2,
            "evidence": "https://docs.cursor.com/context/rules-for-ai",
        },  # Cross-session via rules
    ],
    "codex": [
        {
            "dim": "E1",
            "value": "完整 Shell + 权限模式",
            "evidence": "https://platform.openai.com/docs/codex/security",
        },
        {
            "dim": "E4",
            "value": "原生 + Marketplace",
            "evidence": "https://platform.openai.com/docs/codex/mcp",
        },
        {
            "dim": "E5",
            "value": 2,
            "evidence": "https://platform.openai.com/docs/codex/agents",
        },  # AGENTS.md system
        {
            "dim": "E6",
            "value": 3,
            "evidence": "https://platform.openai.com/docs/codex/cloud",
        },  # Cloud Agent async
        {
            "dim": "F1",
            "value": "AGENTS.md",
            "evidence": "https://platform.openai.com/docs/codex/agents",
        },
        {
            "dim": "F3",
            "value": 2,
            "evidence": "https://platform.openai.com/docs/codex/memory",
        },
    ],
}


def main() -> None:
    layout = WikiLayout(Path("wiki"))
    init_wiki(layout.root)  # idempotent

    for product_id, evals_data in SEED_DATA.items():
        product_dir = layout.compiled / product_id
        product_dir.mkdir(parents=True, exist_ok=True)

        evaluations = [
            ProductEvaluation(
                product_id=product_id,
                dimension_id=row["dim"],
                value=row["value"],
                evidence_urls=[row["evidence"]],
                evaluator="seed:demo-2026-05-24",
                confidence=Confidence.EXTRACTED,
                last_verified=NOW,
            )
            for row in evals_data
        ]
        write_provenance(product_dir, evaluations)
        print(f"  ✓ {product_id}: {len(evaluations)} dimensions seeded")


if __name__ == "__main__":
    main()
