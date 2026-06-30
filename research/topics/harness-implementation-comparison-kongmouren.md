---
id: harness-implementation-comparison-kongmouren
type: topic
status: active
updated: 2026-06-09
sources:
  - wiki/raw/community-posts/harness-implementation-comparison/2026-06-03-kongmouren-harness-memory.md
  - wiki/raw/community-posts/harness-implementation-comparison/2026-06-09-kongmouren-harness-context-compaction.md
owners: ["zhouhao"]
when_to_load: "需要各家 Coding Agent 记忆/压缩的源码级一手对比证据、给 E4 补硬料时加载"
---

# 主流 Agent Harness 实现对比合集(孔某人的低维认知)

> 一个持续连载的源码级横评系列,逐字贴各家 prompt 做对比。对 E4「上下文与记忆篇」是最贴近"代码实际"的一手弹药,可直接对照、修正泛化叙述。

## 覆盖范围

| 篇 | 主题 | 覆盖产品 | 发布 |
|---|---|---|---|
| A1 | Memory(自动记忆) | Claude Code、Codex/Agents SDK、OpenClaw(番外)、OpenCode/Pi/Kimi Code(无原生) | 2026-06-03 |
| A2 | Context 压缩 | Claude Code、Codex/Agents SDK、OpenCode、Pi、Kimi Code、Hermes(番外) | 2026-06-09 |

版本基准: Claude Code 2.1.156、Codex 2026-06-01 main、openai-agents-js 0.11.6、OpenCode 1.15.13、Pi 0.78.0、Kimi Code 2026-06-02、OpenClaw 2026.6.2、Hermes 0.16.0。

## 代表性结论(可直接用于 E4)

- 记忆设计重点是"不记什么"和"不信什么";Agent 自己写的记忆默认不可信,召回前要核实。
- 两条记忆主线:Claude Code 增量编辑(快但易脏)vs Codex 批量挖掘(稳但慢)。
- compact 是分级泄压 checkpoint;各家 token 估算都用 bytes/4,很粗糙。
- Codex 压缩在服务端、只返回 encrypted_content,看不到明文 summary。
- Hermes 压缩注入 prompt 最完整:最新用户消息获胜、反转信号立即终止旧任务。
- Coding Agent 主流弃用传统 RAG 向量库,回到类 LLM-wiki;OpenClaw 仍重 RAG、实现质量被评最差。

## 已沉淀去向(成品页)

- [comparisons/harness-memory-compaction-implementation.md](../comparisons/harness-memory-compaction-implementation.md)
- [concepts/context-compaction.md](../concepts/context-compaction.md)
- [concepts/memory-synthesis-dreaming.md](../concepts/memory-synthesis-dreaming.md)
- [entities/claude-code.md](../entities/claude-code.md)
- [entities/codex.md](../entities/codex.md)
- [entities/openclaw.md](../entities/openclaw.md)

## 未覆盖范围

- 该系列声明会继续连载(Subagent、动态 workflow、非线性 context 等),后续篇章需另行入库。
- 本合集是单一作者视角的逆向分析,部分版本号是当时快照,引用具体数字/默认值时以官方/当前源码为准。
