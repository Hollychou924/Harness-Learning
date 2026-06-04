---
id: agent-runtime-architecture-openclaw-claude-code-hermes
type: comparison
status: active
updated: 2026-05-25
sources:
  - wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md
  - wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md
  - wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md
owners: ["zhouhao"]
when_to_load: "需要比较 OpenClaw、Claude Code、Hermes 的 Prompt / Context / Harness 设计时加载"
---

# OpenClaw / Claude Code / Hermes 运行架构对比

## 1. 一句话差异

OpenClaw 偏个人 Agent 操作系统,Claude Code 偏工程任务执行平台,Hermes 偏自进化 Agent 实验场。

## 2. 对比矩阵

| 维度 | OpenClaw | Claude Code | Hermes Agent |
|---|---|---|---|
| 目标场景 | 个人助理、多渠道消息、个人设备能力 | 软件工程任务、代码库理解、命令行执行 | 任务轨迹沉淀、Skill 生成、训练反馈 |
| Prompt 设计 | 20 多个模块动态拼装 | 静态规则 + 动态环境注入 | 按模型差异注入工具使用指导 |
| Context 设计 | Markdown 文件注入、Skills、记忆、压缩 | CLAUDE.md、自动记忆、git/环境注入、压缩 | 比例阈值压缩、@资源注入、内外部记忆 |
| Harness 设计 | Hook、沙盒、心跳、授权发送者、多渠道消息 | 权限引擎、沙盒、Hook、子 Agent、长任务 | 错误分类恢复、子 Agent 隔离、插件、安全护栏 |
| 最大启示 | 个人化 Agent 需要文件化人格和记忆 | 工程 Agent 需要权限、质量和回滚 | 自进化先沉淀 Skill,再谈训练回流 |

## 3. 决策含义

- 如果要做个人助理型 Agent,OpenClaw 的文件化人格和多渠道消息更值得参考。
- 如果要做 AI Coding 产品,Claude Code 的权限、Hook、子 Agent 和工程任务规范更值得参考。
- 如果要做“越用越聪明”的 Agent,Hermes 的轨迹记录、Skill 抽象和训练闭环更值得参考。

## 4. 来源映射

| 结论 | 来源 |
|---|---|
| OpenClaw 使用 Markdown 文件注入人格、工具、记忆等配置 | `wiki/raw/harness-engineering/4_特定框架/009-深度解析-OpenClaw-在-Prompt--Context--Harness.md` |
| Claude Code 把工程任务规则、工具使用、安全边界写进系统层 | `wiki/raw/harness-engineering/4_特定框架/010-深度解析-Claude-Code-在-Prompt--Context--Harn.md` |
| Hermes 把轨迹数据和 Skill 生成纳入自进化闭环 | `wiki/raw/harness-engineering/4_特定框架/011-深度解析-Hermes-Agent-如何实现自进化及其-Prompt--Cont.md` |

## 5. 相关页面

- [OpenClaw](../entities/openclaw.md)
- [Claude Code](../entities/claude-code.md)
- [Hermes Agent](../entities/hermes-agent.md)
## AGENTWAY 比较书视角的补强 (运行时优先 vs 制度层优先)

来自 [agentway.dev / Comparative Harness Notes](../raw/books/agentway/2026-04-01-agentway-claude-code-vs-codex-comparative-harness-notes.md) 这本 54 页比较专著的源码级判断, 是目前最系统的 Claude Code vs Codex 哲学对照:

| 比较轴 | Claude Code (运行时优先) | Codex (制度层优先) |
|---|---|---|
| **气质** | 秩序住在运行时 (Runtime Discipline) | 规矩住在系统外沿 (Policy and Local Rules) |
| **控制面** | 动态装配线: prompt 每轮按段拼装 | 带编号的公文系统: schema 化、显式注入 |
| **本地规则** | CLAUDE.md (经验收编、现场记忆) | AGENTS.md (制度挂载、结构化注入) |
| **心跳/连续性** | 把连续性压进主循环 (内聚 query loop) | 把连续性拆成线程/rollout/状态桥 (外聚状态机) |
| **工具治理** | 重点在运行时编排和危险动作约束 (StreamingToolExecutor) | 重点在工具 schema、审批参数和策略引擎 (Policy DSL) |
| **本地治理** | Hook + 现场记忆,经验收编 | 事件系统 + 结构化注入,制度挂载 |
| **多代理** | 服务于运行时职责分区 | 服务于显式工具化协作 |

**总判断**: 殊途同归 (都承认模型不可靠) + 各表一枝 (秩序住在不同层)。**Claude Code 走"纪律内化", Codex 走"制度外化"**——但两者不天然对立, 大组织最终往往是混合: 内聚 query loop + 外置策略层。

**对 DeepSeek 桌面端 Agent 选型的启示**: 第 8 章给出三种团队起手方向 — 小团队/原型期学 Claude Code, 中型团队/合规压力学 Codex, 大组织混合走两路。

## 第三方横评视角的补强 (桌面 Agent / Harness 三方向)

| 视角 | 来源 |
|---|---|
| 三大开源 Agent Harness 的方向分工: OpenClaw 解决"入口/控制平面",Hermes 解决"自我演化运行时",OpenHuman 解决"个人上下文/产品体验" | `wiki/raw/community-posts/desktop-agent-comparisons/2026-05-22-三个-Agent-Harness-框架对比OpenClawHermes-AgentOpenHuman-到底差在哪.md` + `wiki/raw/community-posts/desktop-agent-comparisons/2026-05-20-OpenHumanHermesOpenClaw-三大开源-AI-Agent-深度对比.md` |
| Antigravity (Google DeepMind) vs Claude Code 两条架构哲学: "显式协调"(task_boundary 状态机 + artifact 文件 + 服务端状态) vs "模型智能"(扁平 messages + 客户端隐式累积) | `wiki/raw/community-posts/desktop-agent-comparisons/2026-01-22-React-Agent-多轮对话架构深度对比-Antigravity-vs-Claude-Code.md` |
| OpenClaw 平替全景: 2026 年 20+ 桌面 Agent 工具横评, 找到 OpenClaw 在不同场景下的替代方案 | `wiki/raw/community-posts/desktop-agent-comparisons/2026-03-03-OpenClaw-平替产品全景对比2026-年-20+AI-Agent-工具深度评测.md` |
| DeepSeek-TUI / Claude Code / OpenClaw 三类 Agent 平台差异: 不在于"谁更像人",而在于把模型连接到哪些工具/文件/渠道/权限 | `wiki/raw/community-posts/desktop-agent-comparisons/2026-05-12-DeepSeek-TUIClaude-CodeOpenClaw三类-Agent-平台如何对比理解.md` |

详细见 [桌面 Agent 第三方横评合集](../topics/desktop-agent-third-party-comparisons.md)。

## 腾讯云开发者社区视角的补强

| 视角 | 来源 |
|---|---|
| 把 Hermes 自进化拆成 Skills 闭环 7 阶段, 强调本质是 Prompt + 文件持久化 | `wiki/raw/community-posts/tencent-cloud-developer/2026-05-12-拆完Hermes源码我发现Agent的自我进化根本不需要训练模型.md` + `wiki/raw/community-posts/tencent-cloud-developer/2026-04-15-一文搞懂Hermes新顶流Agent如何从经验中自我进化.md` |
| Hermes VS OpenClaw: 全能管家 vs 越用越强, 一个无状态、一个四维持久记忆 | `wiki/raw/community-posts/tencent-cloud-developer/2026-04-21-全方位对比Hermes-VS-OpenClaw.md` |
| OpenClaw System Prompt + Skill + Loop 三件套源码级解读 | `wiki/raw/community-posts/tencent-cloud-developer/2026-05-26-平平无奇的源码竟藏着Agent的核心秘密.md` + `wiki/raw/community-posts/tencent-cloud-developer/2026-02-03-解构Clawdbot本地架构记忆管理Agent-编排与上下文组装原理.md` |
| Claude Code 200 行青春版 + 12 条源码发现 + 卧底模式与 Grep 实现 | `wiki/raw/community-posts/tencent-cloud-developer/2026-03-03-200行代码实现Claude-Code青春版.md` + `wiki/raw/community-posts/tencent-cloud-developer/2026-04-02-Claude-Code是怎么知道你在骂他的这-12-条发现值得关注.md` + `wiki/raw/community-posts/tencent-cloud-developer/2026-04-30-RAG已死不是Grep回归了.md` + `wiki/raw/community-posts/tencent-cloud-developer/2026-04-01-逆向深扒Claude-Code源码我发现了什么.md` |
| OpenClaw 双源记忆 + 上下文压缩方案的代码细节 | `wiki/raw/community-posts/tencent-cloud-developer/2026-03-19-从架构到代码深入理解-OpenClaw-的双源记忆系统.md` + `wiki/raw/community-posts/tencent-cloud-developer/2026-03-04-深入解析OpenClaw上下文窗口压缩方案-一切都是为了效果与省钱.md` |
| 阿里系作者从启动流程到多 Agent 扩展层完整拆 Claude Code, 并写出 Mini-Claude 7 小时复现版 | `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-15-Claude-Code-源码拆解从启动到多-Agent-扩展层.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-17-赛博鸡生蛋7小时用Claude-Vibe-Coding一个Mini-Claude.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-20-深度解析-Claude-Code-在-Prompt-Context-Harness-的设计与实践.md` |
| 阿里系两篇深拆 OpenClaw 技术架构, 强调"越用越好用本质就是一堆 md 文件" | `wiki/raw/community-posts/aliyun-cloud-developer/2026-03-19-深入理解OpenClaw技术架构与实现原理上.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-03-26-深入理解OpenClaw技术架构与实现原理下.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-13-深度解析-OpenClaw-在-Prompt-Context-Harness-三个维度中的设计哲学与实践.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-03-OpenClaw-为什么越用越好用本质就是一堆-md-文件.md` |
| 阿里系拆 Hermes Self-Improving 与 Prompt/Context/Harness 设计 | `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-23-深入源码Hermes-Agent-如何实现-Self-Improving.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-24-深度解析-Hermes-Agent-如何实现自进化及其-Prompt-Context-Harness-的设计实践.md` |
| 阿里系把记忆从 OpenClaw 推到企业级中间件: Tablestore + Mem0 / Tair 短期记忆 / OpenClaw 长期记忆 | `wiki/raw/community-posts/aliyun-cloud-developer/2026-03-26-阿里云-Tablestore-基于-Mem0-为-OpenClaw-构建记忆系统最佳实践.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-03-27-Tair-短期记忆架构实践淘宝闪购-AI-Agent-的秒级响应记忆系统.md` + `wiki/raw/community-posts/aliyun-cloud-developer/2026-04-15-OpenClaw长期记忆优秀管线与玄学效果.md` |

- [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md)

