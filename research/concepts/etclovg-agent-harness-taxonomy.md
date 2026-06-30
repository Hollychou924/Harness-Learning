---
id: etclovg-agent-harness-taxonomy
type: concept
status: active
updated: 2026-05-28
sources:
  - wiki/raw/papers/agent-harness-engineering-survey/2026-05-16-agent-harness-engineering-a-survey.md
  - wiki/raw/papers/agent-harness-engineering-survey/main.pdf
  - wiki/raw/community-posts/harness-2026-05-28-supplement/2026-05-28-刚刚一篇最全Agent-Harness综述来了.md
  - wiki/raw/community-posts/harness-2026-05-28-supplement/2026-05-15-Harness-完全指南harness-是一切工作的核心13万字.md
  - wiki/raw/community-posts/harness-2026-05-28-supplement/2026-04-02-一文读懂Harness-Engineering从14篇工程文章中寻找那个让AI不再离经叛道的壳｜Hao好聊趋势.md
  - wiki/raw/community-posts/harness-2026-05-28-supplement/2026-04-04-踩坑三个月我们总结出的-Agent-Harness-实践与反思.md
  - wiki/raw/community-posts/harness-2026-05-28-supplement/2026-04-28-我再次深刻理解了-Context-的价值.md
  - wiki/raw/community-posts/harness-2026-05-28-supplement/2026-05-19-Harness-工程实践复盘100-Cache-命中的-Agent-怎么设计.md
  - wiki/raw/community-posts/harness-2026-05-28-supplement/2026-04-23-HarnessAI时代的操作系统.md
  - wiki/raw/community-posts/harness-2026-05-28-supplement/2026-04-30-模型降智后Harness要从规则加入执行入口踩坑系列一.md
owners: ["zhouhao"]
when_to_load: "需要把 Agent Harness 拆成执行、工具、上下文、生命周期、可观测、评测、治理七个模块时加载"
---

# ETCLOVG Agent Harness 七层分类法

> 一句话定义: ETCLOVG 是一张检查清单,用来判断一个 Agent 的外壳是否能支撑真实任务,而不是只会聊天或演示。

## 七层分别管什么

| 层 | 中文理解 | 解决的问题 | 产品检查点 |
|---|---|---|---|
| E - Execution | 执行环境 | Agent 在哪里动手,会不会误伤真实系统 | 沙箱、隔离、可回滚、资源边界 |
| T - Tooling | 工具接口 | Agent 怎么调用外部能力 | 工具清单、参数约束、调用协议、失败提示 |
| C - Context | 上下文 | Agent 每一步应该看什么材料 | 项目规则、记忆、检索、压缩、缓存 |
| L - Lifecycle | 任务生命周期 | 长任务怎么开始、暂停、恢复、结束 | 计划、状态、检查点、人工接管 |
| O - Observability | 可观测 | 出错后能不能看懂发生了什么 | 轨迹、日志、成本、失败原因、运行看板 |
| V - Verification | 验证评测 | 怎么判断结果真的可用 | 测试、评测集、回归检查、质量打分 |
| G - Governance | 治理安全 | 谁能让 Agent 做什么 | 权限、审批、审计、安全策略 |

## 和原来三层框架的关系

原来的 Prompt / Context / Harness 三层框架适合做产品解释:

- Prompt: 下指令。
- Context: 给材料。
- Harness: 控执行。

ETCLOVG 是对 Harness 这一层的继续展开。它把“控执行”拆成七个可落地模块,适合做产品方案、评审清单和竞品对比。

## 论文带来的 4 个升级

1. Harness 不再只是工具和权限,而是独立系统层。
2. 评测和可观测被放进 Harness 内部,不是上线后的附属工作。
3. 治理安全是单独一层,说明权限、审计、审批不能靠提示词解决。
4. Harness 改动要当成系统改动来评估,不能只看单个模块是否更强。

## 对产品经理的用法

拿到一个 Agent 产品,可以直接问七个问题:

| 问题 | 对应层 |
|---|---|
| 它在哪里安全动手? | E |
| 它能调用哪些工具,工具边界清楚吗? | T |
| 它每一步看什么材料,会不会越跑越乱? | C |
| 长任务中断后能不能接着干? | L |
| 失败后能不能复盘责任点? | O |
| 结果有没有独立验收? | V |
| 危险动作有没有权限和审计? | G |

## 来源映射

| 结论 | 来源 |
|---|---|
| Harness 是独立系统层,真实可靠性不只由模型决定 | wiki/raw/papers/agent-harness-engineering-survey/2026-05-16-agent-harness-engineering-a-survey.md |
| ETCLOVG 七层包括 Execution、Tooling、Context、Lifecycle、Observability、Verification、Governance | wiki/raw/papers/agent-harness-engineering-survey/2026-05-16-agent-harness-engineering-a-survey.md |
| 开源项目映射显示 Lifecycle、Verification、Execution 覆盖较密,Observability 和 Governance 更薄 | wiki/raw/papers/agent-harness-engineering-survey/2026-05-16-agent-harness-engineering-a-survey.md |
| 轨迹应成为失败诊断、结果打分和回归测试的主要对象 | wiki/raw/papers/agent-harness-engineering-survey/2026-05-16-agent-harness-engineering-a-survey.md |

## 相关页面

- [Harness Engineering](harness-engineering.md)
- [Prompt / Context / Harness 三层框架](prompt-context-harness.md)
- [Agent Harness 设计范式演进](../timelines/agent-harness-design-evolution.md)
- [Agent 评测体系](../topics/agent-evaluation-system.md)
