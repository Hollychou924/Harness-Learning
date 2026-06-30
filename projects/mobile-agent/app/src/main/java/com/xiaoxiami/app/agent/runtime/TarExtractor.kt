package com.xiaoxiami.app.agent.runtime

import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.nio.charset.StandardCharsets
import java.util.zip.GZIPInputStream

/**
 * 轻量级 tar.gz 解压器，纯 Kotlin 实现，无第三方依赖。
 * 支持普通文件、目录、符号链接和硬链接。
 */
object TarExtractor {

    private const val BLOCK_SIZE = 512
    private const val NAME_OFFSET = 0
    private const val NAME_LENGTH = 100
    private const val MODE_OFFSET = 100
    private const val MODE_LENGTH = 8
    private const val SIZE_OFFSET = 124
    private const val SIZE_LENGTH = 12
    private const val TYPEFLAG_OFFSET = 156
    private const val LINKNAME_OFFSET = 157
    private const val LINKNAME_LENGTH = 100
    private const val PREFIX_OFFSET = 345
    private const val PREFIX_LENGTH = 155

    /**
     * 解压 .tar.gz 流到目标目录。
     *
     * @param inputStream tar.gz 输入流（调用者负责关闭外层流）
     * @param destDir 目标解压目录
     * @param onProgress 可选进度回调，参数为当前正在解压的文件名
     */
    fun extractTarGz(
        inputStream: InputStream,
        destDir: File,
        onProgress: ((entryName: String) -> Unit)? = null
    ) {
        destDir.mkdirs()
        val gzipStream = GZIPInputStream(BufferedInputStream(inputStream, 65536))
        extractTar(gzipStream, destDir, onProgress)
    }

    private fun extractTar(
        input: InputStream,
        destDir: File,
        onProgress: ((String) -> Unit)?
    ) {
        val header = ByteArray(BLOCK_SIZE)
        var emptyBlocks = 0

        while (true) {
            val bytesRead = readFully(input, header)
            if (bytesRead < BLOCK_SIZE) break

            // 两个连续空 block 表示归档结束
            if (header.all { it == 0.toByte() }) {
                emptyBlocks++
                if (emptyBlocks >= 2) break
                continue
            }
            emptyBlocks = 0

            val name = extractName(header)
            if (name.isBlank()) continue

            val typeFlag = header[TYPEFLAG_OFFSET].toInt().toChar()
            val size = parseOctal(header, SIZE_OFFSET, SIZE_LENGTH)
            val mode = parseOctal(header, MODE_OFFSET, MODE_LENGTH).toInt()
            val linkName = extractString(header, LINKNAME_OFFSET, LINKNAME_LENGTH)

            onProgress?.invoke(name)

            // 安全检查：防止路径穿越
            val outFile = File(destDir, name).canonicalFile
            if (!outFile.path.startsWith(destDir.canonicalPath)) {
                skipBytes(input, alignTo512(size))
                continue
            }

            when (typeFlag) {
                '5' -> {
                    // 目录
                    outFile.mkdirs()
                }
                '2' -> {
                    // 符号链接
                    outFile.parentFile?.mkdirs()
                    try {
                        val linkTarget = File(linkName)
                        java.nio.file.Files.createSymbolicLink(
                            outFile.toPath(),
                            linkTarget.toPath()
                        )
                    } catch (_: Exception) {
                        // 某些 Android 版本可能不支持符号链接，忽略
                    }
                }
                '1' -> {
                    // 硬链接
                    outFile.parentFile?.mkdirs()
                    try {
                        val linkTarget = File(destDir, linkName).canonicalFile
                        if (linkTarget.exists()) {
                            java.nio.file.Files.createLink(
                                outFile.toPath(),
                                linkTarget.toPath()
                            )
                        }
                    } catch (_: Exception) {
                        // 硬链接失败时尝试复制
                        val linkTarget = File(destDir, linkName).canonicalFile
                        if (linkTarget.exists()) {
                            linkTarget.copyTo(outFile, overwrite = true)
                        }
                    }
                }
                '0', '\u0000' -> {
                    // 普通文件
                    outFile.parentFile?.mkdirs()
                    writeFile(input, outFile, size)
                    // 设置权限
                    outFile.setReadable(true)
                    outFile.setWritable(mode and 0b010_000_000 != 0)
                    outFile.setExecutable(mode and 0b001_000_000 != 0)
                    // 跳过对齐填充
                    val remainder = size % BLOCK_SIZE
                    if (remainder > 0) {
                        skipBytes(input, (BLOCK_SIZE - remainder))
                    }
                    continue // 已在 writeFile 中读取数据，跳过下面的 skip
                }
                else -> {
                    // 其他类型（长文件名扩展等），跳过
                }
            }

            // 跳过数据块（对于目录和链接，size 通常为 0）
            if (size > 0 && typeFlag != '0' && typeFlag != '\u0000') {
                skipBytes(input, alignTo512(size))
            }
        }
    }

    private fun extractName(header: ByteArray): String {
        val prefix = extractString(header, PREFIX_OFFSET, PREFIX_LENGTH)
        val name = extractString(header, NAME_OFFSET, NAME_LENGTH)
        return if (prefix.isNotEmpty()) "$prefix/$name" else name
    }

    private fun extractString(data: ByteArray, offset: Int, length: Int): String {
        val end = (offset until (offset + length).coerceAtMost(data.size))
            .firstOrNull { data[it] == 0.toByte() }
            ?: (offset + length).coerceAtMost(data.size)
        return String(data, offset, end - offset, StandardCharsets.UTF_8).trim()
    }

    private fun parseOctal(data: ByteArray, offset: Int, length: Int): Long {
        val str = extractString(data, offset, length).trim()
        if (str.isEmpty()) return 0L
        return try {
            str.toLong(8)
        } catch (_: NumberFormatException) {
            0L
        }
    }

    private fun writeFile(input: InputStream, outFile: File, size: Long) {
        FileOutputStream(outFile).use { fos ->
            val buf = ByteArray(8192)
            var remaining = size
            while (remaining > 0) {
                val toRead = buf.size.toLong().coerceAtMost(remaining).toInt()
                val read = input.read(buf, 0, toRead)
                if (read <= 0) break
                fos.write(buf, 0, read)
                remaining -= read
            }
        }
    }

    private fun readFully(input: InputStream, buf: ByteArray): Int {
        var totalRead = 0
        while (totalRead < buf.size) {
            val read = input.read(buf, totalRead, buf.size - totalRead)
            if (read <= 0) break
            totalRead += read
        }
        return totalRead
    }

    private fun skipBytes(input: InputStream, count: Long) {
        var remaining = count
        val buf = ByteArray(8192)
        while (remaining > 0) {
            val toSkip = buf.size.toLong().coerceAtMost(remaining).toInt()
            val read = input.read(buf, 0, toSkip)
            if (read <= 0) break
            remaining -= read
        }
    }

    private fun alignTo512(size: Long): Long {
        val remainder = size % BLOCK_SIZE
        return if (remainder > 0) size + (BLOCK_SIZE - remainder) else size
    }
}
