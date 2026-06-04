# E4｜上下文与记忆:一次对话 Agent 到底带着什么

> 状态:🥚 未开始 · 字数目标:6000-8000(承载架构图全部机制,可放宽)
> JD 锚点:**Memory** / **KV Cache** / Context
> 边界说明:本章是那张「上下文生命周期」架构图的**主场**——section 组装 / 四级 compact / KV cache / CLAUDE.md·MEMORY.md 注入全归这里。E5 只管"能力组织",不碰 compact/cache。

## 镇文之图

`assets/` 里的完整版架构图是本章主线。建议把它**拆成 4 个分图**逐段讲(否则一张图信息量太大,读者吃不下):
1. UserInput → Messages 累积 + 三源注入(CLAUDE.md/Skills/MEMORY.md)
2. System Prompt 的 static/dynamic section + Boundary
3. 四级 Compact 降级链 + Context token 预算
4. QueryModel 双 cache 断点 → 服务端三级 Cache

## 本章要回答的真实问题

1. **Q1:编码 IDE 怎么跨会话保持长久记忆?CLAUDE.md / MEMORY.md 怎么管才不失控?** — 场景:分层管理(稳定规则 vs 动态经验)+ 记忆如何从会话积累变成可复用 Skill。
2. **Q2:上下文窗口快满了,压缩哪些、保留哪些?有没有系统决策方法?** — 场景:最高频的工程挑战。三层分类:常驻 / 按需召回 / 可丢弃。腾讯云实测:正确卸载省 61% Token、成功率 +52%。
3. **Q3:四级 compact(MicroCompact→Snip→AutoCompact→Reactive)分别何时触发?Compact Buffer 怎么留?** — 场景:**这张图带出的硬核问题**——从轻到重的降级泄压链,以及为什么要预留 buffer 让压缩有空间执行。
4. **Q4:static/dynamic section 边界怎么定?它怎么决定 KV cache 命中率和成本?** — 场景:**图的点睛**——section 切分不是为代码整洁,是为缓存复用;稳定前缀能命中 cache,边界后放每轮变化内容。
5. **Q5:多用户/多 Agent 的记忆怎么隔离?Agent 自己总结的"经验"可信吗?** — 场景:记忆隔离作用域 + 记忆投毒(Memory Poisoning)——不一定是攻击,也可能是 Agent 压缩时错误归纳。淘宝闪购 Tair:并发下记忆延迟 5ms→50ms、在途请求膨胀 10 倍。

## 支撑素材(wiki 映射)

| 问题 | wiki 素材 |
|------|----------|
| Q1/Q4 | `concepts/prompt-context-harness.md`、`reports/portfolio/context-engineering/report.md` |
| Q2/Q3 | `reports/portfolio/cache-strategy/report.md`、本章架构图 |
| Q1 记忆分层 | `topics/agentway-harness-books.md`(book2 CLAUDE.md 分层)、`topics/tencent-cloud-developer-agent-harness-collection.md`(Skill 自训练) |
| Q5 | `topics/aws-cloud-developer-agentic-ai-playbook.md`(Memory Poisoning)、`topics/aliyun-cloud-developer-agent-collection.md`(淘宝闪购 Tair) |
| 竞品对比 | `entities/claude-code.md`(三层架构)、`entities/cursor.md`(Rules) |

## 是否需要拆子章节?

本章是 9 章里**信息密度最高**的。若 6000-8000 字仍写不下,优先把 **Q3+Q4(compact + cache 这套运行时机制)**拆成 E4b,因为它最硬核、最能体现"我真的懂"。先按单章写,撑不住再拆。

## 收尾检查清单(草稿待填)

- [ ] 四级 compact 是否给了"哪种场景触发哪一级"的判断表
- [ ] cache 三级 TTL 是否讲清了对成本的实际影响
- [ ] 记忆隔离是否给了 MVP 阶段就该做的设计清单
