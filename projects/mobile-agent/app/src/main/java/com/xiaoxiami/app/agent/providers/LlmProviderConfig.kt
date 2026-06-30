package com.xiaoxiami.app.agent.providers

/**
 * Multi-provider LLM configuration.
 * Ported from desktop-claw's multi-provider support (Anthropic/OpenAI/Google).
 */

enum class LlmProviderType {
    GEMINI,
    DASHSCOPE,
    ANTHROPIC,
    OPENAI,
    OPENAI_COMPATIBLE
}

data class LlmProviderConfig(
    val type: LlmProviderType,
    val apiKey: String,
    val baseUrl: String = "",
    val modelId: String = "",
    val displayName: String = ""
) {
    companion object {
        fun getDefaultModelId(type: LlmProviderType): String = when (type) {
            LlmProviderType.GEMINI -> "gemini-2.0-flash"
            LlmProviderType.DASHSCOPE -> "qwen-turbo"
            LlmProviderType.ANTHROPIC -> "claude-sonnet-4-20250514"
            LlmProviderType.OPENAI -> "gpt-4o"
            LlmProviderType.OPENAI_COMPATIBLE -> "gpt-4o"
        }

        fun getDefaultBaseUrl(type: LlmProviderType): String = when (type) {
            LlmProviderType.GEMINI -> ""
            LlmProviderType.DASHSCOPE -> ""
            LlmProviderType.ANTHROPIC -> "https://api.anthropic.com"
            LlmProviderType.OPENAI -> "https://api.openai.com"
            LlmProviderType.OPENAI_COMPATIBLE -> ""
        }
    }
}
