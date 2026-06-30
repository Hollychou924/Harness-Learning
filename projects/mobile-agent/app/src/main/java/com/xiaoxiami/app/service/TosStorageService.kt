package com.xiaoxiami.app.service

import android.util.Log
import com.xiaoxiami.app.BuildConfig
import com.volcengine.tos.TOSV2
import com.volcengine.tos.TOSV2ClientBuilder
import com.volcengine.tos.auth.StaticCredentials
import com.volcengine.tos.model.`object`.PutObjectBasicInput
import com.volcengine.tos.model.`object`.PutObjectInput
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayInputStream
import java.util.UUID

/**
 * TOS (Volcengine Object Storage) Service for uploading audio files
 * and getting public URLs for the proxy service.
 */
class TosStorageService {
    
    companion object {
        private const val TAG = "TosStorageService"
    }
    
    // Use getters to force reading latest values if possible, or stick to properties
    // In Android, BuildConfig values are static final, so they won't change at runtime.
    // However, if the user JUST added them to local.properties, they need a clean rebuild.
    private val endpoint get() = BuildConfig.TOS_ENDPOINT
    private val region get() = BuildConfig.TOS_REGION
    private val bucket get() = BuildConfig.TOS_BUCKET
    private val accessKey get() = BuildConfig.TOS_ACCESS_KEY
    private val secretKey get() = BuildConfig.TOS_SECRET_KEY
    
    private val tosClient: TOSV2? by lazy {
        // Log all configs for debugging
        Log.d(TAG, "Initializing TOS Client. Endpoint: '$endpoint', Region: '$region', Bucket: '$bucket', AK: '${accessKey.take(4)}***', SK: '${secretKey.take(4)}***'")
        
        if (endpoint.isBlank() || region.isBlank() || accessKey.isBlank() || secretKey.isBlank()) {
            Log.w(TAG, "TOS credentials not configured (Found blanks), storage service disabled")
            null
        } else {
            try {
                // Use standard build method to avoid "empty Signer" error
                // In some versions of ve-tos-android-sdk, the 4-parameter build is the standard way.
                TOSV2ClientBuilder().build(region, endpoint, accessKey, secretKey)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to initialize TOS client: ${e.message}", e)
                null
            }
        }
    }
    
    /**
     * Upload audio bytes to TOS and return the public URL.
     * 
     * @param audioBytes The audio file bytes to upload
     * @param mimeType The MIME type of the audio (default: audio/mp4)
     * @return The public URL of the uploaded file
     * @throws Exception if upload fails
     */
    suspend fun uploadAudioFile(
        audioBytes: ByteArray,
        mimeType: String = "audio/mp4"
    ): String = withContext(Dispatchers.IO) {
        val client = tosClient ?: run {
            // Re-check if credentials exist but client failed to init
            if (isConfigured()) {
                // Try initializing again
                try {
                    val newClient = TOSV2ClientBuilder().build(region, endpoint, accessKey, secretKey)
                    Log.i(TAG, "TOS client initialized lazily.")
                    newClient
                } catch (e: Exception) {
                    throw IllegalStateException("TOS client initialization failed: ${e.message}")
                }
            } else {
                throw IllegalStateException("TOS client not initialized. Check credentials in local.properties")
            }
        }
        
        // Generate unique object key
        val timestamp = System.currentTimeMillis()
        val uuid = UUID.randomUUID().toString().take(8)
        val extension = when {
            mimeType.contains("mp4") -> "m4a"
            mimeType.contains("wav") -> "wav"
            mimeType.contains("mp3") -> "mp3"
            else -> "m4a"
        }
        val objectKey = "audio/${timestamp}_${uuid}.$extension"
        
        Log.d(TAG, "Uploading audio to TOS: $objectKey (${audioBytes.size} bytes)")
        
        try {
            val stream = ByteArrayInputStream(audioBytes)
            val basicInput = PutObjectBasicInput()
                .setBucket(bucket)
                .setKey(objectKey)
            val putInput = PutObjectInput()
                .setPutObjectBasicInput(basicInput)
                .setContent(stream)
            
            val output = client.putObject(putInput)
            Log.d(TAG, "Upload successful, etag: ${output.etag}")
            
            // Construct public URL
            // Format: https://{bucket}.{endpoint}/{objectKey}
            val url = "https://$bucket.$endpoint/$objectKey"
            Log.d(TAG, "Audio URL: $url")
            
            url
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upload audio to TOS: ${e.message}", e)
            throw e
        }
    }
    
    /**
     * Check if the TOS service is properly configured.
     */
    fun isConfigured(): Boolean {
        return endpoint.isNotBlank() && 
               region.isNotBlank() && 
               bucket.isNotBlank() &&
               accessKey.isNotBlank() && 
               secretKey.isNotBlank()
    }
}
