---
id: claude-dynamic-workflows
type: entity
status: active
updated: 2026-06-07
sources:
  - https://claude.com/blog/introducing-dynamic-workflows-in-claude-code (官方发布,2026-05-28,已抓取)
  - https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code (Thariq Shihipar,2026-06-02,已抓取)
  - https://mer.vin/2026/06/claude-code-dynamic-workflows-runtime-generated-harnesses-for-multi-agent-work/ (Mervin Praison,四层对比+架构图,已抓取)
  - https://simonaking.com/blog/claude-code-dynamic-workflows/ (推理代码化→编排代码化 演进脉络,已抓取)
  - https://blog.51cto.com/aioldsix/14648708 (51CTO 三层职责分离技术拆解,链接收录待抓)
  - https://dev.to/layzerzero105/opus-48-ships-dynamic-workflows-... (DEV 生产环境坑与配置,链接收录待抓)
  - http://m.toutiao.com/group/7645847573705851426/ (头条 PM 视角,链接收录待抓)
  - https://xzl-tech.blog.csdn.net/article/details/161523467 (CSDN ultracode 215MB 逆向实战,链接收录待抓)
  - https://36kr.com/p/3839611362658569 (36氪 团队成员使用经验,链接收录待抓)
owners: ["zhouhao"]
when_to_load: "讨论 Dynamic Workflows、动态工作流、编排代码化、多 Agent 大规模并行、ultracode、Claude Code 自写 harness、E2 编排 / E5 多 Agent 时加载"
---

# Claude Dynamic Workflows(动态工作流)

> 一句话: Dynamic Workflows 不是"更多 Agent",而是"把编排逻辑代码化"——让 Claude 自己写一段 JavaScript 编排脚本,由一个独立 Runtime 执行,在一个 session 内调度几十到上百(官方上限设计达 1000)个并行子 Agent,中间结果存在脚本变量里而不回灌主上下文,只把聚合后的结果返回。它填补了"单个子 Agent"和"完整 Agent 团队"之间的空白。

> 状态: 2026-05-28 随 Claude Opus 4.8 推出,研究预览(research preview),对 Max / Team / Enterprise(管理员开启)开放,也上 Claude API / Bedrock / Vertex AI / Microsoft Foundry。

## 1. 核心突破:编排逻辑代码化(orchestration as code)

之前所有多 Agent(包括 Claude 自己的 Agent Teams)都是**上下文内编排**:负责协调的主 Agent 要在自己的上下文窗口里追踪所有子任务的进度、状态、结果。子 Agent 一多(超过 ~10 个),上下文被中间结果填满,主 Agent 就"失忆"和逻辑漂移——这正是 E4 讲的 context rot 在多 Agent 场景的放大。

Dynamic Workflows 把任务拆分、调度、等待、复核、返工等**所有编排逻辑,从易污染的主会话上下文中剥离,转化为一段可执行的 JavaScript 脚本**:

- 主 Claude 只负责**生成**这个脚本,不参与具体执行。
- 一个独立的、无业务理解的 **Runtime** 负责执行脚本、管理状态、spawn/coordinate 子 Agent(脚本里有几个特殊函数专门用来生成和协调子 Agent,也能用标准 JS 的 JSON/Math/Array)。
- 所有中间结果存在**脚本变量**里,不回灌主上下文。
- 最终只有**聚合后的结果**返回主会话。

官方原话:"Claude can now write and orchestrate its own multi-agent harness on the fly, custom-built for the task at hand."——**Claude 现在能为每个任务即时写出一套定制的多 Agent harness。** 这也是文章标题"A harness for every task"的由来。

## 2. 三层职责分离

| 层 | 角色 | 职责 |
|---|---|---|
| 主 Claude | 编排者(生成) | 分析任务、写出 JavaScript 编排脚本;不执行 |
| Runtime | 调度执行(无业务理解) | 执行脚本、管理状态、spawn/coordinate 子 Agent |
| Subagent | 执行单元 | 各自独立上下文,执行具体任务(读文件/写代码/跑测试),只回传结果 |

## 3. 与之前多 Agent 机制的本质区别(官方/Mervin 对比)

| 机制 | 谁决定下一步 | 中间结果存哪 | 典型规模 |
|---|---|---|---|
| Subagents | Claude,逐轮决定 | 主上下文窗口 | 每轮几个委派 |
| Skills | Claude 按指令 | 主上下文窗口 | 同 Subagents |
| Agent Teams(2026-02) | Lead Agent 监督同侪 | 共享任务列表 | 少数长跑同侪(~16) |
| **Dynamic Workflows(2026-05)** | **脚本(代码)** | **脚本变量** | **每次几十到上百(设计上限 1000),并发 ~16** |

关键差异:**计划(plan)活在可执行代码里,而不是一段不断增长的聊天记录里。** 这就是它能突破"上下文窗口瓶颈"的根因。

## 4. 三个杀手级能力

1. **动态拓扑(dynamic topology)**:脚本是命令式 JavaScript,支持 while / if / 动态扇出,工作流结构不是预先定义的,而是运行时按实际情况动态生成。例:安全审计中一个子 Agent 发现高危漏洞,脚本可自动再起 3 个子 Agent 从不同角度交叉验证。
2. **ultracode 模式**:`/effort ultracode` 一键开关——把思考预算调到最高档(xhigh)+ 自动启用 Dynamic Workflows + 尽量并行 + 多轮交叉验证。官方建议配合 auto mode 使用。用户体感:普通模式给"看起来做完其实潦草"的答案,ultracode 会自己拆成几十个子任务并行铺开、互相验证,给经过充分检验的结果。
3. **原生断点续跑 + 状态持久化**:因为状态存在脚本变量(不在主上下文),天然支持中断后从断点续跑(网络断/关机不影响)、进度实时可视化、任务保存与复用。

## 4.5 生产级技术细节(DEV/LayerZero 实测,已抓取)

脚本里的编排原语(primitives)和运行时行为:

- **原语**: `agent()`、`parallel()`、`pipeline()`、`phase()`;另可用标准 JS 的 JSON/Math/Array。
- **并发上限**: 每个 workflow `min(16, cpu_cores - 2)`(同时在飞的子 Agent 数)。
- **生命周期上限**: 每个 workflow 1000 个 agent——这是"防失控循环"的 backstop,不是常态规模。官方对常态规模的表述是"tens to hundreds"。"hundreds of parallel subagents"指总派发量(可给 pipeline 传 800 项全跑),上限是"同时在飞",不是"总数"。
- **`parallel()` vs `pipeline()`**: `parallel()` 是屏障(barrier),要等最慢的那个才返回;`pipeline()` 是流式的(streaming,非瀑布),每个 item 独立流过各阶段。对各维度耗时差异大的审查,pipeline 大约快 50-60% wall-clock,**而成本相同(agent 调用数一样),只是延迟变了**。
- **结构化输出**: `schema:` 强制子 Agent 调用 StructuredOutput 工具,校验发生在 tool-call 层,不用自己 `JSON.parse(try/catch)`。
- **预算共享**: 所有子 Agent 计入同一个 `budget.spent()`,父脚本可中途读取、动态收敛深度(scale down depth on the fly)。

**为什么 4.8 才能跑得起"上百子 Agent"(三个数字相乘,印证 E4 的 cache 论点)**:
1. **诚实度 ×4**: 单个子 Agent 误报率从 ~5% 降到 ~1%。fan-out 放大噪声——50 个 5% 误报的子 Agent 产出的是一堆垃圾;降到 1%,50 个产出的列表 15 分钟能读完。没有这个改进,上百子 Agent 只会放大 slop。
2. **工具调用效率 ×1.7**: 4.8 每任务用"meaningfully fewer steps";按 agent×phase 计费,200 个子 Agent 每个从 12 次工具调用降到 7 次,等于又便宜又快又更不易撞限流。
3. **mid-task 注入不破 cache(最关键)**: 4.7 及之前,长跑中途注入新 system 指令会让之前所有轮的 prompt cache 失效;4.8 改成中途注入 system 也不破 cache。于是跑一小时、父脚本根据子 Agent 返回不断注入新上下文的 workflow,还能保持原本只有一次性 prompt 才有的 cache 命中率。**没有这个改动,Dynamic Workflows 在成本上根本不可行。** —— 这正是 E4"cache 是 Harness 经济学基础设施"的又一铁证。

## 5. 适用场景(官方)

- 跨整个服务/仓库的 bug hunt、性能优化审计、安全审计(并行搜索 + 对每个发现独立验证,过滤误报)。
- 大规模迁移/现代化:框架替换、API 弃用、跨上千文件的语言移植,端到端。
- 高风险、需要"检查两遍"的工作:让 Claude 对同一问题做独立多次尝试,并用对抗性(adversarial)Agent 在结果到你手里之前先尝试推翻它。
- 官方示例 prompt:复现 1/50 概率的 flaky 测试并提出竞争性假设;挖最近 50 个会话里反复出现的更正、固化成 CLAUDE.md 规则;翻 Slack 半年事故找没建单的复发根因;从投资人/客户/竞品三视角撕扯商业计划;80 份简历排序并复核 top 10。

## 6. 已知局限(综合官方与社区)

- **成本高**:官方明确警告"can consume substantially more tokens than a typical session",建议先在小范围任务上试。
- 稳定性仍在研究预览阶段。
- 可视化体验社区反馈较弱。
- best practices 仍在发展中,适合复杂、高价值任务,不适合日常小改。

## 7. 对本系列(尤其 E2 / E5)的意义

- **回答了 E2 埋的"动态工作流"伏笔**:E2 提过"固定流程→动态编排是趋势,但越动态越需要硬约束兜底"。Dynamic Workflows 正是动态编排的当前最先进形态——而它的兜底,恰恰是"编排逻辑代码化 + 独立 Runtime + 状态隔离在脚本变量"。
- **是 E5 多 Agent 的"第四层"**:Subagent(最轻)→ Skills → Agent Teams → Dynamic Workflows(代码化编排,最重/最大规模)。它把 E5 讲的"协调者职责、决策权归属、上下文隔离"推到极致——协调者从"主 Agent 用上下文记账"升级成"一段代码 + 独立 Runtime"。
- **印证 E4 的核心论点**:之所以要把编排逻辑搬出主上下文,正是因为 E4 讲的"上下文窗口瓶颈 / context rot"——中间结果回灌主上下文会把主 Agent 喂坏。
- **呼应 E1"Harness > Model"与双核能力**:"A harness for every task"= 给每个任务即时定制一套 harness,是 Harness 工程的极致体现;PM 的架构设计能力在这里 = 设计"哪些编排该代码化、状态怎么隔离、何时该上 workflow"。
- **演进脉络(SimonAKing)**:推理代码化(CoT→PAL/PoT,把计算外包给解释器)→ 行动代码化(Code as Policies)→ 工具调用代码化 → **编排代码化(Dynamic Workflows)**。AI 系统从"聊天范式"向"程序范式"转变的关键一步。

## 8. 相关页面

- [Prompt / Context / Harness 三层框架](../concepts/prompt-context-harness.md)
- [Harness Engineering](../concepts/harness-engineering.md)
- [Claude Code](./claude-code.md)
- [Agent Harness 设计范式演进](../timelines/agent-harness-design-evolution.md)

## 9. 待复核 / 待补抓

- 51CTO / DEV / 头条 / CSDN / 36氪 五篇中文社区分析,链接已收录,正文待后续抓取入 raw/(部分站点有反爬,可能需 wiki extractor 或手工补)。
- "并发 min(16, cpu_cores-2) / 生命周期上限 1000"来源已坐实(DEV/LayerZero 实测,已抓取入 raw);官方对常态规模表述为"tens to hundreds of parallel subagents",1000 是防失控 backstop。引用时区分"同时在飞"与"总派发量"。
- 51CTO/头条/CSDN/36氪反爬未抓到正文,链接已收录;DEV/Mervin/SimonAKing/两篇官方已抓取入 `raw/community-posts/dynamic-workflows/`。
