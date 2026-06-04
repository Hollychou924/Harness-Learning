# E1 详细大纲｜重新理解 Agent + 桌面端 Agent 全景图

> 这是动笔前的大纲。先把它谈定,再进 `drafts/draft-v1.md`。
> E1 的任务是**给全系列画地图**,不是写满 9 款深度对比。配比:立论 40% + 五大组件框架 40% + 9 款速览 20%。

---

## 本文回答的问题(开篇要摆出来)

1. 同一个任务,该用 Claude Code 直接跑、还是自建 Agent 系统?
2. 业务该接 API / 桌面端 / IDE 插件?怎么分析?
3. "Agent 化改造"的 ROI 怎么算才诚实?
4. Demo 好、真实项目翻车,鸿沟在哪?
5. 做 Agent 产品,PM 工作方式有什么本质不同?

---

## 0. 开篇钩子（约 400 字）

**场景**:你的 AI 客服用了市面最强模型,效果还不如对手用差一档模型做的产品。问题不在模型,在 Harness。

**抛出核心论断**:Agent = Model + Harness,且 **Harness > Model**。模型定上限,Harness 定真实表现。本文先把这个心智装进读者脑子,再给一张能拆解任何 Agent 的地图。

---

## 1. 三次范式跃迁:Prompt → Context → Harness（约 1200 字,立论核心）

- **Prompt 工程**:把话说清楚 → 天花板:单轮、无状态
- **Context 工程**:管理 Agent 每一轮能看到什么 → 天花板:还是"喂数据",没解决"可靠干活"
- **Harness 工程**:设计 Agent 干活的整个环境——边界、规则、反馈、熵控制
- **原创判断锚点**:"我用 X 时发现,真正拉开差距的不是 prompt 写得多好,是 ……"(动笔时补一手观察)
- 引 `concepts/prompt-context-harness.md`

> ⚠️ 这一节是 Q5(PM 工作方式之变)的答案:PM 的工作从"写 PRD"变成"设计 Agent 能在什么边界里可靠干活"。

## 2. Harness 不是框架,是 Agent 的操作系统（约 1200 字 + 镇文图）

- 类比:OS 管理进程/内存/IO 权限;Harness 管理上下文/记忆/工具/权限
- **插入简化版架构图**(`assets/harness-as-os-overview.jpg` 的精简重绘):
  - 只画主干:UserInput → 上下文组装 → 模型 → 工具/记忆回写
  - 完整版(compact/cache 细节)预告"E4 会拆"
- **这是 Q1 的答案**:Claude Code 这类产品 = OS 固定,自建 = 能改 OS。判断界限:你的业务要不要改这套"操作系统"级的调度。

## 3. 五大组件框架（约 1500 字,= 全系列目录）

这是 E1 最有价值的产出——给读者一把能拆任何 Agent 的尺子,顺便预告 E2-E6:

| 组件 | 一句话 | 哪一期细讲 |
|------|--------|-----------|
| 编排循环 | 任务怎么 Think-Act-Observe 又不跑飞 | E2 |
| 工具系统 | 怎么让 Agent 调对工具、调安全 | E3 |
| 上下文与记忆 | 一次对话到底带着什么、怎么省 token | E4 |
| 能力组织 | 能力多了、任务大了怎么拆 | E5 |
| 安全权限 | 怎么既放手又不闯祸 | E6 |

- **Q2 的答案放这**:选 API/桌面/IDE,本质是看你的任务需要 Agent 触达哪些组件(工具广度?记忆深度?权限边界?)
- 引 `concepts/harness-engineering.md`

## 4. 桌面端 Agent 全景速览（约 1500 字,JD 信号弹,但只速览）

**一句话定位表(9 款,不深挖)**:

| 产品 | 一句话哲学 | wiki |
|------|-----------|------|
| Claude Code | "笨循环"——把秩序放 Harness | `entities/claude-code.md` |
| Cursor | 从编辑器进化到 Agent Mode | `entities/cursor.md` |
| Codex | OpenAI 的极简主义 | `entities/codex.md` |
| GitHub Copilot | 从补全到 Agent 的转身 | 待补档案 |
| OpenCode / OpenClaw | 开源阵营反击 | `entities/openclaw.md` |
| Cowork / Manus / Hermes | 通用任务探索 | `entities/manus.md`、`entities/hermes-agent.md` |

- 每款配一句**原创定位**,不要综述
- **Q3+Q4 的答案放这**:用阿里 25%→90%(成功)和腾讯 4 亿 token 5 教训(踩坑)两个真实数字,讲 ROI 和 Demo-Production 鸿沟。引 `lessons/prompt-only-agent-is-not-production.md`、`topics/aliyun-*`、`topics/tencent-*`

## 5. Harness Engineer 能力模型 + 收尾（约 800 字）

- 能力模型四维:边界 / 规则 / 反馈 / 熵控制
- **与工程师对话的检查清单**(收尾标志产出):
  - [ ] 我们的 Agent 的"操作系统"是现成的还是自建的?
  - [ ] 五大组件里,哪个是我们当前最弱的?
  - [ ] 我们的 ROI 估算同时考虑了成功路径和踩坑成本吗?
- **对 DeepSeek 意味着什么**:一句话留白
- **下期预告**:E2 编排循环——"Agent 卡住的 5 种死法"

---

## 配图清单

- [ ] 简化版"Harness as OS"主干图(Mermaid 重绘,放第 2 节)
- [ ] 三次范式跃迁示意(Mermaid,放第 1 节)
- [ ] 9 款定位速览表(Markdown 表,放第 4 节)

## 素材缺口

- [ ] GitHub Copilot / Cowork / OpenCode 的一句话定位(wiki 暂无独立档案,先用公开认知顶上)
- [ ] 第 1、2 节的"我用 X 发现"原创观察(动笔时补自己的真实使用记录)

## 字数预算

约 6600 字(钩子 400 + 跃迁 1200 + OS 1200 + 框架 1500 + 速览 1500 + 收尾 800)
