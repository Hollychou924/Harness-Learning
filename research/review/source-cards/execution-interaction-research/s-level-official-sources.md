# S 级官方权威资料调研摘要（6篇补充）

> 本文件补充入库首批遗漏的 6 篇 S 级资料，与 codex-series.md / claude-cursor-series.md / ux-methodology-series.md 合计覆盖全部 S+A 级文章。

---

## S-02 · OpenAI Codex CLI Features（官方）

**来源**：https://developers.openai.com/codex/cli/features （英文原文，已用 Scrapling 0.4.9 stealthy-fetch 直接获取完整正文，存于 `raw-openai-codex-cli-features.md`，648行）

**核心特性（原文直接核实）**：
- **Full-screen terminal UI**：Codex 启动全屏终端 UI，可读仓库、编辑、运行命令，支持对话式工作流，可实时 review Codex 的动作
- **改动前解释计划 + inline approve/reject**：Watch Codex explain its plan before making a change, and approve or reject steps inline
- **Diff 展示**：TUI 语法高亮 fenced markdown code blocks 和 file diffs，用 /theme 选主题，支持自定义 .tmTheme
- **截图/图片输入**：可粘贴截图或设计稿到 composer，或命令行 -i/--image 传图片（PNG/JPEG），与文字指令组合
- **图片生成**：可直接在 CLI 生成/编辑图片（gpt-image-2），用 $imagegen 调用
- **本地代码审查**：/review 命令启动专用 reviewer，读 diff 报告优先级问题，不碰工作树。支持 review base branch / uncommitted changes / 指定 commit / 自定义指令
- **Web 搜索**：内置第一方 web search 工具，默认开启，结果来自 OpenAI 维护的搜索缓存
- **会话恢复**：codex resume 恢复历史会话（保留 transcript/plan/approvals），支持 --last/--all/指定SESSION_ID

**审批模式（原文直接核实，三种）**：
- **Auto（默认）**：Codex 可在工作目录内读文件、编辑、运行命令。触及目录外或用网络前仍会问
- **Read-only**：咨询模式，可浏览文件但不改不执行，直到用户批准计划
- **Full Access**：跨机器工作含网络访问，不问。仅信任仓库和任务时慎用
- 用 /permissions 在会话中切换模式

**其他特性**：
- **Subagents**：并行化大任务，仅在用户明确要求时生成（消耗更多 token）
- **远程 TUI**：codex app-server + codex --remote，支持 WebSocket 连接远程 app server
- **MCP**：配置 STDIO 或 streaming HTTP 的 MCP server，Codex 自动启动并暴露工具
- **Scripting**：codex exec 非交互运行，管道输出到 stdout
- **Codex cloud**：codex cloud 命令在终端内 triage/启动云端任务，支持 --attempts best-of-N

**对交互设计的启示**：
- "实时 review actions" = 小蓝鲸右侧详情面板的工具日志
- "inline approve/reject" = 权限确认就地完成，不跳页（PRD 5.5）
- "explain plan before making a change" = 计划先行（PRD 5.2）
- "截图可直接进入上下文" = 图片作为上下文而非技术文件展示（PRD 5.6）
- "diff 语法高亮" = 文件修改以 diff 为第一优先级（PRD 5.3）
- 三种审批模式（Auto/Read-only/Full Access）= 小蓝鲸权限模式的参考，但小蓝鲸用用户听得懂的名字（Safe/Balanced/Auto），不照搬技术名
- "/review 专用 reviewer 不碰工作树" = 小蓝鲸质量校验步的参考，校验只读不写

---

## S-03 · Claude Code Desktop Docs（官方）

**来源**：https://code.claude.com/docs/en/desktop

**桌面应用核心结构**：
- 三个 Tab：Chat（对话）、Cowork（Dispatch + 长程 agentic 工作）、Code（软件开发）
- 每个 conversation 是一个 session：独立聊天历史、项目文件夹、代码变更
- 侧边栏列出所有 session，可并行运行多个

**输入框旁的四项配置**：
1. Environment：选择 Claude 在哪跑（Local 本机 / Remote Anthropic 云端 / SSH 远程机器）
2. Project folder：选择工作文件夹
3. Model：模型下拉选择，会话中可改
4. Permission mode：权限模式选择器，会话中可改

**Code tab 能力**：
- Review and comment on diffs，然后看 PR 走 CI
- 在内嵌浏览器中预览运行的应用，Claude 验证自己的改动
- 并排排列 chat、diff、preview、terminal、file editor 窗格
- Ask a side question：用 session 上下文问旁支问题，不打断主 session
- 连接外部工具（GitHub、Slack、Linear）
- 让 Claude 打开应用并控制屏幕（computer use）
- 本机/云端/SSH 运行

**对交互设计的启示**：
- "输入框旁配置四项" = 小蓝鲸输入框旁的模式+附件入口（PRD 3.2 状态A）
- "并行多个 session" = 小蓝鲸多任务并行（PRD 4.8 长任务防卡死中提到）
- "side question 不打断主 session" = 小蓝鲸的"追加要求"入口
- "内嵌浏览器预览 + Claude 自验" = Work 场景的验证证据
- Environment 选择（Local/Remote/SSH）= 小蓝鲸跨端的参考（一期预留接口位）

---

## S-04 · Claude Code Permission Modes（官方）

**来源**：https://code.claude.com/docs/en/permission-modes

**七种权限模式**：

| 模式 | 不问就做什么 | 适合 |
|---|---|---|
| default | 只读 | 入门、敏感工作 |
| acceptEdits | 读+文件编辑+常见文件系统命令(mkdir/touch/mv/cp) | 迭代审查中的代码 |
| plan | 只读 | 改之前先探索代码库 |
| auto | 一切，但有后台安全检查 | 长任务、减少审批疲劳 |
| dontAsk | 只有预批准工具 | 锁定的 CI 和脚本 |
| bypassPermissions | 一切 | 隔离容器和 VM only |

**模式切换入口**：
- CLI：Shift+Tab 循环 default → acceptEdits → plan
- Desktop：输入框旁的 mode selector（模式选择器）
- UI 标签映射：Ask before edits(default) / Edit automatically(acceptEdits) / Plan mode(plan) / Auto mode(auto) / Bypass permissions(bypassPermissions)

**关键设计**：
- 模式设基线，上面叠加 permission rules（allow/deny/ask）预批准或拦截特定工具
- 除 bypassPermissions 外，写入 protected paths 永不自动批准
- auto mode 需满足账户要求（Plan/Owner/Model/Provider）才出现
- bypassPermissions 需额外开关启用，不默认出现

**auto mode classifier 默认拦截清单**（关键）：
- 下载并执行代码（curl | bash）
- 向外部端点发送敏感数据
- 生产部署和迁移
- 云存储大规模删除
- 授予 IAM 或 repo 权限
- 修改共享基础设施
- 不可逆地销毁会话前已存在的文件
- force push、直接 push 到 main
- git reset --hard / git checkout -- . / git restore . / git clean -fd / git stash drop/clear
- git commit --amend（当 HEAD 的 commit 非本会话创建）
- terraform/pulumi/cdk destroy
- 写 secret manager、改 DNS/TLS
- 合并无人批准的 PR、批准自己的 PR、禁用 CI
- 切换/删除生产 feature flag
- 创建 DaemonSet/admission webhook 等集群级资源
- 打印 live credential 到 transcript

**对交互设计的启示**：
- 七种模式太多，小蓝鲸一期只暴露用户听得懂的 3 个：Safe/Balanced/Plan（PRD 5.5 + 12 权限模式指南）
- "模式选择器在输入框旁" = 小蓝鲸模式入口位置（PRD 3.2 状态A）
- auto mode 的 classifier 默认拦截清单 = 小蓝鲸 BLOCKED 黑名单的参考（05 权限规则已有 10 条，可对照补充 git 类危险操作）
- "protected paths 永不自动批准" = 小蓝鲸工作目录边界的强化版
- auto mode 需满足条件才出现 = 小蓝鲸 Auto 藏深，二期才启用（PRD 1.4 自治度滑块）

---

## S-05 · Cursor 3 官方博客：Meet the new Cursor

**来源**：https://cursor.com/blog/cursor-3

**核心理念：Agent-first workspace**：
- "新界面把用户拉到更高抽象层，同时保留深入查看能力（dig deeper when you want）"
- 从头构建新界面，围绕 agent 重新设计（不是 VS Code 扩展）

**All your agents in one place**：
- 新界面天生多工作区，人和 agent 可跨不同 repo 工作
- 所有 local 和 cloud agent 出现在侧边栏，包括从 mobile/web/desktop/Slack/GitHub/Linear 发起的

**Run many agents in parallel**：
- Cloud agents 产出 demos 和 screenshots 供用户验证
- 这和 cursor.com/agents 体验一致，现集成进桌面应用

**New UX for handoff between local and cloud**：
- 云端→本地：想自己编辑测试时，把 agent session 移到本地桌面
- 本地→云端：想让任务在你离线时继续跑，移到云端
- 对长任务尤其有用（否则合上笔记本就中断）

**Go from commit to merged PR**：
- 新 diffs view：更简单的 UI 编辑和 review changes
- 准备好后可 stage、commit、管理 PR

**Building on best features**：
- Files for understanding code：随时 dive deeper 看文件，LSP go to definition
- Integrated browser：内置浏览器打开、导航、prompt 本地网站
- Plugins on Cursor Marketplace：MCP/skills/subagents 扩展

**对交互设计的启示**：
- "更高抽象层 + 可下钻" = 小蓝鲸"默认轻展开重"的直接官方依据（PRD 主轴一）
- "所有 agent 在侧边栏" = 小蓝鲸左侧任务列表（08 线框图）
- "cloud agents 产出 demos 和 screenshots 供验证" = 小蓝鲸"结果验证比过程展示重要"（PRD 2.2 从 Cursor 借）
- "新 diffs view 用于 review/stage/commit/PR" = 小蓝鲸 Code 完成态的 diff 优先（PRD 8.5）
- "local/cloud handoff" = 小蓝鲸跨端接续的参考（一期预留接口位）

---

## S-07 · CopilotLens 论文：Beyond Autocomplete

**来源**：arXiv:2506.20062 — https://arxiv.org/abs/2506.20062
**作者**：Runlong Ye, Zeling Zhang, Boushra Almazroua, Michael Liut
**标题**：Beyond Autocomplete: Designing CopilotLens Towards Transparent and Explainable AI Coding Agents

**核心问题**：
- AI 代码助手通常只给建议不解释 rationale，决策过程不可见（inscrutable）
- 这种不透明阻碍开发者：批判性评估输出、形成准确心智模型、校准对系统的信任

**CopilotLens 方案**：
- 一个交互式框架，把代码补全从"简单建议"重构为"透明可解释的交互"
- 作为**解释层（explanation layer）**运行，重建 AI agent 的"思考过程"
- 通过**动态两级界面（dynamic two-level interface）**展示：
  - 高层：代码变更概览
  - 细节层：具体代码库上下文如何影响建议

**关键设计理念**：
- 不是直接展示原始思考链（raw chain-of-thought），而是重构为可解释的交互
- 两级界面 = 概览 + 下钻，呼应渐进式披露

**对交互设计的启示**：
- "解释层而非原始思考链" = 小蓝鲸"阶段意图"而非"原始思维链"的直接学术依据（PRD 3.1 + 4.4）
- "动态两级界面" = 小蓝鲸中间主区域（概览）+ 右侧详情（下钻）的结构依据（PRD 4.2）
- "重建思考过程"而非 dump = 小蓝鲸推理结构化摘要（借鉴 Max Gherman，CopilotLens 给了学术验证）
- 透明是为了"校准信任" = 呼应人人产品经理"过程可见建立信任"

---

## S-08 · Illuminating LLM Coding Agents 论文：Visual Analytics

**来源**：arXiv:2508.12555 — https://arxiv.org/abs/2508.12555
**作者**：Junpeng Wang, Yuzhong Chen, Menghai Pan, Chin-Chia Michael Yeh, Mahashweta Das
**标题**：Illuminating LLM Coding Agents: Visual Analytics for Deeper Understanding and Enhancement

**核心问题**：
- LLM coding agent 通过迭代问题解决自动生成代码，但 ML 科学家难以有效 review 和调整 agent 的编码过程
- 当前方法（手动检查单个输出）低效，难以追踪代码演进、对比编码迭代、识别改进机会

**可视化分析系统（三层）**：
1. **Code-Level Analysis**：代码级分析，看单次迭代的代码质量
2. **Iteration-Level Analysis**：迭代级分析，对比不同迭代的代码演进
3. **Agent-Level Analysis**：agent 级分析，看整体 agent 行为模式

**聚焦 AIDE 框架**，支持跨三层对比分析。

**对交互设计的启示**：
- 三层分析 = 小蓝鲸三层展示的学术依据：动作级（Code-Level）→ 阶段级（Iteration-Level）→ 任务级（Agent-Level）
- "追踪代码演进" = 小蓝鲸 Diff 查看器的历史维度（PRD 9.2）
- "对比编码迭代" = 小蓝鲸开发者视图的执行记录回放（PRD 6.2）
- "调试模式下用树状执行轨迹看 Agent 迭代过程" = 小蓝鲸开发者视图的完整 Trace（PRD 6.2 + 7.1），树状结构适合展示 ReAct 的分支/回溯
- 这篇论文支撑"开发者视图"的设计——普通用户不需要，但调试和审计必须有
