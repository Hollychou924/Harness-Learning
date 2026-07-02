# 01-desktop-apps/ — PC 桌面应用

## 这一类是什么
以桌面客户端为主要形态、在电脑上以窗口化应用运行的 AI Agent 产品。用户双击图标打开应用，通过图形界面交互，不依赖命令行。

## 共性特征
- 桌面外壳：Tauri（Rust 内核）或 Electron（Node 内核）
- 前端 UI：React / TypeScript 为主
- 直接操作本地文件、终端、浏览器
- 安装即用，面向非技术用户也能上手

## 包含项目（8 个）

| 项目 | 主语言 | 定位 |
|------|--------|------|
| MyAgents | TypeScript + Rust | "活在电脑里能干活的个人 Agent"，Tauri v2 + React 19，强调本地文件操作与自动化 |
| hexclaw-desktop | TypeScript + Rust | 河蟹桌面客户端，Tauri v2 + TypeScript |
| kuse-cowork | Rust + 前端 | 轻量开源桌面 cowork agent，本地优先、BYOK、隐私可控，核心 Rust |
| harnessclaw | TypeScript | Electron + React + Vite，管理/聊天/操作多个 AI Agent 与技能 |
| lobsterai | TypeScript | 网易有道桌面办公助手 Agent，国内大厂首个开源桌面级 Agent |
| Kun | TypeScript | 需求先行的下一代 coding 桌面应用，完整 GUI 工作流，Electron 34 + React 19（原名 DeepSeek-GUI，后改名 Kun）|
| opencowork | TypeScript | 开源多 Agent 协作桌面平台，给 Agent 本地文件访问、命令执行、工具箱 |
| AionUi | TypeScript | Cowork 平台，桌面端 Electron；另含独立移动端 App（见 06 分类说明） |
