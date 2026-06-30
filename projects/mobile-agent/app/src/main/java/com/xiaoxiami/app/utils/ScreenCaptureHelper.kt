package com.xiaoxiami.app.utils

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.media.ImageReader
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import java.io.FileOutputStream
import kotlin.coroutines.resume

object ScreenCaptureHelper {

    suspend fun captureOnce(
        context: Context,
        resultCode: Int,
        data: Intent
    ): Uri? = suspendCancellableCoroutine { continuation ->
        val projectionManager =
            context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager
        val mediaProjection = projectionManager?.getMediaProjection(resultCode, data)
        if (mediaProjection == null) {
            continuation.resume(null)
            return@suspendCancellableCoroutine
        }

        val metrics = context.resources.displayMetrics
        val width = metrics.widthPixels
        val height = metrics.heightPixels
        val densityDpi = metrics.densityDpi
        val imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        val virtualDisplay = mediaProjection.createVirtualDisplay(
            "xiaoxiami_screen_capture",
            width,
            height,
            densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader.surface,
            null,
            null
        ) ?: run {
            mediaProjection.stop()
            continuation.resume(null)
            return@suspendCancellableCoroutine
        }

        val mainHandler = Handler(Looper.getMainLooper())

        fun cleanup() {
            runCatching { virtualDisplay.release() }
            runCatching { imageReader.close() }
            runCatching { mediaProjection.stop() }
        }

        fun resumeOnce(uri: Uri?) {
            if (continuation.isActive) {
                cleanup()
                continuation.resume(uri)
            }
        }

        imageReader.setOnImageAvailableListener({ reader ->
            val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
                val plane = image.planes.firstOrNull()
                if (plane == null) {
                    resumeOnce(null)
                    return@setOnImageAvailableListener
                }
                val buffer = plane.buffer
                val pixelStride = plane.pixelStride
                val rowStride = plane.rowStride
                val rowPadding = rowStride - pixelStride * width
                val bitmap = Bitmap.createBitmap(
                    width + rowPadding / pixelStride,
                    height,
                    Bitmap.Config.ARGB_8888
                )
                bitmap.copyPixelsFromBuffer(buffer)
                val cropped = Bitmap.createBitmap(bitmap, 0, 0, width, height)

                val file = File(context.cacheDir, "screen_capture_${System.currentTimeMillis()}.png")
                FileOutputStream(file).use { output ->
                    cropped.compress(Bitmap.CompressFormat.PNG, 100, output)
                }
                resumeOnce(Uri.fromFile(file))
            } catch (_: Exception) {
                resumeOnce(null)
            } finally {
                image.close()
            }
        }, mainHandler)

        mainHandler.postDelayed({
            val image = runCatching { imageReader.acquireLatestImage() }.getOrNull()
            if (image == null) {
                resumeOnce(null)
            } else {
                image.close()
            }
        }, 1800L)

        continuation.invokeOnCancellation {
            cleanup()
        }
    }
}
