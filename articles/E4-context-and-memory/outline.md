# E4 详细大纲｜上下文与记忆:一次对话 Agent 到底带着什么

> 动笔前的大纲。先谈定再进 `drafts/`。
> 定位:全系列信息密度最高、最该"写重"的一章。镇文图(v2 七区块版)主场。
> JD 锚点:Memory / KV Cache / Context Engineering / Compaction。
> 字数:不限,讲透为准(预计 8000-10000)。风格承接 E1-E3:每节"场景→反例→怎么破→一句判断"。
> 结构:上半场(上下文窗口怎么装,Q1-Q5)+ 下半场(长期记忆怎么管,Q6)。

---

## 本文回答这些问题
**上半场 · 上下文窗口怎么装**
1. 一次对话,Agent 到底带着哪些东西?
2. 上下文不是越多越好,怎么决定"带什么、不带什么"?
3. 上下文快满了,压缩谁、保留谁、丢弃谁?
4. 四级 compact 怎么触发?为什么要留 Compact Buffer?
5. static/dynamic section 怎么切?为什么决定 cache 命中率和成本?
**下半场 · 长期记忆怎么管**
6. 跨会话怎么记住?记忆怎么写入、召回、更新、隔离、遗忘、防投毒?

---

## 0. 开篇:四个概念别混 + 钩子(约 700 字)

- 承接 E3:工具调得对,只说明 Agent 有手有脚;上下文和记忆管得好,才说明它有脑子。
- **钩子**:为什么同一个 Agent,刚开始很聪明,跑了几十轮后开始忘约束、乱调用、变贵、变慢,甚至把错误经验记到下次?——不是它忘性大,是信息架构没设计好。
- **四概念辨析表(开篇定调,防混淆)**:

  | 概念 | 本质 | 解决什么 | 典型错误 |
  |---|---|---|---|
  | Context 上下文 | 本轮模型能看到的信息 | 让模型这一轮答对 | 什么都塞进去 |
  | Memory 记忆 | 跨会话保留的信息 | 让下次还能接着做 | 什么都永久记住 |
  | Cache 缓存 | 复用已算过的前缀 KV | 降成本和延迟 | 动态内容放前面导致 miss |
  | Compact 压缩 | 把长上下文变短 | 防窗口爆掉 | 压掉关键约束和证据 |

  一句话:**上下文决定这一轮看见什么;记忆决定下次还记得什么;缓存决定重复内容要不要重算;压缩决定窗口满了怎么活下来。**
- 出处:Anthropic CC memory 文档明确把 CLAUDE.md(人写持久指令)和自动记忆(Claude 自写学习)分成两套互补机制,且都作为"上下文"加载——印证 Context/Memory 是两层。

---

# 上半场 · 上下文窗口怎么装

## 1. 一次对话带着什么:Context Stack(约 1400 字)= Q1

- **拆镇文图 §2 + §6A**:发给模型的完整请求体 = system(系统提示词)+ tools(工具定义)+ messages(消息历史)。
- **讲成 Context Stack(分层 + 稳定性 + 风险)**:

  | 层级 | 内容 | 稳定性 | 风险 |
  |---|---|---|---|
  | System Prompt | 角色、边界、基础规则(Intro/System/Tasks/Actions) | 高(静态区) | 太长挤占预算 |
  | Tools 工具定义 | input_schema 等;占 token、影响预算 | 中 | 工具多→选不对(见 E3) |
  | Rules / 三源注入 | CLAUDE.md(基础规范)+ Skills/Plugins(能力)+ MEMORY.md(长期记忆) | 中 | 全量静态注入、不按任务剔除 |
  | Messages 历史 | user+assistant 关键消息;过滤低价值/冗余 | 低(动态区) | 单调增长→撑爆 |
  | Repo / 检索片段 | 按需读入的代码/文档 | 低 | 读很多但没读对 |
  | Tool Results | 工具返回(可能超长) | 低 | 污染上下文(见 E3 分层返回) |
- **静态区 vs 动态区 + Boundary**(镇文图 §6A):静态区(Intro/System/Tasks/Actions,≈7 个)更稳→适合缓存命中;动态区(Session/Memory/Env,≥8 个)变化多。Boundary 是这两区的分界——埋 Q5 cache 伏笔。
- 出处:Anthropic"每个 session 从空白上下文窗口开始,两套机制跨会话带知识:CLAUDE.md / 自动记忆"。

## 2. 不是越多越好,怎么"选"上下文(约 1300 字)= Q2【新增 · 第一性问题】

- **核心判断**:真实产品最难的不是压缩,是压缩之前的判断——**这一轮到底该带什么?压缩是泄压手段,选择才是第一性问题。**
- **三种选择机制(从被动到主动)**:
  - 条件加载(Cursor `.cursor/rules/*.mdc` 的 glob 触发):规则按文件类型触发,未命中不进 prompt——"懒加载式选择"。局限:只能按文件 glob,不能按任务语义。
  - 渐进式披露(Skills 两层):先给名称+描述,命中再读全文(承接 E3)。
  - Agent 自己找(RAG→Grep):早期 RAG 预索引"喂"context;后来给 Agent Grep 工具让它自己搜、自己建 context;再用子 Agent 在独立上下文搜文档、只回传答案,主上下文保持干净。
- **选择 = 排序 + 优先级**:相关性、新鲜度、来源可信度、token 预算,几个维度给上下文排序,只带 top 的。
- **一句判断**:**带得多不等于带得对。上下文工程第一步不是"塞",是"选"——按任务语义决定这一轮让模型看见什么。**
- 引 `reports/portfolio/context-engineering/report.md`(六路径)、`concepts/progressive-disclosure.md`、`topics/tencent-*`(RAG 已死/Grep 回归)。

## 3. 窗口快满了:压谁、留谁、丢谁(约 1200 字)= Q3

- **三层分类(给可抄)**:

  | 类别 | 处理 | 例子 |
  |---|---|---|
  | 常驻(必须保留) | 永不压 | 系统规则、关键约束、当前任务目标 |
  | 按需召回 | 压成引用,要用再取 | 历史对话、读过的文件、检索片段 |
  | 可丢弃 | 直接删 | 过期 tool result、冗余/低价值消息 |
- **真实数字**:腾讯云 Agent Memory 实践——正确把上下文"卸载"(offload 到外部),**省 61% Token、成功率 +52%**。Manus 把易变内容(observation/长文件)下沉到文件系统当外部记忆,避免污染前缀。
- **一句判断**:压缩不是"无脑砍长度",是按"常驻/按需/可丢弃"分类后,只动后两类,永远不碰常驻的关键约束。
- 引 `topics/tencent-*`(省 61%/+52%)、`reports/portfolio/cache-strategy/report.md`(Manus 文件 offload)。

## 4. 四级 Compact:讲成 checkpoint 泄压链(约 1300 字)= Q4【硬核】

- **拆镇文图 §5 + §4**。先纠偏:**compact 不是"做总结",是"泄压保命 + 保留关键状态"的 checkpoint。**
- **四级降级链(从轻到重,给触发判断表)**:

  | 级别 | 程度 | 动作 | 何时触发 |
  |---|---|---|---|
  | ① MicroCompact | 轻 | 移除过期 Tool Result / 低价值结果 | 轻微超量,先清垃圾 |
  | ② Snip | 中轻 | 删冗余消息 / 低价值消息 | 还超,删可丢弃的 |
  | ③ AutoCompact | 中重 | 对历史对话做摘要、保留必要状态 | 仍超,把中间大量消息归纳成 Summary |
  | ④ Reactive Compact | 重 | 熔断式压缩,超长时兜底保留核心信息 | prompt too long,最后防线 |
- **Compact Buffer(镇文图 §4 token 预算公式)**:总 tokens ≈ 历史上下文 + 新增消息 + 下次返回预留 + Buffer。Buffer 是"给后续续期预留的安全余量"——**留 buffer 是为了让压缩有空间执行**,不是浪费。压完重新计算 Context,若仍超长继续升级压缩(§5 那条回流虚线)。
- **真实痛点(出处)**:Anthropic 官方 troubleshoot 列了"Instructions seem lost after /compact"——压缩会把关键约束压没,这正是为什么常驻类(Q3)不能进压缩、且 compact 要保留状态而非纯摘要。
- **一句判断**:好的 compact 是分级泄压的 checkpoint,从清垃圾到摘要到熔断,逐级降级;关键约束永远在常驻区,不被压掉。

## 5. section 切分 → cache 命中率:讲成 prompt 架构(约 1500 字)= Q5【经济学基础】

- 先纠偏:**cache 不是服务端优化,是 prompt 架构设计。** 拆镇文图 §1 + §2。
- **为什么 cache 是 Harness 的经济学基础设施**:coding agent 单次请求 = system(5k-20k)+ 工具定义(2k-10k)+ 历史(变长)+ 当前消息,前两段 session 内不变 = 教科书级 prefix-stable workload;一个任务 20-50 轮,每轮重发完整上下文,没 cache = system prompt 重传 50 次。
- **section 怎么切决定命中率**:稳定内容(system/tools/项目规则)放前面、放静态区,缓存标记落在稳定片段末尾;动态内容(session/env/时间戳/随机 ID/临时状态)放后面、放动态区。Boundary 切对了,稳定前缀就能命中 cache。
- **五产品 cache 横评(给可抄表)**:Claude Code(显式 cache_control breakpoint,90% 折扣,命中 85-92%)/ Codex(自动前缀,50% 折扣,零配置)/ Cursor(透传上游,@-mention 重排是隐形 miss 来源)/ Manus(应用层 KV + 文件 offload,append-only/stable tool ordering/masked tool selection 三原则,前缀近 100%)/ Hermes(N/A)。
- **真实数字**:命中率 85-92%;盈亏平衡点 2-3 turn,之后每轮省 ~80%;Manus file offload 把 50k+ token 压到 5k 级、单任务成本降到 1/10。
- **cache × compact 冲突(亮点)**:compact 会改变上下文内容,可能破坏原本可复用的稳定前缀,导致 cache miss——**cache 要稳定、compact 要动态泄压,二者天然矛盾。** 解法:把稳定 section 和动态 compact state 分开,别让 compact 污染稳定前缀(镇文图把 static section 和 Compact Buffer 分区,正是这个设计)。
- **一句判断**:cache 命中率是 fixed-price Agent 产品的生死线(命中率 60%→85%,毛利可能 -10%→+40%)。它不是后端调参,是 PM 设计 prompt 架构时就要定的"哪些放前面、哪些放后面、Boundary 切在哪"。
- 引 `reports/portfolio/cache-strategy/report.md`(五产品横评、命中率、盈亏点、Manus 三原则、Cursor 隐形 miss)。

---

# 下半场 · 长期记忆怎么管

## 6. 记忆生命周期:写入/召回/更新/隔离/遗忘/防投毒(约 1600 字)= Q6

- 先纠偏:**memory 不是存储方案,是生命周期管理。** 拆镇文图 §6A 的 MEMORY.md。
- **两套机制(Anthropic 官方)**:CLAUDE.md = 人写的持久指令;Auto memory = Claude 根据你的更正/偏好自己写的笔记。每个 session 从空白上下文开始,这两套负责跨会话带知识。自动记忆需 workspace trust 门控(与 hooks 同一道门),有 MEMORY.md entrypoint。
- **记忆分层(三层,真实工程)**:短期(秒级响应,Tair 路线)/ 中期(语义召回,Mem0 路线)/ 长期(持久化与索引,Tablestore 路线)。**不能一把 KV 通用。** 淘宝闪购 Tair 短期记忆:并发下记忆延迟 5ms→50ms、在途请求膨胀 10 倍——记忆系统的工程坑。
- **生命周期六环**:
  - **写入**:什么该进长期记忆——稳定偏好、反复出现的项目规则、经确认的事实、架构决策、禁止事项;不该进——临时任务细节、未验证猜测、敏感信息、外部网页指令、一次性状态。
  - **召回**:按相关性/scope 取,不是全量塞。
  - **更新**:新事实覆盖旧的、版本化。
  - **隔离(给可抄表)**:按 scope(user/project/repo/task/agent)、按可信度(human-authored / system-generated / agent-inferred / external-imported)分。
  - **遗忘**:TTL、用户删除、低频降权、被覆盖、失效标记、tombstone 防旧记忆复活。
  - **防投毒**:OWASP Agent Memory Guard 定义 memory poisoning = 持久记忆被污染→失准/数据外泄。防护:外部内容默认不直接写长期记忆;写入前安全扫描;每条记忆记 source + trust level;区分 data 和 instruction;高风险记忆需审批(完整提示注入防护见 E6)。
- **关键判断**:**Agent 自己写的记忆默认不可信**——应低初始置信度、来源标记、可审计、可删除,必要时人工/系统确认。
- **一句判断**:记忆决定 Agent 下一轮"越做越聪明还是越做越脏"。没有生命周期管理的记忆,迟早把错误经验、投毒指令、过期事实越攒越多。
- 引 `topics/aliyun-*`(Tair/Mem0/Tablestore、淘宝闪购)、`topics/aws-*`(记忆投毒 OWASP ASI)、OWASP Agent Memory Guard(已核实)、Anthropic CC memory(已核实)。

---

## 7. 拔高 + 自查表 + 下期预告(约 700 字)

- **拔高(呼应 E1 双核)**:E4 表面讲上下文和记忆,实际讲的是 **Agent 的信息架构**——它的"信息操作系统"。
  - 不成熟的 harness 把所有东西都塞进 prompt;成熟的 harness 把信息分成常驻 / 按需 / 可丢弃 / 可缓存 / 可记忆 / 必须隔离。
  - 架构设计能力在这里 = section 切分、Boundary 怎么定、记忆怎么分层隔离(这些都是为缓存/成本/可靠性做的架构决策)。
  - 评估能力在这里 = 用 cache 命中率、token 成本、压缩后是否丢约束来量这套信息架构好不好。
  - 一句话:**上下文与记忆不是模型能力的附属品,而是 AI Agent harness 的信息操作系统。** 上下文管理决定这一轮做不做得对,记忆管理决定下一轮越做越聪明还是越做越脏,cache 和 compact 决定这套系统能不能在真实成本下长期跑。
- **文末:上下文与记忆自查清单**(收编 17 题精华,非问答):
  - [ ] 这一轮该带什么上下文,是按任务语义"选"的,还是无脑全塞?
  - [ ] 关键约束在常驻区吗?会不会被 compact 压没?
  - [ ] compact 是分级 checkpoint 泄压,还是一刀切做摘要?
  - [ ] 稳定内容放前面、动态内容放后面了吗?Boundary 切在哪?
  - [ ] compact 会不会污染稳定前缀、打掉 cache?稳定 section 和动态 compact state 分开了吗?
  - [ ] cache 命中率、token 成本看得见吗?(详见 E8)
  - [ ] 什么该写入长期记忆、什么不该?Agent 自写记忆当不可信处理了吗?
  - [ ] 记忆有 scope 隔离、来源/可信度标记、TTL/遗忘机制吗?外部内容会不会投毒?
- **下期预告**:E5 能力的组织——上下文和记忆理顺了,可"能力多了、任务大了怎么拆":Skills、Subagent、Multi-Agent,以及该不该拆、拆几个。

---

## 配图清单(均从镇文图 v2 拆分)

- [ ] 分图1:请求体构成 + 三源注入(§2+§6A,第 1 节)
- [ ] 分图2:token 预算公式 + Compact Buffer(§4,第 4 节)
- [ ] 分图3:四级 Compact 降级链(§5,第 4 节)
- [ ] 分图4:三级缓存 + 静态/动态区 Boundary(§1+§2,第 5 节)
- [ ] 四概念辨析表(开篇)/ 三层分类表(第3节)/ 五产品 cache 横评表(第5节)/ 记忆隔离表(第6节)/ 自查清单(收尾)

## 素材状态

- ✅ 镇文图升级为 v2 七区块版(更清晰、术语更准):四级 compact 程度+动作、token 预算公式+Compact Buffer、三级缓存、静态/动态区 Boundary 全标注。
- ✅ cache-strategy 报告:五产品横评、命中率、盈亏点、Manus 三原则、Cursor 隐形 miss、cache×compact 冲突。
- ✅ context-engineering 报告:六路径、CLAUDE.md 三层、各家 compaction。
- ✅ 腾讯省 61%/+52%、淘宝 Tair 5ms→50ms、记忆三层 Tair/Mem0/Tablestore。
- ✅ 已核实出处:OWASP Agent Memory Guard、Anthropic CC memory(CLAUDE.md vs 自动记忆、/compact 丢指令痛点)。
- ⚠️ 需周浩把 v2 新图存到 `assets/context-lifecycle-architecture-v2.jpg`。
- 🖊️ 可选一手观察:周浩用过的"Agent 跑久了忘约束/变贵/记错经验"真实例子,有则放开篇或第4节。

## v2 大纲修订记录(2026-06-07,吸收外部建议)
1. 5 问→6 问:新增 Q2"上下文选择"(压缩是泄压、选择是第一性)。
2. 四纠偏:compact=checkpoint(非摘要)、cache=prompt 架构(非服务端优化)、memory=生命周期(非存储)、上下文=Context Stack(非清单)。
3. 开篇加四概念辨析表;上下半场结构;Q5 加 cache×compact 冲突亮点;Q6 升级为记忆生命周期六环。
4. 镇文图换 v2 七区块版;17 题问答不写成问答,精华融入正文 + 收成文末自查表。
5. 出处核实:OWASP Agent Memory Guard ✅、Anthropic CC memory ✅;OpenAI prompt-caching 页 403 改用本地报告引用。
