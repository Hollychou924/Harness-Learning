# E7｜如何实现 Harness 自进化(越用越聪明)

> 状态:✍️ 大纲已重排(聚焦砍虚,4 问 + 拔高) · 字数:不限,讲透为准(预计 5000-6500)
> JD 锚点:**与研究员协作** / 训练数据-Harness 闭环 / Eval 飞轮
> 定位:接 E6。前 6 章把 Agent 搭好、跑稳、拆活、管住;E7 回答更长期的问题——怎么让这套 Harness 自己越用越聪明,而不是越用越笨。
> 重排说明(2026-06-07):原标题"模型与 Harness 共同进化"太学术、且原 5 问里"退化诊断/用户反馈"偏虚易空。本章聚焦到两块有硬料的核心:① 把每个错误固化成"永不再犯";② 数据飞轮 + 两条共生路线。退化诊断压成一小节,用户反馈信号转给 E8(评估主场)。

## 本章要回答的真实问题(2026-06-07 聚焦后)

> 开篇钩子(接 E4):E4 问过"为什么 Agent 跑久了变笨"。E7 反过来问:怎么让它越用越聪明?核心命题——**Harness 自进化的本质,是把每个错误工程化地变成"永不再犯"。**

1. **Q1:怎么把一个错误,固化成"永远不再犯"?** — Harness 工程的本质定义(Hashimoto:每发现一个错误,就工程化地消除它再次发生的可能)。闭环:发现错误 → 加进评测集 → 改 Rules/Skills/Wiki → 跑回归通过 → 才算修好。阿里 25%→90% 就是这个闭环跑出来的。
2. **Q2:Skill 怎么从"能跑"打磨到"真好用",甚至自己迭代自己?** — Skill 自进化(从 E5 挪入):8 阶段 Loop(Setup→Review→Ideate→Modify→Commit→Verify→Gate→Log)+ 三层评测(成本递增)+ 5 维 AND 门控(不过就 git revert)。金句:与其写更长 prompt 说服它守规矩,不如把规矩写进代码。
3. **Q3:Harness 数据怎么反哺模型?有哪几种数据飞轮?** — 5 种数据回流模式(Trace 全量 / Failure Log opt-in / Human Takeover 采样 / Eval Set 自动扩充 / Replay-in-Sandbox)+ 五产品横评(信号粒度/训练适用/自动化/隐私)。硬数据:同一模型在不同 Harness 里完成率差 15-30 个百分点。
4. **Q4:模型与 Harness,到底谁该承载"变聪明"?两条路线怎么选?** — Claude Code(轻数据+重 Eval,秩序放 Harness 不训进模型)vs Cursor(重数据+自研模型,数据飞轮抵消代差)vs Manus(不训基础模型,把进化重心放 Harness 的 context engine)。给 DeepSeek 的 0→1 飞轮 5 条建议。

> **压缩处理(不单独成问)**:① 退化 vs 腐化 vs 漂移的诊断——并进 Q1,作为"修之前先定位:是该改 Harness 还是该换模型"的一小节;② 用户反馈信号怎么采集——转给 E8(那是评估/数据主场),E7 只在 Q3 提"用户接管点是最好的负样本"。
> **拔高(收尾)**:Harness 自进化 = E1 双核里"评估能力 + 架构设计能力"合起来转动的飞轮——评估能力发现错误、架构设计能力固化改进。一句话:不进化的 Harness 会腐化;会进化的 Harness,产品上线第一天起就在为下一代攒语料和评测。

## 风险与对策(原 README 标注本章"最虚",已对策)

- 原风险:概念多、一手实证少,易写成空泛概念文。
- 对策:**砍掉两个最虚的问题(退化诊断细节、用户反馈),聚焦到两块有硬料的核心**——错误固化闭环(阿里 90% 真实案例 + Skill 8 阶段)、数据飞轮(co-evolution 报告 5 模式横评 + 15-30 个点硬数据 + 给 DeepSeek 5 条建议)。每段都用案例和数字撑。

## 阅读体验设计(承接 E1-E6)
1. 钩子接 E4"为什么变笨" → 反问"怎么越用越聪明"。
2. 先讲"错误固化"这个最具体、最有案例的(Q1/Q2),再讲"数据飞轮/两条路线"这个更系统的(Q3/Q4)。
3. 每节"场景→反例→怎么破→一句判断";给可抄的(错误固化闭环图、Skill 8 阶段、5 模式横评表、两路线对比、DeepSeek 飞轮建议)。

## 支撑素材(wiki 映射)
| 问题 | wiki 素材 | 关键证据 |
|------|----------|---------|
| Q1 | `concepts/harness-engineering.md`、`topics/aliyun-cloud-developer-agent-collection.md`(90% 闭环)、`raw/harness-engineering/3_实战案例/*`(工程化消除) | Hashimoto 定义、阿里 24.86%→90.54% 五件套闭环 |
| Q2 | `raw/community-posts/tencent-cloud-developer/2026-05-19-让Skill自己训练自己...md`(已读) | 8 阶段 Loop、三层评测、5 维 AND 门控、规矩写进代码 |
| Q3 | `reports/portfolio/co-evolution/report.md`(5 模式+横评) | 5 种数据回流、同模型不同 Harness 差 15-30 个点 |
| Q4 | `reports/portfolio/co-evolution/report.md`(三路线+DeepSeek 建议)、`entities/hermes-agent.md`(RL 闭环)、`entities/claude-code.md`(秩序放 Harness) | Claude 轻数据重 Eval / Cursor 重数据自研 / Manus 进化放 Harness;0→1 飞轮 5 条 |

## 收尾检查清单(草稿待填)
- [ ] Q1 是否给了"错误→永不再犯"的可落地闭环(不是口号)
- [ ] Q2 Skill 8 阶段是否讲清"门控不过就 revert"(规矩写进代码)
- [ ] Q3 5 模式横评是否能让读者拿去选自己的数据飞轮
- [ ] Q4 两条路线是否给了"什么团队选哪条"的判断
- [ ] 退化诊断是否压缩、用户反馈是否转 E8(不和 E8 重复)
- [ ] 拔高是否呼应 E1 双核(评估发现错误 + 架构固化改进)

## v2 升级(2026-06-07,吸收外部 review,已核实出处)

draft-v2 相对 v1 的增强:
1. **修正 3 处事实口径(防被专业读者抓硬伤)**:① "15-30 个百分点"→改稳为"同模型不同 Harness 完成率差别很大,具体以内部报告为准"(Anthropic SWE-Bench 原文只讲 harness=model+scaffolding,未给此数);② "Cursor/Manus 全量 Trace 回流"→"公开可观察的重数据路线倾向"(数据策略敏感,不写成确定事实);③ "模型差距已不是用户能感知量级"→"模型差距会被 Harness 放大或缩小"(leaderboard 变化快,不写死)。
2. **新增错误分类 → 改动分层**(1.1 节):偏好→Memory、规则→Rule、流程→Skill、工具→Tool、安全→Policy、盲区→Eval/模型。不同错误固化到不同层。
3. **新增 Q5 自进化治理**:生产发布链路(版本/过Eval/人工审核/灰度/监控/回滚)+ 治理权(Agent 能建议不能擅改生产/安全规则)+ 防过拟合(别刷 eval)+ Harness 腐化信号。
4. **数据飞轮补两条红线**:数据合同(隐私/脱敏/授权)、训练评测隔离(holdout 防刷分)。
5. **补"训进模型 vs 放 Harness"判断表** + 拔高处加**自进化飞轮图**(短期输出 Rules/Skills/Tools/Policy + 长期输出 训练数据/评测集/模型路线)。

已核实出处:Hashimoto"never makes that mistake again"原文、Anthropic SWE-Bench(harness=model+scaffolding)、Anthropic Skill 能力包定义。

> draft-v1 保留留痕;draft-v2 为当前主稿。