package com.xiaoxiami.app.service

import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.*
import okio.ByteString
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.util.UUID
import java.util.concurrent.TimeUnit
import java.util.zip.GZIPOutputStream

/**
 * 豆包大模型流式语音识别服务
 * 文档: https://www.volcengine.com/docs/6561/1354869
 */
class DoubaoSpeechService {

    companion object {
        private const val TAG = "DoubaoSpeechService"

        // WebSocket API地址 - 使用双向流式模式（优化版本）
        private const val WS_URL = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async"

        // 协议版本和Header大小
        private const val PROTOCOL_VERSION: Byte = 0b0001
        private const val DEFAULT_HEADER_SIZE: Byte = 0b0001  // 实际header大小 = 1 * 4 = 4字节

        // 消息类型
        private const val CLIENT_FULL_REQUEST: Byte = 0b0001
        private const val CLIENT_AUDIO_ONLY_REQUEST: Byte = 0b0010
        private const val SERVER_FULL_RESPONSE: Byte = 0b1001
        private const val SERVER_ERROR_RESPONSE: Byte = 0b1111

        // Message Type Specific Flags
        private const val NO_SEQUENCE: Byte = 0b0000
        private const val POS_SEQUENCE: Byte = 0b0001
        private const val NEG_SEQUENCE: Byte = 0b0010
        private const val NEG_WITH_SEQUENCE: Byte = 0b0011

        // 序列化方法
        private const val NO_SERIALIZATION: Byte = 0b0000
        private const val JSON: Byte = 0b0001

        // 压缩方法
        private const val NO_COMPRESSION: Byte = 0b0000
        private const val GZIP: Byte = 0b0001

        // 音频参数
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = 1  // 单声道
        private const val BITS_PER_SAMPLE = 16
    }

    private var webSocket: WebSocket? = null
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .pingInterval(20, TimeUnit.SECONDS)
        .build()

    private var isConnected = false
    private var sequenceNumber = 1

    // 识别结果流
    private val _recognitionResult = MutableStateFlow<String>("")
    val recognitionResult: StateFlow<String> = _recognitionResult

    // 识别状态
    private val _isRecognizing = MutableStateFlow(false)
    val isRecognizing: StateFlow<Boolean> = _isRecognizing

    // 错误信息
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage

    // 连接ID
    private var connectId: String = ""
    
    // 当前连接配置（用于日志）
    private var currentResourceId: String = ""
    private var currentAppKey: String = ""

    /**
     * 连接WebSocket并开始识别
     * @param appKey 火山引擎APP ID
     * @param accessKey 火山引擎Access Token
     * @param resourceId 资源ID
     */
    fun connect(
        appKey: String,
        accessKey: String,
        resourceId: String = "volc.bigasr.sauc.concurrent"
    ) {
        // 保存配置
        currentResourceId = resourceId
        currentAppKey = appKey
        
        Log.d(TAG, "Connecting with resourceId: $resourceId, appKey: $appKey")
        
        // 如果已有连接，先强制关闭
        if (webSocket != null || isConnected) {
            Log.w(TAG, "Force closing existing connection before new connect")
            forceCloseConnection()
            // 等待服务器释放并发计数
            Thread.sleep(500)
        }

        connectId = UUID.randomUUID().toString()
        sequenceNumber = 1

        val request = Request.Builder()
            .url(WS_URL)
            .header("X-Api-App-Key", appKey)
            .header("X-Api-Access-Key", accessKey)
            .header("X-Api-Resource-Id", resourceId)
            .header("X-Api-Connect-Id", connectId)
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                val logid = response.header("X-Tt-Logid")
                Log.d(TAG, "WebSocket connected, logid: $logid")
                Log.d(TAG, "Using resourceId: $currentResourceId")
                isConnected = true
                _isRecognizing.value = true
                _errorMessage.value = null

                // 发送初始请求参数
                sendFullClientRequest()
            }

            override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                handleBinaryMessage(bytes.toByteArray())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d(TAG, "Received text message: $text")
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closing: $code, $reason")
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closed: $code, $reason")
                isConnected = false
                _isRecognizing.value = false
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket error: ${t.message}", t)
                isConnected = false
                _isRecognizing.value = false
                _errorMessage.value = t.message
            }
        })
    }

    /**
     * 发送完整客户端请求 (Full Client Request)
     */
    private fun sendFullClientRequest() {
        val requestJson = JSONObject().apply {
            put("user", JSONObject().apply {
                put("uid", "android_user_${System.currentTimeMillis()}")
            })
            put("audio", JSONObject().apply {
                put("format", "pcm")
                put("rate", SAMPLE_RATE)
                put("bits", BITS_PER_SAMPLE)
                put("channel", CHANNEL_CONFIG)
                put("codec", "raw")
            })
            put("request", JSONObject().apply {
                put("model_name", "bigmodel")
                put("enable_itn", true)
                put("enable_punc", true)
                put("enable_ddc", true)
            })
        }

        val payloadStr = requestJson.toString()
        val payloadBytes = gzipCompress(payloadStr.toByteArray(Charsets.UTF_8))
        
        Log.d(TAG, "Sending full client request: $payloadStr")
        Log.d(TAG, "Payload size: ${payloadBytes.size} bytes (compressed)")

        // 构建完整请求: header + sequence + payload size + payload
        val header = buildHeader(
            messageType = CLIENT_FULL_REQUEST,
            messageTypeSpecificFlags = POS_SEQUENCE,
            serialMethod = JSON,
            compressionType = GZIP
        )
        
        val seqBytes = intToBytes(sequenceNumber++)
        val payloadSizeBytes = intToBytes(payloadBytes.size)

        val message = ByteArray(header.size + seqBytes.size + payloadSizeBytes.size + payloadBytes.size)
        System.arraycopy(header, 0, message, 0, header.size)
        System.arraycopy(seqBytes, 0, message, header.size, seqBytes.size)
        System.arraycopy(payloadSizeBytes, 0, message, header.size + seqBytes.size, payloadSizeBytes.size)
        System.arraycopy(payloadBytes, 0, message, header.size + seqBytes.size + payloadSizeBytes.size, payloadBytes.size)

        webSocket?.send(ByteString.of(*message))
        Log.d(TAG, "Sent full client request, seq: ${sequenceNumber - 1}")
    }

    /**
     * 发送音频数据
     * @param audioData PCM音频数据
     * @param isLast 是否为最后一包
     */
    fun sendAudioData(audioData: ByteArray, isLast: Boolean = false) {
        if (!isConnected) {
            Log.w(TAG, "Not connected, cannot send audio")
            return
        }

        val seq = if (isLast) -sequenceNumber else sequenceNumber
        if (!isLast) sequenceNumber++

        val messageTypeSpecificFlags: Byte = if (isLast) NEG_WITH_SEQUENCE else POS_SEQUENCE
        
        val header = buildHeader(
            messageType = CLIENT_AUDIO_ONLY_REQUEST,
            messageTypeSpecificFlags = messageTypeSpecificFlags,
            serialMethod = NO_SERIALIZATION,
            compressionType = NO_COMPRESSION
        )
        
        val seqBytes = intToBytes(seq)
        val payloadSizeBytes = intToBytes(audioData.size)

        val message = ByteArray(header.size + seqBytes.size + payloadSizeBytes.size + audioData.size)
        System.arraycopy(header, 0, message, 0, header.size)
        System.arraycopy(seqBytes, 0, message, header.size, seqBytes.size)
        System.arraycopy(payloadSizeBytes, 0, message, header.size + seqBytes.size, payloadSizeBytes.size)
        System.arraycopy(audioData, 0, message, header.size + seqBytes.size + payloadSizeBytes.size, audioData.size)

        webSocket?.send(ByteString.of(*message))
        Log.d(TAG, "Sent audio data: ${audioData.size} bytes, seq: $seq, isLast: $isLast")
    }

    /**
     * 构建协议Header (4字节)
     */
    private fun buildHeader(
        messageType: Byte,
        messageTypeSpecificFlags: Byte,
        serialMethod: Byte,
        compressionType: Byte
    ): ByteArray {
        val header = ByteArray(4)
        header[0] = ((PROTOCOL_VERSION.toInt() shl 4) or DEFAULT_HEADER_SIZE.toInt()).toByte()
        header[1] = ((messageType.toInt() shl 4) or messageTypeSpecificFlags.toInt()).toByte()
        header[2] = ((serialMethod.toInt() shl 4) or compressionType.toInt()).toByte()
        header[3] = 0
        return header
    }

    /**
     * 将Int转为4字节大端序数组
     */
    private fun intToBytes(value: Int): ByteArray {
        return byteArrayOf(
            ((value shr 24) and 0xFF).toByte(),
            ((value shr 16) and 0xFF).toByte(),
            ((value shr 8) and 0xFF).toByte(),
            (value and 0xFF).toByte()
        )
    }

    /**
     * 将4字节大端序数组转为Int
     */
    private fun bytesToInt(bytes: ByteArray): Int {
        require(bytes.size == 4) { "Byte array must be 4 bytes" }
        return ((bytes[0].toInt() and 0xFF) shl 24) or
               ((bytes[1].toInt() and 0xFF) shl 16) or
               ((bytes[2].toInt() and 0xFF) shl 8) or
               (bytes[3].toInt() and 0xFF)
    }

    /**
     * Gzip压缩
     */
    private fun gzipCompress(data: ByteArray): ByteArray {
        val bos = ByteArrayOutputStream()
        GZIPOutputStream(bos).use { gzip ->
            gzip.write(data)
        }
        return bos.toByteArray()
    }

    /**
     * 处理二进制消息
     */
    private fun handleBinaryMessage(data: ByteArray) {
        if (data.size < 4) {
            Log.w(TAG, "Message too short: ${data.size} bytes")
            return
        }

        // 解析header
        val protocolVersion = (data[0].toInt() shr 4) and 0x0F
        val headerSize = data[0].toInt() and 0x0F
        val messageType = (data[1].toInt() shr 4) and 0x0F
        val messageTypeSpecificFlags = data[1].toInt() and 0x0F
        val serializationMethod = (data[2].toInt() shr 4) and 0x0F
        val messageCompression = data[2].toInt() and 0x0F

        Log.d(TAG, "Received: version=$protocolVersion, headerSize=$headerSize, " +
                "messageType=$messageType, flags=$messageTypeSpecificFlags, " +
                "serialization=$serializationMethod, compression=$messageCompression")

        // 提取payload (从headerSize * 4开始)
        var payload = data.copyOfRange(headerSize * 4, data.size)

        // 解析messageTypeSpecificFlags
        var hasSequence = false
        var isLastPackage = false
        var payloadSequence = 0

        if ((messageTypeSpecificFlags and 0x01) != 0) {
            hasSequence = true
            payloadSequence = bytesToInt(payload.copyOfRange(0, 4))
            payload = payload.copyOfRange(4, payload.size)
        }
        if ((messageTypeSpecificFlags and 0x02) != 0) {
            isLastPackage = true
        }

        // 解析messageType
        when (messageType.toByte()) {
            SERVER_FULL_RESPONSE -> {
                val payloadSize = bytesToInt(payload.copyOfRange(0, 4))
                payload = payload.copyOfRange(4, payload.size)
                
                Log.d(TAG, "Server response: seq=$payloadSequence, payloadSize=$payloadSize, isLast=$isLastPackage")
                
                val jsonStr = String(payload, Charsets.UTF_8)
                parseRecognitionResult(jsonStr)
                
                if (isLastPackage) {
                    Log.d(TAG, "Received last package")
                }
            }
            SERVER_ERROR_RESPONSE -> {
                val errorCode = bytesToInt(payload.copyOfRange(0, 4))
                val errorSize = bytesToInt(payload.copyOfRange(4, 8))
                payload = payload.copyOfRange(8, payload.size)
                
                val errorStr = String(payload, Charsets.UTF_8)
                Log.e(TAG, "Server error: code=$errorCode, size=$errorSize, msg=$errorStr")
                _errorMessage.value = errorStr
            }
            else -> {
                Log.d(TAG, "Unknown message type: $messageType")
            }
        }
    }

    /**
     * 解析识别结果
     */
    private fun parseRecognitionResult(jsonStr: String) {
        try {
            val json = JSONObject(jsonStr)
            val result = json.optJSONObject("result")

            if (result != null) {
                val text = result.optString("text", "")
                if (text.isNotEmpty()) {
                    _recognitionResult.value = text
                    Log.d(TAG, "Recognition result: $text")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse result: ${e.message}")
        }
    }

    /**
     * 强制关闭连接（不发送结束包）
     */
    private fun forceCloseConnection() {
        try {
            webSocket?.close(1000, "Force close")
        } catch (e: Exception) {
            Log.w(TAG, "Error force closing: ${e.message}")
        } finally {
            webSocket = null
            isConnected = false
            _isRecognizing.value = false
            sequenceNumber = 1
        }
    }

    /**
     * 断开连接
     */
    fun disconnect() {
        try {
            // 发送结束包
            if (isConnected) {
                sendAudioData(ByteArray(0), isLast = true)
                // 等待一小段时间确保结束包发送完成
                Thread.sleep(200)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error sending final packet: ${e.message}")
        } finally {
            webSocket?.close(1000, "User closed")
            webSocket = null
            isConnected = false
            _isRecognizing.value = false
            sequenceNumber = 1
        }
    }

    /**
     * 检查是否已连接
     */
    fun isConnected(): Boolean = isConnected
}
