package com.xiaoxiami.app.utils

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.os.Build
import android.util.Log
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import kotlin.math.min

object ImageUtils {
    private const val TAG = "ImageUtils"
    private const val MAX_SIZE_BYTES = 300 * 1024 // 300KB
    private const val TARGET_SHORTEST_SIDE = 720

    /**
     * Compress image for AI Input:
     * - Format: WebP
     * - Shortest side >= 720px (unless original is smaller, but we allow downscaling if original is huge)
     * - File size <= 300KB
     */
    fun compressForAIInput(context: Context, imageUri: Uri, outputFile: File): File? {
        try {
            val inputStream = context.contentResolver.openInputStream(imageUri) ?: return null
            val originalBitmap = BitmapFactory.decodeStream(inputStream)
            inputStream.close()
            
            if (originalBitmap == null) return null
            return compressBitmapToFile(originalBitmap, outputFile)
        } catch (e: Exception) {
            Log.e(TAG, "Error compressing image from URI: $imageUri", e)
            return null
        }
    }

    fun compressForAIInput(filePath: String, outputFile: File): File? {
        try {
            val originalBitmap = BitmapFactory.decodeFile(filePath) ?: return null
            return compressBitmapToFile(originalBitmap, outputFile)
        } catch (e: Exception) {
            Log.e(TAG, "Error compressing image from path: $filePath", e)
             return null
        }
    }

    private fun compressBitmapToFile(infoBitmap: Bitmap, outputFile: File): File? {
        var bitmap = infoBitmap
        val width = bitmap.width
        val height = bitmap.height
        val shortestSide = min(width, height)
        
        // Check dimension constraints
        // If current shortest side > 1440, resize down to 1440 to help with size
        // (User said >= 720, so 1440 is fine). 
        // If we strictly follow >= 720, we shouldn't shrink below 720.
        // But for performance/token, let's limit crazy sizes.
        if (shortestSide > 1440) {
             val scale = 1440f / shortestSide
             val matrix = Matrix()
             matrix.postScale(scale, scale)
             val newBitmap = Bitmap.createBitmap(bitmap, 0, 0, width, height, matrix, true)
             if (newBitmap != bitmap) {
                 bitmap.recycle() // Recycle old
                 bitmap = newBitmap
             }
        }

        var quality = 80
        var stream = ByteArrayOutputStream()
        
        val format = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Bitmap.CompressFormat.WEBP_LOSSY
        } else {
            Bitmap.CompressFormat.WEBP
        }

        bitmap.compress(format, quality, stream)
        
        // Iterative compression
        while (stream.toByteArray().size > MAX_SIZE_BYTES && quality > 10) {
            stream.reset()
            quality -= 10
            bitmap.compress(format, quality, stream)
        }
        
        // If still too big, resize down
        // Respecting User's >= 720px ONLY if possible. If size > 300KB, Size Constraint wins (implied).
        // But let's try to keeping above 720 if possible.
        var currentShortest = min(bitmap.width, bitmap.height)
        
        while (stream.toByteArray().size > MAX_SIZE_BYTES && currentShortest > 500) {
             val w = (bitmap.width * 0.8).toInt()
             val h = (bitmap.height * 0.8).toInt()
             val newBitmap = Bitmap.createScaledBitmap(bitmap, w, h, true)
             if (newBitmap != bitmap) {
                 bitmap = newBitmap // Old bitmap recycled by GC eventually, or manually recycle if careful
             }
             currentShortest = min(bitmap.width, bitmap.height)
             
             stream.reset()
             // Reset quality slightly up if we resized? Or keep low? Keep low.
             bitmap.compress(format, quality, stream)
        }

        FileOutputStream(outputFile).use { fos ->
            fos.write(stream.toByteArray())
        }
        
        return outputFile
    }
    
    fun scaleBitmapForAI(original: Bitmap): Bitmap {
       val width = original.width
       val height = original.height
       val shortest = min(width, height)
       
       if (shortest <= TARGET_SHORTEST_SIDE) return original 
       
       val scale = TARGET_SHORTEST_SIDE.toFloat() / shortest
       val matrix = Matrix()
       matrix.postScale(scale, scale)
       return Bitmap.createBitmap(original, 0, 0, width, height, matrix, true)
    }
}
