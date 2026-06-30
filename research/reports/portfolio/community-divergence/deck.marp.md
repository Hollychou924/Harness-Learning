---
marp: true
theme: gaia
size: 16:9
paginate: true
backgroundColor: #FAFAFA
color: #1A1A1A
style: |
  section { font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", sans-serif; padding: 60px; }
  h1 { color: #0A6E6F; border-bottom: 2px solid #0A6E6F; padding-bottom: .3em; }
  h2 { color: #0A6E6F; }
  h3 { color: #0A6E6F; }
  table { font-size: 0.78em; }
  th { background: #E8F4F4; color: #0A6E6F; }
  blockquote { border-left: 4px solid #0A6E6F; color: #555; padding-left: 1em; }
  a { color: #0A6E6F; }
  strong { color: #0A6E6F; }
  .small { font-size: 0.85em; }
header: "战略备忘录:中文社区与硅谷 Harness 的隐性分歧"
footer: "zhouhao · 2026-05-24"
---

# 驾驭 vs 协作

## 中文社区与硅谷在 Harness 三个层面的隐性分歧

### —— 以及对 DeepSeek 产品定位的启示

<br>

**作者:** zhouhao
**JD 关键词:** Harness Engineering / Context Engineering / 工具生态
**目标读者:** DeepSeek Agent Harness PM
**数据切片:** 中文 63 篇 (2026 Q1) ✕ 5 个英文产品 17 维

---

# 这一篇与前 6 篇的关系

> 前 6 篇是 *micro 视角* (产品 × 维度),这一篇是 *meta 视角* (社区 × 隐喻 × 抓手 × 引用源)

| 前 6 篇横评 | 这一篇战略备忘录 |
|---|---|
| 5 个产品 × 17 维度的 Harness 对比 | 中文社区 63 篇 vs 硅谷一手文档的话语对比 |
| 解决 "怎么做" | 解决 "在中国市场怎么说怎么做" |
| 数据来源:wiki/compiled/ | 数据来源:wiki/raw/harness-engineering/ + 6 篇报告 |

**这一篇的差异化价值:** PM 候选人不仅能做产品横评,还能做战略级洞察。

---

# 执行摘要

**三个核心论点:**

1. **中文社区与硅谷在隐喻、抓手、引用源三个层面存在系统性错位**——不是翻译滞后,是认知模型不同。

2. **中文社区把 Harness 落到 `AGENTS.md` / `CLAUDE.md` 文件 (TF=336+50, DF=48%+22%),硅谷围绕 Subagent 嵌套等架构维度展开**。这决定 DeepSeek 中国版产品入口应该是配置文件协议,而不是架构 SDK。

3. **Cursor 在中文社区只有 Claude Code/Codex 一半的存在感 (DF=32% vs 56%/56%),"百万行代码"是 30% 中文文章的唯一定性论据**。DeepSeek 不需要做 Cursor 替代品,而是做"自己的百万行案例"。

---

# 数据基线

| 数据源 | 文件 | 内容 |
|---|---|---|
| 中文社区语料 | `wiki/raw/harness-engineering/` | 63 篇,2.06 MB,52 公众号 |
| 英文产品 Wiki | `wiki/compiled/<p>/_provenance.json` | 5 产品 × 17 维 + 证据 URL |
| 实体扫描 | `wiki/analysis/entity-scan.md` | 73 个实体精准 TF/DF |
| 前置 6 篇 | `wiki/reports/portfolio/<theme>/` | 横评层论点 |

**数据完整性:** 所有定量结论可由 `.venv/bin/python scripts/entity_scan.py` 单命令复现。中文素材 63/63 全量入库,无主观筛选。

---

# 第一层错位:隐喻

## 驾驭 (zh) vs 协作 (en)

| 隐喻范畴 | 中文社区 TF/DF | 硅谷一手文档 |
|---|---|---|
| 驾驭 (harness as 缰绳) | **142 / 24** | 中性 |
| 控制论 / Cybernetic | 34 / 4 | 几乎不出现 |
| 护城河 / Moat | 21 / 9 | 商业话语,不进 Harness 论文 |
| **Pair Programming** | **0 / 0** | **高频** |
| 协作 / 协同 | 中性 | **高频** |

> **最强信号:Pair Programming 在 63 篇中 0 命中**

---

# 隐喻分歧推出的设计选择

| 设计维度 | 驾驭模型 (zh) | 协作模型 (en) |
|---|---|---|
| 默认权限 | 最小权限,显式开列 | 信任默认,事后审计 |
| 工具风格 | 命令式 (run / write / kill) | 对话式 (suggest / propose) |
| 错误处理 | 快速停下,等人决策 | 自己重试,记录在 PR comment |
| UI 形态 | CLI + 强权限弹窗 | IDE 内嵌 + 隐式建议 |

**对 DeepSeek 中文版的启示:**
- 不要 `--dangerously-skip-permissions`-like flag
- 错误用"已停止",不用"将重试"
- Skill/Tool 文案以"做 X"开头,不用"建议 X"

---

# 第二层错位:抓手

## AGENTS.md 文件 (zh) vs Subagent 架构 (en)

| Harness 抓手 | 中文 TF | 中文 DF | DF% |
|---|---:|---:|---:|
| **AGENTS.md** | **336** | 30 | **48%** |
| CLAUDE.md | 50 | 14 | 22% |
| MCP | 253 | 28 | 44% |
| Skills | 456 | 41 | 65% |
| Sub-agent (架构概念) | 183 | 26 | 41% |
| 渐进式披露 | 54 | 22 | 35% |

> **AGENTS.md 的 TF=336 比抽象的 Subagent 概念 TF=183 高 83%**

---

# 两条工程化路径

```
中文社区 (AGENTS.md 路径):
  开发者打开仓库 → 看到 AGENTS.md → 改一行 → AI 行为变了 → 写公众号

硅谷 (Subagent 架构路径):
  开发者读 anthropic.com/docs → 理解嵌套深度 → 重构产品架构 → 写 RFC
```

| 维度 | AGENTS.md (zh) | Subagent (en) |
|---|---|---|
| 入门门槛 | 看一个 `.md` 文件 | 看完一组架构文档 |
| 验证成本 | 改文件看输出 | 重构跑评测 |
| 传播单元 | 一段 AGENTS.md 配置 | 一篇架构 RFC |
| 用户类型 | 个人 + 小团队 | 平台 + 大公司 |

---

# 第三层错位:引用源

## 百万行循环引用 (zh) vs 多维一手实证 (en)

| 引用源 | 中文社区 DF% |
|---|---:|
| Mitchell Hashimoto 博客 | 29% |
| Martin Fowler / ThoughtWorks | 17% |
| **OpenAI 百万行实验** | **30%** |
| Stripe (Codex 商用案例) | 14% |
| Anthropic Claude Code 一手文档 | 54% |
| OpenAI 一手文档 | 70% |

> **中文国产独立工程实证 (字节 TRAE / QQ 音乐 / 复旦 AHE / Aegis) 总和 < 12 篇**

---

# "百万行" 数字的三层观察

**A. 它成了中文社区的"外部权威锚"**
> 写"OpenAI 用 Codex 写了百万行" → 不需要再自证 Harness 价值

**B. 中文社区还没有自己的"百万行"标志性案例**
> 字节 TRAE 8 篇都是产品介绍,QQ 音乐 1 篇,复旦 AHE 是学术框架——整个中文 Harness 工程实证基础非常薄

**C. Mitchell + Fowler 是中文双 OG**
> 29% + 17% 引用率,他们没说的话题中文社区也很少触及

**机会:** DeepSeek 进入中国 Harness 市场最大的机会是"做出第一个本土的'百万行'标志性案例"。

---

# 三层错位的耦合效应

```
驾驭隐喻 (zh)        →  开发者要可见的边界
                     ↓
AGENTS.md 抓手 (zh)  ← 边界落在配置文件里
                     ↓
百万行案例缺位 (zh)  ← 配置文件需要案例支撑
        |
        ▼ 形成闭环

协作隐喻 (en)        →  开发者要默认信任
                     ↓
Subagent 架构 (en)   ← 信任落在架构里
                     ↓
多维一手数据 (en)    ← 架构需要长期实证
```

> **核心结论:中文 Harness 不是"硅谷 Harness 翻译版",它是另一个产品形态**

---

# DeepSeek 三个战略选项

| 选项 | 标题 | 性价比 | 我的判断 |
|---|---|---|---|
| **A** | 中文优先,做配置文件协议的中国标准 | 高 | **主线** |
| **B** | 做"国产 Harness 实证联盟",抢标志性案例 | 中,需 BD 周期 | **中期投资** |
| **C** | 做"驾驭范式"的中文产品语言领导者 | 高,执行难度大 | **长期可选** |

---

# 选项 A:配置文件协议主线

**做什么:**
- 把 `AGENTS.md` / `DEEPSEEK.md` / `SKILLS/` 三件套打包为 "DeepSeek Harness Convention"
- 官方教程、案例、CI 模板都基于此 Convention
- 中文社区推作为"行业事实标准"

**好处:**
- 与中文社区已有认知 (发现 2: AGENTS.md DF 48%) 同向
- 配置文件是低门槛的传播单元
- 不需要重做模型层

**风险:**
- "配置文件"路线可能被国际竞品讥为"低端"

---

# 选项 B:国产 Harness 实证联盟

**做什么:**
- 联合字节 / 阿里 / 腾讯 / 复旦,做"中国 Coding Agent 百万行案例联合白皮书"
- DeepSeek 提供模型 + 评测;伙伴提供使用场景 + 数据
- 一年内发布 3-5 个国产标志性数据点

**好处:**
- 直接攻击发现 4 (中文缺自己的"百万行")
- 把 DeepSeek 放在评测话语权位置

**短期可执行子选项 C+D:**
- 把字节 TRAE / 复旦 AHE / 阿里实践收编进 DeepSeek 评测体系 (3 个月)
- 资助 5 个中文公众号大 V 做 DeepSeek 实战长文 (送 token,不付费)

---

# 选项 C:驾驭范式语言领导

**做什么:**
- 中文 CLI / 文档 / 文案全面采用"驾驭"语义体系
- 拒绝引入"协作"、"伙伴"、"pair programming"等硅谷范式词
- 出版《驾驭工程实践》中文书,作为"驾驭"圣经

**好处:**
- 6 个月内塑造清晰的中文工程话语
- 长期可反向输出到海外中文社区 (港台 / 东南亚华人)

**风险:**
- "驾驭"语义可能被解读为"老板视角",不利于平等开发者文化
- 与硅谷生态对接成本上升

---

# 推荐组合

> **选项 A 主线 (90% 资源) + 选项 B 中期投资 (8%) + 选项 C 长期可选 (2%)**

**与前 6 篇横评的一致性:**

| 层 | 选择 |
|---|---|
| 底层架构 | 模式 B (Claude Code 风) + 模式 D (Manus 风) |
| 产品形态 | 中文配置文件协议 (`AGENTS.md` 主线) |
| 传播策略 | 国产实证案例 + 评测话语权 |
| 语言风格 | "驾驭"范式,显式边界,命令式 Tool |

---

# 与 6 篇横评的衔接

| 前 6 篇 | 它解决 | 本备忘录补充 |
|---|---|---|
| harness-design | 5 产品架构对比 | AGENTS.md 抓手在中文的现实地位 |
| context-engineering | Manus Context 方法 | 中文"上下文窗口" vs "上下文工程"概念边界模糊 |
| tool-ecosystem | MCP+Skills 工具生态 | 渐进式披露 35% DF 共识级支撑 |
| cache-strategy | 5 产品 Cache 策略 | 中文社区几乎不讨论 cache,这是国际独有视角 |
| open-source | 5 产品开源策略 | 字节 TRAE / DeerFlow / 复旦 AHE / Aegis 国产案例 |
| co-evolution | 模型与 Harness 协同 | "驾驭 vs 协作"作为协同模型反证 |

---

# 未来 12 个月的 3 个开放问题

**Q1:中文 AGENTS.md 路径会被硅谷反向吸收吗?**
随着 anthropic 把 Skills 推向更结构化 Markdown,以及 Codex 引入 AGENTS.md-like 配置——两条路径有无可能合流?**谁定义协议,谁拿生态。**

**Q2:OpenAI "百万行" 数字的可验证性会被挑战吗?**
30% 中文文章建立在这个数字上。一旦 Stripe 公开使用细节或第三方拆解出现,可能会经历"百万行寒冬"——大批文章论据基础瞬间过时。

**Q3:"驾驭" 语义会随中国 AI 工程文化成熟而退化吗?**
当 AI Agent 达到人类初级开发者水平 (~2027),驾驭隐喻是否过时——就像现代航空不再叫"驯服机器"?这关系到选项 C 的长期价值。

---

# 数据复现

```bash
# 1) 词频 + 实体扫描
.venv/bin/python scripts/analyze_harness_collection.py
.venv/bin/python scripts/entity_scan.py

# 2) 输出
wiki/analysis/term-frequency.{json,md}     # jieba 分词词频
wiki/analysis/entity-scan.{json,md}        # 73 个实体精准 TF/DF
wiki/analysis/harness-collection-insights.md  # 7 个发现详细论证

# 3) 重新拉取 63 篇正文 (跳过已存在,WX/Scrapling 双层兜底)
node scripts/ingest_harness_collection.mjs all
```

**所有结论可追溯到原始文档与代码。** 63/63 全量入库,无主观筛选。

---

# 致谢与方法论

**数据来源:**
- 中文社区 63 篇:飞书《harness合集 Holly的收藏夹》二级抓取
- 抓取栈:wechat-article-extractor + Scrapling stealthy-fetch 双层兜底
- 英文产品 17 维 Wiki:基于 Karpathy LLM Wiki + nashsu/llm_wiki + sdyckjq-lab/llm-wiki-skill 三套开源借鉴整合

**方法论:**
- 实体扫描用 `re.compile(IGNORECASE)`,避免分词器拆分英文短语
- 中文分词用 jieba 0.42.1 + 200+ 自定义领域词典
- 全部定量结论可单命令复现

代码与方法论开源: `github.com/<user>/ai-agent-competitive-analysis`

—— **zhouhao, 2026-05-24**
