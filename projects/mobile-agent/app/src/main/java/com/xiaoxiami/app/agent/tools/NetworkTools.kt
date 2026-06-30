package com.xiaoxiami.app.agent.tools

import com.google.gson.Gson
import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolApprovalRequirement
import com.xiaoxiami.app.agent.ToolContentRisk
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolScope
import com.xiaoxiami.app.agent.ToolValueType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

private val networkToolGson = Gson()

class HttpRequestTool : Tool {
    override val schema = ToolSchema(
        name = "http_request",
        description = "Send an HTTP request to a public URL. Best for structured APIs or precise endpoint responses.",
        hostKind = ToolHostKind.CLOUD_SERVICE,
        capabilities = listOf("network", "http", "api"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        scopes = listOf(ToolScope.NETWORK),
        contentRisks = listOf(ToolContentRisk.UNTRUSTED_NETWORK_CONTENT),
        inputSchema = listOf(
            ToolParameterSchema("url", ToolValueType.STRING, "Public http or https URL.", required = true),
            ToolParameterSchema("method", ToolValueType.STRING, "HTTP method.", required = false, enumValues = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD")),
            ToolParameterSchema("headers", ToolValueType.OBJECT, "Optional request headers.", required = false),
            ToolParameterSchema("body", ToolValueType.OBJECT, "Optional request body. String, object, or array are all accepted.", required = false),
            ToolParameterSchema("contentType", ToolValueType.STRING, "Optional request content type. Defaults to application/json when body is object/array.", required = false),
            ToolParameterSchema("timeoutSeconds", ToolValueType.INTEGER, "Optional timeout from 5 to 60 seconds.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("status", ToolValueType.INTEGER, "HTTP status code."),
            ToolFieldSchema("ok", ToolValueType.BOOLEAN, "Whether the status is 2xx."),
            ToolFieldSchema("body", ToolValueType.STRING, "Response body text or a binary placeholder.")
        )
    )

    override fun getApprovalRequirement(
        arguments: Map<String, Any?>,
        context: ToolContext
    ): ToolApprovalRequirement {
        val method = arguments.stringArg("method", "GET").uppercase()
        val mutating = method !in setOf("GET", "HEAD")
        return ToolApprovalRequirement(
            required = mutating,
            riskLevel = if (mutating) ToolRiskLevel.HIGH else ToolRiskLevel.SENSITIVE,
            reason = if (mutating) {
                "非 GET/HEAD 请求可能修改外部系统状态。"
            } else {
                ""
            },
            summary = if (mutating) "Agent 请求调用外部 HTTP 接口" else ""
        )
    }

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult = withContext(Dispatchers.IO) {
        try {
            val url = validatePublicNetworkUrl(arguments.stringArg("url"))
            val method = arguments.stringArg("method", "GET").uppercase()
            val timeoutSeconds = arguments.intArg("timeoutSeconds", 20).coerceIn(5, 60).toLong()
            val headers = arguments.mapArg("headers").mapValues { it.value?.toString().orEmpty() }
            val requestBuilder = Request.Builder().url(url)

            headers.forEach { (key, value) ->
                if (key.isNotBlank() && value.isNotBlank()) {
                    requestBuilder.addHeader(key, value)
                }
            }

            val requestBody = buildRequestBody(arguments["body"], arguments.stringArg("contentType"))
            when (method) {
                "GET" -> requestBuilder.get()
                "HEAD" -> requestBuilder.head()
                "POST" -> requestBuilder.post(requestBody ?: "".toRequestBody("text/plain".toMediaType()))
                "PUT" -> requestBuilder.put(requestBody ?: "".toRequestBody("text/plain".toMediaType()))
                "PATCH" -> requestBuilder.patch(requestBody ?: "".toRequestBody("text/plain".toMediaType()))
                "DELETE" -> if (requestBody != null) requestBuilder.delete(requestBody) else requestBuilder.delete()
                else -> return@withContext ToolResult(false, "", "不支持的 HTTP method: $method")
            }

            val client = OkHttpClient.Builder()
                .connectTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .writeTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .build()

            client.newCall(requestBuilder.build()).execute().use { response ->
                val contentType = response.body?.contentType()?.toString()
                val rawBody = when {
                    response.body == null -> ""
                    isTextLikeMimeType(contentType) -> response.body!!.string()
                    else -> "<<binary response omitted>>"
                }
                val (body, truncated) = truncateForTool(rawBody, 8_000)
                ToolResult(
                    success = true,
                    output = jsonOutput(
                        mapOf(
                            "status" to response.code,
                            "ok" to response.isSuccessful,
                            "contentType" to contentType,
                            "url" to response.request.url.toString(),
                            "truncated" to truncated,
                            "body" to body
                        )
                    )
                )
            }
        } catch (e: Exception) {
            ToolResult(false, "", e.message ?: "http_request failed")
        }
    }
}

class WebFetchTool : Tool {
    override val schema = ToolSchema(
        name = "web_fetch",
        description = "Fetch a public web page and convert it into concise plain text for the agent.",
        hostKind = ToolHostKind.CLOUD_SERVICE,
        capabilities = listOf("network", "web", "fetch"),
        scopes = listOf(ToolScope.NETWORK, ToolScope.KNOWLEDGE),
        contentRisks = listOf(ToolContentRisk.UNTRUSTED_NETWORK_CONTENT),
        inputSchema = listOf(
            ToolParameterSchema("url", ToolValueType.STRING, "Public http or https URL.", required = true),
            ToolParameterSchema("timeoutSeconds", ToolValueType.INTEGER, "Optional timeout from 5 to 60 seconds.", required = false),
            ToolParameterSchema("maxChars", ToolValueType.INTEGER, "Maximum returned text length.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("title", ToolValueType.STRING, "Page title when available.", required = false),
            ToolFieldSchema("content", ToolValueType.STRING, "Fetched plain text content.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult = withContext(Dispatchers.IO) {
        try {
            val url = validatePublicNetworkUrl(arguments.stringArg("url"))
            val timeoutSeconds = arguments.intArg("timeoutSeconds", 20).coerceIn(5, 60).toLong()
            val maxChars = arguments.intArg("maxChars", 10_000).coerceIn(1_000, 30_000)
            val client = OkHttpClient.Builder()
                .connectTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .build()

            val request = Request.Builder()
                .url(url)
                .get()
                .header("User-Agent", "XiaoxiamiAgent/1.0")
                .build()

            client.newCall(request).execute().use { response ->
                val contentType = response.body?.contentType()?.toString()
                val rawBody = if (response.body != null && isTextLikeMimeType(contentType)) {
                    response.body!!.string()
                } else {
                    "<<non-text response omitted>>"
                }
                val title = extractHtmlTitle(rawBody)
                val content = if (contentType?.contains("html", ignoreCase = true) == true) {
                    htmlToPlainText(rawBody)
                } else {
                    rawBody.trim()
                }
                val (truncatedContent, truncated) = truncateForTool(content, maxChars)
                ToolResult(
                    success = true,
                    output = jsonOutput(
                        mapOf(
                            "status" to response.code,
                            "ok" to response.isSuccessful,
                            "url" to response.request.url.toString(),
                            "contentType" to contentType,
                            "title" to title,
                            "truncated" to truncated,
                            "content" to truncatedContent
                        )
                    )
                )
            }
        } catch (e: Exception) {
            ToolResult(false, "", e.message ?: "web_fetch failed")
        }
    }
}

private fun buildRequestBody(rawBody: Any?, explicitContentType: String): okhttp3.RequestBody? {
    if (rawBody == null) return null
    val contentType = explicitContentType.ifBlank {
        if (rawBody is String) "text/plain; charset=utf-8" else "application/json; charset=utf-8"
    }
    val bodyText = when (rawBody) {
        is String -> rawBody
        else -> networkToolGson.toJson(rawBody)
    }
    return bodyText.toRequestBody(contentType.toMediaType())
}

private fun extractHtmlTitle(rawHtml: String): String? {
    val match = Regex("(?is)<title[^>]*>(.*?)</title>").find(rawHtml) ?: return null
    return htmlToPlainText(match.groupValues[1]).ifBlank { null }
}
