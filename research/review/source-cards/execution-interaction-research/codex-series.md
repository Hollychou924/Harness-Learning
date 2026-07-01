# Codex 系列调研摘要（3篇）

## 01 · 深入解析 Codex 智能体循环（OpenAI 官方 / Michael Bolin）

**来源**：https://openai.com/index/unrolling-the-codex-agent-loop/ （英文原文，2026-01-23，已用 Scrapling stealthy-fetch 直接获取完整正文，存于 `raw-openai-codex-agent-loop.txt`，946行）

**核心概念（原文直接核实）**：
- **Agent loop（智能体循环）**：编排用户、模型、工具三者交互的核心逻辑。用户输入 → 组装prompt → 模型推理 → 解析输出（最终回复 or 工具调用）→ 若工具调用则执行并追加结果 → 重新查询模型 → 重复直到模型发出 assistant message
- **Turn（回合）**：从用户输入到 agent 响应的完整旅程。一个 turn 可包含多次 model inference 与 tool call 的迭代
- **Assistant message**：turn 的终止信号（如"我已添加你要求的 architecture.md"），控制权返回用户
- **Harness**：Codex 的核心运行时，提供 agent loop 和执行逻辑，是所有 Codex 体验（CLI/Cloud/VS Code）的底层

**Prompt 构建（原文直接核实，四角色优先级）**：
- 角色 priority 从高到低：system > developer > user > assistant
- 三个 JSON 字段：instructions（system/developer 消息）、tools（工具定义列表）、input（文本/图片/文件输入列表）
- Codex 在用户消息前插入的 input 项：
  1. role=developer 的沙箱权限说明（来自 workspace_write.md / on_request.md 模板，描述文件权限、网络访问、何时问用户）
  2. （可选）role=developer 的 developer_instructions（来自 config.toml）
  3. （可选）role=user 的 user instructions（聚合多源：AGENTS.override.md + AGENTS.md，从 Git root 到 cwd 逐级查找，32KiB 限制；skills 配置后注入）
- 工具定义包括：Codex 内置 shell 工具、内置 plan 工具（update_plan）、Responses API 提供的 web_search、用户配置的 MCP server 工具

**SSE 事件流（原文直接核实）**：
- response.reasoning_summary_text.delta/done：推理摘要增量
- response.output_item.added：新条目（工具调用/推理步）需追加到后续请求的 input
- response.output_text.delta：增量文本，支持 UI 流式
- response.completed：完成
- output_text.delta 事件支持 UI 流式；output_item.added 转为对象追加到后续 input

**Prompt Caching（原文直接核实，关键性能机制）**：
- 旧 prompt 是新 prompt 的精确前缀（intentional），使后续请求高效利用 prompt caching
- cache hit 使采样从二次变为线性
- 缓存失效（cache miss）的诱因：中途改 tools、改 model、改沙箱配置/approval mode/cwd
- MCP 工具尤其 tricky：server 可通过 notifications/tools/list_changed 动态改工具列表，中途处理会导致昂贵 cache miss
- 配置变更的处理：追加新消息而非修改旧消息（沙箱/approval 变更插 role=developer 消息，cwd 变更插 role=user 消息）

**Compaction（原文直接核实）**：
- 策略：token 超过阈值时 compact 对话，用更小的代表性 item 列表替换 input
- 早期需手动 /compact 命令；现 Responses API 有 /responses/compact 端点
- 返回列表含 type=compaction 的特殊 item，带 opaque encrypted_content 保留模型对原始对话的潜在理解
- 现已自动触发（auto_compact_limit 超限时）
- 无状态设计：不用 previous_response_id，保持请求完全无状态以支持 ZDR（Zero Data Retention）

**对交互设计的启示**：
- turn/iteration 区分 = "阶段"与"动作"映射的基础：一个 turn = 一个任务阶段，内部 iteration = 阶段内工具动作
- prompt caching 要求配置稳定 → 交互上不要让用户长任务中途频繁改配置（否则 cache miss 变慢变贵）
- compaction 自动触发 = UI 上用产品语言"整理上下文"展示，不暴露 token/compact
- 沙箱权限说明以 developer 角色注入 = 权限是 harness 层独立于模型的，模型不可绕过（呼应小蓝鲸 05 权限规则"权限门独立于模型"）

---

## 02 · The Codex CLI Agent Loop Explained（Daniel Vaughan）

**来源**：https://codex.danielvaughan.com/2026/04/18/codex-cli-agent-loop-explained/

**执行链路逐阶段**：
1. Prompt 组装 → 2. 模型推理(SSE流) → 3. 解析响应(有工具调用？) → 4.工具执行→结果追加→回到2 / 无工具调用→返回用户

**子任务展示策略**：
- 模型推理产生 reasoning 事件(推理步)和 function_call 事件(工具调用)
- output_item.added 事件让 UI 能实时追加新条目(工具调用计划、推理步)
- 流式 token 级输出让用户"看着它写"，感知2秒为"快"而非"坏"

**一个定位 bug 的完整 turn 示例**：
1. 首次推理：模型决定读测试文件 → function_call(shell, cat auth_test.go)
2. 工具执行：读文件，内容追加
3. 二次推理：看到测试代码，识别 bug → function_call(文件编辑修复)
4. 工具执行：应用编辑
5. 三次推理：决定跑测试 → function_call(go test ./...)
6. 工具执行：跑测试，输出追加
7. 四次推理：测试通过 → done 事件 + "已修复，测试通过"

**对交互设计的启示**：
- 一次任务 = 多轮"推理→工具→推理→工具"，UI 不该把每轮都铺成卡片，而是合并成"阶段 + 当前动作"
- "看着它写"的流式感知是信任基础，但长任务中不该全程流式铺开，要折叠
- 工具执行的"dead air"(执行中界面无变化)是信任杀手，必须有状态事件

---

## 03 · Inside the Codex Agent Loop: How Your Agent Actually Works（Daniel Vaughan）

**来源**：https://codex.danielvaughan.com/2026/03/28/codex-agent-loop-deep-dive/

**二次增长问题**：
- 每次发消息，整个对话历史都打包进 prompt
- Turn 1: ~2k tokens → Turn 5: ~15k → Turn 20: ~80k → Turn 50: 可能数百万
- 发给 API 的总数据量随 turn 数二次增长，成本也二次增长

**内置缓解机制**：
- /compact：把当前对话压缩成更短表示，释放上下文空间
- 子代理委派：把子任务拆给独立会话，主会话只收摘要结果
- Prompt 缓存：稳定前缀(kvg 状态)缓存命中率极高，边际成本增长远慢于二次增长

**重试隐藏规则**：
- 工具失败后模型会自动重试，但对用户隐藏重试过程(避免噪音)
- 但 compaction loop(反复压缩不前进)是已知问题 → 任务需要超出压缩能保留的上下文时，应拆分

**长输出截断策略**：
- 工具返回过长时截断，只保留关键部分进上下文
- 对 UI 影响：完整工具输出放 Trace 层，展示层只给摘要

**Prompt 缓存对前端展示的影响**：
- 改 AGENTS.md/工具/模型/目录会触发前缀失效 → 缓存命中下降 → 变慢变贵
- 设计启示：长任务中不要让用户/Agent 频繁改配置

**对交互设计的启示**：
- 长任务的"压缩"在 UI 上必须用产品语言("整理上下文")，不说 token/compact
- 历史步骤要折叠成阶段摘要，不让用户看到几十个原始步骤
- 工具输出过长时展示层截断 + 可下钻完整输出
- 重试对用户默认隐藏，失败才暴露
