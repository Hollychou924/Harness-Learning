# E6｜安全与权限:能理解,不等于能执行

> 状态:✍️ 大纲已重排(总论 + 5 问 + 拔高) · 字数:不限,讲透为准(预计 5500-7000)
> JD 锚点:Plan Mode / 沙箱 / 权限分级 / 安全
> 定位:接 E5。多个 Agent 能并行动手、还各有工具权限了——那"权限大了出事谁负责、谁来兜底"?本章把 E6 从"加几个确认弹窗"升级成"运行时权限决策系统"。
> 核心命题:**权限先于能力——Agent 有能力,不代表 Agent 有权限。** 用车载场景做主案例(周浩本职领域)。

## 本章要回答的真实问题(2026-06-07 总论 + 5 问,吸收外部建议)

> **总论:权限先于能力。** Agent 能理解用户想干什么,不代表它能执行。模型只负责提出动作,Harness 才决定动作能不能执行。用车载 L0-L5 权限分级把这个命题讲透(L5 驾驶安全相关绝不能由模型直接控)。

1. **Q1:Agent 权限大了,出问题谁负责?怎么划清人和 Agent 的责任边界?** — 从"谁背锅"升级成"谁授权/谁执行/谁审计"的产品机制:5 角色(用户/模型/Harness/工具/审计)+ 一条权限决策执行链。模型提动作,Harness 拍板。
2. **Q2:哪些自动执行、哪些必须人工确认?分级标准怎么建?** — 从"按工具分级"升级为"运行时 Policy Engine":同一工具不同场景风险不同。公式 `最终风险 = 工具风险 × 场景风险 × 数据敏感度 × 可逆性 × 用户是否在场`。三级模式 Default/Auto/Plan + 车载车窗场景表。
3. **Q3:被提示词注入攻击怎么防?** — 写成权限问题,不只是 prompt 问题。Agentic 特有威胁之首;防御落到:外部内容当 data 不当 instruction、隐藏字符过滤、工具权限/数据隔离/出网白名单/sandbox 兜底。呼应 Copilot 真实做法。
4. **Q4:Agent 做错了怎么撤回?** — 拆成 Undo / Compensation / Containment 三种:现实动作不一定能回滚(邮件发出去只能补偿)。真 rollback 只适合文件/代码/可版本化配置;不可逆动作用补偿;事故用遏制。呼应"恢复是继续工作不是回到原状"。
5. **Q5:企业部署处理敏感数据,安全边界怎么设计?** — 三层安全模型(传统安全 + GenAI 安全 + Agentic 特有威胁,叠加非替代)+ Agent 专属身份(用户身份=授权来源,Agent 身份=执行主体)+ 最小权限 + 审计日志(记什么但不记 secret 原文)。真实漏洞:AgentSmith(LangSmith CVSS 8.8 偷 API key)、MCP Inspector RCE(CVE-2025-49596)。

> **拔高(收尾)**:安全权限 = E1 双核里"安全护栏架构:把软约束变系统级硬约束"的直接落地。评估能力体现在用审计日志/拦截数/越权次数量安全好坏。一句话:E6 不是给 Agent 加确认弹窗,是把模型的软建议变成系统的硬边界。

## 阅读体验设计(承接 E1-E5)

1. 钩子接 E5:多 Agent 能并行动手了,Agent 误删生产数据/误控车,谁的锅?
2. 总论先立"权限先于能力",用车载 L0-L5 分级表(读者一看就懂、且是周浩本职差异化)。
3. 每节"场景→反例→怎么破→一句判断";给可抄的(车载L0-L5表、风险公式+维度表、三级权限模式、Undo/Compensation/Containment 对照、三层安全模型、审计字段清单、文末自查表)。
4. 主案例用车载(周浩领域)+ coding agent(前几章一脉相承)双线。

## 支撑素材(wiki / 已核实出处)

| 问题 | wiki / 出处 | 关键证据 |
|------|----------|---------|
| 总论/Q2 | `topics/agentway-harness-books.md`(原则 4 权限先于能力 + 原则 5 车载例子)、`entities/claude-code.md`(权限引擎/Auto Mode)、`entities/codex.md`(沙箱+审批) | 权限先于能力;调音量 vs 调驾驶相关;Auto Mode 必须配权限边界 |
| Q1 | `topics/agentway-harness-books.md`、`entities/codex.md`(智能体原生日志) | 5 角色执行链、审批/工具/网络允许拒绝可审计 |
| Q3 | `entities/github-copilot.md`(隐藏字符过滤/防火墙allowlist)、`topics/aws-*`(秘籍八 OWASP ASI) | 提示注入过滤、出网白名单、当 data 不当 instruction |
| Q4 | `topics/agentway-harness-books.md`(原则 7 恢复是继续工作)、`entities/claude-code.md`(memory 可回滚)、`entities/codex.md`(沙箱) | Undo/Compensation/Containment、dry-run、快照 |
| Q5 | `topics/aws-cloud-developer-agentic-ai-playbook.md`(秘籍二沙盒/五身份/八安全)、Noma AgentSmith(已核实)、Oligo CVE-2025-49596(已核实) | 三层安全、Agent 身份、最小权限、真实漏洞 |

## 已核实的外部出处(2026-06-07 联网)

- ✅ Noma AgentSmith(noma.security):LangSmith CVSS 8.8,恶意 proxy 配置可偷 OpenAI API key、劫持 LLM 响应。
- ✅ MCP Inspector CVE-2025-49596(oligo.security):Anthropic MCP Inspector RCE + DNS rebinding,开发者机器远程代码执行→偷数据/装后门/横向移动。
- ✅ MCP 规范 annotations 不可信、GitHub Copilot risks-and-mitigations(前章已核实)。

## 边界划分(与其他章衔接)

- 工具风险分级/HITL/Tool Registry 九项 → **E3** 已起头,E6 把它升级成完整权限决策系统
- 提示注入在 E3/E4/E5 都点过"完整防护看 E6" → **本章主场**,展开
- 按角色最小化工具权限 → **E5** 已起头,E6 给完整身份/最小权限/审计
- 回滚 vs 续跑:E2 讲"崩了续跑"(技术恢复),E6 讲"做错了撤回/补偿/遏制"(安全兜底)
- 记忆投毒 → E4 已讲记忆侧,E6 从"外部内容→权限/出网"侧补
- 完整评估(安全合规指标)→ **E8**

## 收尾检查清单(草稿待填)

- [ ] 总论是否用车载 L0-L5 把"权限先于能力"讲透
- [ ] Q2 是否给了"工具×场景"的运行时风险公式(不只按工具分级)
- [ ] Q3 是否把提示注入落到权限/隔离/出网(不只是 prompt 层)
- [ ] Q4 是否拆清 Undo/Compensation/Containment(现实动作不一定能回滚)
- [ ] Q5 是否给了三层安全 + Agent 身份 + 真实漏洞案例
- [ ] 拔高是否呼应 E1"软约束变硬约束"
