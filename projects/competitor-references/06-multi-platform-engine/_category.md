# 06-multi-platform-engine/ — 多端综合 / 后端引擎

## 这一类是什么
跨多种终端形态的综合产品，或作为后端引擎供前端调用的服务。不属于单一形态，而是"多端覆盖"或"引擎驱动"。

## 共性特征
- 一套核心服务多种终端（Web/TUI/桌面/多渠道）
- 或作为后端引擎，通过 API/WebSocket 供前端调用
- 跨平台、跨渠道接入能力强

## 包含项目（2 个）

| 项目 | 主语言 | 形态 | 定位 |
|------|--------|------|------|
| QwenPaw | Python + TypeScript | Web + TUI + 桌面 + 多渠道 | 阿里 AgentScope 个人 AI 助手，本地/云端部署，控制台为 Tauri Web 应用，接入钉钉/飞书/微信/Discord |
| harnessclaw-engine | Go | 后端引擎 | Go 编写 LLM 编程助手引擎，WebSocket 提供多轮对话/工具调用/权限控制/技能扩展，是 harnessclaw 桌面端后端 |

## 关联说明
- AionUi（在 01-desktop-apps/）虽以桌面为主，但另含独立移动端 App（Expo/React Native，iOS/Android），具备多端属性，因其桌面形态最突出故归入 01。
- harnessclaw-engine 是 01-desktop-apps/harnessclaw 的后端，两者配套。
