import { create } from 'zustand'
import { api, type ModelConfig } from '../../api'
import {
  PROVIDER_PRESETS,
  BUILTIN_PROVIDER_ORDER,
  getContextLimit,
  MIFY_PROVIDER_ID_CHIPS,
  MIFY_GATEWAY_DEFAULT_MODEL_ID,
  getMifyModelIds,
  getModelThinkingConfig
} from '../providerPresets'

export type SettingsTab =
  | 'model'
  | 'general'
  | 'archived'
  | 'diagnostics'
  | 'about'

export type ApprovalMode = 'always_ask' | 'risk_only' | 'auto'
export type ThemeMode = 'system' | 'dark' | 'light'

interface SettingsState {
  open: boolean
  activeTab: SettingsTab
  modelConfig: ModelConfig | null
  hasApiKey: boolean
  maxIterations: number
  autoApproveLow: boolean
  approvalMode: ApprovalMode
  showThinking: boolean
  themeMode: ThemeMode
  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void
  setActiveTab: (tab: SettingsTab) => void
  refreshModelConfig: () => Promise<void>
  saveModelConfig: (cfg: ModelConfig) => Promise<void>
  saveGeneral: (opts: { maxIterations: number; autoApproveLow?: boolean; approvalMode?: ApprovalMode; showThinking: boolean; themeMode?: ThemeMode }) => void
  loadGeneral: () => void
}

const GENERAL_KEY = 'xld.general.v1'

function loadGeneralFromStorage() {
  try {
    const raw = localStorage.getItem(GENERAL_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function approvalModeFromSaved(saved: { approvalMode?: unknown; autoApproveLow?: unknown } | null): ApprovalMode {
  if (saved?.approvalMode === 'always_ask' || saved?.approvalMode === 'risk_only' || saved?.approvalMode === 'auto') return saved.approvalMode
  return saved?.autoApproveLow ? 'risk_only' : 'always_ask'
}

function autoApproveLowFromMode(mode: ApprovalMode): boolean {
  return mode !== 'always_ask'
}

function themeModeFromSaved(saved: { themeMode?: unknown } | null): ThemeMode {
  if (saved?.themeMode === 'dark' || saved?.themeMode === 'light' || saved?.themeMode === 'system') return saved.themeMode
  return 'system'
}

function saveGeneralToStorage(opts: { maxIterations: number; autoApproveLow?: boolean; approvalMode?: ApprovalMode; showThinking: boolean; themeMode?: ThemeMode }) {
  try {
    const approvalMode = opts.approvalMode ?? (opts.autoApproveLow ? 'risk_only' : 'always_ask')
    localStorage.setItem(GENERAL_KEY, JSON.stringify({
      ...opts,
      approvalMode,
      autoApproveLow: autoApproveLowFromMode(approvalMode),
      themeMode: opts.themeMode ?? 'system'
    }))
  } catch {
    /* ignore */
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  open: false,
  activeTab: 'general',
  modelConfig: null,
  hasApiKey: false,
  maxIterations: 8,
  autoApproveLow: false,
  approvalMode: 'always_ask',
  showThinking: true,
  themeMode: 'system',

  openSettings: (tab) => {
    set({ open: true, activeTab: tab ?? get().activeTab })
    void get().refreshModelConfig()
    get().loadGeneral()
  },
  closeSettings: () => set({ open: false }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  refreshModelConfig: async () => {
    const cfg = (await api.configGet('modelConfig')) as ModelConfig | null
    const hasKey = Boolean(await api.configGet('hasApiKey'))
    set({ modelConfig: cfg, hasApiKey: hasKey })
  },

  saveModelConfig: async (cfg) => {
    const result = await api.saveModelConfig(cfg)
    if (!result.success) throw new Error(result.error || '模型保存失败，请重试')
    await get().refreshModelConfig()
  },

  loadGeneral: () => {
    const saved = loadGeneralFromStorage()
    if (saved) {
      const approvalMode = approvalModeFromSaved(saved)
      const themeMode = themeModeFromSaved(saved)
      set({
        maxIterations: saved.maxIterations ?? 8,
        autoApproveLow: autoApproveLowFromMode(approvalMode),
        approvalMode,
        showThinking: saved.showThinking ?? true,
        themeMode
      })
    }
  },

  saveGeneral: (opts) => {
    const approvalMode = opts.approvalMode ?? (opts.autoApproveLow ? 'risk_only' : 'always_ask')
    const themeMode = opts.themeMode ?? get().themeMode
    saveGeneralToStorage({ ...opts, approvalMode, themeMode })
    void api.setThemeMode(themeMode)
    set({ ...opts, themeMode, approvalMode, autoApproveLow: autoApproveLowFromMode(approvalMode) })
  }
}))

export {
  PROVIDER_PRESETS,
  BUILTIN_PROVIDER_ORDER,
  getContextLimit,
  MIFY_PROVIDER_ID_CHIPS,
  MIFY_GATEWAY_DEFAULT_MODEL_ID,
  getMifyModelIds,
  getModelThinkingConfig
}
