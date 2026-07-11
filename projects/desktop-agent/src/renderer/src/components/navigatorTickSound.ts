// 定位条悬停轻音效：每碰到一格响一下，连续滑动时连成"哒哒哒"的短促序列。
// 使用 Web Audio 合成，不依赖音频文件；音量很低、时长 ~50ms，避免堆叠浑浊。
let ctx: AudioContext | null = null

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function playNavigatorTick(index: number): void {
  const audio = ensureCtx()
  if (!audio) return
  const now = audio.currentTime
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  // 轻微随轮次变化频率，连续滑动时更有颗粒感而非单调"嘟"声。
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(820 + (index % 7) * 12, now)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.05, now + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
  osc.connect(gain).connect(audio.destination)
  osc.start(now)
  osc.stop(now + 0.06)
}
