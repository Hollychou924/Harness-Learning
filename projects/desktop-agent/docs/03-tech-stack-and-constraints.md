# 小蓝鲸桌面端 · 技术选型与约束手册

> 状态：开工前必读契约（2026-06-30）
> 性质：AI 干活时选库、定配置、排目录的唯一依据。凡选型已定的，禁止擅自换；约束规则必须遵守。
> 核查范围说明：选型依据来自已核查的 reference/desktop-claw 的 package.json、providers/、memory/embeddings.ts、tauri.conf.json，以及小蓝鲸文档第十三章、你已锁定的三个决策。
> 架构反思待办收口：本文档强制"关键依赖通过接口抽象，不绑死实现"（见第五章），回应 00 号反思日志的待办项。

---

## 一、整体技术栈（已锁定）

| 层 | 技术 | 依据 |
|---|---|---|
| 桌面壳 | Electron（主进程 Node.js） | 已锁定决策一 |
| 前端框架 | React 18 + TypeScript | 参考已验证；组件生态成熟 |
| 构建 | Vite（渲染） + tsc（Agent） | 参考已验证 |
| 样式 | Tailwind CSS | 参考已验证；快速且一致 |
| Agent 引擎 | Node.js 子进程（TypeScript，ESM） | 已锁定决策一；参考已验证子进程隔离 |
| 包管理 | pnpm | 参考已用；monorepo 友好 |
| 校验 | Zod | 参考已用；运行时 schema 校验防幻觉 |

**为什么 ESM**：参考用 `"type": "module"`，Node 子进程跑 ESM。统一 ESM 避免 CJS/ESM 混用地狱。

---

## 二、目录结构（开工第一件事就按此建）

```
desktop-agent/
├── docs/                    # 设计文档(已完成00-02,待续03-07)
├── package.json             # 根包,管理 monorepo
├── pnpm-workspace.yaml
├── packages/
│   ├── main/                # Electron 主进程
│   │   ├── src/
│   │   │   ├── main.ts          # 入口:窗口/托盘/生命周期
│   │   │   ├── ipc/             # 与渲染进程的 IPC 通道
│   │   │   ├── agent-bridge.ts  # Agent 子进程管理(stdio 收发)
│   │   │   ├── scheduled-tasks/ # 定时任务调度
│   │   │   └── config/          # 配置持久化
│   │   └── package.json
│   ├── renderer/            # React 渲染进程
│   │   ├── src/
│   │   │   ├── pages/           # Code/Work 双 Tab 等
│   │   │   ├── components/
│   │   │   ├── store/           # Zustand 状态
│   │   │   └── api/             # 调主进程 IPC 的桥接
│   │   └── package.json
│   └── agent/              # Agent 引擎(子进程,纯TS,不依赖Electron)
│       ├── src/
│       │   ├── index.ts         # 入口:stdio 消息分发
│       │   ├── loop/            # 7步闭环 + ReAct 引擎
│       │   ├── tools/           # 工具注册+安全闸
│       │   ├── mcp/             # MCP 客户端
│       │   ├── memory/          # 四层记忆
│       │   ├── providers/       # 模型 provider(接口抽象)
│       │   ├── skills/          # Skill 加载
│       │   ├── prompt/          # 系统提示词构建
│       │   └── hub/             # 跨端能力位(一期仅接口签名)
│       └── package.json
└── build/                   # electron-builder 配置(三端打包)
```

**关键约束**：`packages/agent/` 不得依赖任何 Electron API。它是纯 Node 进程，通过 stdio 和主进程通信。这条保证 Agent 引擎可独立测试、可未来脱离 Electron 复用（对应架构反思"可演进性"维度）。

---

## 三、具体依赖选型（每条记 why）

### 3.1 模型调用

| 项 | 选定 | 考虑过 | 放弃原因 |
|---|---|---|---|
| 主模型 SDK | 官方 SDK（`@anthropic-ai/sdk` / `openai`） | 裸 fetch | SDK 处理流式/重试/类型，省手且更稳 |
| 一期接入 | DeepSeek 为主（OpenAI 兼容）+ Anthropic 预留 | 本地模型 | 你已锁定:一期只云端API |
| provider 抽象 | 自建 `LlmProvider` 接口 | 直接调 SDK | 多模型可换,参考已验证此模式 |

**DeepSeek 怎么接**：DeepSeek 是 OpenAI 兼容协议，用 `openai` SDK 配 `baseURL` 指向 DeepSeek 即可，不需要专用 SDK。这正好契合"一期接 DeepSeek"。

### 3.2 本地存储（4 层记忆的承载）

| 项 | 选定 | 考虑过 | 放弃原因 |
|---|---|---|---|
| SQLite 绑定 | better-sqlite3 | node:sqlite(实验性) | better-sqlite3 成熟稳定;node:sqlite 仍实验性 |
| 向量检索 | 自建:embedding 云端生成 + 本地 cosine | sqlite-vec | sqlite-vec 较新;参考用纯 cosine 已验证可行 |
| embedding 来源 | OpenAI 兼容 embedding API(云端) | 本地模型 | 你已锁定:一期不本地模型;参考已验证云端embedding |

**为什么向量层不绑死 sqlite-vec**：参考用"云端生成 embedding + 本地存 + cosine 计算"已跑通，一期照此。若后期数据量大，再评估 sqlite-vec 或专门向量库——这是显式扩展点（对应架构反思"不过度设计"）。

### 3.3 MCP 与工具

| 项 | 选定 | 依据 |
|---|---|---|
| MCP SDK | `@modelcontextprotocol/sdk` | 参考已用,官方实现 |
| WebSocket(跨端能力位) | `ws` | 参考已用;一期只预留不实现 |
| 工具校验 | Zod schema | 参考已用;每个工具输入用 Zod 校验防幻觉 |

### 3.4 前端

| 项 | 选定 | 考虑过 | 放弃原因 |
|---|---|---|---|
| 状态管理 | Zustand | Redux | Zustand 轻量,参考已用;Agent 状态多流式更新,Zustand 更顺手 |
| Markdown 渲染 | react-markdown + remark/rehype 插件 | 自写 | 参考已用全套;产物预览必需 |
| 代码高亮 | react-syntax-highlighter | — | 参考(Diff 预览必需) |

### 3.5 构建与打包

| 项 | 选定 | 依据 |
|---|---|---|
| 渲染构建 | Vite | 参考已用 |
| Agent 构建 | tsc(输出 ESM) | 参考已用;子进程跑编译后 JS |
| 三端打包 | electron-builder | 对应小蓝鲸第十四章三端目标 |
| Mac 产物 | universal(arm64+x64).dmg | 小蓝鲸第十四章 |
| Win 产物 | NSIS .exe | 小蓝鲸第十四章 |
| Linux 产物 | AppImage | 小蓝鲸第十四章 |
| 一期优先 | Mac | 你已锁定 |

---

## 四、约束规则（AI 干活必须遵守）

### 4.1 代码风格

- TypeScript strict 模式必开。
- ESM，禁用 CommonJS（`require`）。
- 中文注释/用户文案用全角标点（对齐 series 写作规范）。
- 不加版权头（对齐全局规则）。

### 4.2 依赖准入

- 新增 npm 包必须能说清 why，且优先用已选型清单内的。
- 禁用许可证不明的包。
- 安全相关:不引入会执行远程脚本的依赖。

### 4.3 安全约束（对应设计基线第五章）

- Shell 工具必须过 BLOCKED_PATTERNS 黑名单 + 工作目录边界 + 超时。
- 写操作必须过 SAFE_TOOLS 白名单判定,非白名单一律审批。
- 凭证(api key)只存系统安全存储(keychain/Credential Vault),禁止硬编码、禁止明文落配置文件。

### 4.4 进程边界

- Agent 引擎不得 import Electron。
- 渲染进程不得直接调 Node API,必须经 IPC。
- 主进程不得跑长任务(交给 Agent 子进程),避免阻塞 UI。

### 4.5 测试约束

- `packages/agent/` 必须可独立跑测试(不启动 Electron)。
- 工具安全闸必须有测试(对应参考 `__tests__/tools-safety.test.ts`)。

---

## 五、接口抽象要求（回应架构反思待办）

为满足"可替换性"维度,以下必须通过接口抽象,不绑死实现:

| 抽象点 | 接口名(暂定) | 可替换的实现 |
|---|---|---|
| 模型调用 | `LlmProvider` | DeepSeek/Anthropic/OpenAI/未来本地 |
| 向量召回 | `VectorStore` | 自建cosine/sqlite-vec/未来向量库 |
| 结构化存储 | `TaskStore`/`MemoryStore` 等 | better-sqlite3/未来其他 |
| 跨端通信 | `HubClient`(见02文档) | 云端Hub/直连/未来账号绑定 |
| 凭证存储 | `SecretStore` | keychain/Credential Vault |

AI 实现时,业务代码只依赖接口,不直接依赖具体库。这条是硬约束。

---

## 六、子决策(已确认 2026-06-30)

1. **embedding 模型**:用字节 embedding 模型。key 由用户后续提供,经 SecretStore 存储,不落配置文件。api_base_url/model 写入 AgentConfig.embedding。
2. **Mac 最低系统版本**:macOS 12+(Electron 稳定支持底线)。
3. **代码格式化**:上 prettier + eslint(生产级必需,参考未配但本项目补上)。

> 注:embedding 用字节模型而非 DeepSeek/OpenAI,因此 embedding key 与主模型 key 独立,各自走 SecretStore。embedding 的 api_base_url/model 在编码时据字节模型文档填入。
