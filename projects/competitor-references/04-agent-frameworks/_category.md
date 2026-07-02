# 04-agent-frameworks/ — Agent 框架 / 库

## 这一类是什么
不是直接给最终用户用的成品应用，而是供开发者用来编排、构建 Agent 的框架或基础设施库。开发者基于它们二次开发自己的 Agent 产品。

## 共性特征
- 提供编程 API / SDK，而非完整 UI
- 解决多 Agent 协作、工具调用、记忆、调度等通用问题
- 面向开发者，需要写代码集成
- 是"造轮子的工具"，不是"轮子"本身

## 包含项目（3 个）

| 项目 | 主语言 | 定位 |
|------|--------|------|
| crewai | Python | 多 Agent 编排框架，用角色、任务、工具组织多个 AI Agent 协作 |
| agentscope | Python | 阿里 ModelScope 出品多 Agent 平台/框架，支持分布式多 Agent 对话与协作 |
| openharness | Python | 轻量级 Agent 基础设施，提供工具调用、技能、记忆、多 Agent 协调，含终端前端 |
