package com.xiaoxiami.app.viewmodel

import android.Manifest
import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.xiaoxiami.app.agent.AndroidToolRegistry
import com.xiaoxiami.app.agent.AgentEvent
import com.xiaoxiami.app.agent.AgentRuntime
import com.xiaoxiami.app.agent.GeminiLlmAdapter
import com.xiaoxiami.app.agent.LoopDetector
import com.xiaoxiami.app.agent.ModelCandidate
import com.xiaoxiami.app.agent.ModelFailoverChain
import com.xiaoxiami.app.agent.ToolApprovalDecision
import com.xiaoxiami.app.agent.ToolApprovalRequest
import com.xiaoxiami.app.agent.ToolExecutor
import com.xiaoxiami.app.agent.ToolInteractionKind
import com.xiaoxiami.app.agent.ToolInteractionRequest
import com.xiaoxiami.app.agent.ToolInteractionResult
import com.xiaoxiami.app.agent.ToolPolicy
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.MyApplication
import com.xiaoxiami.app.data.ChatMessage
import com.xiaoxiami.app.data.MemoryDatabase
import com.xiaoxiami.app.data.trace.TraceManager
import com.xiaoxiami.app.repository.GeminiRepository
import com.xiaoxiami.app.repository.MemoryRepository
import com.xiaoxiami.app.service.VolcTtsManager
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import com.xiaoxiami.app.data.ChatSession

/**
 * 🆕 模型信息数据类
 */
data class ModelInfo(
    val id: String,
    val displayName: String,
    val description: String
)

/**
 * 🆕 可用模型列表
 */
val AVAILABLE_MODELS = listOf(
    ModelInfo("gemini-3-flash", "Gemini 3 Flash", "快速响应 · 联网搜索"),
    ModelInfo("gemini-3-pro", "Gemini 3 Pro", "更强推理 · 联网搜索"),
    ModelInfo("doubao-1.8", "Doubao 1.8", "中文增强 · 联网搜索"),
    ModelInfo("doubao-2.0", "Doubao 2.0", "豆包最新 · 联网搜索"),  // 🆕 使用 Responses API，支持联网搜索
)

/**
 * 🆕 请求日志数据类（用于调试）
 */
data class RequestLog(
    val requestId: String,              // 请求ID（对应AI消息ID）
    val sessionId: String,              // 会话ID
    val timestamp: Long,                // 请求时间戳
    val userInput: String,              // 用户输入
    val hasImages: Boolean,             // 是否包含图片
    val imageCount: Int,                // 图片数量
    val modelId: String,                // 使用的模型ID
    val modelName: String,              // 模型显示名称
    val systemPrompt: String,           // 完整System Prompt
    val memoryContext: String,          // 注入的记忆上下文
    val currentTime: String,            // 注入的时间
    val currentLocation: String,        // 注入的位置
    val conversationHistory: String,    // 对话历史摘要
    val memoryUpdated: Boolean,         // 是否触发记忆更新
    val enableSearch: Boolean = true,   // 是否开启联网搜索
    val enableThinking: Boolean = false, // 是否开启深度思考
    
    // 🆕 记忆注入详情
    var memoryKeywords: List<String> = emptyList(),
    var vectorSuccess: Boolean = false,
    var vectorResults: List<String> = emptyList(),
    var vectorError: String = "",
    var isFullInjection: Boolean = false,
    var matchedCount: Int = 0,

    var modelResponse: String = "",     // 模型回复（流式累积）
    var isSuccess: Boolean = true,      // 请求是否成功
    var errorMessage: String = "",      // 错误信息
    var responseTime: Long = 0,         // 响应耗时(ms)
    var firstChunkTime: Long = 0,       // 首个chunk耗时(ms)
    
    // 🆕 链路精细耗时统计 (毫秒时间戳)
    var timeUserSent: Long = 0,           // 用户点击发送
    var timeContextBuildStart: Long = 0,   // 开始构建上下文 (RAG/历史等)
    var timeContextBuildEnd: Long = 0,     // 上下文构建完成
    var timeApiCallStart: Long = 0,        // 调起 API
    var timeApiFirstChunk: Long = 0        // 收到首个 Chunk
)

enum class AgentStepKind {
    GOAL,
    REASON,
    TOOL,
    RETRY,
    APPROVAL,
    OBSERVATION,
    REVIEW,
    FINAL,
    ERROR
}

enum class AgentStepStatus {
    INFO,
    WAITING,
    SUCCESS,
    WARNING,
    FAILED,
    ERROR
}

data class AgentExecutionStep(
    val kind: AgentStepKind,
    val title: String,
    val detail: String,
    val status: AgentStepStatus,
    val timestamp: Long = System.currentTimeMillis()
)

data class PendingToolApprovalUi(
    val requestId: String,
    val messageId: String,
    val toolName: String,
    val riskLevel: ToolRiskLevel,
    val reason: String,
    val summary: String,
    val arguments: String
)

data class PendingToolInteractionUi(
    val requestId: String,
    val messageId: String,
    val toolName: String,
    val kind: ToolInteractionKind,
    val title: String,
    val description: String,
    val payloadSummary: String,
    val payload: Map<String, Any?> = emptyMap()
)

/**
 * 对话ViewModel
 * 管理对话消息和AI回复，支持持久化存储到本地数据库
 * 
 * 🆕 集成向量检索服务，实现语义 RAG
 */
class ChatViewModel(application: Application) : AndroidViewModel(application) {

    companion object {
        private const val TAG = "ChatViewModel"
        private const val DEFAULT_SESSION_ID = "default"
        
        /**
         * 🆕 将Markdown格式文本转换为纯语音文本（用于TTS播报）
         * 移除所有Markdown符号，保留纯文字内容
         */
        fun convertToSpeechText(markdownText: String): String {
            var result = markdownText
            
            // 移除代码块（```...```）
            result = result.replace(Regex("```[\\s\\S]*?```"), " 代码块 ")
            
            // 移除行内代码（`...`）
            result = result.replace(Regex("`([^`]+)`")) { it.groupValues[1] }
            
            // 移除标题符号（# ## ### 等）
            result = result.replace(Regex("^#{1,6}\\s*", RegexOption.MULTILINE), "")
            
            // 移除粗体（**text** 或 __text__）
            result = result.replace(Regex("\\*\\*([^*]+)\\*\\*")) { it.groupValues[1] }
            result = result.replace(Regex("__([^_]+)__")) { it.groupValues[1] }
            
            // 移除斜体（*text* 或 _text_，但不匹配粗体）
            result = result.replace(Regex("(?<!\\*)\\*([^*]+)\\*(?!\\*)")) { it.groupValues[1] }
            result = result.replace(Regex("(?<!_)_([^_]+)_(?!_)")) { it.groupValues[1] }
            
            // 移除删除线（~~text~~）
            result = result.replace(Regex("~~([^~]+)~~")) { it.groupValues[1] }
            
            // 移除链接，保留文本（[text](url)）
            result = result.replace(Regex("\\[([^\\]]+)]\\([^)]+\\)")) { it.groupValues[1] }
            
            // 移除图片（![alt](url)）
            result = result.replace(Regex("!\\[([^\\]]*)]\\([^)]+\\)"), " 图片 ")
            
            // 移除无序列表符号（- * +）
            result = result.replace(Regex("^[\\s]*[-*+]\\s+", RegexOption.MULTILINE), "")
            
            // 移除有序列表符号（1. 2. 等）
            result = result.replace(Regex("^[\\s]*\\d+\\.\\s+", RegexOption.MULTILINE), "")
            
            // 移除引用符号（>）
            result = result.replace(Regex("^>\\s*", RegexOption.MULTILINE), "")
            
            // 移除分隔线（--- *** ___）
            result = result.replace(Regex("^[-*_]{3,}$", RegexOption.MULTILINE), "")
            
            // 移除表格分隔符（|---|---|）
            result = result.replace(Regex("\\|[-:]+\\|"), "")
            result = result.replace(Regex("\\|"), " ")
            
            // 清理多余的空白字符
            result = result.replace(Regex("\\s+"), " ")
            result = result.trim()
            
            return result
        }
    }

    private val geminiRepository = GeminiRepository(application.applicationContext)
    
    // 🆕 SharedPreferences 用于持久化保存用户设置
    private val prefs = application.getSharedPreferences("chat_settings", android.content.Context.MODE_PRIVATE)
    
    // 🆕 使用 Application 的向量服务
    private val app = application as MyApplication
    private val memoryRepository = MemoryRepository(
        context = application.applicationContext,
        embeddingService = app.embeddingService,
        vectorStore = app.vectorStoreService
    )
    private val database = MemoryDatabase.getDatabase(application)
    private val chatDao = database.chatMessageDao()
    private val sessionDao = database.chatSessionDao()
    private val ttsManager = VolcTtsManager()
    private val userProfileRepository = com.xiaoxiami.app.repository.UserProfileRepository(
        context = application.applicationContext,
        geminiRepository = geminiRepository
    )
    private val traceManager by lazy {
        TraceManager(database.traceDao())
    }
    private var cachedUserProfilePrompt: String? = null
    private var currentApprovalMessageId: String? = null
    private var currentInteractionMessageId: String? = null
    private var pendingApprovalDeferred: CompletableDeferred<ToolApprovalDecision>? = null
    private var pendingInteractionDeferred: CompletableDeferred<ToolInteractionResult>? = null
    private fun buildAgentRuntime(): AgentRuntime {
        return AgentRuntime(
            llmAdapter = GeminiLlmAdapter(
                geminiRepository,
                cachedUserProfilePrompt,
                ModelFailoverChain(
                    candidates = listOf(
                        ModelCandidate(com.xiaoxiami.app.config.AIConfig.MODEL_FLASH, 0),
                        ModelCandidate(com.xiaoxiami.app.config.AIConfig.MODEL_SMART, 1),
                        ModelCandidate(com.xiaoxiami.app.config.AIConfig.DOUBAO_2_MODEL_ID, 2)
                    )
                )
            ),
            toolExecutor = ToolExecutor(
                AndroidToolRegistry.build(
                    context = app.applicationContext,
                    geminiRepository = geminiRepository,
                    memoryRepository = memoryRepository
                ),
                androidContext = app.applicationContext,
                policy = ToolPolicy.userInteractive(
                    allowedOptionalTags = app.optionalToolPolicyStore.state.value.enabledTags
                )
            ),
            traceManager = traceManager,
            approvalHandler = { request ->
                awaitToolApproval(request)
            },
            interactionHandler = { request ->
                awaitToolInteraction(request)
            },
            skillRegistry = app.skillRegistry,
            clarificationHandler = { question, options ->
                awaitClarification(question, options)
            }
        )
    }
    
    // 记忆上下文缓存（同一会话内复用）
    private var cachedMemoryContext: String? = null
    private var lastMemoryQueryTime: Long = 0
    private val MEMORY_CACHE_DURATION = 60 * 1000L  // 1分钟缓存
    private var cachedRetrievalInfo: MemoryRepository.MemoryRetrievalInfo? = null

    // 当前会话ID
    private val _currentSessionId = MutableStateFlow(DEFAULT_SESSION_ID)
    val currentSessionId: StateFlow<String> = _currentSessionId.asStateFlow()

    // 所有会话列表
    val sessions: StateFlow<List<ChatSession>> = sessionDao.getAllSessions()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    // 消息列表 - 根据当前会话ID获取
    val messages: StateFlow<List<ChatMessage>> = _currentSessionId
        .flatMapLatest { sessionId ->
            chatDao.getMessages(sessionId)
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    // 加载状态
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    // 🆕 当前生成任务的 Job（用于停止生成）
    private var currentGenerationJob: kotlinx.coroutines.Job? = null
    private var currentAiMessageId: String? = null  // 当前正在生成的AI消息ID
    
    // 🆕 被用户手动停止的消息ID集合（用于显示"已停止思考"状态）
    private val _stoppedMessageIds = MutableStateFlow<Set<String>>(emptySet())
    val stoppedMessageIds: StateFlow<Set<String>> = _stoppedMessageIds.asStateFlow()

    private val _agentExecutionSteps =
        MutableStateFlow<Map<String, List<AgentExecutionStep>>>(emptyMap())
    val agentExecutionSteps: StateFlow<Map<String, List<AgentExecutionStep>>> =
        _agentExecutionSteps.asStateFlow()

    private val _pendingToolApproval = MutableStateFlow<PendingToolApprovalUi?>(null)
    val pendingToolApproval: StateFlow<PendingToolApprovalUi?> = _pendingToolApproval.asStateFlow()

    private val _pendingToolInteraction = MutableStateFlow<PendingToolInteractionUi?>(null)
    val pendingToolInteraction: StateFlow<PendingToolInteractionUi?> = _pendingToolInteraction.asStateFlow()

    // 澄清中断
    data class PendingClarificationUi(
        val messageId: String,
        val question: String,
        val options: List<String>
    )
    private val _pendingClarification = MutableStateFlow<PendingClarificationUi?>(null)
    val pendingClarification: StateFlow<PendingClarificationUi?> = _pendingClarification.asStateFlow()
    private var pendingClarificationDeferred: CompletableDeferred<String>? = null

    // 错误信息
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // TTS 开关状态
    private val _isTtsEnabled = MutableStateFlow(false)
    val isTtsEnabled: StateFlow<Boolean> = _isTtsEnabled.asStateFlow()
    
    // 🆕 模型选择状态（从SharedPreferences读取保存的值，openclaw 已移除则回退默认）
    private val _selectedModelId = MutableStateFlow(
        (prefs.getString("selected_model_id", "gemini-3-flash") ?: "gemini-3-flash").let { saved ->
            if (saved == "openclaw" || AVAILABLE_MODELS.none { it.id == saved }) {
                prefs.edit().putString("selected_model_id", "gemini-3-flash").apply()
                "gemini-3-flash"
            } else saved
        }
    )
    val selectedModelId: StateFlow<String> = _selectedModelId.asStateFlow()
    
    /**
     * 🆕 切换模型并持久化保存
     */
    fun selectModel(modelId: String) {
        _selectedModelId.value = modelId
        // 持久化保存到SharedPreferences
        prefs.edit().putString("selected_model_id", modelId).apply()
        Log.d(TAG, "🔄 模型已切换并保存: $modelId")
    }
    
    fun getSelectedModelInfo(): ModelInfo {
        return AVAILABLE_MODELS.find { it.id == _selectedModelId.value } ?: AVAILABLE_MODELS[0]
    }
    
    // 🆕 请求日志存储（用于调试，key为AI消息ID）
    private val requestLogs = mutableMapOf<String, RequestLog>()
    
    // 🆕 引用元数据存储（key为AI消息ID）
    private val _groundingMetadataMap = mutableMapOf<String, com.xiaoxiami.app.service.GroundingMetadata>()
    
    /**
     * 🆕 获取指定消息的请求日志
     */
    fun getRequestLog(messageId: String): RequestLog? {
        return requestLogs[messageId]
    }
    
    /**
     * 🆕 获取所有请求日志（调试用）
     */
    fun getAllRequestLogs(): List<RequestLog> {
        return requestLogs.values.sortedByDescending { it.timestamp }
    }
    
    /**
     * 🆕 获取指定消息的引用元数据
     */
    fun getGroundingMetadata(messageId: String): com.xiaoxiami.app.service.GroundingMetadata? {
        return _groundingMetadataMap[messageId]
    }

    init {
        // 预加载用户画像
        viewModelScope.launch {
            cachedUserProfilePrompt = userProfileRepository.buildProfilePrompt()
        }
        // 确保默认会话存在
        viewModelScope.launch {
            val defaultSession = sessionDao.getSessionById(DEFAULT_SESSION_ID)
            if (defaultSession == null) {
                sessionDao.insertSession(
                    ChatSession(
                        id = DEFAULT_SESSION_ID,
                        title = "新的聊天",
                        createdAt = System.currentTimeMillis(),
                        updatedAt = System.currentTimeMillis()
                    )
                )
            }
        }
        // 从数据库恢复执行过程（杀进程后重新进入时）
        viewModelScope.launch {
            messages.collect { msgs ->
                val current = _agentExecutionSteps.value
                var updated = false
                val merged = current.toMutableMap()
                for (msg in msgs) {
                    if (msg.isUser || msg.executionStepsJson.isNullOrBlank()) continue
                    if (current.containsKey(msg.id)) continue
                    val steps = runCatching {
                        com.google.gson.Gson().fromJson(
                            msg.executionStepsJson,
                            Array<AgentExecutionStep>::class.java
                        ).toList()
                    }.getOrNull()
                    if (!steps.isNullOrEmpty()) {
                        merged[msg.id] = steps
                        updated = true
                    }
                }
                if (updated) {
                    _agentExecutionSteps.value = merged
                }
            }
        }
    }

    fun toggleTts() {
        _isTtsEnabled.value = !_isTtsEnabled.value
        if (!_isTtsEnabled.value) {
            ttsManager.stop()
        }
    }

    /**
     * 创建新会话
     */
    fun createNewSession() {
        viewModelScope.launch {
            val newSessionId = UUID.randomUUID().toString()
            val newSession = ChatSession(
                id = newSessionId,
                title = "新的聊天",
                createdAt = System.currentTimeMillis(),
                updatedAt = System.currentTimeMillis()
            )
            sessionDao.insertSession(newSession)
            _currentSessionId.value = newSessionId
        }
    }

    /**
     * 切换会话
     */
    fun switchSession(sessionId: String) {
        clearMemoryCache()
        
        _currentSessionId.value = sessionId
    }

    /**
     * 生成会话标题
     */
    private fun generateSessionTitle(firstUserMessage: String) {
        viewModelScope.launch {
            try {
                val sessionId = _currentSessionId.value
                // 调用Gemini生成标题（不超过12个字）
                val prompt = "请为以下对话内容生成一个简短的标题（不超过12个字）：\n\n$firstUserMessage"
                val title = geminiRepository.generateContent(
                    prompt = prompt,
                    modelName = _selectedModelId.value // 🆕 使用用户选择的模型
                ).take(12) // 确保不超过12个字
                
                // 更新会话标题
                sessionDao.updateSessionTitle(sessionId, title)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to generate session title: ${e.message}", e)
            }
        }
    }

    /**
     * 播报文本（自动转换为语音友好格式）
     */
    fun speakText(text: String) {
        // 🆕 转换为语音友好格式，移除Markdown符号
        val speechText = convertToSpeechText(text)
        ttsManager.playText(speechText)
    }

    /**
     * 停止播报
     */
    fun stopSpeak() {
        ttsManager.stop()
    }
    
    /**
     * 🆕 停止AI生成
     * 取消当前生成任务，根据状态显示不同的停止标记
     * - 如果还在思考中（内容为空）：显示"已停止思考"状态
     * - 如果已开始输出（内容不为空）：在末尾添加"（已手动停止）"
     */
    fun stopGeneration() {
        viewModelScope.launch {
            try {
                // 取消生成任务
                currentGenerationJob?.cancel()
                currentGenerationJob = null
                
                // 获取当前消息并处理停止状态
                currentAiMessageId?.let { messageId ->
                    val currentMessage = chatDao.getMessageById(messageId)
                    if (currentMessage != null) {
                        if (currentMessage.content.isBlank()) {
                            // 🆕 还在思考中（内容为空），将消息ID加入已停止集合
                            _stoppedMessageIds.value = _stoppedMessageIds.value + messageId
                            Log.d(TAG, "🛑 AI思考已手动停止: $messageId")
                        } else {
                            // 已开始输出，在末尾添加停止标记
                            val updatedContent = currentMessage.content + "（已手动停止）"
                            val updatedMessage = currentMessage.copy(content = updatedContent)
                            chatDao.insertMessage(updatedMessage)
                            Log.d(TAG, "🛑 AI生成已手动停止: $messageId")
                        }
                    }
                }
                
                // 重置状态
                _isLoading.value = false
                currentAiMessageId = null
                
            } catch (e: Exception) {
                Log.e(TAG, "停止生成失败: ${e.message}", e)
            }
        }
    }

    fun getAgentExecutionSteps(messageId: String): List<AgentExecutionStep> {
        val memorySteps = _agentExecutionSteps.value[messageId]
        if (!memorySteps.isNullOrEmpty()) {
            return memorySteps
        }
        val msg = messages.value.find { it.id == messageId }
        msg?.executionStepsJson?.let {
            return runCatching {
                com.google.gson.Gson().fromJson(it, Array<AgentExecutionStep>::class.java).toList()
            }.getOrDefault(emptyList())
        }
        return emptyList()
    }

    fun resolveToolApproval(approved: Boolean) {
        val pending = _pendingToolApproval.value ?: return
        pendingApprovalDeferred?.complete(
            ToolApprovalDecision(
                approved = approved,
                message = if (approved) {
                    "用户已批准执行 ${pending.toolName}"
                } else {
                    "用户拒绝执行 ${pending.toolName}"
                }
            )
        )
        _pendingToolApproval.value = null
    }

    fun resolveClarification(answer: String) {
        pendingClarificationDeferred?.complete(answer)
        pendingClarificationDeferred = null
        _pendingClarification.value = null
    }

    fun resolveToolInteraction(
        success: Boolean,
        data: Map<String, Any?> = emptyMap(),
        error: String? = null
    ) {
        val pending = _pendingToolInteraction.value ?: return
        val messageId = pending.messageId
        appendAgentExecutionStep(
            messageId,
            AgentExecutionStep(
                kind = AgentStepKind.TOOL,
                title = if (success) {
                    "用户已完成 ${pending.toolName}"
                } else {
                    "用户取消 ${pending.toolName}"
                },
                detail = error ?: if (success) pending.description else "用户取消了该交互",
                status = if (success) AgentStepStatus.SUCCESS else AgentStepStatus.ERROR
            )
        )
        pendingInteractionDeferred?.complete(
            ToolInteractionResult(
                success = success,
                data = data,
                error = error
            )
        )
        _pendingToolInteraction.value = null
    }

    private suspend fun awaitToolApproval(request: ToolApprovalRequest): ToolApprovalDecision {
        val messageId = currentApprovalMessageId
            ?: return ToolApprovalDecision(
                approved = false,
                message = "审批上下文丢失，已取消执行 ${request.toolName}"
            )

        pendingApprovalDeferred?.complete(
            ToolApprovalDecision(
                approved = false,
                message = "新的审批请求覆盖了上一个待处理请求"
            )
        )

        val deferred = CompletableDeferred<ToolApprovalDecision>()
        pendingApprovalDeferred = deferred
        _pendingToolApproval.value = PendingToolApprovalUi(
            requestId = request.requestId,
            messageId = messageId,
            toolName = request.toolName,
            riskLevel = request.riskLevel,
            reason = request.reason,
            summary = request.summary,
            arguments = request.arguments.entries.joinToString("\n") { (key, value) ->
                "$key: ${value ?: ""}"
            }.ifBlank { "无参数" }
        )

        return try {
            deferred.await()
        } finally {
            if (pendingApprovalDeferred === deferred) {
                pendingApprovalDeferred = null
            }
            if (_pendingToolApproval.value?.requestId == request.requestId) {
                _pendingToolApproval.value = null
            }
        }
    }

    private suspend fun awaitClarification(question: String, options: List<String>): String {
        val messageId = currentApprovalMessageId ?: return "用户未回复"

        pendingClarificationDeferred?.complete("用户未回复（被新请求覆盖）")

        val deferred = CompletableDeferred<String>()
        pendingClarificationDeferred = deferred
        _pendingClarification.value = PendingClarificationUi(
            messageId = messageId,
            question = question,
            options = options
        )
        return try {
            deferred.await()
        } finally {
            if (pendingClarificationDeferred === deferred) {
                pendingClarificationDeferred = null
            }
            _pendingClarification.value = null
        }
    }

    private suspend fun awaitToolInteraction(request: ToolInteractionRequest): ToolInteractionResult {
        val messageId = currentInteractionMessageId
            ?: return ToolInteractionResult(
                success = false,
                error = "交互上下文丢失，已取消执行 ${request.toolName}"
            )

        pendingInteractionDeferred?.complete(
            ToolInteractionResult(
                success = false,
                error = "新的用户交互请求覆盖了上一个待处理请求"
            )
        )

        appendAgentExecutionStep(
            messageId,
            AgentExecutionStep(
                kind = AgentStepKind.TOOL,
                title = "等待用户操作：${request.toolName}",
                detail = request.description,
                status = AgentStepStatus.WAITING
            )
        )

        val deferred = CompletableDeferred<ToolInteractionResult>()
        pendingInteractionDeferred = deferred
        _pendingToolInteraction.value = PendingToolInteractionUi(
            requestId = request.requestId,
            messageId = messageId,
            toolName = request.toolName,
            kind = request.kind,
            title = request.title,
            description = request.description,
            payloadSummary = request.payload.entries.joinToString("\n") { (key, value) ->
                "$key: ${value ?: ""}"
            }.ifBlank { "无额外参数" },
            payload = request.payload
        )

        return try {
            deferred.await()
        } finally {
            if (pendingInteractionDeferred === deferred) {
                pendingInteractionDeferred = null
            }
            if (_pendingToolInteraction.value?.requestId == request.requestId) {
                _pendingToolInteraction.value = null
            }
        }
    }

    private fun initializeAgentExecution(messageId: String) {
        _agentExecutionSteps.value = _agentExecutionSteps.value + (messageId to emptyList())
    }

    private fun appendAgentExecutionStep(
        messageId: String,
        step: AgentExecutionStep
    ) {
        val currentSteps = _agentExecutionSteps.value[messageId].orEmpty()
        _agentExecutionSteps.value = _agentExecutionSteps.value + (
            messageId to (currentSteps + step).takeLast(24)
        )
    }
    
    /**
     * 🆕 检查消息是否被用户手动停止（用于UI显示"已停止思考"状态）
     */
    fun isMessageStopped(messageId: String): Boolean {
        return _stoppedMessageIds.value.contains(messageId)
    }

    /**
     * 发送消息（支持多张图片）
     * @param content 消息内容
     * @param imageUris 图片URI列表（支持多张图片）
     */
    fun sendMessage(content: String, imageUris: List<Uri> = emptyList()) {
        if (content.isBlank() && imageUris.isEmpty()) return

        viewModelScope.launch {
            try {
                val currentSession = _currentSessionId.value
                
                // 检查是否是会话的第一条消息
                val messageCount = chatDao.getMessagesList(currentSession).size
                val isFirstMessage = messageCount == 0
                
                // 1. 保存用户消息到数据库（多张图片用逗号分隔存储）
                val imageUriString = if (imageUris.isNotEmpty()) {
                    imageUris.joinToString(",") { it.toString() }
                } else null
                
                val userMessage = ChatMessage(
                    id = UUID.randomUUID().toString(),
                    content = content,
                    isUser = true,
                    timestamp = getCurrentTime(),
                    createdAt = System.currentTimeMillis(),
                    imageUri = imageUriString,
                    sessionId = currentSession
                )
                chatDao.insertMessage(userMessage)

                // 2. 更新会话信息
                sessionDao.updateSessionInfo(
                    sessionId = currentSession,
                    updatedAt = System.currentTimeMillis(),
                    messageCount = messageCount + 1
                )
                
                // 🧠 2.5 检查是否触发即时记忆生成
                val triggerMemory = memoryRepository.shouldTriggerMemory(content)
                // 记忆提取移至getAIResponse中处理，以便更新AI消息的状态

                
                // 3. 如果是第一条消息，处理会话标题
                if (isFirstMessage) {
                    // 3.1 立即用第一条消息作为临时标题（最多12个字）
                    val tempTitle = if (content.length > 12) {
                        content.take(12) + "..."
                    } else {
                        content
                    }
                    sessionDao.updateSessionTitle(currentSession, tempTitle)
                    
                    // 3.2 异步生成更好的标题
                    generateSessionTitle(content)
                }

                val userSendTime = System.currentTimeMillis()
                // 4. 调用 Agent Runtime 获取回复
                getAgentResponse(userMessage, imageUris, triggerMemory, userSendTime)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send message: ${e.message}", e)
                _errorMessage.value = "消息发送失败: ${e.message}"
            }
        }
    }

    /**
     * 使用 Agent Runtime 处理文本和图片消息
     */
    private fun getAgentResponse(
        userMessageObj: ChatMessage,
        imageUris: List<Uri> = emptyList(),
        memoryTriggered: Boolean = false,
        timeUserSent: Long = 0
    ) {
        val rawUserMessage = userMessageObj.content
        val effectiveUserGoal = rawUserMessage.ifBlank {
            if (imageUris.size > 1) "请分析这${imageUris.size}张图片" else "请分析这张图片"
        }

        currentGenerationJob = viewModelScope.launch {
            val aiMessageId = UUID.randomUUID().toString()
            currentAiMessageId = aiMessageId
            currentApprovalMessageId = aiMessageId
            currentInteractionMessageId = aiMessageId
            val createdTime = System.currentTimeMillis()
            val requestStartTime = System.currentTimeMillis()
            var firstChunkReceivedTime = 0L
            var hasStartedFinalAnswer = false
            val liveMemoryStatus = AtomicInteger(if (memoryTriggered) 1 else 0)

            try {
                _isLoading.value = true
                _errorMessage.value = null
                initializeAgentExecution(aiMessageId)

                val thinkingMessage = ChatMessage(
                    id = aiMessageId,
                    content = "",
                    isUser = false,
                    timestamp = getCurrentTime(),
                    createdAt = createdTime,
                    sessionId = _currentSessionId.value,
                    memoryUpdated = memoryTriggered,
                    memoryStatus = liveMemoryStatus.get(),
                    executionStepsJson = com.google.gson.Gson().toJson(_agentExecutionSteps.value[aiMessageId].orEmpty())
                )
                chatDao.insertMessage(thinkingMessage)

                if (memoryTriggered) {
                    viewModelScope.launch {
                        try {
                            memoryRepository.extractImportantMemory(userMessageObj, _currentSessionId.value)
                            liveMemoryStatus.set(2)
                            chatDao.updateMemoryStatus(aiMessageId, 2)
                            Log.d(TAG, "✨ 即时记忆已生成并更新状态: $aiMessageId")
                        } catch (e: Exception) {
                            Log.e(TAG, "Memory extraction failed", e)
                            liveMemoryStatus.set(0)
                            chatDao.updateMemoryStatus(aiMessageId, 0)
                        }
                    }
                }

                val conversationHistory = buildConversationHistory()
                val currentDateTime =
                    SimpleDateFormat("yyyy年MM月dd日 HH:mm EEEE", Locale.CHINESE).format(Date())
                val currentLocation = getCurrentLocation()

                requestLogs[aiMessageId] = RequestLog(
                    requestId = aiMessageId,
                    sessionId = _currentSessionId.value,
                    timestamp = createdTime,
                    userInput = effectiveUserGoal,
                    hasImages = imageUris.isNotEmpty(),
                    imageCount = imageUris.size,
                    modelId = _selectedModelId.value,
                    modelName = getSelectedModelInfo().displayName,
                    systemPrompt = "Agent Runtime",
                    memoryContext = "",
                    currentTime = currentDateTime,
                    currentLocation = currentLocation,
                    conversationHistory = conversationHistory.takeLast(6).joinToString("\n") {
                        "[${it.first}] ${it.second.take(100)}${if (it.second.length > 100) "..." else ""}"
                    },
                    memoryUpdated = memoryTriggered,
                    enableSearch = false,
                    enableThinking = false,
                    timeUserSent = timeUserSent,
                    timeContextBuildStart = requestStartTime,
                    timeContextBuildEnd = requestStartTime
                )



                val contentBuilder = StringBuilder()
                var terminalError: String? = null

                buildAgentRuntime().run(
                    sessionId = _currentSessionId.value,
                    userGoal = effectiveUserGoal,
                    conversationHistory = conversationHistory,
                    imageUris = imageUris,
                    modelId = _selectedModelId.value
                ).collect { event ->
                    when (event) {
                        is AgentEvent.RunStarted -> {
                            Log.d(TAG, "🚀 Agent runtime started: ${event.traceId}")
                        }

                        is AgentEvent.GoalStructured -> {
                            Log.d(
                                TAG,
                                "🎯 Agent goal structured: task=${event.goal.task}, success=${event.goal.successCriteria}"
                            )
                            appendAgentExecutionStep(
                                aiMessageId,
                                AgentExecutionStep(
                                    kind = AgentStepKind.GOAL,
                                    title = "意图理解",
                                    detail = "明白了！你需要我：${event.goal.task}",
                                    status = AgentStepStatus.SUCCESS
                                )
                            )
                        }

                        is AgentEvent.Thinking -> {
                            Log.d(TAG, "🤔 Agent thinking [${event.iteration}]: ${event.message}")
                            appendAgentExecutionStep(
                                aiMessageId,
                                AgentExecutionStep(
                                    kind = AgentStepKind.REASON,
                                    title = "第 ${event.iteration} 步：思考中...",
                                    detail = event.message,
                                    status = AgentStepStatus.INFO
                                )
                            )
                        }

                        is AgentEvent.ToolCallPlanned -> {
                            Log.d(
                                TAG,
                                "🛠️ Agent tool planned [${event.iteration}]: ${event.toolName}, args=${event.arguments}"
                            )
                            appendAgentExecutionStep(
                                aiMessageId,
                                AgentExecutionStep(
                                    kind = AgentStepKind.TOOL,
                                    title = "准备使用工具：${event.toolName}",
                                    detail = event.reason,
                                    status = AgentStepStatus.INFO
                                )
                            )
                        }

                        is AgentEvent.ToolRetryScheduled -> {
                            appendAgentExecutionStep(
                                aiMessageId,
                                AgentExecutionStep(
                                    kind = AgentStepKind.RETRY,
                                    title = "${event.toolName} 准备重试",
                                    detail = "第 ${event.nextAttempt} 次尝试：${event.reason}",
                                    status = AgentStepStatus.INFO
                                )
                            )
                        }

                        is AgentEvent.ToolApprovalRequested -> {
                            appendAgentExecutionStep(
                                aiMessageId,
                                AgentExecutionStep(
                                    kind = AgentStepKind.APPROVAL,
                                    title = "等待你确认是否使用：${event.request.toolName}",
                                    detail = event.request.summary,
                                    status = AgentStepStatus.WAITING
                                )
                            )
                        }

                        is AgentEvent.ToolApprovalResolved -> {
                            appendAgentExecutionStep(
                                aiMessageId,
                                AgentExecutionStep(
                                    kind = AgentStepKind.APPROVAL,
                                    title = if (event.approved) {
                                        "已批准 ${event.toolName}"
                                    } else {
                                        "已拒绝 ${event.toolName}"
                                    },
                                    detail = event.message,
                                    status = if (event.approved) AgentStepStatus.SUCCESS else AgentStepStatus.ERROR
                                )
                            )
                        }

                        is AgentEvent.ToolCompleted -> {
                            Log.d(
                                TAG,
                                "✅ Agent tool completed [${event.iteration}]: ${event.toolName}"
                            )
                            appendAgentExecutionStep(
                                aiMessageId,
                                AgentExecutionStep(
                                    kind = AgentStepKind.TOOL,
                                    title = "工具 ${event.toolName} 运行完毕",
                                    detail = event.result.take(180),
                                    status = AgentStepStatus.SUCCESS
                                )
                            )
                        }

                        is AgentEvent.ObservationRecorded -> {
                            Log.d(
                                TAG,
                                "👀 Agent observation [${event.iteration}]: ${event.toolName} -> ${event.observation.take(120)}"
                            )
                            appendAgentExecutionStep(
                                aiMessageId,
                                AgentExecutionStep(
                                    kind = AgentStepKind.OBSERVATION,
                                    title = "查看返回结果",
                                    detail = event.observation.take(220),
                                    status = AgentStepStatus.SUCCESS
                                )
                            )
                        }

                        is AgentEvent.ReviewCompleted -> {
                            Log.d(
                                TAG,
                                "🧪 Agent review [${event.iteration}]: ${event.action} -> ${event.reason}"
                            )
                            appendAgentExecutionStep(
                                aiMessageId,
                                AgentExecutionStep(
                                    kind = AgentStepKind.REVIEW,
                                    title = "第 ${event.iteration} 步反思",
                                    detail = event.reason,
                                    status = if (event.action.name == "FINAL") {
                                        AgentStepStatus.SUCCESS
                                    } else {
                                        AgentStepStatus.INFO
                                    }
                                )
                            )
                        }

                        is AgentEvent.ClarificationRequested -> {
                            Log.d(TAG, "❓ Clarification [${event.iteration}]: ${event.question}")
                            appendAgentExecutionStep(
                                aiMessageId,
                                AgentExecutionStep(
                                    kind = AgentStepKind.TOOL,
                                    title = "等待用户澄清",
                                    detail = event.question,
                                    status = AgentStepStatus.WAITING
                                )
                            )
                        }

                        is AgentEvent.ClarificationResolved -> {
                            Log.d(TAG, "✅ Clarification resolved [${event.iteration}]: ${event.answer}")
                            appendAgentExecutionStep(
                                aiMessageId,
                                AgentExecutionStep(
                                    kind = AgentStepKind.TOOL,
                                    title = "用户已回复",
                                    detail = event.answer,
                                    status = AgentStepStatus.SUCCESS
                                )
                            )
                        }

                        is AgentEvent.LoopDetected -> {
                            Log.w(
                                TAG,
                                "🔁 Loop detected [${event.iteration}]: ${event.toolName} detector=${event.detectorName} signal=${event.signal}"
                            )
                            appendAgentExecutionStep(
                                aiMessageId,
                                AgentExecutionStep(
                                    kind = AgentStepKind.REVIEW,
                                    title = if (event.signal == LoopDetector.Signal.EXIT)
                                        "循环检测(${event.detectorName}) — 终止"
                                    else "循环检测(${event.detectorName}) — 警告",
                                    detail = event.message,
                                    status = if (event.signal == LoopDetector.Signal.EXIT)
                                        AgentStepStatus.FAILED else AgentStepStatus.WARNING
                                )
                            )
                        }

                        is AgentEvent.FinalAnswerChunk -> {
                            if (!hasStartedFinalAnswer) {
                                hasStartedFinalAnswer = true
                                appendAgentExecutionStep(
                                    aiMessageId,
                                    AgentExecutionStep(
                                        kind = AgentStepKind.FINAL,
                                        title = "正在梳理最终答案",
                                        detail = "我已完成所有操作与思考，请看结果！",
                                        status = AgentStepStatus.SUCCESS
                                    )
                                )
                            }
                            if (firstChunkReceivedTime == 0L) {
                                firstChunkReceivedTime = System.currentTimeMillis()
                                requestLogs[aiMessageId]?.timeApiFirstChunk = firstChunkReceivedTime
                            }
                            contentBuilder.append(event.text)
                            requestLogs[aiMessageId]?.modelResponse = contentBuilder.toString()

                            val streamingMessage = ChatMessage(
                                id = aiMessageId,
                                content = contentBuilder.toString(),
                                isUser = false,
                                timestamp = getCurrentTime(),
                                createdAt = createdTime,
                                sessionId = _currentSessionId.value,
                                memoryUpdated = memoryTriggered,
                                memoryStatus = liveMemoryStatus.get(),
                                executionStepsJson = com.google.gson.Gson().toJson(_agentExecutionSteps.value[aiMessageId].orEmpty())
                            )
                            chatDao.insertMessage(streamingMessage)

                            if (_isTtsEnabled.value) {
                                ttsManager.playTextStream(event.text)
                            }
                        }

                        is AgentEvent.Completed -> {
                            if (_isTtsEnabled.value) {
                                ttsManager.finishStream()
                            }

                            val finalContent =
                                event.finalAnswer.ifBlank { contentBuilder.toString() }
                            requestLogs[aiMessageId]?.modelResponse = finalContent

                            val finalMessage = ChatMessage(
                                id = aiMessageId,
                                content = finalContent,
                                isUser = false,
                                timestamp = getCurrentTime(),
                                createdAt = createdTime,
                                sessionId = _currentSessionId.value,
                                memoryUpdated = memoryTriggered,
                                memoryStatus = liveMemoryStatus.get(),
                                executionStepsJson = com.google.gson.Gson().toJson(_agentExecutionSteps.value[aiMessageId].orEmpty())
                            )
                            chatDao.insertMessage(finalMessage)
                        }

                        is AgentEvent.Error -> {
                            terminalError = event.message
                            appendAgentExecutionStep(
                                aiMessageId,
                                AgentExecutionStep(
                                    kind = AgentStepKind.ERROR,
                                    title = "执行失败",
                                    detail = event.message,
                                    status = AgentStepStatus.ERROR
                                )
                            )
                        }
                    }
                }

                terminalError?.let { throw IllegalStateException(it) }

                requestLogs[aiMessageId]?.apply {
                    isSuccess = true
                    responseTime = System.currentTimeMillis() - requestStartTime
                    firstChunkTime =
                        if (firstChunkReceivedTime > 0) firstChunkReceivedTime - requestStartTime else 0
                }
                Log.d(TAG, "✅ Agent 请求完成: $aiMessageId")

                // 异步更新用户画像（不阻塞主流程）
                viewModelScope.launch {
                    try {
                        userProfileRepository.updateProfileFromConversation(conversationHistory)
                        cachedUserProfilePrompt = userProfileRepository.buildProfilePrompt()
                    } catch (e: Exception) {
                        Log.w(TAG, "Profile update failed", e)
                    }
                }
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) {
                    throw e
                }
                Log.e(TAG, "Failed to get Agent response: ${e.message}", e)
                _errorMessage.value = "获取回复失败: ${e.message}"

                val errorMessage = ChatMessage(
                    id = aiMessageId,
                    content = "抱歉，我暂时无法回复，请稍后再试。",
                    isUser = false,
                    timestamp = getCurrentTime(),
                    createdAt = createdTime,
                    sessionId = _currentSessionId.value,
                    memoryUpdated = memoryTriggered,
                    memoryStatus = 0,
                    executionStepsJson = com.google.gson.Gson().toJson(_agentExecutionSteps.value[aiMessageId].orEmpty())
                )
                chatDao.insertMessage(errorMessage)

                appendAgentExecutionStep(
                    aiMessageId,
                    AgentExecutionStep(
                        kind = AgentStepKind.ERROR,
                        title = "执行失败",
                        detail = e.message ?: "未知错误",
                        status = AgentStepStatus.ERROR
                    )
                )

                requestLogs[aiMessageId]?.apply {
                    isSuccess = false
                    this.errorMessage = e.message ?: "未知错误"
                    responseTime = System.currentTimeMillis() - requestStartTime
                    modelResponse = "错误: ${e.message}"
                }
            } finally {
                if (_pendingToolApproval.value?.messageId == aiMessageId) {
                    _pendingToolApproval.value = null
                }
                if (pendingApprovalDeferred?.isActive == true) {
                    pendingApprovalDeferred?.complete(
                        ToolApprovalDecision(
                            approved = false,
                            message = "执行已结束，审批请求自动关闭"
                        )
                    )
                }
                if (_pendingToolInteraction.value?.messageId == aiMessageId) {
                    _pendingToolInteraction.value = null
                }
                if (pendingInteractionDeferred?.isActive == true) {
                    pendingInteractionDeferred?.complete(
                        ToolInteractionResult(
                            success = false,
                            error = "执行已结束，交互请求自动关闭"
                        )
                    )
                }
                currentApprovalMessageId = null
                currentInteractionMessageId = null
                _isLoading.value = false
            }
        }
    }

    /**
     * 获取AI回复 - 使用Gemini 3 Flash模型（流式打字机效果）
     * @param userMessageObj 用户消息对象
     * @param imageUris 图片URI列表（支持多张图片）
     * @param memoryTriggered 是否触发了记忆更新
     * @param timeUserSent 用户点击发送的时间戳
     */
    /**
     * 构建对话历史
     */
    private suspend fun buildConversationHistory(): List<Pair<String, String>> {
        val recentMessages = chatDao.getMessagesList(_currentSessionId.value)
            .filter { it.content.isNotBlank() }
            .takeLast(10)

        return recentMessages.map { message ->
            if (message.isUser) {
                Pair("user", message.content)
            } else {
                Pair("model", message.content)
            }
        }
    }
    
    fun clearErrorMessage() {
        _errorMessage.value = null
    }

    override fun onCleared() {
        super.onCleared()
        ttsManager.disconnect()
        ttsManager.stop()
    }

    /**
     * 清空当前会话的消息
     */
    fun clearMessages() {
        viewModelScope.launch {
            chatDao.clearMessages(_currentSessionId.value)
        }
    }

    /**
     * 删除会话
     */
    fun deleteSession(sessionId: String) {
        viewModelScope.launch {
            // 删除会话的所有消息
            chatDao.clearMessages(sessionId)
            // 删除会话
            sessionDao.deleteSession(sessionId)
            // 如果删除的是当前会话，切换到默认会话
            if (_currentSessionId.value == sessionId) {
                _currentSessionId.value = DEFAULT_SESSION_ID
            }
        }
    }

    /**
     * 删除消息对（用户query + AI回复）
     */
    fun deleteMessagePair(messageId: String) {
        viewModelScope.launch {
            try {
                // 获取当前消息
                val currentMessage = chatDao.getMessageById(messageId)
                if (currentMessage == null) {
                    Log.e(TAG, "Message not found: $messageId")
                    return@launch
                }

                // 获取所有消息列表
                val allMessages = chatDao.getMessagesList(_currentSessionId.value)
                val currentIndex = allMessages.indexOfFirst { it.id == messageId }
                
                if (currentIndex < 0) {
                    Log.e(TAG, "Message index not found: $messageId")
                    return@launch
                }

                if (currentMessage.isUser) {
                    // 如果是用户消息，删除该消息和下一条AI回复（如果存在）
                    chatDao.deleteMessage(messageId)
                    if (currentIndex + 1 < allMessages.size) {
                        val nextMessage = allMessages[currentIndex + 1]
                        if (!nextMessage.isUser) {
                            chatDao.deleteMessage(nextMessage.id)
                        }
                    }
                } else {
                    // 如果是AI回复，删除该回复和上一条用户消息（如果存在）
                    chatDao.deleteMessage(messageId)
                    if (currentIndex > 0) {
                        val prevMessage = allMessages[currentIndex - 1]
                        if (prevMessage.isUser) {
                            chatDao.deleteMessage(prevMessage.id)
                        }
                    }
                }

                // 更新会话信息
                val remainingMessages = chatDao.getMessagesList(_currentSessionId.value)
                sessionDao.updateSessionInfo(
                    sessionId = _currentSessionId.value,
                    updatedAt = System.currentTimeMillis(),
                    messageCount = remainingMessages.size
                )
            } catch (e: Exception) {
                Log.e(TAG, "Failed to delete message pair: ${e.message}", e)
                _errorMessage.value = "删除失败: ${e.message}"
            }
        }
    }

    /**
     * 获取当前时间
     */
    private fun getCurrentTime(): String {
        val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
        return sdf.format(Date())
    }
    
    // ==================== 记忆系统集成 ====================
    
    /**
     * 获取记忆上下文（带缓存）
     */
    private suspend fun getMemoryContext(
        query: String,
        onInfo: ((MemoryRepository.MemoryRetrievalInfo) -> Unit)? = null
    ): String {
        val now = System.currentTimeMillis()
        
        // 1分钟内复用缓存（同时复用检索详情）
        if (cachedMemoryContext != null && now - lastMemoryQueryTime < MEMORY_CACHE_DURATION) {
            Log.d(TAG, "🧠 使用缓存的记忆上下文 (${cachedMemoryContext?.length ?: 0} 字符)")
            cachedRetrievalInfo?.let { onInfo?.invoke(it) }
            return cachedMemoryContext!!
        }
        
        // 重新检索
        Log.d(TAG, "🔍 开始检索长期记忆，查询: ${query.take(50)}...")
        val context = memoryRepository.buildMemoryContext(query) {
            cachedRetrievalInfo = it
            onInfo?.invoke(it)
        }
        cachedMemoryContext = context
        lastMemoryQueryTime = now
        
        if (context.isBlank()) {
            Log.w(TAG, "⚠️ 记忆上下文为空，可能原因：1)数据库无记忆 2)检索无匹配 3)向量服务未初始化")
        } else {
            Log.d(TAG, "✅ 获取记忆上下文成功 (${context.length} 字符)")
        }
        
        return context
    }
    
    /**
     * 构建包含记忆、时间和位置的系统提示词
     */
    private fun buildSystemPromptWithMemory(memoryContext: String): String {
        // 🆕 动态注入当前时间
        val currentDateTime = SimpleDateFormat("yyyy年MM月dd日 HH:mm EEEE", Locale.CHINESE).format(Date())
        
        // 🆕 动态注入用户位置
        val currentLocation = getCurrentLocation()
        
        val locationSection = if (currentLocation.isNotBlank()) {
            "\n\n## 当前位置:\n$currentLocation"
        } else {
            ""
        }
        
        val basePrompt = """你是小米澎湃OS的智能助手，拥有AI认知能力、设备控制能力和全场景感知能力。

## 当前时间:
$currentDateTime$locationSection

## 回复风格:
- 简洁、自然、充满智慧
- 像朋友一样对话，但保持适当的专业界限
- 优先使用短句，在屏幕交互时多使用列表和结构化排版
- 直接回答问题，不要在回复开头自我介绍

## 能力范围:
- 系统智控、生活助手、创意中心、米家智能

## 重要约束:
- 拒绝任何违法、暴力、有害内容的生成
- 保护用户隐私，不存储任何非必要的敏感数据
- 若无法完成任务，应明确说明原因并提供备选方案"""
        
        return if (memoryContext.isNotBlank()) {
            "$basePrompt$memoryContext"
        } else {
            basePrompt
        }
    }
    
    /**
     * 🆕 获取用户当前位置
     * 优先使用GPS，其次使用网络定位
     * 返回格式化的地址字符串，获取失败返回空字符串
     */
    private fun getCurrentLocation(): String {
        val context = getApplication<Application>().applicationContext
        
        // 检查位置权限
        val hasCoarsePermission = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        val hasFinePermission = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        if (!hasCoarsePermission && !hasFinePermission) {
            Log.d(TAG, "位置权限未授予")
            return ""
        }
        
        return try {
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            
            // 尝试获取最后已知位置
            var location: Location? = null
            
            if (hasFinePermission) {
                location = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            }
            
            if (location == null && hasCoarsePermission) {
                location = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            }
            
            if (location == null) {
                location = locationManager.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER)
            }
            
            if (location != null) {
                // 使用Geocoder将经纬度转换为地址
                try {
                    val geocoder = Geocoder(context, Locale.CHINESE)
                    @Suppress("DEPRECATION")
                    val addresses = geocoder.getFromLocation(location.latitude, location.longitude, 1)
                    if (!addresses.isNullOrEmpty()) {
                        val address = addresses[0]
                        val locationParts = mutableListOf<String>()
                        
                        // 构建地址字符串：省/市/区/街道
                        address.adminArea?.let { locationParts.add(it) }  // 省
                        address.locality?.let { if (it != address.adminArea) locationParts.add(it) }  // 市
                        address.subLocality?.let { locationParts.add(it) }  // 区
                        address.thoroughfare?.let { locationParts.add(it) }  // 街道
                        
                        val formattedAddress = locationParts.joinToString("")
                        Log.d(TAG, "获取到位置: $formattedAddress")
                        return formattedAddress.ifBlank { "" }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Geocoder转换失败: ${e.message}")
                    // 返回经纬度作为备选
                    return "纬度${String.format("%.4f", location.latitude)}, 经度${String.format("%.4f", location.longitude)}"
                }
            }
            
            ""
        } catch (e: Exception) {
            Log.e(TAG, "获取位置失败: ${e.message}")
            ""
        }
    }
    
    /**
     * 清除记忆缓存（切换会话时调用）
     */
    private fun clearMemoryCache() {
        cachedMemoryContext = null
        cachedRetrievalInfo = null
        lastMemoryQueryTime = 0
    }
}
