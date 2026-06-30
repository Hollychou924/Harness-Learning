---
id: harness-self-evolution
type: concept
status: active
updated: 2026-06-15
sources:
  - wiki/raw/papers/harness-self-evolution-2026-06/2026-03-31-meta-harness-paper.md
  - wiki/raw/papers/harness-self-evolution-2026-06/2026-03-31-meta-harness-project-page.md
  - wiki/raw/papers/harness-self-evolution-2026-06/2026-05-30-harness-evolution-capabilities-paper.md
  - wiki/raw/community-posts/harness-self-evolution-2026-06/2026-05-28-skillopt-self-evolving-skills.md
  - wiki/raw/community-posts/harness-self-evolution-2026-06/2026-04-24-hermes-agent-self-evolution-ali.md
  - wiki/raw/community-posts/harness-self-evolution-2026-06/2026-05-13-cloud-agent-skill-evolution.md
  - wiki/raw/community-posts/harness-self-evolution-2026-06/2026-04-03-claude-code-agent-loop-self-iteration.md
owners: ["zhouhao"]
when_to_load: "讨论 Agent 越用越聪明、自进化、自迭代、自演化、Skill 自动沉淀、Harness 反哺模型训练、第7章写作时加载"
---

# Harness 自进化

> 一句话定义：Harness 自进化不是让模型自己变聪明，而是把每次真实任务里的失败、接管、复盘和验证结果，沉淀成下一次能复用的规则、技能、流程、评测题和训练素材。

## 1. 产品经理要先纠正的误区

**误区：自进化 = Agent 自己改自己。**

更准确的说法是：

```text
真实任务
→ 留下过程记录、失败点、用户接管点
→ 复盘成可复用经验
→ 变成 Skill / 规则 / 工具选择策略 / 评测题
→ 通过验证后进入正式能力库
→ 下一次任务优先复用
```

也就是说，自进化的核心不是“玄学成长”，而是“把失败变成资产”。

## 2. 三条自进化路线

| 路线 | 改的是谁 | 像什么 | 适合写进第七章的产品解释 |
|---|---|---|---|
| Skill 自进化 | 经验库、技能库、操作手册 | 老员工写 SOP，下次新人照着做 | 最容易让非技术读者理解，是第七章的主线入口 |
| Harness 自搜索 | 工具使用方式、流程、上下文组织方式 | 让一个评审官看过去所有失败记录，提出更好的办事流程 | Meta-Harness / Self-Harness 的硬核案例 |
| 模型与 Harness 双飞轮 | 外部经验沉淀 + 内部训练改进 | 公司一边改流程，一边培训员工 | 适合做拔高，解释为什么 Harness 能反哺模型训练 |

## 3. 关键案例

### 3.1 Meta-Harness：让“改 Harness”这件事也变成一个 Agent 任务

Meta-Harness 的关键不是“多写几句提示词”，而是把过去候选方案的源文件、分数、过程记录都放进一个可检索的资料夹，让一个专门负责改进的 Agent 自己去查证据、找失败原因、提改进方案。

高价值事实：

- 在项目主页展示的 TerminalBench-2 小规模实验中，起点是 Terminus-KIRA 的 28.5%，第 7 轮达到 46.5%。
- 论文强调：改进者能看到完整历史，而不是只看一个分数或一段摘要；最重场景每一步可利用约千万级诊断材料。
- 论文记录：在 TerminalBench-2 运行中，改进者每轮中位读取 82 个文件。
- 在数学推理任务里，Meta-Harness 对 5 个未参与搜索的模型平均提升 4.7 个点。

给产品侧的启发：自进化最重要的输入不是“一句总结”，而是“足够完整、可追溯、可复查的过程证据”。没有过程记录，就只能拍脑袋优化。

### 3.2 SkillOpt / Cloud Agent Skill：把经验从“对话里的一次性答案”变成“可复用技能”

Skill 自进化材料反复强调一个共同点：Agent 做完复杂任务后，不能只给用户最终答案，还要回看这次任务中哪些步骤有效、哪些坑被踩过、哪些人工确认很关键，然后沉淀成下次可直接调用的 Skill。

给产品侧的启发：

- 一次任务成功，不等于系统变强；只有“成功路径被沉淀”，才算变强。
- Skill 不是越多越好，必须有命名、触发条件、适用边界、验证记录，否则会变成混乱的经验垃圾堆。
- 第七章可以用“新员工第一次办报销”和“老员工留下办事清单”类比，解释 Skill 自进化。

### 3.3 Hermes：外部技能沉淀 + 内部模型训练的双路径

Hermes 相关材料把自进化拆成两层：

1. 外部：通过任务复盘自动生成和更新 Skill，让 Agent 下次不从零开始。
2. 内部：把高质量过程、成功轨迹、失败纠偏变成训练素材，长期改善模型本身。

给产品侧的启发：第七章不要只写“Skill 自动生成”，还要说明它和模型训练的关系：短期靠 Harness 变好，长期靠数据反哺模型。

### 3.4 谁该写经验，谁会用经验：改进者能力和使用者能力不是一回事

2026-05 arxiv 论文把自进化拆成两种能力：

- 写经验的能力：能不能从执行证据里产出有用的 Harness 更新。
- 用经验的能力：真正做任务时，能不能发现、加载、遵守这些更新后的经验。

论文的重要结论：

- 写经验的能力不完全跟模型强弱线性相关，不同档位模型做改进者时收益差距没有想象中大。
- 用经验的能力反而更关键：弱模型常见问题是“不知道该调用技能”或“看了技能也不遵守”。
- 因此资源优先投给“执行任务的 Agent 是否会用 Harness”，而不只是堆一个更强的改进者。

给产品侧的启发：自进化不是“写了经验就完了”，还要解决“下次真的能不能用上”。这非常适合写成第七章的核心干货。

## 4. 自进化闭环的产品版

```text
1. 看见：记录任务过程、失败点、用户接管点、成本、耗时
2. 判断：区分是模型不会、上下文不够、工具选错、规则缺失、技能没触发
3. 沉淀：把经验放到正确层级：记忆、规则、技能、工具说明、评测题
4. 验证：用旧题、新题、线上灰度验证是否真的变好
5. 发布：通过门槛后进入正式能力库，并保留回滚
6. 复用：下一次类似任务能自动找到并使用
```

第七章建议把这 6 步作为主结构，因为读者看完能直接拿去评审一个 Agent 产品。

## 5. 自进化最容易踩的坑

| 坑 | 表现 | 产品侧要问的问题 |
|---|---|---|
| 只存结论，不存过程 | 只能知道失败了，不知道为什么失败 | 有没有任务过程记录和接管点？ |
| 经验写了但不会用 | 技能库很多，真正任务里不触发 | 有触发条件和命中评测吗？ |
| 越沉淀越脏 | 规则互相打架，提示越来越长 | 有清理、合并、版本和废弃机制吗？ |
| 只刷评测分 | 评测集变好，真实用户没变好 | 训练题、验证题、线上样本有没有隔离？ |
| 让 Agent 直接改生产规则 | 安全规则被绕开或改坏 | 高风险改动是否人工确认、灰度、可回滚？ |
| 把模型训练和产品经验混成一锅 | 隐私、授权、合规无法解释 | 数据进训练前有没有授权、脱敏和用途边界？ |

## 6. 给第七章的核心判断

第七章应该从“怎么让 Agent 越用越聪明”改成更锋利的问题：

> 为什么很多 Agent 用了一万次也没有变聪明？因为它只是在重复执行，没有把失败变成可复用资产。

真正的自进化至少要回答四个问题：

1. 有没有看见失败？
2. 有没有把失败归因到正确层？
3. 有没有把经验沉淀成下次能用的能力？
4. 有没有验证这次沉淀真的让系统变好，而不是变脏？

## 7. 结论与来源映射

| 结论 | 来源 |
|---|---|
| 自进化需要完整过程证据，不能只靠最终分数或短摘要 | Meta-Harness paper / project page |
| Meta-Harness 通过“候选方案 + 分数 + 过程记录”的完整资料夹推动改进 | Meta-Harness paper / project page |
| Skill 自进化的价值是把一次任务经验变成可复用能力 | SkillOpt、Cloud Agent Skill、Hermes 相关文章 |
| 写经验和用经验是两种能力；弱模型常败在不会调用和遵守 Harness | arxiv 2605.30621 |
| Hermes 展示了外部 Skill 沉淀与内部训练反哺的双路径 | 阿里云开发者 Hermes、技术自由圈 Hermes |
| 自进化必须受治理：版本、验证、灰度、回滚、人工审核 | 多篇 Harness 自优化 / AHE / 自演进文章共识 |

## 相关页面

- [Harness Engineering](harness-engineering.md)
- [上下文压缩](context-compaction.md)
- [记忆合成 / Dreaming](memory-synthesis-dreaming.md)
- [ETCLOVG Agent Harness 七层分类法](etclovg-agent-harness-taxonomy.md)
- [Agent Harness 设计范式演进](../timelines/agent-harness-design-evolution.md)
- [Harness 自进化专题综述](../topics/harness-self-evolution-2026-06.md)
