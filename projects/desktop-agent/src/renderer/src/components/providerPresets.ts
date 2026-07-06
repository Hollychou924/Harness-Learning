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

const thinkingEnabled: ThinkingConfig = {
  bodyParams: { thinking: { type: 'enabled' } },
  disabledBodyParams: { thinking: { type: 'disabled' } }
}

const adaptiveThinking: ThinkingConfig = {
  bodyParams: { thinking: { type: 'adaptive' } },
  forceTemperature: 1
}

const reasoningEffort: ThinkingConfig = {
  bodyParams: { reasoning_effort: 'medium' },
  disabledBodyParams: { reasoning_effort: 'low' }
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  deepseek: {
    label: 'DeepSeek',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.deepseek.com/anthropic',
    keyPlaceholder: 'sk-...',
    modelCandidates: ['deepseek-v4-pro', 'deepseek-reasoner', 'deepseek-chat'],
    contextLimit: 1_048_576,
    supportsVision: false,
    supportsFunctionCall: true,
    models: {
      'deepseek-v4-pro': { supportsThinking: true, thinkingConfig: { bodyParams: { enable_thinking: true }, disabledBodyParams: { enable_thinking: false } } },
      'deepseek-reasoner': { supportsThinking: true, thinkingConfig: { bodyParams: { enable_thinking: true }, disabledBodyParams: { enable_thinking: false } } }
    }
  },
  anthropic: {
    label: 'Anthropic',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    keyPlaceholder: 'sk-ant-...',
    modelCandidates: ['claude-sonnet-5', 'claude-opus-4-8', 'claude-opus-4-7'],
    contextLimit: 1_000_000,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'claude-sonnet-5': { supportsThinking: true, thinkingConfig: adaptiveThinking },
      'claude-opus-4-8': { supportsThinking: true, thinkingConfig: adaptiveThinking },
      'claude-opus-4-7': { supportsThinking: true, thinkingConfig: adaptiveThinking }
    }
  },
  openai: {
    label: 'OpenAI',
    apiFormat: 'openai',
    baseUrl: 'https://api.openai.com',
    keyPlaceholder: 'sk-...',
    modelCandidates: ['gpt-5.5', 'gpt-5.4-pro', 'gpt-5.4'],
    contextLimit: 1_050_000,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'gpt-5.5': { supportsThinking: true, thinkingConfig: reasoningEffort },
      'gpt-5.4-pro': { supportsThinking: true, thinkingConfig: reasoningEffort },
      'gpt-5.4': { supportsThinking: true, thinkingConfig: reasoningEffort }
    }
  },
  google: {
    label: 'Google Gemini',
    apiFormat: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyPlaceholder: 'AIza...',
    modelCandidates: ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3-flash-preview'],
    contextLimit: 1_048_576,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'gemini-3.5-flash': { supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } },
      'gemini-3.1-pro-preview': { supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } },
      'gemini-3-flash-preview': { supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } }
    }
  },
  xai: {
    label: 'Grok',
    apiFormat: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    keyPlaceholder: 'xAI API Key',
    modelCandidates: ['grok-4.3', 'grok-4.1-fast', 'grok-4'],
    contextLimit: 1_000_000,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'grok-4.3': { supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } },
      'grok-4.1-fast': { supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } },
      'grok-4': { supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } }
    }
  },
  kimi: {
    label: 'Kimi',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.moonshot.cn/anthropic',
    keyPlaceholder: 'sk-...',
    modelCandidates: ['kimi-k2.6', 'kimi-k2.5', 'kimi-k2.7-code'],
    contextLimit: 262_144,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'kimi-k2.6': { supportsThinking: true, thinkingConfig: { ...thinkingEnabled, forceTemperature: 1 } },
      'kimi-k2.5': { supportsThinking: true, thinkingConfig: { ...thinkingEnabled, forceTemperature: 1 } },
      'kimi-k2.7-code': { supportsThinking: true, thinkingConfig: { ...thinkingEnabled, forceTemperature: 1 } }
    }
  },
  qwen: {
    label: '阿里通义',
    apiFormat: 'anthropic',
    baseUrl: 'https://dashscope.aliyuncs.com/apps/anthropic',
    keyPlaceholder: '阿里云百炼 API Key',
    modelCandidates: ['qwen3.7-max-2026-06-08', 'qwen3.7-plus', 'qwen3.6-flash'],
    contextLimit: 1_000_000,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'qwen3.7-max-2026-06-08': { supportsThinking: true, thinkingConfig: thinkingEnabled },
      'qwen3.7-plus': { supportsThinking: true, thinkingConfig: thinkingEnabled },
      'qwen3.6-flash': { supportsThinking: true, thinkingConfig: thinkingEnabled }
    }
  },
  seed: {
    label: '火山引擎',
    apiFormat: 'anthropic',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/compatible',
    keyPlaceholder: '火山方舟 API Key',
    modelCandidates: ['doubao-seed-2-1-pro-260628', 'doubao-seed-evolving', 'doubao-seed-2-0-code-preview-260215'],
    contextLimit: 262_144,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'doubao-seed-2-1-pro-260628': { supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } },
      'doubao-seed-evolving': { supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } }
    }
  },
  glm: {
    label: '智谱 GLM',
    apiFormat: 'anthropic',
    baseUrl: 'https://open.bigmodel.cn/api/anthropic',
    keyPlaceholder: '智谱开放平台 API Key',
    modelCandidates: ['glm-5.2', 'glm-5', 'glm-5-turbo'],
    contextLimit: 1_048_576,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'glm-5.2': { supportsThinking: true, thinkingConfig: thinkingEnabled },
      'glm-5': { supportsThinking: true, thinkingConfig: thinkingEnabled },
      'glm-5-turbo': { supportsThinking: true, thinkingConfig: thinkingEnabled }
    }
  },
  minimax: {
    label: 'MiniMax',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    keyPlaceholder: 'MiniMax API Key',
    modelCandidates: ['MiniMax-M3', 'MiniMax-M2.5', 'MiniMax-M2.1'],
    contextLimit: 1_048_576,
    supportsVision: true,
    supportsFunctionCall: true,
    models: {
      'MiniMax-M3': { supportsThinking: true, thinkingConfig: { ...thinkingEnabled, forceTemperature: 1 } },
      'MiniMax-M2.5': { supportsThinking: true, thinkingConfig: { ...thinkingEnabled, forceTemperature: 1 } }
    }
  },
  mify: {
    label: 'Mify 推理网关',
    apiFormat: 'openai',
    baseUrl: 'http://model.mify.ai.srv/v1',
    keyPlaceholder: '请输入你的 Mify 密钥',
    modelCandidates: [],
    contextLimit: 1_048_576,
    isMify: true,
    supportsVision: true,
    supportsFunctionCall: true
  },
  custom: {
    label: '自定义模型',
    apiFormat: 'openai',
    baseUrl: '',
    keyPlaceholder: 'API Key',
    modelCandidates: [],
    contextLimit: 262_144,
    supportsVision: true,
    supportsFunctionCall: true
  }
}

export const BUILTIN_PROVIDER_ORDER: string[] = [
  'deepseek',
  'anthropic',
  'openai',
  'google',
  'xai',
  'kimi',
  'qwen',
  'seed',
  'glm',
  'minimax',
  'mify',
  'custom'
]

export const MIFY_PROVIDER_ID_CHIPS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'xiaomi', label: '小米' },
  { id: 'ppio', label: 'PPIO' },
  { id: 'vertex_ai', label: 'Vertex AI' },
  { id: 'zhipuai', label: '智谱' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'moonshot', label: 'Moonshot' },
  { id: 'tongyi', label: '阿里通义' },
  { id: 'volcengine_maas', label: '火山引擎' },
  { id: 'minimax', label: 'MiniMax' }
]

/** Mify 子厂商模型 + 思考配置。mify 统一走 OpenAI 协议，思考输出统一读 reasoning_content。 */
export const MIFY_PROVIDER_MODELS: Record<string, ModelPreset[]> = {
  xiaomi: [
    { id: 'mimo-v2.5-pro', supportsThinking: true, thinkingConfig: thinkingEnabled },
    { id: 'mimo-v2.5', supportsThinking: true, thinkingConfig: thinkingEnabled }
  ],
  ppio: [
    { id: 'pa/claude-sonnet-5', supportsThinking: true, thinkingConfig: adaptiveThinking },
    { id: 'pa/claude-opus-4-8', supportsThinking: true, thinkingConfig: adaptiveThinking },
    { id: 'pa/claude-opus-4-7', supportsThinking: true, thinkingConfig: adaptiveThinking },
    { id: 'pa/claude-opus-4-6', supportsThinking: true, thinkingConfig: adaptiveThinking },
    { id: 'pa/claude-sonnet-4-6', supportsThinking: true, thinkingConfig: adaptiveThinking },
    { id: 'pa/gpt-5.5', supportsThinking: true, thinkingConfig: reasoningEffort },
    { id: 'grok-4', supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } }
  ],
  vertex_ai: [
    { id: 'gemini-3.5-flash', supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } }
  ],
  zhipuai: [
    { id: 'glm-5.2', supportsThinking: true, thinkingConfig: thinkingEnabled }
  ],
  deepseek: [
    { id: 'deepseek/deepseek-v4-pro', supportsThinking: true, thinkingConfig: { bodyParams: { enable_thinking: true }, disabledBodyParams: { enable_thinking: false } } }
  ],
  moonshot: [
    { id: 'kimi-k2.7-code', supportsThinking: true, thinkingConfig: { ...thinkingEnabled, forceTemperature: 1 } },
    { id: 'kimi-k2.7-code-highspeed', supportsThinking: true, thinkingConfig: { ...thinkingEnabled, forceTemperature: 1 } }
  ],
  tongyi: [
    { id: 'tongyi/glm-5.2', supportsThinking: true, thinkingConfig: thinkingEnabled },
    { id: 'deepseek-v4-pro', supportsThinking: true, thinkingConfig: { bodyParams: { enable_thinking: true }, disabledBodyParams: { enable_thinking: false } } },
    { id: 'qwen3.7-max-2026-06-08', supportsThinking: true, thinkingConfig: thinkingEnabled }
  ],
  volcengine_maas: [
    { id: 'doubao-seed-2-1-pro-260628', supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } },
    { id: 'doubao-seed-evolving', supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' } } }
  ],
  minimax: [
    { id: 'MiniMax-M3', supportsThinking: true, thinkingConfig: { ...thinkingEnabled, forceTemperature: 1 } }
  ]
}

export const MIFY_GATEWAY_DEFAULT_MODEL_ID = 'mimo-v2.5-pro'

export interface MifyModelRow {
  providerId: string
  providerLabel: string
  groupLabel: string
  modelId: string
  contextLimit: number
  supportsVision: boolean
}

const MIFY_CONTEXT_LIMITS: Record<string, number> = {
  'mimo-v2.5-pro': 1_048_576,
  'mimo-v2.5': 1_048_576,
  'pa/claude-opus-4-8': 1_000_000,
  'pa/claude-opus-4-7': 1_000_000,
  'pa/claude-opus-4-6': 1_000_000,
  'pa/claude-sonnet-4-6': 1_000_000,
  'pa/claude-sonnet-5': 1_000_000,
  'pa/gpt-5.5': 1_050_000,
  'gemini-3.5-flash': 1_048_576,
  'glm-5.2': 1_048_576,
  'tongyi/glm-5.2': 1_048_576,
  'deepseek/deepseek-v4-pro': 1_048_576,
  'deepseek-v4-pro': 1_048_576,
  'kimi-k2.7-code': 262_144,
  'kimi-k2.7-code-highspeed': 262_144,
  'qwen3.7-max-2026-06-08': 1_000_000,
  'doubao-seed-2-1-pro-260628': 262_144,
  'doubao-seed-evolving': 262_144,
  'grok-4': 1_000_000,
  'MiniMax-M3': 1_048_576
}

const MIFY_VISION_SUPPORT: Record<string, boolean> = {
  'mimo-v2.5': true,
  'pa/gpt-5.5': true,
  'gemini-3.5-flash': true,
  'doubao-seed-2-1-pro-260628': true,
  'doubao-seed-evolving': true,
  'MiniMax-M3': true,
  'pa/claude-sonnet-5': true,
  'pa/claude-opus-4-8': true,
  'pa/claude-opus-4-7': true,
  'pa/claude-opus-4-6': true,
  'pa/claude-sonnet-4-6': true,
  'kimi-k2.7-code': true,
  'kimi-k2.7-code-highspeed': true,
  'qwen3.7-max-2026-06-08': true,
  'grok-4': true
}

export const MIFY_MODEL_ROWS: MifyModelRow[] = [
  { groupLabel: 'MiMo', providerId: 'xiaomi', providerLabel: '小米', modelId: 'mimo-v2.5-pro', contextLimit: MIFY_CONTEXT_LIMITS['mimo-v2.5-pro'], supportsVision: false },
  { groupLabel: 'MiMo', providerId: 'xiaomi', providerLabel: '小米', modelId: 'mimo-v2.5', contextLimit: MIFY_CONTEXT_LIMITS['mimo-v2.5'], supportsVision: true },
  { groupLabel: 'Claude', providerId: 'ppio', providerLabel: 'PPIO', modelId: 'pa/claude-sonnet-5', contextLimit: MIFY_CONTEXT_LIMITS['pa/claude-sonnet-5'], supportsVision: true },
  { groupLabel: 'Claude', providerId: 'ppio', providerLabel: 'PPIO', modelId: 'pa/claude-opus-4-8', contextLimit: MIFY_CONTEXT_LIMITS['pa/claude-opus-4-8'], supportsVision: true },
  { groupLabel: 'Claude', providerId: 'ppio', providerLabel: 'PPIO', modelId: 'pa/claude-opus-4-7', contextLimit: MIFY_CONTEXT_LIMITS['pa/claude-opus-4-7'], supportsVision: true },
  { groupLabel: 'Claude', providerId: 'ppio', providerLabel: 'PPIO', modelId: 'pa/claude-opus-4-6', contextLimit: MIFY_CONTEXT_LIMITS['pa/claude-opus-4-6'], supportsVision: true },
  { groupLabel: 'Claude', providerId: 'ppio', providerLabel: 'PPIO', modelId: 'pa/claude-sonnet-4-6', contextLimit: MIFY_CONTEXT_LIMITS['pa/claude-sonnet-4-6'], supportsVision: true },
  { groupLabel: 'GPT', providerId: 'ppio', providerLabel: 'PPIO', modelId: 'pa/gpt-5.5', contextLimit: MIFY_CONTEXT_LIMITS['pa/gpt-5.5'], supportsVision: true },
  { groupLabel: 'Gemini', providerId: 'vertex_ai', providerLabel: 'Vertex AI', modelId: 'gemini-3.5-flash', contextLimit: MIFY_CONTEXT_LIMITS['gemini-3.5-flash'], supportsVision: true },
  { groupLabel: 'GLM', providerId: 'zhipuai', providerLabel: '智谱', modelId: 'glm-5.2', contextLimit: MIFY_CONTEXT_LIMITS['glm-5.2'], supportsVision: false },
  { groupLabel: 'GLM', providerId: 'tongyi', providerLabel: '阿里通义', modelId: 'tongyi/glm-5.2', contextLimit: MIFY_CONTEXT_LIMITS['tongyi/glm-5.2'], supportsVision: false },
  { groupLabel: 'DeepSeek', providerId: 'deepseek', providerLabel: 'DeepSeek', modelId: 'deepseek/deepseek-v4-pro', contextLimit: MIFY_CONTEXT_LIMITS['deepseek/deepseek-v4-pro'], supportsVision: false },
  { groupLabel: 'DeepSeek', providerId: 'tongyi', providerLabel: '阿里通义', modelId: 'deepseek-v4-pro', contextLimit: MIFY_CONTEXT_LIMITS['deepseek-v4-pro'], supportsVision: false },
  { groupLabel: 'Kimi', providerId: 'moonshot', providerLabel: 'Moonshot', modelId: 'kimi-k2.7-code', contextLimit: MIFY_CONTEXT_LIMITS['kimi-k2.7-code'], supportsVision: true },
  { groupLabel: 'Kimi', providerId: 'moonshot', providerLabel: 'Moonshot', modelId: 'kimi-k2.7-code-highspeed', contextLimit: MIFY_CONTEXT_LIMITS['kimi-k2.7-code-highspeed'], supportsVision: true },
  { groupLabel: 'Qwen', providerId: 'tongyi', providerLabel: '阿里通义', modelId: 'qwen3.7-max-2026-06-08', contextLimit: MIFY_CONTEXT_LIMITS['qwen3.7-max-2026-06-08'], supportsVision: true },
  { groupLabel: 'Doubao', providerId: 'volcengine_maas', providerLabel: '火山引擎', modelId: 'doubao-seed-2-1-pro-260628', contextLimit: MIFY_CONTEXT_LIMITS['doubao-seed-2-1-pro-260628'], supportsVision: true },
  { groupLabel: 'Doubao', providerId: 'volcengine_maas', providerLabel: '火山引擎', modelId: 'doubao-seed-evolving', contextLimit: MIFY_CONTEXT_LIMITS['doubao-seed-evolving'], supportsVision: true },
  { groupLabel: 'Grok', providerId: 'ppio', providerLabel: 'PPIO', modelId: 'grok-4', contextLimit: MIFY_CONTEXT_LIMITS['grok-4'], supportsVision: true },
  { groupLabel: 'MiniMax', providerId: 'minimax', providerLabel: 'MiniMax', modelId: 'MiniMax-M3', contextLimit: MIFY_CONTEXT_LIMITS['MiniMax-M3'], supportsVision: true }
]

const DIRECT_MODEL_CONTEXT_LIMITS: Record<string, Record<string, number>> = {
  deepseek: {
    'deepseek-v4-pro': 1_048_576,
    'deepseek-reasoner': 128_000,
    'deepseek-chat': 128_000
  },
  anthropic: {
    'claude-sonnet-5': 1_000_000,
    'claude-opus-4-8': 1_000_000,
    'claude-opus-4-7': 1_000_000
  },
  openai: {
    'gpt-5.5': 1_050_000,
    'gpt-5.4-pro': 1_050_000,
    'gpt-5.4': 1_050_000,
    'gpt-5.2': 400_000,
    'gpt-4.1': 1_048_576
  },
  google: {
    'gemini-3.5-flash': 1_048_576,
    'gemini-3.1-pro-preview': 1_048_576,
    'gemini-3-flash-preview': 1_048_576
  },
  xai: {
    'grok-4.3': 1_000_000,
    'grok-4.1-fast': 2_000_000,
    'grok-4': 256_000
  },
  kimi: {
    'kimi-k2.7-code': 262_144,
    'kimi-k2.7-code-highspeed': 262_144,
    'kimi-k2.6': 262_144,
    'kimi-k2.5': 262_144
  },
  qwen: {
    'qwen3.7-max-2026-06-08': 1_000_000,
    'qwen3.7-plus': 1_000_000,
    'qwen3.6-flash': 1_000_000
  },
  seed: {
    'doubao-seed-2-1-pro-260628': 262_144,
    'doubao-seed-evolving': 262_144,
    'doubao-seed-2-0-code-preview-260215': 262_144
  },
  glm: {
    'glm-5.2': 1_048_576,
    'glm-5': 128_000,
    'glm-5-turbo': 128_000
  },
  minimax: {
    'MiniMax-M3': 1_048_576,
    'MiniMax-M2.5': 1_000_000,
    'MiniMax-M2.1': 1_000_000
  }
}

export function findMifyModelRow(providerId: string | undefined, modelId: string): MifyModelRow | undefined {
  return MIFY_MODEL_ROWS.find((row) => row.providerId === providerId && row.modelId === modelId)
}

export function getContextLimit(providerKey: string, modelId?: string, mifySubProvider?: string): number {
  return getModelContextLimit(providerKey, modelId, mifySubProvider)
}

export function getModelContextLimit(providerKey: string, modelId?: string, mifySubProvider?: string): number {
  const model = modelId?.trim()
  if (providerKey === 'mify' && model) {
    const row = findMifyModelRow(mifySubProvider, model)
    return row?.contextLimit || MIFY_CONTEXT_LIMITS[model] || PROVIDER_PRESETS.mify.contextLimit
  }
  if (model && DIRECT_MODEL_CONTEXT_LIMITS[providerKey]?.[model]) {
    return DIRECT_MODEL_CONTEXT_LIMITS[providerKey][model]
  }
  return PROVIDER_PRESETS[providerKey]?.contextLimit ?? 262_144
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
 * 1. mify 明确到单模型 → 以单模型为准
 * 2. provider preset 明确标记 supportsVision → 以该标记为准
 * 3. 模型名匹配已知视觉模型关键词 → 支持
 */
const VISION_MODEL_PATTERNS = [
  /claude/i,
  /gpt-4o|gpt-5|gpt-4-turbo/i,
  /gemini/i,
  /grok/i,
  /glm-5|glm-4/i,
  /qwen.*vl|qwen.*omni|qwen3\.7|qwen3\.6|qwen3-coder/i,
  /minimax-m/i,
  /kimi-k2/i,
  /doubao-seed/i,
  /vision|vl|omni/i,
]

export function modelSupportsVision(providerId: string, model: string): boolean {
  if (providerId === 'mify' && model in MIFY_CONTEXT_LIMITS) {
    return MIFY_VISION_SUPPORT[model] === true
  }
  const preset = PROVIDER_PRESETS[providerId]
  if (preset?.supportsVision === true) return true
  if (preset?.supportsVision === false) {
    return VISION_MODEL_PATTERNS.some((re) => re.test(model))
  }
  return true
}
