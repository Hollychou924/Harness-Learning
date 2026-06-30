---
id: spec-driven-agent-development
type: concept
status: active
updated: 2026-05-25
sources:
  - wiki/raw/official-posts/codebuddy/2025-11-11-从氛围编程到规约编程-CodeBuddy-Spec-Kit-的探索实践带你解锁开发新范式.md
  - wiki/raw/official-posts/codebuddy/2026-02-10-数据万象-CodeBuddy从需求到交付-7-步落地研发全流程-AI-提效指南.md
  - wiki/raw/official-posts/codebuddy/2026-02-03-CodeBuddy-Code-团队实践斜杠命令-Skills-让发版流程自动化且可靠.md
  - wiki/raw/official-posts/qoder/2026-05-12-告别氛围编程基于-Harness-治理和-SDD-的团队级-AI-研发范式演进与实践.md
owners: ["zhouhao"]
when_to_load: "讨论 Spec-Kit、规约编程、需求到任务闭环、从 vibe coding 到可控交付时加载"
---

# Spec 驱动的 Agent 开发

> 一句话定义: Spec 驱动就是先把需求、边界、方案、任务和验收标准写成可执行的“规约”,再让 Agent 按规约生成和修改代码。

## 1. 为什么重要

传统 AI 编程很容易停在“氛围编程”: 用户说一个大概方向,Agent 直接写代码。短任务能跑,但真实项目里会暴露几个问题:

- 需求没说清,Agent 自己脑补。
- 设计和代码脱节,文档过期。
- 任务拆分不稳定,测试和验收漏掉。
- 团队成员很难复盘为什么这么实现。

Spec 驱动把“先写清楚”做成流程资产。CodeBuddy 的 Spec-Kit 文章把它概括成一条链路:

| 阶段 | 产物 | 作用 |
|---|---|---|
| constitution | 项目原则 | 先定义不可妥协的工程原则和质量标准 |
| specify | 功能规约 | 把自然语言需求整理成结构化需求 |
| clarify | 澄清问题 | 对不清楚的地方先问清楚 |
| plan | 技术方案 | 明确架构、数据模型、接口和约束 |
| tasks | 任务拆解 | 拆成可执行任务和依赖关系 |
| analyze | 一致性检查 | 检查 spec、plan、tasks 是否冲突 |
| implement | 代码实现 | 按任务逐步执行并验证 |

## 2. 和 vibe coding 的区别

| 维度 | 氛围编程 | Spec 驱动 |
|---|---|---|
| 真相源 | 聊天上下文和临场理解 | 规约文档 |
| 用户角色 | 不断补充、纠错、催改 | 先定义目标、边界和验收 |
| Agent 角色 | 直接生成代码 | 先澄清、计划、拆任务,再实现 |
| 风险 | 容易跑偏、返工、难复盘 | 前期慢一点,但链路更可控 |
| 团队协作 | 很难沉淀 | 文档、代码、测试同分支演进 |

## 3. 产品启示

1. 对 PM 友好: PM 不需要懂代码,但可以把业务目标、用户故事、验收标准写成规约,让 Agent 后续按规约执行。
2. 对研发友好: 研发不再反复解释工程原则,而是把规范写进模板、命令和检查清单。
3. 对团队友好: 规约、计划、任务和代码可以一起评审,避免“代码写完才发现需求理解错了”。
4. 对 Agent 友好: Agent 不需要靠长聊天记忆推断上下文,而是按固定文件和命令读取当前阶段的材料。

## 4. 和 Harness 的关系

Spec 驱动不是替代 Harness,而是给 Harness 提供更清晰的输入。

| 层级 | Spec 驱动里的对应物 |
|---|---|
| Prompt | 每个命令的角色、流程和输出要求 |
| Context | 规约、方案、任务、检查清单、历史决策 |
| Harness | 斜杠命令、模板、脚本、Hook、质量门禁 |

所以它的核心价值不是“多写几篇文档”,而是让 Agent 的行动路径从一开始就有轨道。

## 5. Qoder 的 SDD / Harness 补充

Qoder 的 SDD 文章把问题从“个人 vibe coding”推进到“团队级 AI 研发范式”: 仅有模型输出代码并不等于交付周期改善,真正要解决的是需求、计划、实现、验证的整条链路。

| Qoder 说法 | 对 Spec 驱动的补强 | 来源 |
|---|---|---|
| Specify / Plan / Implement / Validate | 规约不是一份文档,而是从需求到验证的四段链路 | [Qoder SDD / Harness](../raw/official-posts/qoder/2026-05-12-告别氛围编程基于-Harness-治理和-SDD-的团队级-AI-研发范式演进与实践.md) |
| Context engineering、架构约束、反馈回路、人类监督 | Spec 需要 Harness 承接,否则 Agent 仍会自由发挥 | [Qoder SDD / Harness](../raw/official-posts/qoder/2026-05-12-告别氛围编程基于-Harness-治理和-SDD-的团队级-AI-研发范式演进与实践.md) |
| Repo Wiki、Memory、Rules、Quest | 规约、知识和任务运行时要打通,才能形成团队级闭环 | [Qoder SDD / Harness](../raw/official-posts/qoder/2026-05-12-告别氛围编程基于-Harness-治理和-SDD-的团队级-AI-研发范式演进与实践.md) |

## 6. 来源映射

| 结论 | 来源 |
|---|---|
| CodeBuddy x Spec-Kit 把规约链路拆成 constitution / specify / clarify / plan / tasks / analyze / implement | `wiki/raw/official-posts/codebuddy/2025-11-11-从氛围编程到规约编程-CodeBuddy-Spec-Kit-的探索实践带你解锁开发新范式.md` |
| 数据万象案例把需求到交付拆成 7 步,说明 Spec / Skills 可承接真实业务流程 | `wiki/raw/official-posts/codebuddy/2026-02-10-数据万象-CodeBuddy从需求到交付-7-步落地研发全流程-AI-提效指南.md` |
| `/mr` 和 `/release` 说明规约化流程可以落成团队可复用命令 | `wiki/raw/official-posts/codebuddy/2026-02-03-CodeBuddy-Code-团队实践斜杠命令-Skills-让发版流程自动化且可靠.md` |
| 腾讯云开发者总结 SPEC 失败 5 个模式: 缺项目级宪法、AI SPEC 缺评审、过度设计、规约与实现脱钩、流程形式化 | `wiki/raw/community-posts/tencent-cloud-developer/2025-12-10-SPEC-为什么会失败.md` |
| Harness 不是 SDD 的替代,而是 SDD 的放大器: Spec 写进仓库才能被 Agent 看到 | `wiki/raw/community-posts/tencent-cloud-developer/2026-03-31-Harness-Engineering-来了SDD-还有意义吗.md` |
| 推翻"完美架构"回到提示词本质,提示团队不要把 Spec / Agent 流程做成更难维护的中台 | `wiki/raw/community-posts/tencent-cloud-developer/2026-02-27-AI-工程化落地实践推翻完美架构回归提示词本质.md` |
| 阿里系给出 Spec 的"渐进式"落地路径与 SDD-RIPER 团队一周跑通范本 | `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-02-2026-年-AI-编码的渐进式-Spec实战指南.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-09-SDD-RIPER-团队落地指南如何让整个团队在一周内跑通大模型编程.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-05-09-5-人-7-天干完-20-人数周的活Spec-Driven-Development-如何重新定义-AI-编程.md` |
| 一个 AGENTS.md 是把团队规范变成 AI 唯一可见世界的最小起点 | `wiki/raw/community-posts/aliyun-cloud-developer/2026-05-06-一个文件让-AI-Coding-效率翻倍AGENTS.md-实践指南.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-03-OpenClaw-为什么越用越好用本质就是一堆-md-文件.md` |
| Qoder 将 SDD 拆成 Specify / Plan / Implement / Validate,并强调 Repo Wiki、Memory、Rules、Quest 与 Harness 治理 | `wiki/raw/official-posts/qoder/2026-05-12-告别氛围编程基于-Harness-治理和-SDD-的团队级-AI-研发范式演进与实践.md` |

## 7. 相关页面

- [CodeBuddy](../entities/codebuddy.md)
- [Qoder](../entities/qoder.md)
- [Quest 模式的 Agent 开发](quest-mode-agent-development.md)
- [Harness Engineering](harness-engineering.md)
- [Prompt / Context / Harness 三层框架](prompt-context-harness.md)
- [只做 Prompt 不足以支撑生产级 Agent](../lessons/prompt-only-agent-is-not-production.md)
