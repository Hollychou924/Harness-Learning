# PM-Agent-Learning

一个基于 Android 的 AI Agent 学习项目，包含完整的移动端 Agent 运行时和智能记忆系统。

---

## 项目概述

本项目是一个**移动端 AI Agent 平台**，核心实现了 Goal-Plan-Act-Review 的 Agent 循环架构，集成了语义记忆系统，用于研究和学习如何在移动设备上构建智能 Agent。

## 核心模块

### Agent 运行时
- 完整的 Agent 执行循环（Goal → Plan → Act → Review）
- 200+ 工具（设备控制、通讯、文件、浏览器自动化、IoT 等）
- 工具风险分级与用户审批机制
- Agent Trace 全链路可观测

### 语义记忆系统
- **长期记忆**：基于向量数据库（ObjectBox HNSW）的语义存储与检索
- **Agent 工具集成**：memory_search / memory_store / memory_forget
- **对话上下文注入**：Agent 运行时动态检索相关记忆

### IM 网关
- 支持 Telegram、飞书、钉钉、微信、Discord、QQ 等多平台接入
- 按平台/用户的会话映射
- 风险审批策略

### Skills 系统
- 10+ 内置技能
- 支持自定义 Skill 扩展

## 技术栈

| 类别 | 技术 |
|------|------|
| 平台 | Android (minSdk 24, targetSdk 36) |
| 语言 | Kotlin |
| UI | Jetpack Compose |
| 架构 | MVVM + Repository |
| 异步 | Kotlin Coroutines + Flow |
| 本地数据库 | Room (SQLite) |
| 向量存储 | ObjectBox HNSW |
| AI 模型 | Google Gemini、字节豆包、阿里 DashScope |
| 构建 | Gradle KTS |

## 项目结构

```
app/                          # 主 Android 应用
├── agent/                    # Agent 运行时、工具注册、LLM 适配器
├── data/                     # Room 实体、向量存储、数据模型
├── repository/               # 数据访问层（记忆、AI、自动化、IoT）
├── service/                  # 后台服务（Embedding、语音、通知）
├── ui/                       # Compose UI（对话、记忆、自动化、IM）
└── viewmodel/                # UI 状态管理

server/                       # Python 深度研究集成（DashScope Qwen）
lark/                         # 飞书 API 客户端
docs/                         # 架构文档 & 路线图
scripts/                      # 数据验证 & 测试脚本
```

## 架构设计

```
┌──────────────────────────────────────────┐
│        Android 设备（本地运行时）           │
│  AgentRuntime → 目标分解 → 决策 → 工具执行  │
│  （本地执行循环 / 策略检查 / 审批）          │
└──────────┬──────────────┬────────────────┘
           │              │
     ┌─────┘              └──────┐
     ▼                           ▼
 本地 Android 工具           云端 LLM / API
 （系统调用、设备访问）      （Gemini / 豆包 / DashScope）
```

## 快速开始

1. 克隆项目并用 Android Studio 打开
2. 在 `local.properties` 中配置 API Keys（Gemini、DashScope、百度等）
3. 连接设备或模拟器，运行应用

> 如遇 Gradle 连接问题（VPN 导致），项目已配置 IPv6 回环，关闭 VPN 或直接用 Android Studio 构建即可。
