package com.xiaoxiami.app.agent.tools

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolInteractionKind
import com.xiaoxiami.app.agent.ToolInteractionRequest
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolValueType
import java.io.File

class SearchLocalMediaTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "search_local_media",
        description = "Search local images, videos, or audio files from MediaStore.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("media", "search", "read"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        accessRequirements = listOf(
            ToolAccessRequirement(ToolAccessKind.ANDROID_PERMISSION, android.Manifest.permission.READ_MEDIA_IMAGES, "Read local images.", required = false),
            ToolAccessRequirement(ToolAccessKind.ANDROID_PERMISSION, android.Manifest.permission.READ_MEDIA_VIDEO, "Read local videos.", required = false),
            ToolAccessRequirement(ToolAccessKind.ANDROID_PERMISSION, android.Manifest.permission.READ_MEDIA_AUDIO, "Read local audio.", required = false)
        ),
        inputSchema = listOf(
            ToolParameterSchema("type", ToolValueType.STRING, "image, video, audio, or all.", required = true),
            ToolParameterSchema("query", ToolValueType.STRING, "Optional display name keyword.", required = false),
            ToolParameterSchema("fromTime", ToolValueType.NUMBER, "Optional lower time bound in epoch milliseconds.", required = false),
            ToolParameterSchema("toTime", ToolValueType.NUMBER, "Optional upper time bound in epoch milliseconds.", required = false),
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum results to return.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("items", ToolValueType.ARRAY, "Matched media items.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val type = arguments.stringArg("type", "all").lowercase()
        val query = arguments.stringArg("query").lowercase()
        val fromTime = arguments.longArg("fromTime")
        val toTime = arguments.longArg("toTime")
        val limit = arguments.intArg("limit", 20).coerceIn(1, 100)
        val items = mutableListOf<Map<String, Any?>>()
        val targets = when (type) {
            "image" -> listOf(MediaStore.Images.Media.EXTERNAL_CONTENT_URI to "image")
            "video" -> listOf(MediaStore.Video.Media.EXTERNAL_CONTENT_URI to "video")
            "audio" -> listOf(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI to "audio")
            else -> listOf(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI to "image",
                MediaStore.Video.Media.EXTERNAL_CONTENT_URI to "video",
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI to "audio"
            )
        }
        targets.forEach { (uri, kind) ->
            this.context.contentResolver.query(
                uri,
                arrayOf(
                    MediaStore.MediaColumns._ID,
                    MediaStore.MediaColumns.DISPLAY_NAME,
                    MediaStore.MediaColumns.MIME_TYPE,
                    MediaStore.MediaColumns.DATE_ADDED,
                    MediaStore.MediaColumns.SIZE
                ),
                null,
                null,
                "${MediaStore.MediaColumns.DATE_ADDED} DESC"
            )?.use { cursor ->
                while (cursor.moveToNext() && items.size < limit) {
                    val id = cursor.getLong(0)
                    val displayName = cursor.getString(1).orEmpty()
                    val mimeType = cursor.getString(2).orEmpty()
                    val createdAtMs = cursor.getLong(3) * 1000
                    val size = cursor.getLong(4)
                    if (query.isNotBlank() && !displayName.lowercase().contains(query)) continue
                    if (fromTime > 0 && createdAtMs < fromTime) continue
                    if (toTime > 0 && createdAtMs > toTime) continue
                    val contentUri = Uri.withAppendedPath(uri, id.toString())
                    items += mapOf(
                        "uri" to contentUri.toString(),
                        "kind" to kind,
                        "mimeType" to mimeType,
                        "displayName" to displayName,
                        "createdAt" to createdAtMs,
                        "size" to size
                    )
                }
            }
        }
        return ToolResult(true, jsonOutput(mapOf("items" to items)))
    }
}

class PickImagesTool : Tool {
    override val schema = ToolSchema(
        name = "pick_images",
        description = "Ask the user to select one or more images from the system picker.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("media", "picker", "user_mediated"),
        inputSchema = listOf(
            ToolParameterSchema("maxCount", ToolValueType.INTEGER, "Maximum image count.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("items", ToolValueType.ARRAY, "Selected image items.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val maxCount = arguments.intArg("maxCount", 3).coerceIn(1, 20)
        val result = context.interactionHandler(
            ToolInteractionRequest(
                requestId = "pick_images_${System.currentTimeMillis()}",
                toolName = name,
                kind = ToolInteractionKind.PICK_IMAGES,
                title = "选择图片",
                description = "请选择最多 $maxCount 张图片供 Agent 使用。",
                payload = mapOf("maxCount" to maxCount)
            )
        )
        if (!result.success) return ToolResult(false, "", result.error ?: "选择图片失败")
        return ToolResult(true, jsonOutput(mapOf("items" to (result.data["items"] ?: emptyList<Map<String, Any?>>()))))
    }
}

class PickFilesTool : Tool {
    override val schema = ToolSchema(
        name = "pick_files",
        description = "Ask the user to select files from the system document picker.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("file", "picker", "user_mediated"),
        inputSchema = listOf(
            ToolParameterSchema("mimeTypes", ToolValueType.ARRAY, "Optional MIME type filters.", required = false, itemType = ToolValueType.STRING),
            ToolParameterSchema("multiple", ToolValueType.BOOLEAN, "Whether multiple file selection is allowed.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("items", ToolValueType.ARRAY, "Selected file items.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val multiple = arguments.booleanArg("multiple", true)
        val mimeTypes = arguments.stringListArg("mimeTypes")
        val result = context.interactionHandler(
            ToolInteractionRequest(
                requestId = "pick_files_${System.currentTimeMillis()}",
                toolName = name,
                kind = ToolInteractionKind.PICK_FILES,
                title = "选择文件",
                description = "请选择${if (multiple) "一个或多个" else "一个"}文件供 Agent 使用。",
                payload = mapOf("multiple" to multiple, "mimeTypes" to mimeTypes)
            )
        )
        if (!result.success) return ToolResult(false, "", result.error ?: "选择文件失败")
        return ToolResult(true, jsonOutput(mapOf("items" to (result.data["items"] ?: emptyList<Map<String, Any?>>()))))
    }
}

class ReadClipboardTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "read_clipboard",
        description = "Read the current clipboard plain text.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("clipboard", "read"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        outputSchema = listOf(
            ToolFieldSchema("text", ToolValueType.STRING, "Clipboard text if present.", required = false),
            ToolFieldSchema("hasContent", ToolValueType.BOOLEAN, "Whether clipboard contains readable text.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val clipboard = this.context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            ?: return ToolResult(false, "", "无法获取 ClipboardManager")
        val clip = clipboard.primaryClip
        val text = clip?.getItemAt(0)?.coerceToText(this.context)?.toString().orEmpty()
        return ToolResult(true, jsonOutput(mapOf("text" to text, "hasContent" to text.isNotBlank())))
    }
}

class WriteClipboardTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "write_clipboard",
        description = "Write plain text to the clipboard.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("clipboard", "write"),
        inputSchema = listOf(
            ToolParameterSchema("text", ToolValueType.STRING, "Clipboard text.", required = true),
            ToolParameterSchema("label", ToolValueType.STRING, "Optional clip label.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val text = arguments.stringArg("text")
        if (text.isBlank()) return ToolResult(false, "", "text 不能为空")
        val label = arguments.stringArg("label", "xiaoxiami")
        val clipboard = this.context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            ?: return ToolResult(false, "", "无法获取 ClipboardManager")
        clipboard.setPrimaryClip(ClipData.newPlainText(label, text))
        return ToolResult(true, jsonOutput(mapOf("success" to true, "label" to label)))
    }
}

class SaveFileToDownloadsTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "save_file_to_downloads",
        description = "Save text or an existing file URI into the Downloads directory.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("file", "downloads", "write"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        inputSchema = listOf(
            ToolParameterSchema("displayName", ToolValueType.STRING, "Output file name.", required = true),
            ToolParameterSchema("mimeType", ToolValueType.STRING, "Output MIME type.", required = true),
            ToolParameterSchema("text", ToolValueType.STRING, "Optional text content.", required = false),
            ToolParameterSchema("sourceUri", ToolValueType.STRING, "Optional source file URI to copy.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("uri", ToolValueType.STRING, "Saved file URI."),
            ToolFieldSchema("saved", ToolValueType.BOOLEAN, "Whether save succeeded.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val displayName = arguments.stringArg("displayName")
        val mimeType = arguments.stringArg("mimeType")
        val text = arguments.stringArg("text")
        val sourceUri = arguments.stringArg("sourceUri")
        if (displayName.isBlank() || mimeType.isBlank()) return ToolResult(false, "", "displayName/mimeType 不能为空")
        val resultUri = when {
            text.isNotBlank() -> writeTextToDownloads(this.context, displayName, mimeType, text)
            sourceUri.isNotBlank() -> copyUriToDownloads(this.context, Uri.parse(sourceUri), displayName, mimeType)
            else -> null
        } ?: return ToolResult(false, "", "没有可保存的内容")
        return ToolResult(true, jsonOutput(mapOf("uri" to resultUri.toString(), "saved" to true)))
    }
}

class CameraCaptureTool : Tool {
    override val schema = ToolSchema(
        name = "camera_capture",
        description = "Ask the user to take a photo with the camera and return the captured image URI.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("camera", "capture", "user_mediated"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        inputSchema = listOf(
            ToolParameterSchema("purpose", ToolValueType.STRING, "Optional reason shown to the user.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("imageUri", ToolValueType.STRING, "Captured image URI."),
            ToolFieldSchema("capturedAt", ToolValueType.NUMBER, "Capture timestamp.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val purpose = arguments.stringArg("purpose", "请拍摄一张图片供 Agent 使用")
        val result = context.interactionHandler(
            ToolInteractionRequest(
                requestId = "take_photo_${System.currentTimeMillis()}",
                toolName = name,
                kind = ToolInteractionKind.TAKE_PHOTO,
                title = "拍照",
                description = purpose
            )
        )
        if (!result.success) return ToolResult(false, "", result.error ?: "拍照失败")
        return ToolResult(true, jsonOutput(result.data))
    }
}

// REMOVED: RecordAudioTool and TranscribeAudioTool (visual/auditory memory features)
