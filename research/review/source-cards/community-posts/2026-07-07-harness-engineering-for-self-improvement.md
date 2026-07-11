---
id: source-card-harness-engineering-self-improvement-2026-07-07
type: source-card
status: active
updated: 2026-07-08
source: https://mp.weixin.qq.com/s/ayESVu4F_3RC3OdP8aV7ow
url: https://mp.weixin.qq.com/s/ayESVu4F_3RC3OdP8aV7ow
account: Datawhale
author: Lilian Weng（翁荔）
publish_time: 2026-07-07
original_url: https://lilianweng.github.io/posts/2026-07-04-harness/
---

# 单篇知识卡：AI 自我改进的关键，从模型转向 Harness 了

## 一句话价值

翁荔（前 OpenAI 安全研究副总裁）的技术博客，系统梳理了 Harness Engineering 对递归自我改进（RSI）的贡献，是这个方向目前最权威的理论框架。

## 核心观点

### Harness 的定义

Harness 是包裹在基础模型外面的系统，负责：编排执行过程、决定模型怎么思考和规划、怎么调用工具和行动、怎么感知和管理上下文、怎么存储产出物、怎么评估结果。

Claude Code、Codex 这类编码 Agent 的成功，印证了 harness 在 AI 部署里的分量——重要性不亚于模型本身的原始智能。

### 三种设计模式

**模式一：工作流自动化**
给模型定义一个可以操作、测试、迭代的工作流。核心是目标导向的循环：规划→执行→观察/测试→改进→再执行，直到目标达成。强调在一个 "agent runtime" 里分析自己的执行轨迹和失败案例、持续迭代，而不是套用静态 prompt 模板。

**模式二：文件系统作为持久记忆**
harness 不该把整个工作流和所有日志都塞进上下文，应该把持久状态存进文件。实验日志、代码 diff、论文摘要、报错记录、过去的执行轨迹这些产出物长度远超上下文窗口。用文件这种简单形式管理持久记忆，会自然地随着核心模型能力的提升而受益。

**模式三：子 Agent 与后端任务**
harness 可以派生多个子 agent 并行执行，同时监控后端任务。父 agent 需要一个小型进程管理器：启动任务、查看日志、取消失败的运行、把结果合并回主会话。关键设计选择是让子 agent 的上下文与主 agent 隔离。

### 通向完整 RSI 的七个瓶颈

1. **弱且模糊的评估器**：自改进循环在评估指标可衡量、客观的任务上效果最好（类似 RL）；研究判断力、新颖性、长期科学价值衡量起来难得多
2. **上下文和记忆的生命周期**：随 agent 更自主，需维护的记忆持续增长；上下文工程理应成为智能本身的核心组成部分
3. **负面结果**：LLM 训练数据偏向"成功案例"，不擅长判断什么时候该放弃一个假设、报告负面结果；好的 harness 应让失败的尝试容易被保留下来
4. **多样性坍缩**：演化和 RL 循环容易只顾利用已知高奖励模式；需要专门机制防止种群坍缩成同一个方案的变体
5. **Reward hacking**：自我改进循环会优化任何给定信号；评估器和权限控制应该活在"演化 harness"这个循环之外，靠 held-out 测试、执行轨迹审计、人工审查把关
6. **长期成功**：编码 agent 的优化目标太短期，不清楚怎么维护由成百上千工程师共同维护的仓库的长期健康
7. **人的角色**：人应该往抽象栈更高层移动，在正确的时间、正确的抽象层级上提供监督

### Harness 和操作系统的类比

一个好的 harness 应该像操作系统一样，把复杂逻辑封装起来，同时保持接口简单。config、工具接口和其他协议可能会随着行业发展逐渐标准化。

## 可用于 Loop Engineering / 自进化概念页

- 三种设计模式是理解 momo-code 双速循环的理论锚点：快循环 = 工作流自动化 + 文件系统持久记忆；慢循环 = harness 本身被优化
- 七个瓶颈可用于评估 momo-code 的局限：momo-code 用 Beta 分布 + Thompson 采样部分解决了"多样性坍缩"，用 Ratchet Gate 部分解决了"reward hacking"，但"弱评估器"和"负面结果"仍有缺口
- "评估器应该活在循环之外"直接对应 momo-code 的 Ratchet Gate 设计：held-out 测试集 + 回归检测
- "文件系统作为持久记忆"对应 momo-code 的 tactics.json + ledger.jsonl + cases.json 三文件持久化

## 关联页面

- ../../concepts/loop-engineering.md
- ../../concepts/harness-self-evolution.md
- ../../concepts/harness-engineering.md
