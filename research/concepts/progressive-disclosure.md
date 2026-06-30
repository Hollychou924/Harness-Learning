---
id: progressive-disclosure
type: concept
status: active
updated: 2026-05-25
sources:
  - wiki/analysis/entity-scan.md
  - wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md
  - wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md
  - wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md
  - wiki/raw/official-posts/codebuddy/2025-11-05-国内首家-CodeBuddy-Skills-驱动的-AI-编程实践.md
  - wiki/raw/official-posts/codebuddy/2025-12-26-节省-Token-终极技巧掌握-CodeBuddy-上下文管理高效避坑不浪费.md
  - wiki/raw/official-posts/qoder/2026-05-20-Qoder-CLI-10-正式发布同时开放-Agent-SDK-和-Cloud-Agents.md
  - wiki/raw/official-posts/qoder/2026-04-16-Agent-Skills-终于有-UI-了.md
  - wiki/raw/official-posts/qoder/2026-05-23-Qoder-上线应用窗口快照把任何窗口变成-Qoder-的上下文.md
  - wiki/raw/official-posts/qoder/2026-03-18-工程知识引擎Harness-Engineering体系下的工程知识底座.md
owners: ["zhouhao"]
when_to_load: "讨论 Skills、工具市场、MCP、按需加载、上下文节省时加载"
---

# 渐进式披露

> 一句话定义: 渐进式披露就是先只告诉 Agent“有哪些能力”,等任务真的需要时,再把具体说明加载进上下文。

## 为什么重要

Agent 能力越多,越容易遇到两个问题:

- 上下文被工具说明、技能说明塞满,真正任务材料反而放不下。
- 模型面对太多能力选择,更容易选错工具或过度调用。

渐进式披露的做法是把能力分成两层:

1. 第一层: 名称 + 简短描述,用于判断是否需要。
2. 第二层: 完整说明文档,只有命中任务时才读取。

## 在 66 篇文章里的位置

之前的中文社区统计里,Skills、MCP、AGENTS.md、CLAUDE.md 都是高频实体。它们背后其实都指向同一件事: Agent 产品正在从“堆能力”转向“按需调能力”。

## 典型落地方式

| 方式 | 例子 | 产品意义 |
|---|---|---|
| Skill 列表先露出 | 只把 skill 名称和描述给模型 | 节省上下文 |
| 命中后读说明 | 再打开 SKILL.md | 降低误用 |
| 三层加载 | CodeBuddy 将 Skills 拆成元数据、核心指令、资源层 | 让能力可发现,但不把完整资料常驻上下文 |
| 五类扩展点 | Qoder CLI 1.0 将 Skills、Hooks、MCP、Subagent、Command 做成正交扩展点 | 让知识、工具、流程和管控各走各的入口 |
| Agentic Search | Qoder 工程知识引擎把多源检索升级为可规划、可反思、可迭代的子任务 | Agent 不再机械调用 grep / search,而是根据任务目标动态决定看什么 |
| Skill UI | Qoder 在 Quest 里支持为 Skills 生成 UI 控件 | 把人工介入从长文本追问变成结构化选择 |
| 窗口快照 | Qoder 将任意应用窗口截图纳入上下文 | 让 Agent 按需读取当前工作现场,而不是预先塞满资料 |
| 工具市场 | ClawHub / Marketplace | 能力可扩展 |
| 项目规则文件 | AGENTS.md / CLAUDE.md / .cursor rules | 团队规则可继承 |

## 风险

渐进式披露提升了扩展性,但也带来新风险: 如果 Skill 或插件可以执行脚本,它就不只是“知识包”,而是“可执行能力”。所以成熟产品必须配套来源校验、权限提示和沙盒隔离。

## 代表性原文

- [OpenClaw 的 Skills 条件加载](../raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md)
- [Claude Code 的 Skill / Agent 使用指导](../raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md)
- [Hermes 的插件和生态兼容](../raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md)

## 来源映射

| 结论 | 来源 |
|---|---|
| 渐进式披露在 66 篇里出现 DF=23 / TF=58 | `wiki/analysis/entity-scan.md` |
| OpenClaw 通过 Skills 列表和 SKILL.md 按需读取实现渐进式披露 | `wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md` |
| Claude Code 通过 Skill / Agent 使用指导降低主上下文压力 | `wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md` |
| Hermes 通过插件和生态兼容扩展能力边界 | `wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md` |
| CodeBuddy 官方文章明确把 Skills 拆成元数据、核心指令、资源三层,并建议优先用 Skills、谨慎用 MCP | `wiki/raw/official-posts/codebuddy/2025-11-05-国内首家-CodeBuddy-Skills-驱动的-AI-编程实践.md` + `wiki/raw/official-posts/codebuddy/2025-12-26-节省-Token-终极技巧掌握-CodeBuddy-上下文管理高效避坑不浪费.md` |
| 腾讯云开发者把 Skills 解释为"公共 Prompt + 中台思维 + 渐进式披露",并提出 Skill 自训练 8 阶段 Loop / 3 层评测 / 5 维 AND 门控 | `wiki/raw/community-posts/tencent-cloud-developer/2026-03-13-一文搞懂爆火的SKills原理及实践案例.md` + `wiki/raw/community-posts/tencent-cloud-developer/2026-05-19-让Skill自己训练自己8阶段Loop3层评测5维AND门控从此实现自进化.md` |
| Hermes 自进化的本质是 Prompt + 文件持久化的 Skills 闭环,而非改模型权重 | `wiki/raw/community-posts/tencent-cloud-developer/2026-05-12-拆完Hermes源码我发现Agent的自我进化根本不需要训练模型.md` + `wiki/raw/community-posts/tencent-cloud-developer/2026-04-15-一文搞懂Hermes新顶流Agent如何从经验中自我进化.md` |
| 阿里系作者把 Skill 写成可规范、可设计、可被 Skill Factory 自动生成的工程对象 | `wiki/raw/community-posts/aliyun-cloud-developer/2026-05-12-Agent-Skill规范构建与设计模式.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-05-14-Skill-Factory三天手搓面向Harness设计的技能工厂附AI-coding实践.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-27-工作流的-Skill-怎么写从-7-个顶级-Skill-中提炼的模式与最佳实践.md` |
| Qoder Skills 完全指南给出"从零开始让 AI 按你的标准执行"的零基础落地路径 | `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-30-Qoder-Skills-完全指南从零开始让-AI-按你的标准执行.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-01-Agent-Skills打通可复用专业领域知识的最后一公里.md` |
| Qoder 官方材料把 Skills、Hooks、MCP、Subagent、Command 拆成正交扩展点,并用 Skill UI 和窗口快照补充按需上下文 | `wiki/raw/official-posts/qoder/2026-05-20-Qoder-CLI-10-正式发布同时开放-Agent-SDK-和-Cloud-Agents.md` + `wiki/raw/official-posts/qoder/2026-04-16-Agent-Skills-终于有-UI-了.md` + `wiki/raw/official-posts/qoder/2026-05-23-Qoder-上线应用窗口快照把任何窗口变成-Qoder-的上下文.md` |
| Qoder 工程知识引擎把 Agentic Search 定义为任务驱动的检索决策框架 | `wiki/raw/official-posts/qoder/2026-03-18-工程知识引擎Harness-Engineering体系下的工程知识底座.md` |

## 相关页面

- [Harness Engineering](harness-engineering.md)
- [Prompt / Context / Harness 三层框架](prompt-context-harness.md)
- [CodeBuddy](../entities/codebuddy.md)
- [Qoder](../entities/qoder.md)
- [OpenClaw / Claude Code / Hermes 运行架构对比](../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)
