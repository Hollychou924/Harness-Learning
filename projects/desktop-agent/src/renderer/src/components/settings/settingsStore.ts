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
  | 'mify'
  | 'permissions'
  | 'agent'
  | 'archived'
  | 'diagnostics'
  | 'about'

interface SettingsState {
  open: boolean
  activeTab: SettingsTab
  modelConfig: ModelConfig | null
  hasApiKey: boolean
  maxIterations: number
  autoApproveLow: boolean
  showThinking: boolean
  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void
  setActiveTab: (tab: SettingsTab) => void
  refreshModelConfig: () => Promise<void>
  saveModelConfig: (cfg: ModelConfig) => Promise<void>
  saveGeneral: (opts: { maxIterations: number; autoApproveLow: boolean; showThinking: boolean }) => void
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

function saveGeneralToStorage(opts: { maxIterations: number; autoApproveLow: boolean; showThinking: boolean }) {
  try {
    localStorage.setItem(GENERAL_KEY, JSON.stringify(opts))
  } catch {
    /* ignore */
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  open: false,
  activeTab: 'model',
  modelConfig: null,
  hasApiKey: false,
  maxIterations: 8,
  autoApproveLow: false,
  showThinking: true,

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
    await api.saveModelConfig(cfg)
    set({ modelConfig: cfg, hasApiKey: Boolean(cfg.apiKey) })
  },

  loadGeneral: () => {
    const saved = loadGeneralFromStorage()
    if (saved) {
      set({
        maxIterations: saved.maxIterations ?? 8,
        autoApproveLow: saved.autoApproveLow ?? false,
        showThinking: saved.showThinking ?? true
      })
    }
  },

  saveGeneral: (opts) => {
    saveGeneralToStorage(opts)
    set(opts)
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
