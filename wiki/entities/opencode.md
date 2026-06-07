---
id: opencode
type: entity
status: active
updated: 2026-06-06
sources:
  - https://opencode.ai/docs/ (Intro)
  - https://opencode.ai/docs/agents/ (Primary agents / Subagents)
  - https://opencode.ai/docs/permissions/ (allow/ask/deny + 通配符)
  - https://opencode.ai/docs/policies/ (provider.use 资源治理)
  - https://opencode.ai/docs/server/ (TUI=client + server, OpenAPI 3.1)
  - https://opencode.ai/docs/skills/ (兼容 .claude/.agents skills)
owners: ["zhouhao"]
when_to_load: "讨论 OpenCode、开源终端 Agent、权限治理、子 Agent、provider 治理、客户端-服务端分离架构时加载"
---

# OpenCode

> 一句话: OpenCode 是开源阵营的终端原生编码 Agent,核心卖点不是"开源平替",而是把"客户端-服务端分离 + 细粒度权限 + provider 治理"做成任何人都能自托管、自配置、自审计的开放 Harness。

## 1. 是什么

- 开源 AI 编码 Agent,提供终端界面(TUI)、桌面 App、IDE 扩展三种形态。
- 不绑定模型厂商: 用户自带任意 LLM provider 的 API Key;新手可用官方精选的 OpenCode Zen 模型清单。
- 安装方式极多(脚本/npm/brew/pacman/scoop/docker),典型开源工具的低门槛分发策略。

## 2. 关键机制

| 机制 | 说明 | 产品含义 | 来源 |
|---|---|---|---|
| 客户端-服务端分离 | 运行 OpenCode 会同时起一个 TUI(客户端)和一个 server;server 暴露 OpenAPI 3.1 规范端点,可生成 SDK、被多客户端连接、可程序化驱动 | 这是 OpenCode 最区别于其他 CLI 的架构选择: Harness 本身是个可被远程/程序化调用的服务,而不是一个封闭进程 | https://opencode.ai/docs/server/ |
| 主 Agent / 子 Agent 双层 | 内置 2 个主 Agent(Build 全工具开放 / Plan 只读分析)+ 3 个子 Agent(General/Explore/Scout);可 Tab 切换或 @ 调用 | 把"先规划只读、再放权执行"做成产品默认形态,而不是靠用户自觉 | https://opencode.ai/docs/agents/ |
| 细粒度权限 | 每个动作解析为 allow(直接跑)/ask(问用户)/deny(拦截);支持对 bash、edit 等按输入做对象级规则(如 `git *` allow、`rm *` deny),通配符匹配、最后命中的规则生效 | 权限不是一个开关,而是一张可按命令/路径精细配置的"放行表",软约束变硬约束 | https://opencode.ai/docs/permissions/ |
| Policies(资源治理) | 独立于权限的实验特性: 用 effect/action/resource 三元组控制能不能"使用某个 LLM provider"(如 deny openai、只允许 anthropic) | 把"用哪个模型/厂商"上升为治理策略,适合企业合规、数据出境管控场景 | https://opencode.ai/docs/policies/ |
| 兼容生态的 Skills | Skills 按需加载(native skill tool),且同时识别 `.opencode/`、`.claude/`、`.agents/` 等多套目录;从工作目录向上走到 git worktree 收集 | 不另起炉灶,直接复用 Claude / Agent 生态已有的 Skill 资产,降低迁移成本 | https://opencode.ai/docs/skills/ |
| Server 鉴权 | server 默认监听 127.0.0.1,可设 `OPENCODE_SERVER_PASSWORD` 做 HTTP Basic Auth | 自托管时把"谁能连这个 Agent 服务"也纳入边界设计 | https://opencode.ai/docs/server/ |

## 3. 产品判断

- OpenCode 的差异化不在"功能多",而在"架构开放": 服务端化 + OpenAPI 让它能被嵌进别的工具、被远程驱动,这是很多闭源 CLI 不给的能力。
- 权限(permissions)管"工具能做什么",政策(policies)管"能用哪个 provider"——两层分开,是它在治理维度上比一般开源工具想得更细的地方。
- 对求职/竞品分析: OpenCode 是"开放可治理 Harness"的样本,适合论证"Harness 不必绑定厂商,也能做到细粒度安全"。

## 4. 可支撑的系列章节

| 章节 | 可支撑内容 |
|---|---|
| E2 编排循环 | Build/Plan 主 Agent 切换、子 Agent 调用 |
| E3 工具系统与 MCP | 对象级权限规则、MCP servers |
| E5 能力组织 | 主 Agent / 子 Agent 双层、兼容多套 Skills 目录 |
| E6 安全与权限 | allow/ask/deny 权限、policies 资源治理、server 鉴权 |
| E9 DeepSeek 提案 | 客户端-服务端分离、自托管、provider 治理 |

## 5. 相关页面

- [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md)
- [Harness Engineering](../concepts/harness-engineering.md)
- [ETCLOVG Agent Harness 七层分类法](../concepts/etclovg-agent-harness-taxonomy.md)

## 6. 待复核

- provider policies 标注为 experimental,后续版本可能改 API,引用时注明实验特性。
- 截至 2026-06 抓取自官方文档站,版本演进快,引用具体配置项前以官方最新文档为准。
