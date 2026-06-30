package com.xiaoxiami.app.utils

import android.content.Context
import android.net.Uri
import android.os.Environment
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object CameraUtils {
    fun createImageFile(context: Context): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir = context.getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile(
            "JPEG_${timeStamp}_",
            ".jpg",
            storageDir
        )
    }

    fun getUriForFile(context: Context, file: File): Uri {
        return FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
    }

    /**
     * 查询指定时间戳之后拍摄的照片
     */
    fun getImagesTakenAfter(context: Context, startTimeMs: Long): List<Pair<Uri, Long>> {
        val images = mutableListOf<Pair<Uri, Long>>()
        val projection = arrayOf(
            android.provider.MediaStore.Images.Media._ID,
            android.provider.MediaStore.Images.Media.DATE_TAKEN,
            android.provider.MediaStore.Images.Media.DATE_ADDED
        )
        // DATE_TAKEN 是毫秒，DATE_ADDED 是秒，优先使用 DATE_TAKEN
        val selection = "${android.provider.MediaStore.Images.Media.DATE_TAKEN} >= ?"
        val selectionArgs = arrayOf(startTimeMs.toString())
        val sortOrder = "${android.provider.MediaStore.Images.Media.DATE_TAKEN} DESC"

        context.contentResolver.query(
            android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            selectionArgs,
            sortOrder
        )?.use { cursor ->
            val idColumn = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Images.Media._ID)
            val dateTakenColumn = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Images.Media.DATE_TAKEN)
            
            while (cursor.moveToNext()) {
                val id = cursor.getLong(idColumn)
                val dateTaken = cursor.getLong(dateTakenColumn)
                
                val contentUri = android.content.ContentUris.withAppendedId(
                    android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    id
                )
                images.add(contentUri to dateTaken)
            }
        }
        return images
    }
}
