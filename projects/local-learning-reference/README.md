# local-learning-reference/ — 本地参考项目总库

这里统一放所有本地可分析的 Agent / Harness 参考项目。

包含两类：
- 公开开源项目：从公开仓库拉取，用于竞品对比和设计参考。
- 本地学习项目：已有的学习/实验项目，用于补充参考。

规则：
- 这里的源码只在本机分析，不提交到当前仓库。
- 新项目小蓝鲸不能直接复制这些源码，只能借鉴设计思路。
- Claude Code 相关学习项目是本地学习项目，不是泄露源码。

---

## 项目分类索引

> 说明：以下分类依据各项目根目录的 README、`package.json`、`Cargo.toml`、`go.mod` 等配置文件交叉核对得出。
> "主语言"指该项目核心代码所用的编程语言；一个项目可能跨多种语言，仅列出主要的部分。
> 部分项目同时支持多种形态（如桌面+CLI），按其主要定位归入一类，其他形态在介绍中注明。

### 一、PC 桌面应用

以桌面客户端为主要形态，在电脑上以窗口化应用运行。

| 项目 | 主语言 | 形态 | 简要介绍 |
|------|--------|------|----------|
| MyAgents | TypeScript + Rust | 桌面 | "活在电脑里、真正能干活的个人 Agent"。基于 Tauri v2 + React 19，支持 macOS/Windows，强调本地文件操作与自动化执行。 |
| hexclaw-desktop | TypeScript + Rust | 桌面 | 河蟹桌面客户端，基于 Tauri v2 + TypeScript。 |
| kuse-cowork | Rust + 前端 | 桌面 | 轻量开源桌面 cowork agent，主打本地优先执行、模型自由选择（BYOK）、隐私可控，核心用 Rust 编写。 |
| harnessclaw | TypeScript | 桌面 | 基于 Electron + React + Vite 的桌面应用，用于管理、聊天和操作多个 AI Agent 与技能。 |
| lobsterai | TypeScript | 桌面 | 网易有道出品的桌面级办公助手 Agent，国内大厂首个开源桌面级 Agent。支持数据分析、文档、PPT、视频生成等，通过 Cowork 模式连接文件、终端、浏览器。 |
| DeepSeek-GUI（Kun） | TypeScript | 桌面 | 面向"需求先行"的 coding 桌面应用，用 DeepSeek/MiMo/MiniMax 等高性价比模型把需求澄清、设计稿、计划和编码串成闭环。基于 Electron。 |
| opencowork | TypeScript | 桌面 | 开源的多 Agent AI 协作桌面平台，给 AI Agent 本地文件访问、命令执行和丰富工具箱。基于 Electron。 |
| AionUi | TypeScript | 桌面 + 手机 | Cowork 平台，AI Agent 在电脑上读文件、写代码、浏览网页、自动化任务。桌面端基于 Electron；另含独立的移动端 App（基于 Expo/React Native，支持 iOS/Android）。 |

### 二、CLI / 终端工具

以命令行/终端界面为主要使用方式。

| 项目 | 主语言 | 形态 | 简要介绍 |
|------|--------|------|----------|
| codex-cli | Rust + TypeScript | CLI | OpenAI 出品的本地编码 Agent。核心引擎 `codex-rs` 用 Rust 编写，命令行入口为 TypeScript；Mac/Linux/Windows 可用。 |
| gemini-cli | TypeScript | CLI | Google 出品的 Gemini 终端 AI Agent，通过 npm 安装，`gemini` 命令启动。 |
| qwen-code | TypeScript | CLI | 阿里通义出品的开源终端编码 Agent，"住在终端里的 AI 编程助手"，npm 全局安装。 |
| aider | Python | CLI | 老牌的终端 AI 编程助手，可在命令行里结对编程、修改代码。 |
| claude-code | TypeScript | CLI（学习/存档） | 本地学习项目。Anthropic Claude Code 的源码快照存档，供本地学习分析其 CLI 架构，非泄露源码。 |

### 三、CLI 为主、多形态扩展

核心是终端/命令行，但同时提供桌面或 Web 等其他形态。

| 项目 | 主语言 | 形态 | 简要介绍 |
|------|--------|------|----------|
| opencode | TypeScript | CLI + 桌面 + Web | 开源 AI 编程 Agent（SST 出品）。核心为终端 TUI，同时提供桌面、Web 控制台等多形态，是 monorepo 多包结构。 |
| mimo-code | TypeScript | CLI + 桌面 + Web | 小米 MiMo Code，终端原生 AI 编程助手，可读写代码、跑命令、管 Git，并带持久记忆。核心是 TUI，另含桌面/Web 形态。 |
| goose | Rust + TypeScript | 桌面 + CLI + API | Block/AAIF 出品的开源 AI Agent。原生桌面应用（Electron Forge）+ 完整 CLI + 可嵌入 API，核心用 Rust 编写，支持 15+ 模型提供商。 |
| zagens | Rust | 桌面 + TUI + CLI | 面向 DeepSeek V4 的开源 Agent 平台。同一引擎支持 Tauri 桌面、全屏 TUI（ratatui）和无头 CLI 三种形态，主打长任务、重放与审批。 |
| kilocode | TypeScript | IDE 扩展 + CLI | 开源编码 Agent，可在 VS Code、JetBrains 和 CLI 中使用，支持 500+ 模型切换、按模型商原价计费。 |
| cline | TypeScript | IDE 扩展 + CLI | 开源编码 Agent，"在你 IDE 和终端里的编码助手"，主要形态为 VS Code 扩展，同时提供 CLI。 |

### 四、Agent 框架 / 库

不直接是成品应用，而是供开发者用来编排、构建 Agent 的框架或基础设施。

| 项目 | 主语言 | 形态 | 简要介绍 |
|------|--------|------|----------|
| crewai | Python | 框架 | 多 Agent 编排框架，用于用角色、任务、工具来组织多个 AI Agent 协作完成任务。 |
| agentscope | Python | 框架 | 阿里 ModelScope 出品的多 Agent 平台/框架，支持分布式多 Agent 对话与协作。 |
| openharness | Python | 框架/基础设施 | 轻量级 Agent 基础设施，提供工具调用、技能、记忆和多 Agent 协调能力，含终端前端。 |

### 五、自托管 / Web 平台

以 Web 界面为主，可自托管部署，前后端分离。

| 项目 | 主语言 | 形态 | 简要介绍 |
|------|--------|------|----------|
| openhands | Python + TypeScript | 自托管 Web 平台 | 自托管的开发者控制中心，可在本地/Docker/VM/云端运行各类编码 Agent（OpenHands、Claude Code、Codex、Gemini 等）。后端 Python，前端 React。 |
| deerflow | Python + TypeScript | 自托管 Web 平台 | 字节跳动 DeerFlow，深度研究与高效研究流的"超级 Agent 框架"，编排子 Agent、记忆和沙箱。后端 Python，前端 React。 |

### 六、多端综合 / 后端引擎

跨多种终端形态，或作为后端引擎供前端调用。

| 项目 | 主语言 | 形态 | 简要介绍 |
|------|--------|------|----------|
| QwenPaw | Python + TypeScript | Web + TUI + 桌面 + 多渠道 | 阿里 AgentScope 出品的个人 AI 助手，可本地/云端部署。核心 Python，控制台为 Tauri Web 应用；同时提供 TUI、桌面，并接入钉钉/飞书/微信/Discord 等多渠道。 |
| harnessclaw-engine | Go | 后端引擎 | 用 Go 编写的 LLM 编程助手引擎，通过 WebSocket 提供多轮对话、工具调用、权限控制和技能扩展能力，是 harnessclaw 桌面端的后端。 |

---

## 速查统计

- 总计 **26 个**本地参考项目（25 个公开开源 + 1 个本地学习项目 claude-code）。
- 按形态分布（一个项目可能计入多个形态）：
  - **PC 桌面应用**：MyAgents、hexclaw-desktop、kuse-cowork、harnessclaw、lobsterai、DeepSeek-GUI、opencowork、AionUi、goose、zagens、QwenPaw 等。
  - **手机/移动端**：AionUi（含 Expo/React Native 移动 App，覆盖 iOS/Android）。
  - **CLI / 终端**：codex-cli、gemini-cli、qwen-code、aider、claude-code、opencode、mimo-code、goose、zagens、kilocode、cline 等。
  - **IDE 扩展**：cline（VS Code 为主）、kilocode（VS Code/JetBrains）。
  - **Agent 框架/库**：crewai、agentscope、openharness。
  - **自托管 / Web 平台**：openhands、deerflow、QwenPaw（控制台）。
  - **后端引擎**：harnessclaw-engine（Go）。
- 按主语言分布：
  - **TypeScript/Node 为主**：gemini-cli、qwen-code、opencode、mimo-code、cline、kilocode、harnessclaw、lobsterai、DeepSeek-GUI、opencowork、AionUi、MyAgents、hexclaw-desktop、claude-code。
  - **Rust 为主**：codex-cli、goose、zagens、kuse-cowork。
  - **Python 为主**：aider、crewai、agentscope、openharness、openhands、deerflow、QwenPaw。
  - **Go 为主**：harnessclaw-engine。

> 注：上述语言归类以核心代码为准；很多桌面项目前端用 TypeScript、桌面壳用 Rust（Tauri）或 Electron，故会同时涉及多种语言。
