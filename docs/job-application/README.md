# DeepSeek Agent Harness PM 应聘材料

> **作者:** zhouhao · **日期:** 2026-05-24 · **目标岗位:** DeepSeek Agent Harness 产品经理

本目录是 6 篇按 JD 关键词组织的 PM 作品集报告。每篇基于 26 个 AI Agent 产品（14 通用 + 12 编码）真实抽取的能力维度数据，对头部 3 家产品（Claude Code / Cursor / Codex）做横向对比，并给出 DeepSeek Harness 团队的产品决策建议。

## 报告索引

| # | 主题 | JD 关键词 | 报告 | Deck |
|---|---|---|---|---|
| 1 | Harness 设计模式比较 | Harness Engineering | [report.md](../../wiki/reports/portfolio/harness-design/report.md) | [deck.marp.md](../../wiki/reports/portfolio/harness-design/deck.marp.md) |
| 2 | Context Engineering 横评 | Context Engineering | [report.md](../../wiki/reports/portfolio/context-engineering/report.md) | [deck.marp.md](../../wiki/reports/portfolio/context-engineering/deck.marp.md) |
| 3 | 工具与扩展生态 | Tool Use / MCP / Subagent | [report.md](../../wiki/reports/portfolio/tool-ecosystem/report.md) | [deck.marp.md](../../wiki/reports/portfolio/tool-ecosystem/deck.marp.md) |
| 4 | KV / Prompt Cache 优化策略 | KV Cache / Prompt Cache | [report.md](../../wiki/reports/portfolio/cache-strategy/report.md) | [deck.marp.md](../../wiki/reports/portfolio/cache-strategy/deck.marp.md) |
| 5 | 用户社群与开源策略 | 用户社群 / 开源社区 | [report.md](../../wiki/reports/portfolio/open-source/report.md) | [deck.marp.md](../../wiki/reports/portfolio/open-source/deck.marp.md) |
| 6 | 模型与 Harness 共同进化 | 模型与 Harness 共同进化 | [report.md](../../wiki/reports/portfolio/co-evolution/report.md) | [deck.marp.md](../../wiki/reports/portfolio/co-evolution/deck.marp.md) |

## 方法论

每篇报告由 4 步管线产出：

1. **数据层** — `wiki/compiled/{product}/_provenance.json` 存储每个产品在 17 个维度（E1/E4/E5/E6/F1/F3/J5/N1-5/M1-5）上的抽取值、置信度、证据 URL。
2. **主题层** — `packages/competitive_analysis/portfolio/theme.py` 定义 6 个 JD 对齐主题，每主题绑定一组维度子集 + 专属系统 prompt。
3. **生成层** — `PortfolioReportEngine.generate()` 把 wiki 事实 + 主题 outline 注入 prompt，调用 `claude -p` 一次性产出 1500-3000 字长文。
4. **渲染层** — `render/portfolio_md_renderer.py` 输出 Markdown，`render/portfolio_pptx_renderer.py` 输出 DeepSeek 风 Marp Deck（蓝绿色 #0A6E6F + 极简留白 + 16:9 横排）。

## 把 Marp deck 转成 PPTX

```bash
# 安装 marp-cli (可选,用于生成真实 .pptx)
npm install -g @marp-team/marp-cli

# 单篇导出
marp wiki/reports/portfolio/harness-design/deck.marp.md --pptx -o docs/job-application/01-harness-design.pptx

# 批量导出 6 篇
for theme in harness-design context-engineering tool-ecosystem cache-strategy open-source co-evolution; do
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

# 种子数据 (3 P0 产品 × 17 维度)
.venv/bin/python scripts/seed_phase4_dims.py

# 一次性生成 6 篇 (~12-15 分钟真 LLM 调用)
uv run wiki portfolio --all --products claude-code,cursor,codex
```

## 数据局限性 (诚实声明)

- **样本量**: 当前只对 3 个 P0 产品（claude-code / cursor / codex）做了维度抽取。剩余 23 个产品（hermes / manus / 通用 Agent 等）留给 Phase 5 扩展。
- **维度库**: 当前 17 维（E + F + J + N + M 5 组）覆盖了 JD 6 个关键词。完整 67 维 14 组规划见 spec §6.2。
- **置信度**: 所有数据带 `confidence` 字段（VERIFIED / EXTRACTED / INFERRED / UNVERIFIED），证据 URL 全部公开可查。无营销话术。

## 我做了什么

**这个项目本身就是这次应聘最重要的展示**：

- 用 5 天时间从 0 搭建了一条 Karpathy LLM Wiki 风格的 26 产品知识管线
- Path A（首次同步）+ Path B（每日增量 + 飞书推送）+ Path C（按需对比）+ Path D（PM 作品集长文）四条数据通路
- 168 个测试覆盖 schema / adapter / engine / renderer 全链路
- 100% 真实 LLM 调用产出（无任何 hardcoded 段落）

代码与方法论开源: `<repo url>`

—— zhouhao
