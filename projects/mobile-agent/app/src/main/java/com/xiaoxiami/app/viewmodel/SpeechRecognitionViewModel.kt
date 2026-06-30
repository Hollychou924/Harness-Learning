package com.xiaoxiami.app.viewmodel

import android.app.Application
import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.xiaoxiami.app.service.DoubaoSpeechService
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * 语音识别ViewModel
 * 管理录音和语音转文字流程
 */
class SpeechRecognitionViewModel(application: Application) : AndroidViewModel(application) {

    companion object {
        private const val TAG = "SpeechRecognitionVM"

        // 音频参数 - 豆包语音识别要求 16kHz, 16bit, 单声道
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val BUFFER_SIZE = 3200  // 200ms音频数据 = 16000 * 2 * 0.2 = 6400 bytes
    }

    private val speechService = DoubaoSpeechService()
    private var audioRecord: AudioRecord? = null
    private var recordingJob: Job? = null

    // 录音状态
    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording.asStateFlow()

    // 识别结果
    private val _recognitionResult = MutableStateFlow("")
    val recognitionResult: StateFlow<String> = _recognitionResult.asStateFlow()

    // 实时识别文本（增量）
    private val _partialResult = MutableStateFlow("")
    val partialResult: StateFlow<String> = _partialResult.asStateFlow()

    // 错误信息
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // 是否正在识别中
    private val _isRecognizing = MutableStateFlow(false)
    val isRecognizing: StateFlow<Boolean> = _isRecognizing.asStateFlow()

    // 录音音量（用于波形显示）
    private val _audioLevel = MutableStateFlow(0f)
    val audioLevel: StateFlow<Float> = _audioLevel.asStateFlow()

    init {
        // 监听识别结果
        viewModelScope.launch {
            speechService.recognitionResult.collect { result ->
                if (result.isNotEmpty()) {
                    _partialResult.value = result
                }
            }
        }

        // 监听识别状态
        viewModelScope.launch {
            speechService.isRecognizing.collect { isRecognizing ->
                _isRecognizing.value = isRecognizing
            }
        }

        // 监听错误信息
        viewModelScope.launch {
            speechService.errorMessage.collect { error ->
                _errorMessage.value = error
            }
        }
    }

    /**
     * 开始录音和识别
     * 🆕 优化：先立即开始本地录音（防止前截断），同时异步连接语音服务
     */
    fun startRecording() {
        if (_isRecording.value) {
            Log.w(TAG, "Already recording")
            return
        }

        viewModelScope.launch(Dispatchers.IO) {
            try {
                // 🆕 1. 立即初始化并开始本地录音（不等待网络连接）
                val minBufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
                audioRecord = AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE,
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT,
                    minBufferSize.coerceAtLeast(BUFFER_SIZE * 2)
                )

                if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                    _errorMessage.value = "录音初始化失败"
                    return@launch
                }

                // 🆕 立即开始录音！防止前截断
                audioRecord?.startRecording()
                _isRecording.value = true
                _partialResult.value = ""
                _errorMessage.value = null
                Log.d(TAG, "🎤 Recording started IMMEDIATELY")
                
                // 🆕 2. 音频数据缓冲队列（在连接建立前缓存）
                val audioBuffer = mutableListOf<ByteArray>()
                var isServiceConnected = false

                // 🆕 3. 异步连接语音识别服务（不阻塞录音）
                val connectionJob = launch {
                    try {
                        // 🆕 ASR 配置 (Doubao Seed ASR Streaming 2.0)
                        // 实例ID/名称: Doubao_Seed_ASR_Streaming_2.02000000606777232770
                        val prefs = getApplication<Application>().getSharedPreferences("api_keys", Context.MODE_PRIVATE)
                        val appKey = prefs.getString("doubao_app_key", "5708140223") ?: "5708140223"
                        val accessKey = prefs.getString("doubao_access_key", "p6saOGazgxp2hel2hFis3Nro0iyO6DRA") ?: "p6saOGazgxp2hel2hFis3Nro0iyO6DRA"
                        // Secret Key: 4v8B2tR_MRbwFYdLp44ieE25uUPmv22U (备用)

                        if (appKey.isEmpty() || accessKey.isEmpty()) {
                            _errorMessage.value = "请先配置豆包API密钥"
                            return@launch
                        }

                        speechService.connect(
                            appKey = appKey,
                            accessKey = accessKey,
                            resourceId = "volc.seedasr.sauc.duration"
                        )

                        var retryCount = 0
                        while (!speechService.isConnected() && retryCount < 50) {
                            delay(100)
                            retryCount++
                        }

                        if (speechService.isConnected()) {
                            Log.d(TAG, "🔗 Speech service connected, sending buffered audio...")
                            isServiceConnected = true
                            
                            // 🆕 发送缓冲的音频数据
                            synchronized(audioBuffer) {
                                audioBuffer.forEach { data ->
                                    speechService.sendAudioData(data, isLast = false)
                                }
                                audioBuffer.clear()
                            }
                        } else {
                            Log.w(TAG, "⚠️ Speech service connection timeout")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Connection error: ${e.message}")
                    }
                }

                // 🆕 4. 启动录音循环（立即开始采集）
                recordingJob = launch {
                    val buffer = ByteArray(BUFFER_SIZE)
                    while (_isRecording.value && isActive) {
                        val readSize = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                        if (readSize > 0) {
                            val audioData = buffer.copyOf(readSize)
                            
                            if (isServiceConnected) {
                                // 连接已建立，直接发送
                                speechService.sendAudioData(audioData, isLast = false)
                            } else {
                                // 连接未建立，缓存数据
                                synchronized(audioBuffer) {
                                    audioBuffer.add(audioData)
                                }
                            }

                            // 计算音量级别
                            calculateAudioLevel(audioData)
                        }
                    }
                }

            } catch (e: Exception) {
                Log.e(TAG, "Failed to start recording: ${e.message}", e)
                _errorMessage.value = "启动录音失败: ${e.message}"
                stopRecording()
            }
        }
    }

    /**
     * 停止录音并获取最终识别结果
     */
    fun stopRecording() {
        if (!_isRecording.value) {
            return
        }

        viewModelScope.launch(Dispatchers.IO) {
            try {
                // 停止录音任务
                recordingJob?.cancel()
                recordingJob = null

                // 停止录音
                audioRecord?.stop()
                audioRecord?.release()
                audioRecord = null

                // 发送结束包并断开连接
                speechService.disconnect()

                // 保存最终识别结果
                if (_partialResult.value.isNotEmpty()) {
                    _recognitionResult.value = _partialResult.value
                }

                _isRecording.value = false
                _audioLevel.value = 0f

                Log.d(TAG, "Recording stopped, result: ${_recognitionResult.value}")

            } catch (e: Exception) {
                Log.e(TAG, "Error stopping recording: ${e.message}", e)
                _isRecording.value = false
            }
        }
    }

    /**
     * 取消录音（不保存结果）
     */
    fun cancelRecording() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                // 停止录音任务
                recordingJob?.cancel()
                recordingJob = null

                // 停止录音
                audioRecord?.stop()
                audioRecord?.release()
                audioRecord = null

                // 断开连接
                speechService.disconnect()

                // 清空结果
                _partialResult.value = ""
                _isRecording.value = false
                _audioLevel.value = 0f

                Log.d(TAG, "Recording cancelled")

            } catch (e: Exception) {
                Log.e(TAG, "Error cancelling recording: ${e.message}", e)
                _isRecording.value = false
            }
        }
    }

    /**
     * 计算音频音量级别（用于波形显示）
     */
    private fun calculateAudioLevel(audioData: ByteArray) {
        var sum = 0.0
        var i = 0
        while (i < audioData.size - 1) {
            val sample = (audioData[i + 1].toInt() shl 8) or (audioData[i].toInt() and 0xFF)
            sum += sample * sample
            i += 2
        }
        val rms = kotlin.math.sqrt(sum / (audioData.size / 2))
        val db = 20 * kotlin.math.log10(rms.coerceAtLeast(1.0))
        // 归一化到 0-1 范围
        val normalizedLevel = ((db + 60) / 60).coerceIn(0.0, 1.0).toFloat()
        _audioLevel.value = normalizedLevel
    }

    /**
     * 清空识别结果
     */
    fun clearResult() {
        _recognitionResult.value = ""
        _partialResult.value = ""
    }

    /**
     * 保存API密钥
     */
    fun saveApiKeys(appKey: String, accessKey: String) {
        val prefs = getApplication<Application>().getSharedPreferences("api_keys", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString("doubao_app_key", appKey)
            putString("doubao_access_key", accessKey)
            apply()
        }
    }

    /**
     * 获取API密钥
     */
    fun getApiKeys(): Pair<String, String> {
        val prefs = getApplication<Application>().getSharedPreferences("api_keys", Context.MODE_PRIVATE)
        val appKey = prefs.getString("doubao_app_key", "") ?: ""
        val accessKey = prefs.getString("doubao_access_key", "") ?: ""
        return Pair(appKey, accessKey)
    }

    override fun onCleared() {
        super.onCleared()
        cancelRecording()
    }
}
