import { useSettingsStore, MIFY_PROVIDER_ID_CHIPS, getMifyModelIds } from '../settingsStore'

export function MifySection() {
  const { modelConfig } = useSettingsStore()
  const isMifyActive = modelConfig?.providerId === 'mify'
  const currentRoute = modelConfig?.customProviderId

  return (
    <section>
      <header className="mb-5">
        <h3 className="text-lg font-semibold text-[var(--ink)]">Mify 网关</h3>
        <p className="text-sm text-[var(--ink-soft)] mt-1">通过 Mify 推理网关统一路由多家模型供应商，内置 Key 免配置</p>
      </header>

      <div className="space-y-4">
        <div className="glass-soft rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isMifyActive ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-sm font-medium text-[var(--ink)]">
              {isMifyActive ? 'Mify 网关已启用' : '未启用 Mify 网关'}
            </span>
          </div>
          {isMifyActive && currentRoute && (
            <div className="text-xs text-[var(--ink-soft)] mt-1">
              当前路由：{MIFY_PROVIDER_ID_CHIPS.find((c) => c.id === currentRoute)?.label || currentRoute}
              {modelConfig?.model && ` · ${modelConfig.model}`}
            </div>
          )}
          {!isMifyActive && (
            <div className="text-xs text-[var(--ink-soft)] mt-1">
              前往「模型配置」选择 Mify 推理网关即可启用
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">可用路由供应商</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {MIFY_PROVIDER_ID_CHIPS.map((chip) => {
              const models = getMifyModelIds(chip.id)
              return (
                <div key={chip.id} className="glass-soft rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--ink)]">{chip.label}</span>
                    {currentRoute === chip.id && (
                      <span className="text-[10px] text-green-500 font-medium">当前</span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--ink-soft)] mt-1 line-clamp-2">
                    {models.length} 个可用模型
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
