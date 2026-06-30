# E3｜工具系统与 MCP:给 Agent 一把钥匙,还是一串钥匙

> 状态:✍️ 大纲已重排(5 问加厚 + 拔高) · 字数目标:不限,讲透为准(预计 6000-7000)
> JD 锚点:Tool Use / **MCP**
> 定位:接 E1 手电筒案例。E2 讲"循环怎么转、多 Agent 怎么编排不跑飞",E3 回到工具层——工具一多,怎么还能调得对、调得快、调得安全。
> 暗线:工具不是 API 列表,是一套"能力资产管理系统"。

## 本章要回答的真实问题(2026-06-07 吸收外部建议后加厚)

1. **Q1:同一个外部能力,做成 Function Call、MCP 工具、Skill,还是插件?决策依据?** — 架构决策。FC=单次调用 / MCP=标准化协议 / Skill=可复用工作流 / 插件=带 UI 交互。给决策树。
2. **Q2:工具越来越多,Agent 选错或不知道用哪个,怎么办?** — 接手电筒钩子。渐进式披露(按需加载)+ Tool Router(给 Agent 选工具像做检索:召回→排序→裁剪→动态加载)。Anthropic 官方:从 RAG 喂 context → 给 Grep 工具让 Agent 自己找 context。
3. **Q3:怎么把一个工具"造好"?** — 本章最干货。工具粒度(device_control vs set_flashlight)、语义化命名、description 四要素对照(能做/何时用/何时别用/排除相似工具)、enum/JSON Schema(别让 Agent 猜字符串)、工具输出太长怎么办(分层返回 summary/structured/evidence/raw_ref)。
4. **Q4:工具调用失败,Agent 该怎么处理?重试几次?何时放弃?** — 重试分类(网络超时可重试/429 退避/参数错改参数/权限不足转授权)+ 熔断 + 写操作幂等(不能盲重试,要 idempotency_key)。呼应 E2"该重试 vs 该熔断"。
5. **Q5:给 Agent 工具 = 给一把权限钥匙,怎么治理?MCP 接入怎么不裸奔?** — Tool Registry 九项元信息(+owner/版本/生命周期)+ MCP "标准化但不裸奔"五条 + annotations 默认不可信(MCP 官方规范)。纯权限审批/责任边界让给 E6。

> **拔高(收尾)**:工具系统 = 能力资产管理 = 架构设计能力的体现。工具越多,系统越需要一套严密的 Tool Registry + Tool Router。呼应 E1 双核。

## 阅读体验设计(承接 E1/E2)

1. **钩子接 E1 手电筒**:不是 Agent 不会开手电筒,是工具系统没被设计成"可理解、可选择、可安全执行"的能力结构。
2. **暗线贯穿**:每一问都回到"工具是能力资产,不是 API 列表"。
3. **每节固定节奏**:真实场景 → 反例 → 怎么破 → 一句可迁移判断。
4. **给可抄的东西**:封装决策树、description 写好/写砸对照、九项元信息清单、重试分类表、文末工具系统自查清单。

## 支撑素材(wiki 映射 + 已核实出处)

| 问题 | wiki / 出处 | 关键证据 |
|------|----------|---------|
| Q1/Q2 | `concepts/progressive-disclosure.md`、`raw/official-posts/claude/undated-seeing-like-an-agent-how-we-design-tools-in-claude-code.md` | 渐进式披露两层加载;Anthropic 亲述 RAG→Grep 工具→subagent 隔离 context 的演进 |
| Q2/Q3 | `raw/official-posts/claude/2026-04-22-building-agents-that-reach-production-systems-with-mcp.md` | Cloudflare MCP:search+execute 两个工具覆盖约 2500 端点、约 1K token(工具粒度黄金案例) |
| Q3 | `topics/agentway-harness-books.md`(工具是受管执行接口)、MCP 规范 inputSchema | enum/schema 约束输出 |
| Q4/Q5 | `raw/community-posts/tencent-cloud-developer/2026-05-13-从零设计生产级-Multi-Agent...md` | Tool Registry 九项元信息、失败处理不能让出错 Agent 自己定、MCP 不裸奔五条 |
| Q5 | MCP 官方规范 `modelcontextprotocol.io/specification/2025-06-18/server/tools`(已核实) | "clients MUST consider tool annotations to be untrusted unless from trusted servers" |

## 已核实的外部出处(2026-06-07 联网)

- ✅ MCP 规范:annotations 默认不可信、字段含 name/description/inputSchema/outputSchema/annotations。可放心引用。
- ⚠️ Anthropic define-tools 网页 / OpenAI Structured Outputs 网页:本地区有访问限制(region-unavailable / 403)。改用 wiki 本地 Anthropic 官方文佐证 description/工具设计;enum/schema 用 MCP 规范 inputSchema + 通用工程实践表述,不引读者点不开的链接。

## 边界划分(踢到后续章节,E3 不展开)

- 用户什么时候审批、谁负责、误操作责任归谁 → **E6 安全与权限**(E3 只讲 dry-run/preview 这个工具设计接口,把球传给 E6)
- 提示注入完整防护 → **E6**(E3 只一句:工具输出当 data 不当 instruction)
- 工具结果回灌进循环的循环逻辑 → **E2**(已讲;E3 只讲"输出格式怎么设计才好被循环消费")
- 工具链路完整量化评估体系 → **E8**(E3 文末自查表只给 2-3 个最相关指标)
- Skill 怎么写/怎么改、Subagent 怎么拆 → **E5**

## 收尾检查清单(草稿待填)

- [ ] 四种封装方式是否给出了清晰的选择决策树
- [ ] 工具 description 是否给了"写好/写砸"的对照例子
- [ ] 工具粒度是否用手电筒三方案讲清了
- [ ] 工具输出太长是否给了分层返回方案
- [ ] 重试是否分了类(可重试/退避/改参/转授权/写操作查状态)
- [ ] Tool Registry 九项 + MCP 不裸奔是否落地
- [ ] 拔高是否把工具系统呼应回 E1 架构设计能力
