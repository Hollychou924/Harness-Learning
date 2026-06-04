# E3｜工具系统与 MCP:给 Agent 一把钥匙,还是一串钥匙

> 状态:🥚 未开始 · 字数目标:3000-5000
> JD 锚点:Tool Use / **MCP**

## 本章要回答的真实问题

1. **Q1:同一个外部能力,做成 Function Call、MCP 工具、Skill,还是插件?决策依据?** — 场景:每个 Agent 项目必做的架构决策。FC=单次调用 / MCP=标准化协议 / Skill=可复用工作流 / 插件=带 UI 交互。
2. **Q2:给 Agent 工具权限要遵循什么原则?给多了有什么真实风险?** — 场景:能写库的可能误删生产数据,能跑代码的可能造成事故。工具=生产资源的对外授权点。
3. **Q3:工具越来越多,Agent 选错或不知道用哪个,怎么解决?** — 场景:渐进式披露(Progressive Disclosure)——按需加载而非全量挂载。触发逻辑怎么设计?
4. **Q4:工具调用失败,Agent 该怎么处理?重试几次合理?何时放弃?** — 场景:"错误路径就是主路径";无限重试把 4 亿 token 案例越搞越大。重试策略=指数退避+最大次数+熔断。
5. **Q5:MCP 接入新系统,最难的不是协议对接,是什么?** — 场景:反直觉结论——最难是"描述质量"(description 不准 Agent 就不知道何时用)和"权限治理"。

## 章节骨架

1. PM 钩子:为什么 Cursor 的"接受/拒绝"那么自然
2. 工具设计黄金法则:单一职责 / 清晰描述 / 结构化 IO
3. MCP:为什么 Anthropic 押注协议而非 SDK
4. 工具生命周期:注册 → 校验 → 执行 → 反馈
5. 三个生产级工具的设计示例

## 支撑素材(wiki 映射)

| 问题 | wiki 素材 |
|------|----------|
| Q1/Q3 | `concepts/progressive-disclosure.md`、`reports/portfolio/tool-ecosystem/report.md` |
| Q2/Q4/Q5 | `topics/tencent-cloud-developer-agent-harness-collection.md`(Tool Registry 9 项元信息)、`topics/agentway-harness-books.md`(原则 6) |
| Skill 封装 | `concepts/quest-mode-agent-development.md`、`compiled/qoder/` |

## 收尾检查清单(草稿待填)

- [ ] 四种封装方式是否给出了清晰的选择决策树
- [ ] 工具 description 是否给了"写好/写砸"的对照例子
