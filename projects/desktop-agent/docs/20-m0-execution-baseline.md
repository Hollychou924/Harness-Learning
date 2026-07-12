# M0 执行基线（立尺子）

> 状态：执行中（2026-07-12）  
> 对应：`19-path-to-industry-leading.md` M0；下游 M1 代码见 `src/agent/src/evolution/`  
> 原则：没有尺子就没有「领先」；本文件冻结 T1、黄金集、指标与口径。

---

## 一、样板任务族 T1

| 字段 | 取值 |
|------|------|
| ID | `T1` |
| 名称 | Code · 小改动 + 验证 |
| 定义 | 在本地工作区对已有小项目做**有界代码修改**，并以**可程序化信号**验收（测试 / 编译 / 断言文件） |
| 为何先打穿 | 客观信号硬；比 Work 报告类更不易被 LLM 自评骗分 |
| 非目标（本阶段） | 多仓重构、开放式调研报告、无 ground truth 的长文写作 |

### 1.1 子类型

| 子类型 | 说明 | 硬信号示例 |
|--------|------|------------|
| `t1-fix` | 修一个明确 bug | 指定测试由 fail→pass |
| `t1-add` | 加一个小函数/分支 | 新测试绿 / 导出存在 |
| `t1-refactor-safe` | 等价小重构 | 原测试仍绿且无关文件未改 |
| `t1-verify-only` | 只跑验证不改码 | exit 0 + 输出匹配 |

### 1.2 工作台绑定

- 评测与进化优先跑 **Code 模式**（`mode: code`）。  
- Work 模式可复用同一 Evidence schema，但不进 Golden-T1 门禁。

---

## 二、Golden-T1

### 2.1 目录

```text
eval/golden-t1/
  README.md
  cases/*.json          # 用例定义（训练/提示禁止抄正文）
  fixtures/<case_id>/   # 可选：迷你仓库快照
```

### 2.2 Case 字段（冻结）

与 `07-eval-baseline.md` 对齐并加严：

```typescript
interface GoldenT1Case {
  case_id: string                    // 如 t1-001
  family: 'T1'
  subtype: 't1-fix' | 't1-add' | 't1-refactor-safe' | 't1-verify-only'
  difficulty: 'easy' | 'medium' | 'hard'
  input: string                      // 用户指令
  workspace_fixture?: string         // 相对 fixtures/ 的路径
  ground_truth: {
    expected_artifacts?: string[]
    verify_command?: string          // 必须成功的 shell
    expected_tests_pass?: boolean
    must_not_do: string[]            // 如改 package-lock、删 .git
    must_touch?: string[]            // 允许/期望改动的路径前缀
    must_not_touch?: string[]
  }
  scoring_dims: string[]             // 见 Verifier
  tags?: string[]
}
```

### 2.3 规模与隔离

| 项 | 约定 |
|----|------|
| M0 出口 | ≥8 条可跑通 schema 的种子用例 + 扩展清单到 **20+** |
| M1 门禁 | 全量 Golden 一键回跑；发布 **零退化** |
| 隔离 | case 正文 **禁止**进入 system prompt / tactic 示例 |

当前仓库：`eval/golden-t1/cases/` 已放种子；扩到 20+ 在 M1 周期内补齐（真实 badcase 优先）。

### 2.4 回跑入口（M1）

```bash
# 后续：node / tsx 批跑脚本（先单测 Verifier + schema）
pnpm exec tsx eval/golden-t1/run-smoke.ts
```

---

## 三、指标（北极星 + 过程）

### 3.1 北极星

| 指标 | 定义 | 记录方式 |
|------|------|----------|
| **T1 一次交付成功率** | 无失败重开会话即达成 `verify_command` / 约定验收 | Evidence.`score.goal_achieved` + 会话级标记 |
| **HITL 负担（并列）** | 同难度任务人工介入次数：审批 + 计划驳回 + 提问 + 续跑 | Evidence.`score.hitl_burden`（= `approval_requests + plan_rejects + question_prompts + continuation_count`） |
| **重复错误率（并列）** | 近窗内同 `attribution` / 重叠 `trigger_tags` 的 failure 再次出现占比 | Evidence.`signals.repeat_failure` + failure_cases 窗口统计；脚本 `eval/golden-t1/compute-board-metrics.ts` |

立项钉死（M1 退出用）：相对 M0 基线一次成功率 **+15pt**，或绝对值 ≥ 立项会拍板数；同时 HITL 负担与重复错误率 **不升**（理想双降）。

### 3.2 过程指标（每周可更新）

| 支柱 | 指标 | Evidence 字段 |
|------|------|----------------|
| B | 同族平均重试次数 | `signals.continuation_count` + 会话重开计数 |
| B | 经验命中率 | `signals.tactics_injected` / `tactics_hit` |
| B | Critic token 占比 | `critic_rounds[].tokens` / 总 tokens |
| B | 黄金集回归失败数 | CI 报告 |
| B | 重复错误（过程） | `signals.repeat_failure_count` |
| A | 步数 / token | `signals.iterations`, `input_tokens`, `output_tokens` |
| A | HITL 负担 | `signals.approval_*`, `plan_rejects`, `question_prompts`, `continuation_count` |
| 安全 | BLOCKED 命中且未绕过 | `signals.blocked_hits` |

### 3.3 M0 看板

| 周次 | T1 一次成功率 | HITL 负担 | 重复错误率 | Golden 失败 | 备注 |
|------|---------------|-----------|------------|-------------|------|
| 基线周（Live） | **95%**（19/20） | 待首周采样 | 待首周采样 | 见 `last-live-baseline.json` | model=`gpt-5.6-sol` · 2026-07-12；t1-018 已晋升 tactic；看板粗算见 `last-board-metrics.json` |

---

## 四、Evidence 字段冻结（schema 1.0）

权威类型：`src/agent/src/evolution/types.ts`  
落盘约定：

```text
{workspace}/.xiaolanjing/evidence/{task_id}/
  meta.json                 # TaskEvidence 头 + signals + score
  turns/{turn_id}.jsonl     # 本轮 StdoutMessage 摘要行
  interventions.json        # 用户接管
  verdict.json              # Verifier 结论
```

经验账本（L1）：

```text
{workspace}/.xiaolanjing/experience/
  failure_cases.jsonl
  gap_patterns.json
  tactics.json
```

**冻结规则：** 增字段只能加 optional；改名/删字段需升 `schema_version` 并写迁移。

---

## 五、口径（对内 / 对外）

| 可以说 | 不可以说 |
|--------|----------|
| 我们在按 M0→M1 立尺子并建可审计自进化闭环 | 已经全面领先 Codex / Claude Code |
| 设计范式对齐业内一流（环外包验收 + 经验环 + 反思治理） | 桌面端执行体验已全面一线 |
| T1 样板上开始积累 failure_cases / tactics | 任意任务都会自动越用越强（未经验证） |

一句话对内：

> **M0 立尺子，M1 会积累，M2 敢长跑；三者齐备再谈「领先」。**

---

## 六、M0 出口检查

- [x] T1 定义与子类型写清  
- [x] Golden-T1 schema + 种子用例落地  
- [x] 北极星与过程指标表冻结  
- [x] Evidence schema 1.0 进代码  
- [x] 口径一页可评审  
- [x] 首跑基线数字填入 §3.3（Live：**95%** = 19/20，`gpt-5.6-sol`，2026-07-12）

**M0 代码侧连带交付：** `evolution/` 最小实现已开工（Evidence / Verifier / Experience / ReflectionGovernor），详见下一节与 `19` 文档 M1。

---

## 七、本周执行切片（M0→M1）

1. Evidence 从 `runReact` 事件流采集并落盘  
2. Verifier v1 对 T1 信号打分  
3. Experience 读写 + tactic 注入 system prompt  
4. ReflectionGovernor：默认不每轮复查；仅失败/无证据不开 Critic  
5. Golden smoke：schema 校验 + Verifier 单测  
6. **短失败环**：Verifier 未过时 ≤3 轮注入经验催促再验（`short-fail-loop.ts` → `runReact`）  
7. **Golden 批跑雏形**：`pnpm test:golden-t1-batch` → `eval/golden-t1/last-batch-report.json`  
8. **Live 批跑**：`XIAOLANJING_AGENT_BATCH=1` +（`XIAOLANJING_API_KEY` 或 `XIAOLANJING_USE_APP_CONFIG=1`）→ `--mode=live [--write-baseline]`（默认拒绝，防误烧钱）  
9. **LoopGuard**：重复工具 / 乒乓空转熔断（M2 起步，已接入 `runReact`）  
10. **L1 四类归因**：风格 / 规范 / 逻辑 / 缺陷；冲突时 **项目规范 > 用户风格 > 通用**；写入 failure_cases 并驱动注入与短失败提示  
11. **结果反馈入口**：任务结束后「接受 / 我改过 / 拒绝」→ `outcome_feedback.jsonl` + 归因入库；设置页「进化」只读账本  
12. **Tactic 回测晋升**：`validated=false` 草稿不注入 → Golden live 回测通过 → `validated=true`；t1-018 归因 tactic `t1-map-object-as-key` 已晋升  
13. **纠正落点分流**：`routeLearningTarget` + docs/18 分流表；Gate/Skill/Golden 仅记 `learning_candidates.jsonl`  
14. **并列北极星**：HITL 负担 + 重复错误率；`compute-board-metrics.ts`  
15. **进化账本可控**：设置页可禁用 / 撤销 tactic，可忽略 failure case  

---

## 八、M1 / M2 工程出口（本轮验收，非文档数据门禁）

> 文档原 M1「+15pt / ≥30 cases」与 M2「竞品盲测」依赖长期跑数，此处记的是**工程可验收出口**。

### M1 工程出口

- [x] Goal Contract 生成并注入 system；Evidence 记 optional `goal_contract`
- [x] Stop Gate：code 模式无硬验证不得轻易完成（进短失败环）
- [x] 打断策略表 `interrupt-policy.ts`（auto / record_and_auto / ask_user / escalate_stop）
- [x] failure → `upsertGapPattern` 自动沉淀
- [x] HITL：live 批跑 result 含 `hitl_burden`（可喂 `compute-board-metrics`）
- [x] 反馈后「本次学习」提示 + 设置→进化可撤销

### M2 工程出口

- [x] LoopGuard 防空转（既有）
- [x] 协作式 cancel：`task_control` → 解除 HITL 等待 + abort 循环；Composer 等待中可「停止任务」
- [x] Agent 内 compact + Goal Contract 保留 + 压缩循环告警
- [x] 续跑「拆分」→ 新建会话并预填剩余目标
- [x] 详细程度入口（正常 / 全部展开 / 只看结论）

### 打断策略摘要

| 情况 | 行为 |
|------|------|
| 可回滚技术问题 | auto |
| 已有项目规范 | auto |
| 多方案无产品差异 | record_and_auto |
| 安全/删除/权限 | ask_user |
| 连续失败 ≥3 | escalate_stop |
