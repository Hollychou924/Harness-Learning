---
id: loop-engineering
type: concept
status: active
updated: 2026-07-08
sources:
  - https://mp.weixin.qq.com/s/w6I4MeRbwxnmZF52rd3HWg （Claude 官方入门 Loop 文章）
  - https://mp.weixin.qq.com/s/-zNyfvaPMGAJrKThPRZWkA （Claude Code /loop 实操教程）
  - https://mp.weixin.qq.com/s/ayESVu4F_3RC3OdP8aV7ow （翁荔：Harness Engineering for Self-Improvement）
  - https://mp.weixin.qq.com/s/kICrdEkPCYAiyOiwI-Gt1Q （Loop Engineering 实操手册）
  - projects/competitor-references/02-cli-terminals/momo-code/ （源码级实现案例）
owners: ["zhouhao"]
when_to_load: "讨论 Loop Engineering、循环设计、自进化 loop 实现、momo-code 源码分析、第7章写作时加载"
---

# Loop Engineering

> 一句话定义：Loop Engineering 是把"让 AI 反复干一件事直到满足停止条件"这件事系统化的工程方法——不只是写一个循环，而是设计触发机制、停止条件、质量闸门、状态持久化和安全护栏。

## 1. 从"循环"到"Loop Engineering"

一个裸循环（while True + LLM 调用）不等于 Loop Engineering。Loop Engineering 关注的是：循环的智能从哪来、怎么保证质量、怎么持久化状态、怎么防止翻车。

### 四层循环分类（Claude 官方）

| 类型 | 触发方式 | 人参与度 | 典型场景 |
|---|---|---|---|
| 回合制循环 | 用户每轮发指令 | 全程掌舵 | 日常编码，反复自查 |
| 目标循环 /goal | 设定目标，达标即停 | 只定目标 | Lighthouse 分数拉到 90 |
| 时间循环 /loop | cron 定时触发 | 复核结果 | 每 5 分钟检查 PR |
| 主动循环 | 事件/时间表触发 | 全程不盯 | bug 分类、代码迁移 |

主动循环 = 前三种的拼装：定时任务发现新工作 → goal 定义什么叫做完 → skill 规定怎么验证 → 工作流调度多 agent → 自动模式不卡权限。

### 循环的智能在哪？

Claude Code 的 /loop 源码证明：基础设施只做一件事——到时间了，把 prompt 塞给 agent。没有 evaluator，没有达标判断。"什么条件下该做事、该停、该喊人"的智能全在 prompt 里。

这代表一种设计哲学：**智能在 prompt 里**。momo-code 代表另一种：**智能在代码里**（Bayesian gate、Thompson sampling、Ratchet Gate）。两种路线各有取舍。

## 2. Loop Engineering 的五个核心构件

来自 Codez 的实操手册，每个构件可单独用、单独试。

| 构件 | 作用 | momo-code 源码对应 |
|---|---|---|
| **Automations** | loop 的心跳，按节奏触发，停止条件写死 | `/evolve` 命令 + `--auto`/`--observe`/`--signals` 多种触发方式；`--mode` 控制探索/加固/平衡 |
| **Skills** | 把项目背景写下来，省得每轮从零解释 | Tactic 库（`tactics.json`）——蒸馏出的可复用策略卡，含触发条件、前提、步骤、检查项 |
| **状态文件** | 记下做完了什么、下一步干啥 | `ledger.jsonl`（append-only 审计日志）+ `tactics.json`（战术库）+ `cases.json`（成功/失败案例） |
| **闸门** | 自动拒绝坏活的测试/构建 | Gate 状态机（draft→active→promoted→retired）+ Ratchet Gate（ΔpassAt1 ≥ 2% 且回归数为 0）|
| **Sub-agents** | 写的和验的分开 | 快循环蒸馏战术 vs 慢循环用独立 held-out 测试集验证候选；Bridge 连接两个循环 |

## 3. 三种设计模式（翁荔 Harness Engineering）

翁荔提出 Harness 的三种设计模式，Loop Engineering 是其中"工作流自动化"的具体落地。

### 模式一：工作流自动化

给模型定义一个可以操作、测试、迭代的工作流。核心是目标导向的循环：规划→执行→观察/测试→改进→再执行。强调在一个 "agent runtime" 里分析自己的执行轨迹和失败案例、持续迭代，而不是套用静态 prompt 模板。

**momo-code 的实现**：快循环 KEP（5 步）——Observe→Distill→Select/Inject→Solidify→Promote。每一步都有明确的输入输出和验证条件，不是裸 LLM 循环。

### 模式二：文件系统作为持久记忆

harness 不该把整个工作流和所有日志塞进上下文，应该把持久状态存进文件。实验日志、代码 diff、报错记录这些产出物长度远超上下文窗口。

**momo-code 的实现**：三文件持久化到 `~/.momo/experience/`：
- `tactics.json`——战术库（结构化 JSON）
- `cases.json`——成功/失败案例
- `ledger.jsonl`——append-only 审计日志（7 种 entry 类型：observe/distill/inject/solidify/promote/retire/bridge）

所有写入都是原子操作（先写 `.tmp.{timestamp}` 再 `rename`），防崩溃损坏。

### 模式三：子 Agent 与后端任务

harness 派生多个子 agent 并行执行，父 agent 需要小型进程管理器：启动任务、查看日志、取消失败运行、合并结果。关键设计是让子 agent 上下文与主 agent 隔离。

**momo-code 的实现**：快慢两个循环通过 Bridge 隔离。快循环（每次任务结束）产出战术，慢循环（`/fine-tune` 命令触发）消费战术做权重更新。Bridge 维护一个 pending 队列，队满 10 条 pass-case 后 spillover 到慢循环的训练集。两个循环各自独立运行，互不污染上下文。

## 4. 自进化 Loop 的源码级实现：momo-code 双速循环

momo-code 把自进化做成了两个独立循环，代码里叫 KEP（momo Evolution Protocol），一快一慢，用 Bridge 连接。

### 快循环：5 步 KEP（秒级~分钟级）

```
每次任务结束
      ↓
Observe → Distill → Upsert → Gate → Bridge
```

**第 1 步 Observe（`collector.ts`）**：收集 Signal。信号来源是工具调用结果——bash 退出码 0 → `test-pass`，非 0 → `test-fail`，用户手动改输出 → `user-correction`，重试超 3 次 → `retry-loop`。加权投票算整体 verdict：pass 占比 ≥ 70% → pass，≤ 30% → fail。

**第 2 步 Distill（`distiller.ts`）**：把信号蒸馏成 Tactic（战术）。成功信号按工具分组生成策略卡，失败信号按类型聚类生成约束。去重逻辑：内容 hash 精确匹配 + 关键词相似度 ≥ 0.8 语义去重。

**第 3 步 Upsert + Gate（`store.ts` + `gate.ts`）**：新战术初始 `draft` 状态。Gate 检查状态迁移：胜率 ≥ 0.6 → active；使用 ≥ 5 次且胜率 ≥ 0.75 → promoted；使用 ≥ 5 次且胜率 ≤ 0.3 → retired（promoted 免疫退役）。

**第 4 步 Select/Inject（`selector.ts` + `injector.ts`）**：下次任务开始时，Thompson 采样从 Beta(α,β) 分布抽样本排序选最多 6 条战术，格式化成 Markdown 块注入 System Prompt。

**第 5 步 Solidify + Ledger（`solidify.ts` + `ledger.ts`）**：任务结束根据 verdict 更新 α/β，写 JSONL 审计记录。

### 慢循环：MCGS 权重更新（小时级~天级）

```
/fine-tune run 触发
      ↓
Curriculum → Baseline → Train Priors → Candidate Eval → Ratchet Gate
      ↓
通过 → 原子替换生产 tactics.json（含备份+回滚）
```

5 步：构建训练集（gold/replay/hard-negative）→ 80/20 分割跑基准 → 更新先验生成候选 → held-out 测试评估 → Ratchet Gate 质量门（改善 ≥ 2% 且零回归才放行）。通过后原子替换生产文件，支持一键 rollback。

### Bridge：快慢循环的连接

Bridge 维护内存 pending 队列。快循环产出 promoted 战术后 `enqueueForFineTune()` 进队，队满后 `spilloverToCurriculum()` 打包成训练样本写入 ledger，清空队列。慢循环从 ledger 读取这批数据。

## 5. momo-code 的优点思路

### 优点 1：信号是免费的

`evolve/signals.ts` 注释直接引用论文："The verdict signal v is free because test outcomes are already computed during normal agent operation." bash 退出码、tsc 编译结果、用户是否手动修改——这些都是编码过程里天然存在的信号，不需要额外调用 LLM 打分。这解决了翁荔提出的"弱且模糊的评估器"瓶颈的一部分：在编码场景里，评估器可以又快又准又免费。

### 优点 2：Bayesian 探索-利用平衡

每条战术维护 Beta(α,β) 分布，Thompson 采样选战术。这天然平衡探索（不确定的战术偶尔被抽中）和利用（高胜率战术通常排前面）。有 UCB 备选策略。这直接应对了翁荔提出的"多样性坍缩"瓶颈——防止系统只顾利用已知高奖励模式。

### 优点 3：分层状态机 + 免疫机制

战术有 4 个状态（draft→active→promoted→retired），迁移有明确阈值（0.6/0.75/0.3）和最小样本量（5 次）。promoted 状态免疫自动退役，必须手动降级。这防止了"好战术因偶然失败被误杀"。

### 优点 4：Ratchet Gate 防回归

慢循环的 Ratchet Gate 要求候选版本在 held-out 测试集上改善 ≥ 2% 且零回归才放行。这落实了翁荔的原则："评估器和权限控制应该活在循环之外"。配合原子替换 + 备份 + 一键 rollback，构成完整的安全网。

### 优点 5：三文件原子持久化

`tactics.json` + `cases.json` + `ledger.jsonl` 三文件持久化到 `~/.momo/experience/`，所有写入先写 temp 再 rename。ledger 是 append-only JSONL，7 种 entry 类型覆盖全生命周期。这落实了翁荔的"文件系统作为持久记忆"模式。

### 优点 6：Guard 安全护栏

`solidify.ts` 的 `checkGuardrails` 拒掉：触碰 `.git`/`node_modules`、包含 secret 正则（`sk-`、`AKIA` 等）、包含禁用 shell 模式的战术。这对应了 Loop Engineering 实操手册里的安全红线——"无人值守的 loop = 无人值守的攻击面"。

### 优点 7：内容哈希幂等去重

战术 ID = `tac_{scope}_{sha256(scope:title)[:8]}`，同样 scope + title 永远是同一个 ID。配合内容 hash + 关键词相似度双重去重，防止战术库膨胀。这应对了自进化概念页提到的"越沉淀越脏"坑。

## 6. momo-code 的局限（对照理论框架）

| 理论瓶颈（翁荔） | momo-code 的应对 | 仍存在的缺口 |
|---|---|---|
| 弱且模糊的评估器 | 用退出码/编译结果做客观信号 | 只覆盖编码场景，非编码任务无免费信号 |
| 上下文和记忆生命周期 | 三文件持久化 + 原子写入 | 无自动清理/合并机制，长期可能膨胀 |
| 负面结果 | 失败信号聚类生成约束 | 约束未被系统性保留为训练反例 |
| 多样性坍缩 | Thompson 采样探索 | 无种群多样性指标，无法量化坍缩程度 |
| Reward hacking | Ratchet Gate + held-out 测试 | 仍可能对测试集过拟合，无交叉验证 |
| 长期成功 | 战术状态机 + 免疫退役 | 无"仓库长期健康"维度评估 |
| 人的角色 | `/fine-tune promote` 需手动确认 | 无灰度发布、无多人协作 review |

| 翻车方式（实操手册） | momo-code 是否防住 |
|---|---|
| 假装干完了（Ralph Wiggum 循环） | ✅ Gate 状态机要求最小使用量+胜率门槛 |
| 理解债务 | ❌ 无机制应对"仓库里有什么 vs 你理解什么"的差距 |
| 认知投降 | ❌ 无机制防止"loop 返回啥就收啥" |

## 7. 两种设计哲学的对比

| 维度 | Claude Code /loop | momo-code |
|---|---|---|
| 智能在哪 | prompt 里 | 代码里（Bayesian gate、Thompson、Ratchet） |
| 循环类型 | 时间循环为主 | 目标循环为主（evolve 达标后停） |
| 状态持久化 | 用户自己设计状态文件 | 三文件固定结构 |
| 质量闸门 | 用户自己在 prompt 里定义 | 代码层硬闸门（Gate + Ratchet） |
| 适用场景 | 任意重复任务 | 专注编码 Agent 自进化 |
| 灵活性 | 高（prompt 驱动） | 低（固定流程） |
| 可靠性 | 取决于 prompt 质量 | 代码保证（测试覆盖） |

Claude Code 的路线更灵活、更通用，但质量取决于用户写 prompt 的水平。momo-code 的路线更刚性、更专精，但用代码层保障了质量底线。两者不是对立的——理想状态是"代码层保底线 + prompt 层给灵活性"。

## 8. 给产品侧的核心判断

1. **Loop ≠ Loop Engineering**：裸循环不是 Loop Engineering，必须设计触发、停止、闸门、状态、安全五件事。
2. **先写 skill 再包 loop**：处理问题的方法得先有，loop 只是让它自动重复。
3. **评估器是命门**：免费客观信号（退出码、编译结果）是编码场景的天然优势，非编码场景需要额外设计。
4. **写的和验的必须分开**：自我评分太宽容，独立 held-out 验证是唯一可靠的闸门。
5. **两种设计哲学可以融合**：代码层保底线（momo-code 的 Gate/Ratchet）+ prompt 层给灵活性（Claude Code 的 /loop），是更稳健的架构。

## 相关页面

- [Harness 自进化](harness-self-evolution.md)
- [Harness Engineering](harness-engineering.md)
- [上下文压缩](context-compaction.md)
- [记忆合成 / Dreaming](memory-synthesis-dreaming.md)
