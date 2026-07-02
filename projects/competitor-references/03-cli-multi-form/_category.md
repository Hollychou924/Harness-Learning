# 03-cli-multi-form/ — CLI 为主、多形态扩展

## 这一类是什么
核心是终端/命令行，但同时提供桌面或 Web 等其他形态。归类时以 CLI 为主，多形态作为补充能力。

## 共性特征
- CLI/TUI 是核心入口
- 同一代码库延伸出桌面、Web、IDE 扩展等形态
- 多为 monorepo 多包结构
- 既服务终端用户，也服务 IDE 用户

## 包含项目（6 个）

| 项目 | 主语言 | 形态 | 定位 |
|------|--------|------|------|
| opencode | TypeScript | CLI + 桌面 + Web | SST 出品开源 AI 编程 Agent，终端 TUI 核心 + 桌面 + Web 控制台，monorepo |
| mimo-code | TypeScript | CLI + 桌面 + Web | 小米 MiMo Code，终端原生编程助手，可读写代码/跑命令/管 Git，带持久记忆 |
| goose | Rust + TypeScript | 桌面 + CLI + API | Block/AAIF 出品，原生桌面 + 完整 CLI + 可嵌入 API，核心 Rust，支持 15+ 模型商 |
| zagens | Rust | 桌面 + TUI + CLI | 面向 DeepSeek V4 的开源 Agent 平台，同引擎支持 Tauri 桌面/全屏 TUI/无头 CLI 三态 |
| kilocode | TypeScript | IDE 扩展 + CLI | 开源编码 Agent，VS Code/JetBrains/CLI 三端，支持 500+ 模型、按原价计费 |
| cline | TypeScript | IDE 扩展 + CLI | 开源编码 Agent，"在 IDE 和终端里的编码助手"，主要 VS Code 扩展 + CLI |
