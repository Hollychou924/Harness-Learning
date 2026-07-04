import { create } from 'zustand'

// 全局详细程度三档开关（来自综合方案需求4：能控制详细程度）
// normal：默认行为（思考自动收起、过程按规则折叠）
// expandAll：全部展开（所有思考块+执行块展开）
// conclusionOnly：只看结论（收起所有过程，只留最终回复）
export type DetailLevel = 'normal' | 'expandAll' | 'conclusionOnly'

interface DetailLevelState {
  level: DetailLevel
  setLevel: (level: DetailLevel) => void
}

export const useDetailLevelStore = create<DetailLevelState>((set) => ({
  level: 'normal',
  setLevel: (level) => set({ level })
}))
