package com.xiaoxiami.app.utils

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.view.View
import android.view.WindowManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.util.Log
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import java.io.FileOutputStream
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import android.view.ViewGroup
import android.widget.FrameLayout
import android.net.Uri
import android.content.ContentValues
import android.provider.MediaStore

/**
 * HTML 转图片生成器
 * 使用 WebView 渲染 HTML 并截取长图
 */
object HtmlImageGenerator {
    private const val TAG = "HtmlImageGenerator"

    /**
     * 保存 Bitmap 到相册
     */
    fun saveBitmapToGallery(context: Context, bitmap: Bitmap, title: String): Uri? {
        val filename = "${title}_${System.currentTimeMillis()}.jpg"
        var fos: java.io.OutputStream? = null
        var imageUri: Uri? = null
        
        try {
            val contentResolver = context.contentResolver
            val contentValues = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
                put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg")
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    put(MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_PICTURES + "/Xiaoxiami")
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
            }

            imageUri = contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
            
            if (imageUri != null) {
                fos = contentResolver.openOutputStream(imageUri)
                if (fos != null) {
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 100, fos)
                }
                
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    contentValues.clear()
                    contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                    contentResolver.update(imageUri, contentValues, null, null)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        } finally {
            try {
                fos?.close()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return imageUri
    }

    /**
     * 保存 Bitmap 到缓存用于分享
     */
    fun saveBitmapForSharing(context: Context, bitmap: Bitmap): Uri? {
        try {
            val cachePath = File(context.cacheDir, "images")
            cachePath.mkdirs() // don't forget to make the directory
            val stream = FileOutputStream("$cachePath/share_image.png") // overwrites this image every time
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            stream.close()

            val imagePath = File(context.cacheDir, "images")
            val newFile = File(imagePath, "share_image.png")
            
            return androidx.core.content.FileProvider.getUriForFile(
                context, 
                "${context.packageName}.fileprovider", 
                newFile
            )
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }

    /**
     * 将 HTML 字符串转换为图片文件
     * 
     * @param context Context
     * @param htmlContent HTML 源码
     * @param outputPath 图片保存路径
     * @return 生成的图片文件 File
     */
    suspend fun generateImage(context: Context, htmlContent: String, outputDir: File, fileName: String): File? = suspendCancellableCoroutine { continuation ->
        val mainHandler = Handler(Looper.getMainLooper())
        
        mainHandler.post {
            try {
                // 1. 获取屏幕宽度的 Context (Application Context display metrics might differ)
                // Use a ContextThemeWrapper to ensure the WebView has access to theme attributes
                // This prevents issues where "headless" WebViews fail to render due to missing resources
                val themedContext = android.view.ContextThemeWrapper(context, android.R.style.Theme_DeviceDefault_Light_NoActionBar)
                
                val windowManager = themedContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
                val metrics = DisplayMetrics()
                windowManager.defaultDisplay.getMetrics(metrics)
                val screenWidth = metrics.widthPixels
                
                Log.d(TAG, "Starting HTML to Image generation. Screen Width: $screenWidth")

                // 2. 创建 WebView using Themed Context
                val webView = WebView(themedContext)
                
                // 3. 配置 WebView
                webView.settings.apply {
                    javaScriptEnabled = true // Enable JS for Tailwind
                    domStorageEnabled = true // Enable storage for CDN caching
                    useWideViewPort = true
                    loadWithOverviewMode = true
                    // 禁用缩放控件
                    setSupportZoom(false)
                    builtInZoomControls = false
                    displayZoomControls = false
                    
                    // Allow mixed content (http/https for CDNs)
                    mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    
                    // Force Light Mode to ensure text is black (avoids White Text on White Bg in Dark Mode)
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                        forceDark = android.webkit.WebSettings.FORCE_DARK_OFF
                    }
                }
                
                // Critical: Disable Hardware Acceleration for the WebView.
                // Modern WebViews often fail to draw to a software Bitmap Canvas when HW accelerated.
                webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null)
                
                // Add Console Logging
                webView.webChromeClient = object : android.webkit.WebChromeClient() {
                    override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                        Log.d(TAG, "WebView Console: ${consoleMessage?.message()} -- From line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
                        return true
                    }
                }
                
                // 确保 WebView 布局参数正确
                // 我们使用 MeasureSpec.UNSPECIFIED 来允许高度根据内容自动扩展
                // 宽度固定为屏幕宽度
                webView.layoutParams = ViewGroup.LayoutParams(screenWidth, ViewGroup.LayoutParams.WRAP_CONTENT)

                // 4. 加载数据
                // 注入 viewport meta 标签确保宽度适配
                // 注入基础 CSS 以防 Tailwind 加载失败
                val fallbackCss = """
                    <style>
                        body { margin: 0; padding: 0; background-color: #ffffff; color: #1a202c; font-family: sans-serif; }
                        * { box-sizing: border-box; }
                    </style>
                """.trimIndent()
                
                val standardHtml = """
                    <!DOCTYPE html>
                    <html>
                    <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                    $fallbackCss
                    </head>
                    <body>
                    ${htmlContent.replace("<!DOCTYPE html>", "")} 
                    </body>
                    </html>
                """.trimIndent()
                
                // 注意：如果原 HTML 已经有了 DOCTYPE 或 html/body 标签，这里只是简单包裹。
                // 更好的做法是依赖 Prompt 保证输出的是 body 片段，或者解析 HTML。
                // 这里我们假设 prompt 输出的是完整的 HTML，我们只为了确保 meta viewport 存在而做字符串检查
                
                val finalHtml = if (htmlContent.contains("<meta name=\"viewport\"")) {
                    // Inject fallback CSS even if existing HTML is used
                    if(htmlContent.contains("</head>")) {
                        htmlContent.replace("</head>", "$fallbackCss</head>")
                    } else {
                        htmlContent
                    }
                } else {
                    // 简单的注入 viewport
                    if (htmlContent.contains("<head>")) {
                        htmlContent.replace("<head>", "<head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no\">$fallbackCss")
                    } else {
                        standardHtml // Fallback format
                    }
                }

                webView.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        
                        // Increase delay to ensure full rendering (images, fonts, layout)
                        // 1500ms should be safe for most static content
                        mainHandler.postDelayed({
                            try {
                                if (view == null) {
                                    continuation.resume(null)
                                    return@postDelayed
                                }

                                // Force layout pass before measuring
                                view.measure(
                                    View.MeasureSpec.makeMeasureSpec(screenWidth, View.MeasureSpec.EXACTLY),
                                    View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
                                )
                                view.layout(0, 0, view.measuredWidth, view.measuredHeight)

                                val width = view.measuredWidth
                                val height = view.measuredHeight
                                
                                Log.d(TAG, "WebView final measure: ${width}x$height")
                                
                                if (width <= 0 || height <= 0) {
                                    Log.e(TAG, "Invalid dimensions after layout")
                                    continuation.resume(null)
                                    return@postDelayed
                                }
                                
                                // 6. 绘制 Bitmap
                                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                                val canvas = Canvas(bitmap)
                                // 白色背景
                                canvas.drawColor(android.graphics.Color.WHITE)
                                view.draw(canvas)
                                
                                // Check if bitmap is empty (optional debug)
                                // Log.d(TAG, "Bitmap generated: ${bitmap.byteCount} bytes")

                                // 7. 保存文件
                                if (!outputDir.exists()) outputDir.mkdirs()
                                val file = File(outputDir, fileName)
                                val outputStream = FileOutputStream(file)
                                bitmap.compress(Bitmap.CompressFormat.JPEG, 90, outputStream)
                                outputStream.flush()
                                outputStream.close()
                                
                                Log.d(TAG, "Image saved to: ${file.absolutePath} (Size: ${file.length()})")
                                
                                view.destroy()
                                continuation.resume(file)
                                
                            } catch (e: Exception) {
                                Log.e(TAG, "Error capturing View", e)
                                continuation.resumeWithException(e)
                            }
                        }, 2000) // 2000ms delay for Tailwind
                    }
                    
                    override fun onReceivedError(view: WebView?, request: android.webkit.WebResourceRequest?, error: android.webkit.WebResourceError?) {
                         Log.e(TAG, "WebView Error: ${error?.description} code: ${error?.errorCode}")
                    }
                }
                
                // 使用 loadDataWithBaseURL 并设置 http base url，有时候能更好处理特定样式
                // 这里加个 log 确认 html 内容长度
                Log.d(TAG, "Loading HTML content, length: ${finalHtml.length}")
                // Use a fake HTTP URL to allow CDN loading (some CDNs block file:// or null)
                webView.loadDataWithBaseURL("https://example.com/", finalHtml, "text/html", "utf-8", null)
                
            } catch (e: Exception) {
                Log.e(TAG, "Setup failed", e)
                continuation.resumeWithException(e)
            }
        }
    }
}
