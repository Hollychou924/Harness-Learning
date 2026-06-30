---
id: codex
type: entity
status: active
updated: 2026-06-09
sources:
  - wiki/raw/official-posts/codex/INDEX.md
  - wiki/raw/official-posts/codex/2026-01-23-深入解析-codex-智能体循环.md
  - wiki/raw/official-posts/codex/2026-02-04-解锁-codex-运行框架-我们如何构建-app-server.md
  - wiki/raw/official-posts/codex/2026-02-11-工程技术-在智能体优先的世界中利用-codex.md
  - wiki/raw/official-posts/codex/2026-04-22-使用-websocket-加速-responses-api-的智能体工作流.md
  - wiki/raw/official-posts/codex/2026-05-08-在-openai-内部安全运行-codex.md
  - wiki/raw/official-posts/codex/2026-05-13-building-a-safe-effective-sandbox-to-enable-codex-on-windows.md
  - wiki/raw/official-posts/codex/2026-05-14-work-with-codex-from-anywhere.md
  - wiki/compiled/codex/_provenance.json
owners: ["zhouhao"]
when_to_load: "讨论 Codex、OpenAI Coding Agent、本地/云端混合 Agent、运行框架、安全沙箱、企业化部署时加载"
---

# Codex

> 一句话: Codex 是 OpenAI 的软件工程智能体产品线,核心不是单次写代码,而是把模型、工具、沙箱、上下文、审批、日志、云端任务和多端入口组合成一套可规模化运行的工程工作区。

## 1. 是什么

OpenAI 官方把 Codex 视为一组软件智能体产品,包括 Codex CLI、Codex Cloud、IDE 扩展、macOS 应用和移动端入口。它们共享同一个 Codex 运行框架: 智能体循环、工具执行、线程持久化、配置、身份认证、沙箱和扩展能力。

这意味着 Codex 的竞争点不是“某个模型会不会写代码”,而是:

- 本地能不能安全执行命令。
- 云端能不能跑长任务。
- 多端能不能接住同一个任务状态。
- 企业能不能管权限、网络、凭据和审计。
- API 能不能支撑大量工具调用下的低延迟循环。

## 2. 关键机制

| 机制 | 说明 | 产品含义 | 来源 |
|---|---|---|---|
| 智能体循环 | Codex 在用户输入、模型推理、工具调用、工具结果回填之间循环,直到生成最终回复或交还控制权 | Codex 的本质是“模型 + 工具 + 状态”的执行循环,不是普通聊天 | [深入解析 Codex 智能体循环](../raw/official-posts/codex/2026-01-23-深入解析-codex-智能体循环.md) |
| Responses API 驱动 | Codex CLI 通过 Responses API 推理,把 `instructions`、`tools`、`input` 组织成模型请求 | Codex 把 Agent 运行时和 OpenAI API 体系深度绑定,同时保留自定义端点空间 | [深入解析 Codex 智能体循环](../raw/official-posts/codex/2026-01-23-深入解析-codex-智能体循环.md) |
| App Server | App Server 用 JSON-RPC 把同一个 Codex 核心运行框架暴露给 CLI、IDE、桌面应用和合作伙伴产品 | 多端一致体验来自同一套运行框架,不是每个端各写一个 Agent | [解锁 Codex 运行框架](../raw/official-posts/codex/2026-02-04-解锁-codex-运行框架-我们如何构建-app-server.md) |
| 线程 / 轮次 / 项目 | App Server 把交互拆成线程、轮次、项目,支持恢复、派生、归档和流式更新 | 这是长任务和多端恢复的基础数据模型 | [解锁 Codex 运行框架](../raw/official-posts/codex/2026-02-04-解锁-codex-运行框架-我们如何构建-app-server.md) |
| 沙箱和审批 | 沙箱限制写入位置、网络访问和受保护路径; 审批决定何时需要人确认 | Codex 的安全不是靠模型自觉,而是靠系统边界和审批策略 | [在 OpenAI 内部安全运行 Codex](../raw/official-posts/codex/2026-05-08-在-openai-内部安全运行-codex.md) |
| Windows 沙箱 | Windows 版通过受限 token、专用本地用户、ACL 和防火墙规则实现文件与网络边界 | 跨平台 Agent 的难点是操作系统级约束,不是 UI 适配 | [Windows 沙箱](../raw/official-posts/codex/2026-05-13-building-a-safe-effective-sandbox-to-enable-codex-on-windows.md) |
| 智能体原生日志 | Codex 可导出用户提示、审批、工具结果、MCP 使用、网络代理允许/拒绝等事件 | 企业真正需要的是能解释“Agent 为什么这么做”的审计线索 | [在 OpenAI 内部安全运行 Codex](../raw/official-posts/codex/2026-05-08-在-openai-内部安全运行-codex.md) |
| WebSocket 加速 | Responses API WebSocket 模式复用连接内状态,减少重复处理完整对话历史 | Agent 体验会被循环延迟限制,API 传输层也是产品体验的一部分 | [WebSocket 加速](../raw/official-posts/codex/2026-04-22-使用-websocket-加速-responses-api-的智能体工作流.md) |
| 多端远程协作 | 移动端可查看线程、审批命令、改方向、看截图/终端输出/diff/test 结果 | 长任务 Agent 需要“人随时接管”的入口,不只是在电脑前使用 | [Work with Codex from anywhere](../raw/official-posts/codex/2026-05-14-work-with-codex-from-anywhere.md) |
| 企业化部署 | Codex 支持企业控制、混合/本地环境、GSI 合作、AWS / Dell 等渠道 | OpenAI 正把 Codex 从开发者工具推向企业操作层 | [将 Codex 扩展至全球企业](../raw/official-posts/codex/2026-04-21-将-codex-扩展至全球企业.md), [Dell 合作](../raw/official-posts/codex/2026-05-18-openai-and-dell-technologies-partner-to-bring-codex-to-hybrid-and-on-premises.md) |

### 2.1 记忆与压缩的源码级细节(2026-06 逆向补充)

基于孔某人的低维认知对 Codex 2026-06-01 main 的逆向([记忆/压缩横评](../comparisons/harness-memory-compaction-implementation.md)):

- 记忆 = 批量挖掘路线(与 Claude Code 增量编辑相反):新会话启动时两阶段提取,Phase1 用 mini 模型并行提取、Phase2 合并,整合进 memory_summary.md / MEMORY.md / skills / rollout_summaries 分层文件夹;用户主动改记忆只能写 `extensions/ad_hoc/notes/` 的小文件,不直接编辑记忆文件。
- 压缩 3 路:本地 inline(适配非 OpenAI 模型)/ 远程 v1(独立 endpoint)/ 远程 v2(session 末尾追加请求);OpenAI 模型默认走 v1 服务端压缩,**不返回明文 summary,只返回 encrypted_content**;token 阈值计算排除开头固定 prompt;环境 context 差分注入,压缩后触发全量重注。

## 3. 和 Cursor / Claude Code 的差异

| 维度 | Codex | Cursor | Claude Code |
|---|---|---|---|
| 入口 | CLI、桌面、IDE、Web、云端、移动端、API | IDE、桌面、云端 Agent、Bugbot | CLI、桌面、Web、IDE |
| 核心抓手 | OpenAI 模型 + Responses API + Codex 运行框架 | 代码库索引 + IDE 工作区 + 云端 VM | Claude 模型 + 工程任务规则 + 子 Agent |
| 安全边界 | 沙箱、审批、托管配置、网络策略、遥测 | 索引权限、云端开发环境、企业控制 | 权限、MCP 边界、Auto Mode、Computer Use 防护 |
| 长任务 | 线程持久化、云端任务、移动端接管、WebSocket 加速 | 云端 Agent + Temporal / VM 工作流 | Session 管理、1M context、Subagents |
| 企业化 | Gartner、Dell、AWS、Codex Labs、GSI、合规日志 | 企业代码库、Bugbot、云端开发环境 | Enterprise / Managed Agents / Connectors |
| 最强信号 | 把模型、API、运行框架和企业控制放到同一产品线上 | 把 IDE 协作和云端代码任务做深 | 把工程执行规范和多 Agent 工作法做细 |

## 4. 对 DeepSeek 桌面端 Agent 的启示

1. 运行框架要产品化。Codex 的 App Server 说明,核心 Agent 能力应该是可被多端复用的底座,而不是绑定在某个界面里的单点功能。
2. 安全能力要可配置、可审计。沙箱、审批、网络策略、身份、凭据和日志应该成为企业可理解的控制面。
3. 长任务要允许用户随时接管。移动端审批、远程线程状态、截图、终端输出和测试结果,都是让用户信任长任务的关键。
4. API 性能会直接决定 Agent 体验。多轮工具调用越多,越需要连接复用、缓存和更少的重复上下文处理。
5. 代码仓库应成为记录系统。OpenAI 的 Harness Engineering 实验说明,让 Agent 稳定工作,关键是把地图、文档、可观测性和反馈循环放进仓库。

## 5. 可支撑的系列章节

| 章节 | 可支撑内容 |
|---|---|
| E1 桌面端 Agent 全景图 | Codex 多端入口和本地/云端/移动端协作 |
| E2 编排循环 | 智能体循环、线程/轮次/项目、App Server |
| E3 工具系统与 MCP | shell、文件工具、MCP、WebSocket 与 Responses API |
| E4 记忆与上下文 | AGENTS.md、线程持久化、压缩、代码仓库记录系统 |
| E6 安全与权限 | 沙箱、审批、网络策略、凭据、托管配置、日志 |
| E8 评估体系 | 系统卡、安全研究预览、代码审查、企业治理 |
| E9 DeepSeek 提案 | 多端运行框架、移动接管、企业控制面和审计体系 |

## 6. 相关页面

- [Agent 评测体系](../topics/agent-evaluation-system.md)
- [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md)
- [Harness Engineering](../concepts/harness-engineering.md)
- [Cursor](cursor.md)
- [Claude Code](claude-code.md)
- [记忆 + 压缩实现横评](../comparisons/harness-memory-compaction-implementation.md)
