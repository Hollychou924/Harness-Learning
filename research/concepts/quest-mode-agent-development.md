---
id: quest-mode-agent-development
type: concept
status: active
updated: 2026-05-25
sources:
  - wiki/raw/official-posts/qoder/2026-05-15-以-Qoder-开发-Qoder9-个月-60个版本Qoder10-来了.md
  - wiki/raw/official-posts/qoder/2026-04-30-Qoder-正式支持远程控制一部手机随时随地掌控你的所有-Agent.md
  - wiki/raw/official-posts/qoder/2026-05-20-Qoder-CLI-10-正式发布同时开放-Agent-SDK-和-Cloud-Agents.md
  - wiki/raw/official-posts/qoder/2026-03-25-Qoder-IDE-v0.9Experts-专家团模式有了全景视图Quest-能直接连数据库了.md
  - wiki/raw/official-posts/qoder/2026-03-26-不是换了几个-Prompt-这么简单Experts专家团背后的-Harness-Engineering-工程实践.md
owners: ["zhouhao"]
when_to_load: "讨论 Quest、任务流、长任务、远程控制、多任务看板、Agent-first 工作台时加载"
---

# Quest 模式的 Agent 开发

> 一句话定义: Quest 模式就是把 Agent 从聊天框里拿出来,放进一个以任务为中心的工作台,让计划、执行、工具、状态、产物和审批都可见。

## 1. 为什么重要

复杂 Agent 任务的核心矛盾不是“能不能生成答案”,而是用户能不能持续掌控过程:

- 任务跑到哪一步了?
- Agent 为什么这么判断?
- 调用了哪些工具和上下文?
- 哪些地方需要我确认?
- 最后交付了哪些产物?

聊天流适合短问短答,但不适合几十步的工程任务。Qoder 的远程控制文章把这个差异说得很清楚: IM 底层是对话流,而 Qoder 移动端底层是任务流。用户看到的是任务卡片、执行计划、推理过程、工具调用和决策点。

## 2. Quest 模式的最小结构

| 模块 | 作用 | Qoder 证据 |
|---|---|---|
| 任务卡片 | 展示运行中、等待确认、已完成等状态 | [远程控制](../raw/official-posts/qoder/2026-04-30-Qoder-正式支持远程控制一部手机随时随地掌控你的所有-Agent.md), [Qoder 1.0](../raw/official-posts/qoder/2026-05-15-以-Qoder-开发-Qoder9-个月-60个版本Qoder10-来了.md) |
| 执行计划 | 让用户知道 Agent 准备怎么做 | [远程控制](../raw/official-posts/qoder/2026-04-30-Qoder-正式支持远程控制一部手机随时随地掌控你的所有-Agent.md) |
| 工具与上下文展开 | 工程信息按需展开,包括文件目录、代码变更、终端输出、浏览器预览 | [Qoder 1.0](../raw/official-posts/qoder/2026-05-15-以-Qoder-开发-Qoder9-个月-60个版本Qoder10-来了.md) |
| 决策点 | 用户可以放行、改方向、打回 | [远程控制](../raw/official-posts/qoder/2026-04-30-Qoder-正式支持远程控制一部手机随时随地掌控你的所有-Agent.md) |
| 产物链路 | 任务结束后生成 Summary、产物文档和代码变更 | [Qoder 1.0](../raw/official-posts/qoder/2026-05-15-以-Qoder-开发-Qoder9-个月-60个版本Qoder10-来了.md) |
| 多任务面板 | 跨项目、跨代码库并行运行多个任务 | [Qoder 1.0](../raw/official-posts/qoder/2026-05-15-以-Qoder-开发-Qoder9-个月-60个版本Qoder10-来了.md) |
| Experts 全景视图 | 专家团任务可被拆成多个角色、阶段和状态,并以全景视图呈现 | [Qoder IDE v0.9](../raw/official-posts/qoder/2026-03-25-Qoder-IDE-v0.9Experts-专家团模式有了全景视图Quest-能直接连数据库了.md) |
| 数据库连接 | Quest 可直接连接数据库,让 Agent 面向真实数据完成分析或研发任务 | [Qoder IDE v0.9](../raw/official-posts/qoder/2026-03-25-Qoder-IDE-v0.9Experts-专家团模式有了全景视图Quest-能直接连数据库了.md) |

## 3. 和聊天模式的区别

| 维度 | 聊天模式 | Quest 模式 |
|---|---|---|
| 组织单位 | 消息 | 任务 |
| 用户掌控 | 靠翻聊天记录 | 靠计划、状态、决策点和产物 |
| 多任务 | 多个对话容易混乱 | 多个任务卡片并行管理 |
| 过程复盘 | 依赖长上下文和人工回看 | 工具、推理、上下文、产物结构化沉淀 |
| 适用场景 | 简单问答、局部修改 | 长任务、跨项目、多步骤交付 |

## 4. 和 Spec 驱动的关系

Spec 驱动解决“任务开始前怎么说清楚”,Quest 模式解决“任务运行中怎么看得见、管得住、能验收”。

| 阶段 | Spec 驱动 | Quest 模式 |
|---|---|---|
| 开始前 | 需求、边界、计划、任务、验收标准 | 把目标变成可执行任务 |
| 运行中 | 按规约读取上下文 | 展示计划、工具、状态、决策点 |
| 完成后 | 对照验收标准检查 | 汇总产物、代码变更和 Review 结果 |

两者合在一起,才是更完整的 Agent-first 工作流: 先把需求规约化,再把执行任务化。

## 5. 产品启示

1. 移动端 Agent 不应只是“远程聊天窗口”,而应该是任务审批和状态追踪面板。
2. 长任务需要明确的暂停点,让用户在关键节点改方向,不是等结果跑偏后整体返工。
3. 产物审查要独立出来,否则用户只能在一堆日志里找最终交付。
4. 多任务并行必须有全局视图,否则并发越多,用户越失控。
5. Quest 模式本质是把 Agent 的黑箱过程变成可运营的任务流水线。

## 6. 来源映射

| 结论 | 来源 |
|---|---|
| Qoder 将产品形态从 AI IDE 升级为自主开发工作台,Quest 成为独立视窗 | `wiki/raw/official-posts/qoder/2026-05-15-以-Qoder-开发-Qoder9-个月-60个版本Qoder10-来了.md` |
| Qoder 远程控制强调“对话流 vs 任务流”,移动端展示任务卡片、计划、推理、工具和决策点 | `wiki/raw/official-posts/qoder/2026-04-30-Qoder-正式支持远程控制一部手机随时随地掌控你的所有-Agent.md` |
| Qoder CLI 1.0 的 `/goal` 和云端运行补强了长任务模式 | `wiki/raw/official-posts/qoder/2026-05-20-Qoder-CLI-10-正式发布同时开放-Agent-SDK-和-Cloud-Agents.md` |
| Qoder IDE v0.9 已经把 Experts 全景视图和 Quest 连接数据库作为任务工作台能力 | `wiki/raw/official-posts/qoder/2026-03-25-Qoder-IDE-v0.9Experts-专家团模式有了全景视图Quest-能直接连数据库了.md` |

## 7. 相关页面

- [Qoder](../entities/qoder.md)
- [Spec 驱动的 Agent 开发](spec-driven-agent-development.md)
- [Harness Engineering](harness-engineering.md)
- [Qoder / CodeBuddy / Cursor / Claude Code 对比](../comparisons/qoder-codebuddy-cursor-claude-code-comparison.md)
