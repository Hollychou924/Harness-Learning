# 05-selfhosted-web/ — 自托管 / Web 平台

## 这一类是什么
以 Web 界面为主、可自托管部署的平台型 Agent。前后端分离，通过浏览器访问，支持本地/Docker/云端部署。

## 共性特征
- Web 前端 + 后端服务，浏览器访问
- 支持自托管（本地/Docker/VM/云）
- 平台型：可接入或编排多种 Agent
- 后端多为 Python，前端 React

## 包含项目（2 个）

| 项目 | 主语言 | 定位 |
|------|--------|------|
| openhands | Python + TypeScript | 自托管开发者控制中心，本地/Docker/VM/云运行各类编码 Agent（OpenHands、Claude Code、Codex、Gemini 等） |
| deerflow | Python + TypeScript | 字节跳动 DeerFlow，深度研究"超级 Agent 框架"，编排子 Agent、记忆、沙箱 |
