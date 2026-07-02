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
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  anthropic: {
    label: 'Anthropic',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    keyPlaceholder: 'sk-ant-...',
    modelCandidates: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-sonnet-4-5-20250929'],
    contextLimit: 200_000,
    supportsVision: true
  },
  minimax: {
    label: 'MiniMax',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    keyPlaceholder: 'eyJ... (MiniMax API Key)',
    modelCandidates: ['MiniMax-M2.5', 'MiniMax-M2.1'],
    contextLimit: 1_000_000,
    supportsVision: true
  },
  kimi: {
    label: 'Kimi (月之暗面)',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.moonshot.cn/anthropic',
    keyPlaceholder: 'sk-...',
    modelCandidates: ['kimi-k2.5'],
    contextLimit: 128_000
  },
  glm: {
    label: '智谱 GLM',
    apiFormat: 'anthropic',
    baseUrl: 'https://open.bigmodel.cn/api/anthropic',
    keyPlaceholder: '智谱开放平台 API Key',
    modelCandidates: ['glm-5', 'glm-4.7'],
    contextLimit: 128_000,
    supportsVision: true
  },
  seed: {
    label: '豆包 (火山引擎)',
    apiFormat: 'anthropic',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/compatible',
    keyPlaceholder: '火山方舟 API Key',
    modelCandidates: ['ark-code-latest', 'doubao-seed-2-0-pro-260215', 'doubao-seed-2-0-lite-260215'],
    contextLimit: 128_000
  },
  qwen: {
    label: '阿里通义千问 (Qwen)',
    apiFormat: 'anthropic',
    baseUrl: 'https://dashscope.aliyuncs.com/apps/anthropic',
    keyPlaceholder: '阿里云百炼 API Key',
    modelCandidates: ['qwen3.5-plus', 'qwen3-coder-plus'],
    contextLimit: 128_000,
    supportsVision: true
  },
  deepseek: {
    label: 'DeepSeek',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.deepseek.com/anthropic',
    keyPlaceholder: 'sk-...',
    modelCandidates: ['deepseek-reasoner', 'deepseek-chat'],
    contextLimit: 64_000,
    supportsVision: false
  },
  openai: {
    label: 'OpenAI',
    apiFormat: 'openai',
    baseUrl: 'https://api.openai.com',
    keyPlaceholder: 'sk-...',
    modelCandidates: ['gpt-5.2-2025-12-11', 'gpt-5.2-codex'],
    contextLimit: 128_000,
    supportsVision: true
  },
  google: {
    label: 'Google Gemini',
    apiFormat: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyPlaceholder: 'AIza...',
    modelCandidates: ['gemini-3-pro-preview', 'gemini-3.1-pro-preview', 'gemini-3-flash-preview'],
    contextLimit: 1_000_000,
    supportsVision: true
  },
  xai: {
    label: 'xAI (Grok)',
    apiFormat: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    keyPlaceholder: 'xAI API Key',
    modelCandidates: ['grok-4', 'grok-3-mini'],
    contextLimit: 131_072,
    supportsVision: true
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

export const MIFY_PROVIDER_MODELS: Record<string, string[]> = {
  xiaomi: ['mimo-v2-pro', 'mimo-v2-flash', 'mimo-v2-omni'],
  azure_openai: ['gpt-5.4-pro', 'gpt-5.4'],
  tongyi: ['qwen3.5-122b-a10b', 'qwen3.5-plus-2026-02-15'],
  volcengine_maas: ['doubao-seed-2-0-code-preview-260215', 'doubao-seed-2-0-pro-260215'],
  zhipuai: ['glm-5-turbo', 'glm-5'],
  siliconflow: ['Pro/zai-org/GLM-5', 'Pro/moonshotai/Kimi-K2.5'],
  vertex_ai: ['gemini-3.1-flash-lite-preview', 'gemini-3.1-pro-preview-pt', 'gemini-3.1-pro-preview'],
  minimax: ['MiniMax-M2.7', 'MiniMax-M2.5'],
  ppio: ['pa/claude-sonnet-4-5-20250929', 'pa/claude-haiku-4-5-20251001', 'pa/claude-opus-4-6', 'pa/claude-sonnet-4-6', 'grok-4', 'gpt-5-mini', 'gpt-5-nano']
}

export const MIFY_GATEWAY_DEFAULT_MODEL_ID = 'mimo-v2-pro'

export function getContextLimit(providerKey: string): number {
  return PROVIDER_PRESETS[providerKey]?.contextLimit ?? 128_000
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
