---
id: agentway-harness-books
type: topic
status: active
updated: 2026-05-26
sources:
  - wiki/raw/books/agentway/INDEX.md
  - wiki/raw/books/agentway/2026-04-01-agentway-claude-code-harness-engineering-design-guide.md
  - wiki/raw/books/agentway/2026-04-01-agentway-claude-code-vs-codex-comparative-harness-notes.md
owners: ["zhouhao"]
when_to_load: "讨论 Harness Engineering 系统骨架、Claude Code 设计哲学、Claude Code vs Codex 路线选择、Query Loop / 控制面 / 错误恢复 / 多代理验证 / 团队落地等结构性议题时加载"
---

# AGENTWAY Harness Books 合集 (2 本 / 142 页)

> 一句话: agentway.dev 的两本"Harness Books"是目前中文社区里把 Harness Engineering 写得最系统的工程性专著——不是源码注释,也不是产品评测,而是从 Claude Code 与 Codex 的源码里抽出可复用的工程秩序。它和已有的 145 篇社区文章合起来,构成"零散文章 + 长篇专著"的完整知识闭环。

## 1. 两本书的定位

| | 第 1 本 (单体解剖) | 第 2 本 (比较解剖) |
|---|---|---|
| **书名** | Claude Code 设计指南: Harness Engineering | Claude Code 和 Codex 的 Harness 设计哲学: 殊途同归,还是各表一枝 |
| **副标题** | CONTROL PLANE / QUERY LOOP / RECOVERY / VERIFICATION | CONTROL / LOOP / POLICY / STATE / LOCAL GOVERNANCE / VERIFICATION |
| **页数** | 88 页 | 54 页 |
| **回答的问题** | 一套能在真实工程环境里持续工作的 harness, 内部骨架应该是什么样 | 同样是做 harness, 哪些设计更接近共识, 哪些体现不同工程路线的取舍 |
| **核心论断** | 系统是否可靠, 不在它会不会说, 而在出岔子后谁来收拾残局 | 区别只在于, 有人把摧残写进控制流, 有人把摧残写进制度层 |

## 2. 第 1 本: Harness Engineering 十条原则

把第 1 本第 9 章压成一张表(必背):

| # | 原则 | 一句话解释 |
|---|---|---|
| 1 | 把模型当不稳定部件,不要当同事 | 不假定模型持续正确,不假定模型懂工程常识 |
| 2 | Prompt 是控制面的一部分 | Prompt 不是人格台词,是分层注入 + 优先级 + 缓存预算的宪法 |
| 3 | Query loop 才是代理系统的心跳 | 状态属于主业务;模型只是循环一段;心跳必须处理中断和恢复;停止条件不能只有一个 |
| 4 | 工具是受管执行接口 | 权限先于能力;StreamingToolExecutor 把中断作为一等语义;Bash 永远比别的工具更可疑 |
| 5 | 上下文是工作内存 | CLAUDE.md / MEMORY.md 是索引而非日记;auto compact 是预算治理;摘要要重建可继续工作的上下文 |
| 6 | 错误路径就是主路径 | prompt too long 是必然周期;响应式 compact;abort 中断也属于错误恢复 |
| 7 | 恢复的目标是继续工作 | 而不是回到原状;保护执行叙事的一致性 |
| 8 | 多代理的意义是把不确定性分区 | forked agent 必须 cache-safe;状态隔离;协调者 synthesis 是稀缺能力 |
| 9 | 验证必须独立,不能让系统自己给自己打分 | 验证独立成阶段;hooks + 任务生命周期 |
| 10 | 团队制度比个人技巧重要 | CLAUDE.md 稳定分层;skill 当工作流模块;approval 按风险分层;hook 不必作为第一步 |

## 3. 第 2 本: 五条比较轴 + Claude Code vs Codex 设计哲学

把比较书第 2-7 章压成一张矩阵:

| 比较轴 | Claude Code (运行时优先) | Codex (制度层优先) |
|---|---|---|
| **控制面** | 动态装配线: prompt 在每轮按段拼装 | 带编号的公文系统: schema 化、显式注入 |
| **本地规则** | CLAUDE.md (经验收编、现场记忆) | AGENTS.md (制度挂载、结构化注入) |
| **心跳/连续性** | 把连续性压进主循环 (内聚的 query loop) | 把连续性拆成线程 / rollout / 状态桥 (外聚的状态机) |
| **工具治理** | 重点在运行时编排和危险动作约束 (StreamingToolExecutor) | 重点在工具 schema、审批参数和策略引擎 (Policy DSL) |
| **本地治理** | Hook + 现场记忆,经验收编 | 事件系统 + 结构化注入,制度挂载 |
| **多代理** | 服务于运行时职责分区 | 服务于显式工具化协作 |
| **气质** | "秩序住在运行时" | "规矩住在系统外沿" |

> **作者最终判断**: 殊途同归 (都承认模型不可靠) + 各表一枝 (秩序住在不同层)。如果非要起更难听但更准确的名字: **Claude Code 走的是 "纪律内化", Codex 走的是 "制度外化"**。

## 4. 第 2 本第 8 章: 三种常见团队的起手方向

这张表是给"自己做 Agent"的团队最直接的路线选择建议:

| 团队类型 | 起手方向 | 该向谁学 |
|---|---|---|
| 小团队/原型期 | Claude Code 路线 (内聚 query loop + 经验收编) | 第 1 本九条原则全套 + CLAUDE.md 体系 |
| 中型团队/有合规压力 | Codex 路线 (Policy 层 + 显式审批) | 第 2 本第 4 章工具策略 + AGENTS.md 体系 |
| 大组织/多业务线 | 混合: 内聚 query loop + 外置策略层 | 两本一起,先 Claude Code 落控制流,再 Codex 化外沿规矩 |

> "把'显式'与'灵活'误认为天然对立" 是常见误区——它们不必互斥,真正的成熟系统会同时拥有。

## 5. 与现有 wiki 体系的对照

这两本书是中文社区目前最系统的 Harness 长篇专著, 和我们的 145 篇社区文章构成"原则 ↔ 实例"的双向印证:

| 已有页面 | 本批的支撑 |
|---|---|
| [Harness Engineering](../concepts/harness-engineering.md) | 十条原则成为概念页的"高阶层"——之前的"6 类抓手"是入门, 这十条是骨架 |
| [OpenClaw / Claude Code / Hermes 三篇产品拆解沉淀](openclaw-claude-code-hermes-comparison.md) | 第 2 本提供"运行时 vs 制度层"两条路线判断, 比单纯 Prompt/Context/Harness 三层更深 |
| [Agent 评测体系](agent-evaluation-system.md) / [评估方法论深度合集](agent-evaluation-deep-dive.md) | 原则 9: 验证必须独立——和 Anthropic 瑞士奶酪 / 元评估 / LangChain Deep Agents 互证 |
| [腾讯云开发者 Agent / Harness 合集](tencent-cloud-developer-agent-harness-collection.md), [阿里云开发者 Agent / Harness 合集](aliyun-cloud-developer-agent-collection.md) | 中文社区的散文式实践 ↔ AGENTWAY 的系统化原则 = 双向映射 |
| [桌面 Agent 第三方横评合集](desktop-agent-third-party-comparisons.md) | 第 2 本"两种控制面"对应横评里 Antigravity 显式协调 vs Claude Code 隐式累积 |
| [亚马逊云开发者 Agentic AI 实践指南](aws-cloud-developer-agentic-ai-playbook.md) | AWS 八件套是模块清单, AGENTWAY 十条原则是设计哲学, 两者互补 |

## 6. 对车载小爱 / DeepSeek 桌面端 Agent 的启示 (高密度版)

1. **先别选模型, 先选 Harness 路线**: Claude Code (内聚 query loop) 还是 Codex (外置 Policy);第 2 本第 8 章给了三种团队的起手建议。
2. **把"错误路径当主路径设计"**: 第 1 本第 6 章的判断对车载场景尤其重要——驾驶中断、网络波动、语音误识、对话被打断都是必然周期, 不是边角料。
3. **Prompt 不是人格台词, 是分层宪法**: 系统层、模型层、Hook、CLAUDE.md/AGENTS.md、用户偏好分层注入并保留优先级。
4. **Query loop 必须有多个停止条件**: 否则系统会把"失败"当"完成"。这条对车载短句多轮场景是底线。
5. **权限先于能力**: 即使是车载场景, 模型生成的指令也必须过权限层 (调音量 vs 调空调 vs 调驾驶相关) 而不是默认有授权。
6. **验证必须独立成阶段**: 不能让 Agent 自己宣布完成, 要有外部 verifier (规则 + 仿真 + 用户反馈) 三层。
7. **团队落地优先级**: 最低边界 → CLAUDE.md/AGENTS.md → skill 当工作流模块 → approval 按风险分层 → hook 是高级能力可后做。

## 7. 来源与覆盖账本

- 索引: [books/agentway/INDEX.md](../raw/books/agentway/INDEX.md)
- 覆盖账本: [AGENTWAY Books 2 本账本](../review/ingest-coverage/2026-05-26-agentway-harness-books.md)

## 8. 相关页面

- [Harness Engineering](../concepts/harness-engineering.md)
- [OpenClaw / Claude Code / Hermes 运行架构对比](../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)
- [Agent 评测体系](agent-evaluation-system.md)
- [Agent 评估方法论深度合集](agent-evaluation-deep-dive.md)
- [腾讯云开发者 Agent / Harness 合集](tencent-cloud-developer-agent-harness-collection.md)
- [阿里云开发者 Agent / Harness 合集](aliyun-cloud-developer-agent-collection.md)
- [桌面 Agent 第三方横评合集](desktop-agent-third-party-comparisons.md)
- [亚马逊云开发者 Agentic AI 实践指南](aws-cloud-developer-agentic-ai-playbook.md)
