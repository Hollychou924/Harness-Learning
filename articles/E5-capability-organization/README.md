# E5｜多 Agent 系统:任务怎么拆、怎么协作、怎么不互相踩

> 状态:✍️ 大纲已重排(聚焦多 Agent,5 问 + 拔高) · 字数:不限,讲透为准(预计 6000-8000)
> JD 锚点:**Subagent** / **Multi-Agent** / Orchestration
> 定位:接 E4。上下文记忆理顺了,下一个问题是——任务大到一个 Agent 干不完时,怎么拆给多个 Agent、让它们配合干活而不互相踩。
> 边界说明(2026-06-07 重划):本章**只讲子 Agent + 多 Agent 协作**。Skill 选型(FC/MCP/Skill/插件怎么选)已在 E3;Skill 自进化打磨(8 阶段 Loop)挪到 E7;AGENTS.md 怎么写挪到 E4;团队标准化推广挪到 E9。与 E2 区分:E2 讲多 Agent"跑起来不跑飞"(硬闸/续跑/监控的运行控制),E5 讲"该不该拆、拆几个、协调者怎么设计、上下文怎么隔离"(组织与协作设计)。

## 本章要回答的真实问题(2026-06-07 聚焦多 Agent)

1. **Q1:任务大到一个 Agent 干不完,有哪几种拆法?** — 全章地图。子 Agent(独立上下文的"分身",像浏览器标签页,干完只回传结果)vs 多 Agent 团队(分角色协作:Lead/Worker/Gatekeeper)。先把两者定位和区别讲清,避免读者混。
   - **1.1 增补(2026-06-07)**:第四层 **Dynamic Workflows(编排代码化)**——Claude 自写 JS 编排脚本、独立 Runtime 执行、状态存脚本变量不回灌主上下文、调度上百子 Agent。四层对比表(子Agent/Skills/Agent团队/Dynamic Workflows)+ ultracode + 断点续跑 + 动态拓扑 + cache 关键改进。回收 E2'动态工作流'伏笔。档案见 `entities/claude-dynamic-workflows.md`。
2. **Q2:什么时候开子 Agent、什么时候单 Agent 搞定?3-10 倍 token 值不值?** — 最需量化的决策。Anthropic 官方 4 个适用场景 + 每个的 signal:①收集上下文要读 dozens 文件 ②多个独立任务可并行 ③需要无偏复核(不被主对话假设污染)④提交前独立验证。子 Agent vs /clear 的区别。多 Agent 往往 3-10 倍 token——是高成本能力,不是默认答案。
3. **Q3:多个 Agent 协作,谁来协调?协调者职责边界在哪?结果冲突谁拍板?** — "别让 Agent 开车,让 Agent 当导航"。Lead(拆任务/分配/把关)、Gatekeeper(审查/拒绝时写反馈文件)职责设计;协调者的 synthesis(综合)是稀缺能力。决策权(预算/并发/是否继续)在 Harness,不在 Planner/Agent。
4. **Q4:多 Agent 怎么不互相踩?上下文 / 状态怎么隔离?** — 与 E2 区分:E2 讲跑不飞,这里讲隔离。子 Agent 各有独立上下文窗口(天然隔离);多 Worker 各在独立代码副本(Git Worktree);硬原则:并行 Agent 不共享可写状态;forked agent 必须 cache-safe(呼应 E4:别让分叉污染稳定前缀)。
5. **Q5:多 Agent 协作怎么让用户看得懂、怎么控成本?** — 可观测(任务卡片/计划/决策点,承接 E2 的对话流→任务流)+ 成本账(3-10 倍 token、便宜模型干粗活贵模型干关键决策、92% token 被低成本模型吃掉)。

> **拔高(收尾)**:多 Agent 系统设计 = E1 双核里"多 Agent 协作架构"的落地——设计 Agent 之间怎么通信、调度、决策、隔离。呼应 E1 第六节"架构设计能力"那一条。

## 阅读体验设计(承接 E1-E4)

1. 钩子接 E4:上下文记忆理顺了,任务还是大到一个脑子装不下——该拆了。
2. Q1 先把"子 Agent vs 多 Agent 团队"两个概念分清(子 Agent 是多 Agent 的最轻形态),避免混。
3. 每节"场景→反例→怎么破→一句判断";给可抄的(子 Agent 决策表、协调者职责表、隔离原则、成本账、文末自查表)。
4. 主线案例复用 E2 的腾讯 4 亿 token 6 Agent 系统(Lead/Worker/Gatekeeper/Watchdog),但换角度:E2 讲它怎么失控,E5 讲它的角色分工与隔离怎么设计。

## 支撑素材(wiki / 已核实出处)

| 问题 | wiki / 出处 | 关键证据 |
|------|----------|---------|
| Q1(第四层) | `entities/claude-dynamic-workflows.md`(2026-06-07 新建,已抓 5 篇入 raw)、两篇 Anthropic 官方(已抓) | Dynamic Workflows=编排代码化、四层对比、并发 min(16,cpu-2)/上限1000、ultracode、mid-task 注入不破 cache |
| Q1/Q2 | `entities/claude-code.md`、`raw/official-posts/claude/2026-04-07-how-and-when-to-use-subagents-in-claude-code.md`(已读)、`2026-01-23-building-multi-agent-systems...md` | 子 Agent=独立上下文(浏览器标签页比喻);4 场景+signal;3-10 倍 token |
| Q3 | `topics/agentway-harness-books.md`(原则 8:多代理把不确定性分区、协调者 synthesis 稀缺)、`topics/tencent-*`(Lead/Gatekeeper)、`topics/aliyun-*`(决策权在 Harness 不在 Planner) | 协调者职责、决策权归属 |
| Q4 | `topics/tencent-*`(Git Worktree、并行不共享可写状态)、`topics/agentway-harness-books.md`(forked agent cache-safe) | 上下文/状态隔离 |
| Q5 | `concepts/quest-mode-agent-development.md`(任务流/决策点)、`topics/tencent-*`(92% token、3-10 倍) | 可观测 + 成本账 |

## 边界划分(这些已挪走,E5 不讲)

- Skill 选型(FC/MCP/Skill/插件怎么选)→ **E3**(已写)
- Skill 自进化打磨(8 阶段 Loop / 三层评测 / 5 维门控)→ **E7**(能力越用越好)
- AGENTS.md/CLAUDE.md 怎么写才起作用 → **E4**(已增补 1.1 节)
- 团队标准化推广(阿里五件套、SDD 团队落地)→ **E9**(已记入素材清单)
- 多 Agent"跑起来不跑飞"(硬闸/续跑/监控)→ **E2**(已写;E5 只讲组织/隔离/协作设计)

## 收尾检查清单(草稿待填)

- [ ] Q1 是否把"子 Agent vs 多 Agent 团队"讲清(子 Agent 是最轻形态)
- [ ] Q2 是否给了"拆/不拆"的量化判断(4 场景+signal+3-10 倍 token)
- [ ] Q3 协调者职责边界、冲突裁决、决策权归属是否讲清
- [ ] Q4 隔离是否和 E2"跑不飞"区分清楚
- [ ] 拔高是否呼应 E1"多 Agent 协作架构"

## v2 升级(2026-06-07,吸收外部 review,均已核实官方文档)

draft-v2 相对 v1 的增强:
1. **Dynamic Workflows 从 1.1 提升为"第四种协作形态"并列**:Q1 改成四形态分层表(单/子Agent/AgentTeam/DynamicWorkflow)+ 三个比喻(标签页/项目组/项目经理写成脚本)。
2. **新增"任务怎么拆"**:六种拆法(模块/文件/阶段/角色/假设/方案)+ 各自风险。
3. **新增"结果怎么收回来"**:交付协议(conclusion/evidence/files/risks/confidence)+ fan-out/fan-in + **冲突按证据裁决不按投票** + 独立验证收口。灵魂句:多 Agent 难点不是把任务分出去,是把结果收回来。
4. **补角色工具权限隔离**:Explorer 只读/Worker 可写/Reviewer 评论不改/Gatekeeper 把关。
5. **补"怎么证明值得"**:baseline 对比表(成功率/耗时/成本/质量/人工介入/冲突率),指向 E8。
6. **加多 Agent 决策树**:单→子Agent→AgentTeam→DynamicWorkflow→不拆,打穿全章。
7. **修正 token 口径**:3-10 倍改为"实践常见值",官方表述为"随活跃 teammate 线性增长/显著增加";补官方"3-5 起步、边际递减"。

已核实并入 raw(本地):Anthropic agent-teams 文档(teammates 可互通/token线性/3-5起步)、workflows 文档(无fs/shell访问/16并发1000总/ultracode)。

> draft-v1 保留留痕;draft-v2 为当前主稿。