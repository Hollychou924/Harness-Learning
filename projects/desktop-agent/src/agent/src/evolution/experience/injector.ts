import type { AttributionCategory, Tactic, TaskFamily } from '../types.js'
import { ATTRIBUTION_INJECT_WEIGHT, ATTRIBUTION_LABEL } from '../attribution.js'
import { listTactics, seedDefaultTactics } from './store.js'

export interface InjectPlan {
  tactics: Tactic[]
  promptBlock: string
}

const SCOPE_WEIGHT = { project: 30, user: 15, general: 0 } as const

/**
 * 按任务族 + 归因优先级取 Top-K tactics。
 * 冲突原则：项目规范 > 用户风格 > 通用；未 validated 的不注入。
 * case 正文禁止进入此处（Golden 隔离）。
 */
export function selectTactics(
  workspaceDir: string | undefined,
  opts: {
    family: TaskFamily
    goal: string
    topK?: number
    preferAttribution?: AttributionCategory
    /** 回测时强制纳入（即使 validated===false） */
    forceIncludeIds?: string[]
  }
): InjectPlan {
  if (!workspaceDir) return { tactics: [], promptBlock: '' }
  seedDefaultTactics(workspaceDir, opts.family)
  const force = new Set(opts.forceIncludeIds || [])
  const envForce = (process.env.XIAOLANJING_FORCE_TACTIC_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const id of envForce) force.add(id)
  const all = listTactics(workspaceDir).filter(
    (t) => t.enabled && t.family === opts.family && (t.validated !== false || force.has(t.id))
  )
  const goalLower = opts.goal.toLowerCase()
  const scored = all
    .map((t) => {
      const attr = t.attribution || 'defect'
      const scope = t.scope || 'project'
      const tagHits = t.trigger_tags.filter((tag) => goalLower.includes(tag.toLowerCase())).length
      const preferBoost = opts.preferAttribution && opts.preferAttribution === attr ? 35 : 0
      const score =
        t.priority +
        tagHits * 20 +
        ATTRIBUTION_INJECT_WEIGHT[attr] +
        SCOPE_WEIGHT[scope] +
        preferBoost
      return { t, score, attr }
    })
    .sort((a, b) => b.score - a.score)

  const topK = opts.topK ?? 4
  let tactics = scored.slice(0, topK).map((x) => x.t)
  // 强制纳入的草稿：即使未进 Top-K 也追加（回测用）
  if (force.size > 0) {
    const have = new Set(tactics.map((t) => t.id))
    for (const id of force) {
      if (have.has(id)) continue
      const extra = all.find((t) => t.id === id)
      if (extra) tactics.push(extra)
    }
  }
  if (tactics.length === 0) return { tactics: [], promptBlock: '' }

  const lines = tactics.map((t, i) => {
    const attr = t.attribution || 'defect'
    const scope = t.scope || 'project'
    return `${i + 1}. [${ATTRIBUTION_LABEL[attr]}/${scope}] ${t.title}：${t.body}`
  })
  const promptBlock = `\n\n## 经验策略（四类归因；冲突时：项目规范 > 用户风格 > 通用）\n${lines.join('\n')}`
  return { tactics, promptBlock }
}
