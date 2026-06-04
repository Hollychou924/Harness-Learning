# Harness 合集 66 篇 中文社区视角分析

> 数据源: `wiki/raw/harness-engineering/` 66 篇正文 (2026 Q1 中文社区文章)
> 用途: 决定第 7 篇横评的差异化角度,以及 enrich 现有 6 篇的 footnote
> 生成: 2026-05-24

---

## TL;DR

- **可以写第 7 篇横评**,且差异化非常明确:中文社区与硅谷在 *隐喻 / 引用源 / 抓手* 三个层面存在系统性错位。
- **建议主题: "驾驭 vs 协作:中文社区与硅谷在 Harness 三个层面的隐性分歧"**。这是 PM 应聘材料里最能展示"跨市场战略洞察"的一篇,而不是产品横评的第 7 篇 (避免与现有 6 篇重叠)。
- **同时建议 enrich 现有 6 篇**:补 `AGENTS.md` 数据点 (Open Source / Harness Design)、加 Cursor 在中文社区低存在感的 footnote (Tool Ecosystem)、加"驾驭"隐喻对照 (Co-evolution)。

---

## 一、数据概览

| 维度 | 数值 |
|---|---|
| 文章数 | 66 |
| 总 token | 2.15 MB / 19.0 万分词 token |
| 时间窗口 | 2026 Q1 (主体来自 2-4 月) |
| 站点分布 | 微信公众号 51 / 知乎 2 / aliyun 2 / 其他各 1 |
| 头部公众号 | 阿里云开发者(6)、腾讯云开发者(3)、腾讯技术工程(2)、技术自由圈(2) |
| 抓取技术栈 | wechat-article-extractor 主路径;Scrapling stealthy-fetch 兜底反爬 |

---

## 二、关键发现 (按惊讶程度排序)

### 发现 1:Cursor 在中文社区被严重低估 ⚠️

| 产品 | DF | DF% | TF |
|---|---:|---:|---:|
| Claude Code | 38 | **58%** | 269 |
| Codex | 35 | **53%** | 139 |
| Cursor | 21 | **32%** | 37 |
| OpenClaw | 21 | 32% | 143 |
| Hermes | 8 | 12% | 123 |
| Manus | 10 | 15% | 25 |
| TRAE | 3 | 5% | 5 |

**Cursor 的 TF 只有 37** — 不到 Claude Code 的 1/7,DF% 也只有它的一半左右。新增 3 篇后,OpenClaw 和 Hermes 的声量显著上升,说明中文社区正在把“个人 Agent 框架”和“自进化 Agent”纳入 Harness 讨论。

**对现有报告的影响**: `harness-design/report.md` 把 Cursor 列为三大主流之一并展开 E1-E6 对比。这在硅谷工程文化里成立,但**在中文社区的舆论场不成立**。需要在 Tool Ecosystem 报告里加 footnote。

### 发现 2:AGENTS.md 是中文社区实际的 Harness 抓手

| Artifact | DF | TF |
|---|---:|---:|
| AGENTS.md | 31 (47%) | **342** |
| CLAUDE.md | 16 (24%) | 65 |
| MCP | 29 (44%) | 259 |
| Skills | 44 (67%) | 502 |
| Sub-agent | 29 (44%) | 218 |

中文社区把 Harness 落到具体配置文件 (`AGENTS.md` / `CLAUDE.md`) 比落到抽象架构维度 (Subagent 嵌套深度) 更频繁。**AGENTS.md 的 TF=342 比 Sub-agent 的 TF=218 高 57%**,但现有 `harness-design/report.md` 完全没讨论这两个文件 (它们在 6 篇报告里出现 0 次)。

**对现有报告的影响**: `open-source/report.md` 应该加一节 "协议层标准化:从 AGENTS.md 到 SKILL.md";`harness-design/report.md` E1 (权限) 章节应该提及 `AGENTS.md` 作为 Claude Code/Codex 的共同配置入口。

### 发现 3:Pair Programming 在 66 篇中 0 命中

完整 0 DF。中文社区不把 AI Agent 当成 *协作伙伴*,而是当 *被驾驭的对象* (`驾驭` TF=142, `控制论` TF=34, `缰绳`/`护城河` TF=21)。

- 隐喻语境:Harness = 马具 / 缰绳 / 笼头 → AI 是马,人是骑手
- 现有 `co-evolution/report.md` 假设的"AI 与人协同进化"在中文社区话语体系里没有显著语料支撑

**这是第 7 篇横评最强的差异化点**。

### 发现 4:Mitchell Hashimoto + Martin Fowler + OpenAI Codex 三角是中文社区共同 OG

| 引用源 | DF | DF% |
|---|---:|---:|
| Mitchell Hashimoto | 18 | 29% |
| Martin Fowler | 11 | 17% |
| 百万行 (OpenAI Codex 实验) | 19 | 30% |
| Codex Agent | 7 | 11% |
| Aegis (作者自有项目) | 2 | 3% |

近 1/3 文章引用 OpenAI 那篇博客的"百万行代码"数字作为论据。**中文社区还没有自己的"百万行"标志性案例** — 字节 TRAE 文章 3 篇,但都是产品介绍而非工程实践数据。

**对现有报告的影响**: `harness-design/report.md` 把 Stripe 百万行作为 Codex 数据点是对的;但应该补一句"该数字目前被 30% 中文 Harness 文章作为唯一标志性论据循环引用,缺乏中文社区独立验证"。

### 发现 5:渐进式披露 (progressive disclosure) 是高度共识的工程实践

DF 23 (35%),TF 58 — 23 篇都讨论 Skills/MCP 的*按需加载*策略,这与现有 `tool-ecosystem/report.md` 的核心论点 (E4: 工具数量 vs 调度成本) 完全契合。

**这是 enrich 现有报告的最直接素材**: Tool Ecosystem 报告应该加一段引用中文社区 22 篇文章对渐进式披露的共识,作为论点支撑。

### 发现 6:中文社区高度关注的工程主题 vs 6 篇报告的覆盖

| 主题 | 中文社区 DF | 6 篇报告覆盖度 | 行动 |
|---|---:|---|---|
| 权限/安全 | 37/50 (59%/79%) | Harness Design E1 已重点讨论 | ✓ 一致 |
| 持久化/长任务 | 28 (44%) | Harness Design E6 已讨论 | ✓ 一致 |
| 记忆/Memory | 50 (79%) | 部分见 Cache Strategy | 加 footnote |
| 评测/Eval | 22 (33%) | 6 篇报告几乎没讨论 | **新空白** |
| Cache (KV缓存) | <5 (中文几乎不讨论) | Cache Strategy 专写一篇 | 现有报告独有视角 |

**最大空白:评测**。22 篇中文文章讨论 Eval / 基准测试,但现有 6 篇报告没有专章。这是潜在的第 7 篇候选,但话题相对窄。

### 发现 7:国产 Harness 框架声量结构

| 国产玩家 | DF (合集) | 性质 |
|---|---:|---|
| 字节跳动 (TRAE + DeerFlow) | 8+5 = 13 | DeerFlow 2.0 TF=129,深度文章多 |
| QQ音乐/腾讯 | 1 篇专题 | 实践文章高质量 |
| 复旦 AHE | 1 (论文) | 学术框架,工程影响弱 |
| 阿里 (含 aliyun 文章) | 6 | 主要是产品 + 实践案例 |
| Aegis (个人) | 2 | 独立工程师在内部项目踩坑 |

**结构性观察**: 国产没有 Cursor 级别的 Harness 产品形态,所有声量都集中在"字节系开源框架 + 大厂实践案例 + 个人博客"三层,而硅谷有 Claude Code / Codex / Cursor 三足鼎立。

---

## 三、推荐:不要写产品横评的第 7 篇

理由:

1. **现有 6 篇已覆盖产品维度的 17 维**,再写第 7 篇横评会重复
2. **中文社区的真正差异是话语体系而非产品事实** — 同样是 Harness,中文叫"驾驭",硅谷叫"工程治理";中文聚焦 AGENTS.md,硅谷聚焦 Subagent 嵌套
3. **PM 候选人应该展示战略洞察而非数据收集** — 第 7 篇应当是 *meta*,而不是 *more*

### 推荐第 7 篇: 战略备忘录 (Strategy Memo) 而非横评

**标题候选**:

> **"驾驭 vs 协作:中文社区与硅谷在 Harness 三个层面的隐性分歧——以及对 DeepSeek 产品定位的启示"**

**结构 (3-4 节,800-1200 行)**:

1. 开场 — Cursor 的中文低存在感作为锚点 (用本报告发现 1 的数据)
2. 三个层面的错位
   - **隐喻层**:驾驭 (zh) vs 协作/伙伴 (en) — 用发现 3 论证
   - **抓手层**:AGENTS.md 文件 (zh) vs Subagent 架构 (en) — 用发现 2 论证
   - **引用源层**:Mitchell + Fowler + OpenAI 百万行循环引用 (zh) vs 多维一手实证 (en) — 用发现 4 论证
3. 对 DeepSeek 的产品定位推导
   - 走"驾驭路线"还是"协作路线"决定 PM 全部下游决策
   - 推荐:面向中文开发者优先做"AGENTS.md+Skills+MCP"三件套(社区共识强),延后做 Cursor 风格的实时协作 (社区认知未对齐)
   - 评测体系:用 OpenAI 百万行作为基线,但建立中文社区独立验证案例 (避免循环引用陷阱)
4. 与现有 6 篇横评的衔接 — 这一篇是 *meta*,前 6 篇是 *micro*

### 这一篇的 PM 价值

| PM 能力维度 | 在这篇里如何体现 |
|---|---|
| 跨市场洞察 | 量化对比中英文社区的实体声量 |
| 数据驱动 | 全部论点用 DF/TF 数字背书 |
| 战略权衡 | 给 DeepSeek 三个具体的产品定位选项 + 推荐 |
| 一手原料 | 66 篇中文文章 + 现有 6 篇英文报告 |

---

## 四、对现有 6 篇的 enrich 清单 (footnote 级别,不重写)

| 报告 | 加什么 | 来源 |
|---|---|---|
| `harness-design/report.md` | E1 章节加 AGENTS.md/CLAUDE.md 作为权限抓手数据点;百万行论据加"中文社区循环引用"风险注 | 发现 2, 发现 4 |
| `context-engineering/report.md` | 加"上下文窗口" vs "上下文工程"在中文社区 DF 接近,反映概念边界模糊 | 发现 6 |
| `tool-ecosystem/report.md` | 加"渐进式披露在中文社区 35% DF,共识强"作为 Skills/MCP 调度的支撑 | 发现 5 |
| `cache-strategy/report.md` | 加"中文社区几乎不讨论 KV cache (<5 篇)"作为现有报告独有视角的反向佐证 | 发现 6 |
| `open-source/report.md` | 加 DeerFlow 2.0 (字节) / 复旦 AHE / Aegis 三个国产开源案例 | 发现 7 |
| `co-evolution/report.md` | 加"驾驭 vs 协作"隐喻对比,用"Pair Programming 0 DF"作为关键反证 | 发现 3 |

每个 enrich 大约 30-80 字,全部加完不需要超过 4 小时工作量。

---

## 五、附录:如何复现本报告的数据

```bash
# 词频(jieba 中文分词)
.venv/bin/python scripts/analyze_harness_collection.py
# → wiki/analysis/term-frequency.{json,md}

# 实体精准扫描(正则,不走分词)
.venv/bin/python scripts/entity_scan.py
# → wiki/analysis/entity-scan.{json,md}

# 主题关键词补扫(grep -l)
# 见本报告 §二 各发现中的命令
```

数据原文件:`wiki/raw/harness-engineering/<category>/<idx>-<slug>.md`,带 frontmatter (title/url/host/source/category)。
