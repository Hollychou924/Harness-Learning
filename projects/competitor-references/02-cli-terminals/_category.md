# 02-cli-terminals/ — CLI / 终端工具

## 这一类是什么
以命令行/终端界面为主要使用方式的 AI 编程助手。用户在终端里输入命令启动，通过文字交互，没有图形窗口。

## 共性特征
- 纯终端交互，无 GUI 窗口
- 多为 npm 全局安装或单二进制
- 面向开发者，直接读写代码、跑命令、管 Git
- 轻量、启动快、可嵌入工作流

## 包含项目（5 个）

| 项目 | 主语言 | 定位 |
|------|--------|------|
| codex-cli | Rust + TypeScript | OpenAI 出品本地编码 Agent，核心引擎 codex-rs 用 Rust，命令行入口 TypeScript |
| gemini-cli | TypeScript | Google Gemini 终端 AI Agent，npm 安装，gemini 命令启动 |
| qwen-code | TypeScript | 阿里通义终端编码 Agent，"住在终端里的 AI 编程助手"，npm 全局安装 |
| aider | Python | 老牌终端 AI 编程助手，命令行结对编程、修改代码 |
| claude-code | TypeScript | 本地学习项目，Anthropic Claude Code 源码快照存档，供学习其 CLI 架构（非泄露） |

## 注意
claude-code 是本地学习/存档项目，不是公开开源仓库，不可提交源码、不可复制进新项目。
