package com.xiaoxiami.app.agent.tools

import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import com.itextpdf.kernel.pdf.PdfDocument
import com.itextpdf.kernel.pdf.PdfReader
import com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor
import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolContentRisk
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolScope
import com.xiaoxiami.app.agent.ToolValueType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class PdfReadTool(
    private val context: android.content.Context
) : Tool {
    override val schema = ToolSchema(
        name = "pdf_read",
        description = "Read a PDF file from a content URI and extract plain text page by page.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("document", "pdf", "file_read"),
        scopes = listOf(ToolScope.DOCUMENT, ToolScope.FILE_SYSTEM),
        contentRisks = listOf(ToolContentRisk.SENSITIVE_PERSONAL_DATA),
        inputSchema = listOf(
            ToolParameterSchema("uri", ToolValueType.STRING, "Content URI of the PDF file.", required = true),
            ToolParameterSchema("maxPages", ToolValueType.INTEGER, "Maximum number of pages to read.", required = false),
            ToolParameterSchema("maxChars", ToolValueType.INTEGER, "Maximum number of characters to return.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("pageCount", ToolValueType.INTEGER, "Total PDF page count."),
            ToolFieldSchema("extractedText", ToolValueType.STRING, "Extracted PDF text.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult = withContext(Dispatchers.IO) {
        val uriValue = arguments.stringArg("uri")
        if (uriValue.isBlank()) {
            return@withContext ToolResult(false, "", "uri 不能为空")
        }

        try {
            val uri = Uri.parse(uriValue)
            val maxPages = arguments.intArg("maxPages", 10).coerceIn(1, 50)
            val maxChars = arguments.intArg("maxChars", 12_000).coerceIn(1_000, 50_000)
            val displayName = resolveDisplayName(this@PdfReadTool.context, uri)
            val fileSize = resolveFileSize(this@PdfReadTool.context, uri)

            openInputStream(this@PdfReadTool.context, uri).use { inputStream ->
                requireNotNull(inputStream) { "无法打开 PDF 文件" }
                PdfDocument(PdfReader(inputStream)).use { pdfDocument ->
                    val pageCount = pdfDocument.numberOfPages
                    val readPages = minOf(pageCount, maxPages)
                    val builder = StringBuilder()

                    for (pageIndex in 1..readPages) {
                        val text = PdfTextExtractor.getTextFromPage(pdfDocument.getPage(pageIndex)).trim()
                        if (text.isNotBlank()) {
                            builder.append("[Page ").append(pageIndex).append("]\n")
                            builder.append(text).append("\n\n")
                        }
                        if (builder.length >= maxChars) break
                    }

                    val extractedText = builder.toString().trim().ifBlank { "PDF 中未提取到可读文本。" }
                    val (truncatedText, truncated) = truncateForTool(extractedText, maxChars)
                    val wasTruncated = truncated || pageCount > readPages
                    ToolResult(
                        success = true,
                        output = jsonOutput(
                            mapOf(
                                "uri" to uriValue,
                                "displayName" to displayName,
                                "sizeBytes" to fileSize,
                                "pageCount" to pageCount,
                                "readPages" to readPages,
                                "truncated" to wasTruncated,
                                "extractedText" to truncatedText
                            )
                        )
                    )
                }
            }
        } catch (e: Exception) {
            ToolResult(false, "", e.message ?: "pdf_read failed")
        }
    }
}

class ImageInfoTool(
    private val context: android.content.Context
) : Tool {
    override val schema = ToolSchema(
        name = "image_info",
        description = "Read image metadata such as size, dimensions, mime type, and optional base64 preview.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("image", "metadata", "file_read"),
        scopes = listOf(ToolScope.DOCUMENT, ToolScope.FILE_SYSTEM, ToolScope.SCREEN),
        contentRisks = listOf(ToolContentRisk.SENSITIVE_PERSONAL_DATA),
        inputSchema = listOf(
            ToolParameterSchema("uri", ToolValueType.STRING, "Optional image URI. Falls back to the first attached image.", required = false),
            ToolParameterSchema("includeBase64", ToolValueType.BOOLEAN, "Whether to include a base64 payload for small images.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("mimeType", ToolValueType.STRING, "Resolved image MIME type."),
            ToolFieldSchema("width", ToolValueType.INTEGER, "Image width in pixels.", required = false),
            ToolFieldSchema("height", ToolValueType.INTEGER, "Image height in pixels.", required = false)
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult = withContext(Dispatchers.IO) {
        val targetUri = arguments.stringArg("uri").ifBlank {
            context.imageUris.firstOrNull()?.toString().orEmpty()
        }
        if (targetUri.isBlank()) {
            return@withContext ToolResult(false, "", "没有可用的图片 URI")
        }

        try {
            val uri = Uri.parse(targetUri)
            val mimeType = resolveMimeType(this@ImageInfoTool.context, uri)
            val sizeBytes = resolveFileSize(this@ImageInfoTool.context, uri)
            val displayName = resolveDisplayName(this@ImageInfoTool.context, uri)
            val options = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            openInputStream(this@ImageInfoTool.context, uri).use { input ->
                requireNotNull(input) { "无法读取图片" }
                BitmapFactory.decodeStream(input, null, options)
            }

            val includeBase64 = arguments.booleanArg("includeBase64", false)
            val base64 = if (includeBase64) {
                val bytes = readUriBytes(this@ImageInfoTool.context, uri)
                if (bytes.size <= 256 * 1024) {
                    Base64.encodeToString(bytes, Base64.NO_WRAP)
                } else {
                    null
                }
            } else {
                null
            }

            ToolResult(
                success = true,
                output = jsonOutput(
                    mapOf(
                        "uri" to targetUri,
                        "displayName" to displayName,
                        "mimeType" to mimeType,
                        "sizeBytes" to sizeBytes,
                        "width" to if (options.outWidth > 0) options.outWidth else null,
                        "height" to if (options.outHeight > 0) options.outHeight else null,
                        "base64" to base64,
                        "base64Included" to (base64 != null)
                    )
                )
            )
        } catch (e: Exception) {
            ToolResult(false, "", e.message ?: "image_info failed")
        }
    }
}
