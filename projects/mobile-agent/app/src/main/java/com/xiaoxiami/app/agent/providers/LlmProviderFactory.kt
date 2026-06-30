package com.xiaoxiami.app.agent.providers

import com.xiaoxiami.app.agent.LlmAdapter
import com.xiaoxiami.app.agent.GeminiLlmAdapter
import com.xiaoxiami.app.repository.GeminiRepository

/**
 * Factory for creating LLM adapters based on provider configuration.
 * Ported from desktop-claw's multi-provider support.
 *
 * Supports:
 * - Gemini (existing, via GeminiRepository)
 * - DashScope/Qwen (existing, via GeminiRepository proxy)
 * - Anthropic Claude (new, via Messages API)
 * - OpenAI (new, via Chat Completions API)
 * - OpenAI-compatible (new, for custom endpoints)
 */
object LlmProviderFactory {

    fun createAdapter(
        config: LlmProviderConfig,
        geminiRepository: GeminiRepository? = null
    ): LlmAdapter {
        return when (config.type) {
            LlmProviderType.GEMINI -> {
                requireNotNull(geminiRepository) { "GeminiRepository required for Gemini provider" }
                GeminiLlmAdapter(geminiRepository)
            }

            LlmProviderType.DASHSCOPE -> {
                requireNotNull(geminiRepository) { "GeminiRepository required for DashScope provider" }
                GeminiLlmAdapter(geminiRepository)
            }

            LlmProviderType.ANTHROPIC -> {
                OpenAICompatibleAdapter(config)
            }

            LlmProviderType.OPENAI -> {
                OpenAICompatibleAdapter(config)
            }

            LlmProviderType.OPENAI_COMPATIBLE -> {
                OpenAICompatibleAdapter(config)
            }
        }
    }

    /** Get available provider types with display info. */
    fun getAvailableProviders(): List<ProviderInfo> {
        return listOf(
            ProviderInfo(
                type = LlmProviderType.GEMINI,
                displayName = "Google Gemini",
                description = "Gemini 2.0 Flash / Pro via Google AI SDK",
                requiresApiKey = true,
                apiKeyLabel = "Gemini API Key"
            ),
            ProviderInfo(
                type = LlmProviderType.DASHSCOPE,
                displayName = "DashScope (通义千问)",
                description = "Qwen/通义千问 via Alibaba DashScope",
                requiresApiKey = true,
                apiKeyLabel = "DashScope API Key"
            ),
            ProviderInfo(
                type = LlmProviderType.ANTHROPIC,
                displayName = "Anthropic Claude",
                description = "Claude Opus/Sonnet/Haiku via Anthropic API",
                requiresApiKey = true,
                apiKeyLabel = "Anthropic API Key"
            ),
            ProviderInfo(
                type = LlmProviderType.OPENAI,
                displayName = "OpenAI",
                description = "GPT-4o/GPT-4 via OpenAI API",
                requiresApiKey = true,
                apiKeyLabel = "OpenAI API Key"
            ),
            ProviderInfo(
                type = LlmProviderType.OPENAI_COMPATIBLE,
                displayName = "OpenAI Compatible",
                description = "Any OpenAI-compatible API endpoint",
                requiresApiKey = true,
                apiKeyLabel = "API Key",
                requiresBaseUrl = true,
                baseUrlLabel = "Base URL"
            )
        )
    }
}

data class ProviderInfo(
    val type: LlmProviderType,
    val displayName: String,
    val description: String,
    val requiresApiKey: Boolean = true,
    val apiKeyLabel: String = "API Key",
    val requiresBaseUrl: Boolean = false,
    val baseUrlLabel: String = "Base URL"
)
