"""
对 research/raw/harness-engineering/ 下正文做词频/实体/共现统计。

输出:
  research/analysis/term-frequency.json  机器友好的统计数据
  research/analysis/term-frequency.md     人类友好的 markdown 报告
"""
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import jieba

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "wiki" / "raw" / "harness-engineering"
OUT_DIR = ROOT / "wiki" / "analysis"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ────────────────────────────────────────────────────────────
# 自定义词典:确保领域术语被作为整体识别
# ────────────────────────────────────────────────────────────
DOMAIN_TERMS = [
    # 核心概念
    "Harness", "Harness Engineering", "harness",
    "Agent", "AI Agent", "Coding Agent", "Sub-agent", "Subagent",
    "Tool Use", "Tool Calling", "Tool", "Tools",
    "Skills", "Skill", "MCP", "Spec", "SDD",
    "Spec-Driven Development", "Context Engineering",
    "Prompt Engineering", "Vibe Coding", "Pair Programming",
    "ReAct", "Reflection", "A2A", "Agentic Workflow",
    "Agentic Engineering", "Agent Loop", "Plan", "Planner",
    "Sandbox", "Workflow", "Pipeline",
    # 产品
    "Cursor", "Codex", "Claude Code", "Claude", "Anthropic",
    "OpenClaw", "OpenAI", "Gemini", "DeepSeek", "Hermes", "Manus",
    "TRAE", "DeerFlow", "AHE", "Aegis", "GPT", "DeepSeek",
    "Replit", "Devin", "GitHub Copilot", "Copilot",
    # 人物 / 机构
    "Martin Fowler", "Mitchell Hashimoto", "Stripe",
    "字节跳动", "复旦", "阿里", "腾讯", "QQ音乐",
    "鹅厂", "字节",
    # 中文术语
    "驾驭工程", "缰绳", "控制论", "工程化",
    "上下文工程", "提示词工程", "智能体", "反馈回路",
    "沙盒", "沙箱", "子代理", "子智能体",
    "护城河", "氛围编程", "驾驭",
]

for term in DOMAIN_TERMS:
    jieba.add_word(term, freq=1000)

# ────────────────────────────────────────────────────────────
# 停用词
# ────────────────────────────────────────────────────────────
STOPWORDS = set("""
的 了 是 在 和 与 或 也 就 都 而 但 又 还 等 这 那 之 以 及 由 使 对 让 把
一 二 三 四 五 六 七 八 九 十 百 千 万 个 些 每 多 少 几 第
我 你 他 她 它 们 他们 她们 它们 我们 你们 自己 大家
不 没 不是 不能 不要 不会 没有 没什么
有 会 能 可 可以 可能 应 应该 需 需要 必须 想
但是 不过 然而 因此 所以 因为 由于 如果 那么 然后 接下来
什么 怎么 为什么 哪里 哪些 这样 那样 这种 那种 这个 那个 这里 那里
比如 例如 即 也就是 也就是说 比方说 譬如
其 其中 此 此外 另 另外 同时 同样 一起 一样 一直 一些 某些 一种
非常 十分 特别 尤其 真的 还是 还有 已经 仍然 完全 总是 总 一直
再 又 再次 重新 才 才能 也 一会
通过 根据 关于 对于 对此 对方 即可 已 即将
来 去 来到 出 进 进入 出来 上 下 出去 起来 下去 上来 起 起 进 入
说 讲 谈 表示 认为 觉得 知道 看 看到 看见 听 听到 看作 当作
做 干 完成 实现 处理 解决 进行 执行 操作 使用 用 利用 使用
里 里面 中 内 内部 外 外部 上 下 之间 之上 之下 之前 之后 以前 以后
得到 拿到 获取 获得 给 给予 提供 带 带来 制造 形成
就是 就 都是 全是 仅 仅是 只 只是 只有 唯一 全部 所有 整 整个
来说 而言 看来 来看 而 而且 且 又 也 或 或者 还是
要 必须 务必 一定 是否 是不是 难以 容易 难
一个 两个 几个 这个 那个 整个 单个
真正 真 真的 难道 究竟 到底 究 终 终于 最终 最 最后
但 仅仅 单纯 直接 间接 完全 整体 部分 多 少 大 小 高 低 长 短 强 弱
从 到 由 在 至 自 向 至 与 同 跟
对方 各方 双方 多方
本 该 此 此处 这一 那一
快速 缓慢 高效 慢
""".split())

# 不需要计入(英文 stopwords / 单字母)
STOPWORDS.update("""
the a an of to in for on by with from at as is are was were be been being
and or but if then else this that these those it its our we us their they
have has had do does did done can could should would will may might shall
must I you he she me him her them themselves itself yours mine ours theirs
not no nor only also too very just so quite rather such when where why what
which who whom how than into within without across over under upon
about above below before after through during between among against off out
new old one two three four many much most more less little few any all
some other another more most lots ourselves himself herself
""".split())

# ────────────────────────────────────────────────────────────
# 解析单文件
# ────────────────────────────────────────────────────────────
FRONTMATTER_RE = re.compile(r"^---\n.*?\n---\n", re.DOTALL)
LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")
IMG_RE = re.compile(r"!\[[^\]]*\]\([^)]+\)")
URL_RE = re.compile(r"https?://\S+")
HEADING_RE = re.compile(r"^#+\s*", re.MULTILINE)
HTML_TAG_RE = re.compile(r"<[^>]+>")
PUNCT_RE = re.compile(r"[\s,，。、:;:!?!?\"'""''()（）【】《》<>—…\-—=\*\+/\\\|\[\]{}~`@#\$%^&]+")


def parse_article(path: Path):
    text = path.read_text(encoding="utf-8")
    fm_match = FRONTMATTER_RE.match(text)
    fm = {}
    if fm_match:
        for line in fm_match.group(0).strip("-\n ").split("\n"):
            if ":" in line:
                k, v = line.split(":", 1)
                fm[k.strip()] = v.strip().strip('"')
        body = text[fm_match.end():]
    else:
        body = text

    # 清洗:去图片、URL、HTML 标签;链接改为只保留可见文字
    body = IMG_RE.sub(" ", body)
    body = LINK_RE.sub(r"\1", body)
    body = URL_RE.sub(" ", body)
    body = HTML_TAG_RE.sub(" ", body)
    body = HEADING_RE.sub("", body)
    return fm, body


def tokenize(text: str):
    text = PUNCT_RE.sub(" ", text)
    tokens = []
    for tok in jieba.lcut(text, cut_all=False):
        tok = tok.strip()
        if not tok or len(tok) < 2:
            # 保留有意义的英文缩写(大写)
            if tok and len(tok) >= 2 and tok.isupper():
                tokens.append(tok)
            continue
        if tok.lower() in STOPWORDS or tok in STOPWORDS:
            continue
        if tok.isdigit():
            continue
        tokens.append(tok)
    return tokens


# ────────────────────────────────────────────────────────────
# 主流程
# ────────────────────────────────────────────────────────────
def main():
    files = sorted(p for p in RAW_DIR.glob("*/[0-9]*.md"))
    print(f"Found {len(files)} articles")

    term_count = Counter()       # 全局词频
    doc_freq = Counter()          # 在多少篇文章中出现
    bigram_count = Counter()
    by_category = defaultdict(Counter)
    by_source = defaultdict(Counter)
    article_meta = []

    for f in files:
        fm, body = parse_article(f)
        tokens = tokenize(body)
        seen_in_doc = set()

        for t in tokens:
            term_count[t] += 1
            if t not in seen_in_doc:
                doc_freq[t] += 1
                seen_in_doc.add(t)

        # bigrams (相邻词)
        for a, b in zip(tokens, tokens[1:]):
            if len(a) >= 2 and len(b) >= 2:
                bigram_count[f"{a} {b}"] += 1

        category = fm.get("category", f.parent.name)
        source = fm.get("source", "wechat") or "wechat"
        for t, c in Counter(tokens).items():
            by_category[category][t] += c
            by_source[source][t] += c

        article_meta.append({
            "path": str(f.relative_to(ROOT)),
            "title": fm.get("title", "").strip('"'),
            "category": category,
            "source": source,
            "host": fm.get("host", "mp.weixin.qq.com"),
            "url": fm.get("url", ""),
            "tokens": len(tokens),
        })

    # ─── 输出 JSON ───
    json_out = {
        "total_articles": len(files),
        "total_tokens": sum(term_count.values()),
        "vocabulary_size": len(term_count),
        "top_terms_global": term_count.most_common(200),
        "top_doc_freq": doc_freq.most_common(100),  # 跨文章普及度
        "top_bigrams": bigram_count.most_common(80),
        "by_category_top20": {
            cat: cnt.most_common(20) for cat, cnt in by_category.items()
        },
        "by_source_top20": {
            src: cnt.most_common(20) for src, cnt in by_source.items()
        },
        "articles": article_meta,
    }
    (OUT_DIR / "term-frequency.json").write_text(
        json.dumps(json_out, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # ─── 输出 Markdown ───
    lines = []
    lines.append("# Harness 合集词频与实体分析")
    lines.append("")
    lines.append(f"- 文章数: **{len(files)}**")
    lines.append(f"- 总 token: **{sum(term_count.values()):,}**")
    lines.append(f"- 词汇量: **{len(term_count):,}**")
    lines.append("")

    lines.append("## 一、跨文章普及度 Top 50 (DF: 出现在多少篇里)")
    lines.append("")
    lines.append("| Term | DF | TF | DF% |")
    lines.append("|---|---:|---:|---:|")
    for t, df in doc_freq.most_common(50):
        tf = term_count[t]
        pct = f"{df / len(files) * 100:.0f}%"
        lines.append(f"| `{t}` | {df} | {tf} | {pct} |")
    lines.append("")

    lines.append("## 二、二元短语 Top 50 (反映术语组合)")
    lines.append("")
    lines.append("| Bigram | Count |")
    lines.append("|---|---:|")
    for bg, c in bigram_count.most_common(50):
        if c < 3:
            break
        lines.append(f"| {bg} | {c} |")
    lines.append("")

    lines.append("## 三、按分类的 Top 15 词")
    lines.append("")
    for cat in sorted(by_category):
        lines.append(f"### {cat}")
        lines.append("")
        lines.append("| Term | Count |")
        lines.append("|---|---:|")
        for t, c in by_category[cat].most_common(15):
            lines.append(f"| `{t}` | {c} |")
        lines.append("")

    (OUT_DIR / "term-frequency.md").write_text("\n".join(lines), encoding="utf-8")

    print(f"→ wrote {OUT_DIR / 'term-frequency.json'}")
    print(f"→ wrote {OUT_DIR / 'term-frequency.md'}")
    print()
    print("Top 20 by DF:")
    for t, df in doc_freq.most_common(20):
        print(f"  {t:30s}  DF={df:3d}  TF={term_count[t]:5d}")


if __name__ == "__main__":
    main()
