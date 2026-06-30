# E3 详细大纲｜工具系统与 MCP:给 Agent 一把钥匙,还是一串钥匙

> 动笔前的大纲。先谈定再进 `drafts/`。
> 定位:接 E1 手电筒案例。工具一多,怎么还能调得对、快、安全。
> 暗线:工具不是 API 列表,是一套"能力资产管理系统"。
> 字数:不限,讲透为准。风格承接 E1/E2:每节"场景→反例→怎么破→一句判断"。

---

## 本文回答这些问题
1. 同一个外部能力,做成 Function Call、MCP、Skill 还是插件?怎么选?
2. 工具越来越多,Agent 选错或不知道用哪个,怎么办?
3. 怎么把一个工具"造好"?(粒度/命名/description/参数/输出)
4. 工具调用失败,重试几次?何时放弃?
5. 给 Agent 工具=给一把权限钥匙,怎么治理?MCP 接入怎么不裸奔?

---

## 0. 钩子:回到手电筒(约 400 字)
- 接 E1:让手机 Agent"打开手电筒",几百个工具里选不对、几十轮还失败。不是模型不会中文,是工具系统没被设计成"Agent 可理解、可选择、可安全执行"的能力结构。
- 立论 + 暗线:工具不是把后端 API 原样接上去,而是把外部世界重新整理成 Agent 能理解、能选、能执行、能失败恢复、能治理的**能力资产**。E3 就讲这套能力资产怎么造、怎么选、怎么管。

## 1. 四种外壳怎么选:FC / MCP / Skill / 插件(约 900 字)= Q1
- 四种封装一句话定位:Function Call=单次调用 / MCP=标准化协议(USB-C 类比)/ Skill=可复用工作流 / 插件=带 UI 交互。
- **决策树**(给可抄):一次性简单调用→FC;要跨产品复用/接生态→MCP;固定多步流程沉淀→Skill;需要用户界面交互→插件。
- 判断:别为了用 MCP 而 MCP;外壳是手段,核心是"这个能力 Agent 怎么用得对"。
- 引 `concepts/progressive-disclosure.md`(五类正交扩展点)、MCP USB-C 类比(`topics/tencent-*`)。

## 2. 工具一多选不对怎么办:渐进式披露 + Tool Router(约 1000 字)= Q2
- **场景**:手电筒案例的正解。工具几百个,全塞进上下文→塞满+模型选择成本爆炸。
- **解法一:渐进式披露(两层加载)**:第一层只给名称+简短描述(判断要不要);命中了再读完整说明(SKILL.md / 工具详情)。Anthropic 亲述演进:早期 RAG 预索引喂 context → 给 Grep 工具让 Agent 自己找 → Agent Skills 形式化渐进式披露 → 用 subagent 在独立上下文里搜文档、只回传答案,主上下文保持干净。
- **解法二:Tool Router(给 Agent 选工具像做检索)**:召回(先粗选相关工具)→排序(按相关度/历史质量)→裁剪(只把 top-N 给模型)→动态加载。把"选工具"当成一个推荐/检索问题来设计,而不是把所有工具一次性摊给模型。
- 判断:工具数量不是能力,可发现+可正确选择才是。**工具越多,越需要一个"工具的搜索引擎"。**
- 引 `concepts/progressive-disclosure.md`、`raw/official-posts/claude/undated-seeing-like-an-agent...md`、`2026-04-22-...with-mcp.md`(Cloudflare:search+execute 两工具覆盖约 2500 端点/约 1K token)。

## 3. 怎么把一个工具"造好"(约 1400 字,本章最干货)= Q3
- **① 粒度怎么切**:手电筒三方案——device_control(action,target)太粗易乱填 / set_flashlight(enabled) 中等抽象最好 / turn_on/turn_off 太细工具爆炸。Anthropic 框架:给 Agent "形状贴合它能力"的工具(纸/计算器/电脑的类比),不是越多越好,也不是一个 bash 包打天下。金句:**工具不是后端接口原样暴露,是给 Agent 重新设计过的语义化能力。**
- **② 命名/description 别打架**:5 个相似工具(open_flashlight/turn_on_torch/set_camera_light...)Agent 会懵。description 不是文案,是"工具选择器"的核心特征。
  - **写砸 vs 写好对照**(给可抄):写砸="打开或关闭设备功能"(太泛);写好=四要素(能做什么 / 何时用 / 何时别用 / 排除相似工具)。
- **③ 参数别让 Agent 猜**:自由文本 action/target 危险(模型填 "enable"/"torch mode");用 enum(state: on/off)、boolean(enabled: true)、JSON Schema 校验。判断:**能用 enum 就别让 Agent 自由发挥,能用 boolean 就别让它猜字符串。**(MCP 规范 inputSchema 佐证)
- **④ 工具输出太长怎么办**(你点名要):search 返回 100 文件、read_log 5 万行、DB 几千条、DOM 巨大——直接塞回模型上下文会爆、抓不住重点。**输出也要被设计:分层返回** summary(快速判断)/ structured_data(关键字段)/ evidence(原始证据片段)/ next_actions(建议下一步)/ raw_ref(原始结果引用,不直接塞满)。和 E2 不冲突:E2 讲循环消费,E3 讲输出格式怎么设计才好被消费。
- **⑤ dry-run/preview(把球传给 E6)**:读类工具可直接执行;删文件/发邮件/建 PR/装包等先 preview(dry_run / 返回 will_change+risk+preview),具体审批责任归 E6。
- 引 `raw/official-posts/claude/undated-seeing-like-an-agent...md`、`topics/agentway-harness-books.md`(工具是受管执行接口)。

## 4. 失败了怎么办:重试分类 + 熔断 + 幂等(约 900 字)= Q4
- **场景**:无限重试把 4 亿 token 越搞越大(呼应 E2)。"错误路径就是主路径"。
- **重试要分类(不是所有失败都重试)**:
  - 网络超时→有限重试;429→指数退避;参数错误→改参数不是盲重试;权限不足→转授权流程不重试;写操作超时→查状态不盲重试;破坏性操作失败→停止。
- **熔断**:同一工具连续失败/超时率过高→短时熔断,别让 Agent 反复空调。
- **写操作幂等(硬点)**:create_jira / send_email / charge_user / submit_order,超时重试可能重复创建/发两封/扣两次。判断:**读工具可放心重试,写工具不能盲重试;凡有副作用的工具,都要有幂等键 + 执行记录 + 重复调用保护。**
- 引 `topics/tencent-*`(失败处理不能让出错 Agent 自己定)、E2 呼应。

## 5. 工具=权限钥匙:Tool Registry + MCP 不裸奔(约 1100 字)= Q5
- **思维转变**:工具不是函数调用,是"生产资源的对外授权点"。给 Agent 一个工具=给它一把权限钥匙——能开几扇门、有没有时限、留不留痕、谁能审计,Day 1 就要想清。
- **Tool Registry 九项元信息**(给可抄):①名称 ②给 LLM 看的描述 ③输入 JSON Schema ④允许调用的 Agent 列表(RBAC)⑤超时与速率限制 ⑥风险等级(低/中/高)⑦是否需人工确认 ⑧输出结构 ⑨审计日志策略。**再加一句生命周期**:owner / 版本 / 状态(draft/beta/active/deprecated),工具会升级,description/参数/返回一变 Agent 行为就变。
- 原则:哪怕只有 3 个工具,也从第一天起强制走 Tool Registry。先有规矩,后扩规模。
- **MCP:标准化但不能裸奔**:MCP=工具界的 USB-C(一次实现,所有支持 MCP 的应用都能调)。但标准化≠安全。五条最佳实践:
  1. 永远别把 MCP Server 直接暴露给 Agent,必须过 Tool Registry。
  2. 每个 MCP Server 单独配额(流氓 server 不拖垮全局)。
  3. 白名单而非黑名单(暴露 50 个只开放业务要的几个)。
  4. 高风险工具走 Human-in-the-Loop(写/删/执行/支付)。
  5. 所有 MCP 调用打 Trace(来源/参数/结果/调用者可追溯)。
  - **annotations 默认不可信**(MCP 官方规范已核实):客户端必须把工具 annotation 当不可信,除非来自可信 server。
- **一句话点提示注入(边界)**:工具输出要当 data 不当 instruction,别把网页/邮件/issue 文本提升成系统指令;完整防护见 E6。
- 引 `topics/tencent-*`(九项、五条)、MCP 规范(annotations 不可信)、`entities/claude-code.md`(MCP 是生产系统边界治理)。

## 6. 拔高 + 自查表 + 下期预告(约 700 字)= 收尾
- **拔高(呼应 E1 双核)**:工具调用不是"给 Agent 多接几个 API"。真正的工具系统,是把外部世界整理成 Agent 能理解、能选、能执行、能失败恢复、能治理的**能力资产**。FC/MCP/Skill/插件只是外壳;核心是工具有没有被设计成清晰语义能力、有没有登记分级版本化、有没有明确输入输出/失败策略/副作用边界。**好的 Coding Agent harness,不是工具越多越强,而是工具越多越需要一套严密的 Tool Registry + Tool Router——工具系统体现的不是"接 API 能力",是架构设计能力。**
- **文末:工具系统自查清单**(收编 18 题精华,非问答形式,给可抄):
  - [ ] 工具是给 Agent 重新设计的语义能力,还是后端 API 原样暴露?
  - [ ] 每个工具 description 说清了"能做/何时用/何时别用"吗?相似工具区分开了吗?
  - [ ] 参数用 enum/schema 约束了吗,还是让 Agent 猜字符串?
  - [ ] 工具输出会不会撑爆上下文?有没有分层返回?
  - [ ] 写操作有幂等保护吗?失败重试分类了吗?该熔断会熔断吗?
  - [ ] 所有工具(含 MCP)都过 Tool Registry 了吗?九项元信息齐吗?
  - [ ] 高风险工具走人工确认了吗?MCP annotations 当不可信处理了吗?
  - [ ] (评估,详见 E8)选对工具率 / 参数合法率 / 无效调用率,看得到吗?
- **下期预告**:E4 上下文与记忆——工具能调对了,可"一次对话 Agent 到底带着什么、怎么不撑爆、怎么省 token、怎么跨会话记得住",是另一场硬仗。

---

## 配图清单
- [ ] 四种外壳选择决策树(第 1 节)
- [ ] Tool Router:召回→排序→裁剪→加载(第 2 节)
- [ ] 工具粒度三方案对比(手电筒,第 3 节)
- [ ] description 写砸 vs 写好对照(第 3 节)
- [ ] 工具输出分层返回结构(第 3 节)
- [ ] 重试分类表(第 4 节)
- [ ] Tool Registry 九项 + MCP 治理链路(第 5 节)
- [ ] 工具系统自查清单(第 6 节)

## 素材状态
- ✅ Anthropic 官方《Seeing like an agent》= 工具粒度/演进的权威一手(本地 wiki)。
- ✅ Cloudflare MCP 两工具覆盖 2500 端点/1K token = 粒度黄金案例(本地 wiki)。
- ✅ Tool Registry 九项、失败处理、MCP 五条 = 腾讯生产级 Multi-Agent 拆解(本地 wiki)。
- ✅ MCP annotations 不可信 = 官方规范,已联网核实。
- ⚠️ Anthropic define-tools / OpenAI Structured Outputs 网页本地区受限,改用本地官方文 + MCP inputSchema 佐证,不引点不开的链接。
- 🖊️ 可选一手观察:周浩用过的"工具描述烂导致乱调""MCP 接一堆反而更难用"例子,有则加分。

## v1 大纲修订记录(2026-06-07,吸收外部模型建议)
1. 保留 5 问 + 拔高,但每问加厚:Q2 加 Tool Router;Q3 加粒度/enum/输出分层;Q4 加幂等;Q5 加生命周期 + annotations 不可信。
2. 18 题问答清单不以问答形式出现,精华作为正文话题融入(粒度、命名打架、参数、输出太长、dry-run、幂等、版本化),并收编为文末自查清单。
3. 出处核实:MCP annotations 不可信(✅可引);Anthropic/OpenAI 网页受限(改用本地官方文+MCP 规范佐证)。
4. 守边界:权限审批/责任/提示注入→E6;循环消费→E2;Skill/Subagent→E5;完整评估→E8。
