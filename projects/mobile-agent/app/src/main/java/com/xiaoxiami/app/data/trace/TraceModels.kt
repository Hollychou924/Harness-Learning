package com.xiaoxiami.app.data.trace

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import com.google.gson.Gson
import java.util.UUID

// ==================== Enums ====================

enum class TraceStatus {
    SUCCESS, EMPTY, FAILED, SKIPPED, PARTIAL, RUNNING, MANUAL_STOPPED
}

// ==================== Type Converters ====================

class TraceTypeConverters {
    private val gson = Gson()

    @TypeConverter
    fun fromTraceStatus(value: TraceStatus): String = value.name

    @TypeConverter
    fun toTraceStatus(value: String): TraceStatus = runCatching { TraceStatus.valueOf(value) }.getOrDefault(TraceStatus.FAILED)

    @TypeConverter
    fun fromMap(value: Map<String, Any>?): String {
        return gson.toJson(value ?: emptyMap<String, Any>())
    }

    @TypeConverter
    fun toMap(value: String?): Map<String, Any> {
        return try {
            gson.fromJson(value ?: "{}", Map::class.java) as Map<String, Any>
        } catch (e: Exception) {
            emptyMap()
        }
    }
}

// ==================== Entities ====================

/**
 * Trace Root (任务级)
 * 一次后台任务 / 一次自动化执行的主 ID
 */
@Entity(tableName = "trace_runs")
data class TraceRun(
    @PrimaryKey
    val traceId: String, // trace_u1_d1_20251224_010203_1234
    val traceType: String, // agent_chat, automation_run
    val taskDate: String, // 2025-12-24
    val userId: String = "",
    val deviceId: String = "",
    
    val trigger: String, // nightly|manual|retry
    val pipelineVersion: String = "v0.9.3",
    val env: String = "prod",
    
    val startAt: Long = System.currentTimeMillis(),
    val endAt: Long? = null,
    val finalStatus: TraceStatus = TraceStatus.RUNNING,
    val stopAfterEnabled: Boolean = false,
    
    val statsJson: String = "{}" // JSON of stats
) {
    fun getDisplayOrigin(): String {
        return when {
            trigger == "scheduled" -> "自动触发 (每晚)"
            trigger == "user_trigger" && traceType == "manual_pipeline" -> "手动触发 (真实数据)"
            trigger == "debug_ui" || traceType.contains("mock") -> "手动触发 (Mock数据)"
            trigger == "realtime" -> "实时触发 (信号处理)"
            else -> "其他 (${trigger})"
        }
    }
}

/**
 * Stage Snapshot (阶段级)
 * 每一个步骤各自的子 ID
 */
@Entity(tableName = "trace_spans")
data class TraceSpan(
    @PrimaryKey
    val spanId: String = UUID.randomUUID().toString(),
    val traceId: String,
    val parentSpanId: String? = null,
    
    val stage: String, // reason, tool_call, final_answer
    val stepNo: Int = 0,
    
    val status: TraceStatus = TraceStatus.RUNNING,
    val isSuccess: Boolean = true, // 明确的成功/失败状态
    val message: String = "", // 自由格式的详细描述信息
    val startAt: Long = System.currentTimeMillis(),
    val endAt: Long? = null,
    val durationMs: Long = 0,
    
    // JSON Fields
    val inputRefJson: String = "[]", // List of refs
    val outputRefJson: String = "[]", // List of refs
    val decisionJson: String = "{}", // { rule_hit: [], reason: "" }
    val modelInfoJson: String = "{}", // { provider: "", tokens_in: 0... }
    val errorJson: String? = null
)

/**
 * Artifact (产物存储)
 * 阶段产出的大对象
 */
@Entity(tableName = "trace_artifacts")
data class TraceArtifact(
    @PrimaryKey
    val artifactId: String = UUID.randomUUID().toString(),
    val traceId: String,
    val stage: String,
    val type: String, // topics, tags, research_report
    val schemaVersion: String = "1.0",
    val payloadJson: String, // The actual data
    val createdAt: Long = System.currentTimeMillis()
)
