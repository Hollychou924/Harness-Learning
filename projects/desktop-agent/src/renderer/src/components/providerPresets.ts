/** 思考配置：每个模型独立配置如何开启/关闭思考 */
export interface ThinkingConfig {
  /** 开启思考时注入请求的参数 */
  bodyParams: Record<string, unknown>
  /** 关闭思考时注入的参数（省略则不注入） */
  disabledBodyParams?: Record<string, unknown>
  /** 思考时强制温度（Anthropic 要求 1） */
  forceTemperature?: number
}

/** 单个模型的能力与思考配置。在 models 字典里 key 即模型 id，id 可省略；在 mify 列表里需填 id */
export interface ModelPreset {
  id?: string
  /** 是否支持思考 */
  supportsThinking?: boolean
  /** 思考配置（supportsThinking 为 true 时必填） */
  thinkingConfig?: ThinkingConfig
  /** 思考时输出上限（思考模型需更高，mify 实战不得低于 16000） */
  maxOutputTokens?: number
  /** 思考档位（高级用户可调，普通用户默认自动不暴露） */
  reasoningEffortLevels?: string[]
  /** 默认思考档位 */
  defaultReasoningEffort?: string
}

export interface ProviderPreset {
  label: string
  apiFormat: 'openai' | 'anthropic'
  baseUrl: string
  keyPlaceholder: string
  modelCandidates: string[]
  contextLimit: number
  isMify?: boolean
  builtinApiKey?: string
  /** 是否支持图片输入(vision) */
  supportsVision?: boolean
  /** 是否支持函数调用(工具) */
  supportsFunctionCall?: boolean
  /** 同厂商最优协议端点（固定不走运行时切换，避免复杂度） */
  preferredApiFormat?: 'anthropic' | 'openai'
  /** 每个模型的思考配置，key 为模型 id */
  models?: Record<string, ModelPreset>
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  anthropic: {
    label: 'Anthropic',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    keyPlaceholder: 'sk-ant-...',
    modelCandidates: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-sonnet-4-5-20250929'],
    contextLimit: 200_000,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'claude-sonnet-4-6': { supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'adaptive' } }, forceTemperature: 1 } },
      'claude-opus-4-6': { supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'adaptive' } }, forceTemperature: 1 } },
      'claude-sonnet-4-5-20250929': { supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled', budget_tokens: 4096 } }, forceTemperature: 1 } }
    }
  },
  minimax: {
    label: 'MiniMax',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    keyPlaceholder: 'eyJ... (MiniMax API Key)',
    modelCandidates: ['MiniMax-M2.5', 'MiniMax-M2.1'],
    contextLimit: 1_000_000,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'MiniMax-M2.5': { supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } }, forceTemperature: 1 } }
    }
  },
  kimi: {
    label: 'Kimi (月之暗面)',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.moonshot.cn/anthropic',
    keyPlaceholder: 'sk-...',
    modelCandidates: ['kimi-k2.5'],
    contextLimit: 128_000,
    supportsFunctionCall: true,
    models: {
      'kimi-k2.5': { supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } }, forceTemperature: 1 } }
    }
  },
  glm: {
    label: '智谱 GLM',
    apiFormat: 'anthropic',
    baseUrl: 'https://open.bigmodel.cn/api/anthropic',
    keyPlaceholder: '智谱开放平台 API Key',
    modelCandidates: ['glm-5', 'glm-4.7'],
    contextLimit: 128_000,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'glm-5': { supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } } } },
      'glm-4.7': { supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } } } }
    }
  },
  seed: {
    label: '豆包 (火山引擎)',
    apiFormat: 'anthropic',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/compatible',
    keyPlaceholder: '火山方舟 API Key',
    modelCandidates: ['ark-code-latest', 'doubao-seed-2-0-pro-260215', 'doubao-seed-2-0-lite-260215'],
    contextLimit: 128_000,
    supportsFunctionCall: true,
    models: {
      'doubao-seed-2-0-pro-260215': { supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } }
    }
  },
  qwen: {
    label: '阿里通义千问 (Qwen)',
    apiFormat: 'anthropic',
    baseUrl: 'https://dashscope.aliyuncs.com/apps/anthropic',
    keyPlaceholder: '阿里云百炼 API Key',
    modelCandidates: ['qwen3.5-plus', 'qwen3-coder-plus'],
    contextLimit: 128_000,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'qwen3.5-plus': { supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } } } },
      'qwen3-coder-plus': { supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } } } }
    }
  },
  deepseek: {
    label: 'DeepSeek',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.deepseek.com/anthropic',
    keyPlaceholder: 'sk-...',
    modelCandidates: ['deepseek-reasoner', 'deepseek-chat'],
    contextLimit: 64_000,
    supportsVision: false,
    supportsFunctionCall: true,
    models: {
      'deepseek-reasoner': { supportsThinking: true, thinkingConfig: { bodyParams: { enable_thinking: true }, disabledBodyParams: { enable_thinking: false } } }
    }
  },
  openai: {
    label: 'OpenAI',
    apiFormat: 'openai',
    baseUrl: 'https://api.openai.com',
    keyPlaceholder: 'sk-...',
    modelCandidates: ['gpt-5.2-2025-12-11', 'gpt-5.2-codex'],
    contextLimit: 128_000,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'gpt-5.2-2025-12-11': { supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' }, disabledBodyParams: { reasoning_effort: 'low' } } },
      'gpt-5.2-codex': { supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' }, disabledBodyParams: { reasoning_effort: 'low' } } }
    }
  },
  google: {
    label: 'Google Gemini',
    apiFormat: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyPlaceholder: 'AIza...',
    modelCandidates: ['gemini-3-pro-preview', 'gemini-3.1-pro-preview', 'gemini-3-flash-preview'],
    contextLimit: 1_000_000,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'gemini-3-pro-preview': { supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } },
      'gemini-3.1-pro-preview': { supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } }
    }
  },
  xai: {
    label: 'xAI (Grok)',
    apiFormat: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    keyPlaceholder: 'xAI API Key',
    modelCandidates: ['grok-4', 'grok-3-mini'],
    contextLimit: 131_072,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'grok-3-mini': { supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } }
    }
  },
  mify: {
    label: 'Mify 推理网关',
    apiFormat: 'openai',
    baseUrl: 'http://model.mify.ai.srv/v1',
    keyPlaceholder: 'Mify API Key（控制台创建）',
    modelCandidates: [],
    contextLimit: 128_000,
    isMify: true,
    builtinApiKey: 'sk-htOLGZ85ivhz1dAqInOcgw7QNvk74h0RWubl0IJy'
  },
  custom: {
    label: '自定义模型',
    apiFormat: 'openai',
    baseUrl: '',
    keyPlaceholder: 'API Key',
    modelCandidates: [],
    contextLimit: 128_000
  }
}

export const BUILTIN_PROVIDER_ORDER: string[] = [
  'mify',
  'anthropic',
  ...Object.keys(PROVIDER_PRESETS).filter((id) => id !== 'mify' && id !== 'anthropic' && id !== 'custom'),
  'custom'
]

export const MIFY_PROVIDER_ID_CHIPS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'xiaomi', label: '小米 / 私部' },
  { id: 'azure_openai', label: 'Azure OpenAI' },
  { id: 'tongyi', label: '通义千问' },
  { id: 'volcengine_maas', label: '火山引擎' },
  { id: 'zhipuai', label: '智谱 AI' },
  { id: 'siliconflow', label: '硅基流动' },
  { id: 'vertex_ai', label: 'GCP Gemini/Claude' },
  { id: 'minimax', label: 'MiniMax' },
  { id: 'ppio', label: '派欧云' }
]

/** Mify 子厂商模型 + 思考配置。mify 统一走 OpenAI 协议，思考输出统一读 reasoning_content。 */
export const MIFY_PROVIDER_MODELS: Record<string, ModelPreset[]> = {
  xiaomi: [
    { id: 'mimo-v2-pro', supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } } } },
    { id: 'mimo-v2-flash', supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } } } },
    { id: 'mimo-v2-omni', supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } } } }
  ],
  azure_openai: [
    { id: 'gpt-5.4-pro', supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } },
    { id: 'gpt-5.4', supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } }
  ],
  tongyi: [
    { id: 'qwen3.5-122b-a10b', supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } } } },
    { id: 'qwen3.5-plus-2026-02-15', supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } } } }
  ],
  volcengine_maas: [
    { id: 'doubao-seed-2-0-code-preview-260215' },
    { id: 'doubao-seed-2-0-pro-260215', supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } }
  ],
  zhipuai: [
    { id: 'glm-5-turbo' },
    { id: 'glm-5', supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } } } }
  ],
  siliconflow: [
    { id: 'Pro/zai-org/GLM-5', supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } } } },
    { id: 'Pro/moonshotai/Kimi-K2.5', supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } }, forceTemperature: 1 } }
  ],
  vertex_ai: [
    { id: 'gemini-3.1-flash-lite-preview' },
    { id: 'gemini-3.1-pro-preview-pt', supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } },
    { id: 'gemini-3.1-pro-preview', supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } }
  ],
  minimax: [
    { id: 'MiniMax-M2.7', supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } }, forceTemperature: 1 } },
    { id: 'MiniMax-M2.5', supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled' } }, disabledBodyParams: { thinking: { type: 'disabled' } }, forceTemperature: 1 } }
  ],
  ppio: [
    { id: 'pa/claude-sonnet-4-5-20250929', supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'enabled', budget_tokens: 4096 } }, forceTemperature: 1 } },
    { id: 'pa/claude-haiku-4-5-20251001' },
    { id: 'pa/claude-opus-4-6', supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'adaptive' } }, forceTemperature: 1 } },
    { id: 'pa/claude-sonnet-4-6', supportsThinking: true, thinkingConfig: { bodyParams: { thinking: { type: 'adaptive' } }, forceTemperature: 1 } },
    { id: 'grok-4' },
    { id: 'gpt-5-mini', supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } },
    { id: 'gpt-5-nano' }
  ]
}

export const MIFY_GATEWAY_DEFAULT_MODEL_ID = 'mimo-v2-pro'

export function getContextLimit(providerKey: string): number {
  return PROVIDER_PRESETS[providerKey]?.contextLimit ?? 128_000
}

/** 取 mify 子厂商的模型 id 列表 */
export function getMifyModelIds(providerId: string): string[] {
  return (MIFY_PROVIDER_MODELS[providerId] || []).map((m) => m.id).filter(Boolean) as string[]
}

/** 取某模型的思考配置（普通厂商 + mify 统一入口） */
export function getModelThinkingConfig(providerId: string, model: string, isMify = false, mifySubProvider?: string): ModelPreset | undefined {
  if (isMify && mifySubProvider) {
    return (MIFY_PROVIDER_MODELS[mifySubProvider] || []).find((m) => m.id === model)
  }
  return PROVIDER_PRESETS[providerId]?.models?.[model]
}


/**
 * 判断当前模型是否支持图片输入(vision)。
 * 三层判断：
 * 1. provider preset 明确标记 supportsVision → 以该标记为准
 * 2. 模型名匹配已知视觉模型关键词 → 支持
 * 3. 未知 → 乐观放行(允许发图，模型不支持时由 agent 层自动退回纯文字)
 */
const VISION_MODEL_PATTERNS = [
  /claude/i,
  /gpt-4o|gpt-5|gpt-4-turbo/i,
  /gemini/i,
  /grok/i,
  /glm-5|glm-4/i,
  /qwen.*vl|qwen.*omni|qwen3\.5|qwen3-coder/i,
  /minimax-m2/i,
  /vision|vl|omni/i,
]

export function modelSupportsVision(providerId: string, model: string): boolean {
  const preset = PROVIDER_PRESETS[providerId]
  if (preset?.supportsVision === true) return true
  if (preset?.supportsVision === false) {
    // provider 明确不支持，但个别模型名可能仍匹配(如 deepseek 未来加 vl 版)
    return VISION_MODEL_PATTERNS.some((re) => re.test(model))
  }
  // 未知 provider：乐观放行
  return true
}
