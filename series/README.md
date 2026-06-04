# Harness Engineer 系列 · 写作工作台

> 一套面向 AI 产品经理的 Harness Engineering 干货系列,同时是面向 DeepSeek Agent Harness PM 岗的求职作品集。
>
> 核心论断:**Agent = Model + Harness,且 Harness > Model**。模型决定能力上限,Harness 决定真实表现;PM 的杠杆在 Harness 设计。

---

## 方法论:以输出倒逼输入

这个系列不是"读懂了再写",而是**用"要写出一篇干货"这个输出目标,倒逼自己把 Harness 框架学透**。

每一章的工作流固定为三步:

```
1. 先定问题   → 在 README 列出「本章要回答的真实开发问题」(不是"X是什么",而是"撞上X时怎么办")
2. 倒逼输入   → 带着问题去 wiki/ 找素材、案例、数据,填进「素材映射」
3. 打磨输出   → 在 drafts/ 里多版本迭代,直到能用经验和案例把每个问题答透
```

**判断一篇文章合格的唯一标准**:开头列的每个问题,正文都用"真实场景 + 踩坑反例 + 原创判断 + 案例数据"答透了,而不是停留在概念描述。详见 [WRITING-GUIDE.md](./WRITING-GUIDE.md)。

---

## 章节地图(9 期)

> 相比最初规划,E4/E5 边界已重划:把"上下文运行时管理"(section 组装 / 四级 compact / KV cache)统一收进 E4,E5 专注"能力的组织"。这样两章边界从模糊的"记忆 vs 上下文"变成清晰的"运行时状态 vs 能力组织"。

| 期 | 标题 | 本章回答的核心问题 | 目录 | 状态 |
|----|------|------------------|------|------|
| E1 | 重新理解 Agent + 桌面端 Agent 全景图 | Harness 是什么?为什么 Harness > Model? | [E1-agent-landscape](./E1-agent-landscape/) | 🥚 |
| E2 | 编排循环:任务怎么"跑起来"又不跑飞 | Agent 怎么 Think-Act-Observe?怎么不死循环? | [E2-orchestration-loop](./E2-orchestration-loop/) | 🥚 |
| E3 | 工具系统与 MCP | 怎么让 Agent 调对工具、调安全? | [E3-tools-and-mcp](./E3-tools-and-mcp/) | 🥚 |
| E4 | 上下文与记忆:一次对话 Agent 到底带着什么 | 上下文怎么组装/压缩/缓存?记忆怎么不失控? | [E4-context-and-memory](./E4-context-and-memory/) | 🥚 |
| E5 | 能力的组织:Skills、Subagent、Multi-Agent | 能力多了、任务大了怎么拆、怎么管? | [E5-capability-organization](./E5-capability-organization/) | 🥚 |
| E6 | 安全与权限:Auto Mode 的产品边界 | 怎么让 Agent 既放手又不闯祸? | [E6-security-and-permissions](./E6-security-and-permissions/) | 🥚 |
| E7 | 模型与 Harness 共同进化 | Harness 怎么反哺模型训练? | [E7-model-harness-coevolution](./E7-model-harness-coevolution/) | 🥚 |
| E8 | 评估、可观测性与数据驱动迭代 | 怎么科学证明 Agent 真的变好了? | [E8-evaluation-and-data](./E8-evaluation-and-data/) | 🥚 |
| E9 | 给 DeepSeek 桌面端 Agent 的产品提案书 | 假设我加入 DeepSeek,我会怎么做? | [E9-deepseek-proposal](./E9-deepseek-proposal/) | 🥚 |

状态图例:🥚 未开始 · ✍️ 草稿中 · 🔍 评审中 · ✅ 已发布

---

## 目录结构约定

每一章是一个独立目录,内部结构统一:

```
E{n}-{slug}/
├── README.md      # 本章工作台:要回答的真实问题 + wiki 素材映射 + 状态 + 收尾检查清单
├── outline.md     # 章节大纲(动笔前先把 outline 谈定)
├── drafts/        # 多版本草稿:draft-v1.md / draft-v2.md ...(打磨过程留痕)
└── assets/        # 配图(架构图、对比图、mockup)
```

**版本管理约定**:
- `drafts/draft-v1.md` 是第一版,每次大改另存 `draft-v2.md`、`draft-v3.md`,保留打磨轨迹
- 定稿后复制为章节目录下的 `published.md`,并把 README 状态改为 ✅
- 细粒度修改靠 git 历史,大版本靠文件名区分

---

## 配套产出(系列之外,呼应 JD)

- **本 repo = `harness-engineer-cookbook`**:9 期文章的素材、代码示例、Code Review Agent demo
- 见各章 README 的"配套动作"小节

---

## 进度看板

| 里程碑 | 目标 | 状态 |
|--------|------|------|
| 框架搭建 | 章节结构 + 写作工作台 | ✅ |
| E1 大纲 | 立论 + 五大组件框架 + 9 款速览 | ✍️ |
| 第一波弹药 | E1-E5 成文 | 🥚 |
| 求职杀手锏 | E9 提案书 + demo | 🥚 |
