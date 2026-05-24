# KV Cache / Prompt Cache — Coding Agent 横评

> **作者:** zhouhao · **JD 关键词:** KV Cache / Prompt Cache · **目标读者:** DeepSeek Agent Harness PM
>
> _Generated 2026-05-24T09:07:26+00:00 from `wiki/compiled/` (DeepSeek Agent Harness PM 应聘材料)_

---

# KV Cache / Prompt Cache 优化策略对比

## 1. Prompt Cache 是什么，为什么对 Harness 关键

Prompt Cache（也叫 KV Cache、Context Cache）是大模型推理引擎在 transformer attention 层对中间状态的缓存。当请求的前缀与已有缓存匹配时，模型跳过该段 KV 矩阵的重算，直接复用历史结果。对调用方来说有两个直接收益：

- **延迟降低**：首 token 时间（TTFT）从秒级降到百毫秒级
- **成本下降**：命中部分按基础价 10%–50% 计费，对长 system prompt 场景实际节省 50%–90%

对 Harness 来说，Prompt Cache 不是优化项，而是经济学基础设施。原因有三：

**第一，Harness 的请求结构高度可缓存**。一个典型 coding agent 单次请求由四段组成：system prompt（5k–20k tokens 的工具说明、风格指引）+ MCP 工具定义（2k–10k tokens）+ 历史对话（变长）+ 当前用户消息。前两段在整个 session 内不变，第三段是单调追加，只有最后一段变化。这是 prefix-stable workload 的教科书形态。

**第二，agent 任务普遍是多轮 turn**。一个写代码任务平均 20–50 个 tool call round，每一轮都重发完整上下文。如果没有 cache，等于把 system prompt 重传 50 次，按 Claude Sonnet 4.6 的 $3/Mtok 定价，单任务 input 成本会落在 $0.5–$2；有 cache 后降到 $0.05–$0.2。

**第三，cache 命中率直接决定 unit economics**。一个 fixed-price agent 产品（Cursor 的 Pro $20/月，Claude Code 的 Max $200/月）的毛利取决于平均 cache 命中率。命中率从 60% 提到 85%，毛利可能从 -10% 翻到 +40%。

DeepSeek Harness 团队需要把 cache 设计当作一等公民，从协议层、调度层、计费层三个层面同时考虑，而不是当作推理框架内部的实现细节。

证据：https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching ; https://platform.openai.com/docs/guides/prompt-caching

## 2. 五种 Cache 实现策略对比

下表汇总 5 个产品的 cache 策略选择：

| 产品 | 控制粒度 | TTL | 命中折扣 | 写入溢价 | 跨 turn 复用 | 跨 agent 复用 |
|---|---|---|---|---|---|---|
| Claude Code | 显式 cache_control breakpoint | 5min / 1h 可选 | 90% | 25% / 100% | 是 | 否（subagent 独立） |
| Codex | 自动前缀匹配 | 5–10min | 50% | 0% | 是 | N/A |
| Cursor | 透传上游 | 上游决定 | 上游决定 | 0% | 是 | 否 |
| Manus | 应用层 KV cache + 文件 offload | 自管理 | 自实现 | 自实现 | 是 | 是（file system） |
| Hermes | 无（函数调用专注） | N/A | N/A | N/A | N/A | N/A |

五种策略对应五种产品定位：

### 2.1 Claude Code（J5=3）

Anthropic 提供的 prompt caching 是行业里控制粒度最细的。开发者在请求中显式标注最多 4 个 `cache_control` breakpoint，每个 breakpoint 之前的内容被独立缓存。这种设计允许把 system prompt、tool definitions、对话历史、长文档分别 cache，按各自变化频率续约 TTL。Claude Code 客户端默认在 system prompt 和 tool definitions 后插入 breakpoint，多数会话能命中 90% 折扣。

证据：https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching

### 2.2 Codex（J5=2）

OpenAI 走自动路线。请求长度超过 1024 tokens 自动启用 cache，前缀以 128-token 块为粒度匹配。缓存 5–10 分钟内活跃部分保留，闲置后被 evict。命中部分按 50% input price 计费，无写入溢价。优点是开箱即用，缺点是开发者无法精确控制 cache 边界。

证据：https://platform.openai.com/docs/guides/prompt-caching

### 2.3 Cursor（J5=1）

Cursor 不公开自己的 cache 策略，而是把请求透传到底层模型（Claude / GPT / Gemini），享受上游 cache。这意味着 Cursor 自身不通过 cache 设计创造差异化，而是把 cache 收益通过 token 折扣定价让渡给用户。

证据：https://docs.cursor.com/account/pricing

### 2.4 Manus（J5=2）

Manus 在博客中明确写道："The KV-cache hit rate is the single most important metric for a production-stage AI agent." 它的策略是把 stable prefix 极大化（system prompt 几乎不变，工具列表用 mask 而非动态删减），并把易变内容（observation、long file content）下沉到文件系统作为外部记忆，避免污染上下文前缀。

证据：https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus

### 2.5 Hermes（J5=1）

Hermes Function Calling 是 NousResearch 的开源 fine-tune，关注点是函数调用准确率而非 cache 经济学。本地部署场景下 cache 由推理框架（vLLM、SGLang）处理，应用层无需关心。

证据：https://github.com/NousResearch/hermes-function-calling

## 3. 每策略的命中率、成本下降、失效机制

### 3.1 Claude Code

- **命中率（实测）**：典型 coding session 在 10 turn 后稳定在 85%–92%，长文档读取场景可达 95%+
- **成本下降**：cache write 比 base input 贵 25%（5min TTL）或 100%（1h TTL），cache read 仅为 base input 的 10%。多轮对话下盈亏平衡点在 2–3 turn，之后每 turn 节省 ~80%
- **失效机制**：任何 breakpoint 之前的内容变化、TTL 过期、显式不带 cache_control 的请求都会触发失效。Claude Code 客户端会在 tool definition 顺序变化、system prompt 修改时主动续约 TTL
- **坑**：cache_control breakpoint 上限 4 个，超出会静默失败（按未 cache 计费），团队需要监控 `cache_creation_input_tokens` 占比

证据：https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching

### 3.2 Codex

- **命中率（估算）**：社区实测在 prefix-stable workload 下 70%–85%，短对话或频繁修改 system prompt 的场景仅 30%–50%
- **成本下降**：50% 输入折扣。比 Anthropic 的 90% 折扣弱，但无写入溢价、零配置
- **失效机制**：5–10 分钟闲置后 evict，前缀任何 byte 变化即失效。OpenAI 不暴露 cache key，无法跨 organization 复用

证据：https://platform.openai.com/docs/guides/prompt-caching

### 3.3 Cursor

- **命中率**：依赖上游模型，Cursor 自身不发布数据
- **成本下降**：Pro 套餐下"快速请求"（500/月）不计 cache 差，"慢速请求"按上游 cache 折扣计费。用户感知到的"额度"已经隐含 cache 假设
- **失效机制**：Cursor 的多文件 context 重排（@-mentions、自动 file inclusion）会破坏前缀稳定性，是隐形 cache miss 来源

证据：https://docs.cursor.com/account/pricing

### 3.4 Manus

- **命中率（自报）**：Manus 优化后单任务 cache hit rate 接近上限（前缀部分 ~100%）
- **成本下降**：通过 file system offload 把上下文从 50k+ tokens 压到 5k 级，配合 cache 折扣，单任务 LLM 成本降到 1/10
- **失效机制**：Manus 设计了 append-only context、stable tool ordering、masked tool selection 三条原则避免缓存污染。file system 充当 swap，让前缀永远 stable

证据：https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus

### 3.5 Hermes

- **命中率**：N/A（推理框架层处理）
- **成本下降**：取决于自托管 vLLM / SGLang 配置
- **失效机制**：N/A

## 4. Cache 与 Subagent / Long Task 的相互作用

Cache 设计在两个场景下会被放大检验：subagent fan-out 和 long-running task。

### 4.1 Subagent fan-out 的 cache 失效

Claude Code 的 sub-agent（Task tool）在主 agent 上下文之外开新 session，每个 subagent 都要重新 cache write 一次 system prompt。如果一个 task 派出 5 个并行 subagent，cache write 成本是 5 倍 base input 价格（1h TTL 下相当于 5 倍未 cache 价）。

DeepSeek 设计 subagent 协议时有两种选择：

1. **共享 cache**：父子 agent 复用同一 cache key，subagent 启动 0 成本但失去隔离性
2. **独立 cache + 模板复用**：subagent 用预 warm 好的模板 cache，零冷启动同时保持上下文隔离

第二种是 Anthropic 和 Manus 都在尝试的方向，但目前没有成熟产品级实现。

### 4.2 Long-running task 的 TTL 不够

5 分钟 TTL 对 coding agent 太短。一个调试任务可能在 10 分钟思考 + 等用户反馈循环里反复进出 cache。Anthropic 提供的 1h TTL 写入溢价 100%，等于把 cache write 成本翻倍，需要 turn 数 ≥ 5 才能盈亏平衡。

Manus 的应对是把"应该 cache 但不会被频繁访问的"内容（长文档、调用历史）写到文件系统，agent 用文件读写代替 in-context memory，从根本上规避 TTL 限制。

证据：https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus

### 4.3 Hermes 在长任务下的劣势

fine-tune 模型自托管场景下 KV cache 由推理引擎管，但同一 GPU 实例的并发 session 会争抢 KV cache 内存。一个 80GB H100 只能同时维持 ~10 个 32k context session 的 KV cache。Long task 时段，新 session 触发 evict 老 session 的 cache，hit rate 雪崩。

## 5. DeepSeek Cache 设计 5 条建议

### 建议 1：协议层提供显式 cache_control，不仅依赖自动前缀匹配

OpenAI 的自动模式在简单场景够用，但 agent harness 需要把 system prompt、tool definitions、user-provided files 分别管理 TTL。DeepSeek API 应该在请求 schema 里允许 client 标注 cache_control breakpoint（上限 4–8 个），并在返回 usage 里区分 `cache_creation` 和 `cache_read` tokens。

### 建议 2：默认 5min TTL，可选 1h / 24h，大客户议价 7d

Anthropic 的 1h TTL 已经覆盖 80% 的 coding session 但价格陡（write 溢价 100%）。DeepSeek 可以在 1h 之上提供 24h（write 溢价 50%）和企业版 7d（write 溢价 30%）。这对 IDE 类客户（Cursor / Continue / Cline）是核心吸引力——同一开发者一天内打开同一项目多次，长 TTL 把 cache 利用率从 30% 拉到 80%+。

### 建议 3：Tool definition 区段独立 cache、独立计费

工具定义在 MCP 生态里会膨胀到 5k–15k tokens。如果跟 system prompt 合并 cache，任何工具新增都使整个前缀失效。建议在请求 schema 提供 `tool_definitions` 顶级字段（不是塞进 system message），服务端单独 cache，并允许客户端显式声明"工具列表自上次请求未变"以跳过 cache 续约 write。

### 建议 4：Subagent cache 共享机制（父子 agent token-pool）

DeepSeek 应在协议层提供 `parent_cache_id`。subagent 启动时声明 parent_cache_id，服务端做权限校验后让子 agent 直接 read 父 cache 的 system+tools 段，仅对差异部分（subagent-specific instruction）做 cache write。这能把 subagent 启动成本从 5–10 倍降到 0.5 倍，是目前所有商用 API 都缺失的能力。

### 建议 5：计费透明度——usage 字段区分 cache_creation / cache_read / non_cached

财务侧最大的痛点不是单价，是"账单为什么涨了"。DeepSeek 的 billing API 应在每次响应返回三类 input token 数（cache_creation、cache_read、non_cached）和对应价格，让客户端能在每个请求实时计算成本，把 unit economics 做到 dashboard。

### 训练团队补充：前缀稳定性必须进入 SFT 数据采样

模型训练阶段就要把"前缀稳定性奖励"内化进数据采样。如果训练数据普遍带高变化率的 system prompt（如随机重排工具列表），模型会学会依赖位置特征，反而让推理时的 cache 失效更频繁。建议 SFT / RLHF 数据采样时锁定 tool ordering、stable persona block，让模型对前缀稳定性的依赖与推理时的 cache 假设对齐。

---

DeepSeek 在 cache 设计上的差异化机会比模型能力更明显——前者是协议、计费、调度的工程组合，后者是 6 个月起的训练周期。把 5 条建议中至少 3 条做到位，单 token 经济性就能压过 Codex（自动但粗糙）、追平 Claude Code（精细但 TTL 短），并在 subagent 场景反超所有现存竞品。


---

## 致谢与方法论

数据来源: 26 个 Agent 产品的 wiki/compiled 数据集，基于 Karpathy LLM Wiki 模式 +
nashsu/llm_wiki + sdyckjq-lab/llm-wiki-skill 三套开源借鉴整合。

代码与方法论开源: `github.com/<user>/ai-agent-competitive-analysis`

—— zhouhao, 2026-05-24T09:07:26+00:00