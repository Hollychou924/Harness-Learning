export interface ModelConfig {
  providerId: string
  model: string
  apiKey: string
  apiBaseUrl: string
  apiFormat: 'openai' | 'anthropic'
  contextLimit: number
  customProviderId?: string
  customModelId?: string
  displayName?: string
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
    customProviderId: cfg.customProviderId?.trim() || undefined,
    customModelId: cfg.customModelId?.trim() || undefined,
    displayName: cfg.displayName?.trim() || undefined
  }
}

export function validateModelConfig(cfg: Pick<ModelConfig, 'apiKey'>): string | null {
  const key = cfg.apiKey || ''
  if (!key.trim()) return '没有找到访问密钥，请在设置里填写访问密钥后再试'
  if (/\s/.test(key)) return '访问密钥里有空格或换行，请重新粘贴一次'
  if (/[\u0100-\uFFFF]/.test(key)) return '访问密钥里有中文或特殊字符，请重新粘贴一次'
  return null
}

function customSlotId(cfg: Pick<ModelConfig, 'customModelId'> & { _id?: string }): string {
  return cfg.customModelId || cfg._id || ''
}

export function sameModelSlot(
  a: Pick<ModelConfig, 'providerId' | 'model' | 'customProviderId' | 'customModelId'> & { _id?: string },
  b: Pick<ModelConfig, 'providerId' | 'model' | 'customProviderId' | 'customModelId'> & { _id?: string }
): boolean {
  if (a.providerId === 'custom' || b.providerId === 'custom') {
    const aId = customSlotId(a)
    const bId = customSlotId(b)
    if (aId || bId) return a.providerId === b.providerId && aId === bId
  }
  return a.providerId === b.providerId && a.model === b.model && (a.customProviderId || '') === (b.customProviderId || '')
}

export function sameProviderSlot(
  a: Pick<ModelConfig, 'providerId' | 'customProviderId' | 'customModelId'> & { _id?: string },
  b: Pick<ModelConfig, 'providerId' | 'customProviderId' | 'customModelId'> & { _id?: string }
): boolean {
  if (a.providerId === 'custom' || b.providerId === 'custom') {
    const aId = customSlotId(a)
    const bId = customSlotId(b)
    return a.providerId === b.providerId && Boolean(aId) && aId === bId
  }
  if (a.providerId === 'mify' && b.providerId === 'mify') return true
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
