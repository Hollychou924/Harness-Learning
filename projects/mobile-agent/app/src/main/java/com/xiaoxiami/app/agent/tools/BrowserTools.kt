package com.xiaoxiami.app.agent.tools

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolContentRisk
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolExecutionMode
import com.xiaoxiami.app.agent.ToolFamily
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolScope
import com.xiaoxiami.app.agent.ToolValueType
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Request

class BrowserOpenTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "browser_open",
        family = ToolFamily.BROWSER,
        description = "Open a web page in the system browser as a browser execution step.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        executionMode = ToolExecutionMode.DIRECT,
        capabilities = listOf("browser", "open_url"),
        riskLevel = ToolRiskLevel.LOW,
        scopes = listOf(ToolScope.BROWSER, ToolScope.NETWORK),
        accessRequirements = listOf(
            ToolAccessRequirement(
                kind = ToolAccessKind.NETWORK,
                identifier = "public_http",
                description = "需要访问公开网页地址"
            )
        ),
        inputSchema = listOf(
            ToolParameterSchema("url", ToolValueType.STRING, "Public http/https URL to open.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val url = runCatching {
            validatePublicNetworkUrl(arguments.stringArg("url"))
        }.getOrElse {
            return ToolResult(false, "", it.message ?: "url 不合法")
        }
        val launched = launchIntent(
            this.context,
            Intent(Intent.ACTION_VIEW, Uri.parse(url))
        )
        return ToolResult(
            success = launched,
            output = jsonOutput(
                mapOf(
                    "success" to launched,
                    "message" to if (launched) "已打开浏览器页面" else "没有可处理该链接的浏览器"
                )
            ),
            error = if (launched) null else "无法打开浏览器"
        )
    }
}

class BrowserExtractTool : Tool {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    override val schema = ToolSchema(
        name = "browser_extract",
        family = ToolFamily.BROWSER,
        description = "Fetch a public web page and extract the title plus cleaned readable text.",
        hostKind = ToolHostKind.CLOUD_SERVICE,
        executionMode = ToolExecutionMode.DIRECT,
        capabilities = listOf("browser", "extract_content", "read_webpage"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        scopes = listOf(ToolScope.BROWSER, ToolScope.NETWORK, ToolScope.KNOWLEDGE),
        contentRisks = listOf(ToolContentRisk.UNTRUSTED_NETWORK_CONTENT),
        accessRequirements = listOf(
            ToolAccessRequirement(
                kind = ToolAccessKind.NETWORK,
                identifier = "public_http",
                description = "需要访问公开网页地址"
            )
        ),
        inputSchema = listOf(
            ToolParameterSchema("url", ToolValueType.STRING, "Public http/https URL to fetch.", required = true),
            ToolParameterSchema("maxChars", ToolValueType.INTEGER, "Maximum output text length.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("url", ToolValueType.STRING, "Fetched URL."),
            ToolFieldSchema("title", ToolValueType.STRING, "HTML title or best-effort heading.", required = false),
            ToolFieldSchema("text", ToolValueType.STRING, "Readable cleaned text."),
            ToolFieldSchema("truncated", ToolValueType.BOOLEAN, "Whether text was truncated.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val url = runCatching {
            validatePublicNetworkUrl(arguments.stringArg("url"))
        }.getOrElse {
            return ToolResult(false, "", it.message ?: "url 不合法")
        }
        val maxChars = arguments.intArg("maxChars", 6000).coerceIn(500, 20_000)
        val response = runCatching {
            client.newCall(
                Request.Builder()
                    .url(url)
                    .header(
                        "User-Agent",
                        "Mozilla/5.0 (Linux; Android 14) XiaoxiamiAgent/1.0"
                    )
                    .build()
            ).execute()
        }.getOrElse {
            return ToolResult(false, "", it.message ?: "网页请求失败")
        }
        response.use { http ->
            if (!http.isSuccessful) {
                return ToolResult(false, "", "网页请求失败: HTTP ${http.code}")
            }
            val html = http.body?.string().orEmpty()
            if (html.isBlank()) {
                return ToolResult(false, "", "网页内容为空")
            }
            val title = extractHtmlTitle(html)
            val plain = htmlToPlainText(html)
            val (truncatedText, truncated) = truncateForTool(plain, maxChars)
            return ToolResult(
                success = true,
                output = jsonOutput(
                    mapOf(
                        "url" to url,
                        "title" to title,
                        "text" to truncatedText,
                        "truncated" to truncated
                    )
                )
            )
        }
    }

    private fun extractHtmlTitle(html: String): String {
        val regex = Regex("(?is)<title[^>]*>(.*?)</title>")
        return regex.find(html)?.groupValues?.getOrNull(1)
            ?.replace(Regex("\\s+"), " ")
            ?.trim()
            .orEmpty()
    }
}
