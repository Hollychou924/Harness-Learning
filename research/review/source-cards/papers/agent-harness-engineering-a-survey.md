---
id: source-card-paper-agent-harness-engineering-a-survey
type: source-card
status: triaged
source: wiki/raw/papers/agent-harness-engineering-survey/2026-05-16-agent-harness-engineering-a-survey.md
updated: 2026-05-28
---

# 论文卡 · Agent Harness Engineering: A Survey

## 原文信息

- 论文主页: https://picrew.github.io/LLM-Harness/
- PDF: https://picrew.github.io/LLM-Harness/main.pdf
- OpenReview: https://openreview.net/forum?id=eONq7FdiHa
- GitHub: https://github.com/Picrew/LLM-Harness
- 公开目录: https://github.com/Picrew/awesome-agent-harness
- 数据集: https://huggingface.co/datasets/ChenLiu1996/Agent-Harness-Engineering
- 原文: [raw](../../raw/papers/agent-harness-engineering-survey/2026-05-16-agent-harness-engineering-a-survey.md)

## 核心价值

这篇论文把 Harness 从社区经验词升级成学术分类框架。它的核心贡献不是再讲“提示词不够”,而是把 Agent 执行环境拆成七层: 执行环境、工具接口、上下文、生命周期、可观测、验证评测、治理安全。

## 关键结论

| 结论 | 对 wiki 的影响 |
|---|---|
| 生产可用性越来越取决于模型外面的执行环境 | 补强 [Harness Engineering](../../concepts/harness-engineering.md) 的定义 |
| ETCLOVG 七层把 Harness 拆成可检查清单 | 新建 [ETCLOVG 七层分类法](../../concepts/etclovg-agent-harness-taxonomy.md) |
| 2022-2024 Prompt、2025 Context、2026- Harness 是一条清晰演进线 | 更新 [Agent Harness 设计范式演进](../../timelines/agent-harness-design-evolution.md) |
| 评测和轨迹不只是调试材料,而应进入失败归因和回归检查 | 补强 Agent 评测与共进化报告素材 |

## 已沉淀去向

- [concepts/etclovg-agent-harness-taxonomy.md](../../concepts/etclovg-agent-harness-taxonomy.md)
- [concepts/harness-engineering.md](../../concepts/harness-engineering.md)
- [concepts/prompt-context-harness.md](../../concepts/prompt-context-harness.md)
- [timelines/agent-harness-design-evolution.md](../../timelines/agent-harness-design-evolution.md)
- [topics/harness-2026-05-28-supplement-synthesis.md](../../topics/harness-2026-05-28-supplement-synthesis.md)
