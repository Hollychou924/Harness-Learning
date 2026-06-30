---
id: harness-memory-compaction-implementation
type: comparison
status: active
updated: 2026-06-09
sources:
  - wiki/raw/community-posts/harness-implementation-comparison/2026-06-03-kongmouren-harness-memory.md
  - wiki/raw/community-posts/harness-implementation-comparison/2026-06-09-kongmouren-harness-context-compaction.md
owners: ["zhouhao"]
when_to_load: "对比各家 Coding Agent 的记忆/上下文压缩实现、判断记忆是增量编辑还是批量挖掘、compact 分级与触发、服务端压缩、cache 与压缩冲突时加载"
---

# 主流 Agent Harness 实现横评:记忆 + 上下文压缩

> 一句话: 各家 Coding Agent 的"上下文与记忆"差异,主要不在存什么,而在**怎么写、怎么压、谁来核实**。基于孔某人的低维认知两篇源码级逆向(2026-06-03 Memory 篇 + 2026-06-09 Context 压缩篇)。
>
> 版本基准: Claude Code 2.1.156、Codex 2026-06-01 main、openai-agents-js 0.11.6、OpenCode 1.15.13、Pi 0.78.0、Kimi Code 2026-06-02、OpenClaw 2026.6.2、Hermes 0.16.0。

## 一、自动记忆(Memory)横评

| 产品 | 有无原生自动记忆 | 写入路径 | 整合方式 | 召回 | 评价 |
|---|---|---|---|---|---|
| Claude Code | 有 | 增量编辑:主 Session 主动写 + 对话结束后 fork session 自动抽取(两路互斥) | Dream 离线整合(默认关闭),可结合 session 历史重 review | MEMORY.md 索引注入,需 LLM 主动召回 | 标准 baseline;大量篇幅在"限制记什么/怀疑召回什么" |
| Codex / OpenAI Agents SDK | 有 | 批量挖掘:新会话启动两阶段(Phase1 mini 模型并行提取 + Phase2 合并) | Phase2 整合进分层文件夹(memory_summary/MEMORY.md/skills/rollout_summaries) | 与 Claude Code 类似,quick memory pass | prompt 超长、信息密度偏低,更像 AI 写的;批量挖掘更稳但学习慢 |
| OpenClaw | 有(双套) | RAG 为主:每日日记 + SQLite 索引;压缩前额外触发一次提取 | light/REM/deep 三阶段心跳整合,**不用 LLM**(切 chunk + 关键词 + 文本相似度) | 关键词+向量混合,时间衰减;active-memory 插件可多轮主动召回 | 实现质量被评最差,非 LLM 时代做法;另有 memory-wiki(知识图谱式,默认关) |
| OpenCode | 无原生 | 第三方插件(opencode-supermemory / opencode-mem,后者含向量召回) | 视插件 | 视插件 | 偏 Claude Code 范式 |
| Pi / Kimi Code | 无原生 | — | — | — | 无自动 Memory |

两条主线判断:
- **增量编辑(Claude Code)**:响应快,但易混入低质量内容,所以要花大量 prompt 规定"不记什么"。
- **批量挖掘(Codex)**:挖掘质量高、更稳定,但学习慢、信息偏冗。
- 可混合 = 快记忆 + 稳定记忆两层,但都只是工程折中,没有完美解。

## 二、记忆的两条铁律(跨产品共识)

1. **不记什么**:代码模式/约定/架构/路径(读代码可得)、git 历史(git log/blame 为准)、调试套路、CLAUDE.md 已有内容、临时任务状态、密钥凭据。即使用户要求保存也排除。
2. **不信什么**:记忆点名的文件/flag 可能已被改名或删除——**行动前先核实**(查文件存在、grep flag);超过 1 天的快照式记忆附"可能过时,请对照当前代码"提醒;记忆与现状冲突时信现状并更新记忆。

这条直接对应一句产品判断:**Agent 自己写的记忆,默认不可信**。

## 三、上下文压缩(Compaction)横评

| 产品 | 压缩位置 | 分级/模式 | summary 形态 | 增量更新 | 特别处 |
|---|---|---|---|---|---|
| Claude Code | 本地 | 4 种:microcompact(清过期 tool result,默认关,60min 阈值)/ autoCompact(主动,环境变量可调)/ reactiveCompact(超限兜底)/ precomputedCompact(后台预压缩,默认关) | 明文,先 `<analysis>` 再 `<summary>`,9 段结构 | 无 | 局部压缩 Summarize up to/from here(配 rewind),后者=树形 context |
| Codex / Agents SDK | 多为服务端 | 3 路:本地 inline / 远程 v1(独立 endpoint)/ 远程 v2(session 末尾追加请求);OpenAI 模型默认 v1 | **不返回明文,只返 encrypted_content** | — | token 阈值排除开头固定 prompt;环境 context 差分注入,压缩后全量重注 |
| OpenCode | 本地 | 保留最近两轮原文 + 压前面 | 固定模板(Goal/Constraints/Progress/Decisions/Next Steps/Critical Context/Relevant Files) | **有**(锚定 summary 合并新事实) | 超大附件特殊处理;有类 microcompact 的 tool result 删除 |
| Pi | 本地 | 类 OpenCode + 切分位置/超大轮次优化 | 固定模板(含 [x]/[ ] 进度) | **有** | 树形分支切换时为丢弃分支生成分支摘要 |
| Kimi Code | 本地 | Full Compaction + Micro Compaction | 标准 summary | — | 较简单 |
| Hermes(番外) | 本地 | 清 tool result → 摘要 → 拼装 | 标准 | — | **压缩注入 prompt 最强**(见下) |

共性:**都用 bytes/4 估 token**,不用 tokenizer、不依赖服务端返回 context 数——精度其实很粗糙,所以才需要各种预防/兜底。

## 四、压缩后的"防幽灵"注入(Hermes 最完整)

Hermes 压缩后的导入 prompt 显式声明:摘要仅供参考、**最新用户消息获胜**、反转信号(停/撤销/回滚/换话题)立即终止旧任务、不要"先收尾旧任务"、MEMORY.md/USER.md 始终权威。这正面解决"压缩后 Agent 拿旧任务当当前任务"的体验坑,值得任何做长任务 Agent 的产品抄。

## 五、对车载小爱 / 消费级 Agent 的启示

- 记忆别只想"用 Redis 还是数据库",先想清"不记什么、不信什么"和"谁来核实",否则越攒越脏。
- 想要快响应就抄增量编辑,想要稳质量就抄批量挖掘;车载偏实时,可考虑两层(快记忆兜实时 + 离线挖掘保质量)。
- 压缩要按 checkpoint 设计、保住关键约束,并加一段 Hermes 式"最新指令获胜"的防幽灵注入,避免压缩后跑偏。

## 相关页面

- [concepts/context-compaction.md](../concepts/context-compaction.md)
- [concepts/memory-synthesis-dreaming.md](../concepts/memory-synthesis-dreaming.md)
- [entities/claude-code.md](../entities/claude-code.md)
- [entities/codex.md](../entities/codex.md)
- [entities/openclaw.md](../entities/openclaw.md)
- [topics/harness-implementation-comparison-kongmouren.md](../topics/harness-implementation-comparison-kongmouren.md)
