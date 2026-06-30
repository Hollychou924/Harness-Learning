package com.xiaoxiami.app.agent.providers

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.xiaoxiami.app.agent.*
import com.xiaoxiami.app.agent.skills.SkillActivation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * OpenAI-compatible LLM adapter.
 * Works with OpenAI API, Azure OpenAI, and any OpenAI-compatible endpoint.
 * Also serves as base for Anthropic adapter (Messages API has similar structure).
 *
 * Ported from desktop-claw's agent/src/agent-xiaoai/providers/openai.ts.
 */
class OpenAICompatibleAdapter(
    private val config: LlmProviderConfig
) : LlmAdapter {

    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .build()

    private val baseUrl = config.baseUrl.ifBlank {
        LlmProviderConfig.getDefaultBaseUrl(config.type)
    }.trimEnd('/')

    private val modelId = config.modelId.ifBlank {
        LlmProviderConfig.getDefaultModelId(config.type)
    }

    override suspend fun structureGoal(context: GoalContext): StructuredGoal =
        withContext(Dispatchers.IO) {
            val prompt = buildGoalPrompt(context)
            val response = chat(prompt)
            parseStructuredGoal(response, context.userGoal)
        }

    override suspend fun decideNextAction(context: DecisionContext): AgentDecision =
        withContext(Dispatchers.IO) {
            val prompt = buildDecisionPrompt(context)
            val response = chat(prompt)
            parseDecision(response)
        }

    override suspend fun review(context: ReviewContext): ReviewDecision =
        withContext(Dispatchers.IO) {
            val prompt = buildReviewPrompt(context)
            val response = chat(prompt)
            parseReviewDecision(response, context.currentDecision)
        }

    override suspend fun streamFinalAnswer(
        context: FinalAnswerContext,
        onChunk: (String) -> Unit
    ): String = withContext(Dispatchers.IO) {
        val prompt = buildFinalAnswerPrompt(context)
        val response = chat(prompt)
        onChunk(response)
        response
    }

    // --- API call ---

    private fun chat(prompt: String): String {
        val isAnthropic = config.type == LlmProviderType.ANTHROPIC

        val requestBody = if (isAnthropic) {
            gson.toJson(mapOf(
                "model" to modelId,
                "max_tokens" to 4096,
                "messages" to listOf(mapOf("role" to "user", "content" to prompt))
            ))
        } else {
            gson.toJson(mapOf(
                "model" to modelId,
                "messages" to listOf(mapOf("role" to "user", "content" to prompt)),
                "temperature" to 0.3
            ))
        }

        val url = if (isAnthropic) {
            "$baseUrl/v1/messages"
        } else {
            "$baseUrl/v1/chat/completions"
        }

        val requestBuilder = Request.Builder()
            .url(url)
            .post(requestBody.toRequestBody(jsonMediaType))

        if (isAnthropic) {
            requestBuilder.addHeader("x-api-key", config.apiKey)
            requestBuilder.addHeader("anthropic-version", "2023-06-01")
            requestBuilder.addHeader("content-type", "application/json")
        } else {
            requestBuilder.addHeader("Authorization", "Bearer ${config.apiKey}")
            requestBuilder.addHeader("Content-Type", "application/json")
        }

        val response = client.newCall(requestBuilder.build()).execute()
        val body = response.body?.string() ?: throw Exception("Empty response")

        if (!response.isSuccessful) {
            throw Exception("API error ${response.code}: $body")
        }

        val json = JsonParser.parseString(body).asJsonObject

        return if (isAnthropic) {
            // Anthropic Messages API response
            json.getAsJsonArray("content")
                ?.get(0)?.asJsonObject
                ?.get("text")?.asString ?: ""
        } else {
            // OpenAI chat completions response
            json.getAsJsonArray("choices")
                ?.get(0)?.asJsonObject
                ?.getAsJsonObject("message")
                ?.get("content")?.asString ?: ""
        }
    }

    // --- Prompt builders (reuse same format as GeminiLlmAdapter) ---

    private fun buildGoalPrompt(context: GoalContext): String {
        return """你是一个智能助手的规划模块。请将用户的请求分解为结构化目标。

用户请求: ${context.userGoal}

请以JSON格式回复：
```json
{
  "task": "核心任务描述",
  "successCriteria": "成功标准",
  "requiredInformation": ["需要的信息1", "需要的信息2"],
  "constraints": ["约束条件1"]
}
```"""
    }

    private fun buildDecisionPrompt(context: DecisionContext): String {
        val toolList = context.availableTools.joinToString("\n") { tool ->
            "- ${tool.name}: ${tool.description}"
        }
        val obsHistory = context.observations.joinToString("\n") { obs ->
            "[${obs.toolName}] ${obs.rawOutput.take(200)}"
        }
        return """你是一个智能助手的决策模块。根据目标和当前观察，决定下一步动作。

目标: ${context.goal.task}
成功标准: ${context.goal.successCriteria}

已有观察:
$obsHistory

可用工具:
$toolList

请以JSON格式回复你的决策：
```json
{
  "type": "TOOL 或 FINAL",
  "reason": "决策理由",
  "toolName": "工具名(仅TOOL类型)",
  "arguments": {},
  "answer": "最终答案(仅FINAL类型)"
}
```"""
    }

    private fun buildReviewPrompt(context: ReviewContext): String {
        return """你是一个智能助手的审查模块。审查最新操作结果，决定是否继续。

目标: ${context.goal.task}
最新操作: ${context.currentDecision.toolName} - ${context.currentDecision.reason}
结果: ${context.latestObservation?.rawOutput?.take(500) ?: "无结果"}

请以JSON格式回复：
```json
{
  "action": "FINAL 或 REASON 或 RETRY",
  "reason": "审查理由",
  "answer": "如果FINAL，提供最终答案"
}
```"""
    }

    private fun buildFinalAnswerPrompt(context: FinalAnswerContext): String {
        val obsHistory = context.observations.joinToString("\n") { obs ->
            "[${obs.toolName}] ${obs.rawOutput.take(300)}"
        }
        return """根据以下信息为用户生成最终答案。

用户请求: ${context.goal.rawGoal}
${if (context.hint != null) "提示: ${context.hint}" else ""}

收集到的信息:
$obsHistory

请用自然语言回复用户的请求。"""
    }

    // --- Response parsers ---

    private fun parseStructuredGoal(raw: String, userGoal: String): StructuredGoal {
        return try {
            val json = extractJson(raw)
            StructuredGoal(
                rawGoal = userGoal,
                task = json.get("task")?.asString ?: userGoal,
                successCriteria = json.get("successCriteria")?.asString ?: "",
                requiredInformation = json.getAsJsonArray("requiredInformation")
                    ?.map { it.asString } ?: emptyList(),
                constraints = json.getAsJsonArray("constraints")
                    ?.map { it.asString } ?: emptyList()
            )
        } catch (_: Exception) {
            StructuredGoal(rawGoal = userGoal, task = userGoal, successCriteria = "")
        }
    }

    private fun parseDecision(raw: String): AgentDecision {
        return try {
            val json = extractJson(raw)
            val type = if (json.get("type")?.asString == "FINAL") DecisionType.FINAL else DecisionType.TOOL
            AgentDecision(
                type = type,
                reason = json.get("reason")?.asString ?: "",
                toolName = json.get("toolName")?.asString,
                arguments = json.getAsJsonObject("arguments")?.entrySet()
                    ?.associate { it.key to parseJsonValue(it.value) } ?: emptyMap(),
                answer = json.get("answer")?.asString
            )
        } catch (_: Exception) {
            AgentDecision(type = DecisionType.FINAL, reason = "Parse error", answer = raw)
        }
    }

    private fun parseReviewDecision(raw: String, currentDecision: AgentDecision): ReviewDecision {
        return try {
            val json = extractJson(raw)
            val action = when (json.get("action")?.asString) {
                "FINAL" -> ReviewAction.FINAL
                "RETRY" -> ReviewAction.RETRY
                else -> ReviewAction.REASON
            }
            ReviewDecision(
                action = action,
                reason = json.get("reason")?.asString ?: "",
                answer = json.get("answer")?.asString
            )
        } catch (_: Exception) {
            ReviewDecision(action = ReviewAction.FINAL, reason = "Parse error", answer = raw)
        }
    }

    private fun extractJson(raw: String): JsonObject {
        val jsonMatch = Regex("```(?:json)?\\s*\\n?(.+?)\\n?```", RegexOption.DOT_MATCHES_ALL)
            .find(raw)
        val jsonStr = jsonMatch?.groupValues?.get(1)?.trim() ?: raw.trim()
        return JsonParser.parseString(jsonStr).asJsonObject
    }

    private fun parseJsonValue(element: com.google.gson.JsonElement): Any? {
        return when {
            element.isJsonNull -> null
            element.isJsonPrimitive -> {
                val p = element.asJsonPrimitive
                when {
                    p.isBoolean -> p.asBoolean
                    p.isNumber -> p.asNumber
                    else -> p.asString
                }
            }
            else -> element.toString()
        }
    }
}
