#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(__filename));
const RAW_BASE = join(ROOT, "wiki", "raw", "official-posts");
const CARD_BASE = join(ROOT, "wiki", "review", "source-cards", "official-posts");
const COVERAGE_PATH = join(
  ROOT,
  "wiki",
  "review",
  "ingest-coverage",
  "2026-05-25-cursor-claude-official-posts.md",
);

const POSTS = [
  // Cursor official posts
  ["cursor", "https://cursor.com/cn/blog/dynamic-context-discovery"],
  ["cursor", "https://cursor.com/cn/blog/cloud-agent-lessons"],
  ["cursor", "https://cursor.com/cn/blog/cloud-agent-development-environments"],
  ["cursor", "https://cursor.com/cn/blog/continually-improving-agent-harness"],
  ["cursor", "https://cursor.com/cn/blog/typescript-sdk"],
  ["cursor", "https://cursor.com/cn/blog/app-stability"],
  ["cursor", "https://cursor.com/cn/blog/better-models-ambitious-work"],
  ["cursor", "https://cursor.com/cn/blog/canvas"],
  ["cursor", "https://cursor.com/cn/blog/multi-agent-kernels"],
  ["cursor", "https://cursor.com/cn/blog/bugbot-learning"],
  ["cursor", "https://cursor.com/cn/blog/cursor-3"],
  ["cursor", "https://cursor.com/cn/blog/fast-regex-search"],
  ["cursor", "https://cursor.com/cn/blog/cursorbench"],
  ["cursor", "https://cursor.com/cn/blog/automations"],
  ["cursor", "https://cursor.com/cn/blog/cursor-support"],
  ["cursor", "https://cursor.com/cn/blog/secure-codebase-indexing"],
  ["cursor", "https://cursor.com/cn/blog/dynamic-context-discovery"],
  ["cursor", "https://cursor.com/cn/blog/agent-best-practices"],
  ["cursor", "https://cursor.com/cn/blog/scaling-agents"],
  ["cursor", "https://cursor.com/cn/blog/building-bugbot"],
  ["cursor", "https://cursor.com/cn/blog/self-driving-codebases"],

  // Claude official posts
  ["claude", "https://claude.com/blog/preview-review-and-merge-with-claude-code"],
  ["claude", "https://claude.com/blog/code-review"],
  ["claude", "https://claude.com/blog/claude-builds-visuals"],
  ["claude", "https://claude.com/blog/auto-mode"],
  ["claude", "https://claude.com/blog/subagents-in-claude-code"],
  ["claude", "https://claude.com/blog/multi-agent-coordination-patterns"],
  ["claude", "https://claude.com/blog/seeing-like-an-agent"],
  ["claude", "https://claude.com/blog/introducing-routines-in-claude-code"],
  ["claude", "https://claude.com/blog/claude-code-desktop-redesign"],
  ["claude", "https://claude.com/blog/using-claude-code-session-management-and-1m-context"],
  ["claude", "https://claude.com/blog/meet-the-winners-of-our-built-with-opus-4-6-claude-code-hackathon"],
  ["claude", "https://claude.com/blog/best-practices-for-using-claude-opus-4-7-with-claude-code"],
  ["claude", "https://claude.com/blog/building-agents-that-reach-production-systems-with-mcp"],
  ["claude", "https://claude.com/blog/claude-managed-agents-memory"],
  ["claude", "https://claude.com/blog/connectors-for-everyday-life"],
  ["claude", "https://claude.com/blog/onboarding-claude-code-like-a-new-developer-lessons-from-17-years-of-development"],
  ["claude", "https://claude.com/blog/product-development-in-the-agentic-era"],
  ["claude", "https://claude.com/blog/lessons-from-building-claude-code-prompt-caching-is-everything"],
  ["claude", "https://claude.com/blog/how-a-non-technical-project-manager-built-and-shipped-a-stress-management-app-with-claude-code-in-six-weeks"],
  ["claude", "https://claude.com/blog/new-in-claude-managed-agents"],
  ["claude", "https://claude.com/blog/collaborate-with-claude-across-excel-powerpoint-word-and-outlook"],
  ["claude", "https://claude.com/blog/agent-view-in-claude-code"],
  ["claude", "https://claude.com/blog/best-practices-for-computer-and-browser-use-with-claude"],
  ["claude", "https://claude.com/blog/how-claude-code-works-in-large-codebases-best-practices-and-where-to-start"],
  ["claude", "https://claude.com/blog/the-founders-playbook"],
  ["claude", "https://claude.com/blog/claude-managed-agents-updates"],
  ["claude", "https://claude.com/blog/how-an-anthropic-sales-leader-uses-claude-cowork-to-run-a-4-000-account-book"],
  ["claude", "https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html"],
  ["claude", "https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them"],
];

const fetchedAt = new Date().toISOString();

const slugify = (s, maxLen = 72) =>
  s
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/[^\w\u4e00-\u9fff-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen) || "untitled";

const escapeYaml = (s = "") => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const decodeEntities = (s = "") =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

const stripTags = (s = "") => decodeEntities(s.replace(/<[^>]+>/g, "").trim());

function extractJsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(stripTags(m[1]));
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed?.["@graph"]) out.push(...parsed["@graph"]);
      else out.push(parsed);
    } catch {}
  }
  return out;
}

function metadataFromHtml(html, url) {
  const allJson = extractJsonLd(html);
  const blog = allJson.find((x) => {
    const t = x?.["@type"];
    return t === "BlogPosting" || (Array.isArray(t) && t.includes("BlogPosting"));
  });
  const title =
    blog?.headline ||
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i.exec(html)?.[1] ||
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ||
    url.split("/").pop();
  const description =
    blog?.description ||
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i.exec(html)?.[1] ||
    "";
  let author = "";
  if (typeof blog?.author === "string") author = blog.author;
  else if (Array.isArray(blog?.author)) author = blog.author.map((a) => a?.name).filter(Boolean).join(", ");
  else if (blog?.author?.name) author = blog.author.name;
  return {
    title: decodeEntities(String(title).replace(/\s+[·|]\s+(Cursor|Claude)$/i, "").trim()),
    description: decodeEntities(description),
    date: decodeEntities(String(blog?.datePublished || blog?.dateModified || "")),
    author: decodeEntities(author),
  };
}

function extractMainHtml(html) {
  const start = html.indexOf("<main");
  if (start < 0) return html;
  const end = html.indexOf("</main>", start);
  if (end < 0) return html.slice(start);
  return html.slice(start, end + "</main>".length);
}

const htmlToMarkdown = (html) =>
  decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<svg[\s\S]*?<\/svg>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<p[^>]*>/gi, "")
      .replace(/<h1[^>]*>/gi, "\n# ")
      .replace(/<\/h1>/gi, "\n\n")
      .replace(/<h2[^>]*>/gi, "\n## ")
      .replace(/<\/h2>/gi, "\n\n")
      .replace(/<h3[^>]*>/gi, "\n### ")
      .replace(/<\/h3>/gi, "\n\n")
      .replace(/<h4[^>]*>/gi, "\n#### ")
      .replace(/<\/h4>/gi, "\n\n")
      .replace(/<strong[^>]*>/gi, "**")
      .replace(/<\/strong>/gi, "**")
      .replace(/<b[^>]*>/gi, "**")
      .replace(/<\/b>/gi, "**")
      .replace(/<em[^>]*>/gi, "*")
      .replace(/<\/em>/gi, "*")
      .replace(/<code[^>]*>/gi, "`")
      .replace(/<\/code>/gi, "`")
      .replace(/<pre[^>]*>/gi, "\n```\n")
      .replace(/<\/pre>/gi, "\n```\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
      .replace(/<img[^>]*(?:data-src|src)=["']([^"']+)["'][^>]*>/gi, "\n![image]($1)\n")
      .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, txt) => {
        const clean = stripTags(txt);
        return clean ? `[${clean}](${href})` : "";
      })
      .replace(/<[^>]+>/g, "")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );

function cleanMarkdown(md, vendor, title) {
  let out = md
    .replace(/\[\]\(#\)/g, "")
    .replace(/\*\*\s*\*\*/g, "")
    .replace(/↑\n/g, "")
    .replace(/\[#\]\(#([^)]+)?\)/g, "")
    .replace(/## \[#\]\([^)]+\)/g, "## ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const cutMarkers =
    vendor === "cursor"
      ? ["\n分类：", "\n作者:", "\n相关文章", "\n### 产品"]
      : ["\nNo items found", "\n[Prev]", "\neBook", "\nGet Claude Code", "\nRelated posts", "\nTransform how your organization"];
  for (const marker of cutMarkers) {
    const idx = out.indexOf(marker);
    if (idx > 1500) out = out.slice(0, idx).trim();
  }
  if (!out.includes(`# ${title}`) && !out.startsWith("# ")) {
    out = `# ${title}\n\n${out}`;
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

const SIGNALS = [
  ["Harness", /harness|agent harness/i],
  ["Context", /context|上下文|context window|1m context/i],
  ["Memory", /memory|记忆|session management/i],
  ["MCP", /\bMCP\b|model context protocol/i],
  ["Skills", /\bskills?\b|routines?|routine/i],
  ["Subagent", /sub[- ]?agents?|multi-agent|agent teams?|kernels?/i],
  ["Tool Use", /tool|工具|computer use|browser use|terminal/i],
  ["Cloud Agent", /cloud agent|development environment|automations?|self-driving/i],
  ["Review/Eval", /review|bugbot|cursorbench|benchmark|eval|评测|stability|support/i],
  ["Security/Permissions", /secure|security|permission|auto mode|sandbox|indexing/i],
  ["UI/UX", /canvas|desktop|visual|html|merge|preview/i],
  ["SDK/API", /\bSDK\b|typescript|connectors?/i],
  ["Cache", /cache|caching|prompt caching/i],
];

function signalHits(content) {
  return SIGNALS.flatMap(([name, re]) => {
    const matches = content.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`));
    return matches ? [[name, matches.length]] : [];
  });
}

function destinations(vendor, title, url, content) {
  const s = `${title}\n${url}\n${content.slice(0, 4000)}`.toLowerCase();
  const out = new Set();
  if (vendor === "cursor") out.add("wiki/entities/cursor.md");
  if (vendor === "claude") out.add("wiki/entities/claude-code.md");
  if (/review|bugbot|cursorbench|benchmark|eval|stability|support/.test(s)) out.add("wiki/topics/agent-evaluation-system.md");
  if (/context|memory|skills|subagent|multi-agent|mcp|tool|cache|harness/.test(s)) out.add("wiki/concepts/prompt-context-harness.md");
  if (/cloud agent|automations|self-driving|scaling|agent harness|auto mode|sandbox|permission/.test(s)) {
    out.add("wiki/concepts/harness-engineering.md");
  }
  return [...out];
}

function headings(md) {
  return md
    .split("\n")
    .filter((line) => /^#{1,3}\s+/.test(line))
    .map((line) => line.replace(/^#{1,3}\s+/, "").trim())
    .filter((line) => !/^image$/i.test(line))
    .slice(0, 10);
}

function rel(fromDir, target) {
  const from = fromDir.split("/").filter(Boolean);
  const to = target.split("/").filter(Boolean);
  while (from.length && to.length && from[0] === to[0]) {
    from.shift();
    to.shift();
  }
  return `${"../".repeat(from.length)}${to.join("/")}`;
}

async function fetchPost(vendor, url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const meta = metadataFromHtml(html, url);
  const main = extractMainHtml(html);
  const body = cleanMarkdown(htmlToMarkdown(main), vendor, meta.title);
  if (body.length < 800) throw new Error(`content too short: ${body.length}`);
  return { ...meta, body };
}

function writeRaw(post) {
  const datePrefix = normalizeDatePrefix(post.date);
  const slug = slugify(post.title);
  const path = join(RAW_BASE, post.vendor, `${datePrefix}-${slug}.md`);
  mkdirSync(dirname(path), { recursive: true });
  const front = [
    "---",
    `title: ${escapeYaml(post.title)}`,
    `url: ${post.url}`,
    `vendor: ${post.vendor}`,
    `author: ${escapeYaml(post.author)}`,
    `publish_time: ${escapeYaml(post.date)}`,
    `fetched_at: ${escapeYaml(fetchedAt)}`,
    `source: official-blog`,
    "---",
    "",
  ].join("\n");
  writeFileSync(path, `${front}${post.body}\n`, "utf-8");
  return path;
}

function normalizeDatePrefix(date) {
  if (!date) return "undated";
  const iso = String(date).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const named = String(date).match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\b/);
  if (named) {
    const months = {
      jan: "01",
      january: "01",
      feb: "02",
      february: "02",
      mar: "03",
      march: "03",
      apr: "04",
      april: "04",
      may: "05",
      jun: "06",
      june: "06",
      jul: "07",
      july: "07",
      aug: "08",
      august: "08",
      sep: "09",
      sept: "09",
      september: "09",
      oct: "10",
      october: "10",
      nov: "11",
      november: "11",
      dec: "12",
      december: "12",
    };
    const mm = months[named[1].toLowerCase()];
    if (mm) return `${named[3]}-${mm}-${String(named[2]).padStart(2, "0")}`;
  }
  return "undated";
}

function writeCard(post, rawPath, dests) {
  const slug = slugify(post.title);
  const path = join(CARD_BASE, `${post.vendor}-${slug}.md`);
  mkdirSync(dirname(path), { recursive: true });
  const rawRel = rel("wiki/review/source-cards/official-posts", rawPath.replace(`${ROOT}/`, ""));
  const destLines = dests.map((d) => `- [${d.split("/").pop().replace(/\.md$/, "")}](${rel("wiki/review/source-cards/official-posts", d)})`);
  const signalRows = signalHits(post.body)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `| ${name} | ${count} |`)
    .join("\n");
  const outline = headings(post.body).map((h) => `- ${h}`).join("\n") || "- 无明显标题结构";
  const body = [
    "---",
    `id: source-card-official-${post.vendor}-${slug}`,
    "type: source-card",
    "status: triaged",
    `source: ${rawPath.replace(`${ROOT}/`, "")}`,
    "updated: 2026-05-25",
    "---",
    "",
    `# 官方文章卡 · ${post.title}`,
    "",
    "## 原文信息",
    "",
    `- 来源: ${post.vendor === "cursor" ? "Cursor 官方 Blog" : "Claude / Anthropic 官方 Blog"}`,
    `- 作者: ${post.author || "-"}`,
    `- 发布时间: ${post.date || "-"}`,
    `- URL: ${post.url}`,
    `- 原文: [raw](${rawRel})`,
    "",
    "## 关键线索",
    "",
    "| 线索 | 命中次数 |",
    "|---|---:|",
    signalRows || "| - | 0 |",
    "",
    "## 内容提要",
    "",
    outline,
    "",
    "## 触发器判定",
    "",
    "- 触发器: 官方产品机制 / 官方最佳实践 / 官方评测或工程方法",
    "- 当前状态: triaged, 已进入覆盖账本；其中高价值结论进入实体页或专题页。",
    "",
    "## 已沉淀去向",
    "",
    ...destLines,
    "",
    "## 待升级 / 待复核",
    "",
    "- 后续若进入 E1-E9 正文写作, 需把本文关键结论转成章节证据。",
  ].join("\n");
  writeFileSync(path, `${body}\n`, "utf-8");
  return path;
}

function writeIndexes(rows) {
  for (const vendor of ["cursor", "claude"]) {
    const subset = rows.filter((r) => r.vendor === vendor);
    const lines = [
      `# ${vendor === "cursor" ? "Cursor" : "Claude"} 官方文章入库索引`,
      "",
      `- 抓取时间: ${fetchedAt}`,
      `- 文章数: ${subset.length}`,
      "",
      "| # | 标题 | 发布时间 | 文件 |",
      "|---:|---|---|---|",
    ];
    subset.forEach((row, idx) => {
      const rawRel = row.rawPath.split(`${RAW_BASE}/${vendor}/`)[1];
      lines.push(`| ${idx + 1} | [${row.title.replace(/\|/g, "\\|")}](${rawRel}) | ${row.date || "-"} | \`${rawRel}\` |`);
    });
    writeFileSync(join(RAW_BASE, vendor, "INDEX.md"), `${lines.join("\n")}\n`, "utf-8");
  }
}

function writeCoverage(rows, failures) {
  mkdirSync(dirname(COVERAGE_PATH), { recursive: true });
  const lines = [
    "---",
    "id: coverage-cursor-claude-official-posts",
    "type: ingest-coverage",
    "status: triaged",
    "updated: 2026-05-25",
    'scope: "Cursor + Claude 官方文章入库与 wiki 沉淀"',
    "---",
    "",
    "# 入库覆盖账本 · Cursor / Claude 官方文章",
    "",
    "## 1. 总览",
    "",
    `- Cursor 官方文章: **${rows.filter((r) => r.vendor === "cursor").length} 篇**`,
    `- Claude 官方文章: **${rows.filter((r) => r.vendor === "claude").length} 篇**`,
    `- 去重后成功入库: **${rows.length} 篇**`,
    `- 抓取失败: **${failures.length} 篇**`,
    "- 当前状态: **triaged**。本轮完成官方原文、单篇卡、覆盖表；核心结论进入 Cursor / Claude Code 实体页与 Agent 评测体系专题。",
    "",
    "## 2. 逐篇覆盖表",
    "",
    "| # | 来源 | 原文 | source-card | 当前去向 | 待升级/待复核 |",
    "|---:|---|---|---|---|---|",
  ];
  rows.forEach((row, idx) => {
    const rawRel = rel("wiki/review/ingest-coverage", row.rawPath.replace(`${ROOT}/`, ""));
    const cardRel = rel("wiki/review/ingest-coverage", row.cardPath.replace(`${ROOT}/`, ""));
    const dest = row.destinations.map((d) => d.replace(/^wiki\//, "")).join(", ");
    lines.push(
      `| ${idx + 1} | ${row.vendor} | [${row.title.replace(/\|/g, "\\|")}](${rawRel}) | [card](${cardRel}) | ${dest} | 进入 E1-E9 写作时按章节复核 |`,
    );
  });
  if (failures.length) {
    lines.push("", "## 3. 抓取失败", "", "| 来源 | URL | 错误 |", "|---|---|---|");
    for (const f of failures) lines.push(`| ${f.vendor} | ${f.url} | ${f.error.replace(/\|/g, "\\|")} |`);
  }
  lines.push(
    "",
    "## 4. 涟漪检查",
    "",
    "| 位置 | 状态 | 说明 |",
    "|---|---|---|",
    "| `wiki/raw/official-posts/` | 已新增 | 官方原文入库 |",
    "| `wiki/review/source-cards/official-posts/` | 已新增 | 每篇文章一张卡 |",
    "| `wiki/entities/cursor.md` | 待/已更新 | 承接 Cursor 官方机制 |",
    "| `wiki/entities/claude-code.md` | 待/已更新 | 补强 Claude 官方机制 |",
    "| `wiki/topics/agent-evaluation-system.md` | 待/已更新 | 承接评测、Bugbot、CursorBench、Code Review |",
    "| `wiki/index.md` | 待/已更新 | 增加官方文章账本和新页面入口 |",
  );
  writeFileSync(COVERAGE_PATH, `${lines.join("\n")}\n`, "utf-8");
}

const seen = new Set();
const queue = POSTS.filter(([vendor, url]) => {
  const key = `${vendor}:${url}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const rows = [];
const failures = [];
for (let i = 0; i < queue.length; i++) {
  const [vendor, url] = queue[i];
  process.stdout.write(`[${i + 1}/${queue.length}] ${vendor} ${url} ... `);
  try {
    const data = await fetchPost(vendor, url);
    const post = { vendor, url, ...data };
    const rawPath = writeRaw(post);
    const dests = destinations(vendor, post.title, url, post.body);
    const cardPath = writeCard(post, rawPath, dests);
    rows.push({ ...post, rawPath, cardPath, destinations: dests });
    console.log(`ok (${post.body.length} chars)`);
  } catch (err) {
    failures.push({ vendor, url, error: err.message });
    console.log(`failed: ${err.message}`);
  }
}

writeIndexes(rows);
writeCoverage(rows, failures);

console.log(`\nDone. success=${rows.length}, failures=${failures.length}`);
console.log(`Coverage: ${COVERAGE_PATH}`);
