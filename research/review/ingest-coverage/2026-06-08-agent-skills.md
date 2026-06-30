---
id: coverage-agent-skills-2026-06-08
type: ingest-coverage
status: triaged
updated: 2026-06-08
scope: "Agent Skills 专题 14 篇官方/权威文章入库 + 去向"
---

# 入库覆盖账本 · Agent Skills 专题(14 篇)

## 1. 总览

- 覆盖 raw: **14 篇**(`raw/official-posts/agent-skills-2026-06/`)
- 升级成品: **1 个 topic**(`topics/agent-skills-design-and-evaluation.md`)
- 当前状态: **triaged**。同主题 ≥3 篇,按 SOP 3.2 触发 topic 综述;并产出 E1-E8 弹药映射表。
- 用途: 为《AI 产品经理读懂 Harness》E1-E8 章节补充弹药。

## 2. 逐篇去向

| # | 原文 | 来源 | 去向 | 待升级/备注 |
|---:|---|---|---|---|
| 1 | Lessons from building Claude Code: How we use skills | Anthropic | topic | 九类技能分类、verification 投入产出最高、按需 hook、Skill 带记忆 |
| 2 | Designing/Refining/Maintaining Skills at Perplexity | Perplexity | topic | Skill≠代码、三级成本、层级目录、"每个 Skill 是一笔税" |
| 3 | Agent Skills Overview / Specification | agentskills.io | topic | discovery→activation→execution 渐进加载标准定义 |
| 4 | Extend Claude with skills(docs) | Anthropic | topic | frontmatter/hook/动态加载落地细节 |
| 5 | Agent Skills — Codex | OpenAI | topic | best practices:一事一技能、指令优先于脚本、测触发 |
| 6 | Testing Agent Skills with Evals | OpenAI | topic | eval 四问、四类用例、deterministic+rubric grader(E8 主力) |
| 7 | Shell + Skills + Compaction | OpenAI | topic | Glean 触发率掉 20% 案例、模板放技能、点名技能求确定性、网络高风险 |
| 8 | Using skills to accelerate OSS maintenance | OpenAI | topic | repo-local skill + AGENTS.md if/then 强制、report-first 工作流(E7) |
| 9 | Writing effective tools for AI agents | Anthropic | topic | 用 agent 写工具 eval 并自动优化工具说明、namespacing(E3) |
| 10 | Best practices for coding with agents | Cursor | topic | harness 编排 model+tools+instructions、Plan Mode、计划存盘(E1) |
| 11 | Agent Skills vs. Rules vs. Commands | Builder.io | topic | 三件套对照表(E5 产品经理主力) |
| 12 | GitHub Copilot now supports Agent Skills | GitHub | topic | 跨平台扩散、兼容 .claude/skills(low-signal 偏新闻,仅作佐证) |
| 13 | How to write a great AGENTS.md(2500 repos) | GitHub | topic | 具体角色+前置命令+代码示例+边界、六大核心区(E3/E5) |
| 14 | Build with Agent Skills | MCP | topic | Skill 当可移植指令集指导 MCP 工具/认证设计(E3) |

## 3. SKIP+REASON

- 第 12 篇(GitHub Copilot changelog)signal 偏新闻,但用于佐证"Skills 跨平台标准化扩散",已并入 topic,不单独建实体页。reason: 已被 topic 覆盖。

## 4. 证据消化

- topic 每条核心论断都标注了来源(Anthropic/Perplexity/OpenAI/Builder/GitHub/MCP)。
- 两个最硬的反例/数据:Glean 触发率掉 20%(OpenAI shell-tips)、Perplexity 1945 节税法塞一目录反而更差。

## 5. 弹药实际落地(飞书,2026-06-08 以周浩个人身份 insert-after 追加,未删原文)

| 章 | 飞书文档 | 插入位置(节末) | 弹药要点 |
|---|---|---|---|
| E3 工具篇 | QPP6dLpNrofZNlx8JbQceIRanAc | 一、四种外壳怎么选 | description 即路由 + Glean 触发率掉 20% 案例 + 点名求确定性 |
| E5 多 Agent 篇 | BEgPdYVXwoxFEDxnNU3cK8pTnfe | 二、什么时候该拆 | Rules/Command/Skill 顺序、先 Skill 后 subagent |
| E6 安全篇 | IChudvk43ogw7Kxh7XmcFD2onPe | 三、提示词注入 | Skill+联网高风险、默认隔离最小权限、交接目录 |
| E7 自进化篇 | DURwdilfHo2bjSxXaxuc4lcnnJd | 二、Skill 打磨 | Anthropic 验证类技能投入最高 + AGENTS.md if/then 强制 |
| E8 评估篇 | SbZMdxTwto9AYCxJ5SgcNALonob | 三、按什么标准打分 | Skill eval 四问 + 10-20 条四类用例(含负向防误触发) |

> 飞书为 8 篇制(N/8)定稿,比本地 series/_publish 旧草稿更新;本次以飞书线上版为基准、纯追加,未改本地 _publish。链接映射见 series/_publish/FEISHU-LINKS.md。
