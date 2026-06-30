package com.xiaoxiami.app.util

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.util.Log
import java.io.File
import java.nio.ByteBuffer
import kotlin.math.abs
import kotlin.math.max

object AudioWaveformExtractor {

    private const val TAG = "AudioWaveformExtractor"

    /**
     * Extracts a normalized amplitude waveform from an audio file.
     * @param path Absolute path to the audio file.
     * @param expectedPoints Approximate number of data points to generate.
     * @return List of normalized amplitudes (0.0 - 1.0).
     */
    fun extractWaveform(path: String, expectedPoints: Int = 1000): List<Float> {
        val file = File(path)
        if (!file.exists() || file.length() == 0L) {
             Log.e(TAG, "File not found or empty: $path")
             return emptyList()
        }

        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(path)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set data source", e)
            return emptyList()
        }

        var audioTrackIndex = -1
        var durationUs = 0L
        var sampleRate = 44100
        var channelCount = 1
        var mime = ""

        for (i in 0 until extractor.trackCount) {
            val format = extractor.getTrackFormat(i)
            mime = format.getString(MediaFormat.KEY_MIME) ?: ""
            if (mime.startsWith("audio/")) {
                audioTrackIndex = i
                durationUs = format.getLong(MediaFormat.KEY_DURATION)
                if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
                   sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                }
                if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
                   channelCount = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                }
                extractor.selectTrack(audioTrackIndex)
                break
            }
        }

        if (audioTrackIndex == -1) {
            Log.e(TAG, "No audio track found in $path")
            extractor.release()
            return emptyList()
        }

        val amplitudes = mutableListOf<Float>()
        
        // Setup MediaCodec
        val codec = try {
             MediaCodec.createDecoderByType(mime)
        } catch (e: Exception) {
             Log.e(TAG, "Failed to create decoder for $mime", e)
             extractor.release()
             return emptyList()
        }

        try {
            codec.configure(extractor.getTrackFormat(audioTrackIndex), null, null, 0)
            codec.start()
        } catch (e: Exception) {
             Log.e(TAG, "Failed to configure/start codec", e)
             codec.release()
             extractor.release()
             return emptyList()
        }
        
        val inputBuffers = codec.inputBuffers // Deprecated in API 21, but often needed for compatibility logic or use newer API
        // Using newer Buffer API loop
        
        val bufferInfo = MediaCodec.BufferInfo()
        var isEOS = false
        var outputDone = false
        
        // Sampling logic: We want 'expectedPoints' over the whole duration.
        // Duration in seconds = durationUs / 1,000,000
        // Total projected samples = DurationSec * SampleRate
        // Samples per point = TotalSamples / expectedPoints
        
        val totalProjectedSamples = (durationUs / 1_000_000.0 * sampleRate).toLong()
        val samplesPerPoint = max(1, totalProjectedSamples / expectedPoints).toInt()
        
        var currentPointMax = 0f
        var sampleAccumulatorCount = 0
        
        var globalPeak = 0f

        val timeoutUs = 5000L

        try {
            while (!outputDone) {
                if (!isEOS) {
                    val inputBufferIndex = codec.dequeueInputBuffer(timeoutUs)
                    if (inputBufferIndex >= 0) {
                        val inputBuffer = codec.getInputBuffer(inputBufferIndex)
                        if (inputBuffer != null) {
                            val sampleSize = extractor.readSampleData(inputBuffer, 0)
                            if (sampleSize < 0) {
                                codec.queueInputBuffer(inputBufferIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                                isEOS = true
                            } else {
                                val presentationTimeUs = extractor.sampleTime
                                codec.queueInputBuffer(inputBufferIndex, 0, sampleSize, presentationTimeUs, 0)
                                extractor.advance()
                            }
                        }
                    }
                }

                val outputBufferIndex = codec.dequeueOutputBuffer(bufferInfo, timeoutUs)
                if (outputBufferIndex >= 0) {
                    val outputBuffer = codec.getOutputBuffer(outputBufferIndex)
                    if (outputBuffer != null) {
                        // PCM Data processing
                        // Assuming 16-bit PCM (Short)
                        val chunk = ShortArray(bufferInfo.size / 2)
                        outputBuffer.asShortBuffer().get(chunk)
                        outputBuffer.clear()
                        
                        // Process this chunk
                        for (i in chunk.indices step channelCount) { // Skip other channels, take 1st
                             val amplitude = abs(chunk[i].toInt()).toFloat()
                             if (amplitude > currentPointMax) {
                                 currentPointMax = amplitude
                             }
                             
                             // Global Peak tracking for normalization later
                             if (amplitude > globalPeak) {
                                 globalPeak = amplitude
                             }

                             sampleAccumulatorCount++
                             if (sampleAccumulatorCount >= samplesPerPoint) {
                                 amplitudes.add(currentPointMax)
                                 currentPointMax = 0f
                                 sampleAccumulatorCount = 0
                             }
                        }
                    }
                    codec.releaseOutputBuffer(outputBufferIndex, false)
                    
                    if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                        outputDone = true
                    }
                } else if (outputBufferIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    // format changed, simple ignore or update layout
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error during decoding", e)
        } finally {
            try { codec.stop() } catch (e: Exception) {}
            try { codec.release() } catch (e: Exception) {}
            extractor.release()
        }

        // Normalize
        // If we have no points, return empty
        if (amplitudes.isEmpty()) return emptyList()
        
        // 16-bit PCM max is 32767. 
        // 修复: 强制使用绝对基准 32767f，不再使用局部峰值归一化，确保 dB 计算准确。
        val normalizationFactor = 32767f
        
        return amplitudes.map { it / normalizationFactor }
    }
}
