"""
对 wiki/raw/harness-engineering/ 下正文做精准实体扫描。
- 用 word-boundary 匹配避免误命中
- 输出每个实体: TF (总出现) / DF (跨多少篇) / 在 6 个分类的分布
"""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "wiki" / "raw" / "harness-engineering"
OUT_DIR = ROOT / "wiki" / "analysis"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 实体定义:每项是 (规范名, [别名/正则pattern])
ENTITIES = {
    # ─── 核心概念 ───
    "Harness Engineering": [r"Harness Engineering", r"驾驭工程", r"驾驭工程"],
    "Harness": [r"\bHarness\b"],
    "Agent": [r"\bAgent\b"],
    "AI Agent": [r"AI\s+Agent"],
    "Coding Agent": [r"Coding\s+Agent", r"编码\s*Agent", r"代码\s*Agent"],
    "Sub-agent": [r"Sub[-\s]?[Aa]gent", r"子\s*Agent", r"子\s*智能体", r"子\s*代理"],
    "MCP": [r"\bMCP\b"],
    "Skills": [r"\bSkills?\b"],
    "Spec": [r"\bSpec\b"],
    "SDD": [r"\bSDD\b", r"Spec[-\s]?Driven\s+Development", r"规范\s*驱动\s*开发"],
    "Context Engineering": [r"Context\s+Engineering", r"上下文\s*工程"],
    "Prompt Engineering": [r"Prompt\s+Engineering", r"提示词\s*工程", r"提示\s*工程"],
    "Tool Use": [r"Tool\s+Use", r"Tool\s+Calling", r"工具\s*调用"],
    "ReAct": [r"\bReAct\b"],
    "Reflection": [r"\bReflection\b", r"反思"],
    "Vibe Coding": [r"Vibe\s+Coding", r"氛围\s*编程", r"氛围\s*编码"],
    "Pair Programming": [r"Pair\s+Programming", r"结对\s*编程"],
    "A2A": [r"\bA2A\b"],
    "Agentic Workflow": [r"Agentic\s+Workflow"],
    "Agentic Engineering": [r"Agentic\s+Engineering"],
    "AGENTS.md": [r"AGENTS\.md", r"AGENTS\s*\.\s*md"],
    "CLAUDE.md": [r"CLAUDE\.md"],

    # ─── 产品 ───
    "Claude Code": [r"Claude\s*Code", r"ClaudeCode"],
    "Claude": [r"\bClaude(?!\s*Code)\b"],
    "OpenClaw": [r"\bOpenClaw\b"],
    "Cursor": [r"\bCursor\b"],
    "Codex": [r"\bCodex\b"],
    "Hermes": [r"\bHermes\b"],
    "Manus": [r"\bManus\b"],
    "TRAE": [r"\bTRAE\b"],
    "DeerFlow": [r"DeerFlow"],
    "AHE": [r"\bAHE\b"],
    "Gemini": [r"\bGemini\b"],
    "Devin": [r"\bDevin\b"],
    "Replit": [r"\bReplit\b"],
    "GitHub Copilot": [r"GitHub\s+Copilot", r"\bCopilot\b"],
    "DeepSeek": [r"\bDeepSeek\b", r"深度求索"],
    "GPT": [r"\bGPT[-\s]?[345]?\b"],
    "Aegis": [r"\bAegis\b"],

    # ─── 公司/团队/人物 ───
    "Anthropic": [r"\bAnthropic\b"],
    "OpenAI": [r"\bOpenAI\b"],
    "Google": [r"\bGoogle\b", r"谷歌"],
    "Stripe": [r"\bStripe\b"],
    "字节跳动": [r"字节\s*跳动", r"\b字节\b", r"\bByteDance\b"],
    "鹅厂/腾讯": [r"鹅厂", r"\b腾讯\b", r"\bTencent\b", r"QQ音乐"],
    "阿里": [r"\b阿里(?!\s*云)\b", r"阿里\s*云", r"\bAlibaba\b"],
    "复旦": [r"复旦"],
    "Martin Fowler": [r"Martin\s+Fowler"],
    "Mitchell Hashimoto": [r"Mitchell\s+Hashimoto", r"HashiCorp"],

    # ─── 工程化术语 ───
    "Sandbox/沙盒": [r"\bSandbox\b", r"沙盒", r"沙箱"],
    "Workflow": [r"\bWorkflow\b", r"工作流"],
    "约束/Constraint": [r"约束", r"\bConstraint(s)?\b"],
    "反馈回路": [r"反馈\s*回路", r"反馈\s*循环", r"feedback\s+loop"],
    "护城河/Moat": [r"护城河", r"\bMoat\b"],
    "控制论": [r"控制论", r"\bCybernetic"],
    "上下文窗口": [r"上下文\s*窗口", r"context\s+window"],
    "评测/Eval": [r"\bEval\b", r"评测", r"\bbenchmark", r"基准\s*测试"],
    "Plan/规划": [r"\bPlanner\b", r"\bPlanning\b"],
    "渐进式披露": [r"渐进式\s*披露", r"progressive\s+disclosure"],
}


def main():
    files = sorted(RAW_DIR.glob("*/[0-9]*.md"))
    # 预编译 patterns
    compiled = {
        name: [re.compile(p, re.IGNORECASE) for p in patterns]
        for name, patterns in ENTITIES.items()
    }

    # entity → {tf, df, by_category{cat: tf}}
    stats = {name: {"tf": 0, "df": 0, "by_category": defaultdict(int)} for name in ENTITIES}
    article_meta = []

    for f in files:
        text = f.read_text(encoding="utf-8")
        # 去 frontmatter
        if text.startswith("---"):
            end = text.find("---", 3)
            if end > 0:
                fm = text[3:end]
                text = text[end+3:]
            else:
                fm = ""
        else:
            fm = ""
        category = f.parent.name

        article_entities = {}
        for name, regs in compiled.items():
            count = sum(len(r.findall(text)) for r in regs)
            if count > 0:
                stats[name]["tf"] += count
                stats[name]["df"] += 1
                stats[name]["by_category"][category] += count
                article_entities[name] = count

        article_meta.append({
            "path": str(f.relative_to(ROOT)),
            "category": category,
            "title": "",  # 留空,可从 fm 解析
            "entities": article_entities,
        })

    # 排序输出
    sorted_stats = sorted(stats.items(), key=lambda kv: (-kv[1]["df"], -kv[1]["tf"]))

    # JSON
    out_json = {
        "total_articles": len(files),
        "entities": {
            name: {
                "tf": s["tf"],
                "df": s["df"],
                "df_pct": round(s["df"] / len(files) * 100, 1),
                "by_category": dict(s["by_category"]),
            }
            for name, s in stats.items()
        },
        "articles": article_meta,
    }
    (OUT_DIR / "entity-scan.json").write_text(
        json.dumps(out_json, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Markdown
    total = len(files)
    lines = ["# Harness 合集实体扫描", ""]
    lines.append(f"{total} 篇文章中,各核心实体的 TF (总出现) / DF (出现于多少篇) / DF%。")
    lines.append("")
    lines.append("| Entity | TF | DF | DF% | 主要分类分布 |")
    lines.append("|---|---:|---:|---:|---|")
    for name, s in sorted_stats:
        if s["df"] == 0:
            continue
        cats = sorted(s["by_category"].items(), key=lambda kv: -kv[1])[:3]
        cats_str = ", ".join(f"{c.split('_', 1)[1] if '_' in c else c}({n})" for c, n in cats)
        lines.append(
            f"| **{name}** | {s['tf']} | {s['df']} | {s['df'] / total * 100:.0f}% | {cats_str} |"
        )

    # 0 命中也列出来,方便看哪些是空白
    lines.append("")
    lines.append(f"## 未命中实体 (在 {total} 篇中均未提及)")
    zero = [n for n, s in stats.items() if s["df"] == 0]
    if zero:
        lines.append("")
        for n in zero:
            lines.append(f"- {n}")
    else:
        lines.append("")
        lines.append("(全部实体都至少出现一次)")

    (OUT_DIR / "entity-scan.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"→ {OUT_DIR / 'entity-scan.json'}")
    print(f"→ {OUT_DIR / 'entity-scan.md'}")
    print()
    print("Top 30 entities by DF:")
    for name, s in sorted_stats[:30]:
        if s["df"] == 0:
            break
        print(f"  {name:30s}  DF={s['df']:3d}  TF={s['tf']:5d}")


if __name__ == "__main__":
    main()
