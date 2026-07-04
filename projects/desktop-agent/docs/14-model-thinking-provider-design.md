# 模型配置与思考能力统一方案 V2

> 本版基于对小蓝鲸当前代码的逐行核查 + mify 代理源码 + 8 个竞品源码的深度调研更新。
> 核查范围：providerPresets.ts、anthropic.ts、openai.ts、react.ts、ReasoningBlock.tsx、
> protocol.ts、items.ts、ModelSelector.tsx、MifySection.tsx、ModelConfigSection.tsx、
> ProviderEditor.tsx；mify 代理 model-mapper/model-groups/config-store/converter/responses-adapter/codex.ts；
> 竞品 opencowork(27预设)/lobsterai(18家)/Kun(16家)/kuse/harnessclaw/hexclaw/MyAgents/AionUi。

---

## 一、现状核查：已落地 vs 未落地

### 已落地（V1 方案部分实现）
1. **数据模型**：`providerPresets.ts` 已有 `ThinkingConfig`（bodyParams/disabledBodyParams/forceTemperature）、`ModelPreset`（supportsThinking）、`ProviderPreset`（supportsVision/supportsFunctionCall/models 字典）。
2. **12 预置厂商 + mify 网关 9 子厂商**：`PROVIDER_PRESETS`（anthropic/minimax/kimi/glm/seed/qwen/deepseek/…）+ `MIFY_PROVIDER_MODELS`（xiaomi/deepseek/moonshot/ppio/azure_openai/tongyi/volcengine_maas/zhipuai/vertex_ai/minimax/grok）。
3. **anthropic.ts 思考**：已注入 thinkingConfig.bodyParams、forceTemperature、采集 thinking_delta、三级降级（带思考→不带思考重试）。
4. **能力位**：supportsVision + modelSupportsVision 三层判断（preset标记→模型名匹配→乐观放行）。
5. **AgentConfig**：已有 thinkingLevel('auto'|'off')、thinkingConfig 字段。
6. **展示框架**：ReasoningBlock 两级（摘要默认展示 + 完整原文展开），最终回复开始后自动收起。
7. **极简配置骨架**：三档分层（mify零配置/内置Key一键/普通一字段）、MifySection 路由供应商网格、ModelSelector 输入框旁切换器。

### 未落地 / 有问题（必须补全）
| # | 问题 | 核查依据 | 影响 |
|---|---|---|---|
| **P0-1** | openai.ts **完全没接思考** | 无 bodyParams 注入、无 reasoning_content/reasoning 识别、无 think 标签剥离、无降级 | OpenAI/GPT/Gemini/豆包等走 openai 协议的厂商思考功能全空 |
| **P0-2** | react.ts **仍是假占位** | `emitReasoning('第 N 轮思考')` 硬编码假文本，没消费 provider 的真实 thinking 事件 | 用户看到的思考是假的，点开无信息增量 |
| **P0-3** | 思考**嵌套重复展示** | emitReasoning 每轮创建独立 reasoning item + ReasoningBlock 两级展开 → 用户点"第一轮思考"→展开→又一个"第一轮思考"→"查看完整思考"→又一层 | 用户反馈"点进去又一层、内容看不懂、有欺骗感"的根因 |
| **P1-1** | mify 网关思考**未适配** | MIFY_PROVIDER_MODELS 里部分模型标了 thinkingConfig，但走 mify 时 openai.ts 不注入、不采集 | mify 子厂商思考功能实际不生效 |
| **P1-2** | 配置未支持**多模型并存** | settingsStore 只存单个 modelConfig，无"已配置模型列表" | 无法快速切换，为会话级绑定留的基础缺失 |
| **P1-3** | BaseURL **未折叠** | ProviderEditor 现状需确认是否已把 BaseURL 收进"高级" | 极简体验未到位 |
| **P2-1** | 缺 **OAuth 免填 key** | 无 codex-oauth/copilot-oauth 类预设 | 体验不及 opencowork |
| **P2-2** | 缺 **本地模型** | 无 ollama/lm-studio 预设 | 离线场景缺失 |

---

## 二、最新调研：竞品最强做法对照

### 厂商广度（按预置数排序）
| 竞品 | 预置数 | 独有亮点 |
|---|---|---|
| **opencowork** | 27 | thinkingConfig 每模型独立、authMode OAuth、模型带价格、套餐/按量双预设、硅基流动/Gitee AI/百度/Azure/Ollama/LM Studio |
| **lobsterai** | 18 | switchableBaseUrls 同厂商切 Anthropic/OpenAI 端点 + preferredCodingPlanFormat 标注哪个协议更稳 |
| **Kun** | 16 | 完整能力画像(视觉/推理/语音/图像生成)、上游 /v1/models 自动拉取、套餐区区域集群(cn/sgp/ams) |
| **小蓝鲸(现状)** | 12+9 | mify 网关统一切换（独家优势） |

### 思考能力对照（最强点）
| 能力 | opencowork | desktop-claw | mify proxy | 小蓝鲸现状 | V2 目标 |
|---|---|---|---|---|---|
| 每模型独立 thinkingConfig | ✅ | — | — | ✅(数据层) | ✅(全链路) |
| 三级降级 | ❌ | ✅ | — | ✅(仅anthropic) | ✅(双协议) |
| think 标签剥离 | ❌ | ❌ | — | ❌ | ✅ |
| max_tokens 地板 | ❌ | ❌ | ✅(实战) | ❌ | ✅ |
| tool_choice 降级 | ❌ | ❌ | ✅(实战) | ❌ | ✅ |
| reasoning 多字段识别 | 部分 | ✅ | — | ❌ | ✅ |
| mify 网关思考适配 | ❌ | ❌ | ✅(代理层) | ❌ | ✅(客户端层) |

> **结论**：思考深度上，补全 openai.ts + 消灭假占位 + 加 max_tokens/tool_choice 降级后，小蓝鲸将超越所有竞品（这四点组合任何竞品都没有）。

---

## 三、V2 方案：分四层补全到最强

### 第 1 层 · 数据模型（已基本就绪，补 3 项）

**现有不动**：ThinkingConfig / ModelPreset / ProviderPreset 结构保留。

**补全 3 项**：
1. `ModelPreset` 加 `maxOutputTokens?: number`——思考模型需要更高上限（mify 实战：思考时 max_tokens 不得低于 16000，否则模型直接报错）。
2. `ProviderPreset` 加 `preferredApiFormat?: 'anthropic' | 'openai'`——学 lobsterai，标注同厂商哪个协议端点思考更稳（如月之暗面 Anthropic 端点不完整→preferredApiFormat='openai'）。
3. `ModelPreset` 加 `reasoningEffortLevels?: string[]` + `defaultReasoningEffort?`——学 opencowork，为以后"高级里手动调思考档位"留口（普通用户不暴露，默认自动）。

### 第 2 层 · Provider 层（核心补全）

#### 2.1 openai.ts 全面补思考（P0-1）

```
请求侧：
  - 读取 config.thinkingConfig，wantThinking 时注入 bodyParams
  - max_tokens：思考时取 maxOutputTokens 或 16000（取大），非思考 8192
  - tool_choice 降级：思考+工具调用时，部分模型不支持 parallel tool_calls，
    报错后降级为 tool_choice:'auto' 重试（mify 实战经验）

响应侧（三路采集，任一命中即可）：
  - delta.reasoning_content  → thinking 事件（DeepSeek/通义/智谱）
  - delta.reasoning          → thinking 事件（OpenAI o 系/部分兼容端点）
  - 正文含 <think...>标签   → 剥离为 thinking，正文只留净文本（MiniMax/部分开源模型）

降级：
  - 带思考报错 → 去思考参数重试（与 anthropic.ts 一致）
  - tool_choice 报错 → 降级重试
```

#### 2.2 anthropic.ts 补 max_tokens 地板（P0 配套）
现状 max_tokens 思考时 16000，但部分 Claude 模型 thinking budget 要求更高。改为取 `maxOutputTokens || 16000`，并保证 thinking budget_tokens ≤ max_tokens - 输出预留。

#### 2.3 mify 网关思考适配（P1-1）
mify 走 openai 协议（customProviderId 注入 X-Model-Provider-Id 头）。思考参数经 mify 网关转发到各子厂商时，参数格式与直连一致（网关透传 bodyParams）。所以 openai.ts 补全后，mify 子厂商思考**自动生效**——无需额外代码，这是统一协议设计的红利。唯一需确认：mify 的 X-Model-Provider-Id 头在思考请求时仍正确注入（现状 getProviderHeaders 已处理）。

### 第 3 层 · Agent 循环（react.ts）（P0-2 + P0-3 核心重构）

**删除**：`emitReasoning('第 N 轮思考')` 硬编码假文本。

**改为**：真实消费 provider 的 thinking 事件。

```
每轮循环：
  - 创建一个 reasoning item（type:'reasoning'），status='running'
  - 收到 ev.type==='thinking' → 追加到该 item 的 content[]
  - 思考结束后（收到第一个 text 或 tool_use）→ item.status='completed'，
    summary 取 content 的首句或前 80 字截断（不是假文本）
  - 同一轮只创建一个 reasoning item，后续 thinking 增量追加到同一个 item
    （消灭"点进去又一层"的嵌套重复）
```

**关键**：ReasoningItem 的 summary 是真实思考内容的摘要（首句/截断），content 是完整原文。不再是两层都是假文本。

**回放功能**：用户反馈"折叠里的回放完全看不懂"——彻底移除回放（replay）相关逻辑，思考只展示真实内容。

### 第 4 层 · 展示层（ReasoningBlock 微调）

**现状优点保留**：两级展示（摘要默认 + 完整展开）、最终回复开始自动收起、耗时显示。

**修正**：
1. summary 现在是真实首句，不再是"第 N 轮思考"。
2. 去掉"查看完整思考"再嵌套一层的设计——content 直接在摘要下方展开，只有一级展开，不再"点开又一层"。
3. 移除回放相关 UI。

**最终展示逻辑**：
```
[思考中…/想了 12 秒]  ← 折叠态，显示真实摘要首句
  └ 展开后：完整思考原文（一级，不再嵌套）
  └ 最终回复一开始，自动收起
```

---

## 四、极简配置体验（确认现状 + 补全）

### 三档配置（现状骨架已有，确认落地）

| 档位 | 厂商 | 用户填什么 | 展示什么 |
|---|---|---|---|
| **零配置** | mify 网关 | 无 | 子厂商选择 + 模型选择，不显示 Key/BaseURL |
| **一键** | 内置 Key 厂商(仅 mify) | 无 | 模型选择 |
| **一字段** | 普通厂商 | API Key（1个） | API Key + 模型选择，BaseURL 折叠在"高级" |

**补全**：
- ProviderEditor 确认 BaseURL 默认折叠到"高级"折叠区（需核查 ProviderEditor.tsx 现状）。
- 思考默认"自动"（thinkingLevel='auto'），不暴露档位给普通用户，只在"高级"给一个开/关/自动总开关。

### 输入框旁快速切换（学 lobsterai，现状 ModelSelector 已有骨架）

**现状**：ModelSelector 下拉列厂商，但点厂商只是跳设置页。
**补全**：下拉直接列出"已配置的模型"（不止厂商），点一下即切，不跳设置页。这依赖第 5 项多模型并存。

### 配置存储：多模型并存（学 hexclaw，P1-2）

**现状**：settingsStore 只存单个 modelConfig。
**改为**：存 `configuredModels: ModelConfig[]`（已配置模型列表）+ `activeModelId`（当前激活）。
- ModelSelector 下拉在这些已配置模型间切。
- 为未来"每对话绑定不同模型"留基础。
- 迁移：现有单个 modelConfig 自动转为列表第一项。

---

## 五、超越所有竞品的"最强"点

补全后小蓝鲸模型配置与思考能力达到：

1. **厂商最全**：12 预置 + mify 网关 9 子厂商 + 自定义。mify 网关统一切换是独家优势（opencowork/hexclaw 都没有）。
2. **思考最强**（组合无竞品）：每模型独立 thinkingConfig + 双协议三级降级 + think 标签剥离 + max_tokens 地板 + tool_choice 降级 + reasoning 多字段识别 + mify 网关思考适配。
3. **配置最简**：零配置(mify) / 一键(内置Key) / 一字段(普通)三档，BaseURL 和思考默认折叠，思考深度默认自动不暴露。
4. **切换最快**：输入框旁下拉直接切已配置模型，不离开对话。
5. **多模型并存**：已配置模型列表，为会话级绑定留基础。
6. **能力自描述**：每模型带 vision/functionCall/thinking 三能力位，UI 自动展示能做什么。
7. **思考展示真实**：消灭假占位和嵌套重复，每点开都有真实信息增量。

---

## 六、实施顺序（按依赖关系）

| 步骤 | 内容 | 依赖 | 验收标准 |
|---|---|---|---|
| **1** | 数据模型补 3 项（maxOutputTokens/preferredApiFormat/reasoningEffortLevels） | 无 | providerPresets.ts 字段就位，typecheck 通过 |
| **2** | openai.ts 全面接思考（注入+采集+标签剥离+降级） | 步骤1 | 走 openai 协议的模型思考能采集到真实内容 |
| **3** | react.ts 重构：删假占位，消费真实 thinking 事件，单 item 追加 | 步骤2 | 思考展示真实内容，无嵌套重复 |
| **4** | ReasoningBlock 微调：去嵌套层级，去回放 | 步骤3 | 用户点开只有一级展开，内容有增量 |
| **5** | mify 网关思考验证（应自动生效，做端到端验证） | 步骤2 | mify 子厂商思考真实采集 |
| **6** | 多模型并存（configuredModels 列表 + ModelSelector 直切） | 无 | 下拉切模型不跳设置页 |
| **7** | 极简配置确认（BaseURL 折叠 + 思考总开关） | 无 | 普通用户只填 Key |

**步骤 1-4 是 P0，必须先做**（解决用户反馈的思考假/嵌套问题）。步骤 5-7 是 P1，可并行。

---

## 七、待确认决策点

1. **preferredApiFormat**：是否需要像 lobsterai 那样支持同厂商切换协议端点？现状小蓝鲸每厂商固定一个 apiFormat。如果月之暗面等厂商的 Anthropic 端点确实不完整，需要加这个能力。
2. **本地模型**：要不要加 ollama/lm-studio 预设（opencowork 和 hexclaw 都有）？
3. **OAuth 免填 key**：要不要支持 Codex/Copilot 账号登录？开发量较大，建议放二期。
4. **模型价格展示**：要不要像 opencowork 那样每个模型带价格？对"极简配置"可能反而增加信息量，建议不加。

---

## 八、决策标定（2026-07-02 确认）

| 决策项 | 结论 | 理由 |
|---|---|---|
| 本地模型(ollama/lm-studio) | **二期** | 先聚焦主流云端模型 |
| 账号登录(OAuth) | **二期** | 开发量大，先做 API Key 路径 |
| 协议端点切换 | **不做运行时切换** | 每家在 preset 固定走最稳协议，避免 switchableBaseUrls 复杂度 |
| 模型价格展示 | **不加** | 极简配置优先，价格是噪音 |

**V1 范围确认**：步骤 1-7（数据模型→openai思考→循环重构→展示微调→mify验证→多模型并存→极简配置确认）。
**二期**：本地模型、OAuth 账号登录。
