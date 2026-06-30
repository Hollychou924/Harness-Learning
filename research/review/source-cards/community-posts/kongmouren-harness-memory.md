---
id: source-card-kongmouren-harness-memory
type: source-card
status: triaged
source: wiki/raw/community-posts/harness-implementation-comparison/2026-06-03-kongmouren-harness-memory.md
updated: 2026-06-09
---

# 社区卡 · 主流 Agent Harness 实现对比——Memory 篇(孔某人的低维认知)

## 原文信息

- 公众号: 孔某人的低维认知
- 发布: 2026-06-03(微信公众号 + 知乎首发)
- 原文: [raw](../../raw/community-posts/harness-implementation-comparison/2026-06-03-kongmouren-harness-memory.md)
- 性质: 基于真实源码 / 逆向(Claude Code 2.1.156 压缩 js、Codex 2026-06-01 main 快照、OpenClaw 2026.6.2 等)逐字贴 prompt 的横向对比,信号极高。

## 核心价值

目前少见的、把各家 Coding Agent 自动记忆机制拆到 prompt / 源码层面的一手横评。把"记忆"从产品概念落到实现:谁主动写、谁离线挖、写什么不写什么、召回前要不要核实、整合靠什么。直接给 E4「上下文与记忆篇」下半场补硬料。

## 关键结论

| 结论 | 对 wiki / E4 的影响 |
|---|---|
| 记忆设计重点是「不记什么」和「不信什么」,不是「记下来」 | 补强 E4 Q6;Claude Code prompt 大篇幅排除「代码模式/git 历史/调试套路/临时状态/密钥」 |
| Claude Code = 增量编辑:主 Session 主动写 + 对话结束后 fork session 自动抽取,二者互斥;MEMORY.md 索引 + item 文件;Dream 离线整合(默认关闭) | 更新 entity/claude-code + comparison + memory-synthesis-dreaming |
| Codex = 批量挖掘:新会话启动两阶段(Phase1 mini 模型并行提取 + Phase2 合并);用户主动改记忆只能写 ad_hoc note,不直接编辑 | 更新 entity/codex + comparison |
| 召回前必须核实:记忆点名的文件/flag 可能已失效,行动前先 grep/读文件;>1 天记忆附「可能过时」提醒 | 补 E4「自动记忆默认不可信」 |
| OpenClaw 双套(RAG 为主 + memory-wiki),实现质量被评最差(关键词/文本相似度、非 LLM 时代做法);DREAMS.md 是给人看的散文日记、不作召回源 | 更新 entity/openclaw + comparison |
| OpenCode/Pi/Kimi Code 无原生自动 Memory;OpenCode 有第三方插件(supermemory/mem,后者含向量召回) | comparison 覆盖「无原生记忆」一档 |
| Coding Agent 主流没用传统 RAG 向量库:单 workspace 记忆量不大、召回质量要求高,回到类 LLM-wiki | 补强「记忆不是存储方案选型」判断 |

## 已沉淀去向

- [comparisons/harness-memory-compaction-implementation.md](../../comparisons/harness-memory-compaction-implementation.md)
- [concepts/memory-synthesis-dreaming.md](../../concepts/memory-synthesis-dreaming.md)
- [entities/claude-code.md](../../entities/claude-code.md)
- [entities/codex.md](../../entities/codex.md)
- [entities/openclaw.md](../../entities/openclaw.md)
- [topics/harness-implementation-comparison-kongmouren.md](../../topics/harness-implementation-comparison-kongmouren.md)
