export interface ProviderPreset {
  label: string
  apiFormat: 'openai' | 'anthropic'
  baseUrl: string
  keyPlaceholder: string
  modelCandidates: string[]
  contextLimit: number
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  anthropic: {
    label: 'Anthropic',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    keyPlaceholder: 'sk-ant-...',
    modelCandidates: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-sonnet-4-5-20250929'],
    contextLimit: 200_000
  },
  minimax: {
    label: 'MiniMax',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    keyPlaceholder: 'eyJ... (MiniMax API Key)',
    modelCandidates: ['MiniMax-M2.5', 'MiniMax-M2.1'],
    contextLimit: 1_000_000
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
    contextLimit: 128_000
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
    contextLimit: 128_000
  },
  deepseek: {
    label: 'DeepSeek',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.deepseek.com/anthropic',
    keyPlaceholder: 'sk-...',
    modelCandidates: ['deepseek-reasoner', 'deepseek-chat'],
    contextLimit: 64_000
  },
  openai: {
    label: 'OpenAI',
    apiFormat: 'openai',
    baseUrl: 'https://api.openai.com',
    keyPlaceholder: 'sk-...',
    modelCandidates: ['gpt-5.2-2025-12-11', 'gpt-5.2-codex'],
    contextLimit: 128_000
  },
  google: {
    label: 'Google Gemini',
    apiFormat: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyPlaceholder: 'AIza...',
    modelCandidates: ['gemini-3-pro-preview', 'gemini-3.1-pro-preview', 'gemini-3-flash-preview'],
    contextLimit: 1_000_000
  },
  xai: {
    label: 'xAI (Grok)',
    apiFormat: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    keyPlaceholder: 'xAI API Key',
    modelCandidates: ['grok-4', 'grok-3-mini'],
    contextLimit: 131_072
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
  'anthropic',
  ...Object.keys(PROVIDER_PRESETS).filter((id) => id !== 'anthropic' && id !== 'custom'),
  'custom'
]

export function getContextLimit(providerKey: string): number {
  return PROVIDER_PRESETS[providerKey]?.contextLimit ?? 128_000
}
