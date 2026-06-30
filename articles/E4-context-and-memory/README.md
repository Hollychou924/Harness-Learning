# E4｜上下文与记忆:一次对话 Agent 到底带着什么

> 状态:✍️ 大纲已重排(6 问 + 拔高,上下半场结构) · 字数:不限,讲透为准(预计 8000-10000,全系列最硬核章)
> JD 锚点:**Memory** / **KV Cache** / Context Engineering / Compaction
> 定位:全系列信息密度最高的一章。接 E3——工具调得对只说明 Agent 有手有脚,上下文和记忆管得好才说明它有脑子。
> 边界说明:本章是镇文图的主场——三级缓存 / static·dynamic section + Boundary / 四级 compact / token 预算 / CLAUDE.md·MEMORY.md 注入全归这里。E5 只管能力组织,不碰 compact/cache;提示注入完整防护归 E6;评估体系归 E8。

## 镇文之图(用 v2 新图)

`assets/context-lifecycle-architecture-v2.jpg`(七区块版,比旧版可读性强,术语更准)是本章主线。按 7 个区块拆成 4 个分图逐段讲:
1. **§2+§6A 请求体构成 + 三源注入**:system(静态区/动态区+Boundary)+ tools + messages;CLAUDE.md/Skills/MEMORY.md 三源 → Q1
2. **§4 token 预算公式**:历史上下文 + 新增消息 + 下次返回预留 + Compact Buffer(安全余量)→ Q3
3. **§5 四级 Compact 降级链**:MicroCompact(轻)→Snip(中轻)→AutoCompact(中重)→Reactive(重)→ Q4
4. **§1 三级缓存 + §2 静态/动态区**:用户/组织/全局缓存,缓存标记落在稳定片段末尾 → Q5

## 本章要回答的真实问题(2026-06-07 升级为 6 问,吸收外部建议)

> 开篇先放"四概念辨析表"(Context/Memory/Cache/Compact 不是一回事),再抛钩子:同一个 Agent,刚开始很聪明,跑几十轮后开始忘约束、乱调用、变贵、变慢,甚至把错误经验记到下次——为什么?

**上半场 · 上下文窗口怎么装**
1. **Q1:一次对话,Agent 到底带着哪些东西?** — 全章地图,讲成 Context Stack(分层+稳定性+风险):system prompt、rules、tools、messages、repo、memory、tool results。拆镇文图 §2+§6A。
   - **1.1 增补(2026-06-07,原 E5 Q4 挪入)**:AGENTS.md/CLAUDE.md 怎么写才真起作用、为什么写了 Agent 不遵守——做目录不做百科(100 行内)、Prompt 是分层宪法不是人格台词、CLAUDE.md(经验收编)vs AGENTS.md(制度挂载)。
2. **Q2:上下文不是越多越好,怎么决定"带什么、不带什么"?**(新增) — 压缩是泄压手段,选择才是第一性问题。context selection / ranking / priority;Cursor glob 触发、渐进式披露、RAG→Grep 让 Agent 自己选。
3. **Q3:上下文快满了,压缩谁、保留谁、丢弃谁?** — 三层分类(常驻/按需召回/可丢弃)。腾讯实测:正确卸载省 61% Token、成功率 +52%。
4. **Q4:四级 compact 怎么触发?为什么要留 Compact Buffer?** — 讲成 checkpoint 泄压链(不是摘要):MicroCompact→Snip→AutoCompact→Reactive,buffer 是给压缩留执行空间的安全余量。
5. **Q5:static/dynamic section 怎么切?为什么决定 cache 命中率和成本?** — 讲成 cache-aware prompt 架构(不是服务端优化)。五产品 cache 横评、命中率 85-92%、盈亏平衡 2-3 turn、10 倍成本差;cache×compact 冲突(compact 改内容会破坏稳定前缀)。

**下半场 · 长期记忆怎么管**
6. **Q6:跨会话怎么记住?记忆怎么写入、召回、更新、隔离、遗忘、防投毒?** — 讲成 memory lifecycle(不是存储方案)。CLAUDE.md(人写持久指令)vs 自动记忆(Claude 自写学习,需 workspace trust 门控);记忆三层 Tair/Mem0/Tablestore;淘宝闪购 Tair 并发延迟 5ms→50ms;记忆投毒(OWASP Agent Memory Guard);Agent 自写记忆默认不可信。

> **拔高**:上下文与记忆 = Agent 的"信息操作系统"。呼应 E1 双核:section 切分 = 为缓存设计的架构决策(架构设计能力);用 cache 命中率/token 成本量好坏(评估能力)。

## 四个"讲法纠偏"(吸收外部建议,本章贯穿)

1. compact 讲成 **checkpoint / 泄压**,不是"做摘要"。
2. cache 讲成 **prompt 架构设计**,不是"服务端优化"。
3. memory 讲成 **生命周期**(写入/召回/更新/隔离/遗忘/防投毒),不是"存储方案"。
4. 上下文讲成 **Context Stack**(分层+稳定性+风险),不是"列有哪些东西"。

## 阅读体验设计(承接 E1/E2/E3)

1. 开篇四概念辨析表先把 Context/Memory/Cache/Compact 拆清,避免读者混。
2. 镇文图拆 4 分图逐段讲,一张图信息量太大读者吃不下。
3. 上下半场结构:上半场装上下文(Q1-Q5),下半场管记忆(Q6)。
4. 每节"场景→反例→怎么破→一句判断";给可抄的(三层分类表、四级 compact 触发表、cache 横评表、记忆生命周期清单、文末自查表)。

## 支撑素材(wiki / 已核实出处)

| 问题 | wiki / 出处 | 关键证据 |
|------|----------|---------|
| Q1 | `reports/portfolio/context-engineering/report.md`、镇文图 §2/§6A、Anthropic CC memory 文档(已核实) | Context Stack、三源注入、CLAUDE.md vs 自动记忆 |
| Q2 | `reports/portfolio/context-engineering/report.md`(六路径)、`concepts/progressive-disclosure.md`、`topics/tencent-*`(RAG→Grep) | glob 触发、渐进式披露、Agent 自己选 context |
| Q3 | `reports/portfolio/cache-strategy/report.md`、`topics/tencent-*`(省 61%/+52%)、镇文图 §4 | 三层分类、Compact Buffer、腾讯实测数字 |
| Q4 | 镇文图 §5(四级链)、`topics/tencent-*`(OpenClaw 上下文压缩) | MicroCompact/Snip/AutoCompact/Reactive 程度与动作 |
| Q5 | `reports/portfolio/cache-strategy/report.md`(五产品横评) | 命中率 85-92%、盈亏 2-3 turn、10 倍成本差、Manus 三原则、Cursor 隐形 miss、cache×compact 冲突 |
| Q6 | `topics/aliyun-*`(Tair/Mem0/Tablestore 三层、淘宝闪购)、`topics/aws-*`(记忆投毒 OWASP ASI)、OWASP Agent Memory Guard(已核实)、Anthropic CC memory(已核实) | 记忆生命周期、投毒防护、自写记忆门控 |
| Q6(新增案例) | `concepts/memory-synthesis-dreaming.md`、`raw/official-posts/openai/2026-06-04-dreaming-*`、`raw/community-posts/chatgpt-memory-dreaming/*`(APPSO/智东西/AINLP/AGIPlayer) | ChatGPT Dreaming 三代演进、三项评测(9.4%→75.1%)、记忆摘要可纠错、staleness 作废、删除≠真删 |

## 已核实的外部出处(2026-06-07 联网)

- ✅ OWASP Agent Memory Guard(owasp.org/www-project-agent-memory-guard):定义 memory poisoning = 持久记忆被污染 → 失准/数据外泄。可引用。
- ✅ Anthropic Claude Code memory(code.claude.com/docs/.../memory):CLAUDE.md(人写持久指令)vs Auto memory(Claude 自写,需 workspace trust 门控、MEMORY.md entrypoint);并明确"Instructions seem lost after /compact"痛点。可引用。
- ⚠️ OpenAI Prompt Caching 官方页 403(地区受限),用 wiki cache-strategy 报告已有引用,不引打不开的页。
- ✅ OpenAI Dreaming 发布页(openai.com/index/chatgpt-memory-dreaming/,2026-06-04,已抓取入库):三类评测目标(carry forward / follow preferences / stay current)、saved memories→Dreaming V0→V3 演进、算力降约 5x;评测百分比据 APPSO/智东西中文解读交叉确认。可引用。

## 边界划分(踢到后续章节,E4 不展开)

- 能力组织(Skills/Subagent/Multi-Agent 怎么拆)→ **E5**(E4 只讲它们作为上下文来源)
- 提示注入完整防护 → **E6**(E4 只在 Q6 防投毒点到:外部内容默认不写长期记忆、区分 data/instruction)
- 工具结果回灌进循环的逻辑 → **E2**(已讲)
- 完整评估体系 → **E8**(E4 文末自查表只给 cache 命中率/token 成本等最相关项)

## 收尾检查清单(草稿待填)

- [ ] 四概念辨析表是否把 Context/Memory/Cache/Compact 讲清
- [ ] Q2 上下文选择是否讲清"选择先于压缩"
- [ ] 四级 compact 是否给了"哪种场景触发哪一级"判断表,且讲成 checkpoint 不是摘要
- [ ] cache 是否讲成 prompt 架构 + 给了 cache×compact 冲突
- [ ] 记忆是否讲成生命周期(写入/召回/更新/隔离/遗忘/防投毒)
- [ ] AGENTS.md/CLAUDE.md 是否讲清"做目录不做百科 + 分层宪法"(为什么写了不遵守)
- [ ] 拔高是否把上下文与记忆呼应回 E1 双核(信息操作系统)
