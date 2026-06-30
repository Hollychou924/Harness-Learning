---
id: source-card-kongmouren-harness-context-compaction
type: source-card
status: triaged
source: wiki/raw/community-posts/harness-implementation-comparison/2026-06-09-kongmouren-harness-context-compaction.md
updated: 2026-06-09
---

# 社区卡 · 主流 Agent Harness 实现对比——Context 压缩篇(孔某人的低维认知)

## 原文信息

- 公众号: 孔某人的低维认知
- 发布: 2026-06-09(微信公众号 + 知乎首发),系列第二篇
- 原文: [raw](../../raw/community-posts/harness-implementation-comparison/2026-06-09-kongmouren-harness-context-compaction.md)
- 性质: 基于源码/逆向逐字贴压缩 prompt 的横评。覆盖 Claude Code 2.1.156、Codex 2026-06-01、openai-agents-js 0.11.6、OpenCode 1.15.13、Pi 0.78.0、Kimi Code、(番外)Hermes 0.16.0。

## 核心价值

把"Context 压缩"从抽象概念拆到各家真实实现:触发时机、切分策略、prompt 模板、是否本地/服务端、是否增量更新。直接补 E4 上半场「四级 compact」「section→cache」的实现级对照,并校准两个常被讲错的细节。

## 关键结论

| 结论 | 对 wiki / E4 的影响 |
|---|---|
| 所有框架 token 估算都用 bytes/4 粗算,不用 tokenizer、不依赖服务端返回 context 数 | 校准 E4「token 预算」叙述:精确度其实很粗糙 |
| Claude Code 4 种压缩:microcompact(清过期 tool result,默认关,阈值 60min)/ autoCompact(主动,环境变量可调)/ reactiveCompact(超限兜底)/ precomputedCompact(后台预压缩,默认关) | 校准 E4 四级 compact 命名;补 precomputed 一档 |
| Claude Code 压缩 prompt = 先 <analysis> 再 <summary>;9 段结构(含 All user messages、逐字引语防漂移);强约束「只输出文本不调工具」 | 给 E4 compact 实现细节补一手 prompt 证据 |
| Claude Code 局部压缩:Summarize up to here / from here(配合 rewind),后者=回退后压掉分支、类树形 context/Subagent 隔离 | 新增「非线性 context」要点 |
| Codex 压缩 3 路(本地 inline / 远程 v1 / 远程 v2);OpenAI 模型走服务端,默认 v1;不返回明文 summary,只返回 encrypted_content | 更新 entity/codex;校准「Codex 压缩在服务端、不可见」 |
| OpenCode/Pi 用固定模板(Goal/Constraints/Progress/Next Steps...),且实现多轮压缩的增量 summary 更新(Claude Code 没有这个) | comparison 覆盖「模板化+增量摘要」一档 |
| Hermes 压缩注入 prompt 最强:显式声明「摘要仅供参考、最新用户消息获胜、反转信号立即终止旧任务、MEMORY.md 始终权威」 | 新增 lesson 候选:压缩后防「旧任务幽灵」 |

## 已沉淀去向

- [comparisons/harness-memory-compaction-implementation.md](../../comparisons/harness-memory-compaction-implementation.md)
- [concepts/context-compaction.md](../../concepts/context-compaction.md)
- [entities/claude-code.md](../../entities/claude-code.md)
- [entities/codex.md](../../entities/codex.md)
- [topics/harness-implementation-comparison-kongmouren.md](../../topics/harness-implementation-comparison-kongmouren.md)
