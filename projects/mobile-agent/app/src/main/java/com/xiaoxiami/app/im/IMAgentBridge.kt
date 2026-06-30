package com.xiaoxiami.app.im

import android.content.Context
import android.util.Log
import com.xiaoxiami.app.MyApplication
import com.xiaoxiami.app.agent.*
import com.xiaoxiami.app.data.ChatMessage
import com.xiaoxiami.app.data.MemoryDatabase
import com.xiaoxiami.app.data.ChatSession
import com.xiaoxiami.app.data.trace.TraceManager
import com.xiaoxiami.app.repository.GeminiRepository
import com.xiaoxiami.app.repository.MemoryRepository
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.text.SimpleDateFormat
import java.util.*

/**
 * Bridge between IM gateways and AgentRuntime.
 *
 * Routes incoming IM messages to the Agent, collects the final answer,
 * and sends the reply back through the platform-specific ReplyFn.
 *
 * Design:
 * - Each IM sender maps to a unique agent session (platform:senderId)
 * - Tools are auto-approved (no UI) with a restricted policy for safety
 * - Conversation history is persisted to Room DB for continuity
 * - Messages are processed serially per sender via a per-sender coroutine
 */
class IMAgentBridge(private val context: Context) {

    companion object {
        private const val TAG = "IMAgentBridge"
        private const val IM_SESSION_PREFIX = "im_"
        private const val MAX_REPLY_LENGTH = 4000
    }

    private val app = context.applicationContext as MyApplication
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val database = MemoryDatabase.getDatabase(context)
    private val chatDao = database.chatMessageDao()
    private val sessionDao = database.chatSessionDao()
    private val traceManager = TraceManager(database.traceDao())

    // Per-sender serial execution to prevent race conditions
    private val senderJobs = mutableMapOf<String, Job>()
    private val senderMutex = mutableMapOf<String, Mutex>()

    /**
     * The message callback to be set on IMGatewayManager.
     * This is the main entry point for all IM messages.
     */
    val messageCallback: IMMessageCallback = { message, reply ->
        handleMessage(message, reply)
    }

    private suspend fun handleMessage(message: IMMessage, reply: ReplyFn) {
        val senderKey = "${message.platform.name}:${message.senderId}"
        val mutex = senderMutex.getOrPut(senderKey) {
            Mutex()
        }

        // Serialize requests from the same sender
        mutex.withLock {
            try {
                Log.i(TAG, "Processing IM message from $senderKey: ${message.content.take(50)}")
                val response = processWithAgent(message)
                if (response.isNotBlank()) {
                    // Split long responses if needed
                    if (response.length <= MAX_REPLY_LENGTH) {
                        reply(response, emptyList())
                    } else {
                        // Chunk into segments
                        response.chunked(MAX_REPLY_LENGTH).forEach { chunk ->
                            reply(chunk, emptyList())
                            delay(200) // Brief pause between chunks
                        }
                    }
                } else {
                    reply("抱歉，我暂时无法处理你的请求，请稍后再试。", emptyList())
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error processing IM message from $senderKey", e)
                reply("处理消息时出现错误: ${e.message}", emptyList())
            }
        }
    }

    private suspend fun processWithAgent(message: IMMessage): String {
        val sessionId = getOrCreateSession(message)
        val userGoal = message.content.ifBlank { "请分析消息" }

        // Save user message to DB
        val userMsg = ChatMessage(
            id = UUID.randomUUID().toString(),
            content = userGoal,
            isUser = true,
            timestamp = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date()),
            createdAt = System.currentTimeMillis(),
            sessionId = sessionId
        )
        chatDao.insertMessage(userMsg)

        // Build conversation history from DB
        val history = chatDao.getMessagesList(sessionId)
            .filter { it.content.isNotBlank() }
            .takeLast(10)
            .map { if (it.isUser) "user" to it.content else "model" to it.content }

        // Build AgentRuntime with auto-approve policy (no UI)
        val geminiRepository = GeminiRepository(context)
        val memoryRepository = MemoryRepository(
            context = context,
            embeddingService = app.embeddingService,
            vectorStore = app.vectorStoreService
        )
        val runtime = AgentRuntime(
            llmAdapter = GeminiLlmAdapter(geminiRepository),
            toolExecutor = ToolExecutor(
                AndroidToolRegistry.build(
                    context = context,
                    geminiRepository = geminiRepository,
                    memoryRepository = memoryRepository
                ),
                androidContext = context,
                policy = ToolPolicy.remoteOperator() // Restricted policy for non-interactive use
            ),
            traceManager = traceManager,
            approvalHandler = { request ->
                // Auto-approve low/medium risk tools; deny high risk
                if (request.riskLevel == ToolRiskLevel.HIGH) {
                    ToolApprovalDecision(
                        approved = false,
                        message = "IM渠道自动拒绝高风险操作: ${request.toolName}"
                    )
                } else {
                    ToolApprovalDecision(
                        approved = true,
                        message = "IM渠道自动批准: ${request.toolName}"
                    )
                }
            },
            interactionHandler = { request ->
                // IM cannot handle interactive tool requests
                ToolInteractionResult(
                    success = false,
                    error = "IM渠道不支持交互式操作: ${request.toolName}"
                )
            },
            skillRegistry = app.skillRegistry
        )

        // Collect agent events and extract final answer
        val finalAnswer = StringBuilder()

        runtime.run(
            sessionId = sessionId,
            userGoal = userGoal,
            conversationHistory = history,
            modelId = "gemini-3-flash"
        ).collect { event ->
            when (event) {
                is AgentEvent.FinalAnswerChunk -> finalAnswer.append(event.text)
                is AgentEvent.Completed -> {
                    if (finalAnswer.isEmpty() && event.finalAnswer.isNotBlank()) {
                        finalAnswer.append(event.finalAnswer)
                    }
                }
                is AgentEvent.Error -> {
                    Log.e(TAG, "Agent error: ${event.message}")
                    if (finalAnswer.isEmpty()) {
                        finalAnswer.append("处理失败: ${event.message}")
                    }
                }
                else -> { /* ignore intermediate events for IM */ }
            }
        }

        val result = finalAnswer.toString()

        // Save AI response to DB
        if (result.isNotBlank()) {
            val aiMsg = ChatMessage(
                id = UUID.randomUUID().toString(),
                content = result,
                isUser = false,
                timestamp = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date()),
                createdAt = System.currentTimeMillis(),
                sessionId = sessionId
            )
            chatDao.insertMessage(aiMsg)
        }

        return result
    }

    /**
     * Get or create a session ID for an IM conversation.
     * Session key = im_{platform}_{senderId}
     */
    private suspend fun getOrCreateSession(message: IMMessage): String {
        val sessionId = "${IM_SESSION_PREFIX}${message.platform.name.lowercase()}_${message.senderId}"
        val existing = sessionDao.getSessionById(sessionId)
        if (existing == null) {
            val title = "${message.platform.displayName} · ${message.senderName.take(12)}"
            sessionDao.insertSession(
                ChatSession(
                    id = sessionId,
                    title = title,
                    createdAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis()
                )
            )
        } else {
            sessionDao.updateSessionInfo(
                sessionId = sessionId,
                updatedAt = System.currentTimeMillis(),
                messageCount = (chatDao.getMessagesList(sessionId).size)
            )
        }
        return sessionId
    }

    /** Clean up resources. */
    fun destroy() {
        scope.cancel()
        senderJobs.values.forEach { it.cancel() }
    }
}
