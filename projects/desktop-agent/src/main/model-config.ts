export interface ModelConfig {
  providerId: string
  model: string
  apiKey: string
  apiBaseUrl: string
  apiFormat: 'openai' | 'anthropic'
  contextLimit: number
  customProviderId?: string
  autoApproveLow?: boolean
}

export interface StoredModelConfig extends ModelConfig {
  _id?: string
}

export interface ModelConfigStore {
  configs: StoredModelConfig[]
  activeId: string | null
}

export interface RendererModelConfig extends ModelConfig {
  hasSavedApiKey?: boolean
}

export interface RendererModelConfigStore {
  configs: RendererModelConfig[]
  activeId: string | null
}

export function normalizeModelConfig(cfg: ModelConfig): ModelConfig {
  return {
    ...cfg,
    providerId: cfg.providerId.trim(),
    model: cfg.model.trim(),
    apiKey: cfg.apiKey.trim(),
    apiBaseUrl: cfg.apiBaseUrl.trim(),
    customProviderId: cfg.customProviderId?.trim() || undefined
  }
}

export function validateModelConfig(cfg: Pick<ModelConfig, 'apiKey'>): string | null {
  const key = cfg.apiKey || ''
  if (!key.trim()) return '模型访问配置为空，请重新配置模型'
  if (/\s/.test(key)) return '模型访问配置里包含空格或换行，请重新配置模型'
  if (/[\u0100-\uFFFF]/.test(key)) return '模型访问配置里包含中文或特殊字符，请重新配置模型'
  return null
}

export function sameModelSlot(
  a: Pick<ModelConfig, 'providerId' | 'model' | 'customProviderId'>,
  b: Pick<ModelConfig, 'providerId' | 'model' | 'customProviderId'>
): boolean {
  return a.providerId === b.providerId && a.model === b.model && (a.customProviderId || '') === (b.customProviderId || '')
}

export function sameProviderSlot(
  a: Pick<ModelConfig, 'providerId' | 'customProviderId'>,
  b: Pick<ModelConfig, 'providerId' | 'customProviderId'>
): boolean {
  return a.providerId === b.providerId && (a.customProviderId || '') === (b.customProviderId || '')
}

export function resolveModelConfigForSave(incoming: ModelConfig, existingConfigs: ModelConfig[]): ModelConfig {
  const next = normalizeModelConfig(incoming)
  if (next.apiKey) return next

  const existing = existingConfigs.find((cfg) => sameModelSlot(next, cfg) && !validateModelConfig(cfg))
    || existingConfigs.find((cfg) => sameProviderSlot(next, cfg) && !validateModelConfig(cfg))

  return existing ? { ...next, apiKey: existing.apiKey } : next
}

export function sanitizeModelConfigForRenderer<T extends StoredModelConfig>(
  cfg: T | null
): (Omit<T, 'apiKey'> & RendererModelConfig) | null {
  if (!cfg) return null
  const hasSavedApiKey = Boolean(cfg.apiKey && !validateModelConfig(cfg))
  return { ...cfg, apiKey: '', hasSavedApiKey }
}

export function sanitizeModelConfigStoreForRenderer(store: ModelConfigStore): RendererModelConfigStore {
  return {
    activeId: store.activeId,
    configs: store.configs.map((cfg) => sanitizeModelConfigForRenderer(cfg) as RendererModelConfig)
  }
}
