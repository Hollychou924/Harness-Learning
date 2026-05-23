# AI Agent 竞品分析工作流 — 设计文档

**版本**: v0.1 (brainstorming output)
**日期**: 2026-05-23
**作者**: zhouhao
**状态**: 设计稿 — 待评审

---

## 1. 项目背景与目标

### 1.1 双重目标

本项目同时服务两个目标，且二者互不冲突：

1. **团队竞品监控** (主要功能场景)
   - 对 26 个 AI Agent 产品 (14 通用 + 12 编码) 做持续监控
   - 每日捕获关键变更，每周做完整文档同步，按需生成对比分析报告
   - 多人协作消费，飞书前台分发

2. **Agent Harness PM 作品集** (战略目标)
   - 应聘 DeepSeek "Agent Harness 产品经理" 岗位
   - 工作流的产出物 (6 篇专题报告) 即简历的支撑材料
   - 每个 JD 关键词 → 对应一份独立报告

### 1.2 灵感来源

设计参考 2026 阿里云峰会 Qoder 团队公开的 4 模块 + 3 路径数据管道架构：
- 模块: `llm-wiki` · `docs-link-collector` · `ai-coding-research` · `competitive-analysis`
- 路径: A 文档同步链 · B Changelog 增量链 · C Wiki-first 查询链

但本项目相比原方案有 3 处关键差异化：
1. **覆盖产品数量约 3 倍**(9 → 26)，且涵盖闭源/小众桌面客户端
2. **双类目维度库**(通用 Agent + 编码 Agent)，权重经 JD 校准
3. **数据源从 1 类扩到 4 层**(原仅官方文档)

---

## 2. 范围与边界

### 2.1 监控产品清单

#### 通用 Agent (14 个)

| 优先级 | 产品 | 备注 |
|---|---|---|
| **P0** | Claude Desktop (Cowork mode) | 主基准 |
| **P0** | Codex Desktop | JD 提名 |
| **P0** | Manus (My Computer) | JD 提名 |
| **P0** | OpenClaw | JD 提名 |
| **P0** | Hermes (Nous Research) | JD 提名，开源标杆 |
| **P0** | QoderWork | 用户重点 |
| **P0** | Marvis | 用户重点 |
| P2 | Trae solo | 长尾 |
| P2 | WorkBuddy | 长尾 |
| P2 | Miclaw PC | 长尾 |
| P2 | LobsterAI | 长尾 |
| P2 | AutoClaw | 长尾 |
| P2 | EasyClaw | 长尾 |
| P2 | Open Interpreter | 长尾 |
| P2 | Opencode | 长尾 |
| P2 | Perplexity Computer | 长尾 |

#### 编码 Agent (12 个)

| 优先级 | 产品 | 备注 |
|---|---|---|
| **P0** | Claude Code | 主基准 |
| **P0** | Cursor | 副基准 |
| **P0** | Codex | JD 提名 |
| **P0** | OpenCode | JD 提名 |
| **P0** | GitHub Copilot | JD 提名 |
| P1 | Trae | 用户重点 |
| P1 | antigravity (Google) | 用户重点 |
| P1 | QoderWork | 用户重点 |
| P2 | Cline | 长尾 |
| P2 | Windsurf | 长尾 |
| P2 | Devin | 长尾 |
| P2 | Aider | 长尾 |
| P2 | CodeBuddy | 长尾 |
| P2 | 文心快码 | 长尾 |

> 注：Claude / Codex / QoderWork 跨类目存在，使用同一份原始数据，渲染时多视角生成。

### 2.2 显式不做的事 (out of scope)

- ❌ 不做付费用户量级、ARR 等商业敏感数据 (无可信源，且非 PM 维度)
- ❌ 不做产品代码逆向、网络抓包等灰色操作
- ❌ 不做实时 (sub-minute) 监控，最快粒度为日级
- ❌ 不构建对外 SaaS / API，仅服务团队内部
- ❌ 不做翻译，原文优先

---

## 3. 高层架构

### 3.1 模块划分

```
┌────────────────────────────────────────────────────────────────┐
│                  ai-agent-competitive-analysis                  │
└────────────────────────────────────────────────────────────────┘
        │
        ├── packages/
        │   │
        │   ├── llm_wiki/                  # 知识中枢
        │   │   • 三层结构: raw / compiled / schema
        │   │   • 一次编译,多次取用
        │   │
        │   ├── docs_link_collector/       # 文档雷达
        │   │   • 抓导航树 → 标准化链接表
        │   │   • 检测文档站变化,批量增量入库
        │   │
        │   ├── ai_agent_research/         # 动态追踪器(原 ai-coding-research)
        │   │   • 监听 Layer 1 信号 → 生成增量报告
        │   │   • 自动 Ingest 到 wiki
        │   │
        │   └── competitive_analysis/      # 对比输出引擎
        │       • Wiki-first 查询
        │       • 30+ 维度生成对比矩阵
        │       • 渲染 Markdown / HTML / PPTX
        │
        ├── adapters/                      # 数据源适配器(每层一个)
        │   ├── layer0_official/
        │   ├── layer1_radar/
        │   ├── layer2_search/
        │   └── layer3_community/
        │
        └── render/                        # 输出渲染
            ├── md/  · html/  · pptx/  · feishu/
```

### 3.2 三条路径

| 路径 | 频率 | 用途 | 调用顺序 |
|---|---|---|---|
| **Path A** 文档同步链 | 每周 (周日) | 求"全",月度全量基线 | L0 → llm-wiki |
| **Path B** Changelog 增量链 | 每日 (UTC 00:00) | 求"新",捕获重要变更 | L1 触发 → L0 抓详 → L2 兜底 |
| **Path C** Wiki-first 查询链 | 按需触发 | 求"可靠",生成对比报告 | Wiki → L0 → L2 → L3 |

---

## 4. 数据源层 (4 层架构)

### Layer 0 — 一手官方源

| 源 | 工具 | 用途 |
|---|---|---|
| 官网 / 文档站 | `docs-link-collector` + sitemap | 抓导航树 |
| 博客 / 发布说明 RSS | `feedparser` | 订阅式监听 |
| GitHub Releases | `gh api repos/<o>/<r>/releases` | 开源类产品 |
| 公开 changelog 站 | `httpx` + LLM 抽取 | 通用 |

### Layer 1 — 行业资讯/动态层 (关键词驱动)

| 源 | 接入方式 | 用途 |
|---|---|---|
| **AIHOT** | `~/.claude/skills/aihot` 已装 | AI 行业精选 + 日报 |
| **TrendRadar** | GitHub Actions Fork (已选 1A 独立部署) | 微博/知乎/B站社媒热搜 |
| **wechat-article-search** | Node 脚本 subprocess | 搜狗微信文章 (实测能用) |

### Layer 2 — 通用搜索/补全层 (Path C 兜底)

| 源 | 接入方式 | 用途 |
|---|---|---|
| **multi-search-engine** | `~/.claude/skills/multi-search-engine` 已装 | 16 引擎 SERP |
| WebFetch / curl | 内置 | 拿到 SERP 链接后实时抓单页 |

### Layer 3 — 社区/评测层 (主观信号)

| 源 | 接入方式 | 用途 |
|---|---|---|
| GitHub Issues/Discussions/Stars | `gh api` | 开源类产品 |
| **wechat-articles** read.py | Python subprocess (按需) | 单篇微信长文全文提取 |
| TrendRadar 二次过滤 | 同 L1 | 知乎/B站测评视频 |
| HN / Reddit | `multi-search-engine` 站内检索 | 海外社区 |

---

## 5. 知识库 Schema (llm-wiki 三层结构)

### 5.1 目录结构

```
wiki/
├── raw/                    # 原始抓取 (Markdown / HTML / JSON)
│   └── {product_id}/
│       ├── {YYYY-MM-DD}/
│       │   ├── homepage.html
│       │   ├── docs/<page>.md
│       │   ├── changelog/<release>.md
│       │   └── _meta.json    # 抓取元信息(URL/timestamp/hash)
│
├── compiled/              # LLM 编译入 wiki (符合 SCHEMA)
│   └── {product_id}/
│       ├── overview.md
│       ├── dimensions/
│       │   ├── execution.md
│       │   ├── context.md
│       │   └── ...
│       ├── changelog.md
│       └── _provenance.json  # 每个字段的来源可追溯
│
├── schema/                # SCHEMA 约定 (Pydantic + YAML)
│   ├── product.yaml
│   ├── dimension.yaml
│   ├── general-agent-dims.yaml
│   ├── coding-agent-dims.yaml
│   └── common-dims.yaml
│
└── reports/               # 历次报告归档
    ├── daily/
    ├── weekly/
    └── on-demand/
```

### 5.2 Schema 示例 (Pydantic)

```python
class Product(BaseModel):
    id: str                              # "claude-code"
    name: str                            # "Claude Code"
    category: Literal["general", "coding"]
    priority: Literal["P0", "P1", "P2"]
    is_baseline: bool = False
    homepage: HttpUrl
    docs_root: HttpUrl | None
    changelog_url: HttpUrl | None
    rss_feed: HttpUrl | None
    github_repo: str | None              # "owner/repo"
    keywords: list[str]                  # 用于 L1 雷达搜索

class Dimension(BaseModel):
    id: str                              # "E5"
    name: str                            # "自定义工具/Hook 系统"
    group: str                           # "Agent 执行能力"
    importance: Literal["critical", "high", "medium", "low"]
    weight_in_group_pct: float           # 组内权重 (0-100)
    evaluation_type: Literal["enum", "numeric", "score_0_3", "text", "multi_select"]
    enum_values: list[str] | None = None
    rubric: str                          # 打分细则
    data_sources: list[str]              # ["L0:official_docs", "L2:search"]

class ProductEvaluation(BaseModel):
    product_id: str
    dimension_id: str
    value: str | float | int | list[str]
    evidence_urls: list[HttpUrl]         # 可追溯
    evaluator: str                       # "llm:claude-opus-4-7" or "human:zhouhao"
    confidence: float                    # 0-1
    last_verified: datetime
```

---

## 6. 维度库 (双类目 + 公共)

### 6.1 通用 Agent (47 维 / 10 组)

| 组 | 权重 | 维度数 | critical 标的维度 |
|---|---|---|---|
| C. 执行能力 | **25%** | 6 | C1 计算机使用 · C5 MCP 支持 |
| B. 能力底座 | **15%** | 5 | B3 记忆系统 |
| E. 任务场景覆盖 | **13%** | 6 | E1 长任务规划 |
| 🆕 N. 开源/开发者关系 | **12%** | 5 | N1 开源开放度 · N4 第三方扩展生态 |
| D. 交互/UX | **10%** | 5 | D3 中断与接管 |
| 🆕 M. 模型-Harness 共进化 | **8%** | 5 | M1 任务反馈闭环 |
| A. 形态/心智 | 8% | 3 | — |
| K. 商业生态 | 5% | 5 | — |
| F. 隐私合规 | 3% | 4 | — |
| H. 运行环境 | 1% | 3 | — |
| **合计** | **100%** | **47** | — |

### 6.2 编码 Agent (67 维 / 14 组)

| 组 | 权重 | 维度数 | critical 标的维度 |
|---|---|---|---|
| **E. Agent Harness 执行** | **20%** | 6 | E5 自定义工具系统 · E6 长任务持久化 |
| **F. Context Engineering** | **18%** | 5 | F3 Memory + Compaction |
| 🆕 N. 开源/开发者关系 | **12%** | 5 | N4 第三方扩展生态 |
| 🆕 M. 模型-Harness 共进化 | **10%** | 5 | M1 任务反馈闭环 |
| C. 代码理解 | 10% | 6 | C2 跨文件 · C3 大库 |
| L. Killer Feature / 创新 | 8% | 3 | L1 Killer Feature |
| J. Cache / Cost | 7% | 5 | J5 Prompt Cache 命中率 |
| D. 代码生成 | 6% | 6 | — |
| B. 模型/底座 | 4% | 4 | — |
| G. IDE 集成 | 2% | 5 | — |
| H. 协作 | 2% | 4 | — |
| A. 形态 | 1% | 3 | — |
| I. 安全 / K. 商业 | 0% | 10 | (仅记录,不计分) |
| **合计** | **100%** | **67** | — |

### 6.3 公共维度 (common-dims.yaml, 抽出 ~10 维)

模型策略 / 上下文窗口 / 定价 / 开源 / 企业版 / 合规 / MCP / 社区规模 / 平台支持 / 推出时间

> 详细维度内容见 `wiki/schema/{general,coding,common}-dims.yaml`，本文档不展开。

### 6.4 权重设计原则 (JD 校准)

权重方案直接源自 DeepSeek Agent Harness PM JD 的 6 个核心信号：

1. **"Harness Engineering 一手实践"** → E + F 占 38% (编码) / E + B 占 40% (通用)
2. **"模型与 Harness 共同进化"** → 新增 M 组,占 8-10%
3. **"开源社区 / 用户社群"** → 新增 N 组,占 12%
4. **"KV Cache"** → J5 独立 critical
5. **"桌面端 Agent"** → 通用类 C 组占比最大 (25%)
6. **JD 显式列出 9 产品** (Claude Code/Cowork/Codex/Cursor/OpenCode/Copilot/Manus/OpenClaw/Hermes) → 全部锁定 P0

---

## 7. 三条路径详细设计

### 7.1 Path A — 文档同步链 (每周日)

```
docs-link-collector
   ↓ 1. 抓 sitemap / 导航树, diff 上周
   ↓ 2. 输出新增/变更页面列表 (changes.json)
   ↓
batch-fetcher
   ↓ 3. 并发抓取所有变更页 → wiki/raw/<product>/<date>/
   ↓
llm-wiki compile
   ↓ 4. LLM 抽取关键字段 → wiki/compiled/<product>/dimensions/*.md
   ↓ 5. 维度填充: 每维度独立 prompt, 引用 raw 文档作证据
   ↓
provenance writer
   ↓ 6. 写 _provenance.json (每字段来源可追溯)
   ↓
git commit + 飞书 Wiki sync (单向)
```

**关键设计**: `compiled/` 不是简单 Markdown,是结构化的"维度卡片"。每个维度一个 .md, 顶部 frontmatter 含 evidence_urls + confidence + last_verified。

### 7.2 Path B — Changelog 增量链 (每日 UTC 00:00)

```
信号源(L1)并发轮询:
   ┌── AIHOT       /api/public/items?q=<product>&since=24h
   ├── TrendRadar  webhook (产品名命中关键词)
   └── wechat      search_wechat.js "<product>" -n 10
         ↓
   信号聚合器: 去重 + 关联到产品 + 重要性打分
         ↓
   ┌──── 重要变更 (score > threshold) ────┐
   │  L0 抓官方 Changelog/Release notes   │
   │       ↓                               │
   │  L2 兜底验证 (multi-search-engine)   │
   │       ↓                               │
   │  LLM 生成增量报告                     │
   │       ↓                               │
   │  自动 Ingest 到 wiki/changelog/      │
   │       ↓                               │
   │  飞书机器人推送 (Layer 3 通知链)     │
   └───────────────────────────────────────┘
```

**关键设计**: 信号聚合器是核心。同一变更可能被 3 个 L1 源同时捕获,需要去重并交叉验证。重要性打分公式：
```
score = (信号源数量 × 0.4) + (来源权重 × 0.3) + (LLM 评估关键性 × 0.3)
```

### 7.3 Path C — Wiki-first 查询链 (按需)

```
用户/Agent 发起查询: "Claude Code vs Cursor 在 Context Engineering 上"
         ↓
competitive-analysis 路由器
         ↓
   1. Wiki 命中检查 (缓存命中 + last_verified 在 7d 内 → 直接用)
         ↓
   2. 缺维度按优先级补充:
        a. L0 官方 (最高可信)
        b. L2 multi-search-engine (兜底)
        c. L3 社区(辅证)
         ↓
   3. 多源验证: 至少 2 源同向 → 采纳; 冲突 → 标 ⚠️ 留给人审
         ↓
   4. 渲染对比矩阵 (Markdown / HTML / PPTX)
         ↓
   5. 写入 wiki/reports/on-demand/
         ↓
   6. 飞书 Wiki 同步 + (可选) 转 PPT
```

---

## 8. 报告产出与团队消费

### 8.1 三层产物

| 层 | 形态 | 触发 | 消费者 |
|---|---|---|---|
| L1 默认 | Markdown + 飞书 Wiki | 每次产出 | 团队 (查阅 + 评论) |
| L2 升级 | PPT (Marp / python-pptx) + HTML 静态站 | 人工标记 high-value | 老板 / 客户 |
| L3 推送 | 飞书机器人 + 邮件订阅 | 重要变更触发 | 一线 / 决策层 |

### 8.2 PM 作品集报告 (6 篇专题, 服务 JD 应聘)

| 报告 | 对应 JD 关键词 | 维度组 |
|---|---|---|
| 《Harness 设计模式比较》 | Harness Engineering | E |
| 《项目上下文系统》 | Context Engineering | F |
| 《工具与扩展生态》 | Tool Use / MCP / Subagent | E5 + N4 |
| 《Cache 优化策略》 | KV Cache / Prompt Cache | J5 |
| 《开源策略对比》 | 用户社群 / 开源社区 | N |
| 《Eval 与训练数据回流》 | 模型与 Harness 共同进化 | M |

每篇报告独立输出 PPT 和 HTML 两版,作为 PM 应聘的作品集。

---

## 9. 调度与触发

```
GitHub Actions cron 配置:

# Path B - 每日 Changelog 增量
.github/workflows/daily-changelog.yml:
  schedule: '0 0 * * *'    # UTC 00:00 = 北京 08:00

# Path A - 每周日全量同步
.github/workflows/weekly-fullsync.yml:
  schedule: '0 22 * * 0'   # UTC 22:00 周日 = 北京 06:00 周一

# Path C - 手动触发 (workflow_dispatch)
.github/workflows/on-demand-comparison.yml:
  workflow_dispatch:
    inputs:
      products:
        description: '逗号分隔的产品 ID'
      dimensions:
        description: '维度组 (默认 all)'
```

---

## 10. 技术栈与项目骨架

### 10.1 主选型

| 层 | 选型 | 理由 |
|---|---|---|
| 主语言 | Python 3.11+ | 抓取生态成熟, wechat skill 集成顺畅 |
| 包管理 | **uv** | 快, PEP 668 友好 |
| HTTP/异步 | `httpx` + `asyncio` | 26 产品并发抓取 |
| 动态页 | `playwright` | SPA 文档站 |
| RSS/Feed | `feedparser` + `lxml` | 博客订阅 |
| Schema | `pydantic v2` | 维度 schema |
| 模板 | `jinja2` | Markdown / HTML / PPT 共用 |
| LLM | `anthropic` SDK + prompt cache | 编译 + 摘要 + 对比生成 |
| PPT 输出 | **Marp** (md→pptx 走 Markdown 优先) | 与 wiki Markdown 同源 |
| HTML 输出 | `mkdocs-material` | 静态站 |
| 调度 | **GitHub Actions** | 免费 + 可观测 |
| 飞书 | 复用用户的 `feishu` skill (CLI) + `lark-oapi-py` (脚本) | 双通道 |
| Node 桥接 | `wechat-article-search` subprocess | 唯一 Node 依赖 |

### 10.2 项目骨架

```
ai-agent-competitive-analysis/
├── pyproject.toml
├── uv.lock
├── README.md
├── .github/workflows/
│   ├── daily-changelog.yml
│   ├── weekly-fullsync.yml
│   └── on-demand-comparison.yml
├── packages/
│   ├── llm_wiki/
│   ├── docs_link_collector/
│   ├── ai_agent_research/
│   └── competitive_analysis/
├── adapters/
│   ├── layer0_official/
│   ├── layer1_radar/
│   ├── layer2_search/
│   └── layer3_community/
├── wiki/                            # 建议同仓 (见 §12.2 #1), 数据量大后再迁 submodule
│   ├── raw/  · compiled/  · schema/
│   └── reports/
├── render/
│   ├── md/  · html/  · pptx/
│   └── feishu/
├── docs/superpowers/specs/
│   └── 2026-05-23-ai-agent-competitive-analysis-design.md  (本文档)
└── tests/
```

---

## 11. 实施阶段

### Phase 1 — MVP (2 周)

**目标**: 跑通 Path A + B 主线,覆盖 5 个 P0 产品 (Claude Code / Cursor / Codex / Hermes / Manus)。

- [ ] 项目骨架 + uv 依赖
- [ ] llm_wiki 三层目录 + Pydantic schema
- [ ] 维度库 yaml (先编码 Agent 一份,通用 Agent v0)
- [ ] L0 适配器: docs-link-collector + RSS + GitHub Releases
- [ ] Path A 全量同步: 1 个产品打通端到端
- [ ] LLM 编译 prompt 模板 + provenance 记录

### Phase 2 — Path B 增量链 (1 周)

- [ ] L1 适配器: AIHOT + wechat-article-search + TrendRadar (Fork 部署)
- [ ] 信号聚合器 + 重要性打分
- [ ] LLM 生成增量报告
- [ ] 飞书机器人推送

### Phase 3 — Path C 对比引擎 (2 周)

- [ ] competitive_analysis 路由器
- [ ] 多源验证逻辑
- [ ] 渲染层 (Markdown + HTML + PPT)
- [ ] 飞书 Wiki 单向同步

### Phase 4 — PM 作品集报告 (持续)

- [ ] 6 篇专题报告 (按 JD 关键词)
- [ ] PPT/HTML 双版

### Phase 5 — 长尾产品扩展 (持续)

- [ ] P2 产品逐个加入
- [ ] L2 multi-search-engine 兜底优化
- [ ] 维度库迭代 (用户社群反馈驱动)

---

## 12. 风险与开放问题

### 12.1 已识别风险

| 风险 | 缓解 |
|---|---|
| 闭源桌面客户端文档稀薄 | L1+L2 多源交叉补全; 关键产品手动逆向 prompt (Tier 3) |
| 国内产品反爬严格 | wechat skill 走搜狗,multi-search-engine 多 IP 轮换 |
| LLM 编译成本高 | 充分利用 prompt cache (J5 维度本身的实战) |
| 飞书 API 限流 | 写入做幂等 + retry, 失败回落到 Markdown only |
| 26 产品维度评估的人力成本 | 关键维度 LLM 自动 + critical 维度人工审核 |
| TrendRadar 关键词命中率不准 | 关键词 yaml 持续迭代; 加产品名英中双写 |

### 12.2 开放问题 (待用户决策)

1. **wiki/ 与主代码同仓 vs git submodule?**
   - 同仓: 简单, 但 LLM 编译产物会污染 git history
   - submodule: 干净分离, 但增加复杂度
   - **建议**: 先同仓, 后期数据量大再迁

2. **Tier 3 产品的"逆向 prompt"是否要做?**
   - WorkBuddy / Marvis / Miclaw PC 等可能没有公开 prompt
   - 通过用户社区/B站测评提取 system prompt 是常见做法
   - 但需要法律边界判断 — **建议保守, 仅记录公开来源**

3. **PPT 模板风格?**
   - 阿里云风格 (深色 + 渐变)
   - Anthropic 风格 (米白 + 衬线)
   - DeepSeek 风格 (极简 + 蓝绿)
   - **建议**: DeepSeek 风格 (毕竟是应聘材料)

4. **Cowork 作为 Claude Desktop 的子模式 vs 独立产品?**
   - JD 把 Cowork 当作单独产品列
   - 实际是 Claude Desktop 的一个 mode
   - **建议**: 同一产品记录,用 `subproduct` 字段区分

---

## 13. 验收标准

### 13.1 功能验收

- [ ] Path A 能为任意 P0 产品产出完整 wiki/compiled
- [ ] Path B 能在 24 小时内捕获 P0 产品的 Changelog 更新
- [ ] Path C 能生成"主基准 vs 任一产品"的 30+ 维度对比
- [ ] 6 篇 PM 专题报告全部输出 PPT + HTML
- [ ] 团队飞书 Wiki 看到所有 compiled 内容

### 13.2 质量验收

- [ ] 每个评估字段有 ≥1 个 evidence_urls
- [ ] 关键维度 (critical) 有 LLM + 人工双审
- [ ] 多源冲突的字段全部带 ⚠️ 标记

---

## 附录 A: 已安装并验证的依赖

| Skill / Tool | 状态 | 用途 |
|---|---|---|
| AIHOT skill | ✅ 已装 | L1 AI 行业资讯 |
| SkillHub CLI | ✅ 已装 (~/.local/bin/skillhub) | Skill 管理 |
| multi-search-engine skill | ✅ 已装 + 软链 | L2 SERP |
| wechat-article-search | ✅ 已装 + cheerio + 实测能用 | L1 微信搜索 |
| wechat-article-scraper | ✅ 已装 (依赖 playwright 待补) | 备选 |
| wechat-articles | ✅ 已装 (依赖 miku-ai 待补) | L3 单点全文 |
| TrendRadar | ⏳ 待 fork 部署 | L1 中文社媒 |
| feishu skill (用户已有) | ✅ 已装 | 飞书读写 |

---

## 附录 B: 关键设计决策记录 (ADR-style)

1. **A1 知识库存储方式**: 本地 Markdown + Git (拒绝飞书纯前台)
2. **A2 服务对象**: 团队竞品监控 (拒绝个人/SaaS/社区免费版)
3. **A3 TrendRadar 集成**: 1A 独立部署 (拒绝嵌入式 fork)
4. **A4 抓取频率**: 2B 每日 Changelog + 每周文档同步
5. **A5 维度库结构**: 双类目 + 公共抽离 (37 通用 + 57 编码 + 10 公共)
6. **A6 权重方案**: JD 校准 — 编码 E+F 占 38%, 通用 C 占 25%
7. **A7 新增维度组**: M (模型-Harness 共进化) + N (开源/开发者关系)
8. **A8 主基准产品**: Claude Code (编码) + Claude Desktop (通用)
9. **A9 主语言**: Python (拒绝 Node)
10. **A10 调度**: GitHub Actions (拒绝本地 cron / 自建服务器)
