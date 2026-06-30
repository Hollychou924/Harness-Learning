# 小蓝鲸桌面端 · 数据与接口契约

> 状态：开工前必读契约（2026-06-30）
> 性质：字段级契约。AI 写代码时所有表结构、schema、状态机、接口签名都以此为准，禁止自行发明字段名。
> 核查范围说明：依据已核查的 reference/desktop-claw 的 protocol.ts（AgentConfig/AgentTool 等）、tools/index.ts，以及小蓝鲸文档第十一章、第八章能力卡、第十章状态机。手机端 RemoteBridgeEntities.kt 作为字段命名参考。
> 架构反思对应：本文档所有存储经接口抽象（见 03 文档第五章），业务代码不直接碰 better-sqlite3。

---

## 一、SQLite 表结构（8 张，对应小蓝鲸第十一章）

通用约定：
- 所有表有 `id`（TEXT 主键，UUID v4）、`created_at`、`updated_at`（INTEGER，毫秒时间戳）。
- 时间一律存毫秒时间戳（INTEGER），不存字符串，避免时区问题。
- JSON 字段存 TEXT，应用层用 Zod 校验解析。

### 1.1 task_store — 任务状态

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | TEXT | 是 | 任务 UUID |
| mode | TEXT | 是 | "code" \| "work" |
| goal_contract | TEXT | 是 | JSON:目标契约(见第三章) |
| plan_dag | TEXT | 否 | JSON:计划图,一期可为单链路 |
| status | TEXT | 是 | 任务状态机(见第二章) |
| current_step | INTEGER | 否 | 当前执行到第几步(1-7) |
| summary | TEXT | 否 | 任务摘要(状态沉淀产物) |
| parent_task_id | TEXT | 否 | 父任务(预留多Agent,一期不用) |
| created_at/updated_at | INTEGER | 是 | 时间戳 |

索引：status（查进行中任务）、created_at（任务列表排序）。

### 1.2 event_log — 事件日志（Trace）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | TEXT | 是 | 事件 UUID |
| task_id | TEXT | 是 | 关联任务 |
| event_type | TEXT | 是 | 见第四章事件枚举 |
| tool_name | TEXT | 否 | 工具调用时填 |
| tool_args | TEXT | 否 | JSON:工具入参 |
| tool_result | TEXT | 否 | JSON:工具结果 |
| approved | INTEGER | 否 | 0/1,是否经审批 |
| error | TEXT | 否 | 错误信息 |
| iteration | INTEGER | 否 | ReAct 第几轮 |
| token_usage | TEXT | 否 | JSON:{input,output} |
| created_at | INTEGER | 是 | 时间戳 |

索引：task_id（查任务全流程）、created_at（时序回放）。

### 1.3 workspace_index — 工作区索引

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | TEXT | 是 | UUID |
| workspace_path | TEXT | 是 | 项目/文件夹绝对路径 |
| file_path | TEXT | 是 | 相对路径 |
| symbol | TEXT | 否 | 代码符号/文档标题 |
| chunk_text | TEXT | 否 | 分块文本(向量召回用) |
| embedding | BLOB | 否 | 向量(float32数组序列化) |
| indexed_at | INTEGER | 是 | 索引时间 |

索引：workspace_path、symbol。向量检索在应用层做 cosine（对应 03 文档不绑死 sqlite-vec）。

### 1.4 memory_store — 记忆

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | TEXT | 是 | UUID |
| memory_type | TEXT | 是 | "task" \| "workspace" \| "preference" \| "conversation_summary" |
| scope | TEXT | 否 | 关联项目/任务 ID |
| name | TEXT | 是 | 记忆条目名 |
| content | TEXT | 是 | 记忆内容 |
| embedding | BLOB | 否 | 向量(语义召回用) |
| expires_at | INTEGER | 否 | 过期时间(会话摘要类用) |
| created_at/updated_at | INTEGER | 是 | 时间戳 |

索引：memory_type、scope。

### 1.5 artifact_store（文件系统为主，DB 存元数据）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | TEXT | 是 | UUID |
| task_id | TEXT | 是 | 关联任务 |
| artifact_type | TEXT | 是 | "diff"\|"report"\|"file"\|"preview"\|"evidence"\|"task_summary" |
| file_path | TEXT | 是 | 文件系统绝对路径 |
| mime_type | TEXT | 否 | 文件类型 |
| reviewed | INTEGER | 否 | 0/1,用户是否审阅 |
| created_at | INTEGER | 是 | 时间戳 |

### 1.6 snapshot_store（文件系统存快照，DB 存索引）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | TEXT | 是 | UUID |
| task_id | TEXT | 是 | 关联任务 |
| snapshot_path | TEXT | 是 | 快照目录绝对路径 |
| affected_files | TEXT | 否 | JSON:受影响文件列表 |
| created_at | INTEGER | 是 | 时间戳 |

### 1.7 skill_registry — 能力注册中心

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | TEXT | 是 | UUID |
| name | TEXT | 是 | 能力名(唯一) |
| type | TEXT | 是 | "native_tool"\|"skill"\|"mcp"\|"plugin" |
| mode | TEXT | 是 | "code"\|"work"\|"common" |
| description | TEXT | 是 | 能力描述 |
| trigger_keywords | TEXT | 否 | JSON:触发词数组 |
| input_schema | TEXT | 否 | JSON:Zod/JSON Schema |
| output_format | TEXT | 否 | 输出格式说明 |
| permission_type | TEXT | 是 | "read"\|"write"\|"external_action" |
| risk_level | TEXT | 是 | "low"\|"medium"\|"high"\|"critical" |
| supports_rollback | INTEGER | 否 | 0/1 |
| needs_confirmation | INTEGER | 否 | 0/1 |
| version | TEXT | 是 | 版本号 |
| enabled | INTEGER | 是 | 0/1 |
| health_status | TEXT | 否 | "ok"\|"degraded"\|"down" |
| created_at/updated_at | INTEGER | 是 | 时间戳 |

索引：mode、type、risk_level。

### 1.8 secret_store — 凭证（系统安全存储，DB 只存引用）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | TEXT | 是 | UUID |
| key_name | TEXT | 是 | 凭证名(如 "deepseek_api_key") |
| provider | TEXT | 是 | "deepseek"\|"anthropic"\|"openai"\|"embedding" |
| storage_ref | TEXT | 是 | 系统安全存储的引用(keychain service/account) |
| created_at/updated_at | INTEGER | 是 | 时间戳 |

**明文 key 永不入 DB、不入配置文件**，只经 SecretStore 接口从 keychain 取。

---

## 二、任务状态机（对应小蓝鲸第十章）

```
                        ┌──────────┐
            创建 ──────▶│ PENDING  │
                        └────┬─────┘
                             │ Preflight 通过
                             ▼
                        ┌──────────┐
                        │ PLANNING │◀──┐ 重规划
                        └────┬─────┘  │
                             │        │
                             ▼        │
                        ┌──────────┐  │
              ┌────────│EXECUTING │──┘
              │         └────┬─────┘
              │ 需审批        │ 完成
              ▼              ▼
        ┌──────────┐   ┌──────────┐
        │AWAITING_ │   │REVIEWING │
        │CONFIRM   │   └────┬─────┘
        └────┬─────┘        │ 用户确认
             │              ▼
             │         ┌──────────┐
             └────────▶│COMPLETED │
                       └──────────┘
              任意态 ──▶ PAUSED(暂停) ──▶ 回原态
              任意态 ──▶ FAILED(失败)
              任意态 ──▶ CANCELLED(取消)
```

状态枚举（精确值）：
`PENDING | PLANNING | EXECUTING | AWAITING_CONFIRM | REVIEWING | COMPLETED | PAUSED | FAILED | CANCELLED`

转移规则（AI 实现时必须遵守）：
- PENDING→PLANNING：Preflight 判定进入长任务。
- PLANNING→EXECUTING：计划生成完成。
- EXECUTING→AWAITING_CONFIRM：遇高风险需审批。
- AWAITING_CONFIRM→EXECUTING：用户批准；→FAILED/CANCELLED：拒绝。
- EXECUTING→REVIEWING：所有步骤执行完。
- REVIEWING→COMPLETED：用户确认产物。
- PAUSED 可从 EXECUTING/PLANNING 进入，恢复回原态。
- FAILED/CANCELLED/COMPLETED 是终态，不可回退。

---

## 三、Goal Contract（目标契约，对应小蓝鲸第 5.1 节）

任务创建时必填的 JSON 结构：

```typescript
interface GoalContract {
  task_type: "code" | "work";
  user_goal: string;           // 用户目标
  do_not: string[];            // 不做什么(禁止改动范围)
  constraints: string[];       // 约束条件
  inputs: string[];            // 输入资料(文件/网页路径)
  available_tools: string[];   // 可用工具名
  high_risk_actions: string[]; // 高风险动作
  deliverables: string[];      // 交付物
  acceptance_criteria: string[]; // 验收标准
  needs_user_confirm: boolean; // 是否需用户确认
}
```

---

## 四、Agent 事件枚举（对应参考 AgentEvent）

event_log 的 event_type 取值：

`RUN_STARTED | THINKING | TOOL_CALL_PLANNED | TOOL_CALL | TOOL_RESULT | APPROVAL_REQUESTED | REVIEW_COMPLETED | FINAL_ANSWER_CHUNK | USAGE | COMPLETED | ERROR | PAUSED | RESUMED`

---

## 五、核心接口签名（TS，AI 实现照此）

### 5.1 AgentTool（依据参考已验证）

```typescript
interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
  execute: (args: Record<string, unknown>) => Promise<string>;
}
```

### 5.2 LlmProvider（可替换抽象）

```typescript
interface LlmProvider {
  stream(
    messages: AgentMessage[],
    config: AgentConfig,
    tools: AgentTool[]
  ): AsyncGenerator<LLMResponse>;
}
```

### 5.3 HubClient（一期仅签名，见 02 文档）

照 02 文档第七章，不重复。

### 5.4 SecretStore / VectorStore / TaskStore

```typescript
interface SecretStore { get(keyName: string): Promise<string | null>; set(keyName: string, value: string): Promise<void>; }
interface VectorStore { index(id: string, embedding: number[], meta: object): Promise<void>; search(query: number[], topK: number): Promise<Array<{id: string; score: number; meta: object}>>; }
interface TaskStore { create(c: GoalContract, mode: string): Promise<Task>; get(id: string): Promise<Task | null>; updateStatus(id: string, status: TaskStatus): Promise<void>; list(filter: object): Promise<Task[]>; }
```

---

## 六、AgentConfig（依据参考已验证，适配小蓝鲸）

```typescript
interface AgentConfig {
  model_provider: string;      // "deepseek" | "anthropic" | "openai"
  model_name: string;
  api_base_url: string;        // DeepSeek: https://api.deepseek.com/v1
  max_iterations: number;      // ReAct 上限
  max_tokens: number;
  temperature: number;
  timeout: number;             // 首 token 超时(秒)
  language: string;            // "zh"
  api_format: "openai" | "anthropic" | "google";
  context_length: number;      // 上下文窗口
  user_workspace_dir: string;  // 允许写入的工作区
  embedding?: { api_base_url: string; model: string }; // key 经 SecretStore,不在此
}
```

api_key 不在 config 里，经 SecretStore 按 provider 取。

---

## 七、本文档边界

- 不定 UI 组件结构（那是 UI 文档）。
- 跨端相关表（账号/会话/设备绑定）暂缺，待跨端调研后补——这是显式缺口，不阻塞一期编码（一期不实现跨端）。
- 状态机的实现细节（如何触发转移）属代码层，本文只定值和规则。
