package com.xiaoxiami.app.service

import android.util.Log
import com.xiaoxiami.app.BuildConfig
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Google File API Service
 * 实现 Google Gemini File API 的文件上传功能
 * 参考文档: https://ai.google.dev/gemini-api/docs/files
 */
class GoogleFileApiService {
    
    companion object {
        private const val TAG = "GoogleFileApiService"
        private const val BASE_URL = "https://generativelanguage.googleapis.com"
        private const val UPLOAD_ENDPOINT = "$BASE_URL/upload/v1beta/files"
        private const val FILES_ENDPOINT = "$BASE_URL/v1beta/files"
    }
    
    private val apiKey = BuildConfig.GEMINI_API_KEY
    
    private val client = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()
    
    private val gson = Gson()
    
    /**
     * Google File API 上传响应
     */
    data class FileUploadResponse(
        val file: FileMetadata
    )
    
    data class FileMetadata(
        val name: String,
        val uri: String,
        @SerializedName("mimeType") val mimeType: String,
        @SerializedName("sizeBytes") val sizeBytes: String,
        @SerializedName("createTime") val createTime: String,
        @SerializedName("updateTime") val updateTime: String,
        @SerializedName("expirationTime") val expirationTime: String,
        val state: String,
        @SerializedName("displayName") val displayName: String? = null
    )
    
    /**
     * 上传文件到 Google File API
     * 使用 Resumable Upload Protocol
     * 
     * @param file 要上传的文件
     * @param displayName 文件显示名称（可选）
     * @return Google File API 的 URI (例如: https://generativelanguage.googleapis.com/v1beta/files/xxx)
     */
    suspend fun uploadFile(file: File, displayName: String? = null): String = withContext(Dispatchers.IO) {
        Log.i(TAG, "Starting file upload: ${file.name} (${file.length()} bytes)")
        
        val mimeType = getMimeType(file)
        val numBytes = file.length()
        val finalDisplayName = displayName ?: file.nameWithoutExtension
        
        // Step 1: 初始化可恢复上传请求
        val uploadUrl = initiateResumableUpload(mimeType, numBytes, finalDisplayName)
        Log.i(TAG, "Got upload URL: $uploadUrl")
        
        // Step 2: 上传实际文件内容
        val fileMetadata = uploadFileContent(uploadUrl, file)
        Log.i(TAG, "✅ File uploaded successfully: ${fileMetadata.uri}")
        
        return@withContext fileMetadata.uri
    }
    
    /**
     * 上传字节数组到 Google File API
     * 
     * @param bytes 文件字节数组
     * @param mimeType MIME 类型
     * @param displayName 文件显示名称
     * @return Google File API 的 URI
     */
    suspend fun uploadBytes(bytes: ByteArray, mimeType: String, displayName: String): String = withContext(Dispatchers.IO) {
        Log.i(TAG, "Starting bytes upload: $displayName (${bytes.size} bytes)")
        
        // Step 1: 初始化可恢复上传请求
        val uploadUrl = initiateResumableUpload(mimeType, bytes.size.toLong(), displayName)
        Log.i(TAG, "Got upload URL: $uploadUrl")
        
        // Step 2: 上传实际内容
        val fileMetadata = uploadBytesContent(uploadUrl, bytes)
        Log.i(TAG, "✅ Bytes uploaded successfully: ${fileMetadata.uri}")
        
        return@withContext fileMetadata.uri
    }
    
    /**
     * 初始化可恢复上传
     * 返回上传 URL
     */
    private fun initiateResumableUpload(mimeType: String, numBytes: Long, displayName: String): String {
        val metadata = mapOf(
            "file" to mapOf(
                "display_name" to displayName
            )
        )
        
        val requestBody = gson.toJson(metadata).toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url(UPLOAD_ENDPOINT)
            .header("X-Goog-Api-Key", apiKey)
            .header("X-Goog-Upload-Protocol", "resumable")
            .header("X-Goog-Upload-Command", "start")
            .header("X-Goog-Upload-Header-Content-Length", numBytes.toString())
            .header("X-Goog-Upload-Header-Content-Type", mimeType)
            .header("Content-Type", "application/json")
            .post(requestBody)
            .build()
        
        val response = client.newCall(request).execute()
        
        if (!response.isSuccessful) {
            val errorBody = response.body?.string()
            throw Exception("Failed to initiate upload: ${response.code} - $errorBody")
        }
        
        // 从响应头中获取上传 URL
        val uploadUrl = response.header("X-Goog-Upload-URL")
            ?: throw Exception("No upload URL in response headers")
        
        return uploadUrl
    }
    
    /**
     * 上传文件内容
     */
    private fun uploadFileContent(uploadUrl: String, file: File): FileMetadata {
        val fileBytes = file.readBytes()
        
        val request = Request.Builder()
            .url(uploadUrl)
            .header("Content-Length", fileBytes.size.toString())
            .header("X-Goog-Upload-Offset", "0")
            .header("X-Goog-Upload-Command", "upload, finalize")
            .post(fileBytes.toRequestBody())
            .build()
        
        val response = client.newCall(request).execute()
        
        if (!response.isSuccessful) {
            val errorBody = response.body?.string()
            throw Exception("Failed to upload file content: ${response.code} - $errorBody")
        }
        
        val responseBody = response.body?.string()
            ?: throw Exception("Empty response body")
        
        val uploadResponse = gson.fromJson(responseBody, FileUploadResponse::class.java)
        return uploadResponse.file
    }
    
    /**
     * 上传字节数组内容
     */
    private fun uploadBytesContent(uploadUrl: String, bytes: ByteArray): FileMetadata {
        val request = Request.Builder()
            .url(uploadUrl)
            .header("Content-Length", bytes.size.toString())
            .header("X-Goog-Upload-Offset", "0")
            .header("X-Goog-Upload-Command", "upload, finalize")
            .post(bytes.toRequestBody())
            .build()
        
        val response = client.newCall(request).execute()
        
        if (!response.isSuccessful) {
            val errorBody = response.body?.string()
            throw Exception("Failed to upload bytes content: ${response.code} - $errorBody")
        }
        
        val responseBody = response.body?.string()
            ?: throw Exception("Empty response body")
        
        val uploadResponse = gson.fromJson(responseBody, FileUploadResponse::class.java)
        return uploadResponse.file
    }
    
    /**
     * 获取文件元数据
     * 
     * @param fileName 文件名称（从上传响应中获取的 name 字段）
     * @return 文件元数据
     */
    suspend fun getFileMetadata(fileName: String): FileMetadata = withContext(Dispatchers.IO) {
        val url = "$FILES_ENDPOINT/$fileName"
        
        val request = Request.Builder()
            .url(url)
            .header("X-Goog-Api-Key", apiKey)
            .get()
            .build()
        
        val response = client.newCall(request).execute()
        
        if (!response.isSuccessful) {
            val errorBody = response.body?.string()
            throw Exception("Failed to get file metadata: ${response.code} - $errorBody")
        }
        
        val responseBody = response.body?.string()
            ?: throw Exception("Empty response body")
        
        return@withContext gson.fromJson(responseBody, FileMetadata::class.java)
    }
    
    /**
     * 列出所有上传的文件
     * 
     * @param pageSize 每页返回的文件数量
     * @return 文件列表
     */
    suspend fun listFiles(pageSize: Int = 10): List<FileMetadata> = withContext(Dispatchers.IO) {
        val url = "$FILES_ENDPOINT?pageSize=$pageSize"
        
        val request = Request.Builder()
            .url(url)
            .header("X-Goog-Api-Key", apiKey)
            .get()
            .build()
        
        val response = client.newCall(request).execute()
        
        if (!response.isSuccessful) {
            val errorBody = response.body?.string()
            throw Exception("Failed to list files: ${response.code} - $errorBody")
        }
        
        val responseBody = response.body?.string()
            ?: throw Exception("Empty response body")
        
        val jsonObject = gson.fromJson(responseBody, com.google.gson.JsonObject::class.java)
        val filesArray = jsonObject.getAsJsonArray("files") ?: return@withContext emptyList()
        
        return@withContext filesArray.map { 
            gson.fromJson(it, FileMetadata::class.java) 
        }
    }
    
    /**
     * 删除文件
     * 
     * @param fileName 文件名称
     */
    suspend fun deleteFile(fileName: String): Boolean = withContext(Dispatchers.IO) {
        val url = "$FILES_ENDPOINT/$fileName"
        
        val request = Request.Builder()
            .url(url)
            .header("X-Goog-Api-Key", apiKey)
            .delete()
            .build()
        
        val response = client.newCall(request).execute()
        
        if (!response.isSuccessful) {
            val errorBody = response.body?.string()
            Log.e(TAG, "Failed to delete file: ${response.code} - $errorBody")
            return@withContext false
        }
        
        Log.i(TAG, "✅ File deleted successfully: $fileName")
        return@withContext true
    }
    
    /**
     * 根据文件扩展名获取 MIME 类型
     */
    private fun getMimeType(file: File): String {
        return when (file.extension.lowercase()) {
            "mp3" -> "audio/mp3"
            "m4a", "aac" -> "audio/aac"
            "wav" -> "audio/wav"
            "ogg" -> "audio/ogg"
            "flac" -> "audio/flac"
            "aiff" -> "audio/aiff"
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "gif" -> "image/gif"
            "webp" -> "image/webp"
            "mp4" -> "video/mp4"
            "mpeg", "mpg" -> "video/mpeg"
            "mov" -> "video/mov"
            "avi" -> "video/x-msvideo"
            "wmv" -> "video/x-ms-wmv"
            "mpegps" -> "video/mpegps"
            "flv" -> "video/x-flv"
            "pdf" -> "application/pdf"
            "txt" -> "text/plain"
            "html" -> "text/html"
            "css" -> "text/css"
            "js" -> "text/javascript"
            "csv" -> "text/csv"
            else -> "application/octet-stream"
        }
    }
}
