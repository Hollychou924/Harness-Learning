"""Seed realistic provenance for hermes + manus across 17 dimensions.

Brings the full P0 set (claude-code/cursor/codex + hermes/manus) to parity so
the 6 portfolio reports can compare 5 products side-by-side.

Run with: .venv/bin/python scripts/seed_phase5_hermes_manus.py
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
NOW = datetime.now(timezone.utc).isoformat(timespec="seconds")
EVALUATOR = "seed:demo-2026-05-24-phase5-hermes-manus"


# (product_id, dim_id, value, evidence_url)
SEEDS: list[tuple[str, str, object, str]] = [
    # ─── HERMES (Nous Research) ─────────────────────────────────
    # Open-source agentic framework tied to Hermes-3/4 LLM family.
    # Shell access via tool-use protocol, not native shell harness.
    ("hermes", "E1", "受限沙盒",
     "https://github.com/NousResearch/hermes-function-calling"),
    ("hermes", "E4", "可装",
     "https://github.com/NousResearch/hermes-function-calling"),
    ("hermes", "E5", 1,
     "https://nousresearch.com/hermes-function-calling"),
    ("hermes", "E6", 1,
     "https://github.com/NousResearch/Atropos"),
    ("hermes", "F1", "无标准化项目配置文件 (依赖应用层封装)",
     "https://github.com/NousResearch/hermes-function-calling"),
    ("hermes", "F3", 1,
     "https://nousresearch.com/hermes-function-calling"),
    ("hermes", "J5", 1,
     "https://github.com/NousResearch/hermes-function-calling"),
    ("hermes", "N1", "MIT/Apache OSS",
     "https://github.com/NousResearch"),
    ("hermes", "N2", "Hermes 系列 GitHub 4k+ stars / 活跃 PR",
     "https://github.com/NousResearch/hermes-function-calling"),
    ("hermes", "N3", 2,
     "https://github.com/NousResearch/hermes-function-calling"),
    ("hermes", "N4", "厂商独裁",
     "https://nousresearch.com"),
    ("hermes", "N5", 2,
     "https://discord.gg/nousresearch"),
    ("hermes", "M1", 3,
     "https://nousresearch.com/hermes-3"),
    ("hermes", "M2", "用户上报 opt-in",
     "https://github.com/NousResearch"),
    ("hermes", "M3", 1,
     "https://huggingface.co/NousResearch"),
    ("hermes", "M4", "全局切换",
     "https://github.com/NousResearch/hermes-function-calling"),
    ("hermes", "M5",
     "Hermes 3 → Hermes 4 节奏与函数调用框架同步迭代",
     "https://nousresearch.com/hermes-4"),

    # ─── MANUS (Butterfly Effect / Monica.im) ───────────────────
    # 闭源云端通用 Agent,沙盒 VM 自主执行,多模型路由。
    ("manus", "E1", "受限沙盒",
     "https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus"),
    ("manus", "E4", "可装",
     "https://docs.manus.im"),
    ("manus", "E5", 2,
     "https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus"),
    ("manus", "E6", 3,
     "https://manus.im/blog/manus-cloud-vm"),
    ("manus", "F1", "无 (云端 Agent,无本地配置)",
     "https://docs.manus.im"),
    ("manus", "F3", 2,
     "https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus"),
    ("manus", "J5", 2,
     "https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus"),
    ("manus", "N1", "闭源",
     "https://manus.im/legal/terms"),
    ("manus", "N2", "无公共 GitHub 主仓 (闭源云服务)",
     "https://manus.im"),
    ("manus", "N3", 1,
     "https://manus.im/contact"),
    ("manus", "N4", "厂商独裁",
     "https://manus.im"),
    ("manus", "N5", 1,
     "https://x.com/ManusAI_HQ"),
    ("manus", "M1", 1,
     "https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus"),
    ("manus", "M2", "Harness 行为数据回流训练",
     "https://manus.im/legal/privacy"),
    ("manus", "M3", 3,
     "https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus"),
    ("manus", "M4", "工具/Skill 级路由",
     "https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus"),
    ("manus", "M5",
     "无自研模型,跟随 Claude/GPT 等基础模型节奏迭代 Harness",
     "https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus"),
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
        product_dir = PROJECT_ROOT / "wiki" / "compiled" / product_id
        product_dir.mkdir(parents=True, exist_ok=True)
        provenance_file = product_dir / "_provenance.json"
        existing: dict[str, dict] = {}
        if provenance_file.exists():
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
