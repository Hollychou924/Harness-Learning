# 小蓝鲸桌面端 · Electron 三层通信契约

> 状态：开工前必读契约（2026-06-30）
> 性质：定主进程↔渲染进程↔Agent子进程三层怎么通信。AI 写第一行 IPC/stdio 代码照此，不自行发明通道名和消息格式。
> 核查范围说明：依据已核查的 reference/desktop-claw 的 bridge.ts（invoke/listen 模式）、agent/src/protocol.ts（ChatRequest/ChatResponse/事件消息）、agent_bridge.rs（stdio JSON Lines 转发）。适配到 Electron 的 IPC（contextBridge + ipcMain/ipcRenderer）。
> 架构反思对应：本文档补齐 00 反思日志里"Agent↔UI 事件流映射"的半缺口。

---

## 一、三层架构与通信方向

```
┌─────────────────────────────────────────────┐
│  渲染进程（React，WebView）                  │
│  用户操作 → 调 IPC 通道 → 收事件渲染         │
└──────────────────┬──────────────────────────┘
           IPC ↑↓  contextBridge
┌──────────────────▼──────────────────────────┐
│  主进程（Electron Main，Node.js）            │
│  - 管窗口/配置/定时任务/凭证                 │
│  - 启动并管理 Agent 子进程                   │
│  - 转发：渲染请求 → Agent stdin              │
│         Agent stdout → 渲染事件              │
└──────────────────┬──────────────────────────┘
        stdio ↑↓  JSON Lines（每行一条 JSON）
┌──────────────────▼──────────────────────────┐
│  Agent 子进程（Node.js，纯TS，不依赖Electron）│
│  - 跑 7步闭环 + ReAct                        │
│  - 流式产出事件到 stdout                     │
│  - 收 stdin 的请求和审批响应                 │
└─────────────────────────────────────────────┘
```

**关键约束**（对应 03 文档）：
- 渲染进程不得直接调 Node API，必须经 IPC。
- Agent 子进程不 import Electron，只读写 stdio。
- 主进程是唯一中转，负责把两边的消息对上。

---

## 二、渲染 ↔ 主进程：IPC 通道

Electron 用 `contextBridge.exposeInMainWorld` 暴露安全 API，渲染进程通过 `window.api.xxx` 调用。

### 2.1 渲染 → 主进程（invoke 调用，返回值）

| 通道名 | 参数 | 返回 | 作用 |
|---|---|---|---|
| `agent:startTask` | {mode, message, workspaceDir} | {taskId} | 发起任务，主进程转给 Agent |
| `agent:pause` | {taskId} | void | 暂停任务 |
| `agent:resume` | {taskId} | void | 恢复任务 |
| `agent:cancel` | {taskId} | void | 取消任务 |
| `agent:rollback` | {taskId} | {success} | 回滚任务 |
| `agent:respondApproval` | {requestId, approved} | void | 审批响应（转给 Agent stdin） |
| `agent:appendInput` | {taskId, message} | void | 追加要求 |
| `task:list` | {filter?} | Task[] | 查任务列表 |
| `task:get` | {taskId} | Task | 查任务详情 |
| `config:get` | {key} | any | 读配置 |
| `config:set` | {key, value} | void | 写配置 |
| `secret:get` | {keyName} | string | 取凭证（不返回明文给渲染，见约束） |
| `project:select` | {} | {path} | 选择项目目录对话框 |
| `artifact:get` | {artifactId} | {path, type} | 查产物 |
| `skill:list` | {} | Skill[] | 列能力 |

### 2.2 主进程 → 渲染（事件推送，listen 监听）

| 事件名 | payload | 触发时机 |
|---|---|---|
| `agent:event` | AgentEvent（见第三章） | Agent 产出任何事件，转发给渲染 |
| `agent:approvalRequest` | {requestId, toolName, args, riskLevel, impact, canRollback} | Agent 需审批时 |
| `task:statusChanged` | {taskId, status} | 任务状态机转移 |
| `task:progress` | {taskId, step, total, summary} | 步骤进度 |

**渲染侧监听**（参考已验证的 listen 模式）：
```typescript
window.api.onAgentEvent((event: AgentEvent) => { /* 更新 UI */ });
window.api.onApprovalRequest((req) => { /* 弹审批窗 */ });
```

---

## 三、主进程 ↔ Agent 子进程：stdio JSON Lines

### 3.1 协议约定

- 每条消息一行 JSON（JSON Lines），以 `\n` 分隔。
- 主进程写 Agent stdin，Agent 读 stdin 解析。
- Agent 写 stdout，主进程读 stdout 解析后转成 IPC 事件推给渲染。
- stderr 用于日志，不参与协议。

### 3.2 主进程 → Agent（stdin）

| type | 字段 | 作用 |
|---|---|---|
| `chat_request` | session_id, message, config, history?, attachments? | 发起/继续任务（参考已验证 ChatRequest） |
| `task_control` | task_id, action(pause/resume/cancel/rollback) | 任务控制 |
| `approval_response` | request_id, approved | 审批结果 |
| `append_input` | task_id, message | 追加要求 |

### 3.3 Agent → 主进程（stdout）

| type | 字段 | 作用 |
|---|---|---|
| `chunk` | text | 最终回复流式片段 |
| `thinking` | text | 思考过程（展示用） |
| `tool_call` | name, args, id | 工具调用计划 |
| `tool_result` | name, result | 工具执行结果 |
| `approval_request` | request_id, tool_name, args, risk_level, impact, can_rollback | 请求审批 |
| `usage` | inputTokens, outputTokens | token 用量 |
| `status` | status, message | 状态变化 |
| `step_progress` | task_id, step, total, summary | 步骤进度 |
| `artifact` | artifact_type, file_path | 产出产物 |
| `error` | message | 错误 |
| `completed` | task_id, summary | 任务完成 |

这些 type 与 04 文档的 AgentEvent 枚举对应，此处是其 stdio 传输形态。

---

## 四、消息流转完整示例（定位 bug 任务）

```
1. 用户点"开始" 
   渲染 → 主: agent:startTask {mode:"code", message:"修复login的500", workspaceDir}
2. 主进程启动/复用 Agent 子进程，写 stdin:
   {"type":"chat_request","session_id":"...","message":"修复login的500","config":{...}}
3. Agent 边跑边写 stdout:
   {"type":"thinking","text":"先读项目结构"}
   {"type":"tool_call","name":"read_file","args":{...},"id":"..."}
   {"type":"tool_result","name":"read_file","result":"..."}
   {"type":"approval_request","request_id":"...","tool_name":"shell",...}
4. 主进程读到 approval_request，转 IPC:
   主 → 渲染: agent:approvalRequest {...}
   渲染弹审批窗
5. 用户批准:
   渲染 → 主: agent:respondApproval {requestId, approved:true}
   主写 stdin: {"type":"approval_response","request_id":"...","approved":true}
6. Agent 继续跑，产出:
   {"type":"artifact","artifact_type":"diff","file_path":"..."}
   {"type":"completed","task_id":"...","summary":"已修复"}
7. 主进程转 IPC:
   主 → 渲染: task:statusChanged {status:"REVIEWING"}
   主 → 渲染: agent:event {type:"completed",...}
8. 渲染切到产物预览态
```

---

## 五、安全与约束

- **凭证不进渲染**：`secret:get` 在主进程取 key 后直接注入 Agent 的 config，不把明文 key 经 IPC 返回渲染。渲染只显示"已配置/未配置"状态。
- **contextBridge 隔离**：`contextIsolation: true`，渲染拿不到 Node require，只有 `window.api`。
- **stdin 非阻塞**：Agent 收到 `task_control` 要能及时响应暂停，不能因在跑长工具而卡死——工具执行间隙检查控制队列。
- **stdout 缓冲**：Agent 流式输出要 flush，避免 UI 卡住等不到 chunk。

---

## 六、本文件边界

- 不定 IPC 的具体序列化库（用 Electron 内置 JSON，够用）。
- 跨端 Hub 消息如何经此通道流转，待跨端调研后补（一期 HubClient 只在 Agent 侧预留接口，不经 IPC）。
- IM/定时任务等次要通道二期补。
