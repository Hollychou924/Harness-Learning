# 小蓝鲸 · 嵌套自进化 Agent 架构终稿

> 状态：架构终稿（2026-07-12）  
> 性质：定义「真正能自己循环的自进化 Agent」——**用一种循环优化另一种循环**，并**反思当前的反思机制**。  
> 适用：desktop-agent / mobile-agent 共用 Loop Spec；实现时不得违背 01 设计基线（7 步宏观 + ReAct 微观）与 00 架构反思约定。  
> 实践锚点：车控必过集生成器（vehicle-bvt-generator）已验证的离线 Loop / 在线复用 / 元反思 / 回测机制。  
> 行业锚点：Meta-Harness、The Last Harness（Harness Evolution + Meta-Evolution）、Pioneer Agent、momo-code 双速进化、翁荔 Harness Engineering、Verification Paradox / Echo Trap。

---

## 〇、一句话定义

**自进化不是让模型在对话里多「想两遍」，而是：**

1. **外环修改内环的约定着陆点**（策略、规则、Harness、经验库），使下次内环更强；  
2. **元环审计「反思/评估/修复」本身是否失效**，必要时改主 Loop 的规则；  
3. **评估器永远活在环外**，用客观证据验收，并用回测防止退化。

车控项目已证明：雨刮 16 轮、座椅 41 轮后，后续 27 个模块中 20 个一次通过——**离线攒经验、在线复用**才是「越用越聪明」的工程形态。

---

## 一、两条不可妥协的原则

### 原则 P1：用一种循环优化另一种循环

| 合法 | 非法 |
|------|------|
| 外环读内环的完整 traces，写入内环的可写面（Tactic / Skill / Harness 配置 / 生成规则） | 在同一个 while 里无限叠加 LLM 自评 |
| 离线 Loop 优化在线一次生成的成功率 | 用户每次任务默认跑几十轮进化 |
| 元反思产出「主 Loop 规则变更」 | 元反思只写感想、不改规则 |

形式化：

```text
Outer.optimize(Inner) :=
  read  : EvidenceStore(Inner.traces)     // 完整过程，不是一句摘要
  write : WritableSurface(Inner)          // 只改约定着陆点
  gate  : ExternalEvaluator ∉ Outer       // 评估器不在外环利益链内
  abort : Ratchet + Rollback + 黄金集回测
```

### 原则 P2：反思「反思机制」本身

行业已证明：同模型自批评常是 **Verifier Redundancy**（批判≠验证）、**Echo Trap**（复读旧结论）、**Fluent Reflection No Correction**（说得漂亮但不纠错）、**Reflection Theater**（多花钱不前进）。

因此必须：

```text
Critique ≠ Verify ≠ Reflect-on-Reflection
（生成批评） （外部判定） （审计批评/评估是否有用）
```

车控对应物：`reflection_protocol.md` + `check_meta_reflection.py`——每 5 个版本强制元反思；反思从「建议」变为「门禁」。

---

## 二、同构映射：车控 Loop ↔ Agent Loop

| 车控必过集（已验证） | 小蓝鲸 Agent | 优化关系 |
|----------------------|--------------|----------|
| `generate_bvt.py` / 16 维生成 | **L0 Task Loop**（react / AgentRuntime） | 干活 |
| `eval_bvt.py` 9 维 + 线上数据 | **Verifier（环外）** | 评 L0 |
| 一轮 Loop：生成→打分→gap→修复→再打分 | **L1 Experience Loop** | 优化 L0 的 Tactic/Skill/规则 |
| `failure_cases` + `gap_pattern_library` | **经验资产库** | 加速 L1 修复 |
| `SKILL.md` / `device_rules` / semantic_index | **Harness 可写面** | L1/L2 着陆点 |
| 离线逐模块 Loop / 在线一次生成 | **Offline Evolve / Online Serve** | 离线环优化在线环 |
| 元反思（每 5 版）+ 10 项清单 | **L2 Meta-Reflection / ReflectionGovernor** | 优化主 Loop 与 Critic 策略 |
| 回测雨刮 | **黄金任务集 Ratchet** | 防「修 A 坏 B」 |

**结论：不要另发明哲学；把 BVT-Loop 操作系统迁到 Task/Harness 即可。**

---

## 三、目标架构：嵌套四环

```text
┌─────────────────────────────────────────────────────────────┐
│ L3 Meta-Evolution（可选·跨任务族·后期）                      │
│ 优化对象：进化蓝图 Λ = (Worker, H₀, Verifier, Evolver, Gov)   │
│ 产出：主 Loop / 元反思协议的结构性变更                         │
└──────────────────────────┬──────────────────────────────────┘
                           │ 改「怎么进化」
┌──────────────────────────▼──────────────────────────────────┐
│ L2 Harness Evolution + Meta-Reflection（跨会话·小时~天）     │
│ 优化对象：Harness H、Critic 策略、评分维、强制检查清单         │
│ 触发：每 N 个版本 / 主 Loop 效率下降 / 人工发起                │
└──────────────────────────┬──────────────────────────────────┘
                           │ 改「怎么执行 / 怎么反思」
┌──────────────────────────▼──────────────────────────────────┐
│ L1 Experience Loop（任务结束或失败触发·秒~分）                │
│ Observe → Distill → Match Pattern → Fix → Retest → Solidify │
│ 优化对象：Tactic / Skill / 场景规则 / gap 模板命中率           │
└──────────────────────────┬──────────────────────────────────┘
                           │ 注入 / 更新规则
┌──────────────────────────▼──────────────────────────────────┐
│ L0 Task Loop（单任务·现有引擎）                               │
│ 7 步宏观骨架 + ReAct 微观；可选 Critic（仅失败+有证据）        │
│ 优化对象：当前任务状态（消息、工具结果、产物）                 │
└─────────────────────────────────────────────────────────────┘

横切（所有环共享，不可各自为政）：
  Evidence Store · Verifier · LoopGuard · HITL Gate · Interrupt · Trace(Turn/Item)
```

### 3.1 环间优化矩阵（P1 验收表）

| 外环 ↓ / 内环 → | L0 | L1 | L2 |
|-----------------|----|----|-----|
| **L1** | 注入 Tactic；更新失败约束 | — | — |
| **L2** | 改审批/压缩/Review 开关/工具策略 | 改蒸馏规则、pattern 库、强制清单 | — |
| **L3** | （间接） | （间接） | 改进化蓝图 Λ |

任意「外环写内环」若越权（例如 L1 直接改生产安全黑名单），视为架构违规。

---

## 四、双阶段运行模型（离线 / 在线）

### 4.1 离线 Evolve（实验室 / 夜间批跑）

对应车控「逐功能模块跑 Loop」：

- 对**任务族**（如：改 Python 项目加日志、整理多源报告、车控某 device）反复：执行→打分→按 pattern 修→回测。  
- 沉淀：`failure_cases`、`gap_patterns`、`tactics`、`harness_candidates`。  
- 允许多轮（对标座椅 41 轮）；**不在用户前台会话里跑。**

### 4.2 在线 Serve（用户真任务）

对应车控「读 SKILL + 经验库一次生成」：

- 默认：**一次高质量执行**（经验复用后「一次通过」）。  
- 仅当 Verifier 失败或分数阈值时，触发**短 L1**（有界轮数，如 ≤3）。  
- 成功路径写入经验；失败路径进离线队列加深进化。

### 4.3 产品口径

> 用户感到的是「越用越稳、越少确认」；  
> 工程感到的是「离线 Loop 在涨经验库，在线命中率在升」。  
> **禁止把 41 轮进化暴露成用户等待。**

---

## 五、L0 Task Loop（内环·干活）

### 5.1 定位

沿用 01：**7 步宏观 + 第 4 步内嵌 ReAct**。desktop=`react.ts`；mobile=`AgentRuntime`（Goal/Act/Review 需按本终稿降级 Review）。

### 5.2 与进化的接口

| 输入（被优化后的） | 输出（供外环消费） |
|--------------------|--------------------|
| System prompt + 注入的 Top-K Tactic | Turn/Item 事件流 |
| 生效中的 Harness 版本号 | 工具结果、审批/拒绝、用户接管点 |
| Task Tier（T0/T1/T2） | 结构化 signals（见 6.2） |

### 5.3 Task Tier（防 LLM 税）

| Tier | 何时 | Goal 结构化 | Critic | L1 触发 |
|------|------|-------------|--------|--------|
| T0 | 简单问答 | 否 | 关 | 否 |
| T1 | 常规任务 | 可选 | 仅 Verifier 失败 | 失败时短环 |
| T2 | 复杂长程 | 是 | 计划点 + 失败点 | 结束后完整 Distill |

---

## 六、Verifier：环外评估器（命门）

### 6.1 设计铁律

> **写的和验的必须分开。**  
> Critic / Actor 不得宣布最终 pass；只有 Verifier（及 Ratchet）能放行。

对应车控：`eval_bvt.py` 不参与生成；线上注入默认可关（防作弊）。

### 6.2 信号优先级（客观 > 主观）

| 优先级 | 信号类型 | 示例 |
|--------|----------|------|
| P0 免费客观 | 测试/编译/lint exit code、文件 diff 校验、schema 校验 | 对标 bash/tsc |
| P0 人机 | 用户拒绝、审批拒绝、显式纠错、接管点 | 对标人工修正 |
| P1 产品规则 | 权限黑名单命中、越界检测、对称性（有开有关） | 对标 boundary/symmetry |
| P1 线上/回流 | 同类任务失败率、用户重试率（可选） | 对标 Kyuubi 高频覆盖 |
| P2 弱信号 | LLM-as-judge（仅辅助，不可单独放行） | 慎用 |

### 6.3 Agent 侧评分维（一期最小集）

对标车控 9 维，压缩为可落地的 6 维（可扩展）：

| 维 | 含义 | 权重建议 |
|----|------|----------|
| 目标达成 | 验收标准是否满足 | 25% |
| 回归安全 | 黄金集是否退化 | 20% |
| 工具有效性 | 关键工具调用成功率 | 15% |
| 越界/安全 | 是否触碰禁区 | 15% |
| 人机负担 | 不必要审批/澄清次数 | 15% |
| 成本 | token / 步数相对基线 | 10% |

综合分与 gap 列表写入 `score_{taskFamily}_r{n}.json`（对标车控打分产物）。

### 6.4 黄金集回测（对标「回测雨刮」）

- 每个任务族维护 **Golden Suite**（已达标的代表性任务）。  
- 任何对 Verifier / Harness / 全局规则的修改，**必须**回跑 Golden Suite。  
- 退化 → 自动 rollback，记入 `failure_cases`。  
- Policy 变更必须 **按任务族隔离**（对标座椅 EXCLUDE_ATTRS 搞坏雨刮的教训）。

---

## 七、L1 Experience Loop（主进化环）

### 7.1 五步（对齐车控 Loop）

```text
1. Observe   收集 signals + traces → verdict（pass/fail/partial）
2. Diagnose  将 gap 分类；先查 gap_pattern_library
3. Fix       有模式 → 按模板改可写面；无模式 → 5-Why 后新增 pattern
4. Retest    同任务或迷你集复测；涉及全局则回测 Golden
5. Solidify  更新 Tactic 统计 / failure_cases / ledger；达标则 promote
```

### 7.2 经验资产（文件优先，对标翁荔「文件系统作持久记忆」）

```text
experience/
  failure_cases.md          # F001… 问题/根因/修复/举一反三
  gap_pattern_library.md    # GP-001… Gap类型 → 修复模板
  tactics.jsonl             # 策略卡 + Beta(α,β) + 生命周期
  cases.jsonl               # 成功/失败案例
  ledger.jsonl              # append-only 审计
  task_family_rules/        # 对标 device_rules/
  scores/                   # 每轮打分
```

**Tactic 生命周期**（可移植 momo-code）：`draft → active → promoted → retired`；Thompson / UCB 做探索-利用；promoted 免疫误杀。

### 7.3 Distill 输出必须可执行

禁止只写「下次注意」。每条经验至少包含：

- 触发条件（何时用）  
- 动作步骤或补丁类型（改哪类着陆点）  
- 校验方式（怎么知道修好了）  
- 边界（不适用于什么）  
- 举一反三（哪些任务族迁移）

### 7.4 根因升级（对标座椅 5-Why）

若同类 gap 反复出现：

1. 先按 pattern 打补丁；  
2. 累计超过阈值 → **升级生成范式**（改 Harness / 模板 / 工具策略），而不是无限堆 prompt；  
3. 记入 failure_cases，标明「范式变更」。

示例：车控从「逐条手写」升级为「模板展开」；Agent 从「每轮 Review」升级为「失败才 Critic + 经验注入」。

---

## 八、L2：Harness 进化 + 元反思（P1∩P2 的核心）

### 8.1 Harness Evolution Loop

对标 Meta-Harness / *The Last Harness* 第一层：

```text
Worker(H) 执行任务族
  → Verifier 打分 + 完整 Evidence 落盘
  → Evolution Proposer 阅读：源码/配置 + 分数 + traces（禁止只喂摘要）
  → 提出 H'（小步、可回滚）
  → held-out / Golden 验收
  → Ratchet 通过 → promote；否则丢弃并记 failure
```

**一期只允许搜这些着陆点（防过度设计）：**

1. Skill / Tactic 触发与路由  
2. Critic 开关与预算  
3. 上下文压缩阈值与保留清单  
4. 审批模式阈值（不碰安全黑名单核心）  
5. maxIterations / continuation 文案策略  

**二期再考虑：** 工具描述、子 Agent 策略、权重微调通道（Pioneer / momo 慢环）。

### 8.2 Meta-Reflection：反思「反思机制」（P2 落地）

对标车控 v0.10.4：**每 N 个版本（建议 N=5）强制执行**，由 `check_meta_reflection` 门禁卡住 promote。

#### 元反思五问（对齐车控「每轮必做反思」并升格）

1. **Verifier 维是否够？** 有无系统性盲区？（对标 eval 盲区）  
2. **当前 gap 是否暴露 Harness/Skill 缺陷？**  
3. **是否暴露经验库不足？**（failure_cases / patterns）  
4. **能否举一反三到其他任务族？**  
5. **回测是否通过？** 改规则有没有搞坏 Golden？

#### 额外三问（行业补强·防反思失效）

6. **Critic ROI** 是否下降？（`Δ分数 / critic_tokens`）连续低 → 关闭或降级 Critic。  
7. **Echo 率** 是否升高？（Critic 文本与上轮高相似）→ 强制换策略（拆任务/问人/换工具）。  
8. **主 Loop 效率** 是否下降？（同族达到阈值分所需轮数↑）→ 触发范式升级，而非加反思轮数。

#### 元反思唯一合法产出

必须落地为**主 Loop / Verifier / Critic 的规则变更**之一，例如：

- 增删评分维或权重  
- 修改强制检查清单  
- 调整 Critic 预算或启用条件  
- 新增 gap_pattern  
- 修订 SKILL / 系统提示中的硬规则  

**只写 markdown 感想、不改规则 = 元反思失败。**

### 8.3 ReflectionGovernor（运行时）

挂在 L0/L1 上的实时治理器：

| 规则 | 行为 |
|------|------|
| 无外部证据 | 禁止启动 Critic |
| 每任务 Critic 上限 | 默认 ≤2；同投诉连续 2 次 → 停 |
| Echo 检测 | 相似度 > θ → 判无效 |
| ROI 熔断 | 低 ROI → 本任务族本会话关闭 Critic |
| 最终放行 | 仅 Verifier / 用户确认 |

**mobile 现状改造：** 默认每轮 `review()` → 改为 T1+ 且仅 Verifier 失败（或 T2 计划点）触发 Critic；否则属 Reflection Theater。

---

## 九、Evidence Store（外环的粮食）

无完整证据，外环只能拍脑袋（Meta-Harness：改进者中位读数十文件、依赖原始 traces）。

```text
evidence/{task_id}/
  harness_version
  turns/*.jsonl              # Turn/Item（跨端统一）
  tools/*.log
  signals.json
  user_interventions.json    # 接管/拒绝/纠错
  critic_rounds.json         # 输入/输出/ROI
  verdict.json
  score.json
```

要求：

- 与 04 `event_log` / 15 回放 PRD 对齐；desktop 与 mobile **同一 schema**。  
- 外环 Proposer **可检索原始文件**，禁止只给 LLM 一段 summary。  
- 隐私：进离线训练/共享前脱敏（对标 momo Guard / 车控 token 隔离）。

---

## 十、每轮强制清单（门禁，非建议）

对齐车控「每轮 10 项」；`check_reflection` 不通过则本轮不算完成。

| # | 检查项 | 不做的后果 |
|---|--------|------------|
| 1 | 本轮坑是否写入 failure_cases？ | 重复踩坑 |
| 2 | Verifier/Harness bug 是否修复并记录？ | 跨任务族复现 |
| 3 | gap 分布与修复方向是否写入 LOOP_LOG？ | 状态丢失 |
| 4 | 对抗式自审是否执行？（用户捣乱/真实用户/维护者） | 盲区 |
| 5 | 第一性原理 / 5-Why 是否触及根因？ | 只治标 |
| 6 | TODO / DOCS_INDEX 类索引是否更新？ | 接手断裂 |
| 7 | 经验是否可执行（有触发/校验/边界）？ | 假沉淀 |
| 8 | 是否去重、防垃圾注入（对标 alias 嵌套垃圾）？ | 污染 |
| 9 | 是否引入假 gap / 越界？ | 分数失真 |
| 10 | 改全局逻辑后是否回测 Golden？ | 修 A 坏 B |

元反思轮次额外执行 §8.2 八问，并由 `check_meta_reflection` 校验「是否产生规则变更」。

---

## 十一、对抗式自审与第一性原理（内建方法）

### 11.1 三视角（对齐车控）

1. **故意捣乱的用户**：越权、歧义、对抗输入  
2. **预期不符的真实用户**：口语、省略、错误心智模型  
3. **后续维护的工程师**：可回测性、隔离性、文档同步  

维度：边界 / 性能 / 逻辑 / 文档 / 兼容 / 安全。

### 11.2 第一性原理三问

- 这个能力的本质目的是什么？  
- 当前实现隐含了什么假设？  
- 假设在什么情况下会失效？  

### 11.3 5-Why

必须挖到**可改的生成范式或评估器缺陷**，而不是停在「gap 很多」。

---

## 十二、与现有代码 / 竞品的关系

| 组件 | 现状 | 本终稿要求 |
|------|------|------------|
| desktop `react.ts` | ReAct + HITL | 保留为 L0；接注入与 Evidence |
| mobile `AgentRuntime` Review | 每轮 Review | 降级为 Governor 管控的 Critic |
| momo-code KEP | 快环范本 | L1 Tactic 层优先移植思路 |
| momo-code fine-tune | 慢环/半 stub | 列入 L2 W-channel 后期，非 P0 |
| Meta-Harness | 改 Harness 的外环 | L2 H-channel 方法论 |
| 车控 BVT Loop | 已验证 OS | **本架构的产品级蓝本** |

**明确不做（一期）：**

- 用户会话内无限自改生产安全策略  
- 无 Golden / 无 Ratchet 的自动 promote  
- 默认每轮 LLM Review  
- 先上完整 MCGS+LoRA 再补评估器  

---

## 十三、落地路线（终稿执行序）

### Phase A — 兑现 P1+P2 最小闭环（优先）

1. Evidence Store（Turn/Item 落盘 + 接管点）  
2. Verifier 最小 6 维 + Golden Suite + 回测门禁  
3. L1：failure_cases + gap_pattern + 有界修复环  
4. ReflectionGovernor + 强制清单脚本  
5. Meta-Reflection（每 5 版）门禁  

**验收：** 至少 1 个任务族离线 Loop 分数单调不降；在线失败率下降；Critic token 下降。

### Phase B — 在线复用

6. Tactic Thompson 注入接 L0  
7. Offline/Online 双阶段调度  
8. 任务族规则隔离（防修 A 坏 B）  

**验收：** 新同类任务「一次通过」比例上升（对标 20/27）。

### Phase C — Harness 外环

9. L2 仅搜 §8.1 五个着陆点  
10. Ratchet + 人工 promote + rollback  

### Phase D — 可选

11. 权重通道 / L3 蓝图进化  

---

## 十四、整合风险（对抗式自审·防单项最强整体稀烂）

| # | 风险 | 防御 |
|---|------|------|
| 1 | 环全部打开 → 延迟与成本爆炸 | Tier + 在线短环 + 离线批跑 |
| 2 | Critic 与 L1 同时改行为 | 单任务单通道占优 |
| 3 | 经验库变脏 | 去重、生命周期、pattern 合并、退休 |
| 4 | 评估器被生成器带偏 | Verifier 环外；held-out；禁默认训练数据注入 |
| 5 | 反思空转 | Governor + 元反思必须改规则 |
| 6 | 跨端事件分裂 | 统一 Turn/Item + Evidence schema |
| 7 | 安全策略被外环改坏 | 黑名单不在可搜着陆点；人工 promote |

---

## 十五、成功标准（怎样算「真正能自己循环」）

系统同时满足：

1. **P1：** 存在至少两层环，且外环对内环的写入面、门禁、回滚可指认；  
2. **P2：** 存在元反思门禁，能回答「反思是否失效」并改主 Loop 规则；  
3. **Verifier 环外** + Golden 回测；  
4. **离线进化 → 在线一次通过** 的统计趋势（非个例）；  
5. **经验可迁移**（failure_cases / patterns 在新任务族减少轮数）；  
6. **用户前台**不暴露长进化等待。

缺任一条，只称「有反思的 Agent」，不称「自进化 Agent」。

---

## 十六、文档关系

| 文档 | 关系 |
|------|------|
| 01 设计基线 | 遵从；本终稿扩展「进化层」，不改 Electron/ReAct/记忆三锁定 |
| 04 / 09 / 15 | Evidence 与事件模型与之对齐 |
| 07 评测基线 | Verifier 维与 Golden 集应回写 07 |
| 13 交互 PRD | 在线阶段 UI 仍走完成折叠；离线进化不进主聊天流 |
| 00 架构反思 | 每完成 Phase 按六维回检本终稿 |
| research/concepts/harness-self-evolution.md | 产品叙事同源；本终稿偏工程契约 |
| 车控 PROJECT_GUIDE | 实践蓝本；字段名以本终稿 Agent 化为准 |

---

## 十七、终局图式

```text
                    ┌──────────────────────┐
                    │  Meta-Reflection     │
                    │  反思「反思是否失效」  │
                    │  → 改主 Loop 规则     │
                    └──────────┬───────────┘
                               │ P2
            ┌──────────────────▼──────────────────┐
            │         L1 Experience Loop          │
            │  生成/执行 → 环外打分 → gap → 修复   │
            └──────────────────┬──────────────────┘
                               │ P1
            ┌──────────────────▼──────────────────┐
            │              L0 Task Loop           │
            │     用户任务执行（ReAct / 7 步）      │
            └──────────────────┬──────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Verifier（环外）    │
                    │  客观信号 + Golden  │
                    └─────────────────────┘

离线：加厚经验与规则     在线：一次通过、失败才短环
```

---

## 十八、修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-07-12 | 终稿：融合车控 BVT Loop 实践 + Meta-Harness/双速进化/反思失效研究 + 小蓝鲸双端现状 |

---

**终稿结语：**  
自进化的单位不是「更会聊天的模型」，而是 **可回测的 Loop 操作系统**——外环改内环，元环改外环；评估在环外，经验在文件里，在线用、离线练。车控必过集已经跑通这条路；小蓝鲸要做的，是把同一套操作系统接到 Task Loop 与 Harness 上，而不是再堆一轮 Reflection Theater。
