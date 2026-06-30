package com.xiaoxiami.app.agent

import android.util.Log
import com.xiaoxiami.app.repository.GeminiRepository
import com.google.gson.Gson
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class GeminiLlmAdapter(
    private val geminiRepository: GeminiRepository,
    private val userProfilePrompt: String? = null,
    private val failoverChain: ModelFailoverChain? = null
) : LlmAdapter {

    private val gson = Gson()

    override suspend fun structureGoal(context: GoalContext): StructuredGoal =
        withContext(Dispatchers.IO) {
            val prompt = buildGoalPrompt(context)
            val response = collectStreamedResponse(
                prompt = prompt,
                modelId = context.modelId,
                label = "goal"
            )
            parseStructuredGoal(
                raw = response,
                userGoal = context.userGoal
            )
        }

    override suspend fun decideNextAction(context: DecisionContext): AgentDecision =
        withContext(Dispatchers.IO) {
            runCatching {
                val prompt = buildDecisionPrompt(context)
                val response = collectStreamedResponse(
                    prompt = prompt,
                    modelId = context.modelId,
                    label = "decision"
                )
                parseDecision(response)
            }.recoverCatching { error ->
                if (error.message?.contains("Empty response from model", ignoreCase = true) == true) {
                    val fallbackPrompt = buildDecisionPrompt(context, ultraCompact = true)
                    val fallbackResponse = collectStreamedResponse(
                        prompt = fallbackPrompt,
                        modelId = context.modelId,
                        label = "decision_fallback"
                    )
                    parseDecision(fallbackResponse)
                } else {
                    throw error
                }
            }.getOrThrow()
        }

    override suspend fun review(context: ReviewContext): ReviewDecision =
        withContext(Dispatchers.IO) {
            val prompt = buildReviewPrompt(context)
            val response = collectStreamedResponse(
                prompt = prompt,
                modelId = context.modelId,
                label = "review"
            )
            parseReviewDecision(
                raw = response,
                currentDecision = context.currentDecision
            )
        }

    override suspend fun streamFinalAnswer(
        context: FinalAnswerContext,
        onChunk: (String) -> Unit
    ): String {
        val prompt = buildFinalAnswerPrompt(context)

        suspend fun doStream(effectiveModelId: String): String {
            return geminiRepository.generateContentStream(
                prompt = prompt,
                conversationHistory = context.conversationHistory,
                modelName = effectiveModelId,
                enableSearch = false,
                enableThinking = false,
                isConversation = true,
                onChunk = onChunk
            )
        }

        return if (failoverChain != null) {
            failoverChain.execute { effectiveModelId -> doStream(effectiveModelId) }
        } else {
            doStream(context.modelId)
        }
    }

    private suspend fun collectStreamedResponse(
        prompt: String,
        modelId: String,
        label: String
    ): String {
        Log.d(TAG, "🧠 collectStreamedResponse[$label]: promptLength=${prompt.length}, model=$modelId")

        suspend fun doCall(effectiveModelId: String): String {
            val contentBuilder = StringBuilder()
            return geminiRepository.generateContentStream(
                prompt = prompt,
                conversationHistory = emptyList(),
                systemPrompt = AGENT_SYSTEM_PROMPT,
                modelName = effectiveModelId,
                enableSearch = false,
                enableThinking = false,
                isConversation = true,
                onChunk = { chunk -> contentBuilder.append(chunk) }
            ).ifBlank { contentBuilder.toString() }
        }

        return if (failoverChain != null) {
            failoverChain.execute { effectiveModelId -> doCall(effectiveModelId) }
        } else {
            doCall(modelId)
        }
    }

    private fun buildGoalPrompt(context: GoalContext): String {
        val history = renderConversationHistory(context.conversationHistory)
        val imageContext = if (context.imageCount > 0) {
            "用户本轮附带了 ${context.imageCount} 张图片。"
        } else {
            "用户本轮没有附带图片。"
        }
        return """
            你是一个 Agent 目标结构化器。
            你的工作是把用户原始目标整理成结构化目标，不能改变原意，不能发散。

            用户原始目标:
            ${context.userGoal}

            图片上下文:
            $imageContext

            会话历史:
            $history

            输出规则:
            1. task: 用一句话描述这次要完成的任务。
            2. success_criteria: 明确什么结果算完成目标。
            3. required_information: 列出为了完成目标必须拿到的关键信息，没有就返回空数组。
            4. constraints: 列出显式约束或边界，没有就返回空数组。
            5. 必须严格输出 JSON，不要 Markdown，不要解释。

            输出格式:
            {"task":"...","success_criteria":"...","required_information":["..."],"constraints":["..."]}
        """.trimIndent()
    }

    private fun buildDecisionPrompt(
        context: DecisionContext,
        ultraCompact: Boolean = false
    ): String {
        val observations = renderObservations(context.observations)
        val history = renderConversationHistory(context.conversationHistory)
        val reviewHistory = renderReviewHistory(context.reviewHistory)
        val toolSchemas = renderToolSchemas(
            tools = selectPlannerTools(context.availableTools, context, ultraCompact),
            ultraCompact = ultraCompact
        )
        val skills = renderSkills(context.availableSkills, ultraCompact = ultraCompact)
        val imageContext = if (context.imageCount > 0) {
            "本轮附带 ${context.imageCount} 张图片，可通过 analyze_images 获取视觉 observation。"
        } else {
            "本轮无附带图片。"
        }

        val profileSection = if (userProfilePrompt != null) "User Profile: " + userProfilePrompt else ""

        return """
            你是一个任务规划器，负责为 Agent 决定"下一步只做一件事"。
            $profileSection
            结构化目标:
            ${renderGoal(context.goal)}

            图片上下文:
            $imageContext

            会话历史:
            ${if (context.summarizedPrefix != null) "【早期摘要】${context.summarizedPrefix}\n【近期对话】" else ""}$history

            已有观察:
            $observations

            历史反思:
            $reviewHistory

            当前可用技能:
            $skills

            可用工具:
            $toolSchemas

            决策规则:
            1. 一次只能选择一个动作。
            2. 如果缺少用户历史偏好或历史事实，优先使用 memory_search。
            3. 如果问题依赖最新外部信息，使用 web_search。
            4. 如果目标依赖用户上传图片的内容，优先使用 analyze_images。
            5. 如果问题依赖当前地理位置，使用 get_current_location。
            6. 如果问题依赖当前手机正在打开哪个 App 或当前设备状态，优先使用 get_foreground_app。
            7. 如果用户明确要求"记住/保存这个事实或偏好"，使用 memory_store。
            8. 如果用户明确要求"忘掉/删除某条记忆"，使用 memory_forget。
            9. 如果目标是调用明确 API 或访问结构化 HTTP 接口，使用 http_request；如果目标是抓取网页正文，使用 web_fetch。
            10. 如果目标依赖 PDF 文件内容，使用 pdf_read；如果只需要图片元数据，使用 image_info。
            10.1 如果你只需要把某个页面直接打开给用户看，用 browser_open；如果你只需要抓取静态网页正文，用 browser_extract。
            10.2 如果任务需要多步网页交互，优先走 browser_runtime：先用 browser_session_create 建会话，再用 browser_navigate、browser_dom_snapshot、browser_query_elements、browser_click、browser_fill_form、browser_wait_for、browser_extract_page。
            10.3 如果需要网页可视化证据，使用 browser_screenshot；如果需要更稳的网页登录或系统浏览器态，使用 browser_handoff_to_custom_tab；如果要把公开网页资源落到本机下载目录，使用 browser_download_file。
            11. 如果用户要"以后某个时间执行一次"或明确要"创建定时任务"，优先使用 create_scheduled_task（兼容 at/cron）；旧接口可用 schedule。
            12. 查询已有定时任务优先 list_scheduled_tasks；看单条用 get_scheduled_task；修改用 update_scheduled_task；删除用 delete_scheduled_task。若需要 Android 原生细粒度能力，可继续用 cron_add/cron_list/cron_update/cron_delete/cron_run/cron_runs。
            13. 如果用户要"当某类通知出现时自动处理"，使用 rules_add；查询规则用 rules_list，修改用 rules_update，删除用 rules_delete；查执行日志用 rules_runs；验证某条通知是否会命中规则用 rules_preview。
            14. 如果某个子任务是独立、边界清晰、适合交给单独子 Agent 处理，可以使用 delegate；但不要把整个主任务都委派出去，也不要连续递归 delegate。
            15. 如果用户在处理跨端设备或远程手机节点状态，优先查看 remote_android_bridge_status / remote_android_devices / remote_android_request_status；如果某个逻辑工具支持 remote_android route，优先通过 host=remote_android 走统一路由，而不是低级桥接调用。
            16. 如果已有观察还不能满足 success_criteria，就继续行动，不要草率 final。
            17. Review 如果提示需要重试或换工具，你要优先处理。
            18. 不要虚构工具结果，不要同时返回 tool 和 final。
            19. 只能使用工具 schema 中声明过的参数，参数名必须精确匹配。
            20. 优先选择 host 适合当前任务的工具；本地设备工具适合获取当前手机状态，cloud_service 工具适合外部知识检索，remote_android 适合跨端调用已配对手机。
            21. execution_mode=direct 表示可直接执行；execution_mode=settings_redirect 表示只能拉起系统设置页，不要把它当成静默控制开关；execution_mode=remote_bridge 表示这是远端桥接能力，不是本机直控。
            22. identity / scopes / content_risks 描述的是当前 runtime 的安全边界，不能越界选工具。
            23. availability=optional 且已出现在工具列表中，说明该工具已经被 allowlist 放行；未出现在列表中的可选工具一律视为不可用。
            24. 如果某个 skill 明确适合当前任务，优先遵循它的策略，但 skill 不是工具，真正执行仍要选择 tool。
            25. 如果某个逻辑工具存在多个 routes，你可以额外输出 host 字段，值只能是 local_android / remote_android / local_desktop / remote_desktop / cloud_service 之一；如果不确定可省略，runtime 会自动选择默认 route。

            严格输出 JSON，不要 Markdown，不要解释。格式只能是以下二选一：
            {"type":"tool","reason":"为什么需要这个工具","tool":"memory_search","host":"remote_android","arguments":{"query":"..."}}
            {"type":"final","reason":"为什么现在可以直接回答","answer":"给用户的最终回答"}
        """.trimIndent()
    }

    private fun buildReviewPrompt(context: ReviewContext): String {
        val latestObservation = context.latestObservation?.let { observation ->
            """
            工具: ${observation.toolName}
            入参: ${gson.toJson(observation.arguments)}
            success: ${observation.success}
            raw_output:
            ${observation.rawOutput.ifBlank { observation.error ?: "无返回内容" }}
            """.trimIndent()
        } ?: "本轮没有新的工具 observation，当前是 planner 提出的直接回答路径。"

        val draftAnswer = context.currentDecision.answer?.takeIf { it.isNotBlank() } ?: "无"

        return """
            你是 Agent 的 Review 审核器。
            你的职责是判断"当前结果是否已经满足目标"，并决定下一步。

            结构化目标:
            ${renderGoal(context.goal)}

            图片上下文:
            ${if (context.imageCount > 0) "本轮附带 ${context.imageCount} 张图片。" else "本轮无附带图片。"}

            当前决策:
            type=${context.currentDecision.type}
            reason=${context.currentDecision.reason}
            draft_answer=$draftAnswer

            最新 observation:
            $latestObservation

            全部 observation:
            ${renderObservations(context.observations)}

            历史反思:
            ${renderReviewHistory(context.reviewHistory)}

            审核要求:
            1. 验证当前信息是否满足 success_criteria。
            2. 判断结果是否准确、完整、可直接交付。
            3. 如果已满足目标，输出 final。
            4. 如果需要重新推理下一步，输出 reason。
            5. 如果更应该优先重试或换工具，输出 retry。
            6. 不要编造 observation，不要把猜测当成结果。

            严格输出 JSON，不要 Markdown，不要解释。格式只能是以下三选一：
            {"action":"final","reason":"为什么已经满足目标","answer":"可用于最终回答的结论"}
            {"action":"reason","reason":"为什么需要重新推理"}
            {"action":"retry","reason":"为什么应该优先重试或换工具"}
        """.trimIndent()
    }

    private fun buildFinalAnswerPrompt(context: FinalAnswerContext): String {
        val history = renderConversationHistory(context.conversationHistory)
        val observations = renderObservations(context.observations)
        val reviewSection = context.reviewSummary?.takeIf { it.isNotBlank() }?.let {
            "\nReview 结论:\n$it\n"
        } ?: ""
        val hintSection = context.hint?.takeIf { it.isNotBlank() }?.let {
            "\n规划提示:\n$it\n"
        } ?: ""
        val imageContext = if (context.imageCount > 0) {
            "\n图片上下文:\n本轮附带 ${context.imageCount} 张图片，回答应以相关 observation 为依据。\n"
        } else {
            ""
        }

        return """
            你是小米澎湃OS的智能助手，请基于用户目标和工具观察结果，直接给出最终回答。
$reviewSection
$hintSection
$imageContext
            结构化目标:
            ${renderGoal(context.goal)}

            会话历史:
            ${if (context.summarizedPrefix != null) "【早期摘要】${context.summarizedPrefix}\n【近期对话】" else ""}$history

            工具观察结果:
            $observations

            要求:
            1. 回答必须以工具观察为依据，不要编造。
            2. 如果信息不足，要明确说出不足点。
            3. 回答要尽量满足 success_criteria。
            4. 回答保持简洁、自然，必要时可分点。
            5. 不要暴露"内部推理""工具调用过程"这类系统实现细节。
            6. 如果你刚使用了 execution_mode 为 settings_redirect 的工具，请用一句话简短回复（如：我已经为您跳转到了相关设置页，请操作），绝不要长篇大论，防止 App 进入后台导致网络被系统切断断开！
        """.trimIndent()
    }

    private fun parseStructuredGoal(
        raw: String,
        userGoal: String
    ): StructuredGoal {
        val clean = normalizeJsonText(raw)
        val jsonText = extractJsonObject(clean) ?: return fallbackGoal(userGoal)

        return runCatching {
            val json = JsonParser.parseString(jsonText).asJsonObject
            StructuredGoal(
                rawGoal = userGoal,
                task = json.get("task")?.asString?.trim().orEmpty().ifBlank { userGoal },
                successCriteria = json.get("success_criteria")?.asString?.trim()
                    .orEmpty()
                    .ifBlank { "给出满足用户目标的正确回答" },
                requiredInformation = toStringList(json.get("required_information")),
                constraints = toStringList(json.get("constraints"))
            )
        }.getOrElse {
            fallbackGoal(userGoal)
        }
    }

    private fun parseDecision(raw: String): AgentDecision {
        val clean = normalizeJsonText(raw)
        val jsonText = extractJsonObject(clean) ?: return AgentDecision(
            type = DecisionType.FINAL,
            reason = "模型未返回可解析 JSON，退化为直接回答",
            answer = clean
        )

        return runCatching {
            val json = JsonParser.parseString(jsonText).asJsonObject
            val type = json.get("type")?.asString?.trim()?.lowercase()
            val reason = json.get("reason")?.asString?.trim().orEmpty()
            when (type) {
                "tool" -> AgentDecision(
                    type = DecisionType.TOOL,
                    reason = reason.ifBlank { "需要补充观察" },
                    toolName = json.get("tool")?.asString?.trim(),
                    targetHost = ToolRoutePreference.fromRaw(json.get("host")?.asString?.trim()),
                    arguments = json.get("arguments")?.let { toMap(it.asJsonObject) } ?: emptyMap()
                )
                "final" -> AgentDecision(
                    type = DecisionType.FINAL,
                    reason = reason.ifBlank { "已有足够信息" },
                    answer = json.get("answer")?.asString?.trim().orEmpty()
                )
                else -> AgentDecision(
                    type = DecisionType.FINAL,
                    reason = "模型返回了未知决策类型，退化为直接回答",
                    answer = clean
                )
            }
        }.getOrElse {
            AgentDecision(
                type = DecisionType.FINAL,
                reason = "模型 JSON 解析失败，退化为直接回答",
                answer = clean
            )
        }
    }

    private fun parseReviewDecision(
        raw: String,
        currentDecision: AgentDecision
    ): ReviewDecision {
        val clean = normalizeJsonText(raw)
        val jsonText = extractJsonObject(clean)
            ?: return fallbackReviewDecision(currentDecision, clean)

        return runCatching {
            val json = JsonParser.parseString(jsonText).asJsonObject
            val action = json.get("action")?.asString?.trim()?.lowercase()
            val reason = json.get("reason")?.asString?.trim().orEmpty()
            when (action) {
                "final" -> ReviewDecision(
                    action = ReviewAction.FINAL,
                    reason = reason.ifBlank { "当前结果已满足目标" },
                    answer = json.get("answer")?.asString?.trim().orEmpty()
                )
                "reason" -> ReviewDecision(
                    action = ReviewAction.REASON,
                    reason = reason.ifBlank { "需要重新推理下一步" }
                )
                "retry" -> ReviewDecision(
                    action = ReviewAction.RETRY,
                    reason = reason.ifBlank { "建议优先重试或换工具" }
                )
                else -> fallbackReviewDecision(currentDecision, clean)
            }
        }.getOrElse {
            fallbackReviewDecision(currentDecision, clean)
        }
    }

    private fun toMap(jsonObject: JsonObject): Map<String, Any?> {
        return gson.fromJson(jsonObject, Map::class.java) as Map<String, Any?>
    }

    private fun toStringList(element: JsonElement?): List<String> {
        val array = element?.asJsonArray ?: return emptyList()
        return array.mapNotNull { item ->
            runCatching { item.asString.trim() }.getOrNull()?.takeIf { it.isNotBlank() }
        }
    }

    private fun normalizeJsonText(raw: String): String {
        return raw
            .replace("```json", "")
            .replace("```", "")
            .trim()
    }

    private fun extractJsonObject(text: String): String? {
        val start = text.indexOf('{')
        val end = text.lastIndexOf('}')
        if (start < 0 || end <= start) return null
        return text.substring(start, end + 1)
    }

    private fun fallbackGoal(userGoal: String): StructuredGoal {
        return StructuredGoal(
            rawGoal = userGoal,
            task = userGoal,
            successCriteria = "给出满足用户目标的正确回答"
        )
    }

    private fun fallbackReviewDecision(
        currentDecision: AgentDecision,
        raw: String
    ): ReviewDecision {
        return if (currentDecision.type == DecisionType.FINAL) {
            ReviewDecision(
                action = ReviewAction.FINAL,
                reason = "Review 未返回可解析 JSON，退化为按当前结论输出",
                answer = currentDecision.answer?.takeIf { it.isNotBlank() } ?: raw
            )
        } else {
            ReviewDecision(
                action = ReviewAction.REASON,
                reason = "Review 未返回可解析 JSON，回到重新推理"
            )
        }
    }

    private fun renderGoal(goal: StructuredGoal): String {
        val requiredInfo = goal.requiredInformation.takeIf { it.isNotEmpty() }?.joinToString("\n") {
            "- $it"
        } ?: "- 无"
        val constraints = goal.constraints.takeIf { it.isNotEmpty() }?.joinToString("\n") {
            "- $it"
        } ?: "- 无"

        return """
            原始目标: ${goal.rawGoal}
            task: ${goal.task}
            success_criteria: ${goal.successCriteria}
            required_information:
            $requiredInfo
            constraints:
            $constraints
        """.trimIndent()
    }

    private fun renderConversationHistory(history: List<Pair<String, String>>): String {
        if (history.isEmpty()) return "无"
        return history.joinToString("\n") { (role, content) ->
            "${if (role == "user") "用户" else "助手"}: $content"
        }
    }

    private fun renderObservations(observations: List<ToolObservation>): String {
        if (observations.isEmpty()) return "暂无 observation"
        return observations.mapIndexed { index, observation ->
            """
            ${index + 1}. tool=${observation.toolName}
            success=${observation.success}
            args=${gson.toJson(observation.arguments)}
            raw_output=${observation.rawOutput.ifBlank { observation.error ?: "无返回内容" }}
            """.trimIndent()
        }.joinToString("\n")
    }

    private fun renderReviewHistory(reviewHistory: List<String>): String {
        if (reviewHistory.isEmpty()) return "暂无历史反思"
        return reviewHistory.mapIndexed { index, value ->
            "${index + 1}. $value"
        }.joinToString("\n")
    }

    private fun selectPlannerTools(
        tools: List<PlannerToolSchema>,
        context: DecisionContext,
        ultraCompact: Boolean
    ): List<PlannerToolSchema> {
        if (tools.size <= 32) return tools.sortedBy { it.name }
        val goalText = buildString {
            append(context.goal.rawGoal).append(' ')
            append(context.goal.task).append(' ')
            append(context.goal.successCriteria)
            if (context.goal.requiredInformation.isNotEmpty()) {
                append(' ').append(context.goal.requiredInformation.joinToString(" "))
            }
            if (context.reviewHistory.isNotEmpty()) {
                append(' ').append(context.reviewHistory.joinToString(" "))
            }
        }.lowercase()
        val skillPreferred = context.availableSkills.flatMap {
            it.manifest.preferredTools + it.manifest.requiredTools
        }.toSet()
        val alwaysInclude = setOf(
            "memory_search",
            "memory_store",
            "memory_forget",
            "web_search",
            "http_request",
            "web_fetch",
            "analyze_images",
            "get_foreground_app",
            "get_current_location",
            "browser_open",
            "browser_extract",
            "browser_session_create",
            "browser_navigate",
            "browser_query_elements",
            "browser_click",
            "browser_fill_form",
            "browser_wait_for",
            "browser_extract_page",
            "create_scheduled_task",
            "list_scheduled_tasks",
            "get_scheduled_task",
            "update_scheduled_task",
            "delete_scheduled_task",
            "schedule",
            "cron_add",
            "cron_list",
            "rules_add",
            "rules_preview",
            "delegate",
            "remote_android_bridge_status",
            "set_flashlight"
        )
        val scored = tools.map { schema ->
            var score = 0
            if (schema.name in alwaysInclude) score += 120
            if (schema.name in skillPreferred) score += 100
            if (goalText.contains(schema.name.lowercase())) score += 90
            if (goalText.contains(schema.family.name.lowercase())) score += 20
            schema.capabilities.forEach { capability ->
                if (goalText.contains(capability.lowercase())) score += 14
            }
            schema.inputSchema.forEach { param ->
                if (goalText.contains(param.name.lowercase())) score += 10
            }
            val descWords = schema.description
                .lowercase()
                .split(Regex("[^a-z0-9\\u4e00-\\u9fa5]+"))
                .filter { it.length >= 2 }
                .take(if (ultraCompact) 5 else 8)
            descWords.forEach { word ->
                if (goalText.contains(word)) score += 6
            }
            schema to score
        }
        val limit = if (ultraCompact) 28 else 40
        return scored
            .sortedWith(
                compareByDescending<Pair<PlannerToolSchema, Int>> { it.second }
                    .thenBy { it.first.name }
            )
            .take(limit)
            .map { it.first }
            .sortedBy { it.name }
    }

    private fun renderToolSchemas(
        tools: List<PlannerToolSchema>,
        ultraCompact: Boolean = false
    ): String {
        if (tools.isEmpty()) return "无可用工具"
        return tools.joinToString("\n\n") { schema ->
            buildString {
                val routeSummary = schema.routes.joinToString(" | ") { route ->
                    buildString {
                        append(route.hostKind.name.lowercase())
                        append("/")
                        append(route.executionMode.name.lowercase())
                        if (route.approvalRequired) append("/approval")
                    }
                }
                val inputSummary = if (schema.inputSchema.isEmpty()) {
                    "none"
                } else {
                    schema.inputSchema.joinToString(", ") { param ->
                        "${param.name}${if (param.required) "*" else ""}"
                    }
                }
                append("- ${schema.name}: ${schema.description.take(if (ultraCompact) 72 else 120)}\n")
                append("  family=${schema.family.name.lowercase()} risk=${schema.riskLevel.name.lowercase()} availability=${schema.availability.name.lowercase()} default_host=${schema.defaultHostKind.name.lowercase()}\n")
                append("  routes=$routeSummary\n")
                append("  inputs=$inputSummary")
                if (!ultraCompact && schema.capabilities.isNotEmpty()) {
                    append("\n  caps=${schema.capabilities.take(6).joinToString(", ")}")
                }
            }.trimEnd()
        }
    }

    private fun renderSkills(
        skills: List<com.xiaoxiami.app.agent.skills.SkillActivation>,
        ultraCompact: Boolean = false
    ): String {
        if (skills.isEmpty()) return "暂无可用 skill"
        return skills
            .sortedByDescending { it.score }
            .take(if (ultraCompact) 4 else 6)
            .joinToString("\n") { skill ->
            buildString {
                append("- ${skill.manifest.id} [score=${skill.score}]")
                append(": ${skill.manifest.description.take(if (ultraCompact) 72 else 120)}")
                append(" | category=${skill.manifest.category}")
                append(" | reason=${skill.reason}")
                if (skill.manifest.preferredTools.isNotEmpty()) {
                    append(" | tools=${skill.manifest.preferredTools.take(5).joinToString(", ")}")
                }
            }
        }
    }

    companion object {
        private const val TAG = "GeminiLlmAdapter"
        private const val AGENT_SYSTEM_PROMPT = """
            你是一个谨慎的 Agent 决策器。
            你的工作不是直接和用户聊天，而是负责 Goal / Reason / Review 这些中间决策。
            你必须严格输出 JSON，不能输出 Markdown，不能输出多余解释。
        """
    }
}
