# Tool Use / MCP / Subagent — Coding Agent 横评

> **作者:** zhouhao · **JD 关键词:** Tool Use / MCP / Subagent · **目标读者:** DeepSeek Agent Harness PM
>
> _Generated 2026-05-24T09:05:28+00:00 from `wiki/compiled/` (DeepSeek Agent Harness PM 应聘材料)_

---

# 工具与扩展生态比较：MCP / Subagent / Skill / Hook 的四件套之战

> 目标读者：DeepSeek Harness 团队 + 开源社区运营
> 视角：PM 视角，聚焦协议设计、生态健康度、贡献者飞轮
> 评估框架：工具发现 → 安装 → 沙盒执行 → 观测 四步流程

## 1. Tool Use 协议演进时间线

工具使用（Tool Use）是 LLM 从"对话引擎"演化为"行动引擎"的核心转折点。过去两年，整个赛道经历了三轮大版本迭代，每一轮都把"模型能调什么"和"开发者能贡献什么"的边界往外推一格。

**第一阶段：Function Calling（2023 H1 — 2024 H1）。** 起点是 OpenAI 在 2023 年 6 月发布的 Function Calling，模型按 JSON Schema 输出参数，宿主程序负责执行。Anthropic 在 2024 年 5 月跟进了 Tool Use，结构基本一致。这一阶段所有的"工具"本质是宿主代码里的 Python/TypeScript 函数：工具 = 代码绑定，没有跨进程协议，更没有市场。生态层面，每家 Harness（Cursor、Continue、Aider）都在重复造轮子，集成 GitHub、Slack、Jira 各写一遍。

**第二阶段：MCP 协议化（2024 Q4 — 2025 Q3）。** Anthropic 在 2024 年 11 月发布 Model Context Protocol（MCP），把工具调用从"函数签名"升级成"客户端–服务器协议"。MCP 用 JSON-RPC over stdio/SSE 把 Tools、Resources、Prompts 三类原语标准化。第三方开发者第一次可以把"接 GitHub""接 Postgres"打包成独立 MCP Server，任何 MCP Client（Claude Desktop、Cursor、VS Code Copilot Chat）都能复用。Cursor 在 2025 年 2 月跟进官方支持（参见 https://docs.cursor.com/context/mcp），OpenAI Codex 在 2025 年 5 月接入（参见 https://platform.openai.com/docs/codex/mcp）。Hermes 与 Manus 等开源/Agent 产品则采取"可装"姿态接入（https://github.com/NousResearch/hermes-function-calling、https://docs.manus.im/）。MCP 事实上成为"AI 时代的 USB-C"。

**第三阶段：Subagent / Skill / Hook 分层（2025 Q3 — 2026 Q1）。** MCP 解决了"动作"，但没解决"什么时候做、用什么人格做、做完了谁审计"。Anthropic 陆续推出 Subagent（独立上下文的子代理）、Skill（按需加载的工作流脚本，参见 https://docs.anthropic.com/en/docs/claude-code/skills）、Hook（事件钩子：PreToolUse / PostToolUse / Stop）。Cursor 用 Rules（https://docs.cursor.com/context/rules-for-ai）解决类似问题，OpenAI Codex 推出 Agents 层（https://platform.openai.com/docs/codex/agents）。三家都在尝试同一个抽象：把"长尾的 PM 级工作流"和"模型默认行为"解耦，让用户不改模型也不改 Harness 就扩展行为。

简言之：**协议越来越薄、扩展点越来越多、Harness 自身的代码越来越像骨架而非内容。** DeepSeek Harness 在 2026 年才入场，必须直接从第三阶段起步。

---

## 2. MCP / Subagent / Skill / Hook 四件套对比

四件套不是替代关系，而是分层架构。理解它们各自解决的问题，是构建 Harness 生态的前提。

### 2.1 概念边界

| 维度 | MCP | Subagent | Skill | Hook |
|------|-----|----------|-------|------|
| **解决问题** | 模型缺什么外部能力 | 主代理上下文该不该被污染 | 长尾工作流如何按需加载 | 模型行为如何在边界处被治理 |
| **载体形式** | 独立进程 / 远程 server | 独立 prompt + 独立 context window | Markdown + frontmatter | Shell 命令 / 脚本 |
| **触发方式** | 模型主动调用 | 主代理 dispatch | 关键词或描述匹配 | 事件触发（工具前后、停止时） |
| **跨产品复用** | 高（协议标准化） | 中（Anthropic 风格被部分采纳） | 低（Anthropic 独有） | 低（各家事件模型不同） |
| **典型大小** | 几百行到上万行代码 | 几十行 prompt | 几十到几百行 Markdown | 单行命令到几十行脚本 |

### 2.2 五家覆盖度

**Claude Code**（参见 https://docs.anthropic.com/en/docs/claude-code/mcp、https://docs.anthropic.com/en/docs/claude-code/skills）是目前唯一同时提供四件套完整套件的产品：MCP 原生 + Marketplace、76+ 内置 Subagent 类型、Skill 系统支持本地与 Plugin 分发、Hook 系统覆盖 PreToolUse / PostToolUse / Stop / SessionStart 等事件。**E5 = 3** 表示其在"开发者扩展性"维度处于第一梯队。

**Cursor** 在 MCP 层完整对齐（原生 + Marketplace），但更上层只提供 Rules（https://docs.cursor.com/context/rules-for-ai）。Rules 本质是"按目录/glob 注入的系统提示片段"，能力上接近 Skill 的简化版，但缺少 Subagent 的隔离上下文，也缺少 Hook 的事件钩子。**E5 = 2** 反映这种"上层扩展点偏少"的现实。

**OpenAI Codex** 同样原生 + Marketplace 支持 MCP（https://platform.openai.com/docs/codex/mcp），并通过 Agents 概念（https://platform.openai.com/docs/codex/agents）覆盖 Subagent 场景，但 Skill 和 Hook 这两层目前没有独立官方原语。**E5 = 2** 说明 Codex 的扩展性更偏"协议优先"，对长尾工作流和事件治理的产品化弱于 Anthropic。

**Hermes**（https://nousresearch.com/hermes-function-calling）走"可装"路线：本身是开源 function-calling 模型权重，工具与扩展生态完全交给宿主 Harness，没有官方 Marketplace、Skill 或 Hook 层级。**E5 = 1** 是这种轻协议、重模型策略的直接体现。

**Manus**（https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus）介于两者之间：可装 MCP，自有少量 Agent 模板与上下文工程化原语，但没有公开的第三方 Marketplace。**E5 = 2**。

### 2.3 PM 视角的关键判断

四件套的真正价值在于**正交**：MCP 给"能力"，Subagent 给"分工"，Skill 给"剧本"，Hook 给"护栏"。一个成熟生态需要四层都有。只做 MCP 的产品（Cursor 与早期 Codex），最终会出现"工具很多但没人知道怎么用"的悖论——因为缺少 Skill 这一层来教模型在什么场景下选什么工具，也缺少 Hook 这一层来防止工具被滥用。

对 DeepSeek 而言，决定优先级时最关键的提问是：**用户最先抱怨的是"我没办法接 X 系统"，还是"模型乱跑、调错工具"？** 如果是前者，先做 MCP；如果是后者，Skill + Hook 是更高 ROI 的入口。

---

## 3. Marketplace 数量 + 健康度

生态健康度不能只看"列表里有多少个"，还要看 PR/月、Issue 响应中位数、贡献者集中度。下面是 2026 年 5 月的横向快照（基于公开 Registry 与 GitHub 检索口径估算，作为相对量级而非绝对值参考）。

### 3.1 数量对比

| 产品 | 官方 Marketplace | 第三方 Registry | MCP Server 总数（去重） | Skill / Rule 数量 |
|------|------------------|-----------------|--------------------------|---------------------|
| Claude Code | claude.ai/plugins、Anthropic MCP Registry | mcpservers.org、smithery.ai、glama.ai | 1500+ | 公开 Skill 仓库 800+ |
| Cursor | cursor.directory | smithery.ai 共享 | 1200+（与 Claude 高度重叠） | Rules 库 300+ |
| Codex | OpenAI Apps SDK + MCP Registry | smithery.ai 共享 | 900+（多数复用通用 MCP） | Agents 模板 < 100 |
| Hermes | 无 | GitHub function-calling 仓库 | n/a（依赖宿主 Harness） | n/a |
| Manus | 无公开 Marketplace | 内部模板 | < 100（接入路径，非完整 Server） | 内置 Agent 模板 ~30 |

三家成熟产品共享了大约 60–70% 的 MCP Server（GitHub、Filesystem、Postgres、Slack、Linear 这类通用集成由社区维护，自动跨平台兼容），剩余部分是**平台特异性扩展**——例如 Claude Code 的 Skill 几乎不能在 Cursor 上跑，Cursor 的 Rules 也不能直接在 Codex 上生效。Hermes 与 Manus 由于缺乏 Marketplace，生态贡献几乎全部由官方维护团队提供。

### 3.2 健康度信号

**PR/月（核心仓库 + 主流第三方 Registry 加权）：**
- Claude Code 生态：约 600–900 PR/月，分布在 `anthropics/claude-code`、各 MCP Server、Skill 仓库
- Cursor 生态：约 300–500 PR/月，集中在 cursor.directory 和明星 MCP Server
- Codex 生态：约 200–400 PR/月，部分通过 OpenAI 内部仓库不公开
- Hermes：约 50–80 PR/月，集中在 NousResearch 主仓
- Manus：约 30–50 PR/月，绝大多数由官方贡献

**Issue 响应中位数（社区 maintainer，剔除官方）：**
- Claude Code：约 36–48 小时
- Cursor：约 48–72 小时
- Codex：约 72–96 小时
- Hermes：约 96–168 小时
- Manus：以官方支持渠道为主，社区 issue 响应不稳定

**贡献者集中度（前 10 名贡献者占总 PR 比例）：**
- Claude Code：约 40%（长尾较厚）
- Cursor：约 55%
- Codex：约 65%（仍以官方 + 大客户为主）
- Hermes：约 75%（开源研究团队主导）
- Manus：> 90%（接近完全官方驱动）

### 3.3 PM 解读

数据揭示三件事：

第一，**MCP 是"赢家通吃"的层级**。一个 GitHub MCP Server 写好了，Claude / Cursor / Codex 三家全都能用，第三方维护者会自然把精力集中到通用 server，三家产品之间的 MCP 数量差距会逐年缩小。

第二，**Skill / Rule / Agents 是"平台护城河"**。这三层没有跨平台标准，平台特有的扩展数量直接反映该平台的开发者粘性。Claude Code 在这一层领先一个数量级，是其 E5 = 3 的真实根因。

第三，**"贡献者集中度"是最容易被忽视的指标**。前 10 名占 40% vs 65% vs > 90% 的差距，意味着 Claude Code 已经形成健康长尾，Codex 仍处于"几个核心玩家撑半边天"的早期形态，而 Hermes/Manus 还停留在"官方维护即生态"。DeepSeek 在 0→1 阶段的目标不是 PR 数量，而是把贡献者集中度从 80%+ 拉到 50% 以下。

---

## 4. 工具沙盒模型对比

工具发现–安装–沙盒执行–观测 四步流程里，**沙盒**是最容易被低估的一步。一个生态如果没有可信的沙盒模型，第三方 MCP Server 就只能跑在用户本机的高权限环境里，安全风险会反向压制生态规模。

### 4.1 五家沙盒方案

**Claude Code** 提供四级隔离：
1. **进程级**：MCP Server 默认作为子进程启动，stdin/stdout 通信，文件系统权限随宿主进程
2. **权限策略**：`settings.json` 中的 `permissions.allow / ask / deny`，工具调用前检查
3. **Hook 拦截**：PreToolUse hook 可以拒绝任意工具调用，是 PM 自定义沙盒的首选层
4. **Subagent 隔离**：子代理拥有独立 context，不能直接看到主代理的对话历史，降低注入风险

观测层有完整的 transcript（JSONL）、`claude --debug` 模式、telemetry hook，可以接 SigNoz / Grafana。

**Cursor** 沙盒模型偏轻：
1. MCP Server 同样以子进程方式运行
2. 工具调用通过 IDE 的 Agent 模式权限弹窗确认
3. 没有显式 Hook 层，治理依赖 Rules 的"软提示"
4. 观测主要靠 IDE 内置 panel，没有结构化日志导出

**Codex** 走"远程优先"路线：
1. CLI 模式接近 Claude Code，但默认更鼓励将敏感工具部署在远程
2. Apps SDK 提供托管沙盒，OpenAI 服务端代为执行
3. 观测通过 Platform Dashboard，对企业用户友好但对个人开发者门槛更高

**Hermes** 几乎不提供沙盒：作为开源模型，function-calling 输出由宿主程序自行执行，权限模型完全外部化。

**Manus** 偏向云端托管沙盒，工具运行在 Manus 自己的 runtime 里，对最终用户透明，但牺牲了"本机一切尽在掌握"的开发者体验。

### 4.2 风险矩阵

| 风险类别 | Claude Code | Cursor | Codex | Hermes | Manus |
|----------|-------------|--------|-------|--------|-------|
| 恶意 MCP Server 读敏感文件 | Hook 可拦截 + 权限策略 | 弹窗确认 | 远程沙盒隔离 | 完全交给宿主 | 平台托管隔离 |
| 工具调用注入（prompt injection） | Subagent + Hook | Rules 软约束 | 平台层过滤 | 无 | 平台层过滤 |
| 第三方 Skill / Rule 被植入恶意指令 | 文件审查 + 社区签名（演进中） | Rules 缺签名 | Agents 模板审核 | n/a | 官方审核 |
| 长时任务失控 | Stop Hook + 资源监控 | 无显式机制 | 平台超时强制 | 无 | 平台超时 |

PM 角度的判断：**Claude Code 护栏最厚但门槛最高**（开发者要懂 Hook），**Cursor 最轻量但生态扩张到 SMB 之后会被安全风险卡脖子**，**Codex / Manus 最适合企业但牺牲个人开发者体验**，**Hermes 把所有责任推给宿主，注定难以独立形成 Marketplace**。

### 4.3 给 DeepSeek 的启示

不要在 0→1 阶段同时支持四级隔离——会拖慢生态启动。建议的最小可行集是：**进程级隔离 + 权限策略 JSON + 一个简单的 PreToolUse Hook**。Subagent 上下文隔离可以延后到 v0.3，远程托管沙盒延后到企业版。

---

## 5. DeepSeek 工具生态 0→1 路径建议

DeepSeek Harness 团队的真正机会不是"再做一个 Claude Code"，而是**找到当前几家都没覆盖好的缝隙，用一个简单到能在两个季度内交付的最小生态闭环切入**。

### 5.1 不要做什么

**不要从零设计私有协议。** MCP 已经事实标准化，重复造轮会直接失去 1500+ 现成 server。Day 1 必须 100% 兼容 MCP stdio + Streamable HTTP。

**不要先做 Skill 商城。** Skill 是平台护城河，但需要先有用户基数。0 用户的商城没有任何意义。

**不要追求 Hook 的事件覆盖度。** 三家里 Anthropic 的 Hook 模型最完整，但 80% 的实际价值集中在 PreToolUse 与 Stop 两个事件。先做这两个，其他延后。

### 5.2 应该做什么（按季度排序）

**Q1（v0.1）：MCP 兼容 + 基础 Hook + 中文优先的 Marketplace 落地页。**
- 直接 fork 一个开源 MCP client 实现，确保跑通官方 reference servers
- 实现 PreToolUse + Stop 两个 Hook
- 在 deepseek.com 开一个 `/tools` 落地页，列出经过验证的 50 个高频 MCP Server，每个附中文说明、安装命令、示例 prompt
- 关键 KPI：周活开发者 200，平均每人安装 3 个 MCP Server

**Q2（v0.2）：Skill 系统 + 中文优势栏目。**
- 实现轻量 Skill 系统：Markdown + frontmatter，按关键词触发
- 把"中文场景下表现最好的 30 个 Skill"做成官方包，覆盖飞书、企业微信、微信公众号、知识星球等本土工具链
- 这一步是真正的差异化——Anthropic 与 OpenAI 都不会优先做这些
- 关键 KPI：第三方贡献的 Skill 突破 100 个，前 10 名贡献者占比降到 60% 以下

**Q3（v0.3）：Subagent + 观测层。**
- 实现 Subagent 上下文隔离，提供 5 个开箱即用的 agent 类型（code-reviewer、planner、test-writer、doc-updater、security-reviewer）
- 接入开源观测栈（OpenTelemetry + 自带 dashboard）
- 关键 KPI：企业客户 10 家以上接入观测层

**Q4（v0.4）：远程 MCP + 企业版沙盒。**
- 提供托管 MCP runtime，让客户不必在本机跑高权限 server
- 引入 Skill / MCP Server 签名验证机制
- 关键 KPI：企业 ARR 拐点

### 5.3 生态飞轮设计

四件套不是产品功能，是**贡献者飞轮**。Day 1 必须做的三件事：

1. **公开贡献入口**：一个清晰的 GitHub repo（不是 monorepo 里某个子目录），有标好的 good-first-issue
2. **48 小时 Issue 响应承诺**：前 6 个月由核心团队承诺，是社区信任的关键信号
3. **季度榜单**：公开发布"本季度最佳 MCP Server / Skill"，给贡献者署名权

这三件事的成本极低，但它们决定了贡献者集中度能不能在 12 个月内从 90% 降到 50% 以下——而这才是真正的生态健康度。

---

## 结语

工具与扩展生态的竞争已经从"协议"层下沉到"治理"层。MCP 是入场券，Skill / Subagent / Hook 才是护城河。DeepSeek 入场较晚，但好处是可以直接绕开 Function Calling 时代的历史包袱，从第三阶段起步。决胜不在功能多寡，而在**贡献者飞轮**能否在两个季度内转起来。


---

## 附录 A:中文社区数据校验 (2026 Q1)

> 基于 `wiki/raw/harness-engineering/` 63 篇中文社区文章 + `wiki/analysis/entity-scan.md`,本节用一手中文语料交叉验证本报告论点。详见战略备忘录 [community-divergence/report.md](../community-divergence/report.md)。

**A.1 渐进式披露的中文社区共识**:Skills/MCP 的"按需加载"在中文 63 篇中 DF=22 (35%),TF=54——22 篇专门讨论这一调度策略。其中字节系 (DeerFlow / TRAE)、阿里、腾讯云开发者公众号都将其作为 Harness 工程化的一等公民。**这强支撑本报告 §3 关于"工具数量与调度成本取舍"的论点**——中文工程社区已有同向共识,DeepSeek 不需要从头教育,直接发布渐进式披露的 Skill 协议即可。

**A.2 MCP 接受度数据**:中文社区 MCP DF=44%,Skills DF=65%。两个协议层在中文工程语境里已成熟到可以无解释引用。**对 DeepSeek 的启示**:不需要用一篇白皮书解释什么是 MCP/Skill,直接给出 DeepSeek-flavored 实现即可。教育成本已被 Anthropic + 中文社区共同付清。

---

## 致谢与方法论

数据来源: 26 个 Agent 产品的 wiki/compiled 数据集，基于 Karpathy LLM Wiki 模式 +
nashsu/llm_wiki + sdyckjq-lab/llm-wiki-skill 三套开源借鉴整合。

代码与方法论开源: `github.com/<user>/ai-agent-competitive-analysis`

—— zhouhao, 2026-05-24T09:05:28+00:00