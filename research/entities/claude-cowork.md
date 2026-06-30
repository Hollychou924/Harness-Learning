---
id: claude-cowork
type: entity
status: active
updated: 2026-06-06
sources:
  - https://claude.com/product/cowork (官方产品页 "Cowork: Claude Code power for knowledge work")
  - wiki/raw/official-posts/claude/2026-05-20-how-an-anthropic-sales-leader-uses-claude-cowork-to-run-a-4-000-account-.md (官方销售实战)
  - wiki/raw/community-posts/desktop-agent-comparisons/2026-01-19-对话阶跃AI做桌面-Agent要比-Claude-Cowork-往前一步.md (第三方横评)
owners: ["zhouhao"]
when_to_load: "讨论 Claude Cowork、桌面端通用 Agent、把编码 Agent 能力迁移到知识工作、计划-确认-执行、定时任务、企业管控时加载"
---

# Claude Cowork

> 一句话: Cowork 是 Anthropic 把 Claude Code 那套 Agent 能力(计划→确认→执行、文件操作、Skills、定时任务)从"写代码"搬到"知识工作"的桌面端产品,核心不是聊天,而是"交一个任务、回来拿成品"。

## 1. 是什么

- 官方自我定位: **"Cowork: Claude Code power for knowledge work"**——把 Claude Code 的执行力用于非编码的日常工作。
- 与 Chat 的本质区别(官方原话意译): Chat 是来回问答,Cowork 让 Claude **自己把活干完**——你描述结果和节奏,它行动并随时汇报,你回来拿结果。
- 典型场景: 整理 Downloads 文件夹、把一堆收据/截图转成结构化表格、按公司模板出品牌报告/PPT、每周从会议纪要里抽 Q1 产品更新报告、定时拉数据/邮件/Slack 摘要。
- 形态: 桌面端(本地)Agent;官方已推出"Cowork 企业版"——管理员可管理功能访问、控制花费、跟踪全组织用量。

## 2. 关键机制

| 机制 | 说明 | 产品含义 | 来源 |
|---|---|---|---|
| 计划-确认-执行 | 典型交互是: 先扫描现状、给出计划(建哪些目录、怎么归类、命名规范、待删文件),让你批准后才动手 | 把"先给计划再放手"做成默认安全姿势,降低自主操作的失控感 | claude.com/product/cowork |
| 定时任务(Scheduled tasks) | 一次定义节奏(每天/每周/每月),之后 Claude 自动执行(查邮件、拉指标、跑周报摘要) | Agent 从"被动应答"变成"按节奏主动干活",这是和传统 Chat 的代际差异 | claude.com/product/cowork |
| 文件与产物操作 | 直接对本地文件夹排序/重命名/清理,产出 Excel/文档/PPT/报告 | 本地端 Agent 的价值在于能真正落到文件系统,而不只是给文本 | claude.com/product/cowork |
| Skills 复用 | 销售实战文章里 Skills 是高频线索: 用沉淀好的 Skill 跑日/周/季度固定流程 | 把"验证过的流程"固化成 Skill 反复调用,是 Cowork 稳定性的来源(对应阶跃口中的"妙计") | 官方销售实战文 |
| 企业管控 | 企业版支持管理员管功能权限、控成本、看用量 | 通用桌面 Agent 要进组织,治理(权限/成本/审计)是门槛而非附属 | claude.com/product/cowork |

## 3. 产品判断

- Cowork 验证了一个关键趋势: **Harness 是可迁移的**——Claude Code 沉淀的"计划-确认-执行 + 权限 + Skills"这套执行秩序,换个场景(知识工作)依然成立,说明真正的护城河在 Harness 而非某个垂直功能。
- 它和编码 Agent 共用同一套底层能力,差异在"产物形态"(文档/表格/报告 vs 代码)和"用户画像"(知识工作者 vs 工程师)。
- 第三方横评(阶跃)给出的行业判断: 大家都先选"本地端"是为了更大的场景拓展空间和上下文探索空间,代价是关机不能跑、安装渗透率低于网页;长期方向是端云协同。
- 对竞品分析: Cowork 是论证"Harness > 垂直功能、且可跨场景迁移"的最佳样本,也是 E5(Skills/能力组织)和"通用桌面 Agent"赛道的代表。

## 4. 可支撑的系列章节

| 章节 | 可支撑内容 |
|---|---|
| E1 全景 | "Harness 可迁移"、通用桌面 Agent 赛道定位 |
| E2 编排循环 | 计划-确认-执行、定时任务的自主循环 |
| E5 能力组织 | Skills 沉淀固定流程、跨场景复用 |
| E6 安全与权限 | 动手前出计划待批准、企业版功能/成本管控 |
| E9 DeepSeek 提案 | 通用桌面 Agent、主动定时任务、计划-确认交互 |

## 5. 相关页面

- [Claude Code](./claude-code.md)
- [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md)
- [桌面 Agent 第三方横评](../topics/desktop-agent-third-party-comparisons.md)

## 6. 待复核

- 官方产品页内容会随发布迭代,具体场景/企业版能力以 claude.com/product/cowork 最新为准。
- "计划-确认-执行""定时任务"为官方页面示意,落地细节(权限粒度、可否中途接管)进入 E6 正文时需进一步核验。
