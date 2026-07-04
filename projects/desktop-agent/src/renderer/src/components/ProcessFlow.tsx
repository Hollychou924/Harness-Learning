import { AlertCircle } from 'lucide-react'
import { useTaskStore } from '../store/task'
import { useSettingsStore } from './settings/settingsStore'
import { ApprovalCard } from './ApprovalCard'
import { PlanCard } from './PlanCard'
import { TodoChecklist } from './TodoChecklist'
import { SubtaskList } from './SubtaskList'
import { TurnItemsView } from './TurnItemsView'
import { LiveStatusBar } from './LiveStatusBar'
import type { Turn } from '../../../agent/src/items'

// 当前实时轮次的执行过程展示 + 全局态卡片(计划/待办/子任务/审批)
// 条目本身的渲染逻辑在 TurnItemsView，历史轮次也共用它
export function ProcessFlow() {
  const { status, currentTurn, error } = useTaskStore()
  const { showThinking } = useSettingsStore()
  // 只渲染实时轮(currentTurn)；历史轮由 Workbench 的 turns.map 统一渲染，避免重复
  // 旧逻辑 currentTurn || turns[turns.length-1] 会在 currentTurn 置空瞬间兜底渲染历史最后一轮，导致重复展示
  const latestTurn: Turn | null = currentTurn || null

  return (
    <div className="space-y-2">
      {latestTurn && <TurnItemsView turn={latestTurn} showThinking={showThinking} showStatusLine />}

      <PlanCard />
      <TodoChecklist />
      <SubtaskList />
      <ApprovalCard />

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      <LiveStatusBar />
    </div>
  )
}
