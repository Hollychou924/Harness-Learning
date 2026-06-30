package com.xiaoxiami.app.service

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.util.Log
import com.xiaoxiami.app.BuildConfig
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID

class VolcTtsManager {
    companion object {
        private const val TAG = "VolcTtsManager"
        private const val HOST = "wss://openspeech.bytedance.com/api/v3/tts/bidirection"
        
        // 🆕 TTS 配置 (Seed-TTS 2.0)
        // 实例ID/名称: TTS-SeedTTS2.02000000606678211938
        private const val APP_ID = "9944101648"
        private const val ACCESS_TOKEN = "Z8YfWsFqc_Zm5ShVb7IjZaq6M_l9-DHq"
        // Secret Key: 1yR6i9XFGuZIvUgd5ck0_s2zk_YPrlu9 (备用)
        // Resource ID for Seed-TTS 2.0
        private const val RESOURCE_ID = "seed-tts-2.0" 
        
        private const val DEFAULT_VOICE_TYPE = "zh_female_vv_uranus_bigtts" // VV 2.0 (开心/愉悦)
        
        /**
         * 🆕 将Markdown格式文本转换为纯语音文本（双轨输出 - Speech Track）
         * 移除所有Markdown符号，保留纯文字内容，适合TTS播报
         */
        fun convertToSpeechText(markdownText: String): String {
            var result = markdownText
            
            // 移除代码块（```...```）
            result = result.replace(Regex("```[\\s\\S]*?```"), " 代码块 ")
            
            // 移除行内代码（`...`）
            result = result.replace(Regex("`([^`]+)`")) { it.groupValues[1] }
            
            // 移除标题符号（# ## ### 等）
            result = result.replace(Regex("^#{1,6}\\s*", RegexOption.MULTILINE), "")
            
            // 移除粗体（**text** 或 __text__）
            result = result.replace(Regex("\\*\\*([^*]+)\\*\\*")) { it.groupValues[1] }
            result = result.replace(Regex("__([^_]+)__")) { it.groupValues[1] }
            
            // 移除斜体（*text* 或 _text_）
            result = result.replace(Regex("(?<!\\*)\\*([^*]+)\\*(?!\\*)")) { it.groupValues[1] }
            result = result.replace(Regex("(?<!_)_([^_]+)_(?!_)")) { it.groupValues[1] }
            
            // 移除删除线（~~text~~）
            result = result.replace(Regex("~~([^~]+)~~")) { it.groupValues[1] }
            
            // 移除链接，保留文本（[text](url)）
            result = result.replace(Regex("\\[([^\\]]+)]\\([^)]+\\)")) { it.groupValues[1] }
            
            // 移除图片（![alt](url)）
            result = result.replace(Regex("!\\[([^\\]]*)]\\([^)]+\\)"), " 图片 ")
            
            // 移除无序列表符号（- * +）
            result = result.replace(Regex("^[\\s]*[-*+]\\s+", RegexOption.MULTILINE), "")
            
            // 移除有序列表符号（1. 2. 等）
            result = result.replace(Regex("^[\\s]*\\d+\\.\\s+", RegexOption.MULTILINE), "")
            
            // 移除引用符号（>）
            result = result.replace(Regex("^>\\s*", RegexOption.MULTILINE), "")
            
            // 移除分隔线（--- *** ___）
            result = result.replace(Regex("^[-*_]{3,}$", RegexOption.MULTILINE), "")
            
            // 移除表格分隔符
            result = result.replace(Regex("\\|[-:]+\\|"), "")
            result = result.replace(Regex("\\|"), " ")
            
            // 移除多余星号和下划线
            result = result.replace(Regex("[*_]+"), "")
            
            // 清理多余的空白字符
            result = result.replace(Regex("\\s+"), " ")
            result = result.trim()
            
            return result
        }
    }

    private var webSocket: WebSocket? = null
    private val client = OkHttpClient()
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO)
    
    // Audio Player
    private var audioTrack: AudioTrack? = null
    private val sampleRate = 24000
    private var isPlaying = false

    // State
    @Volatile
    private var currentSessionId: String? = null
    private var isConnected = false

    init {
        initAudioTrack()
    }

    private fun initAudioTrack() {
        try {
            val minBufferSize = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )
            audioTrack = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(sampleRate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(minBufferSize * 2)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()
                
            audioTrack?.play()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to init AudioTrack", e)
        }
    }

    fun connect() {
        if (isConnected) return
        
        val request = Request.Builder()
            .url(HOST)
            .addHeader("X-Api-App-Key", APP_ID)
            .addHeader("X-Api-Access-Key", ACCESS_TOKEN)
            .addHeader("X-Api-Resource-Id", RESOURCE_ID)
            .addHeader("X-Api-Connect-Id", UUID.randomUUID().toString())
            .build()
            
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "WebSocket Connected")
                isConnected = true
                sendStartConnection(webSocket)
            }

            override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                handleBinaryMessage(bytes.toByteArray())
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket Closing: $code / $reason")
                isConnected = false
                currentSessionId = null
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket Failure", t)
                isConnected = false
                currentSessionId = null
            }
        })
    }
    
    fun disconnect() {
        webSocket?.close(1000, "User disconnect")
        webSocket = null
        isConnected = false
        currentSessionId = null
    }

    // 🌟 流式播报文本队列
    private val textQueue = Channel<String>(Channel.UNLIMITED)
    private var isProcessingQueue = false
    private val accumulatedText = StringBuilder()
    private val sentenceDelimiters = setOf('。', '！', '？', '；', '.', '!', '?', ';', '\n')
    
    /**
     * 流式播报文本 - 累积到句子结束后播报
     */
    fun playTextStream(text: String) {
        // 🆕 确保连接已建立
        if (!isConnected) {
            Log.d(TAG, "TTS not connected, establishing connection...")
            connect()
        }
        
        scope.launch {
            accumulatedText.append(text)
            
            // 检查是否有完整句子
            val content = accumulatedText.toString()
            val lastDelimiterIndex = content.indexOfLast { it in sentenceDelimiters }
            
            if (lastDelimiterIndex >= 0) {
                // 找到句子结束符，播报到该位置的内容
                val toSpeak = content.substring(0, lastDelimiterIndex + 1)
                accumulatedText.delete(0, lastDelimiterIndex + 1)
                
                if (toSpeak.isNotBlank()) {
                    Log.d(TAG, "Queueing text for TTS: ${toSpeak.take(50)}...")
                    textQueue.send(toSpeak)
                    if (!isProcessingQueue) {
                        processQueue()
                    }
                }
            }
        }
    }
    
    /**
     * 流式播报结束 - 播报剩余文本
     */
    fun finishStream() {
        scope.launch {
            val remaining = accumulatedText.toString()
            accumulatedText.clear()
            
            if (remaining.isNotBlank()) {
                textQueue.send(remaining)
                if (!isProcessingQueue) {
                    processQueue()
                }
            }
        }
    }
    
    /**
     * 处理播报队列
     */
    private fun processQueue() {
        scope.launch {
            isProcessingQueue = true
            Log.d(TAG, "Starting to process TTS queue, isConnected=$isConnected")
            
            try {
                for (text in textQueue) {
                    // 🆕 等待连接建立
                    var retries = 0
                    while (!isConnected && retries < 20) {
                        Log.d(TAG, "Waiting for TTS connection... retry=$retries")
                        delay(100)
                        retries++
                    }
                    
                    if (currentSessionId == null && isConnected) {
                        // 🆕 双轨输出：将Markdown文本转换为语音友好格式
                        val speechText = convertToSpeechText(text)
                        
                        if (speechText.isNotBlank()) {
                            Log.d(TAG, "Speaking: ${speechText.take(50)}...")
                            // 播报文本
                            val sessionId = UUID.randomUUID().toString()
                            currentSessionId = sessionId
                            
                            sendStartSession(sessionId)
                            sendTaskRequest(sessionId, speechText) // 🆕 使用清理后的文本
                            sendFinishSession(sessionId)
                            
                            // 等待播报完成（简单等待，实际应该监听音频播放完成事件）
                            delay(speechText.length * 100L) // 粗略估计：每个字100ms
                            
                            currentSessionId = null
                        }
                    } else {
                        Log.w(TAG, "Cannot speak: sessionId=$currentSessionId, isConnected=$isConnected")
                    }
                }
            } finally {
                isProcessingQueue = false
                Log.d(TAG, "Finished processing TTS queue")
            }
        }
    }

    fun playText(text: String) {
        stop()
        if (!isConnected) {
            connect()
            // Wait for connection? Ideally we queue this. 
            // For simplicity, we assume fast connection or trigger after short delay
            // But implementing a queue is better.
            scope.launch {
                // simple retry logic or queue
                var retries = 0
                while (!isConnected && retries < 10) {
                    delay(200)
                    retries++
                }
                if (isConnected) {
                    startSessionAndSendText(text)
                }
            }
        } else {
            startSessionAndSendText(text)
        }
    }
    
    fun stop() {
        try {
            Log.d(TAG, "Stopping TTS playback")
            val sId = currentSessionId
            currentSessionId = null
            
            sId?.let {
                 try { sendFinishSession(it) } catch (e: Exception) {}
            }
            
            // 清空流式播报队列和累积文本（不cancel队列，只是清空）
            accumulatedText.clear()
            // 🆕 不再cancel队列，避免后续无法使用
            // textQueue.cancel() 
            isProcessingQueue = false
            
            audioTrack?.pause()
            audioTrack?.flush()
            audioTrack?.play()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping audio", e)
        }
    }

    private fun startSessionAndSendText(text: String) {
        // 🆕 双轨输出：将Markdown文本转换为语音友好格式
        val speechText = convertToSpeechText(text)
        
        if (speechText.isBlank()) {
            Log.d(TAG, "Empty speech text after conversion, skipping TTS")
            return
        }
        
        val sessionId = UUID.randomUUID().toString()
        currentSessionId = sessionId
        
        // 1. Send StartSession
        sendStartSession(sessionId)
        
        // 2. Send Text (TaskRequest) - 使用清理后的文本
        sendTaskRequest(sessionId, speechText)
        
        // 3. Send FinishSession (Assuming one-shot text)
        // For streaming text, we would send multiple TaskRequests and then FinishSession
        // But here we get full text.
        sendFinishSession(sessionId)
    }

    // --- Protocol Methods ---

    private fun sendStartConnection(ws: WebSocket) {
        // Protocol: v1(4bits)=1 | HeaderSize(4bits)=1 -> 0x11
        // MsgType: Full-client request (0b0001) | Flags (0b0100) -> 0x14
        // Serialization: JSON (0b0001) | No Compress (0b0000) -> 0x10
        // Reserved: 0x00
        // Event Type: 1 (StartConnection)
        
        val header = ByteArray(4)
        header[0] = 0x11
        header[1] = 0x14
        header[2] = 0x10
        header[3] = 0x00
        
        val payloadJson = "{}"
        val payloadBytes = payloadJson.toByteArray(Charsets.UTF_8)
        
        val buffer = ByteBuffer.allocate(4 + 4 + 4 + payloadBytes.size)
            .order(ByteOrder.BIG_ENDIAN)
            .put(header)
            .putInt(1) // Event Code: StartConnection
            .putInt(payloadBytes.size)
            .put(payloadBytes)
            
        ws.send(ByteString.of(*buffer.array()))
    }

    private fun sendStartSession(sessionId: String) {
        // Header same: 0x11 0x14 0x10 0x00
        // Event: 100 (StartSession)
        // Payload: SessionID Len, SessionID, Meta Len, Meta JSON
        
        val header = ByteArray(4)
        header[0] = 0x11
        header[1] = 0x14
        header[2] = 0x10
        header[3] = 0x00
        
        val sessionBytes = sessionId.toByteArray(Charsets.UTF_8)
        
        // Construct req_params
        val reqParams = mapOf(
            "user" to mapOf("uid" to "12345"),
            "req_params" to mapOf(
                "text" to "", 
                "speaker" to DEFAULT_VOICE_TYPE,
                "emotion" to "happy", // 设置情感参数为开心/愉悦
                "audio_params" to mapOf(
                    "format" to "pcm", // Use PCM for direct AudioTrack
                    "sample_rate" to sampleRate,
                    "model" to "seed-tts-2.0" // Ensure 2.0 model
                )
            )
        )
        val json = gson.toJson(reqParams)
        val jsonBytes = json.toByteArray(Charsets.UTF_8)
        
        val buffer = ByteBuffer.allocate(4 + 4 + 4 + sessionBytes.size + 4 + jsonBytes.size)
            .order(ByteOrder.BIG_ENDIAN)
            .put(header)
            .putInt(100) // StartSession
            .putInt(sessionBytes.size)
            .put(sessionBytes)
            .putInt(jsonBytes.size)
            .put(jsonBytes)
            
        webSocket?.send(ByteString.of(*buffer.array()))
    }
    
    private fun sendTaskRequest(sessionId: String, text: String) {
        // Event: 200 (TaskRequest)
        // Meta: {"req_params": {"text": "..."}}
        val header = ByteArray(4)
        header[0] = 0x11
        header[1] = 0x14
        header[2] = 0x10
        header[3] = 0x00
        
        val sessionBytes = sessionId.toByteArray(Charsets.UTF_8)
        
        val params = mapOf(
            "req_params" to mapOf(
                "text" to text
            )
        )
        val json = gson.toJson(params)
        val jsonBytes = json.toByteArray(Charsets.UTF_8)
        
        val buffer = ByteBuffer.allocate(4 + 4 + 4 + sessionBytes.size + 4 + jsonBytes.size)
            .order(ByteOrder.BIG_ENDIAN)
            .put(header)
            .putInt(200) // TaskRequest
            .putInt(sessionBytes.size)
            .put(sessionBytes)
            .putInt(jsonBytes.size)
            .put(jsonBytes)
            
        webSocket?.send(ByteString.of(*buffer.array()))
    }
    
    private fun sendFinishSession(sessionId: String) {
        // Event: 102 (FinishSession)
        val header = ByteArray(4)
        header[0] = 0x11
        header[1] = 0x14
        header[2] = 0x10
        header[3] = 0x00
        
        val sessionBytes = sessionId.toByteArray(Charsets.UTF_8)
        val payload = "{}"
        val payloadBytes = payload.toByteArray(Charsets.UTF_8)
        
        val buffer = ByteBuffer.allocate(4 + 4 + 4 + sessionBytes.size + 4 + payloadBytes.size)
            .order(ByteOrder.BIG_ENDIAN)
            .put(header)
            .putInt(102) // FinishSession
            .putInt(sessionBytes.size)
            .put(sessionBytes)
            .putInt(payloadBytes.size)
            .put(payloadBytes)
            
        webSocket?.send(ByteString.of(*buffer.array()))
    }

    private fun handleBinaryMessage(bytes: ByteArray) {
        try {
            val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN)
            
            // Header (4 bytes)
            val versionAndHeaderSize = buffer.get()
            val msgTypeAndFlags = buffer.get()
            val serializationAndCompression = buffer.get()
            val reserved = buffer.get()
            
            // Determine Msg Type
            // 0b1001 (Full-server response) -> 0x90 mask
            // 0b1011 (Audio-only response) -> 0xB0 mask
            // 0b1111 (Error) -> 0xF0 mask
            
            val msgType = (msgTypeAndFlags.toInt() and 0xF0) shr 4
            
            // Check flags (0b0100 means Has Event Type? Response usually has it)
            // Table says: 
            // 0b1001 (Full-server) -> Flags 0b0100 (Has Event)
            // 0b1011 (Audio-only) -> Flags 0b0100 (Has Event)
            
            // If it's audio (Type 0xB or 0x9 + specific event), we play it.
            // Parse Event Code if present
            
            var eventCode = -1
            if ((msgTypeAndFlags.toInt() and 0x04) != 0) { // Check flag bit 2 (0b0100)
                eventCode = buffer.int
            }
            
            // If Audio Data (TTSResponse = 352)
            if (eventCode == 352) {
                // Determine structure for TTSResponse
                // Struct: SessionID Len, SessionID, Audio Len, Audio Data
                
                // Skip SessionID
                val audioMsgType = msgType
                if (audioMsgType == 0xB || audioMsgType == 0x9) {
                     val sessionIdLen = buffer.int
                     val sIdBytes = ByteArray(sessionIdLen)
                     buffer.get(sIdBytes)
                     val sId = String(sIdBytes, Charsets.UTF_8)
                     
                     if (sId == currentSessionId) {
                         val audioLen = buffer.int
                         val audioData = ByteArray(audioLen)
                         buffer.get(audioData)
                         
                         // Play Audio
                         audioTrack?.write(audioData, 0, audioLen)
                     }
                }
            } else if (eventCode == 153) { // SessionFailed
                 Log.e(TAG, "Session Failed")
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing binary message", e)
        }
    }
}
