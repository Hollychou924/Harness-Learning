---
id: context-compaction
type: concept
status: active
updated: 2026-06-09
sources:
  - wiki/raw/community-posts/harness-implementation-comparison/2026-06-09-kongmouren-harness-context-compaction.md
  - wiki/raw/community-posts/harness-implementation-comparison/2026-06-03-kongmouren-harness-memory.md
owners: ["zhouhao"]
when_to_load: "讨论上下文压缩/compact、四级压缩链、token 预算、压缩 prompt 设计、服务端压缩、压缩与 cache 冲突、压缩后任务漂移时加载"
---

# Context 压缩(Compaction)

> 一句话定义: Context 压缩是上下文窗口快满时,让 LLM 把历史对话浓缩成 summary 替换原文的"泄压保命"机制;它是 checkpoint(保留可继续干活的关键状态),不是给对话做总结。

## 为什么重要

长任务跑几十轮,历史只增不减,迟早撑爆窗口。压缩是窗口的最后一道防线。但压坏了(压掉关键约束、污染缓存前缀、让 Agent 拿旧任务当当前任务)会直接毁掉体验——开篇那个"跑久了忘约束"的现象,根因之一就在这里。

## 关键事实(来自源码级逆向)

- **token 估算很粗糙**:Claude Code/Codex/OpenCode/Pi 等都用 `bytes/4` 估算,不用 tokenizer,也不依赖服务端返回的真实 context token 数。正因为粗,才需要各种预防和兜底。
- **本地压缩 vs 服务端压缩**:大多在本地做;Codex 对 OpenAI 模型走服务端压缩,且**不返回明文 summary,只返回 encrypted_content**(类似加密 thinking),所以 Codex 的压缩内容是看不到的。

## 分级压缩链(以 Claude Code 4 种为代表)

| 级别 | 程度 | 动作 | 触发 | 默认 |
|---|---|---|---|---|
| microcompact | 轻 | 清过期 tool result(顾及服务端缓存有效期,阈值 60min) | 轻微超量 | 关闭 |
| autoCompact | 中 | 主动压缩,规则触发,阈值可由环境变量调 | 达阈值 | 开启 |
| reactiveCompact | 重 | 服务端报超限时兜底,压更短历史+保留未压部分,大媒体裁剪 | prompt too long | 兜底 |
| precomputedCompact | — | 后台提前压缩再替换,降低用户等待 | 超阈值 | 关闭(服务端控) |

逐级降级:先清垃圾,不够再删冗余,再做摘要,最后熔断。还要防"无限循环不断请求压缩"(泄露版注释证实踩过)。

## 压缩 prompt 的两个工程要点

1. **强制只输出文本、禁用工具**:Claude Code 压缩 prompt 反复强调"不要调用任何工具,否则浪费唯一一轮并失败",并要求先写 `<analysis>` 再写 `<summary>`(推理模型之前的常见 trick)。Claude Code 的 9 段结构里专门有"列出所有用户消息""逐字引语防止任务理解漂移"。
2. **增量更新摘要**:OpenCode、Pi 实现了多轮压缩时"保留仍成立的、删过时的、合并新事实"的锚定 summary 更新;Claude Code 没有这个设计。

## 与 cache 的天然冲突

cache 要稳定前缀,compact 要动态改内容——一旦压缩动到稳定前缀就触发 cache miss。解法:把稳定 section(进缓存)与动态 compact state 分开,别让压缩污染前缀。

## 压缩后的"防幽灵"注入

压缩把旧任务浓缩进 summary 后,Agent 容易把旧任务当当前任务。Hermes 的导入 prompt 给出最完整解法:声明摘要仅供参考、**最新用户消息获胜**、反转信号(停/撤销/换话题)立即终止旧任务、MEMORY.md 始终权威。

## 非线性 / 树形 Context(早期探索)

压缩之外,降低主 context 消耗还有别的路:Subagent 返回执行概要(类似 summary)、Claude Code 的 Summarize from here(回退后压掉分支,保留之前 context 继续别的方向)= 类树形 context;前沿模型还能读 home 目录下历史 session 翻信息。目前各家在这方向探索都还少。

## 对车载小爱 / 消费级 Agent 的启示

- 压缩当 checkpoint 设计,关键约束永远在常驻区、不进压缩。
- 别迷信 token 估算精度,留足 Compact Buffer 让压缩有地方落脚。
- 加一段"最新指令获胜"的防幽灵注入,避免压缩后接着做用户已经叫停的事。

## 相关页面

- [comparisons/harness-memory-compaction-implementation.md](../comparisons/harness-memory-compaction-implementation.md)
- [concepts/memory-synthesis-dreaming.md](memory-synthesis-dreaming.md)
- [concepts/prompt-context-harness.md](prompt-context-harness.md)
- [concepts/etclovg-agent-harness-taxonomy.md](etclovg-agent-harness-taxonomy.md)
