---
id: coverage-agentway-harness-books
type: ingest-coverage
status: triaged
updated: 2026-05-26
scope: "AGENTWAY Harness Books 两本 PDF 入库与 wiki 沉淀"
---

# 入库覆盖账本 · AGENTWAY Harness Books

## 1. 总览

- 用户提供 PDF: **2 本** (book1-claude-code.pdf 88 页 / book2-comparing.pdf 54 页, 共 142 页)
- 成功入库: **2 本**
- 抓取失败: **0 本**
- 当前状态: **triaged**。本轮完成 PDF 转 Markdown、单本卡、合集 topic、对 Harness/对比页/index/log 的补强。

## 2. 逐本覆盖表

| # | 书名 | 来源 | 页数 | 文件 | source-card | 当前去向 |
|---:|---|---|---:|---|---|---|
| 1 | [Claude Code 设计指南: Harness Engineering](../../raw/books/agentway/2026-04-01-agentway-claude-code-harness-engineering-design-guide.md) | agentway.dev | 88 | `book1-claude-code.pdf` | [card](../source-cards/books/agentway-book1-claude-code-design-guide.md) | 已沉淀 |
| 2 | [Claude Code 和 Codex 的 Harness 设计哲学: 殊途同归,还是各表一枝](../../raw/books/agentway/2026-04-01-agentway-claude-code-vs-codex-comparative-harness-notes.md) | agentway.dev | 54 | `book2-comparing.pdf` | [card](../source-cards/books/agentway-book2-claude-code-vs-codex.md) | 已沉淀 |

## 3. 涟漪检查

| 位置 | 状态 | 说明 |
|---|---|---|
| `wiki/raw/books/agentway/` | 已新增 | 2 本 PDF 转出的 Markdown + INDEX |
| `wiki/review/source-cards/books/` | 已新增 | 2 张单本卡 (含章节速览) |
| `wiki/topics/agentway-harness-books.md` | 已新增 | 合集 topic, 含 Harness 十条原则 + Claude Code vs Codex 五条比较轴矩阵 + 三种团队起手方向 |
| `wiki/concepts/harness-engineering.md` | 已更新 | 把"高阶层 = AGENTWAY 十条原则"作为概念页骨架, 补来源映射 |
| `wiki/comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md` | 已更新 | 新增"AGENTWAY 比较书视角的补强": 运行时优先 vs 制度层优先两条路线 |
| `wiki/index.md` | 已更新 | 新增 topic 入口与本批账本入口 |
| `wiki/log.md` | 已更新 | 追加本批入库记录 |

## 4. PDF 处理元数据

- 工具: `uv pip install pypdf` + `PdfReader.extract_text()`
- 每页提取后做了空白整理与去重换行,并以 `## p.{N}` 分页标记保留页码,便于后续按页定位
