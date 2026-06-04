# E5｜能力的组织:Skills、Subagent、Multi-Agent

> 状态:🥚 未开始 · 字数目标:6000-8000(JD 关键词最密集,可放宽)
> JD 锚点:**Skills** / **Subagent** / **Multi-Agent** / Context Engineering
> 边界说明:已从原 E5 卸掉 compact/cache(移到 E4)。本章专注"能力多了怎么管、任务大了怎么拆"。

## 本章要回答的真实问题

1. **Q1:复杂任务什么时候用 Subagent 拆、什么时候单 Agent 完成?3-10 倍 token 值不值?** — 场景:Claude Code 官方给了 4 个适用场景(上下文污染/可并行/专业化/独立复核)+ 1 个信号(读 >10 文件 或 ≥3 独立子任务)。这是最需要量化依据的决策。
2. **Q2:Skill 能跑但效果不对,怎么系统性诊断和改进?** — 场景:"能跑的 Skill 和真好的 Skill 之间有一条到西天取经的路";8 阶段自进化 Loop。
3. **Q3:多个 Agent 协作,中间怎么交接信息?协调者(Orchestrator)职责边界在哪?** — 场景:"别让 Agent 开车,让 Agent 当导航";Gatekeeper/Watchdog/Lead Agent 三层分工。
4. **Q4:AGENTS.md / CLAUDE.md 怎么写才真起作用?为什么很多团队写了 Agent 根本不遵守?** — 场景:AGENTS.md 是知识库 TF 最高的关键词,也是最多人踩坑处。"Prompt 是控制面"(分层注入+优先级+缓存预算)vs"规则太多导致行为不确定"。
5. **Q5:把 Harness 体系推广给全员,个人掌握 vs 团队标准化怎么平衡?** — 场景:"团队制度比个人技巧重要";阿里 90% 靠的是全员同一套 Rules+Skills+Wiki+变更管理,不是个人强 Prompt。

## 章节骨架

1. PM 钩子:为什么"prompt 越写越长,效果反而越差"
2. 上下文不是越多越好,是越精准越好
3. 结构化上下文:角色→目标→规则→成功标准→资源
4. Skills 模式:渐进式披露实践
5. Subagent vs Multi-Agent:任务分解 vs 角色分工
6. AGENTS.md 实战

## 支撑素材(wiki 映射)

| 问题 | wiki 素材 |
|------|----------|
| Q1/Q3 | `reports/portfolio/context-engineering/report.md`、`entities/claude-code.md`(Subagent)、`comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md` |
| Q2 | `topics/tencent-cloud-developer-agent-harness-collection.md`(Skill 自训练 8 阶段)、`concepts/quest-mode-agent-development.md` |
| Q4 | `concepts/progressive-disclosure.md`、`concepts/spec-driven-agent-development.md`、`topics/agentway-harness-books.md`(book1 Prompt 控制面) |
| Q5 | `topics/aliyun-cloud-developer-agent-collection.md`(90% 案例)、`topics/agentway-harness-books.md`(原则 10) |

## 收尾检查清单(草稿待填)

- [ ] Subagent 是否给了"拆/不拆"的量化判断标准
- [ ] AGENTS.md 是否给了"写了不遵守"的根因 + 修法
