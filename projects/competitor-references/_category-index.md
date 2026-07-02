# 本地竞品参考库 — 分类总索引

> 本文件是进入本目录的第一入口，供 AI 快速理解全貌。
> 日常说法"竞品项目""参考项目""同类产品"都指向本目录。

## 这是什么
这里统一存放所有本地可分析的 AI Agent 竞品/参考项目源码。
- 用于竞品对比、设计参考、能力借鉴。
- 源码只在本机分析，不提交、不复制进新项目（见 .gitignore）。
- 包含 25 个公开开源项目 + 1 个本地学习项目（claude-code）。

## 怎么用（给 AI 的导航）
1. 先看下方分类速查表，确定要找的项目在哪个子目录。
2. 进入对应子目录，读 `_category.md` 了解这类的共性特征和项目定位。
3. 需要深入某个项目时，进入项目文件夹读其 README / package.json / Cargo.toml 等。

## 分类速查表

| 编号 | 目录 | 类别 | 数量 | 找什么来这里 |
|------|------|------|------|--------------|
| 01 | `01-desktop-apps/` | PC 桌面应用 | 8 | 窗口化桌面 Agent、Tauri/Electron 应用 |
| 02 | `02-cli-terminals/` | CLI / 终端工具 | 5 | 纯命令行编程助手、终端 Agent |
| 03 | `03-cli-multi-form/` | CLI 为主多形态扩展 | 6 | 核心是 CLI 但同时有桌面/Web/IDE 形态 |
| 04 | `04-agent-frameworks/` | Agent 框架 / 库 | 3 | 开发者用来构建 Agent 的框架/SDK |
| 05 | `05-selfhosted-web/` | 自托管 / Web 平台 | 2 | Web 界面、可自托管的平台型 Agent |
| 06 | `06-multi-platform-engine/` | 多端综合 / 后端引擎 | 2 | 跨多端综合产品、后端引擎服务 |

合计 **26 个**项目。

## 按场景速查

### 我想看"桌面端怎么做"
→ `01-desktop-apps/`，重点看 MyAgents、Kun、lobsterai、harnessclaw

### 我想看"终端 CLI 怎么做"
→ `02-cli-terminals/`，重点看 codex-cli、gemini-cli、qwen-code

### 我想看"一套代码多端形态"
→ `03-cli-multi-form/`，重点看 opencode、goose、zagens

### 我想看"多 Agent 怎么编排"
→ `04-agent-frameworks/`，重点看 crewai、agentscope

### 我想看"自托管平台怎么搭"
→ `05-selfhosted-web/`，重点看 openhands、deerflow

### 我想看"后端引擎 + 多渠道接入"
→ `06-multi-platform-engine/`，重点看 QwenPaw、harnessclaw-engine

## 项目速查（全量 26 个，按目录分组）

### 01-desktop-apps/
MyAgents · hexclaw-desktop · kuse-cowork · harnessclaw · lobsterai · Kun · opencowork · AionUi

### 02-cli-terminals/
codex-cli · gemini-cli · qwen-code · aider · claude-code（本地学习）

### 03-cli-multi-form/
opencode · mimo-code · goose · zagens · kilocode · cline

### 04-agent-frameworks/
crewai · agentscope · openharness

### 05-selfhosted-web/
openhands · deerflow

### 06-multi-platform-engine/
QwenPaw · harnessclaw-engine

## 特别标注
- **claude-code**（02-cli-terminals/）：本地学习/存档项目，非公开开源、非泄露，仅供本地分析架构，不可提交源码、不可复制进新项目。
- **AionUi**（01-desktop-apps/）：另含独立移动端 App，具多端属性，但桌面形态最突出故归入 01。
- **harnessclaw + harnessclaw-engine**：前者是桌面端（01）、后者是后端引擎（06），两者配套。
- **DeepSeek-GUI**：即 Kun 的旧名，已改名 Kun 并归入 `01-desktop-apps/Kun`，无需重复拉取。
