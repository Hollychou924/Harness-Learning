---
id: agent-evaluation-system
type: topic
status: active
updated: 2026-05-25
sources:
  - wiki/raw/official-posts/cursor/2026-03-11-我们如何在-cursor-中比较模型质量.md
  - wiki/raw/official-posts/cursor/2026-04-08-bugbot-现在可通过学习规则自我改进.md
  - wiki/raw/official-posts/cursor/2026-04-30-持续改进我们的智能体框架.md
  - wiki/raw/official-posts/claude/2026-03-09-bringing-code-review-to-claude-code.md
  - wiki/raw/official-posts/claude/2026-01-23-building-multi-agent-systems-when-and-how-to-use-them.md
  - wiki/raw/official-posts/claude/2026-04-07-how-and-when-to-use-subagents-in-claude-code.md
  - wiki/raw/official-posts/codex/2026-02-05-gpt-5-3-codex-系统卡.md
  - wiki/raw/official-posts/codex/2026-03-06-codex-security-研究预览版现已上线.md
  - wiki/raw/official-posts/codex/2026-05-08-在-openai-内部安全运行-codex.md
  - wiki/raw/official-posts/codex/2026-05-22-openai-named-a-leader-in-enterprise-coding-agents-by-gartner.md
  - wiki/raw/official-posts/codebuddy/2026-02-03-CodeBuddy-Code-团队实践斜杠命令-Skills-让发版流程自动化且可靠.md
  - wiki/raw/official-posts/codebuddy/2025-11-21-CodeBuddy-Code-Hooks-探索实践-Hooks-为你的-AI-配上随叫随到的管家.md
  - wiki/raw/official-posts/qoder/2026-04-09-一文详解Qoder-Hooks-核心用法-及-8个实战案例解析.md
  - wiki/raw/official-posts/qoder/2026-05-16-Qoder-专家团能力落地实践从-0-到-1-构建-OpenClaw-使用行为观测系统.md
  - wiki/raw/official-posts/qoder/2026-05-25-数据库研发团队提效400我们是怎么用-Qoder-做到的.md
  - wiki/raw/official-posts/qoder/2026-04-07-AI-一天写完一个月的代码谁来-Review.md
  - wiki/review/ingest-coverage/2026-05-25-harness-historical-63.md
owners: ["zhouhao"]
when_to_load: "讨论 Agent 评测、代码审查质量、线上/线下指标、Bugbot、CursorBench、E8 文章时加载"
---

# Agent 评测体系

> 一句话: Agent 评测不是“跑一个榜单”,而是把离线任务集、线上真实反馈、人工接管点、成本/时延/可靠性和复盘机制连成闭环。

## 1. 为什么必须单独建评测体系

普通模型评测回答“模型会不会答题”。Agent 评测要回答的是另一组问题:

- 它能不能在真实代码库里找到正确上下文?
- 它调用工具是否稳定、是否越权?
- 它完成任务用了多少步、多少 token、多少时间?
- 它犯错后用户在哪里接管?
- 它提出的代码审查意见,最终有没有被人采纳?
- 一次改动上线后,线上真实用户体验有没有变好?

所以 Agent 评测必须同时看“任务结果”和“执行过程”。

## 2. 评测分层

| 层级 | 解决的问题 | 典型指标 |
|---|---|---|
| 离线任务集 | 新模型 / 新 Harness 能不能过基础关 | 任务成功率、测试通过率、回归失败数、CursorBench / SWE-bench 类分数 |
| 在线真实信号 | 用户真实工作中是否变好 | 采纳率、合并率、人工接管率、取消率、重试率 |
| 执行过程 | Agent 为什么成功或失败 | 平均步数、工具调用成功率、上下文命中率、错误恢复次数 |
| 质量反馈 | 代码审查和建议是否有用 | 评论解决率、误报率、漏报率、人工审查补充率 |
| 经济性 | 能不能规模化运行 | token 成本、缓存命中率、首 token 延迟、任务耗时 |
| 可靠性 | 能不能长时间稳定运行 | 崩溃率、OOM、任务中断率、云端工作流恢复率 |

## 3. 官方材料给出的评测样本

| 样本 | 评测做法 | 可复用启示 | 来源 |
|---|---|---|---|
| CursorBench | Cursor 用线下 benchmark 与线上信号组合比较模型质量,并强调 benchmark 要与真实开发者工作保持一致 | 离线评测不能孤立存在,必须和线上用户信号互相校准 | [我们如何在 Cursor 中比较模型质量](../raw/official-posts/cursor/2026-03-11-我们如何在-cursor-中比较模型质量.md) |
| Cursor Agent Harness 改进 | Cursor 同时看自己的评估套件、公开 CursorBench、真实用户会话和自动化日志调查 | Harness 改动需要“实验室 + 真实世界 + 自动排障”三套信号 | [持续改进我们的智能体框架](../raw/official-posts/cursor/2026-04-30-持续改进我们的智能体框架.md) |
| Bugbot 学习规则 | Bugbot 从 PR 评论反馈、开发者回复、人工审查者评论中生成候选规则,再继续在新 PR 上评估规则表现 | 代码审查是天然反馈闭环: 每个 PR 都能产生正负样本 | [Bugbot 现在可通过学习规则自我改进](../raw/official-posts/cursor/2026-04-08-bugbot-现在可通过学习规则自我改进.md) |
| Claude Code Review | Claude Code 将自动预览、审查、合并接入桌面端流程 | 评测可以嵌入交付链路,而不是事后单独打分 | [Bringing Code Review to Claude Code](../raw/official-posts/claude/2026-03-09-bringing-code-review-to-claude-code.md) |
| CodeBuddy `/mr` 流程 | CodeBuddy 将 Git 变更分析、构建验证、分支管理、文档更新、changeset、提交推送和 MR 打开串成命令 | 质量门禁可以做成用户主动触发的稳定流程,让“提交前检查”标准化 | [斜杠命令 + Skills 发版实践](../raw/official-posts/codebuddy/2026-02-03-CodeBuddy-Code-团队实践斜杠命令-Skills-让发版流程自动化且可靠.md) |
| CodeBuddy Hooks | Hooks 可在工具执行前后插入检查、格式化、安全扫描、日志和通知 | Agent 评测不只看最终输出,还要在执行节点做拦截和审计 | [Hooks 探索实践](../raw/official-posts/codebuddy/2025-11-21-CodeBuddy-Code-Hooks-探索实践-Hooks-为你的-AI-配上随叫随到的管家.md) |
| Qoder Hooks | Stop hooks 可分析整段会话、统计工具分布、阻断未通过测试或残留 TODO 的完成状态 | Hooks 不只是安全拦截,也可以成为过程评测、质量门禁和复盘沉淀入口 | [Qoder Hooks 详解](../raw/official-posts/qoder/2026-04-09-一文详解Qoder-Hooks-核心用法-及-8个实战案例解析.md) |
| Qoder Code Reviewer | Code Reviewer 可在 Experts Mode 自动触发,也可通过 `/code-review` 手动触发;基于全代码库上下文做语义级审查 | Review 应该前移到开发态,和测试、Linter 互补,形成“开发 > 审查 > 修复”的同会话闭环 | [AI 一天写完一个月的代码，谁来 Review?](../raw/official-posts/qoder/2026-04-07-AI-一天写完一个月的代码谁来-Review.md) |
| Qoder 行为观测案例 | Qoder 专家团案例围绕 OpenClaw 使用行为观测系统构建,强调从需求到观测指标和系统落地 | Agent 产品自身也需要行为观测,否则无法判断功能是否真的提效 | [OpenClaw 行为观测系统](../raw/official-posts/qoder/2026-05-16-Qoder-专家团能力落地实践从-0-到-1-构建-OpenClaw-使用行为观测系统.md) |
| 数据库团队案例 | Qoder 文章称数据库研发团队从轻量插件转向 Quest Mode 后,复杂问题处理从天级缩短到小时级 | 案例可作为效率假设,但进入正式评测时仍需拆成任务成功率、接管点和周期指标复核 | [数据库研发团队提效 400%](../raw/official-posts/qoder/2026-05-25-数据库研发团队提效400我们是怎么用-Qoder-做到的.md) |
| 验证子 Agent | Claude 官方把“独立验证”列为多 Agent 中最稳定的模式之一,主 Agent 完成后由验证 Agent 黑盒检查 | 验证 Agent 是低成本提升可靠性的设计,适合 E9 提案直接采用 | [Building multi-agent systems](../raw/official-posts/claude/2026-01-23-building-multi-agent-systems-when-and-how-to-use-them.md), [Subagents in Claude Code](../raw/official-posts/claude/2026-04-07-how-and-when-to-use-subagents-in-claude-code.md) |
| 应用稳定性反馈 | Cursor 将 OOM、崩溃等问题转成 Bugbot 规则,让代码审查系统阻断同类问题复发 | 评测不只评“模型聪不聪明”,也评产品稳定性和故障复发 | [保持 Cursor 应用稳定](../raw/official-posts/cursor/2026-04-21-保持-cursor-应用稳定.md) |
| Managed Agents memory | Claude Managed Agents 把记忆写成可审计文件,并用客户案例证明 first-pass 错误、成本、延迟等指标改善 | 记忆系统也要评测: 不是有没有记忆,而是错误是否下降、成本是否下降 | [Built-in memory for Claude Managed Agents](../raw/official-posts/claude/2026-04-23-built-in-memory-for-claude-managed-agents.md) |
| Codex 系统卡 / 安全预览 | OpenAI 用系统卡、安全研究预览、网络安全能力和可信访问机制承接双重用途风险 | Agent 评测必须把“能不能做成”和“会不会被滥用”一起评估 | [GPT-5.3-Codex 系统卡](../raw/official-posts/codex/2026-02-05-gpt-5-3-codex-系统卡.md), [Codex Security](../raw/official-posts/codex/2026-03-06-codex-security-研究预览版现已上线.md) |
| Codex 企业审计 | Codex 可导出提示词、审批、工具结果、MCP 使用、网络策略事件等日志 | 过程日志本身就是评测和安全复盘材料,能解释 Agent 为什么这么做 | [在 OpenAI 内部安全运行 Codex](../raw/official-posts/codex/2026-05-08-在-openai-内部安全运行-codex.md) |
| 4 亿 token 教训 | 6 个 Agent 连写 4 天代码后总结 5 条教训: 有监控但监控没用比没监控更危险、问题藏在最不起怀疑的地方、工具数字别直接信、胶水代码比核心功能更难 | 评测的对象不只是 Agent 输出,还包括"评测系统本身可不可信" | [4 亿 token 买来 5 个教训](../raw/community-posts/tencent-cloud-developer/2026-04-08-4亿token买来5个教训让6个AI-Agent连写4天代码发生了什么.md) |
| Multi-Agent Harness 评测 | 把架构编排、工具治理、状态记忆、评估、成本、MCP 接入列为五大模块,评测必须覆盖每个模块 | 真正决定生产可用度的是 Harness,不是 Prompt 或单个 Agent | [生产级 Multi-Agent Harness 全拆解](../raw/community-posts/tencent-cloud-developer/2026-05-13-从零设计生产级-Multi-Agent-Harness架构评估记忆成本与-MCP-工具接入全拆解.md) |
| Skill 自训练 | 8 阶段 Loop、3 层评测、5 维 AND 门控,在 19 轮自进化中验证可用 | Skill 不是写一次就完事,需要可机读的评测和门控来防止退化 | [让 Skill 自己训练自己](../raw/community-posts/tencent-cloud-developer/2026-05-19-让Skill自己训练自己8阶段Loop3层评测5维AND门控从此实现自进化.md) |
| 评审 Agent 的元评估 | 用代码片段 + 完整项目两层数据集,评 Evaluator 的"评得准不准";三层评审(代码质量/静态质量/动态运行) + 快速失败优先 + 评分体系 + 三轮优化把均分 64.5 拉到 83.4 | 评测系统本身要可被评测,否则裁判不可信 | [Harness Engineering 实践:做了一个平台让 AI 一晚上自动评测优化你的系统](../raw/community-posts/aliyun-cloud-developer/2026-04-29-Harness-Engineering实践做了一个平台让AI一晚上自动评测和优化你的系统.md) |
| 测试 Agent 自主智能化 | 测试 Agent 从自动化走向自主智能,把"会思考的测试"做成评测闭环的一部分 | 测试不是收尾,而是 Harness 工作轨道本身 | [构建会思考的测试 Agent](../raw/community-posts/aliyun-cloud-developer/2026-03-11-构建会思考的测试Agent从自动化到自主智能的演进.md) |
| Token 账单可观测 | Agentic OS ANOLISA 把 Agent 的 Token 消耗逐笔可视化,作为成本评测信号 | 评测要包含成本与可持续性,不只是质量 | [Agent 烧钱如流水: Agentic OS ANOLISA Token 账单](../raw/community-posts/aliyun-cloud-developer/2026-05-11-Agent-烧钱如流水Agentic-OS-ANOLISA-帮你逐笔看清-Token-账单.md) |
| Anthropic 瑞士奶酪模型 | 任何单一评测方法都有洞,必须用端到端/分步/Trace/抽样人审多层叠加才能拦住失败 | 第一版评测就要按"瑞士奶酪式"多层设计,而不是赌一个万能裁判 | [Anthropic 评估体系 瑞士奶酪](../raw/community-posts/agent-evaluation/2026-02-01-Anthropic-的AI-Agents评估体系瑞士奶酪模型.md), [系统化方法论](../raw/community-posts/agent-evaluation/2026-01-12-Anthropic官方万字长文AI-Agent评估的系统化方法论.md) |
| Look at your data | 跨越三年的 Eval 心法 = 真的去看每一条真实数据,不要被分数蒙蔽 | 每周拿 20-50 条真实日志亲自看,而不是只盯仪表盘 | [跨越三年的 Eval 心法](../raw/community-posts/agent-evaluation/2026-01-24-跨越三年的评估Eval心法Look-at-your-data.md) |
| 阿里云智能运维评测集 | 把系统抽象成"输入/代码与配置/资源/状态"四层,真实采集 + 故障注入 + 模拟三路并用,沉淀 2000+ 案例发布 200+ | 评测集设计有方法论:覆盖度 + 真实度 + 可持续扩容 | [阿里云智能运维 Agent 评测体系实践](../raw/community-posts/agent-evaluation/2026-03-26-突破泛化瓶颈阿里云智能运维-Agent-评测体系实践.md) |
| LLM-as-Judge 91.9% (放我家) | 结构化 Benchmark + 多评审投票 + 人工抽样校准,LLM-as-Judge 准确率 91.9%,gpt5.1 较 qwen3-vl 提升 16.4% | LLM-as-Judge 必须先小批量人工校准,达 90%+ 一致性才能上规模 | [面向智能导购 (放我家) Agent 评测实践](../raw/community-posts/agent-evaluation/2026-05-15-面向智能导购的Agent评测实践.md) |
| 芝麻信用"评测 Agent" | 让 Agent 自学语雀文档标注标准,实现评测集生成/打分/Badcase 全自动化,机审率 80%+ | 当评测变成"用 Agent 评 Agent",必须有元评估基准防止裁判失准 | [自动化评测的九九归一—评测 agent](../raw/community-posts/agent-evaluation/2026-02-05-自动化评测的九九归一——评测agent.md) |
| GAIA / AgentBench / 轨迹评估 | 公开 Benchmark 给入门参考,但真实业务必须自建;LangChain Trajectory Evaluator 把过程轨迹纳入评分 | 公开榜单只是入门,垂直业务必须有自己的 Benchmark | [GAIA 评估标准](../raw/community-posts/agent-evaluation/2025-07-11-深度解读｜GAIAAI-Agent-的评估标准.md), [全面评估 Agent 系统](../raw/community-posts/agent-evaluation/2024-07-10-怎样全面评估Agent系统.md) |
| AWS 秘籍六 Agent 质量评估 | 包含工具调用的 Agent 评估必须超越 text-to-text;多维度: 任务成功率/工具正确性/成本效率/安全合规;三大主流框架特点与适用场景 | 评估对象不只是输出,还要评行为/决策/工具调用 | [AWS 秘籍六 Agent 质量评估](../raw/community-posts/aws-cloud-developer/2025-12-23-Agentic-AI实践指南｜秘籍六Agent质量评估.md) |
| AWS 秘籍七 Agent 可观测性 | 传统 Metrics→Logs→Traces 在 Agent 场景只能解释"发生了什么",必须新增"决策原因/行为链条/结果质量"三层观测 | 桌面端 Agent 必须把 trace + span + 决策回放当作一类核心数据 | [AWS 秘籍七 Agent 可观测性评估](../raw/community-posts/aws-cloud-developer/2025-12-24-Agentic-AI实践指南｜秘籍七Agent可观测性评估.md) |
| LangChain 团队评估深度 Agent 经验 | 深度 Agent 每个测试用例需要定制化逻辑;单步运行/完整轮次/多轮对话三种模式分场景用 | 评估深度 Agent 不能套传统模板,要按用例定制 | [LangChain 团队的经验总结](../raw/community-posts/agent-evaluation/2025-12-04-如何评估智能体效果呢LangChain-团队的经验总结.md) |
| 玄姐 LLM 应用评估体系 | 多轮对话/RAG/Agent 三类的评估指标对照;DeepEval / RAGAS / MLFlow / OpenAI Evals 框架选型 | 不同评估场景对应不同框架,指标命名不统一是普遍问题 | [玄姐 LLM 应用评估体系详解](../raw/community-posts/agent-evaluation/2025-10-22-LLM-应用评估体系详解从多轮对话到-RAG-与-AI-Agent-的落地评估.md) |

## 4. DeepSeek 桌面端 Agent 应该怎么设计第一版评测

| 评测对象 | 最小可行指标 | 为什么重要 |
|---|---|---|
| 代码修改任务 | 任务成功率、测试通过率、回滚次数 | 证明 Agent 真能完成工程任务 |
| 代码审查任务 | 发现被采纳率、误报率、人工补充率 | 最适合冷启动,因为反馈快且可验证 |
| 语义级 Review | 调用链风险、AI 幻觉 API、过度抽象、与本次变更直接相关的确定性风险 | Qoder Code Reviewer 说明 Agent 代码审查不能只看 Diff,要看全代码库上下文 |
| 提交前门禁 | 构建验证通过率、文档遗漏率、changeset 缺失率、分支命名违规率 | CodeBuddy `/mr` 说明提交链路本身就是可评测对象 |
| 工具调用 | 工具调用成功率、错误恢复率、危险操作拦截数 | Harness 的核心价值就是让 Agent 可控执行 |
| Hooks 过程日志 | 工具分布、阻断次数、测试失败后继续执行次数、敏感信息拦截数 | Qoder / CodeBuddy 都说明 Hooks 是过程评测的天然采集点 |
| 上下文获取 | 找到正确文件比例、无关文件读取量、上下文压缩后遗漏率 | 避免“读很多但没读对” |
| 用户接管 | 接管点、接管原因、接管后修正动作 | 这是最有价值的负样本 |
| 成本体验 | token 消耗、缓存命中率、任务耗时 | 决定产品能不能长期用 |
| 长任务稳定性 | 任务中断率、重试成功率、跨会话恢复率 | 桌面端 Agent 的上限在长任务 |

## 5. E8 文章可用结构

1. 开场: “你怎么知道 Agent 这次真的变好了?”
2. 区分模型评测和 Agent 评测。
3. 拆成离线、在线、过程、反馈、成本、可靠性 6 层。
4. 用 CursorBench / Bugbot / Claude Code Review 做样本。
5. 给出 DeepSeek 第一版评测仪表盘。
6. 收尾: 评测不是写报告,而是让产品每天自动变好的反馈系统。

## 6. 仍需补的材料

- DeepSeek 自己模型 / 工具调用 / 代码任务的官方评测口径。
- CodeBuddy 的 `/mr`、`/release`、Hooks 和 Agent Teams 可继续补强“过程型评测”材料。
- Qoder 的 Hooks、Quest 产物审查、行为观测和数据库团队案例可继续补强“任务流评测”材料。
- Manus 或其他云端长任务 Agent 的真实任务完成率材料。
- 自己跑一组小样本: 同一任务让 Cursor / Claude Code / Codex 各跑 10 次,记录完成率、接管点和成本。

## 7. 相关页面

- [Cursor](../entities/cursor.md)
- [Claude Code](../entities/claude-code.md)
- [Codex](../entities/codex.md)
- [Qoder](../entities/qoder.md)
- [Harness Engineering](../concepts/harness-engineering.md)
- [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md)
