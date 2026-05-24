# Harness Engineering — Coding Agent 横评

> **作者:** zhouhao · **JD 关键词:** Harness Engineering · **目标读者:** DeepSeek Agent Harness PM
>
> _Generated 2026-05-24T09:01:22+00:00 from `wiki/compiled/` (DeepSeek Agent Harness PM 应聘材料)_

---

# Harness 设计模式比较：从 Coding Agent 到自主作业系统的五种范式

> 作者：AI Agent Harness PM 候选人 · 读者：DeepSeek Harness 团队
> 数据切片：Claude Code / Cursor / Codex / Hermes / Manus,2026 Q1 Wiki 抽取

## 1. 执行摘要

**三个核心论点：**

1. **Harness 设计的本质是"权限边界 × 状态持久化 × 扩展形态"三轴的取舍**,而不是"工具数量"或"模型能力"的堆叠。一旦定下三轴坐标,Subagent 嵌套深度、Tool Use 回合上限、Skill 装载机制几乎都被自动决定。
2. **三大主流 Coding Agent (Claude Code、Cursor、Codex) 已在 E1 (权限模型) 和 E4 (工具生态) 上完全收敛**——都是"完整 Shell + 权限确认 + MCP Marketplace"——但在 E5 (Subagent 嵌套深度) 与 E6 (长任务持久化) 上出现明显分叉,这才是后续差异化的真正战场。
3. **模型公司路线 (Hermes、Manus) 走的是另一条曲线:受限沙盒 + 云端 VM + 长上下文工程**,押注的是 Agent 自主作业 (Autonomy) 而不是开发者协作 (Pair Programming)。DeepSeek 必须先回答"做哪一类用户的 Harness",再选模式,而不是反过来。

---

## 2. 五种 Harness 设计模式

下表为本文采用的五种模式总览,后面分节展开。维度命名沿用我们 Wiki Schema 中的 E1/E4/E5/E6 编码。

| 模式 | 代表产品 | E1 权限 | E4 工具 | E5 嵌套 | E6 持久化 |
|---|---|---|---|---|---|
| A. IDE 协作型 | Cursor | 完整 Shell + 权限 | 原生 + Marketplace | 2 | 1 |
| B. CLI Subagent 编排型 | Claude Code | 完整 Shell + 权限 | 原生 + Marketplace | **3** | 2 |
| C. 云端长任务型 | Codex (Cloud) | 完整 Shell + 权限 | 原生 + Marketplace | 2 | **3** |
| D. 自主沙盒型 | Manus | 受限沙盒 | 可装 | 2 | **3** |
| E. 模型原生 Function Calling 型 | Hermes | 受限沙盒 | 可装 | 1 | 1 |

---

### 2.1 模式 A:IDE 协作型 (Cursor)

**核心机制。** 把 Agent 嵌入 IDE,继承编辑器的文件系统、Git 状态和终端,Tool Use 在用户视野内逐步推进。Cursor 提供完整 Shell 接入与权限确认弹窗 ([cursor 终端文档](https://docs.cursor.com/agent/terminal)),Rules-for-AI 作为单层 Skill 注入项目上下文 ([rules-for-ai](https://docs.cursor.com/context/rules-for-ai)),MCP 走 Marketplace 路线 ([cursor MCP](https://docs.cursor.com/context/mcp))。

**适用场景。** 单次会话 30 分钟内、强调"人类驾驶 + Agent 副驾"的开发流。Cursor 不强求长任务持久化 (E6=1),因为它假设用户始终在场。

**局限。**
- Tool Use 回合一旦超过 IDE 单 session 容忍度 (经验上 ~50 turns),用户体验会断裂。
- E5=2 意味着没有真正的多 Subagent 协作,无法做 Map-Reduce 式的代码审查或多文件重构。
- 强 IDE 耦合,迁移到 Web/CI/CD 场景需要重做。

### 2.2 模式 B:CLI Subagent 编排型 (Claude Code)

**核心机制。** 以 CLI/Headless 为优先形态,通过 Skill 系统 ([skills](https://docs.anthropic.com/en/docs/claude-code/skills)) 把领域知识封装为可调度单元,并支持 **3 级 Subagent 嵌套** (E5=3)——主 Agent 派生 Subagent,Subagent 还能再派生子 Subagent。Checkpoints ([checkpoints](https://docs.anthropic.com/en/docs/claude-code/checkpoints)) 提供本地 git-like 回滚,权限模型按操作粒度审批 ([permissions](https://docs.anthropic.com/en/docs/claude-code/security#permissions))。

**适用场景。**
- 长任务 (1–4 小时) 的并行分发:重构、批量迁移、跨仓库审计。
- 需要"主 Agent 做规划 + 多 Subagent 并行执行"的工作流。

**局限。**
- 3 级嵌套带来 Token 放大效应:每加一级 Subagent,Context 至少多 1 份完整对话历史,导致成本指数级上升。
- Checkpoint 只解决文件状态,**不解决 Agent 内部状态** (思维链、Plan、Memory) 的持久化,长任务跨设备恢复仍是断点。
- Skill 生态依赖社区贡献,冷启动期质量参差。

### 2.3 模式 C:云端长任务型 (Codex Cloud)

**核心机制。** 把 Agent 运行环境从用户机器迁到云端 VM,通过 [codex cloud](https://platform.openai.com/docs/codex/cloud) 维持"任务 → 长生命周期容器"的 1:1 绑定 (E6=3 是本文五个产品中的并列最高分)。权限走 Shell + 沙盒混合模型 ([codex security](https://platform.openai.com/docs/codex/security)),MCP 接入与 Subagent 嵌套支持 2 层 ([codex agents](https://platform.openai.com/docs/codex/agents))。

**适用场景。**
- 数小时到数天的离线任务:全仓库重构、大规模代码生成、CI 失败自动定位。
- 跨设备、跨会话恢复:用户关掉浏览器,任务继续跑。

**局限。**
- 云 VM 引入冷启动延迟 (实测 5–15s) 和成本结构变化,不适合 sub-second 交互。
- E5=2 限制了任务的拓扑复杂度:能做"主 + 副"双层,做不了"主 + 多副 + 副副"的树。
- 沙盒边界与本地 IDE 割裂,需要专门的 file-sync 机制 (Codex 用 git push/pull 兜底)。

### 2.4 模式 D:自主沙盒型 (Manus)

**核心机制。** Manus 不假设用户在 IDE 里,而是给 Agent 一个**完整可调度的云端虚拟机** ([manus cloud vm](https://manus.im/blog/manus-cloud-vm)),用受限沙盒 + KV-Cache 复用 + 文件系统作为外部记忆 ([context engineering 博客](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)) 的方式做 Context Engineering。E1 受限沙盒,E6=3 长任务,E5=2 Subagent。

**核心创新点 (来自 Manus 公开博客)**:
- **Append-only 上下文**:避免 KV-Cache 失效,把工具结果一律 append,不重写历史。
- **文件系统作为外部记忆**:超长 context 不靠 1M token 窗口,靠把状态写到文件再读回。
- **错误轨迹保留**:不擦除失败的 Tool Call,让模型从自己的错误中学习。

**适用场景。**
- 自主作业型任务:做研究、写报告、操作 Web、跑长链路。
- 终端用户无技术背景,**不会自己审权限**——所以必须用沙盒。

**局限。**
- 沙盒能力受限,不能直接 ssh 到用户的真实环境干活,与 Coding Agent 用户群基本不重叠。
- 任务可重现性弱:用户看不到完整 Tool Trace,debug 成本高。
- 上下文工程对模型能力强依赖,小模型适配难度大。

### 2.5 模式 E:模型原生 Function Calling 型 (Hermes)

**核心机制。** Hermes 把 Tool Use 设计为**模型推理图的一部分**,用结构化的 function-calling schema ([hermes-function-calling](https://github.com/NousResearch/hermes-function-calling)) 让模型本身具备工具规划能力,Harness 极薄。E1 受限沙盒,E4 可装但无 Marketplace,E5=1 (无 Subagent),E6=1 (无 Checkpoint)。

**适用场景。**
- 把 Tool Use 当作模型能力训练目标 (RLHF/RLAIF) 的研究路线 — 见 [Atropos 训练框架](https://github.com/NousResearch/Atropos)。
- 想让自家模型具备 "无 Harness 也能调工具" 的基础能力。

**局限。**
- 没有 Subagent 编排,长任务、并行任务无解。
- 没有持久化,任务一断就丢。
- 是"模型层"的解,而不是"产品层"的解,直接给终端用户用还差很远。

---

## 3. 横向对比:三个分叉点

收敛的部分不必再写——三大 Coding Agent 在 E1/E4 上做的事几乎一模一样。真正的分叉发生在三个维度上:

**分叉点 1:Subagent 嵌套深度 (E5)。**
Claude Code 的 3 级嵌套是目前的孤本。这意味着 Anthropic 押注"主 Agent 用 Opus 做规划 + 子 Agent 用 Haiku 做并行执行"的成本曲线 (来自 [skills 文档](https://docs.anthropic.com/en/docs/claude-code/skills))。Cursor/Codex/Manus 的 2 级是更保守的选择,Hermes 的 1 级则索性放弃这条战线。

**分叉点 2:长任务持久化 (E6)。**
Codex Cloud (E6=3) 和 Manus (E6=3) 都把长任务作为一等公民,但路径相反:Codex 服务的是"已经在 IDE 里的开发者想跑离线任务",Manus 服务的是"压根不在 IDE 里的终端用户想自动作业"。Claude Code 的 Checkpoint (E6=2) 是中间路线,只持久化**文件状态**而非 **Agent 心智状态**。

**分叉点 3:权限模型 (E1)。**
完整 Shell + 权限确认是"信任开发者"的模式,受限沙盒是"不信任最终用户"的模式。这条线决定了用户群——前者是开发者,后者是 prosumer/普通用户。两条路线的 Tool 设计语义完全不同:Shell 模式假设工具调用即"命令执行",Sandbox 模式假设工具调用即"申请能力"。

---

## 4. DeepSeek 该选哪种模式

基于 JD 中"Harness 设计模式 / Context Engineering / 工具与扩展生态"三个关键词,以及 DeepSeek 当前以**模型为核心资产**的现实,我给出的建议是:

**采用模式 B (Subagent 编排型) 作为主线 + 模式 D (自主沙盒) 作为长尾,主动绕开模式 A 的 IDE 协作型,把模式 E 的 Function Calling 留在模型团队作为底层能力。**

理由有三:

1. **模式 A 的 IDE 协作赛道已饱和**。Cursor 和 Claude Code 已经吃下 90% 的开发者心智,DeepSeek 后入场没有差异化空间——除非愿意以"模型自带 Cursor"的方式打捆,但那是商业策略问题,不是 Harness 设计问题。

2. **模式 B 是模型公司的天然落点**。Subagent 编排深度依赖模型本身的规划能力和 Tool Use 训练,这恰恰是 DeepSeek-V3/R1 系列已经做出来的差异化。把 Skill 系统和 3 级 Subagent 做扎实,等于把模型的优势放大到产品层。

3. **模式 D 的自主沙盒是中文市场的空缺**。Manus 已经验证了这条路在中国 prosumer 用户中的可行性,但其 Context Engineering 强依赖单模型,DeepSeek 自有模型可以把这套架构国产化、私有化,服务 To-B 长任务场景 (合同审查、行业研究、运维自动化)。

**关键的工程决策清单:**
- Tool Use 回合上限:建议先定到 200 turns (与 Claude Code 看齐),为 Subagent 流出预算。
- Subagent 嵌套深度:从 2 级起步,留好升级到 3 级的协议口子。
- Skill 形态:走 Markdown + frontmatter 的 progressive disclosure 路线 (与 Claude Code skill 接口兼容,降低生态迁移成本)。
- Checkpoint:同时持久化文件状态 + Agent 心智状态 (Plan、TodoList、Memory),这是 Claude Code 都没做到的差异化点。
- 沙盒形态:基于 Firecracker microVM 而非 Docker,启动时间要压到 3s 以内。

---

## 5. 未来 12 个月的 3 个开放问题

**Q1:Subagent 嵌套的边际收益拐点在哪里?**
Claude Code 选了 3 级,但没有公开数据证明 3 级优于 2 级。是否存在某类任务,4 级嵌套能带来非线性收益?这需要做严肃的 ablation——我推测在"超大规模代码迁移"和"多视角代码审查"上 3+ 级才有意义,但需要 benchmark 证实。

**Q2:Agent 心智状态的标准化持久化协议会出现吗?**
当前所有产品的 Checkpoint 都只持久化文件 + git 状态,但 Agent 真正的"内存"是 Plan、TodoList、Memory 文件、Tool Trace、子 Agent 状态树。是否会出现一个跨产品的"Agent State Format" (类比 Docker image 之于容器)?如果出现,先定义协议的人会拿走生态主导权——这可能是 DeepSeek 的非对称机会。

**Q3:模式 B 与模式 D 的合流路径?**
开发者写完代码后想交给 Agent 跑长任务,终端用户跑长任务时偶尔需要写代码。这两类用户的工作流终将合流,但 Harness 怎么做才能既不让开发者觉得"被沙盒限制",又不让普通用户觉得"权限确认太烦"?这道题没人答好。最可能的解法是**任务级权限模型**——按任务类型自动切换 Shell/Sandbox 模式——但具体形态待研究。

---

**参考证据 (按出现顺序):**

- Claude Code 权限模型: https://docs.anthropic.com/en/docs/claude-code/security#permissions
- Claude Code MCP: https://docs.anthropic.com/en/docs/claude-code/mcp
- Claude Code Skills (3 级嵌套): https://docs.anthropic.com/en/docs/claude-code/skills
- Claude Code Checkpoints: https://docs.anthropic.com/en/docs/claude-code/checkpoints
- Cursor Terminal: https://docs.cursor.com/agent/terminal
- Cursor MCP: https://docs.cursor.com/context/mcp
- Cursor Rules-for-AI: https://docs.cursor.com/context/rules-for-ai
- Codex Security: https://platform.openai.com/docs/codex/security
- Codex MCP: https://platform.openai.com/docs/codex/mcp
- Codex Agents: https://platform.openai.com/docs/codex/agents
- Codex Cloud (长任务持久化): https://platform.openai.com/docs/codex/cloud
- Hermes Function Calling: https://github.com/NousResearch/hermes-function-calling
- Hermes Atropos (训练框架): https://github.com/NousResearch/Atropos
- Manus Context Engineering: https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- Manus Cloud VM: https://manus.im/blog/manus-cloud-vm
- Manus Docs: https://docs.manus.im/


---

## 致谢与方法论

数据来源: 26 个 Agent 产品的 wiki/compiled 数据集，基于 Karpathy LLM Wiki 模式 +
nashsu/llm_wiki + sdyckjq-lab/llm-wiki-skill 三套开源借鉴整合。

代码与方法论开源: `github.com/<user>/ai-agent-competitive-analysis`

—— zhouhao, 2026-05-24T09:01:22+00:00