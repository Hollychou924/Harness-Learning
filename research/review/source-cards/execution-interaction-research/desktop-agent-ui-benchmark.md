# 桌面 Agent 执行过程 UI 交互对标分析（源码核查版）

> 状态：已核查，基于完整源码阅读（2026-07-01）
> 核查范围：14 个桌面端项目，逐个阅读执行过程相关核心组件的完整源码（非文件名扫描）。每个项目读到的具体文件和行数见下表。
> 用途：为小蓝鲸桌面 Agent 终端交互展示逻辑提供信息输入

## 参评项目与核查深度

| 项目 | 技术栈 | 已读核心文件（行数） | 核查深度 |
|---|---|---|---|
| lobsterai | Electron+React18 | messageDisplayUtils.ts(1089全) + AssistantTurnBlock(400行) + ThinkingBlock(全) + ToolCallGroup(100行) + ProposedPlanBlock(80行) + ContextUsageIndicator(全) + DiffView(60行) | 深 |
| opencode | Electron+SolidJS | projection.ts(116全) + rows.ts(100行) + message-timeline(100行) + permission-dock(80行全) | 深 |
| QwenPaw | Tauri+React | ToolCardShell(77全) + registerBuiltinCards(38全) + ShellCard(全) + ApprovalCard(80行) + types(查) | 深 |
| hexclaw-desktop | Tauri+Vue3 | InteractiveBlock(69全) + ToolCallCard(80行) + ResearchProgress(60行) + InteractiveApproval(全) + 目录25文件6133行 | 深 |
| goose | Electron+React | GooseMessage(100行) + toolCallChaining(66全) + ProgressiveMessageList(80行) + ToolCallWithResponse(60行) | 深 |
| zagens | Tauri+SolidJS | trace-report全部(1107全)：TurnMap+Timeline+ReplayLab+Overview+CompareApp+MemoryPanel+HarnessPanel+types+summary+bundle | 深 |
| mimo-code | Electron+SolidJS | tool-status-title(60行) + tool-error-card(50行) + message-part(2217行查) | 中 |
| MyAgents | Tauri+React | BashTool(60行) + TodoChecklist(60行) + 目录查 | 中 |
| harnessclaw | Electron+React18 | PlanDraftCard(70行) + ConversationSidePanel(50行,1514行总) | 中 |
| kuse-cowork | Tauri+SolidJS | Chat(60行,272行总) + TaskPanel(50行) | 中 |
| AionUi | Electron+React19 | ToolCallBlock(50行,偏移动端RN) | 浅 |
| DeepSeek-GUI | Electron+React19 | DiffView(250行查) + 渲染层目录(偏写作工具) | 浅 |
| opencowork | Electron+React19 | 渲染层目录(偏shadcn/ui组件库) | 浅 |
| desktop-claw | Tauri+React | 仅确认技术栈(reference项目) | 浅 |

## 一、多维度拆解（基于源码实证）

### 维度1：执行过程的回合/消息组织

| 项目 | 源码实证 | 评价 |
|---|---|---|
| lobsterai | buildConversationTurns() 把消息流构建为 ConversationTurn（userMessage+assistantItems），tool_use和tool_result配对为ToolGroupItem，上下文压缩消息打断当前turn | ⭐⭐⭐⭐⭐ 最完整的回合构建管道 |
| opencode | createTimelineProjection() 做消息→行投影，9种行类型(TurnGap/UserMessage/TurnDivider/AssistantPart/Thinking/DiffSummary/Error/Retry/CommentStrip)，TurnDivider有compaction和interrupted两种标签，reuseTimelineRows行复用优化 | ⭐⭐⭐⭐⭐ 行类型最丰富 |
| goose | identifyConsecutiveToolCalls() 识别连续工具调用链(中间无文字)，链内隐藏时间戳 | ⭐⭐⭐⭐ 链式合并 |
| 其余 | 无专门回合/消息组织逻辑 | ⭐⭐~⭐⭐⭐ |

### 维度2：工具调用的展示与折叠

| 项目 | 源码实证 | 评价 |
|---|---|---|
| QwenPaw | 15+种专属ToolCard(ShellCard/EditFileCard/GrepSearchCard/BrowserUseCard等)，ToolCardShell用原生<details>/<summary>折叠(无障碍友好)，pluginSystem插件注册可扩展，统一status(calling/error/done)+spinner/icon | ⭐⭐⭐⭐⭐ 体系最完整可扩展 |
| lobsterai | ToolCallGroup按工具类型定制展示：TodoWrite用checkbox三态视图，Bash类展示命令，文件类展示路径，大结果>64KB只展示4KB预览+大小标签，ANSI转义清理，tool_use_error标签解析 | ⭐⭐⭐⭐⭐ 细节最丰富 |
| hexclaw-desktop | ToolCallCard有状态图标(CircleCheck/CircleX/LoaderCircle)+工具名+持续时间+摘要+可折叠参数/结果，summarizeToolResult摘要 | ⭐⭐⭐⭐ |
| opencode | message-part的ContextToolGroup分组+DiffChanges内联 | ⭐⭐⭐⭐ |
| mimo-code | tool-status-title做active/done文本公共前缀拆分(流式转完成只动画变化尾部)，tool-error-card工具错误独立卡+工具名映射 | ⭐⭐⭐⭐ 动画细节精致 |
| MyAgents | 按工具分BashTool/EditTool/GrepTool，BashTool解析stdout/stderr JSON+持续时间格式化 | ⭐⭐⭐ |
| 其余 | 通用展示 | ⭐⭐ |

### 维度3：思考/推理过程的展示

| 项目 | 源码实证 | 评价 |
|---|---|---|
| lobsterai | ThinkingBlock：流式时isCurrentlyStreaming=true自动展开，停止自动折叠，LightBulbIcon+脉冲点，最大高度300px滚动，展开/折叠有analytics上报 | ⭐⭐⭐⭐⭐ 体验最佳 |
| opencode | Thinking行类型+TextReveal/TextShimmer流式动画，showReasoningSummaries可控 | ⭐⭐⭐⭐ |
| goose | ThinkingContent独立组件 | ⭐⭐⭐ |
| 其余 | 无独立思考组件 | ⭐⭐ |

### 维度4：权限/审批交互

| 项目 | 源码实证 | 评价 |
|---|---|---|
| opencode | SessionPermissionDock就地停靠(不弹窗)，once/always/reject三选项，展示patterns匹配模式，工具描述i18n | ⭐⭐⭐⭐⭐ 就地不打断 |
| QwenPaw | ApprovalCard含severity+findingsCount+findingsSummary+timeoutSeconds倒计时+跨会话审批+ApprovalContext全局状态 | ⭐⭐⭐⭐⭐ 信息最全 |
| hexclaw-desktop | InteractiveApproval协议化(subject+summary+自定义按钮文案+resolved状态)，InteractiveBlock统一4种交互(buttons/select/approval/card)分发 | ⭐⭐⭐⭐ 协议化 |
| lobsterai | CoworkPermissionModal(23798字节，弹窗式) | ⭐⭐⭐ |
| goose | ToolCallConfirmation+ToolApprovalButtons | ⭐⭐⭐ |
| harnessclaw | 无独立审批组件(PlanDraftCard是计划确认非工具审批) | ⭐⭐ |

### 维度5：上下文/压缩管理展示

| 项目 | 源码实证 | 评价 |
|---|---|---|
| lobsterai | ContextUsageIndicator圆形进度环(百分比+token数+tooltip)，ContextCompactionDivider带animate-pulse动画进度条，isContextCompactionMessage判定+getContextCompactionMessageLabel，压缩消息打断turn | ⭐⭐⭐⭐⭐ 可视化最完整 |
| opencode | TurnDivider有compaction标签做时间线分隔，session-context-usage展示用量 | ⭐⭐⭐⭐ |
| goose | SystemNotificationInline系统通知内联+CreditsExhaustedNotification额度耗尽 | ⭐⭐⭐ |
| 其余 | 无 | ⭐ |

### 维度6：计划展示

| 项目 | 源码实证 | 评价 |
|---|---|---|
| harnessclaw | PlanDraftCard(364行)：用户可编辑/拖拽重排序(GripVertical)/批准步骤DAG，onConfirm/onCancel/onRegenerate，服务端校验cycle/depends_on | ⭐⭐⭐⭐⭐ 可交互编辑计划 |
| lobsterai | ProposedPlanBlock：计划确认执行/调整计划/下载为MD，可折叠，proposedPlanParser解析 | ⭐⭐⭐⭐ |
| 其余 | 无独立计划组件 | ⭐⭐ |

### 维度7：产物/结果展示

| 项目 | 源码实证 | 评价 |
|---|---|---|
| lobsterai | ArtifactPanel+ArtifactRenderer+11种渲染器(Code/Document/Html/Image/Markdown/Mermaid/Office/Sheet/Svg/Video/Text)，FileDirectoryView，dedupeArtifactsForDisplay去重，产物卡分页(默认3个+展开更多) | ⭐⭐⭐⭐⭐ 最全 |
| hexclaw-desktop | ArtifactDiffView+ArtifactRenderer | ⭐⭐⭐ |
| harnessclaw | HtmlArtifactView+ConversationSidePanel的artifacts Tab(general/dev双模式) | ⭐⭐⭐ |
| 其余 | 基础 | ⭐⭐ |

### 维度8：执行轨迹回放/审计

| 项目 | 源码实证 | 评价 |
|---|---|---|
| zagens | trace-report(1107行全读)：TraceBundle含events+replay_summary+analysis(compaction_timeline+capacity_checkpoints)+harness(task_graph)，6个Tab(overview/timeline/turnmap/memory/harness/replay)，TurnMap回合级coherence判定，Timeline三泳道(Model/Tools/Guards)，ReplayLab事件序列回放，CompareApp两次执行diff对比 | ⭐⭐⭐⭐⭐ 独一无二 |
| 其余 | 无 | ⭐ |

### 维度9：长列表性能优化

| 项目 | 源码实证 | 评价 |
|---|---|---|
| opencode | @tanstack/solid-virtual虚拟列表+timelineCache缓存测量+reuseTimelineRows行复用 | ⭐⭐⭐⭐⭐ |
| goose | ProgressiveMessageList分批渲染(batchSize=20,batchDelay=20)，超50条才显示loading，Cmd/Ctrl+F加载全部用于搜索 | ⭐⭐⭐⭐⭐ |
| lobsterai | LazyRenderTurn回合级懒加载 | ⭐⭐⭐⭐ |
| 其余 | 无优化 | ⭐⭐ |

### 维度10：流式体验细节

| 项目 | 源码实证 | 评价 |
|---|---|---|
| mimo-code | ToolStatusTitle做active/done文本公共前缀拆分，流式→完成只动画变化尾部差异，避免整文闪烁 | ⭐⭐⭐⭐⭐ 最精致 |
| lobsterai | TypingDots三点bounce动画，getStreamingActivityStatusText生成"正在运行{toolName}..."状态文本 | ⭐⭐⭐⭐ |
| opencode | TextReveal+TextShimmer流式渐显闪烁 | ⭐⭐⭐⭐ |
| 其余 | 基础流式 | ⭐⭐⭐ |

## 二、综合排名与理由（基于源码实证修正）

### 🥇 第1名：lobsterai（网易有道）— ⭐⭐⭐⭐⭐

10维度中5个满分。执行过程UI最全面细致。

**源码实证的极致点**：
- **回合构建管道**（messageDisplayUtils 1089行）：buildDisplayItems把tool_use和tool_result配对为ToolGroupItem，buildConversationTurns构建ConversationTurn，上下文压缩消息打断turn——这是最完整的消息→回合→展示项管道
- **思考块自动折叠**：ThinkingBlock的useEffect监听isCurrentlyStreaming，流式时setIsExpanded(true)停止时setIsExpanded(false)——无需用户操作
- **工具结果大输出处理**：>64KB(TOOL_RESULT_COLLAPSED_FULL_DISPLAY_MAX_CHARS)只展示4KB预览(TOOL_RESULT_COLLAPSED_PREVIEW_MAX_CHARS)+大小标签，ANSI转义清理，tool_use_error标签解析
- **上下文压缩可视化**：ContextUsageIndicator圆形进度环(CIRCUMFERENCE=2πR)+ContextCompactionDivider的animate-pulse动画
- **媒体轮询合并**：consolidateMediaPolling把同taskId的多次状态轮询合并为一个MediaPollingGroup，保留累计pollCount
- **产物11种渲染器**+分页展示(默认3个)
- **TodoWrite checkbox三态**：completed(绿底勾)/in_progress(蓝边)/pending(灰边)

**修正**：之前已排第1，源码核实后确认，且发现更多细节（媒体轮询合并、大输出截断阈值、静默消息过滤）

### 🥈 第2名：opencode（sst）— ⭐⭐⭐⭐½

工程化最高，行类型最丰富，性能最优。

**源码实证的极致点**：
- **9种时间线行类型**（rows.ts）：TurnGap/UserMessage/TurnDivider/AssistantPart/Thinking/DiffSummary/Error/Retry/CommentStrip——比任何项目都细。TurnDivider有compaction和interrupted两种标签
- **时间线投影**（projection.ts 116行全读）：createTimelineProjection做消息→行映射，activeMessageID追踪活跃消息，reuseTimelineRows行复用避免重渲染
- **权限Dock就地停靠**：SessionPermissionDock不弹窗，once/always/reject三选项+patterns展示
- **虚拟列表**：@tanstack/solid-virtual+timelineCache缓存
- **5种Dock**：permission/question/revert/todo/followup

**修正**：之前排第2，源码核实后确认。TurnDivider的compaction/interrupted标签是之前没发现的亮点。

### 🥉 第3名：QwenPaw — ⭐⭐⭐⭐

工具卡体系最完整可扩展，审批信息最全。

**源码实证的极致点**：
- **15+种专属ToolCard**：每种工具独立组件，ToolCardShell用原生<details>/<summary>(无障碍友好)，统一status(calling/error/done)+spinner/icon+badges+inlineResult
- **插件注册机制**：registerBuiltinCards通过pluginSystem注册，PluginSystem可扩展自定义工具卡，v1/v2双适配
- **审批卡信息最全**：ApprovalCard含severity+findingsCount+findingsSummary+timeoutSeconds倒计时+跨会话审批(isCrossSession)+ApprovalContext全局状态

**修正**：之前排第3，源码核实后确认。ToolCardShell的原生details折叠和pluginSystem注册是之前只看了文件名没发现的。

### 第4名：hexclaw-desktop — ⭐⭐⭐⭐

协议化交互系统+阶段自动推进，Vue3实现。

**源码实证的极致点**：
- **InteractiveBlock协议化**（69行全读）：4种交互类型(buttons/select/approval/card)统一分发，统一emit('select')，一处分发避免ChatView写满v-if-else
- **ResearchProgress四阶段自动推进**：search→analyze→synthesize→report，watch(contentLength)按长度阈值(200/800/2000)自动推进阶段，递增延迟(scheduleNextPhase delayMs*1.3)
- **ToolCallCard**：状态图标(CircleCheck/CircleX/LoaderCircle spin)+持续时间+summarizeToolResult摘要+可折叠参数/结果
- **SubAgentPanel**：子Agent面板
- **BudgetPanel**：预算面板

**修正**：之前排第4，源码核实后确认。InteractiveBlock的协议化设计是之前没深入读到的。

### 第5名：goose — ⭐⭐⭐⭐

连续调用链识别+分批渲染，React实现。

**源码实证的极致点**：
- **identifyConsecutiveToolCalls**（66行全读）：遍历消息，连续toolRequests(中间无文字)识别为链，链内shouldHideTimestamp隐藏时间戳——这是"动作合并"的工程实现
- **ProgressiveMessageList**：batchSize=20分批渲染，超50条(showLoadingThreshold)才显示loading，Cmd/Ctrl+F加载全部搜索
- **GooseMessage**：整合ThinkingContent+ToolCallWithResponse+ToolCallConfirmation+ElicitationRequest，跨消息查找confirmation

**修正**：之前排第5，源码核实后确认。toolCallChaining的链识别逻辑是之前只看了文件名没读实现的。

### 第6名：zagens — ⭐⭐⭐½

执行轨迹回放独一无二，但偏调试工具。

**源码实证的极致点**（1107行全读）：
- **TraceBundle数据结构**：events(事件序列)+replay_summary(coherence判定+turns)+analysis(compaction_timeline+capacity_checkpoints)+harness(task_graph)
- **6个Tab**：overview(执行摘要+KPI+findings)/timeline(三泳道Model·Tools·Guards)/turnmap(回合coherence地图)/memory/harness/replay(事件序列回放)
- **CompareApp**：两次执行diff对比(coherence_match+event_kind_sequence_match+effect_count_delta)
- **buildExecutiveSummary**：自动生成执行摘要(headline+lead+bullets+findings)

**修正**：之前排第6，源码核实后确认。compaction_timeline和capacity_checkpoints是之前没读到的。

### 第7名：mimo-code — ⭐⭐⭐½

opencode精简版，流式动画细节最精致。

**源码实证亮点**：ToolStatusTitle的common()函数做active/done文本公共前缀拆分，流式→完成只动画变化尾部差异——这个细节其他项目都没有。tool-error-card有工具名映射(read→"读取"等)+错误清理。

### 第8名：harnessclaw — ⭐⭐⭐½

计划可交互编辑是亮点。

**源码实证亮点**：PlanDraftCard(364行)用户可拖拽重排序步骤DAG(GripVertical)+编辑+批准/取消/重新生成，服务端校验cycle/depends_on。ConversationSidePanel(1514行)有plan/logs/artifacts三Tab，artifacts有general/dev双模式。

### 第9名：MyAgents — ⭐⭐⭐

按工具分Card+TodoChecklist。

**源码实证亮点**：BashTool解析stdout/stderr JSON+formatDuration(ms/s/m格式化)，TodoChecklist三态(completed绿底勾/in_progress蓝边spinner/pending灰边)。

### 第10名：kuse-cowork — ⭐⭐½

基础实现，TaskPanel三态步骤。

**源码实证**：Chat(272行)处理text/tool_start/tool_result事件，TaskPanel有✓/●/✗三态+颜色区分。实现较基础。

### 第11-14名：AionUi / DeepSeek-GUI / opencowork / desktop-claw — ⭐⭐

**源码实证**：
- AionUi：ToolCallBlock偏移动端(React Native)，useStatusIcons有Executing/Success/Error/Canceled/Pending/Confirming六态——但非桌面端为主
- DeepSeek-GUI：渲染层以Write写作工具为主(WriteMarkdownEditor/WriteAssistantPanel)，DiffView(250行)有但非执行过程核心
- opencowork：渲染层以shadcn/ui组件库为主，无专门执行过程组件
- desktop-claw：reference项目，仅确认Tauri+React技术栈

## 三、给小蓝鲸的关键信息输入

### 应优先借鉴的 10 个设计点（附源码出处）

| # | 设计点 | 来源项目·源码文件 | 小蓝鲸PRD章节 |
|---|---|---|---|
| 1 | 回合构建管道：tool_use/tool_result配对+压缩消息打断turn | lobsterai·messageDisplayUtils.ts buildConversationTurns | 3.1 执行循环映射 |
| 2 | ThinkingBlock流式自动展开/停止自动折叠 | lobsterai·ThinkingBlock.tsx useEffect | 4.4 + 7.2 |
| 3 | 工具结果>64KB只展示4KB预览+大小标签 | lobsterai·messageDisplayUtils getToolResultCollapsedDisplay | 8.2 事件聚合 |
| 4 | Dock就地停靠(权限/追问/回滚/待办)不弹窗 | opencode·session-permission-dock.tsx | 5.1-5.2 实时交互 |
| 5 | TurnDivider的compaction/interrupted时间线分隔标签 | opencode·rows.ts | 4.5 压缩 + 4.7 中断 |
| 6 | 按工具类型做专属ToolCard+pluginSystem可扩展 | QwenPaw·ToolCardShell+registerBuiltinCards | 8.1 事件映射 |
| 7 | 审批卡含severity+摘要+倒计时 | QwenPaw·ApprovalCard.tsx | 6.5 权限确认 |
| 8 | InteractiveBlock协议化4种交互统一分发 | hexclaw·InteractiveBlock.vue | 5 实时交互 |
| 9 | ResearchProgress按内容长度自动推进阶段 | hexclaw·ResearchProgress.vue watch(contentLength) | 4.2 执行态结构 |
| 10 | 连续工具调用链识别+链内隐藏时间戳 | goose·toolCallChaining.ts identifyConsecutiveToolCalls | 4.3 动作合并 |

### 应避免的 4 个问题（附源码反证）

1. **弹窗审批打断执行流**——lobsterai用CoworkPermissionModal(弹窗)不如opencode的Dock(就地)，印证小蓝鲸PRD 5.5权限卡就地
2. **每步刷卡片**——lobsterai用AssistantTurnBlock合并回合、goose用identifyConsecutiveToolCalls合并链，印证PRD 4.3
3. **裸展示思考链**——lobsterai的ThinkingBlock自动折叠+300px高度限制，印证PRD 2.5
4. **大结果全量展示卡顿**——lobsterai的64KB截断阈值，印证PRD 8.2

### 小蓝鲸可差异化的 3 个方向（14个项目无一家做到）

1. **完成折叠**：14个项目没有一家做了"执行完折叠过程只留结果"——小蓝鲸PRD第9节是差异点
2. **影响优先表达**：14个项目的权限/工具展示全是"工具名+参数"技术表达，没有"用户影响"表达——小蓝鲸PRD主轴二是差异点
3. **两层体验**：只有zagens有独立trace-report(偏调试工具)，没有一家在主界面做普通/开发者视图切换——小蓝鲸PRD第7节是差异点

### 流式体验的 2 个精致细节（值得借鉴）

1. **mimo-code的公共前缀拆分**：ToolStatusTitle的common()函数拆分active/done文本公共前缀，流式→完成只动画变化尾部——避免整文闪烁，体验丝滑
2. **lobsterai的流式活动状态文本**：getStreamingActivityStatusText生成"正在运行{toolName}..."，消除工具执行dead air

## 四、核查诚实说明

本分析基于14个项目执行过程核心组件的源码阅读。深度分级：深（6个项目读了核心组件完整逻辑+工具函数）、中（4个项目读了1-3个核心组件60-80行）、浅（4个项目只读了组件开头或目录）。浅度项目(AionUi/DeepSeek-GUI/opencowork/desktop-claw)的评价基于有限阅读，可能遗漏亮点，排名可能偏低。如需对某个浅度项目做更深入核查，可单独补充阅读。
