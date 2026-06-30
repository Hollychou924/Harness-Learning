---
id: memory-synthesis-dreaming
type: concept
status: active
updated: 2026-06-09
sources:
  - wiki/raw/official-posts/openai/2026-06-04-dreaming-better-memory-for-chatgpt.md
  - wiki/raw/community-posts/chatgpt-memory-dreaming/2026-06-05-appso-chatgpt-dreaming-memory.md
  - wiki/raw/community-posts/chatgpt-memory-dreaming/2026-06-05-zhidx-chatgpt-dreaming-v3.md
  - wiki/raw/community-posts/chatgpt-memory-dreaming/2026-06-07-ainlp-chatgpt-dreaming-v3-explained.md
  - wiki/raw/community-posts/chatgpt-memory-dreaming/2026-06-08-agiplayer-chatgpt-dreaming-living-memory.md
  - wiki/raw/community-posts/harness-implementation-comparison/2026-06-03-kongmouren-harness-memory.md
owners: ["zhouhao"]
when_to_load: "讨论长期记忆、记忆写入/更新/遗忘、记忆过期(staleness)、后台记忆合成、消费级 Agent 个性化时加载"
---

# 记忆合成 / Dreaming(后台记忆生命周期)

> 一句话定义: 记忆合成(memory synthesis)是让 Agent 在后台自动从大量历史对话里提炼、合并、更新长期记忆,而不是等用户明确说"记住这个"才记;OpenAI 把这套后台进程命名为 Dreaming(做梦)。

## 为什么重要

它把"长期记忆"从**被动便签**变成**主动维护的长期上下文层**,正面解决了 E4 Q6 里写入/更新/遗忘三个环节最难的部分。这是 2026-06 OpenAI 给 ChatGPT 上线的真实产品案例,也是消费级 Agent 从"Prompt 驱动"走向"上下文驱动"的标志。

## 三代演进(OpenAI 官方时间线)

| 时间 | 形态 | 关键变化 | 痛点 |
|---|---|---|---|
| 2024-04 | Saved memories(便签式) | 只在用户明确说"记住"时写入,依赖强触发信号 | 漏记自然散落的信息;不更新会过期;128 条上限,几天就满 |
| 2025-04 | Saved memories + Dreaming V0(补充式) | 引入后台进程,可引用 saved memories 之外的聊天历史自动合成 | Dreaming 只是补充,不能独立支撑;仍会过期、会混 |
| 2026-06 | Dreaming V3(全量合成式) | 全新架构,Dreaming 成核心;后台持续提炼合成;自动处理过期信息;算力降约 5 倍,Free 用户也能用 | 升级后部分精确偏好被压成模糊摘要(社区反馈) |

本质演进路径: **被动记录 → 辅助合成 → 主动合成**。

## 官方三类评测目标 + 数据

OpenAI 用三个目标衡量"好记忆",对应 E4 Q6 的写入/召回/更新/遗忘:

| 评测目标 | 含义 | 2024 Saved | 2025 +V0 | 2026 V3 |
|---|---|---|---|---|
| Carry forward useful context(延续有用背景) | 说过一次,后续还记得并用对 | 41.5% | 67.9% | 82.8% |
| Follow preferences and constraints(遵循偏好约束) | 遵守用户偏好/限制(如素食) | 31.4% | 55.3% | 71.3% |
| Stay current over time(随时间保持正确) | 计划结束后不再当成当前事实 | 9.4% | 52.2% | 75.1% |

注意"随时间保持正确"基线只有 9.4% → 提升最猛(到 75.1%)。这说明:**老式静态记忆最大的坑不是"记不住",而是"记住了却不更新"——把过期事实当成当前事实**(经典案例:"7 月要去新加坡"旅行结束后仍被当成未来计划,继续推荐新加坡外卖)。

## 关键工程辨析(防止理解跑偏)

- **记忆合成 ≠ 在用户对话上自我训练**。更稳妥的理解:Agent 在**产品层**维护一份可更新的长期上下文,回答时引用它,不是改模型权重。
- 旧系统三大限制(AINLP 解读):信息容易**漏**(不说"记住"就不记)、容易**旧**(不更新时间状态)、容易**冲突**(不同时间说的偏好平铺保存、不判断谁作废)。
- OpenAI 官方把挑战归三类: **staleness(陈旧)/ correctness(正确)/ scalability(可扩展,服务数亿用户、多年跨度)**。

## 产品侧可借鉴的控制点

- **记忆摘要页(memory summary)**:把 Agent 合成的记忆做成用户可见、可编辑的摘要;支持新增/更正/"以后不要再提";显示最近更新时间 → 自动记忆的**可解释 + 可纠错**界面范式。
- **删除≠真删**:"以后不要再提"只减少未来主动提及;彻底删除要清掉所有来源(保存记忆/历史聊天/归档/上传文件/记忆摘要/关联应用)。
- **前台/后台优先级**:常被提及、较新的放前台,其余转后台(灰显),按新旧程度 + 话题频率排序 → 对应 E4 Q6 的"召回按相关性/降权"。
- **记忆历史 + 版本回滚**:可查看不同时间点版本并恢复 → 对应"更新做版本化"。
- **Temporary Chat**:让某次对话不进入长期记忆 → 对应"写入门控/隔离"。
- **保留旧系统**:Plus/Pro 网页端仍可用旧版 Saved memories,给不信任自动摘要的用户兜底。

## 行业对照

AGIPlayer 指出: Anthropic 早于 OpenAI 一个月给 Claude 加了 Dreaming(Managed Agents can now "dream",据 Ars Technica),记忆合成正在成为 AI 助手标配。判断: **长期记忆正从"存储方案竞争"变成"生命周期管理 + 用户可控性竞争"**。

## Coding Agent 的实现级对照(2026-06 逆向)

消费级(ChatGPT/Claude)是"后台合成 + 用户可控",Coding Agent 把同一套思路落到了 prompt/源码层,但分成两条路线(见[记忆+压缩实现横评](../comparisons/harness-memory-compaction-implementation.md)):

- **Claude Code = 增量编辑**:主 Session 主动写 + 对话结束后 fork session 抽取(互斥);Dream 离线整合默认关闭。响应快,但要花大量 prompt 规定"不记什么"。
- **Codex = 批量挖掘**:新会话启动两阶段(mini 并行提取 + 合并),整合进分层文件夹。质量稳但学习慢。
- 共同铁律印证本页观点:**Agent 自己写的记忆默认不可信**——召回前先核实(文件/flag 可能失效)、超 1 天记忆附"可能过时"提醒,这正是消费级"记忆摘要可纠错/可回滚"的工程内核。

## 对车载小爱 / 消费级 Agent 的启示

- 车载场景天然多"过期事实"(临时目的地、临时同行人、一次性路线),最该抄的是"Stay current over time"——记忆要带时间状态、会自动作废,而不是无脑长期保存。
- 自动合成的记忆必须配**用户可见摘要 + 一键纠错/关闭**,否则一旦记错,用户没有干预入口,体验比不记还差。
