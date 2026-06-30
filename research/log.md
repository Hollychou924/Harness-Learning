# Wiki Operation Log

> Append-only chronological record. Format: `## [YYYY-MM-DD HH:MM UTC] op | title`.
> Grep-friendly: `grep "^## \[" log.md | tail -10` shows last 10 ops.

## [2026-05-24 03:19 UTC] path-b | claude-code: 11 signals, score=0.60
## [2026-05-24 03:34 UTC] path-b | claude-code: 11 signals, score=0.60
## [2026-05-24 04:17 UTC] path-c | Claude Code vs Cursor -> 2 format(s)
## [2026-05-24 06:55 UTC] path-c | Claude Code vs Cursor, Codex -> 2 format(s)
## [2026-05-25 07:59 UTC] raw-ingest | 3 WeChat articles -> harness-engineering/4_特定框架
## [2026-05-25 08:08 UTC] wiki-synthesis | 66 Harness articles -> 3 concepts + 2 topics
## [2026-05-25 08:20 UTC] wiki-sop | add synthesis SOP + close 3 article loop
## [2026-05-25 08:34 UTC] wiki-triage | historical 63 Harness articles -> source-cards + coverage backlog
## [2026-05-25 12:20 UTC] official-ingest | Cursor 20 + Claude 29 official posts -> source-cards + Cursor/Claude/eval wiki
## [2026-05-25 12:50 UTC] official-ingest | Codex 20 official posts -> source-cards + Codex/Harness/eval wiki
## [2026-05-25 12:55 UTC] official-ingest | CodeBuddy 19 WeChat posts -> raw + source-cards + entity/concept/comparison wiki
## [2026-05-25 13:20 UTC] official-ingest | Qoder 24 WeChat posts -> raw + source-cards + entity/concept/comparison wiki
## [2026-05-25 13:55 UTC] official-ingest | Qoder 11 supplemental WeChat posts -> raw + source-cards + Harness/Experts/Review wiki
## [2026-05-26 06:00 UTC] community-ingest | 腾讯云开发者 39 WeChat posts -> raw + source-cards + Harness/Spec/Multi-Agent/Memory/Skills topic
## [2026-05-26 09:00 UTC] community-ingest | 阿里云开发者 59 WeChat posts -> raw + source-cards + Harness/Spec/Skills/Memory/Multi-Agent/Java/AGENTS.md topic
## [2026-05-26 11:00 UTC] community-ingest | 桌面 Agent 第三方横评 13 WeChat posts -> raw + source-cards + 三国杀/三大开源/架构哲学 topic
## [2026-05-26 12:30 UTC] community-ingest | Agent 评估 21 WeChat posts -> raw + source-cards + Anthropic 瑞士奶酪 / 阿里云运维 / 放我家 / 芝麻信用 deep-dive topic
## [2026-05-26 14:00 UTC] community-ingest | 亚马逊云开发者 Agentic AI 秘籍一→八 8 WeChat posts -> aws-cloud-developer raw + 八件套 playbook topic
## [2026-05-26 14:00 UTC] community-ingest | Agent 评估补充 5 WeChat posts (SnowThink/玄姐/LangChain/单元测试/毛毛Post) -> 并入 deep-dive 第 E 类
## [2026-05-26 16:00 UTC] book-ingest | AGENTWAY Harness Books 2 PDFs (88+54p) -> raw/books + Harness 十条原则 + Claude Code vs Codex 设计哲学 topic
## [2026-05-28 06:00 UTC] paper-community-ingest | Agent Harness Engineering Survey + 22 WeChat posts -> raw + source-cards + ETCLOVG concept + supplement topic
## [2026-06-08 02:50 UTC] memory-ingest | OpenAI Dreaming 官方发布页 + 4 篇中文解读(APPSO/智东西/AINLP/AGIPlayer) -> raw/official-posts/openai + raw/community-posts/chatgpt-memory-dreaming + concepts/memory-synthesis-dreaming;并更新 E4(Q6 记忆生命周期案例)/E7(偏好固化受治理)/E8(记忆系统量化范本)初稿
## [2026-06-09 ingest] community-ingest | 孔某人的低维认知 Agent Harness 实现对比 2 篇(Memory 2026-06-03 + Context 压缩 2026-06-09) -> raw/community-posts/harness-implementation-comparison + 2 source-cards + comparisons/harness-memory-compaction-implementation + concepts/context-compaction + topics/harness-implementation-comparison-kongmouren;并更新 entity(claude-code/codex/openclaw)与 concepts/memory-synthesis-dreaming;产出 E4 飞书初稿对照清单待用户决策
## [2026-06-14 16:30 UTC] community-paper-ingest | Harness 自进化 23 篇微信 + Meta-Harness/Arxiv 3 份资料 -> raw + concepts/harness-self-evolution + topics/harness-self-evolution-2026-06 + E7 重新规划
## [2026-06-14 16:50 UTC] source-card | 用户点名 Harness 自进化 5 篇 -> 补齐 source-cards + 更新专题/覆盖账本/index
