# Claude Code / Cursor 系列调研摘要（4篇）

## 04 · 三大 AI 编程 Agent 深度横评（CSDN）

**来源**：https://blog.csdn.net/John_ToStr/article/details/161548127 （注：该页 SSL 限制，核心观点经项目资料库 research/compiled/ 三方对比报告 + ClaudHQ 文章交叉核实）

**三者执行哲学对比**：
- **Codex**：终端原生、实时可审查、inline approve/reject、动作透明。定位"高效但偏技术"
- **Claude Code**：while 循环 + ReAct，最小脚手架+最厚护甲，"描述→计划→执行→测试→看结果"。定位"自主执行、大重构强"
- **Cursor**：IDE 原生，Composer 提一组 diff 让用户逐个 review。"描述→提diff→逐个review→接受/拒绝"。定位"精细控制、小改动强"

**透明-高效光谱**：
- 透明端：Claude Code(过程铺开) — Cursor(逐个确认) — Codex(实时审查但高效)
- 高效端：Codex(全自动审批) — Claude Code(信任结果) — Cursor(最慢但最可控)

**过程展示策略差异**：
- Codex：实时流式 + diff 核心展示，但非技术用户难懂 stdout/stderr
- Claude Code：过程较透明但容易"碎碎念"，工具调用逐步展示
- Cursor：过程收窄到 diff review，不展示底层工具调用

---

## 05 · Claude Code 架构深度剖析（稀土掘金）

**来源**：https://juejin.cn/post/7626020812118294528

**分层架构**：
- CLI入口层 → 终端UI层(Ink+React渲染) → 查询引擎层(query.ts/QueryEngine) → 工具系统层(30+工具) → 服务层(API/MCP/OAuth/Memory/Permission) → 状态管理层(AppStateStore, 100+字段)

**终端渲染实现**：
- 用 Ink(React for CLI) 渲染终端 UI，组件化
- 流式响应处理：SSE → 逐 token 渲染 → 用户"看着它写"

**动作块结构**：
- 每个工具调用是一个"动作块"：工具名 + 参数 + 状态(执行中/完成/失败) + 结果
- 动作块可折叠/展开

**权限确认阻塞逻辑**：
- 工具调用前查权限系统(Permission)
- 需审批时阻塞执行流，弹确认
- 用户拒绝 → 返回拒绝消息给模型 → 模型不重试，调整方案

**流式输出规则**：
- 模型输出 token 级流式
- 工具执行期间无模型输出(dead air)，用工具状态块填补
- 完成后最终消息流式输出

**对交互设计的启示**：
- "动作块"概念 = 小蓝鲸的"当前动作卡"，但 Claude Code 偏技术展示，小蓝鲸要转成"用户影响"表达
- 权限阻塞要平滑：不是卡死界面，而是任务状态切到"等待确认"
- dead air 必须用工具状态事件填补，否则用户以为卡了

---

## 06 · Claude Code vs Cursor: Definitive Comparison（ClaudHQ）

**来源**：https://claudhq.com/claude-code-vs-cursor-comparison/

**两种核心模式对比**：

**Claude Code（规划-执行-验证模式）**：
- "重构auth模块用JWT" → Claude 读现有代码 → 规划改动(哪些文件、什么顺序) → 逐个编辑 → 跑测试 → 读测试输出 → 修复失败 → 重复直到通过
- 用户看 git diff(完成后) 而非逐个审批
- 快，适合大改动，但用户有时会想"我会改得不一样"

**Cursor Composer（提案-审核模式）**：
- "描述改动" → Composer 生成一组 proposed diffs(多文件) → 用户逐个看 diff → 接受/拒绝 → 完成
- 慢，但每个改动都有精细控制

**多文件编辑对比**：
- Claude Code：信任结果，看最终 diff。适合大范围改动
- Cursor：逐个 review。适合针对性小改动

**终端集成**：
- Claude Code：终端是一等工具，每个 shell 命令都是工具，读输出并据此行动。核心循环就是 read-execute-iterate
- Cursor：集成终端(VS Code 继承)，Agent 模式能跑命令，但终端是编辑器的辅助

**对交互设计的启示**：
- 小蓝鲸应在两种模式间取平衡：默认"规划-执行-验证"(高效)，高风险操作降级到"提案-审核"(逐个确认)
- Code 工作台偏向 Claude Code 模式(信任结果看 diff)，Work 工作台偏向 Cursor 模式(产出前确认)
- 这正是小蓝鲸权限分级的价值：low 自动(规划-执行) / high 确认(提案-审核)

---

## 07 · Claude Code 动态工作流：while 循环凭什么干掉状态机（腾讯云）

**来源**：https://cloud.tencent.com/developer/article/2685109

**核心架构本质**：
```javascript
while (true) {
  response = await callModel(context)
  if (response.done) break
  result = await executeTool(response.toolCall)
  context.append(result)
}
```
- 一个 async generator 函数 queryLoop()，跑在所有 interface(CLI/SDK/IDE/Web) 都是同一个循环
- 决策逻辑只占代码库 1.6%，98.4% 是 operational harness(权限/压缩/工具/安全)

**Harness 层与模型层职责边界**：
- 模型层：推理和决策(下一步做什么)
- Harness 层：执行和反馈(执行工具、管理上下文、权限、安全)
- "最小脚手架，最厚护甲"：不用代码结构约束模型决策路径，而是给丰富运行时环境让它自己判断

**动态工作流 vs 静态 Pipeline**：
- 静态：下一步是代码写死的
- 动态(Claude Code)：下一步完全由模型在运行时根据 context 推断
- 代价：每步消耗模型推理 token

**五层 Context 压缩流水线**：
- 多层级压缩策略，从轻度摘要到深度压缩
- 目标：在二次增长问题下保持长会话可用

**七级权限光谱**：
- 从完全只读到完全自主的连续光谱
- 动态工作流的安全层

**对交互设计的启示**：
- 小蓝鲸的 7 步闭环是"宏观骨架"(给用户看阶段)，ReAct 是"微观机制"(实际执行)，两者是包含关系不是替代——这点和 Claude Code 的纯 while 循环不同，小蓝鲸给了用户可理解的阶段结构
- 压缩流水线在 UI 上必须产品化折叠，不暴露"轻度/中度/深度"
- 权限光谱 = 小蓝鲸的 Safe/Balanced/Auto 模式，但一期只做 Safe+Balanced，Auto 藏深
