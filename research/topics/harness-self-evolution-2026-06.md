---
id: harness-self-evolution-2026-06
type: topic
status: active
updated: 2026-06-15
sources:
  - wiki/raw/community-posts/harness-self-evolution-2026-06/
  - wiki/raw/papers/harness-self-evolution-2026-06/
owners: ["zhouhao"]
when_to_load: "处理第7章自进化、自迭代、自演化专题写作，或需要解释 Meta-Harness / SkillOpt / Hermes / Self-Harness / AHE 时加载"
---

# Harness 自进化专题综述（2026-06 批次）

本批覆盖：23 篇微信公众号文章、Meta-Harness 项目页、Meta-Harness 论文、1 篇关于 Harness 自进化能力拆解的论文。

## 1. 本批材料共同指向的主线

这批材料可以合成一句话：

> Agent 的下一阶段，不是只靠更强模型，而是让产品运行过程本身变成“经验生产线”：每次失败都能被记录、归因、沉淀、验证、复用。

所以第七章不应再浅写“越用越聪明”，而要写清楚：

- 它到底从哪里学习？
- 学到的东西放在哪一层？
- 下一次怎么保证真的用上？
- 怎么证明它变好了，而不是只是堆了更多规则？
- 谁有权把经验变成正式能力？

## 2. 素材分组

| 分组 | 代表材料 | 可复用价值 |
|---|---|---|
| Meta-Harness / Self-Harness | Meta-Harness 论文、项目页、AGI Hunt、AutoML | 证明“改 Harness”本身可以被产品化成一个外层循环；提供硬数据和案例 |
| Skill 自进化 | SkillOpt、Cloud Agent Skill、Hermes Skill 文章 | 解释“经验如何从任务过程沉淀成下次能调用的技能” |
| Hermes / Claude Code 实践 | 阿里云 Hermes、技术自由圈 Hermes、Claude Code Agent Loop | 提供贴近真实 Agent 产品的“任务复盘 → 技能/流程更新”叙事 |
| 可观测驱动演进 | AHE、阿里技术、Harness 自优化相关文章 | 强化“看得见才改得动”：过程记录、指标、门控、回滚 |
| 模型与 Harness 双飞轮 | SIA、35 天模型自训、谁写经验谁用经验论文 | 用于第七章拔高：Harness 短期改行为，长期产训练数据 |

## 3. 第七章可直接引用的硬料

- Meta-Harness 项目页：TerminalBench-2 小规模实验从 28.5% 到 46.5%。
- Meta-Harness 论文：最重场景每步可使用约千万级诊断材料；TerminalBench-2 中改进者每轮中位读取 82 个文件。
- Meta-Harness 论文：数学推理任务中，对 5 个未参与搜索的模型平均提升 4.7 个点。
- Harness 能力拆解论文：把自进化拆成“写经验”和“用经验”两种能力；弱模型经常不是没有经验，而是不会调用或不遵守经验。
- Hermes/SkillOpt/Cloud Agent Skill 系列：Skill 的关键价值是让一次任务里的踩坑和修正不再丢失，而是变成可复用能力。

## 4. 本批材料对原第七章的修正建议

原第七章的问题不是方向错，而是太像“正确框架说明书”，少了三个东西：

1. **缺一根读者能抓住的主线**：建议改成“为什么 Agent 用了一万次也没变聪明？”
2. **缺硬案例**：必须加入 Meta-Harness、Skill 自进化、Hermes、写经验/用经验四类案例。
3. **缺产品经理可执行检查表**：要告诉读者怎么评审一个自进化方案，而不只是介绍概念。

## 5. 建议第七章新结构

详见 `series/E7-model-harness-coevolution/outline.md` 的新版规划。核心结构：

1. 先用反常识开场：多数 Agent 不会越用越聪明，只会重复犯错。
2. 用“失败资产化”定义自进化。
3. 用 Skill 自进化讲第一层：经验变技能。
4. 用 Meta-Harness 讲第二层：改 Harness 也能被自动化。
5. 用“写经验 vs 用经验”讲最容易被忽略的产品坑。
6. 用 Hermes / SIA 讲外部 Harness 与内部模型训练的双飞轮。
7. 用治理清单收束：版本、验证、灰度、回滚、人工审核。

## 6. 未覆盖范围

- 本批没有深入复现论文实验，只做论文和中文解读的资料入库。
- X 推文链接因网页访问限制未单独抓全文；Meta-Harness 项目页和论文已经覆盖核心信息。
- 原始微信文章已保存到本地 raw 目录，但该目录按项目规则默认不提交。

## 7. 本次追加单篇沉淀（用户点名 5 篇）

| 文章 | 单篇沉淀 | 对第七章的用途 |
|---|---|---|
| 需要自进化的不是 Agent，而是 Harness | `wiki/review/source-cards/community-posts/harness-self-evolution/2026-05-28-harness-not-agent-evolves.md` | 第七章开场反常识：进化对象是 Harness，不是单个 Agent |
| 35 天，从 M2.5 到 M2.7，模型训了下一个自己 | `wiki/review/source-cards/community-posts/harness-self-evolution/2026-03-20-model-trains-next-itself.md` | 第七章后半段双飞轮：外部 Harness 经验如何进入模型训练 |
| 让 Skill 从执行中生长 | `wiki/review/source-cards/community-posts/harness-self-evolution/2026-05-13-cloud-agent-skill-evolution.md` | Skill 自进化主案例：经验从任务过程沉淀成办事手册 |
| Agent Loop：Claude Code 的自迭代之道 | `wiki/review/source-cards/community-posts/harness-self-evolution/2026-04-03-claude-code-agent-loop-self-iteration.md` | 区分自迭代、自进化、自演化，解释单次任务循环与长期沉淀的差别 |
| Self-Harness：让 Agent 自己改自己的 harness | `wiki/review/source-cards/community-posts/harness-self-evolution/2026-06-12-self-harness-auto-ml.md` | 自动改 Harness 的硬案例：弱点挖掘、候选修改、回归验证 |

## 相关页面

- [Harness 自进化](../concepts/harness-self-evolution.md)
- [Harness Engineering](../concepts/harness-engineering.md)
- [Agent Harness 设计范式演进](../timelines/agent-harness-design-evolution.md)
- [记忆合成 / Dreaming](../concepts/memory-synthesis-dreaming.md)
