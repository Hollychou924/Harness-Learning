---
id: agent-skills-design-and-evaluation
type: topic
status: active
updated: 2026-06-08
sources:
  - wiki/raw/official-posts/agent-skills-2026-06/2026-anthropic-lessons-from-building-claude-code-how-we-use-skills.md
  - wiki/raw/official-posts/agent-skills-2026-06/2026-05-01-perplexity-designing-refining-maintaining-agent-skills.md
  - wiki/raw/official-posts/agent-skills-2026-06/2026-agentskills-io-overview-and-specification.md
  - wiki/raw/official-posts/agent-skills-2026-06/2026-claude-code-docs-extend-claude-with-skills.md
  - wiki/raw/official-posts/agent-skills-2026-06/2026-openai-codex-agent-skills.md
  - wiki/raw/official-posts/agent-skills-2026-06/2026-openai-testing-agent-skills-with-evals.md
  - wiki/raw/official-posts/agent-skills-2026-06/2026-openai-shell-skills-compaction-tips.md
  - wiki/raw/official-posts/agent-skills-2026-06/2026-openai-using-skills-to-accelerate-oss-maintenance.md
  - wiki/raw/official-posts/agent-skills-2026-06/2026-anthropic-writing-effective-tools-for-ai-agents.md
  - wiki/raw/official-posts/agent-skills-2026-06/2026-cursor-best-practices-for-coding-with-agents.md
  - wiki/raw/official-posts/agent-skills-2026-06/2026-builder-io-agent-skills-vs-rules-vs-commands.md
  - wiki/raw/official-posts/agent-skills-2026-06/2025-12-18-github-copilot-now-supports-agent-skills.md
  - wiki/raw/official-posts/agent-skills-2026-06/2026-github-how-to-write-a-great-agents-md.md
  - wiki/raw/official-posts/agent-skills-2026-06/2026-mcp-build-with-agent-skills.md
owners: ["zhouhao"]
when_to_load: "讨论 Skills 设计/评估/维护、Skills vs Rules vs Commands、渐进式披露、技能触发描述、AGENTS.md、E1/E3/E5/E6/E7/E8 章节补充弹药时加载"
---

# Agent Skills 设计、评估与维护(14 篇官方/权威合集)

> 一句话:Skill 不是"一个 markdown 文件",而是一个按需加载、可版本化、要付上下文税的能力包;它的价值不在写得多全,而在"模型没它会做错的那一句"。

## 核心论断(可直接当文章弹药)

1. **Skill 是文件夹,不是 markdown** —— 含 `SKILL.md` + 脚本 + 参考 + 模板 + 数据,通过 discovery → activation → execution 三段式渐进加载。(agentskills.io / Anthropic / MCP)
2. **写 Skill ≠ 写代码** —— Perplexity 直言:PEP20(Python 之禅)里至少一半箴言在写 Skill 时是错的;Skill 是"给模型造上下文",不是写软件,照写代码的方式写就会失败。
3. **description 是路由触发器,不是摘要** —— 它是模型"要不要拿出这个技能"的决策边界;要写给模型、不是写给人;Glean 实测上 skill 后正确触发率先掉约 20%,加"何时别用"负向例子后才恢复。(OpenAI shell-tips / Anthropic / Builder)
4. **每个 Skill 都是一笔税** —— 自检每句话:"模型没这句会做错吗?"不会就删。index 层约 100 token/skill 全程付费;SKILL.md 体建议 ≤5000 token;一个会话常加载 3-5 个 skill,冗余会拖垮其它能力。(Perplexity)
5. **三级上下文成本递进** —— index(极省)→ SKILL.md 体(适中)→ scripts/子技能(按需,可 0 也可 2 万 token);无界条件分支逻辑放最后一级。(Perplexity / OpenAI)
6. **层级目录解决"选错"** —— Perplexity 税法技能用 3 级嵌套;把全部 1945 节美国税法塞进一个目录,效果比不加技能还差;让模型先选 20 个大类、再选类内 15 项,比直接 300 选 1 容易得多。
7. **verification 类技能投入产出最高** —— Anthropic 说验证类技能对输出质量影响最大,值得让工程师花一周专门打磨;可让模型录屏自证、每步做程序化断言。
8. **指令优先于脚本,要确定性才上脚本** —— OpenAI/Codex 默认推荐 instruction-only;需要确定性或调外部工具才用 script;步骤写成带显式输入输出的祈使句。
9. **需要确定性时直接点名技能** —— "Use the `<skill>` skill" 是最简单的可靠性杠杆,把模糊路由变成显式契约。(OpenAI shell-tips)
10. **模板/示例放进技能里"不用时几乎免费"** —— 别再往系统提示里塞模板;放进 skill,只有触发时才加载,Glean 称这带来了最大的质量与时延收益。
11. **AGENTS.md 用 if/then 把技能变强制** —— "改 runtime 前先调 $implementation-strategy""动到代码就跑 $code-change-verification";GitHub 分析 2500+ 个 agents.md 总结:具体角色+前置命令+代码示例+明确边界,远胜"你是一个助手"。
12. **Skill 也能带记忆和钩子** —— 可在技能目录里存 append-only 日志/JSON/SQLite 做轻量记忆;可注册"按需 hook"(只在技能调用期间生效),如 `/careful` 临时拦截 rm -rf / DROP TABLE。(Anthropic)
13. **Skill + 网络是高风险组合** —— OpenAI 提醒这是最易被忽视、最难补救的安全点,默认就要做隔离/最小权限;`/mnt/data` 作为产物交接边界。
14. **Skill 要像 prompt 一样做 eval** —— eval = prompt → trace+artifacts → checks → score;查四件事:触发了吗、跑了预期命令吗、产物合规吗、有没有空转;10-20 条 prompt 即够,含显式/隐式/上下文/负向四类用例防误触发。(OpenAI eval-skills)

## Skills vs Rules vs Commands(产品经理对照表,源自 Builder.io)

| 概念 | 谁触发 | 适合 | 上下文成本 | 反模式 |
|---|---|---|---|---|
| Rules(规则) | 工具(每次都加) | repo 硬性要求、非协商约束 | 永远付费 | 把教程塞进 rules |
| Commands(命令) | 用户显式 `/xx` | 显式工作流、人体工学快捷 | 触发时付费 | 把策略硬编进命令 |
| Skills(技能) | Agent 按需 | 可选、特定领域专长 | 触发时付费 | 写成系统提示已有的废话 |

> Builder 的判断:Skill 是"把关键约束从臃肿 rules 文件里救出来"的解药;Rules 管不变量,Commands 管显式流程,Skills 管按需专长;"先试 Skill,反复坏了再上 subagent"。

## 何时需要一个 Skill / 何时不需要(源自 Perplexity)

- 需要:模型默认会做错、要跨多次运行强一致、知识 durable 但不在训练数据(企业流程/截止日期)、纯属"品味"(设计负责人指定字体与质感)。
- 不需要:模型本来就会(一串 git 命令);系统提示已有;变化太快没法维护(频繁变动的远程 MCP 端点会导致漂移)。

## 对 E1-E8 的弹药映射

| 章 | 主题 | 可引用的核心观点 / 案例 | 弹药编号 |
|---|---|---|---|
| E1 | 什么是 Harness | Skill/Rules/Commands 是 Harness 的能力组织层;Cursor"harness 编排 model+tools+instructions、按模型调教"印证 Harness > Model | 1,2,11 + Cursor harness 段 |
| E3 | 工具系统与 MCP | description 即工具路由;Anthropic"用 agent 帮你写工具 eval 并自动优化工具说明";MCP 把 Skill 当可移植指令集指导工具/认证设计 | 3,8,9,13 |
| E4 | 上下文与记忆 | 三级上下文成本与渐进式披露;"每个 Skill 都是一笔税";Skill 内置 append-only / SQLite 轻量记忆;compaction 配合长任务 | 4,5,6,12 |
| E5 | 能力的组织 | Skills vs Rules vs Commands 对照;九类技能分类;层级目录解决"300 选 1";"先 Skill 后 subagent";repo-local skill + AGENTS.md 强制触发 | 1,6,11 + Builder 表 |
| E6 | 安全与权限 | Skill+网络高风险、默认隔离最小权限;按需 hook(`/careful` 临时拦 rm -rf / DROP TABLE);`/mnt/data` 产物交接边界 | 12,13 |
| E7 | 模型与 Harness 共进化 | OpenAI 用 repo-local skills+AGENTS.md+report-first 工作流把验证/发版/PR review 变可复用;Cursor 计划存盘喂未来 agent | 11 + OSS-maintenance |
| E8 | 评估与数据驱动 | Skill eval 四问 + prompt→trace→checks→score;Glean 触发率掉 20% 再恢复的真实数据;显式/隐式/上下文/负向四类用例;deterministic + rubric grader | 3,14 + Glean 案例 |

## 最硬的两个"反例/数据"(发文优先用)

- **Glean:上了 skill 路由,正确触发率先掉约 20%**,补"何时别用"负向例子+边界后才恢复 —— 证明"description 写不好,加技能反而更差"。(OpenAI shell-tips)
- **Perplexity:把全部 1945 节美国税法塞一个目录,效果比不加技能还差** —— 证明"信息架构/层级"比"塞得全"更重要。

## 相关页面

- [Agent 评测体系](agent-evaluation-system.md)
- [Spec 驱动的 Agent 开发](../concepts/spec-driven-agent-development.md)
- 入库覆盖账本: `wiki/review/ingest-coverage/2026-06-08-agent-skills.md`
