#!/usr/bin/env node
// Harness 合集批量入库脚本
//
// 用法:
//   node scripts/ingest_harness_collection.mjs <batch_key>
//   node scripts/ingest_harness_collection.mjs all
//
// batch_key: 1_概念入门 / 2_深度解析 / 3_实战案例 / 4_特定框架 / 5_面试_岗位 / 6_概念对比 / 7_行业趋势 / all
//
// 读取 /tmp/harness-batches.json,按批次抽取并保存到
// wiki/raw/harness-engineering/<batch_dir>/<idx>-<slug>.md

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = dirname(dirname(__filename));
const BATCHES_FILE = "/tmp/harness-batches.json";
const OUTPUT_BASE = join(PROJECT_ROOT, "wiki", "raw", "harness-engineering");
const EXTRACTOR_PATH =
  "/Users/zhouhao/xiaoai-agentic-flow/skills/wechat-article-extractor-skill/scripts/extract.js";
const SCRAPLING_BIN = "/Users/zhouhao/.local/bin/scrapling";

const { extract } = await import(EXTRACTOR_PATH);

// host → { tool: get|fetch|stealthy-fetch, selector: string|null }
// 默认: get + null(全文,--ai-targeted 已过滤大部分导航)
// SPA/反爬站点用 fetch/stealthy-fetch
const HOST_CONFIG = {
  "developer.aliyun.com": { tool: "fetch", selector: ".article-content" },
  "www.alibabacloud.com": { tool: "fetch", selector: null },
  "alibabacloud.com": { tool: "fetch", selector: null },
  "www.toutiao.com": { tool: "fetch", selector: ".article-content" },
  "zhuanlan.zhihu.com": { tool: "stealthy-fetch", selector: ".Post-RichTextContainer, .RichText" },
  "www.zhihu.com": { tool: "stealthy-fetch", selector: ".Post-RichTextContainer, .RichText" },
};

const fetchWithScrapling = (url) => {
  const host = new URL(url).host;
  const cfg = HOST_CONFIG[host] ?? { tool: "get", selector: null };
  const tmpFile = join(tmpdir(), `scrap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.md`);
  const args = ["extract", cfg.tool, url, tmpFile, "--ai-targeted", "--timeout"];
  args.push(cfg.tool === "get" ? "30" : "60000");
  if (cfg.tool !== "get") args.push("--network-idle");
  if (cfg.selector) args.push("-s", cfg.selector);

  const proc = spawnSync(SCRAPLING_BIN, args, {
    encoding: "utf-8",
    timeout: 180000,
  });
  if (proc.status !== 0 || !existsSync(tmpFile)) {
    return { ok: false, error: `scrapling ${cfg.tool} exit=${proc.status}: ${(proc.stderr || "").slice(0, 200)}` };
  }
  const content = readFileSync(tmpFile, "utf-8");
  try {
    unlinkSync(tmpFile);
  } catch {}
  if (content.trim().length < 200) {
    return { ok: false, error: `content too short (${content.length} chars), selector may be wrong` };
  }
  return { ok: true, content, selector: cfg.selector ?? "(full)", tool: cfg.tool };
};

// ─── helpers ────────────────────────────────────────────────────
const slugify = (s, maxLen = 40) =>
  s
    .replace(/[\s　]+/g, "-")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/[^\w一-鿿-]/g, "")
    .slice(0, maxLen) || "untitled";

const htmlToMarkdown = (html) => {
  if (!html) return "";
  return html
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
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
    .replace(/<img[^>]*data-src="([^"]+)"[^>]*>/gi, "![image]($1)")
    .replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, "![image]($1)")
    .replace(/<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, "[$2]($1)")
    .replace(/<\/?(span|section|div|figure|figcaption|blockquote)[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const fetchedAt = new Date().toISOString();

const writeArticle = (batchDir, idx, item, data) => {
  const title = data.msg_title || item.title || "untitled";
  const slug = slugify(title);
  const filePath = join(
    OUTPUT_BASE,
    batchDir,
    `${String(idx).padStart(3, "0")}-${slug}.md`
  );
  mkdirSync(dirname(filePath), { recursive: true });

  const frontmatter = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    `url: ${item.url}`,
    `author: "${(data.msg_author || "").replace(/"/g, '\\"')}"`,
    `account: "${(data.account_name || "").replace(/"/g, '\\"')}"`,
    `publish_time: "${data.msg_publish_time_str || ""}"`,
    `fetched_at: "${fetchedAt}"`,
    `cover: ${data.msg_cover || ""}`,
    `article_type: ${data.msg_article_type || ""}`,
    `source: ${data.source || "wechat"}`,
    `category: ${batchDir}`,
    "---",
    "",
  ].join("\n");

  const body = htmlToMarkdown(data.msg_content || "");
  writeFileSync(filePath, frontmatter + body + "\n", "utf-8");
  return filePath;
};

const writeNonWechat = (batchDir, idx, item, content, selector, tool) => {
  const title = item.title || "untitled";
  const slug = slugify(title);
  const filePath = join(
    OUTPUT_BASE,
    batchDir,
    `${String(idx).padStart(3, "0")}-${slug}.md`
  );
  mkdirSync(dirname(filePath), { recursive: true });
  const host = new URL(item.url).host;
  const frontmatter = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    `url: ${item.url}`,
    `host: ${host}`,
    `selector: "${selector}"`,
    `fetched_at: "${fetchedAt}"`,
    `source: "scrapling-${tool}"`,
    `category: ${batchDir}`,
    "---",
    "",
  ].join("\n");
  writeFileSync(filePath, frontmatter + content + "\n", "utf-8");
  return filePath;
};

const writeIndex = (batchDir, articles) => {
  const lines = [
    `# ${batchDir}`,
    "",
    `共 ${articles.length} 篇,抓取时间 ${fetchedAt}`,
    "",
    "| # | 标题 | 公众号/作者 | 发布时间 | 文件 |",
    "|---|---|---|---|---|",
  ];
  for (const a of articles) {
    if (a.error) {
      lines.push(
        `| ${a.idx} | ${a.title} | ❌ 抓取失败 | - | \`${a.error}\` |`
      );
      continue;
    }
    const fileName = a.path.split("/").pop();
    lines.push(
      `| ${a.idx} | [${a.title.replace(/\|/g, "\\|")}](${fileName}) | ${a.account || a.author || "-"} | ${a.publish_time || "-"} | \`${fileName}\` |`
    );
  }
  const indexPath = join(OUTPUT_BASE, batchDir, "INDEX.md");
  writeFileSync(indexPath, lines.join("\n") + "\n", "utf-8");
  return indexPath;
};

const isWechat = (url) => url.includes("mp.weixin.qq.com");

// ─── main ───────────────────────────────────────────────────────
const batchKey = process.argv[2];
if (!batchKey) {
  console.error("Usage: node ingest_harness_collection.mjs <batch_key|all>");
  process.exit(1);
}

const batches = JSON.parse(readFileSync(BATCHES_FILE, "utf-8"));
const targetKeys = batchKey === "all" ? Object.keys(batches) : [batchKey];

for (const key of targetKeys) {
  if (!batches[key]) {
    console.error(`Unknown batch: ${key}. Available: ${Object.keys(batches).join(", ")}`);
    process.exit(1);
  }
  const items = batches[key];
  console.log(`\n=== Batch: ${key} (${items.length} articles) ===`);

  const results = [];
  let idx = 0;
  for (const item of items) {
    idx += 1;
    const tag = `[${key} ${idx}/${items.length}]`;

    // 跳过已存在文件 — 支持增量补抓
    const existingPattern = `${String(idx).padStart(3, "0")}-`;
    const batchDir = join(OUTPUT_BASE, key);
    if (existsSync(batchDir)) {
      const { readdirSync } = await import("node:fs");
      const existing = readdirSync(batchDir).find((f) => f.startsWith(existingPattern));
      if (existing) {
        console.log(`${tag} SKIP exists: ${existing}`);
        results.push({ idx, title: item.title, path: join(batchDir, existing), skipped: true });
        continue;
      }
    }

    if (!isWechat(item.url)) {
      // 非 WX 走 scrapling
      console.log(`${tag} scrapling fetch ${new URL(item.url).host}`);
      const r = fetchWithScrapling(item.url);
      if (!r.ok) {
        console.log(`${tag} FAIL scrapling: ${r.error}`);
        results.push({ idx, title: item.title, error: r.error });
        continue;
      }
      const path = writeNonWechat(key, idx, item, r.content, r.selector, r.tool);
      const rel = path.replace(PROJECT_ROOT + "/", "");
      console.log(`${tag} OK ${rel} (${r.tool}, ${r.content.length} chars, sel=${r.selector})`);
      results.push({ idx, title: item.title, account: new URL(item.url).host, path });
      continue;
    }

    // WX 路径,失败重试 1 次
    let r = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        r = await extract(item.url, { shouldReturnContent: true });
        if (r.code === 0 && r.data && (r.data.msg_content || "").length > 0) break;
        console.log(`${tag} attempt ${attempt} code=${r.code} msg=${r.msg || "?"}`);
      } catch (e) {
        console.log(`${tag} attempt ${attempt} ERR ${e.message}`);
        r = { code: -1, msg: e.message };
      }
      if (attempt === 1) await new Promise((res) => setTimeout(res, 2000));
    }
    if (!r || r.code !== 0 || !r.data) {
      // WX extractor 失败 → 用 scrapling stealthy-fetch 兜底
      console.log(`${tag} extractor failed, fallback to scrapling stealthy-fetch`);
      const tmpFile = join(tmpdir(), `wx-stealth-${Date.now()}.md`);
      const proc = spawnSync(
        SCRAPLING_BIN,
        [
          "extract", "stealthy-fetch", item.url, tmpFile,
          "--ai-targeted", "--network-idle",
          "-s", "#js_content, .rich_media_content",
          "--timeout", "60000",
        ],
        { encoding: "utf-8", timeout: 180000 }
      );
      if (proc.status === 0 && existsSync(tmpFile)) {
        const content = readFileSync(tmpFile, "utf-8");
        try { unlinkSync(tmpFile); } catch {}
        if (content.trim().length >= 200) {
          const path = writeNonWechat(key, idx, item, content, "#js_content", "stealthy-fetch");
          const rel = path.replace(PROJECT_ROOT + "/", "");
          console.log(`${tag} OK ${rel} (stealthy-fetch fallback, ${content.length} chars)`);
          results.push({ idx, title: item.title, account: "wechat (stealthy)", path });
          continue;
        }
      }
      console.log(`${tag} FAIL after retry+fallback: ${r?.msg || "unknown"}`);
      results.push({ idx, title: item.title, error: r?.msg || `code=${r?.code}` });
      continue;
    }
    const path = writeArticle(key, idx, item, r.data);
    const rel = path.replace(PROJECT_ROOT + "/", "");
    console.log(`${tag} OK ${rel}`);
    results.push({
      idx,
      title: r.data.msg_title || item.title,
      author: r.data.msg_author,
      account: r.data.account_name,
      publish_time: r.data.msg_publish_time_str,
      path,
    });
  }

  const indexPath = writeIndex(key, results);
  const okCount = results.filter((r) => !r.error).length;
  const newCount = results.filter((r) => !r.error && !r.skipped).length;
  console.log(
    `\n→ ${okCount}/${items.length} OK (${newCount} new) + ${indexPath.replace(PROJECT_ROOT + "/", "")}`
  );
}
