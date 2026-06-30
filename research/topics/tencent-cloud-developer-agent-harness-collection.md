---
id: tencent-cloud-developer-agent-harness-collection
type: topic
status: active
updated: 2026-05-26
sources:
  - wiki/raw/community-posts/tencent-cloud-developer/INDEX.md
  - wiki/raw/community-posts/tencent-cloud-developer/2026-04-01-一文讲透如何构建Harness六大组件全解析.md
  - wiki/raw/community-posts/tencent-cloud-developer/2026-03-31-Harness-Engineering-来了SDD-还有意义吗.md
  - wiki/raw/community-posts/tencent-cloud-developer/2026-05-20-从Prompt-Context到Harness工程的三次进化与终局之战.md
  - wiki/raw/community-posts/tencent-cloud-developer/2026-04-17-一文讲透Harness-Engineering即控制论.md
  - wiki/raw/community-posts/tencent-cloud-developer/2026-05-13-从零设计生产级-Multi-Agent-Harness架构评估记忆成本与-MCP-工具接入全拆解.md
  - wiki/raw/community-posts/tencent-cloud-developer/2026-05-21-QQ音乐Harness-Engineering实践.md
  - wiki/raw/community-posts/tencent-cloud-developer/2026-05-26-腾讯云Agent-Memory节省61-Token提升52成功率的诀窍Mermaid无限画布×上下文卸载.md
  - wiki/raw/community-posts/tencent-cloud-developer/2026-05-19-让Skill自己训练自己8阶段Loop3层评测5维AND门控从此实现自进化.md
  - wiki/raw/community-posts/tencent-cloud-developer/2026-05-12-拆完Hermes源码我发现Agent的自我进化根本不需要训练模型.md
  - wiki/raw/community-posts/tencent-cloud-developer/2026-04-21-全方位对比Hermes-VS-OpenClaw.md
  - wiki/raw/community-posts/tencent-cloud-developer/2026-04-30-RAG已死不是Grep回归了.md
  - wiki/raw/community-posts/tencent-cloud-developer/2026-04-08-4亿token买来5个教训让6个AI-Agent连写4天代码发生了什么.md
  - wiki/raw/community-posts/tencent-cloud-developer/2026-04-02-Claude-Code是怎么知道你在骂他的这-12-条发现值得关注.md
  - wiki/raw/community-posts/tencent-cloud-developer/2025-12-10-SPEC-为什么会失败.md
owners: ["zhouhao"]
when_to_load: "讨论 Harness Engineering、SDD、Spec、Multi-Agent、Skills、Memory、上下文工程、OpenClaw / Hermes / Claude Code 拆解时加载"
---

# 腾讯云开发者 Agent / Harness 合集 (39 篇)

> 一句话: 这 39 篇是腾讯系工程师围绕 Harness Engineering 主线写的系列长文,从概念演化、Spec/SDD、Multi-Agent、Memory、Skills 自进化,一路到 OpenClaw / Claude Code / Hermes 的源码拆解和真实项目实践。它们不是某一个产品的官方文章,而是社区视角下"Harness 怎么落地"的一手论据。

## 1. 全集结构

我把 39 篇按主题分了 7 类。读者可以从任一类入手,但建议优先读"概念演化"和"工程化落地"两类,再按需要看后面的拆解和实践。

| # | 主题分类 | 代表文章 | 读完能拿到什么 |
|---|---|---|---|
| A | Prompt → Context → Harness 概念演化 | [从 Prompt、Context 到 Harness](../raw/community-posts/tencent-cloud-developer/2026-05-20-从Prompt-Context到Harness工程的三次进化与终局之战.md), [Harness 即控制论](../raw/community-posts/tencent-cloud-developer/2026-04-17-一文讲透Harness-Engineering即控制论.md), [大模型狂飙 2025](../raw/community-posts/tencent-cloud-developer/2026-01-13-大模型狂飙2025一篇文理清从模型到智能体的架构演进.md), [上下文工程万字长文](../raw/community-posts/tencent-cloud-developer/2026-01-07-Agent全面爆发万字长文详解上下文工程.md) | 把 Harness Engineering 放回控制论与软件工程史里看,理解为什么"工程纪律从代码挪到了 scaffolding" |
| B | Harness / SDD 工程化落地 | [Harness 六大组件全解析](../raw/community-posts/tencent-cloud-developer/2026-04-01-一文讲透如何构建Harness六大组件全解析.md), [SDD 还有意义吗](../raw/community-posts/tencent-cloud-developer/2026-03-31-Harness-Engineering-来了SDD-还有意义吗.md), [Harness 工程化落地万字干货](../raw/community-posts/tencent-cloud-developer/2026-04-22-万字干货Harness-Engineering如何工程化落地.md), [推翻"完美架构"回归提示词本质](../raw/community-posts/tencent-cloud-developer/2026-02-27-AI-工程化落地实践推翻完美架构回归提示词本质.md), [Harness 实践心得](../raw/community-posts/tencent-cloud-developer/2026-04-28-Harness-Engineering实践心得如何高效驾驭AI.md), [深入浅出 Harness 核心模式](../raw/community-posts/tencent-cloud-developer/2026-04-29-深入浅出Harness-Engineerring之核心模式与理念.md), [反思软件工程超越 Vibe Coding](../raw/community-posts/tencent-cloud-developer/2026-01-21-反思软件工程超越Vibe-Coding.md), [SPEC 为什么会失败](../raw/community-posts/tencent-cloud-developer/2025-12-10-SPEC-为什么会失败.md), [从第一性原理思考 Agentic Engineering](../raw/community-posts/tencent-cloud-developer/2026-04-23-从第一性原理思考-Agentic-Engineering.md) | Harness / SDD / 提示词哪些值得做、哪些是过度设计;真实项目里第一步从哪里搭 |
| C | Multi-Agent 架构 / Spec | [生产级 Multi-Agent Harness 全拆解](../raw/community-posts/tencent-cloud-developer/2026-05-13-从零设计生产级-Multi-Agent-Harness架构评估记忆成本与-MCP-工具接入全拆解.md), [4 亿 token 买来 5 个教训](../raw/community-posts/tencent-cloud-developer/2026-04-08-4亿token买来5个教训让6个AI-Agent连写4天代码发生了什么.md), [Multi-Agent / LangGraph](../raw/community-posts/tencent-cloud-developer/2025-12-16-Multi-Agent全面爆发一文详解多智能体核心架构及LangGraph框架.md), [一文搞懂 ReAct](../raw/community-posts/tencent-cloud-developer/2025-12-23-Agent全面爆发一文搞懂背后的核心范式ReAct.md), [零废话！从 0 构建 AI Agent](../raw/community-posts/tencent-cloud-developer/2026-03-26-零废话一文讲透从0构建AI-Agent.md), [从零开始实现一个 AI Agent 框架](../raw/community-posts/tencent-cloud-developer/2026-02-26-如何从零开始实现一个-AI-Agent-框架理论实践.md) | Multi-Agent / Orchestrator / Harness 怎么分层;Planner 决定权 vs Harness 决定权 |
| D | Skills / 渐进式披露 / 自进化 | [Skills 原理及实践](../raw/community-posts/tencent-cloud-developer/2026-03-13-一文搞懂爆火的SKills原理及实践案例.md), [让 Skill 自己训练自己](../raw/community-posts/tencent-cloud-developer/2026-05-19-让Skill自己训练自己8阶段Loop3层评测5维AND门控从此实现自进化.md), [一文搞懂 Hermes 自进化](../raw/community-posts/tencent-cloud-developer/2026-04-15-一文搞懂Hermes新顶流Agent如何从经验中自我进化.md), [拆完 Hermes 源码](../raw/community-posts/tencent-cloud-developer/2026-05-12-拆完Hermes源码我发现Agent的自我进化根本不需要训练模型.md) | Skills 是"公共 Prompt + 渐进式披露";Hermes 自进化的本质是 Prompt Engineering + 文件持久化 |
| E | Memory / 上下文压缩 / RAG 与 Grep | [腾讯云 Agent Memory: Mermaid 无限画布 + 上下文卸载](../raw/community-posts/tencent-cloud-developer/2026-05-26-腾讯云Agent-Memory节省61-Token提升52成功率的诀窍Mermaid无限画布×上下文卸载.md), [OpenClaw 双源记忆系统](../raw/community-posts/tencent-cloud-developer/2026-03-19-从架构到代码深入理解-OpenClaw-的双源记忆系统.md), [OpenClaw 上下文压缩方案](../raw/community-posts/tencent-cloud-developer/2026-03-04-深入解析OpenClaw上下文窗口压缩方案-一切都是为了效果与省钱.md), [RAG 已死,Grep 回归](../raw/community-posts/tencent-cloud-developer/2026-04-30-RAG已死不是Grep回归了.md), [IMA 知识库架构设计](../raw/community-posts/tencent-cloud-developer/2025-12-24-IMA知识库从0到1的架构设计与实践.md) | 当下主流 Coding Agent 为什么从 RAG 退回 Grep + LLM;长程记忆怎么"省钱又有效" |
| F | OpenClaw / Claude Code / Hermes 源码拆解 | [200 行实现 Claude Code 青春版](../raw/community-posts/tencent-cloud-developer/2026-03-03-200行代码实现Claude-Code青春版.md), [逆向深扒 Claude Code 源码](../raw/community-posts/tencent-cloud-developer/2026-04-01-逆向深扒Claude-Code源码我发现了什么.md), [Claude Code 是怎么知道你在骂他的](../raw/community-posts/tencent-cloud-developer/2026-04-02-Claude-Code是怎么知道你在骂他的这-12-条发现值得关注.md), [平平无奇的源码藏着 Agent 核心秘密](../raw/community-posts/tencent-cloud-developer/2026-05-26-平平无奇的源码竟藏着Agent的核心秘密.md), [解构 Clawdbot](../raw/community-posts/tencent-cloud-developer/2026-02-03-解构Clawdbot本地架构记忆管理Agent-编排与上下文组装原理.md), [Hermes VS OpenClaw 全方位对比](../raw/community-posts/tencent-cloud-developer/2026-04-21-全方位对比Hermes-VS-OpenClaw.md) | 三大开源 Agent 的真实实现细节;System Prompt / Skill / Loop 三件套结构 |
| G | 真实项目实践 / 行业基础 | [QQ 音乐 Harness 实践](../raw/community-posts/tencent-cloud-developer/2026-05-21-QQ音乐Harness-Engineering实践.md), [架构图终极典藏版](../raw/community-posts/tencent-cloud-developer/2026-01-08-如何画好一张架构图丨终极典藏版.md), [技术/数据/业务/应用/代码架构](../raw/community-posts/tencent-cloud-developer/2026-01-15-什么是技术架构数据架构业务架构应用架构和代码架构.md), [非专业也能看懂的大模型工作原理](../raw/community-posts/tencent-cloud-developer/2025-12-09-非专业也能看懂的AI大模型工作原理.md), [Transformer 架构原理解析](../raw/community-posts/tencent-cloud-developer/2025-12-03-万字长文讲透LLM核心Transformer架构原理解析.md) | 真实大仓 Monorepo Microservices 上 Harness 的落地形态;模型与架构基础 |

## 2. 跨文章共识

我把 39 篇里反复出现的论点整理成一个共识表。这些是腾讯系工程师群体对 Harness 的共同看法,可以直接当 E1-E9 章节论据用。

| 共识 | 出处样本 | 含义 |
|---|---|---|
| 工程纪律从"写代码"挪到了"构建 scaffolding" | [SDD 还有意义吗](../raw/community-posts/tencent-cloud-developer/2026-03-31-Harness-Engineering-来了SDD-还有意义吗.md), [Harness 即控制论](../raw/community-posts/tencent-cloud-developer/2026-04-17-一文讲透Harness-Engineering即控制论.md), [Harness 实践心得](../raw/community-posts/tencent-cloud-developer/2026-04-28-Harness-Engineering实践心得如何高效驾驭AI.md) | Spec、AGENTS.md、规则、约束、反馈回路才是产品的护栏,而不是更多的提示词 |
| Agent 看不到的就不存在 | [SDD 还有意义吗](../raw/community-posts/tencent-cloud-developer/2026-03-31-Harness-Engineering-来了SDD-还有意义吗.md), [Harness 即控制论 §2.2](../raw/community-posts/tencent-cloud-developer/2026-04-17-一文讲透Harness-Engineering即控制论.md) | 设计决策、架构约定、团队共识必须以版本化文件落进仓库 |
| AGENTS.md 要做"目录",不要做"百科" | [Harness 即控制论 §2.1](../raw/community-posts/tencent-cloud-developer/2026-04-17-一文讲透Harness-Engineering即控制论.md), [Skills 原理 §1.2](../raw/community-posts/tencent-cloud-developer/2026-03-13-一文搞懂爆火的SKills原理及实践案例.md) | 渐进式披露和 Skills 设计哲学:不是让 AI 知道更多,而是让 AI 在恰当时间知道恰当的事 |
| Multi-Agent 决策权要在 Harness 手里,不要交给 Planner | [Multi-Agent Harness 全拆解 §02](../raw/community-posts/tencent-cloud-developer/2026-05-13-从零设计生产级-Multi-Agent-Harness架构评估记忆成本与-MCP-工具接入全拆解.md), [4 亿 token 教训](../raw/community-posts/tencent-cloud-developer/2026-04-08-4亿token买来5个教训让6个AI-Agent连写4天代码发生了什么.md) | 让 Agent 出主意,让 Harness 拿决定;否则成本和稳定性都会失控 |
| 自进化的本质是 Prompt + 文件持久化,不是改模型 | [拆完 Hermes 源码](../raw/community-posts/tencent-cloud-developer/2026-05-12-拆完Hermes源码我发现Agent的自我进化根本不需要训练模型.md), [让 Skill 自己训练自己](../raw/community-posts/tencent-cloud-developer/2026-05-19-让Skill自己训练自己8阶段Loop3层评测5维AND门控从此实现自进化.md) | Skills 闭环:经验提取 → 存储 → 检索 → 注入 → 验证 → 改进,可以不动模型权重 |
| 主流 Coding Agent 已经从 RAG 退回 Grep + LLM | [RAG 已死,Grep 回归](../raw/community-posts/tencent-cloud-developer/2026-04-30-RAG已死不是Grep回归了.md), [200 行 Claude Code 青春版](../raw/community-posts/tencent-cloud-developer/2026-03-03-200行代码实现Claude-Code青春版.md), [Claude Code 12 条发现](../raw/community-posts/tencent-cloud-developer/2026-04-02-Claude-Code是怎么知道你在骂他的这-12-条发现值得关注.md) | Agent 内部本质是 while 循环 + 工具调用,搜索靠 LLM 驱动的 Grep 比 embedding 更实用 |
| 上下文质量是乘法因子,不是加法因子 | [QQ 音乐 Harness 实践 §2](../raw/community-posts/tencent-cloud-developer/2026-05-21-QQ音乐Harness-Engineering实践.md), [上下文工程万字长文](../raw/community-posts/tencent-cloud-developer/2026-01-07-Agent全面爆发万字长文详解上下文工程.md) | 公式 `代码产出 = AI 能力 × 上下文质量`;模型再强,上下文为零产出也是零 |
| 推翻"完美架构",先回到提示词本质 | [推翻完美架构](../raw/community-posts/tencent-cloud-developer/2026-02-27-AI-工程化落地实践推翻完美架构回归提示词本质.md), [SPEC 为什么会失败](../raw/community-posts/tencent-cloud-developer/2025-12-10-SPEC-为什么会失败.md) | 多 Agent / 多 Skill / 多流程会让团队花更多时间在"教 AI 走流程"上,而不是解决业务 |

## 3. 对已有 wiki 页的支撑

| 已有页面 | 本批新增的支撑 |
|---|---|
| [Harness Engineering](../concepts/harness-engineering.md) | 6 篇直接讲 Harness 的长文,补强六大组件、控制论、SDD、Multi-Agent Harness 视角;[Harness 实践心得](../raw/community-posts/tencent-cloud-developer/2026-04-28-Harness-Engineering实践心得如何高效驾驭AI.md) 给出"Prompt → Context → Harness"三时代对照表 |
| [渐进式披露](../concepts/progressive-disclosure.md) | [Skills 原理](../raw/community-posts/tencent-cloud-developer/2026-03-13-一文搞懂爆火的SKills原理及实践案例.md) 把 Skills 解释成"公共 Prompt + 中台思维 + 渐进式披露";[让 Skill 自己训练自己](../raw/community-posts/tencent-cloud-developer/2026-05-19-让Skill自己训练自己8阶段Loop3层评测5维AND门控从此实现自进化.md) 把 Skill 当成训练对象 |
| [Spec 驱动的 Agent 开发](../concepts/spec-driven-agent-development.md) | [SPEC 为什么会失败](../raw/community-posts/tencent-cloud-developer/2025-12-10-SPEC-为什么会失败.md) 给出 5 个真实失败模式;[SDD vs Harness](../raw/community-posts/tencent-cloud-developer/2026-03-31-Harness-Engineering-来了SDD-还有意义吗.md) 把 SDD 定位为 Harness 的"被放大的内容" |
| [Agent 评测体系](agent-evaluation-system.md) | [Multi-Agent Harness 全拆解](../raw/community-posts/tencent-cloud-developer/2026-05-13-从零设计生产级-Multi-Agent-Harness架构评估记忆成本与-MCP-工具接入全拆解.md) 把评估、记忆、成本、安全归为 Harness 五模块;[4 亿 token 教训](../raw/community-posts/tencent-cloud-developer/2026-04-08-4亿token买来5个教训让6个AI-Agent连写4天代码发生了什么.md) 给出"监控没用比没监控更危险"等真实负样本 |
| [OpenClaw / Claude Code / Hermes 三篇产品拆解沉淀](openclaw-claude-code-hermes-comparison.md) | 6 篇腾讯系作者的源码级拆解,补强 OpenClaw 双源记忆、上下文压缩、Hermes Skills 闭环、Claude Code Grep 与卧底模式等细节 |
| [Harness Engineering 中文社区 66 篇沉淀](harness-engineering-community-synthesis.md) | 39 篇与原 66 篇互相印证,把"中文社区共识"扩展到 100+ 篇 |

## 4. 对车载小爱 / DeepSeek 桌面端 Agent 的产品启示

1. AGENTS.md / 项目 Spec 不能写成百科,要写成 100 行内的目录,深层知识让 Agent 用工具按需读。
2. Multi-Agent 不要让 Planner 自己决定调度;预算、并发、安全、成本必须由 Harness 集中管控。
3. Skills / Memory 不要追求大,先把"出错 → 写一条规则 → 让它再也不犯"这个最小循环跑稳。
4. 评测不要只看模型分数,要在 Hooks / 日志 / 工具调用结果里建立可机读的过程信号,4 亿 token 教训那篇正反两面都给了样本。
5. 内部知识库 / RAG 走得动的前提是知识可演进,不可演进的 RAG 会被 LLM 驱动的 Grep + Skill 取代。

## 5. 来源与覆盖账本

- 索引: [community-posts/tencent-cloud-developer/INDEX.md](../raw/community-posts/tencent-cloud-developer/INDEX.md)
- 覆盖账本: [腾讯云开发者公众号 39 篇账本](../review/ingest-coverage/2026-05-26-tencent-cloud-developer-wechat-posts.md)

## 6. 相关页面

- [Harness Engineering](../concepts/harness-engineering.md)
- [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md)
- [渐进式披露](../concepts/progressive-disclosure.md)
- [Spec 驱动的 Agent 开发](../concepts/spec-driven-agent-development.md)
- [Agent 评测体系](agent-evaluation-system.md)
- [OpenClaw / Claude Code / Hermes 三篇产品拆解沉淀](openclaw-claude-code-hermes-comparison.md)
- [Harness Engineering 中文社区 66 篇沉淀](harness-engineering-community-synthesis.md)
