# Wiki Index

> Content catalog. Each page listed with one-line summary. LLM reads this first.
> Updated automatically by `wiki ingest` and `wiki compile`.

## Products
<!-- products section auto-managed -->

## Framework
- [wiki 沉淀 SOP](_framework/wiki-synthesis-sop.md) — 新素材从原文入库到 wiki 沉淀的强制流程。

## Topics
- [Harness 自进化专题综述](topics/harness-self-evolution-2026-06.md) — 23 篇微信 + Meta-Harness / Harness evolution 论文的第七章素材合成。
<!-- topics section auto-managed -->
- [Agent 评测体系](topics/agent-evaluation-system.md) — Agent 评测的离线、在线、反馈、成本和可靠性框架。
- [2026-05-28 Agent Harness 论文与中文文章补充沉淀](topics/harness-2026-05-28-supplement-synthesis.md) — Agent Harness Survey 论文 + 22 篇中文文章,沉淀 ETCLOVG 七层框架、失败复盘和落地方法论。
- [Agent 评估方法论深度合集 (26 篇)](topics/agent-evaluation-deep-dive.md) — Anthropic 瑞士奶酪 / Look at your data / 阿里云智能运维 / 大淘宝放我家 / 芝麻信用 / LangChain Deep Agents / 0→1 评测构建。
- [亚马逊云开发者 Agentic AI 实践指南秘籍合集 (8 篇)](topics/aws-cloud-developer-agentic-ai-playbook.md) — 开发→沙盒→记忆→MCP→身份→评估→可观测→安全 八件套官方连载。
- [AGENTWAY Harness Books 合集 (2 本 / 142 页)](topics/agentway-harness-books.md) — agentway.dev 两本系统性专著: Claude Code 设计指南 (Harness 十条原则) + Claude Code vs Codex 设计哲学比较。
- [Harness Engineering 中文社区 66 篇沉淀](topics/harness-engineering-community-synthesis.md) — 中文社区对 Harness Engineering 的共识、分歧和产品启示。
- [腾讯云开发者 Agent / Harness 合集 (39 篇)](topics/tencent-cloud-developer-agent-harness-collection.md) — 腾讯系工程师围绕 Harness、SDD、Multi-Agent、Skills、Memory 与 OpenClaw / Claude Code / Hermes 拆解的系列长文。
- [阿里云开发者 Agent / Harness 合集 (59 篇)](topics/aliyun-cloud-developer-agent-collection.md) — 阿里系工程师围绕 Harness、Spec、Multi-Agent、Skills、Memory、AGENTS.md 与 Qoder / OpenClaw / Hermes 的工程实践合集。
- [桌面 Agent 第三方横评合集 (13 篇)](topics/desktop-agent-third-party-comparisons.md) — 12 个独立公众号对 QoderWork / WorkBuddy / TRAE / OpenClaw / Hermes / OpenHuman / Antigravity 等桌面 Agent 的实测和选型对比。
- [OpenClaw / Claude Code / Hermes 三篇产品拆解沉淀](topics/openclaw-claude-code-hermes-comparison.md) — 用 Prompt / Context / Harness 三层框架对比 3 个 Agent 系统。
- [Agent Skills 设计、评估与维护(14 篇官方/权威合集)](topics/agent-skills-design-and-evaluation.md) — Anthropic / Perplexity / OpenAI / Cursor / Builder / GitHub / MCP 关于 Skill 怎么设计、评估、维护、与 Rules/Commands 的边界，含 E1-E8 弹药映射。
- [Harness 实现对比合集(孔某人的低维认知)](topics/harness-implementation-comparison-kongmouren.md) — 源码级逆向横评系列:Memory 篇 + Context 压缩篇,给 E4 补一手对照弹药。

## Entities
- [CodeBuddy](entities/codebuddy.md) — 腾讯 AI Coding / WorkBuddy 样本,强调 Skills、Hooks、Spec-Kit、Agent Teams 和企业系统连接。
- [Codex](entities/codex.md) — OpenAI 的本地、云端、多端和企业化 Coding Agent 样本。
- [Cursor](entities/cursor.md) — IDE 到 Agent 工作区演进的样本。
- [Qoder](entities/qoder.md) — 阿里 Qoder / QoderWork 样本,强调 Quest 任务流、团队知识引擎、沙箱、自动权限和 Cloud Agents。
- [OpenClaw](entities/openclaw.md) — 个人 Agent 操作系统式样本。
- [Claude Code](entities/claude-code.md) — 软件工程任务执行平台式样本。
- [Hermes Agent](entities/hermes-agent.md) — 自进化 Agent 样本。

## Concepts
<!-- concepts section auto-managed -->
- [Harness Engineering](concepts/harness-engineering.md) — Agent 的可控、可审计、可复用运行环境。
- [ETCLOVG Agent Harness 七层分类法](concepts/etclovg-agent-harness-taxonomy.md) — 把 Harness 拆成执行、工具、上下文、生命周期、可观测、评测、治理七层检查清单。
- [Prompt / Context / Harness 三层框架](concepts/prompt-context-harness.md) — 从指令、材料、执行环境三层拆解 Agent 产品。
- [Quest 模式的 Agent 开发](concepts/quest-mode-agent-development.md) — 以任务卡片、计划、状态、决策点和产物审查承接长任务。
- [Spec 驱动的 Agent 开发](concepts/spec-driven-agent-development.md) — 从 vibe coding 走向规约、计划、任务和验收闭环。
- [渐进式披露](concepts/progressive-disclosure.md) — Agent 技能和工具按需加载的核心机制。
- [Context 压缩(Compaction)](concepts/context-compaction.md) — 上下文窗口快满时的分级泄压 checkpoint:四级压缩、bytes/4 估算、服务端压缩、防压缩后任务漂移。
- [Harness 自进化](concepts/harness-self-evolution.md) — 把真实任务里的失败、接管和复盘，沉淀成规则、Skill、评测题和训练素材。

## Comparisons
- [CodeBuddy / Cursor / Claude Code 对比](comparisons/codebuddy-cursor-claude-code-comparison.md) — 腾讯 CodeBuddy 与两个头部 Coding Agent 的入口、Harness 和企业化差异。
- [Qoder / CodeBuddy / Cursor / Claude Code 对比](comparisons/qoder-codebuddy-cursor-claude-code-comparison.md) — Qoder 与三个头部 Coding Agent 的任务流、Harness 和企业化差异。
- [OpenClaw / Claude Code / Hermes 运行架构对比](comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md) — 三个 Agent 系统的 Prompt、Context、Harness 对比。
- [记忆 + 上下文压缩实现横评](comparisons/harness-memory-compaction-implementation.md) — 7 家 Coding Agent 的记忆(增量编辑 vs 批量挖掘)与压缩实现源码级对比。

## Timelines
- [Agent Harness 设计范式演进](timelines/agent-harness-design-evolution.md) — 从动态 Prompt 到自进化 Harness 的演进线。

## Lessons
- [只做 Prompt 不足以支撑生产级 Agent](lessons/prompt-only-agent-is-not-production.md) — 生产级 Agent 必须补齐 Context 与 Harness。

## Review
- [CodeBuddy 微信文章覆盖账本](review/ingest-coverage/2026-05-25-codebuddy-wechat-posts.md) — CodeBuddy / WorkBuddy 微信材料逐篇 source-card 和 wiki 去向。
- [Codex / OpenAI 官方文章覆盖账本](review/ingest-coverage/2026-05-25-codex-official-posts.md) — Codex 官方文章逐篇 source-card 和 wiki 去向。
- [Cursor / Claude 官方文章覆盖账本](review/ingest-coverage/2026-05-25-cursor-claude-official-posts.md) — 官方文章逐篇 source-card 和 wiki 去向。
- [Qoder 微信文章覆盖账本](review/ingest-coverage/2026-05-25-qoder-wechat-posts.md) — Qoder / QoderWork 微信材料逐篇 source-card 和 wiki 去向。
- [Qoder 微信文章补充账本](review/ingest-coverage/2026-05-25-qoder-wechat-posts-supplement.md) — Qoder 早期 Harness / Experts / Review 补充材料逐篇去向。
- [腾讯云开发者公众号 39 篇账本](review/ingest-coverage/2026-05-26-tencent-cloud-developer-wechat-posts.md) — 腾讯系作者 Agent / Harness 系列逐篇 source-card 与去向。
- [阿里云开发者公众号 59 篇账本](review/ingest-coverage/2026-05-26-aliyun-cloud-developer-wechat-posts.md) — 阿里系作者 Agent / Harness 系列逐篇 source-card 与去向。
- [桌面 Agent 第三方横评 13 篇账本](review/ingest-coverage/2026-05-26-desktop-agent-third-party-comparisons.md) — 第三方公众号桌面 Agent 横评/对比逐篇去向。
- [Agent 评估 21 篇账本](review/ingest-coverage/2026-05-26-agent-evaluation-wechat-posts.md) — Anthropic 评估体系 + 真实业务评测落地逐篇去向。
- [Agent 评估补充 5 篇账本](review/ingest-coverage/2026-05-26-agent-evaluation-supplement.md) — 0→1 评测构建/LangChain Deep Agents/玄姐评估体系补充入库。
- [亚马逊云开发者 8 篇账本](review/ingest-coverage/2026-05-26-aws-cloud-developer-wechat-posts.md) — Agentic AI 实践指南秘籍一→八连载逐篇去向。
- [AGENTWAY Harness Books 2 本账本](review/ingest-coverage/2026-05-26-agentway-harness-books.md) — Claude Code 设计指南 + Claude Code vs Codex 比较书入库与 wiki 沉淀。
- [Agent Harness 论文 + 微信补充材料账本](review/ingest-coverage/2026-05-28-agent-harness-paper-wechat-supplement.md) — Agent Harness Survey 论文 + 22 篇微信文章逐篇去向。
- [Harness 自进化 26 篇资料账本](review/ingest-coverage/2026-06-15-harness-self-evolution.md) — 自进化/自迭代/自演化资料逐篇去向，并重规划第七章。
- [Harness 自进化点名 5 篇知识卡](review/source-cards/community-posts/harness-self-evolution/) — Harness 进化对象、模型训练飞轮、Skill 生长、Agent Loop、Self-Harness 五个角度。
- [三篇文章入库覆盖账本](review/ingest-coverage/2026-05-25-harness-framework-3-articles.md) — 本批 OpenClaw / Claude Code / Hermes 的闭环检查。
- [历史 63 篇覆盖账本](review/ingest-coverage/2026-05-25-harness-historical-63.md) — 历史 Harness 文章逐篇 source-card 和待升级 backlog。
- [OpenClaw 单篇知识卡](review/source-cards/2026-05-25-openclaw-prompt-context-harness.md)
- [Claude Code 单篇知识卡](review/source-cards/2026-05-25-claude-code-prompt-context-harness.md)
- [Hermes Agent 单篇知识卡](review/source-cards/2026-05-25-hermes-agent-self-evolution.md)
