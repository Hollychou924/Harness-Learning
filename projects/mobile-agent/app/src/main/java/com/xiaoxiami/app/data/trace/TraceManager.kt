package com.xiaoxiami.app.data.trace
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlin.random.Random

/**
 * Trace Manager
 * 负责 Trace ID 生成、Span 管理和产物持久化
 */
class TraceManager(
    private val traceDao: TraceDao
) {
    
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO)

    // ==================== Trace ID Generation ====================

    fun generateTraceId(
        userId: String = "u1",
        deviceId: String = "d1",
        taskDate: String = SimpleDateFormat("yyyyMMdd", Locale.getDefault()).format(Date()),
        runSeq: Int = 1
    ): String {
        // Use seconds to ensure uniqueness
        val timestamp = SimpleDateFormat("HHmmss", Locale.getDefault()).format(Date())
        val rand4 = (1000..9999).random()
        return "trace_${userId}_${deviceId}_${taskDate}_${timestamp}_$rand4"
    }

    // ==================== Trace Lifecycle ====================

    suspend fun startTrace(
        traceId: String,
        traceType: String = "agent_run",
        trigger: String = "manual"
    ) {
        val run = TraceRun(
            traceId = traceId,
            traceType = traceType,
            taskDate = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()),
            trigger = trigger,
            startAt = System.currentTimeMillis(),
            finalStatus = TraceStatus.RUNNING
        )
        traceDao.insertRun(run)
    }

    suspend fun endTrace(
        traceId: String,
        status: TraceStatus,
        stats: Map<String, Any> = emptyMap()
    ) {
        val run = traceDao.getRun(traceId) ?: return
        
        // Calculate failure count from spans to ensure consistency
        val spans = traceDao.getSpansForTraceSync(traceId)
        val failCount = spans.count { !it.isSuccess }
        
        // Merge stats
        val finalStats = stats.toMutableMap()
        finalStats["fail_count"] = failCount
        
        val updatedRun = run.copy(
            endAt = System.currentTimeMillis(),
            finalStatus = status,
            statsJson = gson.toJson(finalStats)
        )
        traceDao.updateRun(updatedRun)
    }

    suspend fun forceStopTrace(traceId: String) {
        val run = traceDao.getRun(traceId) ?: return
        val updatedRun = run.copy(
            endAt = System.currentTimeMillis(),
            finalStatus = TraceStatus.MANUAL_STOPPED
        )
        traceDao.updateRun(updatedRun)
    }
    
    // ==================== Public DAO Access Methods ====================
    
    /**
     * 获取所有 Trace Runs（Flow）
     */
    fun getAllRuns() = traceDao.getAllRuns()
    
    /**
     * 获取单个 Trace Run
     */
    suspend fun getRun(traceId: String) = traceDao.getRun(traceId)
    
    /**
     * 更新 Trace Run
     */
    suspend fun updateRun(run: TraceRun) = traceDao.updateRun(run)

    // ==================== Span Management ====================

    suspend fun startSpan(
        traceId: String,
        parentSpanId: String? = null,
        stage: String,
        stepNo: Int = 0
    ): String {
        val spanId = "sp_${System.currentTimeMillis()}_${(1000..9999).random()}"
        val span = TraceSpan(
            spanId = spanId,
            traceId = traceId,
            parentSpanId = parentSpanId,
            stage = stage,
            stepNo = stepNo,
            startAt = System.currentTimeMillis(),
            status = TraceStatus.RUNNING
        )
        traceDao.insertSpan(span)
        return spanId
    }

    suspend fun endSpan(
        traceId: String,
        spanId: String,
        status: TraceStatus,
        details: SpanDetails = SpanDetails()
    ) {
        val span = traceDao.getSpansForTraceSync(traceId).find { it.spanId == spanId } ?: return
        
        val endAt = System.currentTimeMillis()
        val durationMs = endAt - span.startAt
        
        val updatedSpan = span.copy(
            endAt = endAt,
            durationMs = durationMs,
            status = status,
            isSuccess = status == TraceStatus.SUCCESS,
            message = details.message,
            inputRefJson = gson.toJson(details.inputRefs),
            outputRefJson = gson.toJson(details.outputRefs),
            decisionJson = gson.toJson(details.decision),
            modelInfoJson = gson.toJson(details.modelInfo),
            errorJson = details.error
        )
        traceDao.updateSpan(updatedSpan)
    }

    // ==================== Artifacts ====================

    suspend fun saveArtifact(
        traceId: String,
        stage: String,
        type: String,
        payload: Any
    ): String {
        val artifactId = "art_${System.currentTimeMillis()}_${(1000..9999).random()}"
        val artifact = TraceArtifact(
            artifactId = artifactId,
            traceId = traceId,
            stage = stage,
            type = type,
            payloadJson = gson.toJson(payload)
        )
        traceDao.insertArtifact(artifact)
        return artifactId
    }
    
    // ==================== Helpers ====================
    
    data class SpanDetails(
        val message: String = "", // 自由格式的详细描述信息
        val inputRefs: List<Map<String, String>> = emptyList(),
        val outputRefs: List<Map<String, Any>> = emptyList(),
        val decision: Map<String, Any> = emptyMap(),
        val modelInfo: Map<String, Any> = emptyMap(),
        val error: String? = null
    )
}
