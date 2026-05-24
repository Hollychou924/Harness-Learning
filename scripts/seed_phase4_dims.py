"""Seed realistic provenance for J5/N1-N5/M1-M5 across 3 P0 products.

Run with: .venv/bin/python scripts/seed_phase4_dims.py
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
NOW = datetime.now(timezone.utc).isoformat(timespec="seconds")
EVALUATOR = "seed:demo-2026-05-24-phase4"


# (product_id, dim_id, value, evidence_url)
SEEDS: list[tuple[str, str, object, str]] = [
    # ── J5 Prompt/KV Cache 策略 ────────────────────────────────────
    ("claude-code", "J5", 3,
     "https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching"),
    ("cursor", "J5", 1,
     "https://docs.cursor.com/account/pricing"),
    ("codex", "J5", 2,
     "https://platform.openai.com/docs/guides/prompt-caching"),

    # ── N1 开源协议 ──────────────────────────────────────────────
    ("claude-code", "N1", "源可用",
     "https://github.com/anthropics/claude-code"),
    ("cursor", "N1", "闭源",
     "https://www.cursor.com/legal/terms"),
    ("codex", "N1", "MIT/Apache OSS",
     "https://github.com/openai/codex"),

    # ── N2 GitHub 关注度 ─────────────────────────────────────────
    ("claude-code", "N2", "21k+ stars / 月度数百 issues + community PR",
     "https://github.com/anthropics/claude-code"),
    ("cursor", "N2", "无公共 GitHub 主仓 (闭源)",
     "https://www.cursor.com"),
    ("codex", "N2", "26k+ stars / 月度高活跃 PR",
     "https://github.com/openai/codex"),

    # ── N3 第三方贡献机制 ────────────────────────────────────────
    ("claude-code", "N3", 3,
     "https://github.com/anthropics/claude-code/tree/main/plugins"),
    ("cursor", "N3", 1,
     "https://forum.cursor.com"),
    ("codex", "N3", 2,
     "https://github.com/openai/codex/blob/main/CONTRIBUTING.md"),

    # ── N4 治理模式 ──────────────────────────────────────────────
    ("claude-code", "N4", "厂商独裁",
     "https://docs.anthropic.com/en/docs/claude-code"),
    ("cursor", "N4", "厂商独裁",
     "https://www.cursor.com/changelog"),
    ("codex", "N4", "RFC 流程",
     "https://github.com/openai/codex/issues"),

    # ── N5 社区生态健康度 ────────────────────────────────────────
    ("claude-code", "N5", 2,
     "https://www.anthropic.com/news"),
    ("cursor", "N5", 2,
     "https://forum.cursor.com"),
    ("codex", "N5", 2,
     "https://community.openai.com/c/codex"),

    # ── M1 模型-Harness 耦合度 ──────────────────────────────────
    ("claude-code", "M1", 3,
     "https://www.anthropic.com/research/swe-bench-sonnet"),
    ("cursor", "M1", 2,
     "https://www.cursor.com/blog/composer"),
    ("codex", "M1", 3,
     "https://openai.com/index/introducing-codex/"),

    # ── M2 训练反馈回路 ─────────────────────────────────────────
    ("claude-code", "M2", "用户上报 opt-in",
     "https://docs.anthropic.com/en/docs/claude-code/data-usage"),
    ("cursor", "M2", "Harness 行为数据回流训练",
     "https://www.cursor.com/legal/privacy"),
    ("codex", "M2", "用户上报 opt-in",
     "https://platform.openai.com/docs/codex/privacy"),

    # ── M3 多厂商模型支持 ────────────────────────────────────────
    ("claude-code", "M3", 1,
     "https://docs.anthropic.com/en/docs/claude-code/configuration"),
    ("cursor", "M3", 3,
     "https://docs.cursor.com/settings/models"),
    ("codex", "M3", 2,
     "https://platform.openai.com/docs/codex/models"),

    # ── M4 模型版本切换粒度 ──────────────────────────────────────
    ("claude-code", "M4", "全局切换",
     "https://docs.anthropic.com/en/docs/claude-code/cli-reference"),
    ("cursor", "M4", "工具/Skill 级路由",
     "https://docs.cursor.com/settings/models"),
    ("codex", "M4", "对话级切换",
     "https://platform.openai.com/docs/codex/models"),

    # ── M5 共进化节奏 ───────────────────────────────────────────
    ("claude-code", "M5",
     "Sonnet 4.6 + Claude Code 2.0 同周发布;Opus 4.7 + Claude Code 2.x 同步",
     "https://www.anthropic.com/news/claude-code-2"),
    ("cursor", "M5",
     "Composer-1 自研模型 + Cursor 1.x 自定节奏",
     "https://www.cursor.com/blog/composer-1"),
    ("codex", "M5",
     "GPT-5-Codex + Codex CLI 同步发布",
     "https://openai.com/index/introducing-codex/"),
]


def main() -> None:
    by_product: dict[str, dict[str, dict]] = {}
    for product_id, dim_id, value, evidence_url in SEEDS:
        by_product.setdefault(product_id, {})
        by_product[product_id][dim_id] = {
            "product_id": product_id,
            "dimension_id": dim_id,
            "value": value,
            "evidence_urls": [evidence_url],
            "evaluator": EVALUATOR,
            "confidence": "EXTRACTED",
            "last_verified": NOW,
            "review_status": None,
            "review_decision_at": None,
            "reviewer": None,
        }

    for product_id, new_entries in by_product.items():
        provenance_file = (
            PROJECT_ROOT / "wiki" / "compiled" / product_id / "_provenance.json"
        )
        existing = json.loads(provenance_file.read_text(encoding="utf-8"))
        existing.update(new_entries)
        provenance_file.write_text(
            json.dumps(existing, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(
            f"✓ {product_id}: +{len(new_entries)} dims "
            f"(total {len(existing)})"
        )


if __name__ == "__main__":
    main()
