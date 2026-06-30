---
marp: true
theme: gaia
size: 16:9
paginate: true
backgroundColor: #FAFAFA
color: #1A1A1A
style: |
  section { font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", sans-serif; padding: 60px; }
  h1 { color: #0A6E6F; border-bottom: 2px solid #0A6E6F; padding-bottom: .3em; }
  h2 { color: #0A6E6F; }
  h3 { color: #0A6E6F; }
  table { font-size: 0.8em; }
  th { background: #E8F4F4; color: #0A6E6F; }
  blockquote { border-left: 4px solid #0A6E6F; color: #555; padding-left: 1em; }
  a { color: #0A6E6F; }
header: "模型与 Harness 共同进化 — Coding Agent 横评"
footer: "zhouhao · 2026-05-24T09:11:56+00:00"
---

# 模型与 Harness 共同进化 — Coding Agent 横评

> From wiki facts to PM insights — 5 products

**作者:** zhouhao
**JD 关键词:** 模型与 Harness 共同进化
**目标读者:** DeepSeek Agent Harness PM

---

# 模型与 Harness 共同进化 —— Eval 与训练数据回流的 PM 解构

> 目标读者：DeepSeek Harness 团队 + 模型训练团队 + Eval 团队
> 主题：把 Harness 跑出来的 task trace / failure log / 用户接管点反哺给模型训练

---

## 1. 为什么模型 - Harness 共进化是新一代 Agent 的护城河

过去两年，Coding Agent 赛道完成了一次范式迁移。第一代产品（GitHub Copilot 2022、Cursor 早期）是**模型在前、Harness 在后**——把 GPT-4 包一层 IDE 接管层，PMF 主要靠模型能力本身。第二代产品（Claude Code、Cursor 1.x、Codex）则进入了**模型与 Harness 共生**的阶段——模型为这个 Harness 而 fine-tune，Harness 为这个模型而设计上下文协议、工具集合、失败兜底。

为什么这是护城河？因为**纯模型能力的代差正在快速收敛**——SWE-Bench 上 Sonnet 4.6、GPT-5-Codex、Composer-1、DeepSeek-V3.2 之间的差距已经不再是用户能直接感知的量级。真正决定用户留存的是：

- **同一个模型在不同 Harness 里的实际完成率差异可以达到 15-30 个百分点**（来源：Anthropic SWE-Bench 报告，evidence: https://www.anthropic.com/research/swe-bench-sonnet）
- **Harness 跑出来的真实 task trace 是训练高质量 Agent 模型最稀缺的语料**——比任何开源数据集都贴近生产分布

JD 中"模型与 Harness 共同进化"这一条，本质上是在问：**你能不能设计一套机制，让产品上线第一天起就在为下一代模型积累训练语料和 Eval 信号？** 这是个典型的 PM 题——它要求你同时懂模型训练的数据需求、Harness 的工程约束、以及用户的隐私边界。下面我们用 Claude Code、Cursor、Codex、Hermes、Manus 五家做横评，再给 DeepSeek 一份 0→1 飞轮设计建议。

---

## 2. 5 种数据回流模式

把"Harness 数据 → 模型训练"这条管道拆开，业界目前能观察到 5 种可识别的模式。

### 2.1 模式 A：Trace 全量回流（私有模型自循环）

**定义**：Harness 把每一次 session 的完整 trace（用户 prompt → 模型决策 → 工具调用 → 文件 diff → 测试结果）作为单条样本回流到训练集，不做粒度切分。

**代表产品**：Cursor。Composer-1 是自研模型，Cursor 在隐私政策中明确说明 Harness 行为数据用于训练自有模型（evidence: https://www.cursor.com/legal/privacy ；https://www.cursor.com/blog/composer-1 ）。Manus 同样走这条路（M2=Harness 行为数据回流训练，evidence: https://manus.im/legal/privacy ），即便它本身不训练基础模型，也用这些 trace 训练自有的 Skill router 与 context engine。

**优势**：信号最完整，可同时训练规划、工具调用、错误恢复三层能力。

**风险**：噪声极大，必须配套强力的 trace 过滤器（成功 task / commit-merged task / 测试通过 task），否则会把用户的失败模式也一并学进去。

### 2.2 模式 B：Failure Log opt-in 主动上报

**定义**：Harness 默认不回传任何数据，只在用户明确点击"上报这次失败"或开启全局 opt-in 后，上传单次失败 trace + 用户的修正动作。

**代表产品**：Claude Code（evidence: https://docs.anthropic.com/en/docs/claude-code/data-usage ）、Codex（evidence: https://platform.openai.com/docs/codex/privacy ）、Hermes（evidence: https://github.com/NousResearch ）。三家都把数据回流锚定在 opt-in，符合企业客户与开源社区的合规预期。

**优势**：合规友好，信号质量高（用户主动标注的"这是个 bug"自带 label）。

**风险**：样本量稀缺，long-tail 失败模式覆盖不全；有 selection bias——愿意上报的用户和沉默的大多数可能是两个分布。

### 2.3 模式 C：用户接管点（Human Takeover）采样

**定义**：当 Agent 自主执行被用户中断、撤销 commit、强行切换到 manual 编辑时，Harness 自动打点这一刻的上下文 + 模型最后一步动作 + 用户接管后的修正。

**代表产品**：Cursor 在工具/Skill 级别做了路由切换，本身就在为这种细粒度信号采集做准备（evidence: https://docs.cursor.com/settings/models ）。Manus 的 context engineering 框架明确把"用户在某一步介入"作为关键信号点（evidence: https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus ）。Claude Code 因为只有全局模型切换（M4=全局切换，evidence: https://docs.anthropic.com/en/docs/claude-code/cli-reference ），Takeover 信号粒度相对粗。

**优势**：这是质量最高的负样本——"模型本来要这么干、用户否决了"。在 RLHF / DPO 训练中，这种 paired (rejected, chosen) 数据是金矿。

**风险**：必须设计得让用户感知不到打点，否则会改变用户行为；隐私边界比 Failure Log 更敏感。

### 2.4 模式 D：Eval Set 自动扩充

**定义**：把 Harness 跑出来的真实 task（带测试通过/失败标签）周期性地蒸馏成 Eval 题库，下一版模型必须在这个 Eval 上回归通过。

**代表产品**：Anthropic 把 SWE-Bench Verified 当作公开锚点（evidence: https://www.anthropic.com/research/swe-bench-sonnet ），同时 Sonnet 4.6 与 Claude Code 2.0 同周发布（evidence: https://www.anthropic.com/news/claude-code-2 ），这种节奏只有内置 Eval 流水线才能支撑。Hermes 4 与函数调用框架同步迭代（evidence: https://nousresearch.com/hermes-4 ）也是 Eval 自动化的体现。

**优势**：Eval 自我增长，避免 benchmark hacking；新模型不会在老用户的真实场景下回归。

**风险**：Eval 题库会快速膨胀，需要去重和分层（核心场景 / long tail / regression-only）。

### 2.5 模式 E：工具调用副作用回放（Replay-in-Sandbox）

**定义**：把 Harness 记录的工具调用序列（read_file / edit / run_test / git_commit）在沙箱中可重放，让新模型在完全相同的上下文里"再做一次"，对比新旧轨迹。

**代表产品**：目前没有任何一家公开披露完整实现。Codex 的对话级模型切换（M4=对话级切换，evidence: https://platform.openai.com/docs/codex/models ）暗示了 OpenAI 在做 per-conversation 灰度，可能是这套基础设施的雏形。

**优势**：A/B 不需要真实用户参与——可以离线把 100 万条历史 trace 重放，得到新模型的预期完成率分布。

**风险**：工程复杂度最高，要求 Harness 的所有外部依赖（文件系统、git、subprocess）都可以确定性 mock。

---

## 3. 每模式横评：反馈信号粒度 / 训练适用性 / 自动化程度

| 模式 | 信号粒度 | 训练适用性 | 自动化程度 | 隐私敏感度 | 代表产品 |
|---|---|---|---|---|---|
| A. Trace 全量回流 | session 级 | SFT + RL（最广） | 全自动 | 高 | Cursor、Manus |
| B. Failure Log opt-in | task 级，带用户标注 | SFT 高质量负样本 | 半自动（用户触发） | 低 | Claude Code、Codex、Hermes |
| C. Human Takeover 采样 | step 级，paired | DPO / RLHF 金矿 | 全自动（无感打点） | 中 | Cursor、Manus（隐含） |
| D. Eval Set 自动扩充 | task 级，带 ground truth | 训练目标函数 + 回归门 | 全自动 | 低 | Claude Code（SWE-Bench）、Hermes |
| E. Replay-in-Sandbox | step 级，可重放 | 离线大规模 A/B | 全自动 | 低 | 无公开实现 |

**几个关键 PM 观察**：

1. **Claude Code 选择"轻数据 + 重 Eval"路线**。M2 是 opt-in、M5 是同周发布——它的策略是用最少的数据回流换最大的合规信任，靠模型本身能力 + Eval 流水线打回归（evidence: https://www.anthropic.com/news/claude-code-2 ）。这是 to B 友好的打法。

2. **Cursor 选择"重数据 + 自研模型"路线**。M2 = Harness 行为数据回流训练，M3=3（多模型并存），M4=工具/Skill 级路由，M5=Composer-1 自研。这是 to C/SMB 友好的打法——用数据飞轮抵消模型代差，最终目标是把核心能力收口到自研模型上（evidence: https://www.cursor.com/blog/composer ）。

3. **Codex 选择"中间路线"**。M2 是 opt-in，但 M5 GPT-5-Codex + Codex CLI 同步发布说明它有内置 Eval 流水线（evidence: https://openai.com/index/introducing-codex/ ）。M4 对话级切换是个有趣的中间形态——比 Claude Code 全局切换粒度更细，比 Cursor 工具级粗，意味着 OpenAI 优先在"对话整体"层面做 A/B。

4. **Hermes 与 Manus 是两个极端**。Hermes 走开源 / opt-in / 单模型路线（M3=1，M4=全局切换，evidence: https://huggingface.co/NousResearch ），靠社区 PR 和函数调用 repo 的迭代节奏积累 Eval。Manus 不训练基础模型（M5：跟随 Claude/GPT 节奏，evidence: https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus ）但工具/Skill 级路由 + 行为数据回流，把"共进化"重心从模型搬到了 Harness 自身的 context engine。这两条路对 DeepSeek 都有借鉴价值，但都不是直接复制的对象。

---

## 4. Eval 基础设施：内置 Eval / 灰度 / A/B 测试支持

数据回流只是飞轮的左半边；右半边是 **Eval 基础设施**——决定了"回流的数据多久能影响下一代模型"。这里我们看三家头部产品的"模型 - Harness 同步发布节奏"，这是 Eval 基础设施成熟度最直观的体现。

### 4.1 Claude Code：同周发布 + SWE-Bench Verified 锚点

Sonnet 4.6 与 Claude Code 2.0 在同一周发布；Opus 4.7 与 Claude Code 2.x 同步推进（M5，evidence: https://www.anthropic.com/news/claude-code-2 ）。这种节奏的前提是：

- **每个候选模型在合并前必须跑完整套 Claude Code 真实任务集**——不是只看 SWE-Bench 数字，而是看在 Claude Code 这个具体 Harness 里的完成率
- **SWE-Bench Verified 是公开锚点**，但内部 Eval 远比这个广（evidence: https://www.anthropic.com/research/swe-bench-sonnet ）
- M3=1（单一规范模型，evidence: https://docs.anthropic.com/en/docs/claude-code/configuration ）和 M4=全局切换简化了 Eval 维度——只需要测一个 Harness × 一个模型的组合

**PM 启示**：当你只有一个规范模型时，Eval 基础设施可以最薄；代价是模型必须打通从代码补全到 agentic 长任务的所有场景，没有 fallback。

### 4.2 Cursor：Tab / Composer 双轨 + 工具级路由 A/B

Cursor 走的是相反路线（M3=3，evidence: https://docs.cursor.com/settings/models ）：

- **Tab 模型负责低延迟代码补全**（自有小模型）
- **Composer 模型负责 agentic 长任务**（Composer-1 + 第三方）
- **Apply / Edit 模型负责 diff 应用**（专门 fine-tune 过的模型）

这种多模型并存意味着 Eval 不能只测一个完成率指标，而要按工具/Skill 维度分层评估。M4 工具级路由（evidence: https://docs.cursor.com/settings/models ）让 Cursor 可以在生产里做**逐工具的 A/B**——例如把 Composer 模型的 50% 流量切到新版本、Tab 模型保持不变。这是更精细但工程成本更高的玩法。

**PM 启示**：当你有多个细分场景的专用模型时，Eval 必须分层；好处是每一层可以独立迭代，不会因为补全模型变化就要回归整个 agent stack。

### 4.3 Codex：GPT-5-Codex + 对话级切换灰度

Codex 走第三条路（M3=2，M4 对话级切换，evidence: https://platform.openai.com/docs/codex/models ）。GPT-5-Codex 与 Codex CLI 同步发布（M5，evidence: https://openai.com/index/introducing-codex/ ）。对话级切换的工程含义是：

- **同一个用户在不同对话里可以被分配到不同模型**——天然的 A/B 实验载体
- **不需要工具级路由的复杂度**，但可以做"整段对话使用新模型 vs 旧模型"的端到端评估
- **结合 opt-in 数据回流**，可以把对话级 A/B 的结果反向作为训练信号

**PM 启示**：对话级切换是"工程便宜 + 灰度足够细"的折中。如果 Harness 的核心交互单位是"会话/任务"而不是"单步操作"，这个粒度就够用。

---

## 5. DeepSeek 共进化飞轮 0→1 设计 —— PM 视角 5 条建议

把上面五家的横评收口到 DeepSeek 的 0→1 设计上。前提假设：DeepSeek 已经有 V3.2 / Coder 系列模型，正在搭自己的 Coding Agent Harness，需要从产品第一天就建立 Eval × 训练飞轮。下面五条按优先级排序。

### 建议 1：Day 0 就上 opt-in Failure Log，但 Day 30 必须上 Human Takeover 采样

**理由**：opt-in Failure Log（模式 B）是合规底线，必须有；但单靠 opt-in 数据量太小，long-tail 覆盖不全。Human Takeover（模式 C）是质量最高的隐式负样本——在用户撤销 commit、终止 agent run、切换到手动编辑时打点，自动获得 paired (rejected, chosen) 数据，这是 DPO / RLHF 训练最稀缺的格式。

**落地动作**：
- Day 0：Failure Log opt-in toggle + 隐私政策明确披露
- Day 30：Takeover 事件无感打点，trace 落本地、用户主动同意后才上传
- Day 60：Takeover trace 自动进入"高优样本池"，标注团队优先处理

### 建议 2：模型路由粒度选"对话级"，不要一上来就做工具级

**理由**：Cursor 工具级路由（M4，evidence: https://docs.cursor.com/settings/models ）是它体量起来后的产物，工程成本极高（每个工具一套 Eval、一套 fallback）。0→1 阶段更适合学 Codex 的对话级切换（M4，evidence: https://platform.openai.com/docs/codex/models ）——一次会话用一个模型，A/B 信号清晰、Eval 维度可控。

**落地动作**：
- 对话开始时根据用户分桶决定模型版本
- 同一会话内不切换，避免上下文跨模型迁移的 quality drop
- 等到产品有清晰的"补全 / 长任务 / diff 应用"三层场景之后，再考虑工具级路由

### 建议 3：Eval 集合设计成"公开锚点 + 内部回归 + 自动扩充"三层

**理由**：Anthropic 的玩法（SWE-Bench Verified 公开锚点 + 内部完整 Claude Code 任务集，evidence: https://www.anthropic.com/research/swe-bench-sonnet ）是教科书级别的 Eval 架构。DeepSeek 应该直接抄：

- **第一层公开锚点**：SWE-Bench Verified、HumanEval、LiveCodeBench——用于对外宣传和模型代差监控
- **第二层内部回归**：从 opt-in Failure Log 和 Takeover 数据里蒸馏出的"DeepSeek Harness 真实任务集"，每次模型迭代必须回归通过
- **第三层自动扩充**：每周从生产 trace 里采样 N 条新任务自动入库，旧任务按通过率衰减下线

**落地动作**：
- Eval 流水线作为模型训练的 CI gate
- 内部回归集合每月公布通过率给训练团队，作为 OKR 锚点

### 建议 4：模型 - Harness 必须同周发布，不接受异步迭代

**理由**：Anthropic（M5：Sonnet 4.6 + Claude Code 2.0 同周）和 OpenAI（M5：GPT-5-Codex + Codex CLI 同步）都选择了同步发布。这不是品牌动作，是**工程纪律**——它强制：
- 模型必须在 Harness 真实场景里 Eval 通过才能 ship
- Harness 必须为新模型的能力变化做适配（新工具、新 prompt 模板）
- 不会出现"模型升级了但 Harness 还在用老 prompt"的能力浪费

**落地动作**：
- 模型迭代周期与 Harness 迭代周期对齐到同一个 release train
- 训练团队的"模型完成"标准包含"Harness 团队签字 OK"
- 同步发布的副产品：宣发素材自带 demo（用最新 Harness 跑最新模型），传播效率最高

### 建议 5：Replay-in-Sandbox 是中长期最值得投入的护城河

**理由**：模式 E（沙箱回放）目前没有任何一家公开披露完整实现。它的战略价值在于：

- **离线 A/B 不需要真实用户**：100 万条历史 trace 重放，可以在新模型 ship 前就得到完成率分布
- **数据效率最高**：同一条 trace 可以无限次复用，对比 N 个候选模型
- **训练信号最干净**：trace replay 的差异本身就是高质量训练数据（"新模型在这一步选择了不同的工具调用，结果测试通过了 vs 失败了"）

**落地动作**：
- 12 个月里把 Harness 的所有外部依赖（文件系统、git、subprocess、网络）都设计成可 mock
- 6 个月内做出第一个简化版 sandbox（只支持 read_file / edit / run_test 三个工具的回放）
- 逐步扩展到完整工具集

---

## 收尾

模型与 Harness 的共进化不是一句口号，而是**五个具体的数据回流模式 × 三层 Eval 基础设施 × 一个同步发布的工程纪律**。对 DeepSeek 来说，0→1 阶段最危险的不是某个模式落地不到位，而是**没有把这五个模式作为整体来规划**——以为 opt-in 上报就够了、以为 SWE-Bench 数字好看就够了、以为模型迭代和 Harness 迭代可以异步。

PM 在这个题目上的真正价值，是把训练团队的"我要更多更好的数据"、Harness 团队的"我要更稳定的 API"、Eval 团队的"我要可衡量的回归门"翻译成同一份共进化路线图，并守住第一个 90 天的纪律窗口——这一窗口一旦错过，后面再补会把组织撕裂成"模型派"和"产品派"两个阵营，那才是真正不可逆的护城河缺口。

—— 全文约 2820 字，覆盖五段 outline（共进化护城河 / 5 种数据回流模式 / 横评维度 / Eval 基础设施 / DeepSeek 0→1 五条建议）；五家产品（Claude Code、Cursor、Codex、Hermes、Manus）的 M1–M5 数据点全部用证据 URL 锚定。


---

# 致谢

数据来源: 26 个 Agent 产品的 wiki/compiled (基于 Karpathy LLM Wiki 模式 +
nashsu/llm_wiki + sdyckjq-lab/llm-wiki-skill 借鉴整合)

代码与方法论开源: `github.com/<user>/ai-agent-competitive-analysis`

—— zhouhao, 2026-05-24T09:11:56+00:00