package com.xiaoxiami.app.agent.tools

import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolValueType
import com.xiaoxiami.app.repository.GeminiRepository
import android.net.Uri

class AnalyzeImagesTool(
    private val geminiRepository: GeminiRepository
) : Tool {

    override val schema: ToolSchema = ToolSchema(
        name = "analyze_images",
        description = "Analyze the user-attached images and return objective visual observations relevant to the goal.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("vision", "multimodal", "image_understanding"),
        inputSchema = listOf(
            ToolParameterSchema(
                name = "query",
                type = ToolValueType.STRING,
                description = "Specific visual question or focus for the current images.",
                required = false
            ),
            ToolParameterSchema(
                name = "imageUris",
                type = ToolValueType.ARRAY,
                description = "Optional explicit image URI list. Falls back to user-attached images when omitted.",
                required = false,
                itemType = ToolValueType.STRING
            )
        ),
        outputSchema = listOf(
            ToolFieldSchema(
                name = "observation",
                type = ToolValueType.STRING,
                description = "Objective visual observation relevant to the current goal."
            )
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val targetUris = parseUriList(arguments["imageUris"]).ifEmpty { context.imageUris }
        if (targetUris.isEmpty()) {
            return ToolResult(
                success = false,
                output = "",
                error = "当前请求没有附带图片"
            )
        }

        val query = arguments["query"]?.toString()?.trim().orEmpty().ifBlank { context.userGoal }
        val prompt = """
            请分析用户上传的图片，并只输出与任务直接相关的客观观察结果。
            要求：
            1. 先描述图中能明确看到的事实。
            2. 不要编造图片中看不到的信息。
            3. 如果信息不足，明确指出缺失点。
            4. 输出简洁，适合作为 Agent 的 observation。

            当前任务：$query
        """.trimIndent()

        return try {
            val result = geminiRepository.generateContentWithImages(
                prompt = prompt,
                imageUris = targetUris,
                conversationHistory = context.conversationHistory,
                modelName = context.modelId,
                enableSearch = false,
                enableThinking = false,
                isConversation = false
            )
            ToolResult(
                success = true,
                output = result.trim()
            )
        } catch (e: Exception) {
            ToolResult(
                success = false,
                output = "",
                error = e.message ?: "analyze_images failed"
            )
        }
    }
}
