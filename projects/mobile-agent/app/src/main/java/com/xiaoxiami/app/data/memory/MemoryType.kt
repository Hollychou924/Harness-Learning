package com.xiaoxiami.app.data.memory

/**
 * 长期记忆的类型枚举
 */
enum class MemoryType {
    FACT,        // 事实：客观信息（如：在北京工作）
    PREFERENCE,  // 偏好：主观倾向（如：回复要简短）
    DECISION,    // 决策：达成的共识（如：功能设计方案）
    LESSON       // 教训：错误记录或纠正
}
