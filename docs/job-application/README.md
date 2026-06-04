# DeepSeek Agent Harness PM 应聘材料

> **作者:** zhouhao · **日期:** 2026-05-24 · **目标岗位:** DeepSeek Agent Harness 产品经理

本目录是 7 篇按 JD 关键词组织的 PM 作品集报告。前 6 篇基于 26 个 AI Agent 产品(14 通用 + 12 编码)真实抽取的能力维度数据,对头部 5 家产品 (Claude Code / Cursor / Codex / Hermes / Manus) 做横向对比。**第 7 篇是战略备忘录**,在前 6 篇之上做 meta 视角的市场战略分析,引入 63 篇中文社区一手语料 (2026 Q1)。

每篇都给出 DeepSeek Harness 团队的具体产品决策建议。

## 报告索引

| # | 主题 | JD 关键词 | 报告 | Deck |
|---|---|---|---|---|
| 1 | Harness 设计模式比较 | Harness Engineering | [report.md](../../wiki/reports/portfolio/harness-design/report.md) | [deck.marp.md](../../wiki/reports/portfolio/harness-design/deck.marp.md) |
| 2 | Context Engineering 横评 | Context Engineering | [report.md](../../wiki/reports/portfolio/context-engineering/report.md) | [deck.marp.md](../../wiki/reports/portfolio/context-engineering/deck.marp.md) |
| 3 | 工具与扩展生态 | Tool Use / MCP / Subagent | [report.md](../../wiki/reports/portfolio/tool-ecosystem/report.md) | [deck.marp.md](../../wiki/reports/portfolio/tool-ecosystem/deck.marp.md) |
| 4 | KV / Prompt Cache 优化策略 | KV Cache / Prompt Cache | [report.md](../../wiki/reports/portfolio/cache-strategy/report.md) | [deck.marp.md](../../wiki/reports/portfolio/cache-strategy/deck.marp.md) |
| 5 | 用户社群与开源策略 | 用户社群 / 开源社区 | [report.md](../../wiki/reports/portfolio/open-source/report.md) | [deck.marp.md](../../wiki/reports/portfolio/open-source/deck.marp.md) |
| 6 | 模型与 Harness 共同进化 | 模型与 Harness 共同进化 | [report.md](../../wiki/reports/portfolio/co-evolution/report.md) | [deck.marp.md](../../wiki/reports/portfolio/co-evolution/deck.marp.md) |
| **7** | **战略备忘录:中文社区与硅谷的隐性分歧** | **跨市场战略 / 产品定位** | [report.md](../../wiki/reports/portfolio/community-divergence/report.md) | [deck.marp.md](../../wiki/reports/portfolio/community-divergence/deck.marp.md) |

**前 6 篇 vs 第 7 篇:**

- 前 6 篇是 *micro 视角* — 5 个产品 × 17 个维度的横评,展示"产品分析能力"
- 第 7 篇是 *meta 视角* — 中文社区 63 篇 vs 硅谷一手文档的话语对比,展示"战略洞察能力"
- 第 7 篇 §8 与前 6 篇逐一对应,前 6 篇的尾部新增"附录 A:中文社区数据校验"(2026-05-24 增补)

## 方法论

整套作品集由 5 步管线产出:

1. **英文产品数据层** — `wiki/compiled/{product}/_provenance.json` 存储每个产品在 17 个维度 (E1/E4/E5/E6/F1/F3/J5/N1-5/M1-5) 上的抽取值、置信度、证据 URL
2. **中文社区原料层** — `wiki/raw/harness-engineering/` 存储 63 篇中文社区文章正文 + frontmatter (含 url/host/source/category)。抓取栈:`wechat-article-extractor` 主路径 + `Scrapling stealthy-fetch` 兜底反爬
3. **分析层** — `wiki/analysis/{term-frequency,entity-scan,harness-collection-insights}.md` 用 jieba + 自定义 200+ 领域词典做词频,用 `re.compile(IGNORECASE)` 做 73 个核心实体精准 TF/DF 扫描
4. **生成层** — `PortfolioReportEngine.generate()` 把英文 wiki 事实 + 中文社区数据 + 主题 outline 注入 prompt,调用 `claude -p` 一次性产出 1500-3500 字长文
5. **渲染层** — Markdown + DeepSeek 风 Marp Deck (蓝绿色 #0A6E6F + 极简留白 + 16:9 横排)

## 数据规模 (2026-05-24)

| 数据维度 | 数量 |
|---|---|
| 英文产品 × 维度 | 5 产品 × 17 维 = 85 数据点 |
| 中文社区文章 | 63 篇 / 2.06 MB / 52 公众号 + 6 个站点 |
| 实体精准扫描 | 73 个核心实体 × TF/DF/分类分布 |
| 报告产出 | 7 篇 ~1900 行 + 7 个 Marp deck |
| 复现脚本 | 4 个 (entity_scan / analyze / ingest / seed) |

## 把 Marp deck 转成 PPTX

```bash
# 安装 marp-cli (可选,用于生成真实 .pptx)
npm install -g @marp-team/marp-cli

# 单篇导出
marp wiki/reports/portfolio/community-divergence/deck.marp.md --pptx \
  -o docs/job-application/07-community-divergence.pptx

# 批量导出 7 篇
for theme in harness-design context-engineering tool-ecosystem \
             cache-strategy open-source co-evolution community-divergence; do
  marp "wiki/reports/portfolio/${theme}/deck.marp.md" --pptx \
    -o "docs/job-application/${theme}.pptx"
done
```

## 复现整套报告

```bash
git clone <repo>
cd ai-agent-competitive-analysis
uv sync --all-extras
uv run wiki init

# 1) 英文产品 17 维数据
.venv/bin/python scripts/seed_phase4_dims.py
.venv/bin/python scripts/seed_phase5_hermes_manus.py

# 2) 中文社区 63 篇入库 (含 Scrapling 兜底)
node scripts/ingest_harness_collection.mjs all

# 3) 词频 + 实体扫描
.venv/bin/python scripts/analyze_harness_collection.py
.venv/bin/python scripts/entity_scan.py

# 4) 一次性生成前 6 篇 (~12-15 分钟真 LLM 调用)
uv run wiki portfolio --all --products claude-code,cursor,codex,hermes,manus

# 5) 第 7 篇战略备忘录 (基于前 6 篇 + 中文社区数据手写,见 community-divergence/)
```

## 数据局限性 (诚实声明)

- **英文样本量**:5 个产品 (Claude Code / Cursor / Codex / Hermes / Manus) 已完成 17 维抽取。剩余 21 个产品留给 Phase 5+ 扩展
- **中文样本来源**:63 篇基于飞书《harness合集 Holly 的收藏夹》单一二级源,可能反映该收藏者的视角偏差;但已覆盖 52 个公众号,DF/TF 跨账号去重后仍有统计意义
- **维度库**:当前 17 维 (E + F + J + N + M 5 组) 覆盖 JD 6 个关键词。完整 67 维 14 组规划见 spec §6.2
- **置信度**:所有英文数据带 `confidence` 字段 (VERIFIED / EXTRACTED / INFERRED / UNVERIFIED),证据 URL 全部公开可查。中文数据带 `source` 字段 (wechat / scrapling-{tool})。无营销话术

## 我做了什么

**这个项目本身就是这次应聘最重要的展示:**

- 用 5 天时间从 0 搭建了一条 Karpathy LLM Wiki 风格的 26 产品知识管线
- Path A (首次同步) + Path B (每日增量 + 飞书推送) + Path C (按需对比) + Path D (PM 作品集长文) + **Path E (中文社区一手语料 + 跨市场战略分析)** 五条数据通路
- 168 个测试覆盖 schema / adapter / engine / renderer 全链路
- 100% 真实 LLM 调用产出 (无任何 hardcoded 段落)
- 微信公众号反爬 + 知乎反爬 + 阿里云 SPA 三种抓取栈在同一脚本里 fallback,63/63 全量入库

**这套体系展示的 PM 能力:**

| 维度 | 在哪体现 |
|---|---|
| 跨市场洞察 | 第 7 篇战略备忘录的中英文实体声量对比 |
| 数据驱动决策 | 全部 7 篇用 TF/DF/置信度数字背书,无主观判断 |
| 战略权衡能力 | 第 7 篇给 DeepSeek 三个产品定位选项 + 资源分配比例 |
| 工程化能力 | 5 步管线 + 168 测试 + 4 个复现脚本 |
| 一手原料获取 | 飞书 + 微信 + 知乎反爬抓取栈,无依赖三方数据集 |

代码与方法论开源: `<repo url>`

—— zhouhao
