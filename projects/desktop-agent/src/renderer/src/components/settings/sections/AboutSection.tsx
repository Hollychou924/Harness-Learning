// @ts-ignore - 静态图片类型声明待补齐
import xiaolanjingIcon from '../../../assets/xiaolanjing-icon.png'
import { SettingsGroup, SettingsPageHeader, SettingsRow } from '../settingsUi'

export function AboutSection() {
  return (
    <section>
      <SettingsPageHeader title="关于" />

      <div className="mb-6 flex flex-col items-center py-4 text-center">
        <img
          src={xiaolanjingIcon}
          alt="小蓝鲸"
          className="mb-3 h-[72px] w-[72px] rounded-[18px] shadow-sm"
          draggable={false}
        />
        <h4 className="text-[20px] font-semibold tracking-tight text-[var(--ink)]">小蓝鲸</h4>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">桌面生产力 Agent</p>
      </div>

      <SettingsGroup>
        <SettingsRow label="版本">
          <span className="text-[13px] tabular-nums text-[var(--ink-secondary)]">0.1.0</span>
        </SettingsRow>
        <SettingsRow label="运行环境">
          <span className="text-[13px] text-[var(--ink-secondary)]">Electron · macOS</span>
        </SettingsRow>
        <SettingsRow label="界面" last>
          <span className="text-[13px] text-[var(--ink-secondary)]">React · Tailwind</span>
        </SettingsRow>
      </SettingsGroup>
    </section>
  )
}
