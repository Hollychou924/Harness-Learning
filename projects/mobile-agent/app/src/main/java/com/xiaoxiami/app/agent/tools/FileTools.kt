package com.xiaoxiami.app.agent.tools

import android.content.Context
import android.net.Uri
import android.os.Environment
import android.webkit.MimeTypeMap
import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolApprovalRequirement
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolValueType
import java.io.File
import java.io.InputStreamReader
import java.nio.charset.Charset
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// ─────────────────────────────────────────────────────────────
//  File scope: 安全沙箱内的可访问目录
// ─────────────────────────────────────────────────────────────

private fun resolveScopedRoot(context: Context, scope: String): File? = when (scope) {
    "app_files" -> context.filesDir
    "app_cache" -> context.cacheDir
    "downloads" -> Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
    "documents" -> Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS)
    "dcim"      -> Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM)
    "pictures"  -> Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
    "music"     -> Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC)
    "movies"    -> Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES)
    "external"  -> context.getExternalFilesDir(null)
    else        -> null
}

private val ALLOWED_SCOPES = listOf(
    "app_files", "app_cache", "downloads", "documents",
    "dcim", "pictures", "music", "movies", "external"
)

/** 路径安全校验：防止 ".." 路径穿越攻击 */
private fun resolveSafePath(root: File, relativePath: String): File? {
    val target = File(root, relativePath).canonicalFile
    val rootCanonical = root.canonicalFile
    return if (target.path.startsWith(rootCanonical.path)) target else null
}

private fun formatSize(bytes: Long): String = when {
    bytes < 1024 -> "${bytes}B"
    bytes < 1024 * 1024 -> "%.1fKB".format(bytes / 1024.0)
    bytes < 1024 * 1024 * 1024 -> "%.1fMB".format(bytes / (1024.0 * 1024))
    else -> "%.2fGB".format(bytes / (1024.0 * 1024 * 1024))
}

private fun guessMimeType(file: File): String {
    val ext = file.extension.lowercase(Locale.getDefault())
    return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"
}

private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())

// ─────────────────────────────────────────────────────────────
//  file_list — 列出目录内容
//  增强：递归遍历、按类型/大小/时间过滤、排序、深度限制
// ─────────────────────────────────────────────────────────────

class FileListTool(private val context: Context) : Tool {
    override val schema = ToolSchema(
        name = "file_list",
        description = """List files and directories under a scoped path. Returns name, size, type, and modification time.
Supports recursive listing with depth control, filtering by extension/size/time, and custom sort order.
Available scopes: ${ALLOWED_SCOPES.joinToString(", ")}""",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("file", "list", "read"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        inputSchema = listOf(
            ToolParameterSchema("scope", ToolValueType.STRING, "Storage scope: ${ALLOWED_SCOPES.joinToString(", ")}", required = true),
            ToolParameterSchema("path", ToolValueType.STRING, "Relative path within scope. Use '.' or '' for scope root.", required = false),
            ToolParameterSchema("recursive", ToolValueType.BOOLEAN, "Whether to list recursively. Default false.", required = false),
            ToolParameterSchema("maxDepth", ToolValueType.INTEGER, "Maximum recursion depth (1-10). Default 3.", required = false),
            ToolParameterSchema("extensions", ToolValueType.ARRAY, "Filter by file extensions, e.g. ['txt','pdf'].", required = false, itemType = ToolValueType.STRING),
            ToolParameterSchema("minSize", ToolValueType.INTEGER, "Minimum file size in bytes.", required = false),
            ToolParameterSchema("maxSize", ToolValueType.INTEGER, "Maximum file size in bytes.", required = false),
            ToolParameterSchema("sortBy", ToolValueType.STRING, "Sort by: name, size, modified. Default: name.", required = false),
            ToolParameterSchema("sortDesc", ToolValueType.BOOLEAN, "Whether to sort descending. Default false.", required = false),
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum items returned (1-500). Default 100.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("items", ToolValueType.ARRAY, "List of file/directory entries."),
            ToolFieldSchema("totalCount", ToolValueType.INTEGER, "Total matching items count."),
            ToolFieldSchema("scopeRoot", ToolValueType.STRING, "Resolved scope root path.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val scope = arguments.stringArg("scope")
        val path = arguments.stringArg("path", ".")
        val recursive = arguments.booleanArg("recursive", false)
        val maxDepth = arguments.intArg("maxDepth", 3).coerceIn(1, 10)
        val extensions = arguments.stringListArg("extensions").map { it.lowercase().removePrefix(".") }
        val minSize = arguments.longArg("minSize", -1)
        val maxSize = arguments.longArg("maxSize", -1)
        val sortBy = arguments.stringArg("sortBy", "name")
        val sortDesc = arguments.booleanArg("sortDesc", false)
        val limit = arguments.intArg("limit", 100).coerceIn(1, 500)

        val root = resolveScopedRoot(this.context, scope)
            ?: return ToolResult(false, "", "无效 scope: $scope, 可用: ${ALLOWED_SCOPES.joinToString(", ")}")
        val target = resolveSafePath(root, path)
            ?: return ToolResult(false, "", "路径安全检查失败，不允许路径穿越")
        if (!target.exists()) return ToolResult(false, "", "路径不存在: $path")
        if (!target.isDirectory) return ToolResult(false, "", "路径不是目录: $path")

        val items = mutableListOf<Map<String, Any?>>()
        collectFiles(target, root, 0, if (recursive) maxDepth else 1, extensions, minSize, maxSize, items)

        // 排序
        val sorted = when (sortBy) {
            "size" -> items.sortedBy { (it["size"] as? Long) ?: 0L }
            "modified" -> items.sortedBy { (it["modifiedAt"] as? Long) ?: 0L }
            else -> items.sortedBy { (it["name"] as? String).orEmpty().lowercase() }
        }.let { if (sortDesc) it.reversed() else it }

        val totalCount = sorted.size
        val limited = sorted.take(limit)

        return ToolResult(true, jsonOutput(mapOf(
            "items" to limited,
            "totalCount" to totalCount,
            "truncated" to (totalCount > limit),
            "scopeRoot" to root.absolutePath
        )))
    }

    private fun collectFiles(
        dir: File, root: File, depth: Int, maxDepth: Int,
        extensions: List<String>, minSize: Long, maxSize: Long,
        result: MutableList<Map<String, Any?>>
    ) {
        if (depth >= maxDepth) return
        val children = dir.listFiles() ?: return
        for (child in children) {
            val isDir = child.isDirectory
            val size = if (isDir) 0L else child.length()
            val ext = child.extension.lowercase()

            // 过滤
            if (extensions.isNotEmpty() && !isDir && ext !in extensions) continue
            if (minSize > 0 && !isDir && size < minSize) continue
            if (maxSize > 0 && !isDir && size > maxSize) continue

            val relativePath = child.absolutePath.removePrefix(root.absolutePath).removePrefix("/")
            result += mapOf(
                "name" to child.name,
                "path" to relativePath,
                "isDirectory" to isDir,
                "size" to size,
                "sizeFormatted" to formatSize(size),
                "modifiedAt" to child.lastModified(),
                "modifiedFormatted" to dateFormat.format(Date(child.lastModified())),
                "mimeType" to if (isDir) "directory" else guessMimeType(child)
            )

            if (isDir) {
                collectFiles(child, root, depth + 1, maxDepth, extensions, minSize, maxSize, result)
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  file_read — 读取文件内容
//  增强：自动编码检测、分页读大文件、二进制 base64 模式
// ─────────────────────────────────────────────────────────────

class FileReadTool(private val context: Context) : Tool {
    override val schema = ToolSchema(
        name = "file_read",
        description = """Read file content from a scoped path. Auto-detects text encoding.
For large files, use offset/length for pagination. For binary files, returns base64.
Available scopes: ${ALLOWED_SCOPES.joinToString(", ")}""",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("file", "read"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        inputSchema = listOf(
            ToolParameterSchema("scope", ToolValueType.STRING, "Storage scope.", required = true),
            ToolParameterSchema("path", ToolValueType.STRING, "Relative file path.", required = true),
            ToolParameterSchema("encoding", ToolValueType.STRING, "Text encoding: utf-8, gbk, gb2312, latin1, or auto (default: auto).", required = false),
            ToolParameterSchema("offset", ToolValueType.INTEGER, "Byte offset to start reading from. Default 0.", required = false),
            ToolParameterSchema("length", ToolValueType.INTEGER, "Max bytes to read (1-1048576). Default 65536 (64KB).", required = false),
            ToolParameterSchema("lines", ToolValueType.INTEGER, "If set, read only the first N lines. Overrides offset/length.", required = false),
            ToolParameterSchema("binary", ToolValueType.BOOLEAN, "If true, return content as base64 string. Default: auto-detect.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("content", ToolValueType.STRING, "File content as text or base64."),
            ToolFieldSchema("encoding", ToolValueType.STRING, "Detected/used encoding."),
            ToolFieldSchema("fileSize", ToolValueType.INTEGER, "Total file size in bytes."),
            ToolFieldSchema("readBytes", ToolValueType.INTEGER, "Bytes actually read."),
            ToolFieldSchema("truncated", ToolValueType.BOOLEAN, "Whether output was truncated.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val scope = arguments.stringArg("scope")
        val path = arguments.stringArg("path")
        val encoding = arguments.stringArg("encoding", "auto")
        val offset = arguments.longArg("offset", 0).coerceAtLeast(0)
        val length = arguments.intArg("length", 65536).coerceIn(1, 1048576)
        val lines = arguments.intArg("lines", -1)
        val forceBinary = arguments.booleanArg("binary", false)

        val root = resolveScopedRoot(this.context, scope)
            ?: return ToolResult(false, "", "无效 scope: $scope")
        val target = resolveSafePath(root, path)
            ?: return ToolResult(false, "", "路径安全检查失败")
        if (!target.exists()) return ToolResult(false, "", "文件不存在: $path")
        if (!target.isFile) return ToolResult(false, "", "路径不是文件: $path")

        val fileSize = target.length()
        val mimeType = guessMimeType(target)
        val isBinary = forceBinary || !isTextLikeMimeType(mimeType)

        return try {
            if (isBinary) {
                // 二进制模式：返回 base64
                val readLen = minOf(length.toLong(), fileSize - offset).toInt().coerceAtLeast(0)
                val bytes = target.inputStream().use { stream ->
                    stream.skip(offset)
                    val buf = ByteArray(readLen)
                    val actualRead = stream.read(buf)
                    if (actualRead < readLen) buf.copyOfRange(0, maxOf(actualRead, 0)) else buf
                }
                val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                ToolResult(true, jsonOutput(mapOf(
                    "content" to base64,
                    "encoding" to "base64",
                    "mimeType" to mimeType,
                    "fileSize" to fileSize,
                    "readBytes" to bytes.size,
                    "truncated" to (offset + bytes.size < fileSize)
                )))
            } else {
                // 文本模式
                val charset = resolveCharset(encoding, target)
                val text: String
                val readBytes: Int
                val truncated: Boolean

                if (lines > 0) {
                    // 按行数读
                    val sb = StringBuilder()
                    var lineCount = 0
                    var totalBytes = 0
                    InputStreamReader(target.inputStream(), charset).buffered().use { reader ->
                        var line = reader.readLine()
                        while (line != null && lineCount < lines) {
                            if (lineCount > 0) sb.append('\n')
                            sb.append(line)
                            totalBytes += line.toByteArray(charset).size + 1
                            lineCount++
                            line = reader.readLine()
                        }
                    }
                    text = sb.toString()
                    readBytes = totalBytes
                    truncated = lineCount >= lines && fileSize > totalBytes
                } else {
                    // 按 offset/length 读
                    val readLen = minOf(length.toLong(), fileSize - offset).toInt().coerceAtLeast(0)
                    val bytes = target.inputStream().use { stream ->
                        stream.skip(offset)
                        val buf = ByteArray(readLen)
                        val actualRead = stream.read(buf)
                        if (actualRead < readLen) buf.copyOfRange(0, maxOf(actualRead, 0)) else buf
                    }
                    text = String(bytes, charset)
                    readBytes = bytes.size
                    truncated = offset + readBytes < fileSize
                }

                ToolResult(true, jsonOutput(mapOf(
                    "content" to text,
                    "encoding" to charset.name(),
                    "mimeType" to mimeType,
                    "fileSize" to fileSize,
                    "readBytes" to readBytes,
                    "truncated" to truncated
                )))
            }
        } catch (e: Exception) {
            ToolResult(false, "", "读取文件失败: ${e.message}")
        }
    }

    private fun resolveCharset(encoding: String, file: File): Charset = when (encoding.lowercase()) {
        "utf-8", "utf8" -> Charsets.UTF_8
        "gbk" -> Charset.forName("GBK")
        "gb2312", "gb18030" -> Charset.forName("GB18030")
        "latin1", "iso-8859-1" -> Charsets.ISO_8859_1
        "utf-16", "utf16" -> Charsets.UTF_16
        else -> detectEncoding(file)
    }

    /** 简单的编码自动检测：检查 BOM 和 UTF-8 有效性 */
    private fun detectEncoding(file: File): Charset {
        val head = file.inputStream().use { it.readNBytes(4096) }
        if (head.size >= 3 && head[0] == 0xEF.toByte() && head[1] == 0xBB.toByte() && head[2] == 0xBF.toByte()) {
            return Charsets.UTF_8
        }
        if (head.size >= 2 && head[0] == 0xFF.toByte() && head[1] == 0xFE.toByte()) {
            return Charsets.UTF_16LE
        }
        if (head.size >= 2 && head[0] == 0xFE.toByte() && head[1] == 0xFF.toByte()) {
            return Charsets.UTF_16BE
        }
        // 检查是否是有效的 UTF-8
        return if (isValidUtf8(head)) Charsets.UTF_8 else Charset.forName("GBK")
    }

    private fun isValidUtf8(bytes: ByteArray): Boolean {
        var i = 0
        while (i < bytes.size) {
            val b = bytes[i].toInt() and 0xFF
            val expectedLen = when {
                b <= 0x7F -> 1
                b in 0xC0..0xDF -> 2
                b in 0xE0..0xEF -> 3
                b in 0xF0..0xF7 -> 4
                else -> return false
            }
            if (i + expectedLen > bytes.size) break
            for (j in 1 until expectedLen) {
                if (bytes[i + j].toInt() and 0xC0 != 0x80) return false
            }
            i += expectedLen
        }
        return true
    }
}

// ─────────────────────────────────────────────────────────────
//  file_write — 写入文件（创建或覆写/追加）
//  增强：自动创建目录、编码选择、追加模式、写入确认
// ─────────────────────────────────────────────────────────────

class FileWriteTool(private val context: Context) : Tool {
    override val schema = ToolSchema(
        name = "file_write",
        description = """Write or append text content to a file in a scoped path.
Creates parent directories automatically. Supports overwrite and append modes.
Available scopes: ${ALLOWED_SCOPES.joinToString(", ")}""",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("file", "write"),
        riskLevel = ToolRiskLevel.HIGH,
        approvalRequired = true,
        approvalReason = "写入文件到设备存储",
        approvalSummary = "将内容写入文件",
        inputSchema = listOf(
            ToolParameterSchema("scope", ToolValueType.STRING, "Storage scope.", required = true),
            ToolParameterSchema("path", ToolValueType.STRING, "Relative file path.", required = true),
            ToolParameterSchema("content", ToolValueType.STRING, "Text content to write.", required = true),
            ToolParameterSchema("mode", ToolValueType.STRING, "Write mode: overwrite (default) or append.", required = false),
            ToolParameterSchema("encoding", ToolValueType.STRING, "Text encoding: utf-8 (default), gbk, etc.", required = false),
            ToolParameterSchema("createDirs", ToolValueType.BOOLEAN, "Whether to create parent dirs. Default true.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("success", ToolValueType.BOOLEAN, "Whether the write succeeded."),
            ToolFieldSchema("bytesWritten", ToolValueType.INTEGER, "Number of bytes written."),
            ToolFieldSchema("filePath", ToolValueType.STRING, "Absolute path of the written file.")
        )
    )

    override fun getApprovalRequirement(arguments: Map<String, Any?>, context: ToolContext) =
        ToolApprovalRequirement(
            required = true,
            riskLevel = ToolRiskLevel.HIGH,
            reason = "写入文件: ${arguments.stringArg("path")}",
            summary = "写入 ${arguments.stringArg("scope")}/${arguments.stringArg("path")}"
        )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val scope = arguments.stringArg("scope")
        val path = arguments.stringArg("path")
        val content = arguments.stringArg("content")
        val mode = arguments.stringArg("mode", "overwrite")
        val encoding = arguments.stringArg("encoding", "utf-8")
        val createDirs = arguments.booleanArg("createDirs", true)

        if (path.isBlank()) return ToolResult(false, "", "path 不能为空")
        if (content.isEmpty()) return ToolResult(false, "", "content 不能为空")

        val root = resolveScopedRoot(this.context, scope)
            ?: return ToolResult(false, "", "无效 scope: $scope")
        val target = resolveSafePath(root, path)
            ?: return ToolResult(false, "", "路径安全检查失败")

        return try {
            if (createDirs) target.parentFile?.mkdirs()
            val charset = try { Charset.forName(encoding) } catch (_: Exception) { Charsets.UTF_8 }
            val bytes = content.toByteArray(charset)
            val append = mode.equals("append", ignoreCase = true)

            if (append) {
                target.appendBytes(bytes)
            } else {
                target.writeBytes(bytes)
            }

            ToolResult(true, jsonOutput(mapOf(
                "success" to true,
                "bytesWritten" to bytes.size,
                "filePath" to target.absolutePath,
                "mode" to if (append) "append" else "overwrite"
            )))
        } catch (e: Exception) {
            ToolResult(false, "", "写入文件失败: ${e.message}")
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  file_copy — 复制文件
//  增强：支持跨 scope 复制、冲突策略
// ─────────────────────────────────────────────────────────────

class FileCopyTool(private val context: Context) : Tool {
    override val schema = ToolSchema(
        name = "file_copy",
        description = """Copy a file or directory within or across scopes.
Supports conflict resolution: skip, overwrite, or auto-rename.
Available scopes: ${ALLOWED_SCOPES.joinToString(", ")}""",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("file", "copy", "write"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        inputSchema = listOf(
            ToolParameterSchema("sourceScope", ToolValueType.STRING, "Source storage scope.", required = true),
            ToolParameterSchema("sourcePath", ToolValueType.STRING, "Source relative path.", required = true),
            ToolParameterSchema("destScope", ToolValueType.STRING, "Destination scope (defaults to sourceScope).", required = false),
            ToolParameterSchema("destPath", ToolValueType.STRING, "Destination relative path.", required = true),
            ToolParameterSchema("onConflict", ToolValueType.STRING, "Conflict strategy: skip, overwrite, rename. Default: rename.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("success", ToolValueType.BOOLEAN, "Whether copy succeeded."),
            ToolFieldSchema("destPath", ToolValueType.STRING, "Actual destination path (may differ if renamed)."),
            ToolFieldSchema("bytesCopied", ToolValueType.INTEGER, "Total bytes copied.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val srcScope = arguments.stringArg("sourceScope")
        val srcPath = arguments.stringArg("sourcePath")
        val dstScope = arguments.stringArg("destScope", srcScope)
        val dstPath = arguments.stringArg("destPath")
        val onConflict = arguments.stringArg("onConflict", "rename")

        val srcRoot = resolveScopedRoot(this.context, srcScope)
            ?: return ToolResult(false, "", "无效 sourceScope: $srcScope")
        val dstRoot = resolveScopedRoot(this.context, dstScope)
            ?: return ToolResult(false, "", "无效 destScope: $dstScope")

        val src = resolveSafePath(srcRoot, srcPath)
            ?: return ToolResult(false, "", "源路径安全检查失败")
        var dst = resolveSafePath(dstRoot, dstPath)
            ?: return ToolResult(false, "", "目标路径安全检查失败")

        if (!src.exists()) return ToolResult(false, "", "源文件不存在: $srcPath")

        return try {
            if (dst.exists()) {
                dst = when (onConflict) {
                    "skip" -> return ToolResult(true, jsonOutput(mapOf("success" to true, "skipped" to true, "destPath" to dst.absolutePath, "bytesCopied" to 0)))
                    "overwrite" -> dst
                    else -> generateUniqueName(dst) // rename
                }
            }
            dst.parentFile?.mkdirs()
            val bytes = src.copyTo(dst, overwrite = true).length()
            ToolResult(true, jsonOutput(mapOf(
                "success" to true,
                "destPath" to dst.absolutePath,
                "bytesCopied" to bytes
            )))
        } catch (e: Exception) {
            ToolResult(false, "", "复制文件失败: ${e.message}")
        }
    }

    private fun generateUniqueName(file: File): File {
        val parent = file.parentFile ?: return file
        val nameNoExt = file.nameWithoutExtension
        val ext = file.extension.let { if (it.isNotEmpty()) ".$it" else "" }
        var counter = 1
        var candidate = File(parent, "${nameNoExt}_$counter$ext")
        while (candidate.exists() && counter < 999) {
            counter++
            candidate = File(parent, "${nameNoExt}_$counter$ext")
        }
        return candidate
    }
}

// ─────────────────────────────────────────────────────────────
//  file_move — 移动/重命名文件
//  增强：支持跨 scope、冲突策略、批量
// ─────────────────────────────────────────────────────────────

class FileMoveTool(private val context: Context) : Tool {
    override val schema = ToolSchema(
        name = "file_move",
        description = """Move or rename a file/directory within or across scopes.
Available scopes: ${ALLOWED_SCOPES.joinToString(", ")}""",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("file", "move", "write"),
        riskLevel = ToolRiskLevel.HIGH,
        approvalRequired = true,
        approvalReason = "移动/重命名文件",
        inputSchema = listOf(
            ToolParameterSchema("sourceScope", ToolValueType.STRING, "Source scope.", required = true),
            ToolParameterSchema("sourcePath", ToolValueType.STRING, "Source relative path.", required = true),
            ToolParameterSchema("destScope", ToolValueType.STRING, "Destination scope (defaults to sourceScope).", required = false),
            ToolParameterSchema("destPath", ToolValueType.STRING, "Destination relative path.", required = true),
            ToolParameterSchema("onConflict", ToolValueType.STRING, "Conflict strategy: skip, overwrite, rename. Default: rename.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val srcScope = arguments.stringArg("sourceScope")
        val srcPath = arguments.stringArg("sourcePath")
        val dstScope = arguments.stringArg("destScope", srcScope)
        val dstPath = arguments.stringArg("destPath")
        val onConflict = arguments.stringArg("onConflict", "rename")

        val srcRoot = resolveScopedRoot(this.context, srcScope)
            ?: return ToolResult(false, "", "无效 sourceScope: $srcScope")
        val dstRoot = resolveScopedRoot(this.context, dstScope)
            ?: return ToolResult(false, "", "无效 destScope: $dstScope")

        val src = resolveSafePath(srcRoot, srcPath)
            ?: return ToolResult(false, "", "源路径安全检查失败")
        var dst = resolveSafePath(dstRoot, dstPath)
            ?: return ToolResult(false, "", "目标路径安全检查失败")

        if (!src.exists()) return ToolResult(false, "", "源文件不存在: $srcPath")

        return try {
            if (dst.exists()) {
                when (onConflict) {
                    "skip" -> return ToolResult(true, jsonOutput(mapOf("success" to true, "skipped" to true)))
                    "overwrite" -> dst.deleteRecursively()
                    // rename 也可以用
                }
            }
            dst.parentFile?.mkdirs()
            val success = src.renameTo(dst)
            if (!success) {
                // renameTo 跨文件系统可能失败，回退到 copy + delete
                src.copyRecursively(dst, overwrite = true)
                src.deleteRecursively()
            }
            ToolResult(true, jsonOutput(mapOf("success" to true, "destPath" to dst.absolutePath)))
        } catch (e: Exception) {
            ToolResult(false, "", "移动文件失败: ${e.message}")
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  file_delete — 删除文件
//  增强：支持批量、目录递归删除、删除确认
// ─────────────────────────────────────────────────────────────

class FileDeleteTool(private val context: Context) : Tool {
    override val schema = ToolSchema(
        name = "file_delete",
        description = """Delete a file or directory (recursively) from a scoped path. Requires user approval.
Available scopes: ${ALLOWED_SCOPES.joinToString(", ")}""",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("file", "delete"),
        riskLevel = ToolRiskLevel.HIGH,
        approvalRequired = true,
        approvalReason = "删除文件操作不可恢复",
        approvalSummary = "从设备存储中永久删除文件",
        inputSchema = listOf(
            ToolParameterSchema("scope", ToolValueType.STRING, "Storage scope.", required = true),
            ToolParameterSchema("path", ToolValueType.STRING, "Relative path to delete.", required = true),
            ToolParameterSchema("recursive", ToolValueType.BOOLEAN, "Whether to recursively delete directory contents. Default false.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("success", ToolValueType.BOOLEAN, "Whether the deletion succeeded."),
            ToolFieldSchema("deletedCount", ToolValueType.INTEGER, "Number of files/dirs deleted.")
        )
    )

    override fun getApprovalRequirement(arguments: Map<String, Any?>, context: ToolContext) =
        ToolApprovalRequirement(
            required = true,
            riskLevel = ToolRiskLevel.HIGH,
            reason = "删除文件: ${arguments.stringArg("scope")}/${arguments.stringArg("path")}",
            summary = "永久删除 ${arguments.stringArg("path")}"
        )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val scope = arguments.stringArg("scope")
        val path = arguments.stringArg("path")
        val recursive = arguments.booleanArg("recursive", false)

        if (path.isBlank() || path == "." || path == "/") {
            return ToolResult(false, "", "不允许删除根目录")
        }

        val root = resolveScopedRoot(this.context, scope)
            ?: return ToolResult(false, "", "无效 scope: $scope")
        val target = resolveSafePath(root, path)
            ?: return ToolResult(false, "", "路径安全检查失败")

        if (!target.exists()) return ToolResult(false, "", "文件不存在: $path")

        return try {
            val count: Int
            if (target.isDirectory) {
                if (!recursive) return ToolResult(false, "", "目标是目录，请设置 recursive=true 确认递归删除")
                count = countFiles(target)
                target.deleteRecursively()
            } else {
                count = 1
                target.delete()
            }
            ToolResult(true, jsonOutput(mapOf("success" to true, "deletedCount" to count)))
        } catch (e: Exception) {
            ToolResult(false, "", "删除失败: ${e.message}")
        }
    }

    private fun countFiles(dir: File): Int {
        var count = 0
        dir.walkTopDown().forEach { count++ }
        return count
    }
}

// ─────────────────────────────────────────────────────────────
//  file_search — 按名称搜索 + 内容 grep (合一)
//  增强：osbot 分了两个工具，我们合一；支持正则内容搜索
// ─────────────────────────────────────────────────────────────

class FileSearchTool(private val context: Context) : Tool {
    override val schema = ToolSchema(
        name = "file_search",
        description = """Search for files by name pattern and/or content text within a scoped path.
Combines file name search and content grep into one powerful tool.
Available scopes: ${ALLOWED_SCOPES.joinToString(", ")}""",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("file", "search", "grep"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        inputSchema = listOf(
            ToolParameterSchema("scope", ToolValueType.STRING, "Storage scope.", required = true),
            ToolParameterSchema("path", ToolValueType.STRING, "Relative directory to search in. Default: scope root.", required = false),
            ToolParameterSchema("namePattern", ToolValueType.STRING, "File name pattern (supports * and ? wildcards). E.g. '*.txt', 'report*'.", required = false),
            ToolParameterSchema("contentQuery", ToolValueType.STRING, "Search for files containing this text. Case-insensitive by default.", required = false),
            ToolParameterSchema("contentRegex", ToolValueType.BOOLEAN, "Whether contentQuery is a regex pattern. Default false.", required = false),
            ToolParameterSchema("caseSensitive", ToolValueType.BOOLEAN, "Case-sensitive search. Default false.", required = false),
            ToolParameterSchema("maxDepth", ToolValueType.INTEGER, "Max recursion depth (1-10). Default 5.", required = false),
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Max results (1-100). Default 30.", required = false),
            ToolParameterSchema("contextLines", ToolValueType.INTEGER, "Lines of context around content matches (0-5). Default 1.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("matches", ToolValueType.ARRAY, "List of matching files with optional content context."),
            ToolFieldSchema("totalMatches", ToolValueType.INTEGER, "Total number of matches.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val scope = arguments.stringArg("scope")
        val path = arguments.stringArg("path", ".")
        val namePattern = arguments.stringArg("namePattern")
        val contentQuery = arguments.stringArg("contentQuery")
        val contentRegex = arguments.booleanArg("contentRegex", false)
        val caseSensitive = arguments.booleanArg("caseSensitive", false)
        val maxDepth = arguments.intArg("maxDepth", 5).coerceIn(1, 10)
        val limit = arguments.intArg("limit", 30).coerceIn(1, 100)
        val contextLines = arguments.intArg("contextLines", 1).coerceIn(0, 5)

        if (namePattern.isBlank() && contentQuery.isBlank()) {
            return ToolResult(false, "", "至少提供 namePattern 或 contentQuery 其一")
        }

        val root = resolveScopedRoot(this.context, scope)
            ?: return ToolResult(false, "", "无效 scope: $scope")
        val searchDir = resolveSafePath(root, path)
            ?: return ToolResult(false, "", "路径安全检查失败")
        if (!searchDir.isDirectory) return ToolResult(false, "", "搜索路径不是目录: $path")

        val nameRegex = if (namePattern.isNotBlank()) {
            val pattern = namePattern
                .replace(".", "\\.")
                .replace("*", ".*")
                .replace("?", ".")
            if (caseSensitive) Regex(pattern) else Regex(pattern, RegexOption.IGNORE_CASE)
        } else null

        val contentPattern = if (contentQuery.isNotBlank()) {
            if (contentRegex) {
                if (caseSensitive) Regex(contentQuery) else Regex(contentQuery, RegexOption.IGNORE_CASE)
            } else {
                val escaped = Regex.escape(contentQuery)
                if (caseSensitive) Regex(escaped) else Regex(escaped, RegexOption.IGNORE_CASE)
            }
        } else null

        val matches = mutableListOf<Map<String, Any?>>()
        searchDir.walkTopDown()
            .maxDepth(maxDepth)
            .filter { it.isFile }
            .forEach fileLoop@{ file ->
                if (matches.size >= limit) return@fileLoop

                // 名称匹配
                if (nameRegex != null && !nameRegex.matches(file.name)) return@fileLoop

                val relativePath = file.absolutePath.removePrefix(root.canonicalPath).removePrefix("/")
                val match = mutableMapOf<String, Any?>(
                    "path" to relativePath,
                    "name" to file.name,
                    "size" to file.length(),
                    "modified" to dateFormat.format(Date(file.lastModified()))
                )

                // 内容匹配
                if (contentPattern != null) {
                    if (!isTextLikeMimeType(guessMimeType(file))) return@fileLoop
                    if (file.length() > 10 * 1024 * 1024) return@fileLoop // 跳过 >10MB

                    val lineMatches = mutableListOf<Map<String, Any?>>()
                    try {
                        val allLines = file.readLines(Charsets.UTF_8)
                        allLines.forEachIndexed { idx, line ->
                            if (contentPattern.containsMatchIn(line)) {
                                val start = maxOf(0, idx - contextLines)
                                val end = minOf(allLines.size - 1, idx + contextLines)
                                lineMatches += mapOf(
                                    "lineNumber" to (idx + 1),
                                    "line" to line.take(500),
                                    "context" to allLines.subList(start, end + 1).joinToString("\n")
                                )
                            }
                        }
                    } catch (_: Exception) {
                        return@fileLoop
                    }
                    if (lineMatches.isEmpty()) return@fileLoop
                    match["contentMatches"] = lineMatches
                    match["matchCount"] = lineMatches.size
                }

                matches += match
            }

        return ToolResult(true, jsonOutput(mapOf(
            "matches" to matches,
            "totalMatches" to matches.size
        )))
    }
}

// ─────────────────────────────────────────────────────────────
//  file_info — 文件详细信息
//  增强：包含 MD5/SHA256 哈希、MIME 类型、权限信息
// ─────────────────────────────────────────────────────────────

class FileInfoTool(private val context: Context) : Tool {
    override val schema = ToolSchema(
        name = "file_info",
        description = """Get detailed information about a file: size, MIME type, timestamps, MD5/SHA256 hash.
Available scopes: ${ALLOWED_SCOPES.joinToString(", ")}""",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("file", "info", "read"),
        riskLevel = ToolRiskLevel.LOW,
        inputSchema = listOf(
            ToolParameterSchema("scope", ToolValueType.STRING, "Storage scope.", required = true),
            ToolParameterSchema("path", ToolValueType.STRING, "Relative file path.", required = true),
            ToolParameterSchema("hash", ToolValueType.BOOLEAN, "Whether to compute MD5/SHA256 hashes. Default false (slow for large files).", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("name", ToolValueType.STRING, "File name."),
            ToolFieldSchema("size", ToolValueType.INTEGER, "File size in bytes."),
            ToolFieldSchema("mimeType", ToolValueType.STRING, "MIME type."),
            ToolFieldSchema("isDirectory", ToolValueType.BOOLEAN, "Whether this is a directory."),
            ToolFieldSchema("modifiedAt", ToolValueType.STRING, "Last modified time."),
            ToolFieldSchema("md5", ToolValueType.STRING, "MD5 hash if requested.", required = false),
            ToolFieldSchema("sha256", ToolValueType.STRING, "SHA256 hash if requested.", required = false)
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val scope = arguments.stringArg("scope")
        val path = arguments.stringArg("path")
        val computeHash = arguments.booleanArg("hash", false)

        val root = resolveScopedRoot(this.context, scope)
            ?: return ToolResult(false, "", "无效 scope: $scope")
        val target = resolveSafePath(root, path)
            ?: return ToolResult(false, "", "路径安全检查失败")
        if (!target.exists()) return ToolResult(false, "", "文件不存在: $path")

        val info = mutableMapOf<String, Any?>(
            "name" to target.name,
            "absolutePath" to target.absolutePath,
            "isDirectory" to target.isDirectory,
            "isFile" to target.isFile,
            "size" to target.length(),
            "sizeFormatted" to formatSize(target.length()),
            "mimeType" to guessMimeType(target),
            "modifiedAt" to dateFormat.format(Date(target.lastModified())),
            "modifiedEpoch" to target.lastModified(),
            "canRead" to target.canRead(),
            "canWrite" to target.canWrite(),
            "canExecute" to target.canExecute(),
            "extension" to target.extension
        )

        if (target.isDirectory) {
            val children = target.listFiles()
            info["childCount"] = children?.size ?: 0
            info["childFiles"] = children?.count { it.isFile } ?: 0
            info["childDirs"] = children?.count { it.isDirectory } ?: 0
        }

        if (computeHash && target.isFile && target.length() < 100 * 1024 * 1024) { // 限制 100MB
            try {
                val bytes = target.readBytes()
                val md5 = MessageDigest.getInstance("MD5").digest(bytes)
                    .joinToString("") { "%02x".format(it) }
                val sha256 = MessageDigest.getInstance("SHA-256").digest(bytes)
                    .joinToString("") { "%02x".format(it) }
                info["md5"] = md5
                info["sha256"] = sha256
            } catch (_: Exception) { /* 哈希计算失败不影响主结果 */ }
        }

        return ToolResult(true, jsonOutput(info))
    }
}
