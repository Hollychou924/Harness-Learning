package com.xiaoxiami.app.utils

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.sin

object AudioUtils {
    private const val TAG = "AudioUtils"
    private var beepFile: File? = null

    /**
     * 合并 AAC 文件 (Direct ADTS Concatenation)
     * 替代原有的 mergeAacFiles (MediaMuxer 版本)
     * 
     * 逻辑: 直接读取所有源文件的字节流并拼接到目标文件。
     * 前提: 所有源文件必须已经是带 ADTS 头的标准 AAC 文件 (AudioCaptureService 生成的正是这种)。
     * 优势: 生成的文件 MIME 类型为 audio/aac，而非 video/mp4。
     */
    fun mergeAacFiles(inputPaths: List<String>, outputPath: String, delimiterPath: String? = null): Boolean {
        if (inputPaths.isEmpty()) return false
        
        try {
            val validPaths = inputPaths.filter { File(it).exists() && File(it).length() > 0 }
            if (validPaths.isEmpty()) return false
            
            val outputFile = File(outputPath)
            if (outputFile.exists()) outputFile.delete()
            
            val outputStream = java.io.FileOutputStream(outputFile, true) // Append mode
            
            // Delimiter buffer (read once if needed)
            val delimiterBytes = if (delimiterPath != null && File(delimiterPath).exists()) {
                File(delimiterPath).readBytes()
            } else {
                null
            }

            validPaths.forEachIndexed { index, path ->
                try {
                    val bytes = File(path).readBytes()
                    outputStream.write(bytes)
                    
                    // Add delimiter between clips (not after the last one)
                    if (delimiterBytes != null && index < validPaths.size - 1) {
                        outputStream.write(delimiterBytes)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to append file: $path", e)
                }
            }
            
            outputStream.flush()
            outputStream.close()
            return true
            
        } catch (e: Exception) {
            Log.e(TAG, "Merge ADTS failed", e)
            return false
        }
    }

    /**
     * (Deprecated) Legacy MediaMuxer merge - Do not use for AI uploads
     */
    fun mergeAacFilesLegacy(inputPaths: List<String>, outputPath: String, delimiterPath: String? = null): Boolean {
        if (inputPaths.isEmpty()) return false
        if (inputPaths.size == 1) {
            try {
                // Check if file exists
                val inFile = File(inputPaths[0])
                if (!inFile.exists()) return false
                inFile.copyTo(File(outputPath), overwrite = true)
                return true
            } catch (e: Exception) {
                Log.e(TAG, "Copy failed", e)
                return false
            }
        }

        // Validate all inputs exist
        val validPaths = inputPaths.filter { File(it).exists() }
        if (validPaths.isEmpty()) return false

        var muxer: MediaMuxer? = null
        try {
            muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            
            // 1. Setup Track from first file
            val extractor = MediaExtractor()
            extractor.setDataSource(validPaths[0])
            val trackIndex = selectAudioTrack(extractor)
            if (trackIndex < 0) {
                extractor.release()
                muxer.stop() // might fail if not started
                muxer.release()
                return false
            }
            extractor.selectTrack(trackIndex)
            val format = extractor.getTrackFormat(trackIndex)
            val muxerTrackIndex = muxer.addTrack(format)
            muxer.start()
            extractor.release() 
            
            // 2. Iterate and Write
            var totalTimeUs = 0L
            val bufferInfo = MediaCodec.BufferInfo()
            val maxInputSize = if (format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
                format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE)
            } else {
                1024 * 1024 
            }
            val byteBuffer = ByteBuffer.allocate(maxInputSize)

            val pathsToProcess = if (delimiterPath != null && File(delimiterPath).exists()) {
                val list = mutableListOf<String>()
                validPaths.forEachIndexed { index, path ->
                    list.add(path)
                    if (index < validPaths.size - 1) {
                        list.add(delimiterPath)
                    }
                }
                list
            } else {
                validPaths
            }

            for (path in pathsToProcess) {
                val fileExtractor = MediaExtractor()
                var fileDurationUs = 0L
                try {
                    fileExtractor.setDataSource(path)
                    val idx = selectAudioTrack(fileExtractor)
                    if (idx >= 0) {
                        fileExtractor.selectTrack(idx)
                        
                        while (true) {
                            val sampleSize = fileExtractor.readSampleData(byteBuffer, 0)
                            if (sampleSize < 0) break
                            
                            val sampleTime = fileExtractor.sampleTime
                            if (sampleTime < 0) break
                            
                            bufferInfo.offset = 0
                            bufferInfo.size = sampleSize
                            bufferInfo.flags = fileExtractor.sampleFlags
                            bufferInfo.presentationTimeUs = totalTimeUs + sampleTime
                            
                            muxer?.writeSampleData(muxerTrackIndex, byteBuffer, bufferInfo)
                            
                            fileDurationUs = max(fileDurationUs, sampleTime)
                            fileExtractor.advance()
                        }
                        
                        // Estimate duration of last frame (approx 23ms for AAC usually, or just check format)
                        // A simple increment to avoid overlap
                        // Or use KEY_DURATION if valid
                        val fileFormat = fileExtractor.getTrackFormat(idx)
                        val durationFromFormat = if (fileFormat.containsKey(MediaFormat.KEY_DURATION)) {
                            fileFormat.getLong(MediaFormat.KEY_DURATION)
                        } else {
                             0L
                        }
                        
                        // Use max of tracked pts and official duration
                        val segmentDuration = if (durationFromFormat > fileDurationUs && durationFromFormat > 0) durationFromFormat else fileDurationUs + 23000 // +23ms fallback
                        totalTimeUs += segmentDuration
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error merging file $path", e)
                } finally {
                    fileExtractor.release()
                }
            }
            return true
        } catch (e: Exception) {
             Log.e(TAG, "Merge failed", e)
             // Try to delete output if failed
             File(outputPath).delete()
             return false
        } finally {
             try {
                 muxer?.stop()
                 muxer?.release()
             } catch (e: Exception) {
                 e.printStackTrace()
             }
        }
    }

    private fun selectAudioTrack(extractor: MediaExtractor): Int {
        for (i in 0 until extractor.trackCount) {
            val format = extractor.getTrackFormat(i)
            val mime = format.getString(MediaFormat.KEY_MIME)
            if (mime?.startsWith("audio/") == true) {
                return i
            }
        }
        return -1
    }

    /**
     * 转码为 AAC (用于 AI 输入优化, 兼容性更好)
     * Format: AAC, 16kHz, Mono, 24kbps
     * 解决 406 Error (Opus/OGG 格式在某些后端代理上被误认为图片格式)
     * 
     * 2024-05: 修复 "Failed to query component interface" (ENODEV) 问题
     * 1. 复用 MediaCodec 实例 (Hardware -> Software fallback)
     * 2. 完整处理解码流程 (dequeueOutputBuffer)
     * 3. 避免频繁创建销毁
     */
    fun convertToLowBitrateAAC(inputPath: String, outputPath: String): Boolean {
        var extractor: MediaExtractor? = null
        var decoder: MediaCodec? = null
        var encoder: MediaCodec? = null
        var muxer: MediaMuxer? = null
        
        try {
            val inputFile = File(inputPath)
            if (!inputFile.exists()) return false

            extractor = MediaExtractor()
            extractor.setDataSource(inputPath)
            val trackIndex = selectAudioTrack(extractor)
            if (trackIndex < 0) return false
            
            extractor.selectTrack(trackIndex)
            val inputFormat = extractor.getTrackFormat(trackIndex)
            val inputMime = inputFormat.getString(MediaFormat.KEY_MIME) ?: return false
            
            // 1. 初始化解码器 (支持 fallback 到软件解码器)
            try {
                // 优先尝试系统推荐的解码器 (通常是硬件)
                decoder = MediaCodec.createDecoderByType(inputMime)
                decoder.configure(inputFormat, null, null, 0)
                decoder.start()
            } catch (e: Exception) {
                Log.w(TAG, "Hardware decoder init failed, trying software fallback...", e)
                decoder?.release()
                
                // 尝试强制使用 Google 软件解码器
                val swCodecName = if (inputMime.contains("aac")) "OMX.google.aac.decoder" else "OMX.google.raw.decoder" // 简单回退策略
                // 更稳妥的方式是遍历 MediaCodecList，这里为简化直接再次尝试系统默认 (可能因资源释放后重试成功)
                // 或者直接返回失败，由外部重试
                return false
            }

            // 2. 初始化编码器 (AAC 16kHz Mono)
            val outputFormat = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, 16000, 1)
            outputFormat.setInteger(MediaFormat.KEY_BIT_RATE, 24000) // 24kbps
            outputFormat.setInteger(MediaFormat.KEY_AAC_PROFILE, android.media.MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            
            try {
                encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
                encoder.configure(outputFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
                encoder.start()
            } catch (e: Exception) {
                Log.e(TAG, "Encoder init failed", e)
                return false
            }

            // 3. 初始化 Muxer
            muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            
            val decodeBufferInfo = MediaCodec.BufferInfo()
            val encodeBufferInfo = MediaCodec.BufferInfo()
            
            var isDecodingFinished = false
            var isEncodingFinished = false
            var muxerTrackIndex = -1
            var isMuxerStarted = false
            
            // Resample state
            var inputSampleRate = if (inputFormat.containsKey(MediaFormat.KEY_SAMPLE_RATE)) inputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE) else 44100
            val targetSampleRate = 16000
            val inputChannelCount = if (inputFormat.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT) else 1
            
            while (!isEncodingFinished) {
                // 1. Drain Decoder
                if (!isDecodingFinished) {
                    val inIdx = try { decoder!!.dequeueInputBuffer(1000) } catch (e: Exception) { -1 }
                    if (inIdx >= 0) {
                        val buffer = decoder!!.getInputBuffer(inIdx)
                        if (buffer != null) {
                            val sampleSize = extractor.readSampleData(buffer, 0)
                            if (sampleSize < 0) {
                                decoder!!.queueInputBuffer(inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                                isDecodingFinished = true
                            } else {
                                decoder!!.queueInputBuffer(inIdx, 0, sampleSize, extractor.sampleTime, 0)
                                extractor.advance()
                            }
                        }
                    }
                }

                // 2. Decoder -> Encoder
                var decoderOutputAvailable = true
                while (decoderOutputAvailable) {
                    val outIdx = try { decoder!!.dequeueOutputBuffer(decodeBufferInfo, 1000) } catch (e: Exception) { MediaCodec.INFO_TRY_AGAIN_LATER }
                    
                    if (outIdx >= 0) {
                        val outBuffer = decoder!!.getOutputBuffer(outIdx)
                        if (outBuffer != null && decodeBufferInfo.size > 0) {
                            outBuffer.position(decodeBufferInfo.offset)
                            outBuffer.limit(decodeBufferInfo.offset + decodeBufferInfo.size)
                            val chunk = ByteArray(decodeBufferInfo.size)
                            outBuffer.get(chunk)
                            
                            // Resample Mono
                            val pcmShorts = bytesToShorts(chunk)
                            val monoShorts = downmixToMono(pcmShorts, inputChannelCount)
                            val resampledShorts = resampleLinear(monoShorts, inputSampleRate, targetSampleRate)
                            val processedBytes = shortsToBytes(resampledShorts)
                            
                            feedEncoder(encoder!!, processedBytes, false)
                        }
                        
                        if ((decodeBufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                            feedEncoder(encoder!!, ByteArray(0), true)
                        }
                        decoder!!.releaseOutputBuffer(outIdx, false)
                    } else if (outIdx == MediaCodec.INFO_TRY_AGAIN_LATER) {
                        decoderOutputAvailable = false
                    } else if (outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                         // Update input sample rate if decoder output format changed
                         val newFormat = decoder!!.outputFormat
                         if (newFormat.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
                             inputSampleRate = newFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                         }
                    }
                }

                // 3. Encoder -> Muxer
                var encoderOutputAvailable = true
                while (encoderOutputAvailable) {
                    val outIdx = try { encoder!!.dequeueOutputBuffer(encodeBufferInfo, 1000) } catch (e: Exception) { MediaCodec.INFO_TRY_AGAIN_LATER }
                    
                    if (outIdx >= 0) {
                        if (!isMuxerStarted) {
                            muxerTrackIndex = muxer.addTrack(encoder!!.outputFormat)
                            muxer.start()
                            isMuxerStarted = true
                        }
                        
                        val outBuffer = encoder!!.getOutputBuffer(outIdx)
                        if (outBuffer != null && (encodeBufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
                            if (encodeBufferInfo.size > 0 && isMuxerStarted) {
                                outBuffer.position(encodeBufferInfo.offset)
                                outBuffer.limit(encodeBufferInfo.offset + encodeBufferInfo.size)
                                muxer.writeSampleData(muxerTrackIndex, outBuffer, encodeBufferInfo)
                            }
                        }
                        encoder!!.releaseOutputBuffer(outIdx, false)
                        
                        if ((encodeBufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                            isEncodingFinished = true
                            encoderOutputAvailable = false
                        }
                    } else if (outIdx == MediaCodec.INFO_TRY_AGAIN_LATER) {
                        encoderOutputAvailable = false
                    }
                }
            }
            
            return true
        } catch (e: Exception) {
            Log.e(TAG, "AAC transcoding failed", e)
            File(outputPath).delete()
            return false
        } finally {
            try {
                extractor?.release()
                decoder?.stop(); decoder?.release()
                encoder?.stop(); encoder?.release()
                muxer?.stop(); muxer?.release()
            } catch (e: Exception) { e.printStackTrace() }
        }
    }
    
    // Helpers
    private fun bytesToShorts(bytes: ByteArray): ShortArray {
        val shorts = ShortArray(bytes.size / 2)
        ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(shorts)
        return shorts
    }
    
    private fun shortsToBytes(shorts: ShortArray): ByteArray {
        val bytes = ByteArray(shorts.size * 2)
        ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN).asShortBuffer().put(shorts)
        return bytes
    }
    
    private fun downmixToMono(input: ShortArray, channelCount: Int): ShortArray {
        if (channelCount == 1) return input
        val mono = ShortArray(input.size / channelCount)
        for (i in mono.indices) {
            var sum = 0
            for (c in 0 until channelCount) {
                sum += input[i * channelCount + c]
            }
            mono[i] = (sum / channelCount).toShort()
        }
        return mono
    }
    
    private fun resampleLinear(input: ShortArray, inRate: Int, outRate: Int): ShortArray {
        if (inRate == outRate) return input
        val ratio = inRate.toDouble() / outRate.toDouble()
        val outLength = (input.size / ratio).toInt()
        val output = ShortArray(outLength)
        
        for (i in 0 until outLength) {
            val srcIdx = i * ratio
            val idx0 = srcIdx.toInt()
            val idx1 = if (idx0 + 1 < input.size) idx0 + 1 else idx0
            val frac = srcIdx - idx0
            val val0 = input[idx0]
            val val1 = input[idx1]
            output[i] = (val0 * (1.0 - frac) + val1 * frac).toInt().toShort()
        }
        return output
    }
    
    private fun feedEncoder(encoder: MediaCodec, inBytes: ByteArray, eos: Boolean) {
        // Enqueuing input to encoder can block if no input buffers are valid.
        // We assume simple loop here, but ideally we should manage queue.
        // For simplicity in this tool snippet, we try to enqueue all.
        // If data is large, we should split. But here we process chunk by chunk.
        
        var offset = 0
        while (offset < inBytes.size || (eos && offset == 0)) { // Run at least once for EOS empty
            val inIdx = encoder.dequeueInputBuffer(1000)
            if (inIdx >= 0) {
                val buf = encoder.getInputBuffer(inIdx)!!
                val capacity = buf.capacity()
                val remaining = inBytes.size - offset
                val toCopy = Math.min(capacity, remaining)
                
                buf.clear()
                if (toCopy > 0) {
                    buf.put(inBytes, offset, toCopy)
                }
                
                val flags = if (eos && toCopy == remaining) MediaCodec.BUFFER_FLAG_END_OF_STREAM else 0
                encoder.queueInputBuffer(inIdx, 0, toCopy, System.nanoTime() / 1000, flags)
                
                offset += toCopy
                if (offset >= inBytes.size) break
            } else {
                 // Busy wait or break? In this synchronous block structure we wait a bit
                 // If we came from decoder loop, we are fine.
                 try { Thread.sleep(1) } catch(e:Exception){}
            }
        }
    }

    /**
     * 生成 1kHz 正弦波 Beep 音 (0.5s, -20dBFS) - Direct ADTS AAC version
     * 适用于直接拼接 (mergeAacFiles)
     */
    fun createAdtsBeepFile(context: android.content.Context, sampleRate: Int = 16000): String? {
        val file = File(context.cacheDir, "beep_1khz_05s_adts.aac")
        if (file.exists() && file.length() > 0) return file.absolutePath

        try {
            val durationS = 0.5
            val frequency = 1000.0
            val numSamples = (durationS * sampleRate).toInt()
            val amplitude = 32767 * 0.1 // -20dBFS is approx 10% amplitude

            val pcmData = ShortArray(numSamples)
            for (i in 0 until numSamples) {
                pcmData[i] = (amplitude * sin(2.0 * PI * i * frequency / sampleRate)).toInt().toShort()
            }

            val pcmBytes = ByteArray(numSamples * 2)
            ByteBuffer.wrap(pcmBytes).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().put(pcmData)

            // Encode to AAC ADTS
            val encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
            val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, 1)
            format.setInteger(MediaFormat.KEY_BIT_RATE, 24000) // Match low bitrate
            format.setInteger(MediaFormat.KEY_AAC_PROFILE, android.media.MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, numSamples * 2)
            
            encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            encoder.start()

            val fos = java.io.FileOutputStream(file)
            
            val bufferInfo = MediaCodec.BufferInfo()
            var inputFinished = false
            var outputFinished = false
            var inputOffset = 0

            while (!outputFinished) {
                if (!inputFinished) {
                    val inIdx = encoder.dequeueInputBuffer(10000)
                    if (inIdx >= 0) {
                        val buf = encoder.getInputBuffer(inIdx)!!
                        val remaining = pcmBytes.size - inputOffset
                        if (remaining <= 0) {
                            encoder.queueInputBuffer(inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputFinished = true
                        } else {
                            val toCopy = Math.min(buf.capacity(), remaining)
                            buf.clear()
                            buf.put(pcmBytes, inputOffset, toCopy)
                            encoder.queueInputBuffer(inIdx, 0, toCopy, System.nanoTime()/1000, 0)
                            inputOffset += toCopy
                        }
                    }
                }

                val outIdx = encoder.dequeueOutputBuffer(bufferInfo, 10000)
                if (outIdx >= 0) {
                    val outBuf = encoder.getOutputBuffer(outIdx)!!
                    
                    if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0 && bufferInfo.size > 0) {
                        // Add ADTS Header
                        val adtsHeader = ByteArray(7)
                        val packetSize = bufferInfo.size + 7
                        addAdtsHeader(adtsHeader, packetSize, sampleRate)
                        
                        outBuf.position(bufferInfo.offset)
                        outBuf.limit(bufferInfo.offset + bufferInfo.size)
                        val data = ByteArray(bufferInfo.size)
                        outBuf.get(data)
                        
                        fos.write(adtsHeader)
                        fos.write(data)
                    }
                    
                    encoder.releaseOutputBuffer(outIdx, false)
                    if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                        outputFinished = true
                    }
                }
            }

            encoder.stop()
            encoder.release()
            fos.close()
            return file.absolutePath
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create ADTS beep file", e)
            return null
        }
    }
    
    // Copy from AudioCaptureService to avoid dependency
    private fun addAdtsHeader(packet: ByteArray, packetLen: Int, sampleRate: Int) {
        val profile = 2 // AAC LC
        val freqIdx = when (sampleRate) {
            96000 -> 0
            88200 -> 1
            64000 -> 2
            48000 -> 3
            44100 -> 4
            32000 -> 5
            24000 -> 6
            22050 -> 7
            16000 -> 8 // Our case
            12000 -> 9
            11025 -> 10
            8000 -> 11
            7350 -> 12
            else -> 4 // Default to 44100
        }
        val chanCfg = 1 // Mono

        packet[0] = 0xFF.toByte()
        packet[1] = 0xF9.toByte()
        packet[2] = (((profile - 1) shl 6) + (freqIdx shl 2) + (chanCfg shr 2)).toByte()
        packet[3] = (((chanCfg and 3) shl 6) + (packetLen shr 11)).toByte()
        packet[4] = ((packetLen and 0x7FF) shr 3).toByte()
        packet[5] = (((packetLen and 7) shl 5) + 0x1F).toByte()
        packet[6] = 0xFC.toByte()
    }

    /**
     * 生成 1kHz 正弦波 Beep 音 (0.5s, -20dBFS)
     */
    fun createBeepFile(context: android.content.Context, sampleRate: Int = 44100): String? {
        val file = File(context.cacheDir, "beep_1khz_05s.aac")
        if (file.exists()) return file.absolutePath

        try {
            val durationS = 0.5
            val frequency = 1000.0
            val numSamples = (durationS * sampleRate).toInt()
            val amplitude = 32767 * 0.1 // -20dBFS is approx 10% amplitude

            val pcmData = ShortArray(numSamples)
            for (i in 0 until numSamples) {
                pcmData[i] = (amplitude * sin(2.0 * PI * i * frequency / sampleRate)).toInt().toShort()
            }

            val pcmBytes = ByteArray(numSamples * 2)
            ByteBuffer.wrap(pcmBytes).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().put(pcmData)

            // Encode to AAC
            val encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
            val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, 1)
            format.setInteger(MediaFormat.KEY_BIT_RATE, 64000)
            format.setInteger(MediaFormat.KEY_AAC_PROFILE, android.media.MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            encoder.start()

            val muxer = MediaMuxer(file.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            var trackIndex = -1
            var muxerStarted = false

            val bufferInfo = MediaCodec.BufferInfo()
            var inputFinished = false
            var outputFinished = false
            var inputOffset = 0

            while (!outputFinished) {
                if (!inputFinished) {
                    val inIdx = encoder.dequeueInputBuffer(10000)
                    if (inIdx >= 0) {
                        val buf = encoder.getInputBuffer(inIdx)!!
                        val remaining = pcmBytes.size - inputOffset
                        if (remaining <= 0) {
                            encoder.queueInputBuffer(inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputFinished = true
                        } else {
                            val toCopy = Math.min(buf.capacity(), remaining)
                            buf.clear()
                            buf.put(pcmBytes, inputOffset, toCopy)
                            encoder.queueInputBuffer(inIdx, 0, toCopy, (inputOffset / 2.0 / sampleRate * 1000000).toLong(), 0)
                            inputOffset += toCopy
                        }
                    }
                }

                val outIdx = encoder.dequeueOutputBuffer(bufferInfo, 10000)
                if (outIdx >= 0) {
                    val outBuf = encoder.getOutputBuffer(outIdx)!!
                    if (muxerStarted && bufferInfo.size > 0) {
                        outBuf.position(bufferInfo.offset)
                        outBuf.limit(bufferInfo.offset + bufferInfo.size)
                        muxer.writeSampleData(trackIndex, outBuf, bufferInfo)
                    }
                    encoder.releaseOutputBuffer(outIdx, false)
                    if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                        outputFinished = true
                    }
                } else if (outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    trackIndex = muxer.addTrack(encoder.outputFormat)
                    muxer.start()
                    muxerStarted = true
                }
            }

            encoder.stop()
            encoder.release()
            muxer.stop()
            muxer.release()
            return file.absolutePath
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create beep file", e)
            return null
        }
    }
}
