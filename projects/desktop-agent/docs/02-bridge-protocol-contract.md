# 小蓝鲸桌面端 · 桥接协议契约

> 状态：已存档，实现方案待调研（2026-06-30 更新）
> ⏸️ 跨端实现推迟：跨端绑定方式（账号绑定 vs 设备直连 vs 云端中转）尚未调研确定。
>    参考方向：GPT 手机端+PC 的账号绑定方案、MiniMax 手机版+桌面版的方案。
>    本文档暂作"两套现有协议的备忘"保留，不作为一期实现依据。
>    调研完成、绑定方式确定后，本文档可能整体重写。
> 一期范围：桌面端仍预留 HubClient 接口签名（见第七章），但绑定/认证逻辑全部待定。

> 状态：地基文档（2026-06-30）
> 性质：定义桌面端与手机端、其他设备之间如何通信。语言无关，TS 侧和 Kotlin 侧都照此实现。
> 核查范围说明：本文档依据两份已核查的协议源码合并而成——mobile-agent 的 RemoteBridgeProtocol.kt（点对点直连，已实现）和 reference/desktop-claw 的 hub/protocol.ts（云端中转 Hub，已实现 V1+V2）。
> 一期范围：桌面端只预留能力位，不实现功能逻辑。本文档是二期打通时的实现依据，一期先按此预留接口签名。

---

## 一、两种拓扑，一个契约

两套已验证协议代表两种跨端拓扑，小蓝鲸要兼容两者：

| 拓扑 | 来源 | 谁中转 | 适用 |
|---|---|---|---|
| 点对点直连 | 手机端 RemoteBridgeProtocol | 无，设备间直连 WebSocket | 同局域网/已配对设备 |
| 云端中转 Hub | 参考 hub/protocol.ts | 云端 Hub 中转 | 异地、多设备、智能路由 |

**合并策略**：以云端 Hub 为主拓扑（支持异地和多设备），点对点作为 Hub 不可用时的降级直连模式。桌面端一期只实现 Hub 客户端的接口位（连接/心跳/收发），不实现路由逻辑。

---

## 二、设备模型（统一）

设备类型枚举（依据参考协议 device_type 字段）：

```
pc | phone | tablet | car | speaker | watch | string
```

桌面端固定为 `pc`，手机端固定为 `phone`。开放 string 允许未来扩展。

设备端点（依据参考 DeviceEndpoint）：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| device_type | string | 是 | 上方枚举 |
| device_id | string | 是 | 设备唯一 ID |
| device_name | string | 否 | 显示名 |

---

## 三、消息信封（统一）

所有跨端消息套同一个信封，无论走 Hub 还是直连。

| 字段 | 类型 | 必填 | 说明 | 来源 |
|---|---|---|---|---|
| version | string | 是 | 协议版本，当前 "bridge_v1" | 手机端 |
| message_id | string | 是 | 消息唯一 ID | 参考 |
| type | string | 是 | 消息类型（见第四章） | 两者 |
| source | DeviceEndpoint | 是 | 发起方 | 参考 |
| target | DeviceEndpoint | 是 | 接收方（直连时为对端，Hub 模式可为目标设备或 Hub） | 参考 |
| payload | object | 是 | 按类型不同的负载 | 两者 |
| timestamp | number | 是 | 毫秒时间戳 | 两者 |

差异处理：手机端用 requestId+deviceId，参考用 message_id+source/target。合并后统一用 message_id+source/target（更通用），requestId 作为某些 payload 内部的字段保留（如 TOOL_REQUEST 内）。

---

## 四、消息类型全集

分三组：连接维持、任务执行、跨端工具调用。

### 4.1 连接维持

| 类型 | 方向 | 负载 | 说明 |
|---|---|---|---|
| REGISTER / HELLO | 设备→Hub/对端 | RegisterPayload | 连接时认证，携带配对码和能力上报 |
| REGISTER_RESPONSE | Hub→设备 | RegisterResponsePayload | 注册结果：registered/rejected |
| HEARTBEAT | 双向 | HeartbeatPayload | 保活，参考 30s 间隔 |
| CAPABILITY_UPDATE | 设备→Hub | CapabilityUpdatePayload | 能力变化时上报 |

RegisterPayload 字段（合并两者）：
- device_type / device_id / device_name（必填）
- pairing_code（配对码，参考有）
- capabilities（能力列表，两者都有）
- scopes（权限范围，手机端有，保留）

### 4.2 任务执行（Hub 中转模式）

| 类型 | 方向 | 负载 | 说明 |
|---|---|---|---|
| TASK_DISPATCH | Hub→设备 | TaskDispatchPayload | Hub 派发任务给设备 |
| TASK_PROGRESS | 设备→Hub | TaskProgressPayload | 上报步骤进度 |
| TASK_RESULT | 设备→Hub | TaskResultPayload | 上报最终结果 |
| TASK_CANCEL | Hub→设备 | TaskCancelPayload | 取消任务 |

TaskDispatchPayload 关键字段：
- task_id / query（必填）
- exec_mode / max_steps / conversation_id（可选）
- source_device_*（注入来源信息）

TaskResultPayload 状态枚举：completed | failed | cancelled。

### 4.3 跨端工具调用（点对点直连模式 + Hub 路由）

| 类型 | 方向 | 负载 | 说明 |
|---|---|---|---|
| TOOL_REQUEST | 设备→设备/Hub | RemoteToolRequest | 调用对端的某个工具 |
| TOOL_RESPONSE | 对端→设备 | RemoteToolResponse | 工具执行结果 |
| CROSS_DEVICE_REQUEST | PC→Hub | CrossDeviceRequestPayload | 请求跨端执行（V2 智能路由） |
| CROSS_DEVICE_DISPATCHED | Hub→PC | CrossDeviceDispatchedPayload | 告知已分派到哪些设备 |
| CROSS_DEVICE_PROGRESS | 设备→PC（经Hub） | CrossDeviceProgressPayload | 子任务进度 |
| CROSS_DEVICE_RESULT | 设备→PC（经Hub） | CrossDeviceResultPayload | 子任务结果 |
| DEVICE_EVENT | 设备→Hub | DeviceEventPayload | 设备主动事件上报 |

RemoteToolRequest（依据手机端已实现，直连模式核心）：
- request_id / device_id / tool_name（必填）
- arguments（工具参数 Map）
- timeout_ms（默认 30000）

RemoteToolResponse（依据手机端已实现）：
- request_id / device_id / success（必填）
- payload（结果 Map）
- error（失败原因，可空）

---

## 五、V2 智能路由（二期目标态，一期不实现）

参考协议已设计 V2，小蓝鲸二期照此实现：

- SMART_ROUTE_REQUEST：带 routing_hints（偏好设备类型/ID/领域/排除设备）+ context（历史消息/用户偏好）+ max_steps_per_device。
- Hub 用 LLM 把请求拆成 ExecutionPlan（sub_tasks，strategy: parallel/sequential/dag，dependencies）。
- 各设备执行后回 SubTaskProgress / SubTaskResult。
- Hub 聚合成 SmartRouteResult（含 aggregated_summary）。

一期只预留：桌面端能接收 SMART_ROUTE 类消息的入口签名，但不处理路由逻辑。

---

## 六、可靠性与安全规则（依据两份已实现协议）

| 规则 | 值 | 来源 |
|---|---|---|
| 心跳间隔 | 30s | 手机端 |
| WebSocket ping 间隔 | 20s | 参考 |
| 工具调用超时 | 30s（可配） | 手机端 |
| 重连 | 失败后递增重试，上限后停止 | 参考 |
| 配对认证 | pairing_code 配对码 | 两者 |
| 能力上报 | REGISTER 时 + 变化时 CAPABILITY_UPDATE | 两者 |

**安全要求（对应设计基线第六章）**：
- 跨端工具调用必须经过权限审批，不能因为是"对端请求"就免审批。
- 桌面端作为被控方时，收到的 TOOL_REQUEST 同样要走本地 SAFE_TOOLS 白名单 + BLOCKED_PATTERNS 黑名单 + 风险分级。
- 云端 Hub 永不持有明文凭证，配对码只在设备端校验。

---

## 七、一期预留接口位（桌面端 TS 侧）

一期在 Agent 引擎内定义以下接口签名，但不实现功能逻辑：

```typescript
// 能力位：Hub 客户端接口（一期仅签名，二期填实现）
interface HubClient {
  connect(url: string, pairingCode: string): Promise<void>;
  disconnect(): void;
  register(capabilities: string[], scopes: string[]): Promise<void>;
  onTaskDispatch(handler: (task: TaskDispatchPayload) => void): void;
  onToolRequest(handler: (req: RemoteToolRequest) => Promise<RemoteToolResponse>): void;
  reportProgress(taskId: string, step: number, total: number, summary: string): void;
  reportResult(taskId: string, status: "completed"|"failed"|"cancelled", summary: string): void;
  sendHeartbeat(): void;
}
```

这样二期打通时，实现这个接口即可，不动 Agent 主循环和工具运行时架构。

---

## 八、本文档的边界

- 本文档定义协议契约，不定 TS/Kotlin 的具体类实现（那是代码层的事）。
- 凡是引用"手机端已实现"或"参考已实现"，指对应源码已跑通该协议字段；新项目照契约实现，不复制源码。
- V2 智能路由的字段虽已定义，但一期不实现，列为二期目标态。
- 与手机端的实际打通，需手机端也升级到本契约（手机端当前是点对点直连版，二期需补 Hub 客户端能力）——这是跨端工作量，单独评估。
