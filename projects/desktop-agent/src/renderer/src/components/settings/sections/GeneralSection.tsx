import { useSettingsStore, type ThemeMode } from '../settingsStore'
import {
  SettingsGroup,
  SettingsPageHeader,
  SettingsRow,
  SettingsSectionLabel,
  SettingsSegmented,
  SettingsToggle
} from '../settingsUi'

const THEME_OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: '自动' },
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' }
]

export function GeneralSection() {
  const { maxIterations, approvalMode, showThinking, preventSystemSleep, themeMode, saveGeneral } = useSettingsStore()

  const persist = (patch: Partial<{ themeMode: ThemeMode; preventSystemSleep: boolean; showThinking: boolean }>) => {
    saveGeneral({
      maxIterations,
      approvalMode,
      showThinking: patch.showThinking ?? showThinking,
      preventSystemSleep: patch.preventSystemSleep ?? preventSystemSleep,
      themeMode: patch.themeMode ?? themeMode
    })
  }

  return (
    <section>
      <SettingsPageHeader title="通用" subtitle="外观与任务相关的基本偏好" />

      <div className="space-y-5">
        <div>
          <SettingsSectionLabel>外观</SettingsSectionLabel>
          <SettingsGroup footer="选择「自动」时跟随系统浅色 / 深色。">
            <SettingsRow label="主题" last>
              <SettingsSegmented
                value={themeMode}
                options={THEME_OPTIONS}
                onChange={(v) => persist({ themeMode: v })}
              />
            </SettingsRow>
          </SettingsGroup>
        </div>

        <div>
          <SettingsSectionLabel>任务</SettingsSectionLabel>
          <SettingsGroup>
            <SettingsRow
              label={
                <div>
                  <div>运行时保持唤醒</div>
                  <div className="mt-0.5 text-[11px] font-normal text-[var(--ink-soft)]">
                    任务进行中防止电脑休眠
                  </div>
                </div>
              }
            >
              <SettingsToggle
                checked={preventSystemSleep}
                onChange={(v) => persist({ preventSystemSleep: v })}
              />
            </SettingsRow>
            <SettingsRow
              last
              label={
                <div>
                  <div>显示思考过程</div>
                  <div className="mt-0.5 text-[11px] font-normal text-[var(--ink-soft)]">
                    在任务界面展示推理步骤
                  </div>
                </div>
              }
            >
              <SettingsToggle
                checked={showThinking}
                onChange={(v) => persist({ showThinking: v })}
              />
            </SettingsRow>
          </SettingsGroup>
        </div>
      </div>
    </section>
  )
}
