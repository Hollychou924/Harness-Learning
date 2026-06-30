---
id: desktop-agent-third-party-comparisons
type: topic
status: active
updated: 2026-05-26
sources:
  - wiki/raw/community-posts/desktop-agent-comparisons/INDEX.md
  - wiki/raw/community-posts/desktop-agent-comparisons/2026-05-22-AI桌面智能体大横评OpenClawWorkBuddyQClawQwenPaw怎么选.md
  - wiki/raw/community-posts/desktop-agent-comparisons/2026-05-22-三个-Agent-Harness-框架对比OpenClawHermes-AgentOpenHuman-到底差在哪.md
  - wiki/raw/community-posts/desktop-agent-comparisons/2026-05-25-桌面-Agent-三国杀海外国产垂直13-款怎么选.md
  - wiki/raw/community-posts/desktop-agent-comparisons/2026-05-22-阿里QoderWork上新国内三巨头谁更强.md
  - wiki/raw/community-posts/desktop-agent-comparisons/2026-05-14-国内桌面AI助手已成三国鼎立之势TRAEWorkbuddy和Qoderwork谁更好用.md
  - wiki/raw/community-posts/desktop-agent-comparisons/2026-05-20-OpenHumanHermesOpenClaw-三大开源-AI-Agent-深度对比.md
  - wiki/raw/community-posts/desktop-agent-comparisons/2026-03-03-OpenClaw-平替产品全景对比2026-年-20+AI-Agent-工具深度评测.md
  - wiki/raw/community-posts/desktop-agent-comparisons/2026-02-04-全球占比72%的Windows用户迎来了属于他们的最强桌面Agent.md
  - wiki/raw/community-posts/desktop-agent-comparisons/2026-03-30-桌面级-AI-Agent-落地全景与竞争洞察深度报告.md
  - wiki/raw/community-posts/desktop-agent-comparisons/2026-01-22-React-Agent-多轮对话架构深度对比-Antigravity-vs-Claude-Code.md
  - wiki/raw/community-posts/desktop-agent-comparisons/2026-05-12-DeepSeek-TUIClaude-CodeOpenClaw三类-Agent-平台如何对比理解.md
  - wiki/raw/community-posts/desktop-agent-comparisons/2026-01-20-对话阶跃AI做桌面-Agent要比-Claude-Cowork-往前一步.md
owners: ["zhouhao"]
when_to_load: "做桌面 Agent / Coding Agent 选型、产品横评、DeepSeek 桌面端竞品分析时加载"
---

# 桌面 Agent 第三方横评合集 (13 篇)

> 一句话: 这 13 篇是来自 12 个不同自媒体公众号的横评/对比/选型文章,主题高度集中在「2026 年桌面 Agent 怎么选」。它和官方文章、开发者技术合集互补——给的是真实使用者的产品判断,而不是厂商口径。对车载小爱 / DeepSeek 桌面端 Agent 的产品选型与对比表是最直接的一手论据。

## 1. 全集结构

按比较对象分了 5 类。

| # | 比较视角 | 文章 | 读完能拿到什么 |
|---|---|---|---|
| A | **国内桌面 Agent 三国杀**(QoderWork / WorkBuddy / TRAE Solo MTC) | [阿里 QoderWork 上新,国内三巨头谁更强](../raw/community-posts/desktop-agent-comparisons/2026-05-22-阿里QoderWork上新国内三巨头谁更强.md), [TRAE / Workbuddy / Qoderwork 谁更好用](../raw/community-posts/desktop-agent-comparisons/2026-05-14-国内桌面AI助手已成三国鼎立之势TRAEWorkbuddy和Qoderwork谁更好用.md), [大横评 OpenClaw / WorkBuddy / QClaw / QwenPaw](../raw/community-posts/desktop-agent-comparisons/2026-05-22-AI桌面智能体大横评OpenClawWorkBuddyQClawQwenPaw怎么选.md) | 阿里/腾讯/字节三家 2026 年 5 月最新桌面 Agent 的真实使用差异: 价格、积分、稳定性、成功率、生态绑定 |
| B | **海外/国产/垂直三角全景**(Cowork / QoderWork / Manus / Operator / Gemini Agent / Skywork 等 13 款) | [桌面 Agent 三国杀: 海外、国产、垂直,13 款怎么选](../raw/community-posts/desktop-agent-comparisons/2026-05-25-桌面-Agent-三国杀海外国产垂直13-款怎么选.md), [桌面级 AI Agent 落地全景与竞争洞察深度报告](../raw/community-posts/desktop-agent-comparisons/2026-03-30-桌面级-AI-Agent-落地全景与竞争洞察深度报告.md) | 2026 Q1-Q2 桌面 Agent "从云端回到本地"的方向反转;OSWorld 跑分 Claude Opus 4.6 已 72.7% 而 OpenAI CUA 仍 38.1% |
| C | **开源 Agent Harness 三选**(OpenClaw / Hermes / OpenHuman) | [三个 Agent Harness 框架对比: OpenClaw / Hermes / OpenHuman](../raw/community-posts/desktop-agent-comparisons/2026-05-22-三个-Agent-Harness-框架对比OpenClawHermes-AgentOpenHuman-到底差在哪.md), [OpenHuman / Hermes / OpenClaw 三大开源 AI Agent 深度对比](../raw/community-posts/desktop-agent-comparisons/2026-05-20-OpenHumanHermesOpenClaw-三大开源-AI-Agent-深度对比.md), [OpenClaw 平替产品全景对比 20+ 工具](../raw/community-posts/desktop-agent-comparisons/2026-03-03-OpenClaw-平替产品全景对比2026-年-20+AI-Agent-工具深度评测.md) | 三大开源 Agent 的方向分工: OpenClaw 解决"入口/控制平面",Hermes 解决"自我演化运行时",OpenHuman 解决"个人上下文/产品体验" |
| D | **架构层深度拆解**(Antigravity vs Claude Code / DeepSeek-TUI vs Claude Code vs OpenClaw) | [React Agent 多轮对话架构: Antigravity vs Claude Code](../raw/community-posts/desktop-agent-comparisons/2026-01-22-React-Agent-多轮对话架构深度对比-Antigravity-vs-Claude-Code.md), [DeepSeek-TUI / Claude Code / OpenClaw 三类 Agent 平台对比](../raw/community-posts/desktop-agent-comparisons/2026-05-12-DeepSeek-TUIClaude-CodeOpenClaw三类-Agent-平台如何对比理解.md) | "显式协调 vs 模型智能"的两条架构哲学:Antigravity 用 task_boundary 显式状态机 + artifact 文件,Claude Code 用扁平化 messages + 隐式上下文累积 |
| E | **垂直/平台视角**(Windows 桌面 Skywork / 阶跃桌面 Agent) | [全球占比 72% Windows 用户迎来最强桌面 Agent](../raw/community-posts/desktop-agent-comparisons/2026-02-04-全球占比72%的Windows用户迎来了属于他们的最强桌面Agent.md), [对话阶跃 AI: 做桌面 Agent 要比 Claude Cowork 往前一步](../raw/community-posts/desktop-agent-comparisons/2026-01-20-对话阶跃AI做桌面-Agent要比-Claude-Cowork-往前一步.md) | Windows 生态被低估;阶跃在做"端侧 + 多模态"差异化叙事 |

## 2. 跨文章共识

| 共识 | 出处样本 | 含义 |
|---|---|---|
| 2026 年桌面 Agent 的方向反转: 从云端回到本地 | [13 款怎么选](../raw/community-posts/desktop-agent-comparisons/2026-05-25-桌面-Agent-三国杀海外国产垂直13-款怎么选.md) | Anthropic/OpenAI/阿里/Manus 四家 Q1-Q2 不约而同把 Agent 推到桌面端,因为"云沙箱碰不到真实文件、调不动已装软件、看不见 Notion/Excel/PS" |
| 桌面 Agent 不是聊天机器人,核心是"替你执行"而非"告诉你怎么做" | [QoderWork vs WorkBuddy vs TRAE](../raw/community-posts/desktop-agent-comparisons/2026-05-22-阿里QoderWork上新国内三巨头谁更强.md), [Skywork Windows](../raw/community-posts/desktop-agent-comparisons/2026-02-04-全球占比72%的Windows用户迎来了属于他们的最强桌面Agent.md) | 评价桌面 Agent 必须看任务成功率、文件落地、流程闭环,而不是回答质量 |
| 国内三家差异: 阿里(顶尖+贵)/腾讯(便宜+生态)/字节(IDE 出身+云任务) | [三国鼎立 谁更好用](../raw/community-posts/desktop-agent-comparisons/2026-05-14-国内桌面AI助手已成三国鼎立之势TRAEWorkbuddy和Qoderwork谁更好用.md), [国内三巨头谁更强](../raw/community-posts/desktop-agent-comparisons/2026-05-22-阿里QoderWork上新国内三巨头谁更强.md) | QoderWork 任务成功率最高/价格最贵, WorkBuddy 便宜+生态(ima 知识库唯一档), TRAE Solo MTC 模型偏弱+云端隐患 |
| 三大开源 Agent Harness 解决三个不同问题 | [三个 Harness 框架对比](../raw/community-posts/desktop-agent-comparisons/2026-05-22-三个-Agent-Harness-框架对比OpenClawHermes-AgentOpenHuman-到底差在哪.md) | OpenClaw=入口/控制平面;Hermes=自我演化运行时;OpenHuman=个人上下文产品化 |
| Antigravity 与 Claude Code 代表两条架构哲学 | [React Agent 架构对比](../raw/community-posts/desktop-agent-comparisons/2026-01-22-React-Agent-多轮对话架构深度对比-Antigravity-vs-Claude-Code.md) | Antigravity 走"显式协调"(task_boundary/artifact/服务端状态机),Claude Code 走"模型智能"(扁平 messages/客户端累积) |
| 桌面 Agent 选型最该看的不是模型,而是连接到哪些工具/文件/渠道/权限 | [DeepSeek-TUI/Claude Code/OpenClaw 三类对比](../raw/community-posts/desktop-agent-comparisons/2026-05-12-DeepSeek-TUIClaude-CodeOpenClaw三类-Agent-平台如何对比理解.md) | "Agent 平台的差异,不在于谁更像人,而在于它把模型连接到哪些工具、文件、渠道和权限边界" |
| Windows 生态长期被忽视,但占比 72% 的真实工位都在 Windows | [Skywork Windows](../raw/community-posts/desktop-agent-comparisons/2026-02-04-全球占比72%的Windows用户迎来了属于他们的最强桌面Agent.md) | 国产 Agent 真要做企业市场,必须在 Windows 文件系统/PDF/Excel/票据这种"脏活"上比 Mac 更扎实 |

## 3. 价格/能力速查表

把横评里反复出现的国内三家关键参数提炼成一张速查表(2026 年 5 月时点,实际可能变动):

| 产品 | 月费(基础) | 积分/额度 | 任务成功率主观评价 | 数据安全 | 生态绑定 | 适用人群 |
|---|---|---|---|---|---|---|
| **QoderWork**(阿里) | 较贵 | 2000 积分级 | 最高 | 中间文件本地可见 | 通义/Lingma/QoderWake | 严肃工作/愿付费追求成功率 |
| **WorkBuddy**(腾讯) | 58 元 / 月 | 2000 积分 + 5000 新人 | 中(分析不稳定) | 目录权限一次性获取 | ima 知识库/腾讯生态 | 中低端市场/性价比/学校教育 |
| **TRAE Solo MTC**(字节) | 10 美元/月 | 等同 20 美元额度 | 中(模型偏弱)+ 唯一支持云任务 | 云端沙箱/账户登出不可见 | TRAE IDE | 编码出身/已用 TRAE 写代码 |

> 来源: [2026-05-14 三国鼎立](../raw/community-posts/desktop-agent-comparisons/2026-05-14-国内桌面AI助手已成三国鼎立之势TRAEWorkbuddy和Qoderwork谁更好用.md), [2026-05-22 三巨头谁更强](../raw/community-posts/desktop-agent-comparisons/2026-05-22-阿里QoderWork上新国内三巨头谁更强.md)

## 4. 对已有 wiki 页的支撑

| 已有页面 | 本批新增的支撑 |
|---|---|
| [Qoder / CodeBuddy / Cursor / Claude Code 对比](../comparisons/qoder-codebuddy-cursor-claude-code-comparison.md) | 第三方实测视角对比,补强官方叙事;新增 TRAE Solo MTC 与字节维度 |
| [OpenClaw / Claude Code / Hermes 三篇产品拆解沉淀](openclaw-claude-code-hermes-comparison.md) | 第三方对 OpenClaw / Hermes / OpenHuman 三方向分工的清晰判断,补充 Antigravity 这条 Google DeepMind 路线 |
| [Qoder 实体页](../entities/qoder.md), [CodeBuddy 实体页](../entities/codebuddy.md) | 第三方使用者真实成功率/价格/积分体验,平衡官方文章口径 |

## 5. 对车载小爱 / DeepSeek 桌面端 Agent 的产品启示

1. 2026 年的桌面 Agent 主战场已从云端回到本地,做选型时优先看"能不能进用户硬盘、调用户已装软件",再看模型分数。
2. 国内三家差异化已经清晰: 顶尖+贵 / 便宜+生态 / 编码出身+云任务,DeepSeek 桌面端进入这个市场必须先回答"差异化卡哪个口"。
3. 评测桌面 Agent 不能只看"答得准",必须看"任务成功率 + 文件落地 + 中间文件可见性 + 价格阶梯",这四件是用户实测口径。
4. 架构哲学有两条路: 显式协调(Antigravity/QoderWork Quest) vs 模型智能(Claude Code/OpenClaw),DeepSeek 桌面端要明确自己走哪条,以及为什么。
5. Windows 生态被严重低估,占比 72% 的真实工位都在 Windows;Mac-first 的 Agent 在企业场景里几乎用不上。
6. 用户付费意愿排序: 任务成功率 > 数据安全 > 价格 > 生态绑定;模型差距已经不是首要决策因素。

## 6. 来源与覆盖账本

- 索引: [community-posts/desktop-agent-comparisons/INDEX.md](../raw/community-posts/desktop-agent-comparisons/INDEX.md)
- 覆盖账本: [桌面 Agent 横评第三方 13 篇账本](../review/ingest-coverage/2026-05-26-desktop-agent-third-party-comparisons.md)

## 7. 相关页面

- [Qoder / CodeBuddy / Cursor / Claude Code 对比](../comparisons/qoder-codebuddy-cursor-claude-code-comparison.md)
- [OpenClaw / Claude Code / Hermes 运行架构对比](../comparisons/agent-runtime-architecture-openclaw-claude-code-hermes.md)
- [Qoder](../entities/qoder.md)
- [CodeBuddy](../entities/codebuddy.md)
- [腾讯云开发者 Agent / Harness 合集](tencent-cloud-developer-agent-harness-collection.md)
- [阿里云开发者 Agent / Harness 合集](aliyun-cloud-developer-agent-collection.md)
