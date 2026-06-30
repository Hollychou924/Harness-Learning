package com.xiaoxiami.app.agent.tools

import android.content.ClipData
import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.MediaStore
import android.text.Html
import android.webkit.MimeTypeMap
import com.google.gson.Gson
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolValueType
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.net.URI
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale
import java.util.TimeZone

private val toolGson = Gson()

internal fun jsonOutput(value: Any?): String = toolGson.toJson(value)

internal fun successSchema() = listOf(
    ToolFieldSchema("success", ToolValueType.BOOLEAN, "Whether the action succeeded."),
    ToolFieldSchema("message", ToolValueType.STRING, "Human-readable execution message.", required = false)
)

internal fun Map<String, Any?>.stringArg(name: String, default: String = ""): String {
    return this[name]?.toString()?.trim().orEmpty().ifBlank { default }
}

internal fun Map<String, Any?>.intArg(name: String, default: Int = 0): Int {
    val value = this[name] ?: return default
    return when (value) {
        is Number -> value.toInt()
        is String -> value.toIntOrNull() ?: default
        else -> default
    }
}

internal fun Map<String, Any?>.longArg(name: String, default: Long = 0L): Long {
    val value = this[name] ?: return default
    return when (value) {
        is Number -> value.toLong()
        is String -> value.toLongOrNull() ?: parseIsoToEpochMs(value) ?: default
        else -> default
    }
}

internal fun parseIsoToEpochMs(text: String): Long? {
    val trimmed = text.trim()
    if (trimmed.isBlank()) return null
    return try {
        Instant.parse(trimmed).toEpochMilli()
    } catch (_: DateTimeParseException) {
        try {
            ZonedDateTime.parse(trimmed, DateTimeFormatter.ISO_DATE_TIME).toInstant().toEpochMilli()
        } catch (_: DateTimeParseException) {
            // Fallback: try common date-only formats like "2024-01-01"
            try {
                val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
                sdf.timeZone = TimeZone.getDefault()
                sdf.parse(trimmed)?.time
            } catch (_: Exception) {
                null
            }
        }
    }
}

internal fun Map<String, Any?>.booleanArg(name: String, default: Boolean = false): Boolean {
    val value = this[name] ?: return default
    return when (value) {
        is Boolean -> value
        is Number -> value.toInt() != 0
        is String -> value.equals("true", ignoreCase = true) || value == "1"
        else -> default
    }
}

internal fun Map<String, Any?>.stringListArg(name: String): List<String> {
    val value = this[name] ?: return emptyList()
    return when (value) {
        is List<*> -> value.mapNotNull { it?.toString()?.trim() }.filter { it.isNotBlank() }
        is Array<*> -> value.mapNotNull { it?.toString()?.trim() }.filter { it.isNotBlank() }
        is String -> value.split(",", "\n").map { it.trim() }.filter { it.isNotBlank() }
        else -> emptyList()
    }
}

internal fun Map<String, Any?>.longListArg(name: String): List<Long> {
    val value = this[name] ?: return emptyList()
    return when (value) {
        is List<*> -> value.mapNotNull { item ->
            when (item) {
                is Number -> item.toLong()
                is String -> item.trim().toLongOrNull() ?: parseIsoToEpochMs(item.trim())
                else -> null
            }
        }
        is Array<*> -> value.mapNotNull { item ->
            when (item) {
                is Number -> item.toLong()
                is String -> item.trim().toLongOrNull() ?: parseIsoToEpochMs(item.trim())
                else -> null
            }
        }
        is String -> value.split(",", "\n").mapNotNull { s ->
            val t = s.trim()
            t.toLongOrNull() ?: parseIsoToEpochMs(t)
        }
        else -> emptyList()
    }
}

internal fun anyToEpochMs(value: Any?, default: Long = 0L): Long {
    return when (value) {
        is Number -> value.toLong()
        is String -> value.trim().toLongOrNull() ?: parseIsoToEpochMs(value.trim()) ?: default
        else -> default
    }
}

@Suppress("UNCHECKED_CAST")
internal fun Map<String, Any?>.mapListArg(name: String): List<Map<String, Any?>> {
    val value = this[name] ?: return emptyList()
    return when (value) {
        is List<*> -> value.mapNotNull { it as? Map<String, Any?> }
        else -> emptyList()
    }
}

@Suppress("UNCHECKED_CAST")
internal fun Map<String, Any?>.mapArg(name: String): Map<String, Any?> {
    val value = this[name] ?: return emptyMap()
    return value as? Map<String, Any?> ?: emptyMap()
}

internal fun parseUriList(value: Any?): List<Uri> {
    return when (value) {
        is List<*> -> value.mapNotNull { it?.toString()?.trim() }.filter { it.isNotBlank() }.map(Uri::parse)
        is String -> value.split(",", "\n").map { it.trim() }.filter { it.isNotBlank() }.map(Uri::parse)
        else -> emptyList()
    }
}

internal fun validatePublicNetworkUrl(rawUrl: String, allowHttp: Boolean = true): String {
    val normalized = rawUrl.trim()
    require(normalized.isNotBlank()) { "url 不能为空" }

    val uri = URI(normalized)
    val scheme = uri.scheme?.lowercase(Locale.getDefault()).orEmpty()
    val host = uri.host?.lowercase(Locale.getDefault()).orEmpty()

    require(host.isNotBlank()) { "url 缺少有效 host" }
    require(
        scheme == "https" || (allowHttp && scheme == "http")
    ) { if (allowHttp) "仅支持 http/https" else "仅支持 https" }
    require(!isPrivateOrLocalHost(host)) { "不允许访问本地或内网地址：$host" }

    return normalized
}

private fun isPrivateOrLocalHost(host: String): Boolean {
    if (host == "localhost" || host == "127.0.0.1" || host == "::1") return true
    if (host.endsWith(".local")) return true
    if (host.startsWith("10.") || host.startsWith("192.168.")) return true
    if (host.startsWith("172.")) {
        val second = host.split(".").getOrNull(1)?.toIntOrNull()
        if (second != null && second in 16..31) return true
    }
    if (host.startsWith("169.254.")) return true
    return false
}

internal fun isTextLikeMimeType(mimeType: String?): Boolean {
    val normalized = mimeType?.lowercase(Locale.getDefault()).orEmpty()
    return normalized.startsWith("text/") ||
        normalized.contains("json") ||
        normalized.contains("xml") ||
        normalized.contains("javascript") ||
        normalized.contains("html") ||
        normalized.contains("x-www-form-urlencoded")
}

internal fun truncateForTool(text: String, maxChars: Int): Pair<String, Boolean> {
    if (text.length <= maxChars) return text to false
    return text.take(maxChars) to true
}

internal fun htmlToPlainText(html: String): String {
    val sanitized = html
        .replace(Regex("(?is)<script.*?>.*?</script>"), " ")
        .replace(Regex("(?is)<style.*?>.*?</style>"), " ")
    val plain = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        Html.fromHtml(sanitized, Html.FROM_HTML_MODE_LEGACY).toString()
    } else {
        @Suppress("DEPRECATION")
        Html.fromHtml(sanitized).toString()
    }
    return plain
        .replace(Regex("[\\t\\x0B\\f\\r ]+"), " ")
        .replace(Regex("\\n{3,}"), "\n\n")
        .trim()
}

internal fun launchIntent(context: Context, intent: Intent): Boolean {
    val safeIntent = intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return safeIntent.resolveActivity(context.packageManager)?.let {
        context.startActivity(safeIntent)
        true
    } ?: false
}

internal fun resolveDisplayName(context: Context, uri: Uri): String {
    if (uri.scheme == ContentResolver.SCHEME_FILE) {
        return uri.lastPathSegment ?: "unknown"
    }
    context.contentResolver.query(uri, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME), null, null, null)
        ?.use { cursor ->
            if (cursor.moveToFirst()) {
                val index = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME)
                if (index >= 0) {
                    return cursor.getString(index).orEmpty()
                }
            }
        }
    return uri.lastPathSegment ?: "unknown"
}

internal fun resolveMimeType(context: Context, uri: Uri): String {
    return context.contentResolver.getType(uri)
        ?: MimeTypeMap.getSingleton().getMimeTypeFromExtension(
            MimeTypeMap.getFileExtensionFromUrl(uri.toString())?.lowercase(Locale.getDefault())
        )
        ?: "application/octet-stream"
}

internal fun resolveFileSize(context: Context, uri: Uri): Long? {
    context.contentResolver.query(uri, arrayOf(MediaStore.MediaColumns.SIZE), null, null, null)
        ?.use { cursor ->
            if (cursor.moveToFirst()) {
                val index = cursor.getColumnIndex(MediaStore.MediaColumns.SIZE)
                if (index >= 0 && !cursor.isNull(index)) {
                    return cursor.getLong(index)
                }
            }
        }
    return null
}

internal fun readUriBytes(context: Context, uri: Uri): ByteArray {
    context.contentResolver.openInputStream(uri).use { input ->
        requireNotNull(input) { "无法读取 URI: $uri" }
        return input.readBytes()
    }
}

internal fun writeTextToDownloads(
    context: Context,
    displayName: String,
    mimeType: String,
    text: String
): Uri? {
    val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
        put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Xiaoxiami")
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
    }
    val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return null
    context.contentResolver.openOutputStream(uri)?.use { output ->
        output.write(text.toByteArray(Charsets.UTF_8))
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val update = ContentValues().apply {
            put(MediaStore.MediaColumns.IS_PENDING, 0)
        }
        context.contentResolver.update(uri, update, null, null)
    }
    return uri
}

internal fun copyUriToDownloads(
    context: Context,
    sourceUri: Uri,
    displayName: String,
    mimeType: String
): Uri? {
    val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
        put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Xiaoxiami")
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
    }
    val targetUri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return null
    context.contentResolver.openInputStream(sourceUri)?.use { input ->
        context.contentResolver.openOutputStream(targetUri)?.use { output ->
            input.copyTo(output)
        }
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val update = ContentValues().apply {
            put(MediaStore.MediaColumns.IS_PENDING, 0)
        }
        context.contentResolver.update(targetUri, update, null, null)
    }
    return targetUri
}

internal fun writeBytesToDownloads(
    context: Context,
    displayName: String,
    mimeType: String,
    bytes: ByteArray
): Uri? {
    val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
        put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Xiaoxiami")
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
    }
    val targetUri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return null
    context.contentResolver.openOutputStream(targetUri)?.use { output ->
        output.write(bytes)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val update = ContentValues().apply {
            put(MediaStore.MediaColumns.IS_PENDING, 0)
        }
        context.contentResolver.update(targetUri, update, null, null)
    }
    return targetUri
}

internal fun storageStats(path: File): Map<String, Long> {
    val statFs = StatFs(path.absolutePath)
    val totalBytes = statFs.totalBytes
    val freeBytes = statFs.availableBytes
    return mapOf(
        "totalBytes" to totalBytes,
        "freeBytes" to freeBytes,
        "usedBytes" to (totalBytes - freeBytes)
    )
}

internal fun safeCursorStrings(cursor: Cursor, columns: List<String>): Map<String, Any?> {
    val result = linkedMapOf<String, Any?>()
    columns.forEach { column ->
        val index = cursor.getColumnIndex(column)
        if (index >= 0 && !cursor.isNull(index)) {
            result[column] = cursor.getString(index)
        }
    }
    return result
}

internal fun persistCacheBytes(context: Context, prefix: String, extension: String, bytes: ByteArray): Uri {
    val file = File(context.cacheDir, "${prefix}_${System.currentTimeMillis()}.$extension")
    FileOutputStream(file).use { it.write(bytes) }
    return Uri.fromFile(file)
}

internal fun guessExtensionFromMimeType(mimeType: String): String {
    return MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType) ?: when {
        mimeType.contains("jpeg") -> "jpg"
        mimeType.contains("png") -> "png"
        mimeType.contains("mp4") -> "mp4"
        mimeType.contains("aac") -> "aac"
        mimeType.contains("mpeg") -> "mp3"
        else -> "bin"
    }
}

internal fun openInputStream(context: Context, uri: Uri): InputStream? {
    return context.contentResolver.openInputStream(uri)
}

internal fun buildClipData(label: String, uris: List<Uri>): ClipData? {
    if (uris.isEmpty()) return null
    val first = uris.first()
    val clipData = ClipData.newUri(null, label, first)
    uris.drop(1).forEach { clipData.addItem(ClipData.Item(it)) }
    return clipData
}
