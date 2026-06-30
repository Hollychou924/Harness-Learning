package com.xiaoxiami.app.ui.chat

import android.Manifest
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.widget.Toast
import com.xiaoxiami.app.ui.memory.MemoryManagementPage
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.zIndex
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.xiaoxiami.app.R
import com.xiaoxiami.app.agent.ToolInteractionKind
import com.xiaoxiami.app.utils.ScreenCaptureHelper
import com.xiaoxiami.app.viewmodel.AgentExecutionStep
import com.xiaoxiami.app.viewmodel.AgentStepKind
import com.xiaoxiami.app.viewmodel.AgentStepStatus
import com.xiaoxiami.app.viewmodel.ChatViewModel
import com.xiaoxiami.app.viewmodel.SpeechRecognitionViewModel
import com.xiaoxiami.app.data.ChatMessage
import com.xiaoxiami.app.data.ChatSession
import dev.jeziellago.compose.markdowntext.MarkdownText
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.foundation.Canvas
import androidx.compose.ui.graphics.drawscope.rotate
import java.io.FileOutputStream

// 🆕 图片数量上限
const val MAX_IMAGES = 10

private enum class PendingMediaLaunchMode {
    CHAT_ATTACH,
    TOOL_INTERACTION
}

/**
 * 🆕 图片压缩工具函数
 * 压缩图片到指定尺寸和文件大小
 */
suspend fun compressImage(
    context: Context,
    uri: Uri,
    maxDimension: Int = 1280,
    maxFileSize: Long = 1 * 1024 * 1024 // 1MB
): Uri = withContext(Dispatchers.IO) {
    try {
        val inputStream = context.contentResolver.openInputStream(uri) ?: return@withContext uri
        
        // 1. 获取原始尺寸
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeStream(inputStream, null, options)
        inputStream.close()
        
        // 2. 计算采样率
        var inSampleSize = 1
        if (options.outWidth > maxDimension || options.outHeight > maxDimension) {
            val halfWidth = options.outWidth / 2
            val halfHeight = options.outHeight / 2
            while ((halfWidth / inSampleSize) >= maxDimension && (halfHeight / inSampleSize) >= maxDimension) {
                inSampleSize *= 2
            }
        }
        
        // 3. 加载图片
        val decodeStream = context.contentResolver.openInputStream(uri) ?: return@withContext uri
        val decodeOptions = BitmapFactory.Options().apply { this.inSampleSize = inSampleSize }
        var bitmap = BitmapFactory.decodeStream(decodeStream, null, decodeOptions) ?: run {
            decodeStream.close()
            return@withContext uri
        }
        decodeStream.close()
        
        // 4. 处理旋转
        context.contentResolver.openInputStream(uri)?.use { exifStream ->
            val exif = ExifInterface(exifStream)
            val orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
            val matrix = Matrix()
            when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
                ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
                ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            }
            if (orientation != ExifInterface.ORIENTATION_NORMAL) {
                bitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            }
        }

        // 5. 缩放
        if (bitmap.width > maxDimension || bitmap.height > maxDimension) {
            val scale = maxDimension.toFloat() / maxOf(bitmap.width, bitmap.height)
            bitmap = Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt(), (bitmap.height * scale).toInt(), true)
        }
        
        // 6. 压缩质量并保存
        val file = File(context.cacheDir, "compressed_${System.currentTimeMillis()}.jpg")
        var quality = 90
        var stream: FileOutputStream? = null
        try {
            do {
                stream = FileOutputStream(file)
                bitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)
                stream.close()
                quality -= 10
            } while (file.length() > maxFileSize && quality > 10)
        } finally {
            stream?.close()
        }
        
        Uri.fromFile(file)
    } catch (e: Exception) {
        e.printStackTrace()
        uri
    }
}

/**
 * 列表上下渐变遮罩效果
 */
fun Modifier.verticalFadingEdge(
    topFadeHeight: Dp = 0.dp,
    bottomFadeHeight: Dp = 0.dp
) = this
    .graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)
    .drawWithContent {
        drawContent()

        // 顶部渐变遮罩 (透明 -> 黑色)
        if (topFadeHeight > 0.dp) {
            val topPx = topFadeHeight.toPx()
            drawRect(
                brush = Brush.verticalGradient(
                    0f to Color.Transparent,
                    1f to Color.Black,
                    startY = 0f,
                    endY = topPx
                ),
                blendMode = BlendMode.DstIn,
                size = Size(size.width, topPx)
            )
        }

        // 底部渐变遮罩 (黑色 -> 透明)
        if (bottomFadeHeight > 0.dp) {
            val bottomPx = bottomFadeHeight.toPx()
            drawRect(
                brush = Brush.verticalGradient(
                    0f to Color.Black,
                    1f to Color.Transparent,
                    startY = size.height - bottomPx,
                    endY = size.height
                ),
                blendMode = BlendMode.DstIn,
                topLeft = Offset(0f, size.height - bottomPx),
                size = Size(size.width, bottomPx)
            )
        }
    }

/**
 * 对话页面 - 复刻豆包/元宝风格
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatPage(
    onNavigateToHistory: () -> Unit = {},
    onNewChat: () -> Unit = {},
    onOpenDrawer: () -> Unit = {}, // 🆕 外部控制抽屉
    viewModel: ChatViewModel = viewModel(),
    speechViewModel: SpeechRecognitionViewModel = viewModel(),
    listState: androidx.compose.foundation.lazy.LazyListState = rememberLazyListState()
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var isRecording by remember { mutableStateOf(false) }
    var isCanceling by remember { mutableStateOf(false) }
    var showTextInput by remember { mutableStateOf(false) }
    var inputText by remember { mutableStateOf("") }
    var showFeatureSheet by remember { mutableStateOf(false) }
    
    // 抽屉状态 - 已移除，由 MainActivity 管理

    // 快捷问题显示状态 - 仅在首次展示
    var hasShownQuickQuestions by remember { mutableStateOf(false) }

    // 图片相关状态（支持多图）
    var capturedImageUris by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var tempPhotoUri by remember { mutableStateOf<Uri?>(null) }
    var mediaLaunchMode by remember { mutableStateOf(PendingMediaLaunchMode.CHAT_ATTACH) }
    var activeInteractionRequestId by remember { mutableStateOf<String?>(null) }
    var showBrowserUploadPanel by remember { mutableStateOf(false) }
    var browserUploadSessionId by remember { mutableStateOf("") }
    // 图片放大查看状态
    var selectedImageUri by remember { mutableStateOf<Uri?>(null) }
    var showImageViewer by remember { mutableStateOf(false) }
    
    // 🆕 文本选择状态
    var selectedTextForSelection by remember { mutableStateOf("") }
    var showTextSelectionDialog by remember { mutableStateOf(false) }
    
    // 🆕 调试日志浮窗状态
    var showDebugLogDialog by remember { mutableStateOf(false) }
    var debugLogMessageId by remember { mutableStateOf("") }

    // 输入框焦点状态
    val inputFocusRequester = remember { FocusRequester() }
    var isInputFocused by remember { mutableStateOf(false) }

    // 权限状态
    var hasRecordPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        )
    }


    // 创建临时图片文件URI
    fun createImageFileUri(): Uri? {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val imageFileName = "JPEG_${timeStamp}_"
        val storageDir = context.getExternalFilesDir("Pictures")
        val imageFile = File.createTempFile(imageFileName, ".jpg", storageDir)
        return FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            imageFile
        )
    }

    // 相机启动器 - 增加压缩处理
    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        if (success) {
            tempPhotoUri?.let { uri ->
                scope.launch {
                    val compressedUri = compressImage(context, uri)
                    if (mediaLaunchMode == PendingMediaLaunchMode.TOOL_INTERACTION && activeInteractionRequestId != null) {
                        viewModel.resolveToolInteraction(
                            success = true,
                            data = mapOf(
                                "imageUri" to compressedUri.toString(),
                                "capturedAt" to System.currentTimeMillis()
                            )
                        )
                        activeInteractionRequestId = null
                        mediaLaunchMode = PendingMediaLaunchMode.CHAT_ATTACH
                    } else {
                        capturedImageUris = capturedImageUris + compressedUri
                    }
                }
            }
        } else if (mediaLaunchMode == PendingMediaLaunchMode.TOOL_INTERACTION) {
            viewModel.resolveToolInteraction(false, error = "用户取消了拍照")
            activeInteractionRequestId = null
            mediaLaunchMode = PendingMediaLaunchMode.CHAT_ATTACH
        }
    }
    
    // 🆕 相册多选启动器 - 支持多选和压缩
    val galleryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris: List<Uri> -> // 返回 URI 列表
        if (mediaLaunchMode == PendingMediaLaunchMode.TOOL_INTERACTION && activeInteractionRequestId != null) {
            scope.launch {
                val items = uris.map { uri ->
                    mapOf(
                        "uri" to uri.toString(),
                        "displayName" to (uri.lastPathSegment ?: "selected"),
                        "mimeType" to (context.contentResolver.getType(uri) ?: "application/octet-stream")
                    )
                }
                viewModel.resolveToolInteraction(
                    success = items.isNotEmpty(),
                    data = mapOf("items" to items),
                    error = if (items.isEmpty()) "用户未选择图片" else null
                )
                activeInteractionRequestId = null
                mediaLaunchMode = PendingMediaLaunchMode.CHAT_ATTACH
            }
            return@rememberLauncherForActivityResult
        }

        val availableCount = MAX_IMAGES - capturedImageUris.size
        if (uris.size > availableCount) {
            Toast.makeText(context, "最多只能再添加${availableCount}张图片", Toast.LENGTH_SHORT).show()
        }
        
        val targetUris = uris.take(availableCount)
        if (targetUris.isNotEmpty()) {
            scope.launch {
                val compressedUris = targetUris.map { uri ->
                    compressImage(context, uri)
                }
                capturedImageUris = capturedImageUris + compressedUris
            }
        }
    }

    // 权限请求Launcher
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasRecordPermission = isGranted
        if (!isGranted) {
            Toast.makeText(context, "需要录音权限才能使用语音输入", Toast.LENGTH_SHORT).show()
        }
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
        if (isGranted) {
            val uri = createImageFileUri()
            tempPhotoUri = uri
            uri?.let { cameraLauncher.launch(it) }
        } else {
            if (mediaLaunchMode == PendingMediaLaunchMode.TOOL_INTERACTION) {
                viewModel.resolveToolInteraction(false, error = "需要相机权限才能拍照")
                activeInteractionRequestId = null
                mediaLaunchMode = PendingMediaLaunchMode.CHAT_ATTACH
            } else {
                Toast.makeText(context, "需要相机权限才能拍照", Toast.LENGTH_SHORT).show()
            }
        }
    }

    val toolPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val allGranted = results.values.all { it }
        if (allGranted) {
            viewModel.resolveToolInteraction(true)
        } else {
            val denied = results.filterValues { !it }.keys.joinToString(", ")
            viewModel.resolveToolInteraction(false, error = "以下权限未被授予：$denied")
        }
    }

    val filePickerLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments()
    ) { uris: List<Uri> ->
        val items = uris.map { uri ->
            mapOf(
                "uri" to uri.toString(),
                "displayName" to (uri.lastPathSegment ?: "selected"),
                "mimeType" to (context.contentResolver.getType(uri) ?: "application/octet-stream")
            )
        }
        viewModel.resolveToolInteraction(
            success = items.isNotEmpty(),
            data = mapOf("items" to items),
            error = if (items.isEmpty()) "用户未选择文件" else null
        )
    }

    val activity = context as? Activity
    val screenCaptureLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        scope.launch {
            if (result.resultCode == Activity.RESULT_OK && result.data != null && activity != null) {
                val imageUri = ScreenCaptureHelper.captureOnce(activity, result.resultCode, result.data!!)
                if (imageUri != null) {
                    viewModel.resolveToolInteraction(
                        success = true,
                        data = mapOf(
                            "imageUri" to imageUri.toString(),
                            "capturedAt" to System.currentTimeMillis()
                        )
                    )
                } else {
                    viewModel.resolveToolInteraction(false, error = "截屏失败")
                }
            } else {
                viewModel.resolveToolInteraction(false, error = "用户取消了截屏授权")
            }
            activeInteractionRequestId = null
            mediaLaunchMode = PendingMediaLaunchMode.CHAT_ATTACH
        }
    }

    // 监听消息列表变化，自动滚动到底部
    val isLoading by viewModel.isLoading.collectAsState()
    val messages by viewModel.messages.collectAsState()
    
    // 🆕 监听被停止的消息ID集合
    val stoppedMessageIds by viewModel.stoppedMessageIds.collectAsState()
    val agentExecutionSteps by viewModel.agentExecutionSteps.collectAsState()
    val pendingToolApproval by viewModel.pendingToolApproval.collectAsState()
    val pendingToolInteraction by viewModel.pendingToolInteraction.collectAsState()
    val pendingClarification by viewModel.pendingClarification.collectAsState()
    
    // 🌟 优化：监听最后一条消息的内容变化，实现流式滚动
    val lastMessage = messages.lastOrNull()
    val lastMessageContent = lastMessage?.content
    // 🆕 监听最后一条AI消息的执行步骤数量变化，用于触发自动滚动
    val lastAiMessage = messages.lastOrNull { !it.isUser }
    val lastAiStepCount = lastAiMessage?.let { agentExecutionSteps[it.id]?.size ?: 0 } ?: 0
    
    // 🎯 智能滚动系统（豆包风格交互逻辑）
    // 记录用户是否手动向上滚动
    var isUserScrollingUp by remember { mutableStateOf(false) }
    // 记录是否正在生成（AI正在回复）
    val isGenerating = isLoading
    // 显示"回到底部"悬浮卡片
    var showScrollToBottomButton by remember { mutableStateOf(false) }
    
    // 📌 触发逻辑：视口偏移检测
    // 当用户滚动时，检测是否不在底部
    LaunchedEffect(listState.isScrollInProgress) {
        snapshotFlow { listState.firstVisibleItemIndex to listState.firstVisibleItemScrollOffset }
            .collect { (index, offset) ->
                if (listState.isScrollInProgress && messages.isNotEmpty()) {
                    val layoutInfo = listState.layoutInfo
                    val lastVisibleIndex = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
                    val isAtBottom = lastVisibleIndex >= messages.size - 1
                    
                    // 📌 消失逻辑2：手动触底 - 用户手动滑到最下方时自动淡出
                    if (isAtBottom) {
                        isUserScrollingUp = false
                        showScrollToBottomButton = false
                    } else if (isGenerating || messages.size > 3) {
                        // 如果用户不在底部，且有新内容或历史消息较多，显示悬浮卡片
                        isUserScrollingUp = true
                        showScrollToBottomButton = true
                    }
                }
            }
    }
    
    // 自动触底滚动（AI正在生成 + 用户没有手动向上滚动）
    LaunchedEffect(lastMessageContent, lastAiStepCount) {
        if (messages.isNotEmpty() && !isUserScrollingUp && isGenerating) {
            val layoutInfo = listState.layoutInfo
            val lastVisibleItemInfo = layoutInfo.visibleItemsInfo.lastOrNull()
            val lastItemIndex = messages.size - 1
            
            if (lastVisibleItemInfo != null) {
                val lastVisibleIndex = lastVisibleItemInfo.index
                val isNearBottom = lastVisibleIndex >= lastItemIndex - 1
                
                if (isNearBottom) {
                    // 平滑滚动到底部
                    scope.launch {
                        delay(50)
                        listState.animateScrollToItem(
                            index = lastItemIndex,
                            scrollOffset = 0
                        )
                    }
                }
            }
        }
    }
    
    // 监听新消息，自动滚动到底部
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            val layoutInfo = listState.layoutInfo
            val lastVisibleIndex = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            val isAtBottom = lastVisibleIndex >= messages.size - 2
            
            // 新消息到来时，如果用户在底部，自动滚动
            if (isAtBottom || !isGenerating) {
                isUserScrollingUp = false
                showScrollToBottomButton = false
                listState.animateScrollToItem(messages.size - 1)
            } else {
                // 📌 触发逻辑：新消息到来但用户不在底部，显示悬浮卡片
                showScrollToBottomButton = true
            }
        }
    }
    
    // 📌 消失逻辑3：任务结束 - AI生成完毕且视口已在底部则自动消失
    LaunchedEffect(isGenerating) {
        if (!isGenerating && messages.isNotEmpty()) {
            val layoutInfo = listState.layoutInfo
            val lastVisibleIndex = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            val isAtBottom = lastVisibleIndex >= messages.size - 1
            
            if (isAtBottom) {
                showScrollToBottomButton = false
                isUserScrollingUp = false
            }
        }
    }

    // 监听识别结果
    val recognitionResult by speechViewModel.recognitionResult.collectAsState()

    val errorMessage by speechViewModel.errorMessage.collectAsState()

    // 当有新识别结果时，发送消息（带图片附件）
    LaunchedEffect(recognitionResult) {
        if (recognitionResult.isNotEmpty()) {
            // 🆕 语音模式发送时检查是否有图片附件，支持多张图片一起发送
            viewModel.sendMessage(recognitionResult, capturedImageUris)
            capturedImageUris = emptyList() // 🆕 发送后清空图片列表
            speechViewModel.clearResult()
        }
    }

    // 显示错误信息
    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            Toast.makeText(context, it, Toast.LENGTH_SHORT).show()
        }
    }

    // TTS 状态
    val isTtsEnabled by viewModel.isTtsEnabled.collectAsState()
    
    // 🆕 模型选择状态
    val selectedModelId by viewModel.selectedModelId.collectAsState()

    val keyboardController = LocalSoftwareKeyboardController.current
    val focusManager = LocalFocusManager.current
    
    // 🧠 记忆管理页面状态
    var showMemoryManagement by remember { mutableStateOf(false) }

    // 计算顶部状态栏高度 + 功能区高度，用于渐变和内边距，实现沉浸式效果
    val statusBarHeight = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val topBarHeight = statusBarHeight + 52.dp // 40dp图标 + 12dp余量
    
    // 🧠 如果显示记忆管理页面，直接渲染
    if (showMemoryManagement) {
        MemoryManagementPage(
            onBack = { showMemoryManagement = false }
        )
        return
    }

    pendingToolApproval?.let { approval ->
        AlertDialog(
            onDismissRequest = { viewModel.resolveToolApproval(false) },
            title = {
                Text("高风险工具确认")
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = approval.summary,
                        fontSize = 14.sp,
                        color = Color(0xFF333333)
                    )
                    Text(
                        text = "工具：${approval.toolName}",
                        fontSize = 13.sp,
                        color = Color(0xFF666666)
                    )
                    Text(
                        text = "原因：${approval.reason}",
                        fontSize = 13.sp,
                        color = Color(0xFF666666)
                    )
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFFF5F5F5)
                    ) {
                        Text(
                            text = approval.arguments,
                            modifier = Modifier.padding(12.dp),
                            fontSize = 12.sp,
                            color = Color(0xFF555555)
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { viewModel.resolveToolApproval(true) }) {
                    Text("允许")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.resolveToolApproval(false) }) {
                    Text("拒绝")
                }
            }
        )
    }

    pendingClarification?.let { clarification ->
        var customInput by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { viewModel.resolveClarification("用户跳过了该问题") },
            title = { Text("需要更多信息") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = clarification.question,
                        fontSize = 14.sp,
                        color = Color(0xFF333333)
                    )
                    clarification.options.forEach { option ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { viewModel.resolveClarification(option) },
                            shape = RoundedCornerShape(10.dp),
                            color = Color(0xFFF0F4FF),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD0D5DD))
                        ) {
                            Text(
                                text = option,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                                fontSize = 14.sp,
                                color = Color(0xFF1565C0)
                            )
                        }
                    }
                    OutlinedTextField(
                        value = customInput,
                        onValueChange = { customInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("或输入自定义回答…", fontSize = 13.sp) },
                        singleLine = false,
                        maxLines = 3
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.resolveClarification(customInput.ifBlank { "用户未提供具体信息" }) },
                    enabled = customInput.isNotBlank()
                ) { Text("提交") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.resolveClarification("用户跳过了该问题") }) {
                    Text("跳过")
                }
            }
        )
    }

    pendingToolInteraction?.let { interaction ->
        if (interaction.kind == ToolInteractionKind.REQUEST_PERMISSION) {
            // 权限请求直接启动系统弹窗，不显示中间 AlertDialog，避免 onDismissRequest 竞态
            LaunchedEffect(interaction.requestId) {
                val permissions = (interaction.payload["permissions"] as? List<*>)
                    ?.mapNotNull { it?.toString() }
                    ?.toTypedArray()
                if (permissions.isNullOrEmpty()) {
                    viewModel.resolveToolInteraction(false, error = "权限列表为空")
                } else {
                    toolPermissionLauncher.launch(permissions)
                }
            }
        } else {
            AlertDialog(
                onDismissRequest = { viewModel.resolveToolInteraction(false, error = "用户取消了交互请求") },
                title = {
                    Text(interaction.title)
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            text = interaction.description,
                            fontSize = 14.sp,
                            color = Color(0xFF333333)
                        )
                        Text(
                            text = "工具：${interaction.toolName}",
                            fontSize = 13.sp,
                            color = Color(0xFF666666)
                        )
                        if (interaction.payloadSummary.isNotBlank()) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFFF5F5F5)
                            ) {
                                Text(
                                    text = interaction.payloadSummary,
                                    modifier = Modifier.padding(12.dp),
                                    fontSize = 12.sp,
                                    color = Color(0xFF555555)
                                )
                            }
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = {
                        when (interaction.kind) {
                            ToolInteractionKind.PICK_IMAGES -> {
                                mediaLaunchMode = PendingMediaLaunchMode.TOOL_INTERACTION
                                activeInteractionRequestId = interaction.requestId
                                galleryLauncher.launch("image/*")
                            }
                            ToolInteractionKind.PICK_FILES -> {
                                val mimeTypes = (interaction.payload["mimeTypes"] as? List<*>)?.mapNotNull { it?.toString() }?.toTypedArray()
                                    ?: arrayOf("*/*")
                                filePickerLauncher.launch(mimeTypes)
                            }
                            ToolInteractionKind.TAKE_PHOTO -> {
                                mediaLaunchMode = PendingMediaLaunchMode.TOOL_INTERACTION
                                activeInteractionRequestId = interaction.requestId
                                if (hasCameraPermission) {
                                    val uri = createImageFileUri()
                                    tempPhotoUri = uri
                                    uri?.let { cameraLauncher.launch(it) } ?: viewModel.resolveToolInteraction(false, error = "无法创建临时图片文件")
                                } else {
                                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                                }
                            }
                            ToolInteractionKind.BROWSER_FILE_UPLOAD -> {
                                // Show browser upload panel
                                val uploadSessionId = interaction.payload["sessionId"]?.toString() ?: ""
                                showBrowserUploadPanel = true
                                browserUploadSessionId = uploadSessionId
                                activeInteractionRequestId = interaction.requestId
                            }
                            ToolInteractionKind.CAPTURE_SCREEN -> {
                                mediaLaunchMode = PendingMediaLaunchMode.TOOL_INTERACTION
                                activeInteractionRequestId = interaction.requestId
                                val projectionManager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager
                                if (projectionManager == null || activity == null) {
                                    viewModel.resolveToolInteraction(false, error = "当前环境不支持截屏授权")
                                } else {
                                    screenCaptureLauncher.launch(projectionManager.createScreenCaptureIntent())
                                }
                            }
                            else -> {}
                        }
                    }) {
                        Text("继续")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { viewModel.resolveToolInteraction(false, error = "用户取消了交互请求") }) {
                        Text("取消")
                    }
                }
            )
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // 🔧 动态计算输入框的Y轴偏移量（向上避开键盘）
        val density = LocalDensity.current
        val navBarHeight = 24.dp // 🔧 底部留白（已移除底部Tab，适度间距）
        val imeHeightPx = WindowInsets.ime.getBottom(density)
        val imeHeightDp = with(density) { imeHeightPx.toDp() }
        
        // 🔧 记住上一帧的键盘高度，用于检测键盘是弹起还是收起
        var previousImeHeight by remember { mutableStateOf(0.dp) }
        // 键盘是否正在弹起（高度在增加）- 一旦开始收起就设为false
        var isKeyboardRising by remember { mutableStateOf(false) }
        
        // 🔧 检测键盘状态变化
        LaunchedEffect(imeHeightDp) {
            when {
                imeHeightDp > previousImeHeight && imeHeightDp > 0.dp -> {
                    // 键盘正在弹起（高度增加）
                    isKeyboardRising = true
                }
                imeHeightDp < previousImeHeight -> {
                    // 键盘正在收起（高度减少）- 立即设为false，不再跟随
                    isKeyboardRising = false
                }
                imeHeightDp == 0.dp -> {
                    // 键盘完全收起
                    isKeyboardRising = false
                }
            }
            previousImeHeight = imeHeightDp
        }
        
        // 🔧 计算目标offset：
        // - 键盘正在弹起时：跟随实时高度（确保输入框紧贴键盘）
        // - 键盘正在收起时：直接动画到0，不跟着键盘收起动画走，避免回弹
        val targetOffsetY = if (isKeyboardRising && imeHeightDp > 0.dp) {
            -(imeHeightDp - navBarHeight) // 键盘正在弹起，跟随实时高度
        } else {
            0.dp // 键盘收起或已收起，直接动画到默认位置
        }
        
        // 🆕 键盘弹起时立即响应，收起时有平滑动画
        val inputOffsetY by animateDpAsState(
            targetValue = targetOffsetY,
            animationSpec = if (isKeyboardRising) {
                // 键盘弹起：立即响应（极短动画）
                tween(durationMillis = 0)
            } else {
                // 键盘收起：平滑动画
                tween(durationMillis = 220, easing = FastOutSlowInEasing)
            },
            label = "inputOffsetY"
        )
        
        // 🆕 监听键盘收起，延迟清除焦点（避免闪烁）
        LaunchedEffect(imeHeightPx) {
            if (imeHeightPx == 0 && showTextInput) {
                // 延迟250ms，让动画完全完成后再清除焦点
                delay(250)
                focusManager.clearFocus()
            }
        }

        // 移除内部抽屉，由 MainActivity 统一管理
        // 🔧 使用单一的动画机制控制位置，不使用系统级的 windowInsetsPadding
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFF8F8F8))
                .offset(y = inputOffsetY) // 🔧 整个内容区域跟随键盘移动
                // 🚫 不使用 windowInsetsPadding 或 imePadding，完全手动控制
        ) {
            // 消息列表区域
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                if (messages.isNotEmpty()) {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp)
                            .verticalFadingEdge(topFadeHeight = topBarHeight + 48.dp, bottomFadeHeight = 60.dp)
                            .pointerInput(Unit) {
                                detectTapGestures(onTap = {
                                    focusManager.clearFocus()
                                })
                            }
                            .pointerInput(Unit) {
                                detectDragGestures { change, _ ->
                                    change.consume()
                                    focusManager.clearFocus()
                                }
                            },
                        state = listState,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(top = topBarHeight, bottom = 16.dp)
                    ) {
                    items(messages) { message ->
                        val isLastAIMessage = !message.isUser && messages.lastOrNull { !it.isUser }?.id == message.id // 🆕 判断是否最后一条AI消息
                        val showCursor = isLastAIMessage && isGenerating // 🆕 只在生成中显示光标
                        // 🆕 获取引用元数据（仅AI消息）
                        val groundingMetadata = if (!message.isUser) viewModel.getGroundingMetadata(message.id) else null
                        // 🆕 检查消息是否被用户手动停止
                        val isStopped = stoppedMessageIds.contains(message.id)
                        ChatMessageItem(
                            message = message,
                            isLastAIMessage = isLastAIMessage,
                            showCursor = showCursor,
                            isStopped = isStopped,  // 🆕 传递停止状态
                            executionSteps = if (message.isUser) emptyList() else agentExecutionSteps[message.id].orEmpty(),
                            groundingMetadata = groundingMetadata,  // 🆕 传递引用元数据
                            onRegenerate = { messageId ->
                                // 找到对应的用户消息，重新生成
                                val index = messages.indexOfFirst { it.id == messageId }
                                if (index > 0) {
                                    val userMessage = messages[index - 1]
                                    if (userMessage.isUser) {
                                        // 🆕 解析可能包含多张图片的URI字符串（逗号分隔）
                                        val imageUris = userMessage.imageUri?.split(",")
                                            ?.map { Uri.parse(it.trim()) }
                                            ?: emptyList()
                                        viewModel.sendMessage(userMessage.content, imageUris)
                                    }
                                }
                            },
                            onSpeak = { content ->
                                // 播报内容
                                viewModel.speakText(content)
                            },
                            onStopSpeak = {
                                // 停止播报
                                viewModel.stopSpeak()
                            },
                            onEdit = { msg ->
                                // 修改消息：将内容放到输入框
                                inputText = msg.content
                                showTextInput = true
                                scope.launch {
                                    delay(100)
                                    inputFocusRequester.requestFocus()
                                    keyboardController?.show()
                                }
                            },
                            onDelete = { messageId ->
                                // 删除消息对（query + 回复）
                                viewModel.deleteMessagePair(messageId)
                            },
                            onSelectText = { content ->
                                // 🆕 选取文本：弹出文本选择界面
                                selectedTextForSelection = content
                                showTextSelectionDialog = true
                            },
                            onShowDebugLog = { messageId ->
                                // 🆕 显示调试日志（4次快速点击触发）
                                debugLogMessageId = messageId
                                showDebugLogDialog = true
                            },
                            onMemoryClick = {
                                // 🆕 跳转到记忆管理界面
                                showMemoryManagement = true
                            }
                        )
                    }
                    }
                } else {
                    // 空状态显示欢迎语
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .pointerInput(Unit) {
                                detectTapGestures(onTap = {
                                    focusManager.clearFocus()
                                })
                            }
                            .pointerInput(Unit) {
                                detectDragGestures { change, _ ->
                                    change.consume()
                                    focusManager.clearFocus()
                                }
                            }
                    ) {
                        EmptyChatState(
                            isRecording = isRecording,
                            isCanceling = isCanceling,
                            hasShownQuickQuestions = hasShownQuickQuestions,
                            onQuickQuestionClick = { question ->
                                inputText = question
                                hasShownQuickQuestions = true
                                if (question.isNotBlank()) {
                                    viewModel.sendMessage(question)
                                    inputText = ""
                                    keyboardController?.hide()
                                }
                            }
                        )
                    }
                }
                
                // 🆕 "回到底部"悬浮按钮（白色毛玻璃箭头）
                // 触发逻辑：用户不在底部且有新内容时显示
                // 消失逻辑：点击/手动滚到底部/任务结束
                androidx.compose.animation.AnimatedVisibility(
                    visible = showScrollToBottomButton,
                    enter = fadeIn(animationSpec = tween(200)) + scaleIn(initialScale = 0.8f),
                    exit = fadeOut(animationSpec = tween(150)) + scaleOut(targetScale = 0.8f),
                    modifier = Modifier
                        .align(Alignment.BottomCenter) // 水平居中
                        .padding(bottom = 16.dp)
                        .zIndex(50f) // 高z-index悬浮层
                ) {
                    ScrollToBottomButton(
                        onClick = {
                            scope.launch {
                                isUserScrollingUp = false
                                showScrollToBottomButton = false
                                listState.animateScrollToItem(messages.size - 1)
                            }
                        },
                        isGenerating = isGenerating
                    )
                }
            }

            // 🔧 动态计算输入框底部间距 (已移至上方)
            // 🆕 监听键盘收起 (已移至上方)

            ChatInputArea(
            isRecording = isRecording,
            isCanceling = isCanceling,
            showTextInput = showTextInput,
            inputText = inputText,
            capturedImageUris = capturedImageUris, // 🆕 多图列表
            isInputFocused = isInputFocused,
            hasShownQuickQuestions = hasShownQuickQuestions,
            messagesEmpty = messages.isEmpty(),
            onInputTextChange = { inputText = it },
            onRecordingStateChange = { recording, canceling ->
                val wasRecording = isRecording
                // 🆕 UI状态立即更新
                isRecording = recording
                isCanceling = canceling

                if (recording && !canceling) {
                    // 开始录音
                    if (hasRecordPermission) {
                        speechViewModel.startRecording()
                    } else {
                        permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                        isRecording = false
                    }
                } else if (!recording && wasRecording) {
                    // 结束录音（无论是发送还是取消）
                    if (canceling) {
                        // 取消录音：立即停止
                        speechViewModel.cancelRecording()
                    } else {
                        // 🆕 正常结束录音：延迟300ms停止，防止尾音截断
                        // UI已经立即更新，但后台静默多收音300ms
                        // 300ms足够捕获尾音，同时避免录入过多背景噪音
                        scope.launch {
                            delay(300L)
                            speechViewModel.stopRecording()
                        }
                    }
                    // 重置取消状态
                    isCanceling = false
                }
            },
            onShowTextInputChange = { showTextInput = it },
            onSendMessage = {
                if (inputText.isNotBlank() || capturedImageUris.isNotEmpty()) {
                    // 🆕 支持多张图片发送
                    viewModel.sendMessage(inputText, capturedImageUris)
                    inputText = ""
                    capturedImageUris = emptyList() // 🆕 清空图片列表
                }
            },
            onMoreClick = { 
                // 点击加号打开功能菜单
                showFeatureSheet = true
            },
            onCameraClick = {
                if (capturedImageUris.size >= MAX_IMAGES) {
                    // 检查图片数量是否达到上限
                    Toast.makeText(context, "最多支持${MAX_IMAGES}张图片", Toast.LENGTH_SHORT).show()
                } else if (hasCameraPermission) {
                    val uri = createImageFileUri()
                    tempPhotoUri = uri
                    uri?.let { cameraLauncher.launch(it) }
                } else {
                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                }
            },
            isGenerating = isGenerating, // 🆕 传递生成状态
            onStopGeneration = { viewModel.stopGeneration() }, // 🆕 停止生成回调
            onRemoveImage = { uri -> // 🆕 删除指定图片
                capturedImageUris = capturedImageUris.filter { it != uri }
            },
            onImageClick = { uri -> // 🆕 点击图片放大查看
                selectedImageUri = uri
                showImageViewer = true
            },
            onInputFocusChange = { isInputFocused = it },
            inputFocusRequester = inputFocusRequester,
            onQuickQuestionClick = { question ->
                hasShownQuickQuestions = true
                viewModel.sendMessage(question)
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = navBarHeight) // 🔧 固定的底部间距，避开导航栏
        )
        } // Column 结束

        // 🆕 录音遮罩层（覆盖下方50%区域，避免与对话记录重叠）
        if (isRecording && !showTextInput) {
            RecordingOverlay(
                isCanceling = isCanceling,
                offsetY = inputOffsetY, // 🔧 录音遮罩层单独使用offset，不受Column影响
                bottomPadding = navBarHeight, // 🔧 固定的底部间距
                modifier = Modifier
                    .align(Alignment.BottomCenter)  // 🔧 对齐到底部
                    .fillMaxWidth()
                    .fillMaxHeight(0.50f)  // 🔧 增加高度到50%，避免音波与对话重叠
                    .zIndex(100f)
            )
        }
        
        // 🆕 顶部固定遮罩层（键盘弹起时遮挡滚动内容，与左右按钮配合）
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .height(topBarHeight + 20.dp) // 状态栏 + 按钮区 + 余量
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color(0xFFF8F8F8),         // 顶部完全不透明
                            Color(0xFFF8F8F8),         // 中间完全不透明
                            Color(0xFFF8F8F8).copy(alpha = 0f) // 底部透明渐变
                        ),
                        startY = 0f,
                        endY = Float.POSITIVE_INFINITY
                    )
                )
                .zIndex(5f) // 在内容上方，但在按钮下方
        )
        
        // 🔧 左上角菜单按钮 + 模型选择器（固定在顶部，不受键盘影响）
        TopLeftHeader(
            onMenuClick = { onOpenDrawer() },
            selectedModelId = selectedModelId,
            onModelSelect = { modelId -> viewModel.selectModel(modelId) },
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(top = statusBarHeight)
                .padding(start = 16.dp)
                .zIndex(10f)
        )

        // 🔧 右上角功能按钮（固定在顶部，不受键盘影响）
        TopRightActions(
            onNewChat = {
                viewModel.clearMessages()
                onNewChat()
            },
            isTtsEnabled = isTtsEnabled,
            onToggleTts = { viewModel.toggleTts() },
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = statusBarHeight)
                .padding(end = 16.dp)
                .zIndex(10f)
        )
    } // Box 结束
    
    // 🆕 全屏图片预览（支持双指缩放和平移，类似相册大图预览）
    if (showImageViewer && selectedImageUri != null) {
        Dialog(
            onDismissRequest = { showImageViewer = false },
            properties = DialogProperties(
                usePlatformDefaultWidth = false, // 🆕 不使用默认宽度，实现真正全屏
                dismissOnBackPress = true,
                dismissOnClickOutside = false,
                decorFitsSystemWindows = false // 🆕 全屏模式，覆盖状态栏
            )
        ) {
            // 缩放和平移状态
            var scale by remember { mutableFloatStateOf(1f) }
            var offsetX by remember { mutableFloatStateOf(0f) }
            var offsetY by remember { mutableFloatStateOf(0f) }
            
            // 🆕 缩放限制
            val minScale = 0.8f
            val maxScale = 6f
            
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black)
                    .pointerInput(Unit) {
                        detectTapGestures(
                            onDoubleTap = { offset ->
                                // 双击切换缩放
                                if (scale > 1f) {
                                    scale = 1f
                                    offsetX = 0f
                                    offsetY = 0f
                                } else {
                                    scale = 2.5f
                                }
                            },
                            onTap = {
                                // 单击关闭预览
                                showImageViewer = false
                            }
                        )
                    }
            ) {
                // 可缩放的图片
                AsyncImage(
                    model = selectedImageUri,
                    contentDescription = "图片查看",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer(
                            scaleX = scale,
                            scaleY = scale,
                            translationX = offsetX,
                            translationY = offsetY
                        )
                        // 🆕 双指缩放手势
                        .pointerInput(Unit) {
                            detectTransformGestures { centroid, pan, zoom, rotation ->
                                // 计算新的缩放值，限制在 minScale ~ maxScale 范围内
                                val newScale = (scale * zoom).coerceIn(minScale, maxScale)
                                
                                // 更新缩放
                                scale = newScale
                                
                                // 更新偏移（缩放时以手指中心为基准）
                                if (scale > 0.8f) {
                                    offsetX += pan.x
                                    offsetY += pan.y
                                }
                                
                                // 当缩放回到1倍以下时，重置偏移
                                if (scale <= 1f) {
                                    offsetX = 0f
                                    offsetY = 0f
                                }
                            }
                        }
                )
                
                // 🆕 左上角返回按钮（类似相册风格，使用安全区域padding）
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .systemBarsPadding() // 🆕 使用systemBarsPadding确保不被状态栏遮挡
                        .padding(16.dp)
                        .size(44.dp)
                        .shadow(
                            elevation = 8.dp,
                            shape = CircleShape,
                            ambientColor = Color.Black.copy(alpha = 0.3f),
                            spotColor = Color.Black.copy(alpha = 0.3f)
                        )
                        .background(Color.Black.copy(alpha = 0.5f), CircleShape)
                        .clickable { showImageViewer = false },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "返回",
                        tint = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }
    }
    
    // 🆕 文本选择Dialog（支持系统文本选择功能）
    if (showTextSelectionDialog && selectedTextForSelection.isNotBlank()) {
        TextSelectionDialog(
            text = selectedTextForSelection,
            onDismiss = { 
                showTextSelectionDialog = false
                selectedTextForSelection = ""
            }
        )
    }
    
    // 🆕 调试日志Dialog（4次快速点击AI消息触发）
    if (showDebugLogDialog && debugLogMessageId.isNotBlank()) {
        DebugLogDialog(
            requestLog = viewModel.getRequestLog(debugLogMessageId),
            onDismiss = { 
                showDebugLogDialog = false
                debugLogMessageId = ""
            }
        )
    }
    
    // Browser upload panel (Phase C)
    if (showBrowserUploadPanel && browserUploadSessionId.isNotBlank()) {
        val app = remember { context.applicationContext as com.xiaoxiami.app.MyApplication }
        com.xiaoxiami.app.ui.browser.BrowserUploadPanel(
            browserRuntime = app.browserRuntimeManager,
            sessionId = browserUploadSessionId,
            onDismiss = {
                showBrowserUploadPanel = false
                viewModel.resolveToolInteraction(true)
            }
        )
    }

    // 🆕 底部功能菜单
    FeatureBottomSheet(
        isVisible = showFeatureSheet,
        onDismiss = { showFeatureSheet = false },
        onCameraClick = {
            showFeatureSheet = false
            // 🆕 检查图片数量
            if (capturedImageUris.size >= MAX_IMAGES) {
                Toast.makeText(context, "最多支持${MAX_IMAGES}张图片", Toast.LENGTH_SHORT).show()
            } else if (hasCameraPermission) {
                val uri = createImageFileUri()
                tempPhotoUri = uri
                uri?.let { cameraLauncher.launch(it) }
            } else {
                cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        },
        onGalleryClick = {
            showFeatureSheet = false
            // 🆕 检查图片数量
            if (capturedImageUris.size >= MAX_IMAGES) {
                Toast.makeText(context, "最多支持${MAX_IMAGES}张图片", Toast.LENGTH_SHORT).show()
            } else {
                galleryLauncher.launch("image/*")
            }
        }
    )

} // Box 结束

/**
 * 🆕 左上角头部区域：菜单按钮 + 模型选择器
 */
@Composable
private fun TopLeftHeader(
    onMenuClick: () -> Unit,
    selectedModelId: String,
    onModelSelect: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val haptic = LocalHapticFeedback.current
    var showModelSelector by remember { mutableStateOf(false) }
    
    // 获取当前选中的模型信息
    val selectedModel = com.xiaoxiami.app.viewmodel.AVAILABLE_MODELS.find { it.id == selectedModelId }
        ?: com.xiaoxiami.app.viewmodel.AVAILABLE_MODELS[0]
    
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // 菜单按钮
        Box(
            modifier = Modifier
                .shadow(
                    elevation = 24.dp,
                    shape = CircleShape,
                    ambientColor = Color.Black.copy(alpha = 0.35f),
                    spotColor = Color.Black.copy(alpha = 0.3f)
                )
                .size(44.dp)
                .clip(CircleShape)
                .background(Color.White)
                .clickable(onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    onMenuClick()
                }),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Outlined.Menu,
                contentDescription = "菜单",
                tint = Color(0xFF1A1A1A),
                modifier = Modifier.size(24.dp)
            )
        }
        
        // 模型选择器
        Box(
            modifier = Modifier
                .shadow(
                    elevation = 20.dp,
                    shape = RoundedCornerShape(22.dp),
                    ambientColor = Color.Black.copy(alpha = 0.3f),
                    spotColor = Color.Black.copy(alpha = 0.25f)
                )
                .height(44.dp) // 🆕 强制高度为44dp，与右侧按钮保持一致
                .clip(RoundedCornerShape(22.dp))
                .background(Color.White)
                .clickable(onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    showModelSelector = true
                })
                .padding(horizontal = 12.dp), // 🆕 移除垂直padding，由Box居中
            contentAlignment = Alignment.CenterStart // 内容垂直居中
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Column {
                    // 主标题
                    Text(
                        text = "小虾米",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF1A1A1A),
                        lineHeight = 15.sp
                    )
                    // 副标题（模型名）
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Text(
                            text = selectedModel.displayName,
                            fontSize = 11.sp,
                            color = Color(0xFF888888),
                            lineHeight = 13.sp
                        )
                        Icon(
                            imageVector = Icons.Default.KeyboardArrowDown,
                            contentDescription = "选择模型",
                            tint = Color(0xFF888888),
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
        }
    }
    
    // 模型选择浮窗
    if (showModelSelector) {
        ModelSelectorPopup(
            selectedModelId = selectedModelId,
            onModelSelect = { modelId ->
                onModelSelect(modelId)
                showModelSelector = false
            },
            onDismiss = { showModelSelector = false }
        )
    }
}

/**
 * 🆕 模型选择浮窗 - 毛玻璃效果 + 重阴影
 */
@Composable
private fun ModelSelectorPopup(
    selectedModelId: String,
    onModelSelect: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val haptic = LocalHapticFeedback.current
    
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = true,
            usePlatformDefaultWidth = false
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() }
                ) { onDismiss() },
            contentAlignment = Alignment.TopStart
        ) {
            // 浮窗内容
            Column(
                modifier = Modifier
                    .padding(start = 16.dp, top = 56.dp) // 紧挨着顶部标题栏
                    .widthIn(max = 280.dp)
                    .shadow(
                        elevation = 32.dp,
                        shape = RoundedCornerShape(16.dp),
                        ambientColor = Color.Black.copy(alpha = 0.4f),
                        spotColor = Color.Black.copy(alpha = 0.35f)
                    )
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White.copy(alpha = 0.95f)) // 半透明白色背景（模拟毛玻璃）
                    .clickable(enabled = false) {} // 阻止点击穿透
            ) {
                // 模型列表
                com.xiaoxiami.app.viewmodel.AVAILABLE_MODELS.forEachIndexed { index, model ->
                    val isSelected = model.id == selectedModelId
                    
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                onModelSelect(model.id)
                            }
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(
                                text = model.displayName,
                                fontSize = 16.sp,
                                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                                color = Color(0xFF1A1A1A)
                            )
                            Text(
                                text = model.description,
                                fontSize = 13.sp,
                                color = Color(0xFF888888)
                            )
                        }
                        
                        // 选中标记
                        if (isSelected) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "已选中",
                                tint = Color(0xFF1A1A1A),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                    
                    // 分隔线（最后一个不显示）
                    if (index < com.xiaoxiami.app.viewmodel.AVAILABLE_MODELS.size - 1) {
                        Divider(
                            color = Color(0xFFEEEEEE),
                            thickness = 1.dp,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * 右上角功能按钮
 */
@Composable
private fun TopRightActions(
    onNewChat: () -> Unit,
    isTtsEnabled: Boolean,
    onToggleTts: () -> Unit,
    modifier: Modifier = Modifier
) {
    val haptic = LocalHapticFeedback.current
    Row(
        modifier = modifier
            .shadow(
                elevation = 24.dp, // 🆕 加重阴影，明显凸显
                shape = RoundedCornerShape(22.dp),
                ambientColor = Color.Black.copy(alpha = 0.35f),
                spotColor = Color.Black.copy(alpha = 0.3f)
            )
            .height(44.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(Color.White)
            .padding(horizontal = 6.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 静音按钮
        IconButton(
            onClick = {
                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                onToggleTts()
            },
            modifier = Modifier.size(36.dp)
        ) {
            Icon(
                imageVector = if (isTtsEnabled) Icons.Default.VolumeUp else Icons.Default.VolumeOff,
                contentDescription = if (isTtsEnabled) "关闭语音" else "开启语音",
                tint = Color(0xFF1A1A1A), // 🆕 纯黑色
                modifier = Modifier.size(22.dp)
            )
        }

        // 新话题按钮
        IconButton(
            onClick = {
                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                onNewChat()
            },
            modifier = Modifier.size(36.dp)
        ) {
            Icon(
                imageVector = Icons.Outlined.Add,
                contentDescription = "新话题",
                tint = Color(0xFF1A1A1A), // 🆕 纯黑色
                modifier = Modifier.size(22.dp)
            )
        }
    }
}

/**
 * 空状态显示欢迎语
 */
@Composable
private fun EmptyChatState(
    isRecording: Boolean,
    isCanceling: Boolean,

    hasShownQuickQuestions: Boolean,
    onQuickQuestionClick: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp)
            .padding(top = 120.dp), // 靠上一些
        horizontalAlignment = Alignment.Start,
        verticalArrangement = Arrangement.Top
    ) {
        // 欢迎标题 - 左对齐
        Text(
            text = "Hi，我是小虾米",
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF1A1A1A),
            textAlign = TextAlign.Start
        )

        Spacer(modifier = Modifier.height(12.dp))

        // 副标题 - 左对齐
        Text(
            text = "需要我为你做些什么？",
            fontSize = 16.sp,
            color = Color(0xFF666666),
            textAlign = TextAlign.Start
        )

        // 快捷问题区域（仅在首次且非录音状态下显示）
        if (!hasShownQuickQuestions && !isRecording) {
            Spacer(modifier = Modifier.height(40.dp))
            QuickQuestions(onQuestionClick = onQuickQuestionClick)
        }


    }
}

/**
 * 对话消息项
 */
@Composable
private fun ChatMessageItem(
    message: ChatMessage,
    isLastAIMessage: Boolean = false,
    showCursor: Boolean = false, // 🆕 是否显示打字机光标
    isStopped: Boolean = false, // 🆕 是否被用户手动停止（用于显示"已停止思考"）
    executionSteps: List<AgentExecutionStep> = emptyList(),
    groundingMetadata: com.xiaoxiami.app.service.GroundingMetadata? = null, // 🆕 引用元数据
    onRegenerate: ((String) -> Unit)? = null,
    onCopy: ((String) -> Unit)? = null,
    onLike: ((String) -> Unit)? = null,
    onDislike: ((String) -> Unit)? = null,
    onSpeak: ((String) -> Unit)? = null,
    onStopSpeak: (() -> Unit)? = null,
    onShare: ((String) -> Unit)? = null,
    onEdit: ((ChatMessage) -> Unit)? = null, // 🆕 修改消息
    onDelete: ((String) -> Unit)? = null, // 🆕 删除消息
    onSelectText: ((String) -> Unit)? = null, // 🆕 选取文本
    onShowDebugLog: ((String) -> Unit)? = null, // 🆕 显示调试日志（4次快速点击触发）
    onMemoryClick: (() -> Unit)? = null // 🆕 点击记忆徽章
) {
    val isUser = message.isUser
    val context = LocalContext.current
    val haptic = LocalHapticFeedback.current // 🆕 震动反馈
    var isLiked by remember { mutableStateOf(false) }
    var isDisliked by remember { mutableStateOf(false) }
    var isSpeaking by remember { mutableStateOf(false) }
    var showContextMenu by remember { mutableStateOf(false) } // 🆕 上下文菜单状态
    var showExecutionDetails by remember(message.id, message.content.isBlank()) { 
        mutableStateOf(message.content.isBlank()) 
    }
    
    // 🆕 快速点击检测（4次点击打开调试日志）
    var clickCount by remember { mutableIntStateOf(0) }
    var lastClickTime by remember { mutableLongStateOf(0L) }

    // 🆕 解析多张图片URI（逗号分隔）
    val imageUris = remember(message.imageUri) {
        message.imageUri?.split(",")?.map { it.trim() }?.filter { it.isNotBlank() } ?: emptyList()
    }
    
    // 图片预览状态
    var previewImageUri by remember { mutableStateOf<String?>(null) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        // 消息气泡
        Column(
            horizontalAlignment = if (isUser) Alignment.End else Alignment.Start,
            modifier = Modifier.widthIn(max = 280.dp) // 限制最大宽度
        ) {
            // 🆕 图片区域（独立展示，不带黑色背景）
            if (imageUris.isNotEmpty()) {
                when {
                    // 单张图片：大图展示
                    imageUris.size == 1 -> {
                        Box(
                            modifier = Modifier
                                .widthIn(max = 200.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .clickable { previewImageUri = imageUris[0] }
                        ) {
                            AsyncImage(
                                model = Uri.parse(imageUris[0]),
                                contentDescription = "图片",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .aspectRatio(1f)
                            )
                        }
                    }
                    // 2张图片：横向排列
                    imageUris.size == 2 -> {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            imageUris.forEach { uri ->
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .aspectRatio(1f)
                                        .clip(RoundedCornerShape(8.dp))
                                        .clickable { previewImageUri = uri }
                                ) {
                                    AsyncImage(
                                        model = Uri.parse(uri),
                                        contentDescription = "图片",
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                }
                            }
                        }
                    }
                    // 3张及以上：网格布局
                    else -> {
                        val columns = if (imageUris.size <= 4) 2 else 3
                        Column(
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            imageUris.chunked(columns).forEach { rowImages ->
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    rowImages.forEach { uri ->
                                        Box(
                                            modifier = Modifier
                                                .weight(1f)
                                                .aspectRatio(1f)
                                                .clip(RoundedCornerShape(8.dp))
                                                .clickable { previewImageUri = uri }
                                        ) {
                                            AsyncImage(
                                                model = Uri.parse(uri),
                                                contentDescription = "图片",
                                                contentScale = ContentScale.Crop,
                                                modifier = Modifier.fillMaxSize()
                                            )
                                        }
                                    }
                                    // 填充空白格子保持对齐
                                    repeat(columns - rowImages.size) {
                                        Spacer(modifier = Modifier.weight(1f))
                                    }
                                }
                            }
                        }
                    }
                }
                
                // 图片和文字之间的间距
                if (message.content.isNotBlank()) {
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
            
            // 🆕 记忆更新状态提示
            // 兼容逻辑：若memoryStatus > 0则使用该状态，否则检查memoryUpdated（视为已更新）
            val status = if (message.memoryStatus > 0) message.memoryStatus else if (message.memoryUpdated) 2 else 0
            if (!isUser && status > 0) {
                MemoryUpdatedBadge(
                    status = status,
                    onClick = { onMemoryClick?.invoke() }
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
            
            // 🆕 把执行过程放在最终结果的前方
            if (!isUser && executionSteps.isNotEmpty()) {
                AgentExecutionCard(
                    executionSteps = executionSteps,
                    expanded = showExecutionDetails,
                    onToggle = { showExecutionDetails = !showExecutionDetails }
                )
                Spacer(modifier = Modifier.height(8.dp))
            }

            // 🆕 文字区域（带背景色）
            if (message.content.isNotBlank()) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(
                            when {
                                isUser -> Color(0xFF1A1A1A)
                                else -> Color.White
                            }
                        )
                        .border(
                            width = if (isUser) 0.dp else 1.dp,
                            color = if (isUser) Color.Transparent else Color(0xFFEEEEEE),
                            shape = RoundedCornerShape(16.dp)
                        )
                        .pointerInput(message.id) {
                            detectTapGestures(
                                onTap = {
                                    // 🆕 检测4次快速点击（仅AI消息）
                                    if (!isUser && onShowDebugLog != null) {
                                        val currentTime = System.currentTimeMillis()
                                        if (currentTime - lastClickTime < 500) {
                                            clickCount++
                                            if (clickCount >= 4) {
                                                // 4次快速点击，显示调试日志
                                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                                onShowDebugLog(message.id)
                                                clickCount = 0
                                            }
                                        } else {
                                            clickCount = 1
                                        }
                                        lastClickTime = currentTime
                                    }
                                },
                                onLongPress = {
                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    showContextMenu = true
                                }
                            )
                        }
                        .padding(horizontal = 16.dp, vertical = 10.dp)
                ) {
                    // 显示文字内容（使用 Markdown 渲染）
                    if (isUser) {
                        // 用户消息：普通文本
                        Text(
                            text = message.content,
                            fontSize = 15.sp,
                            color = Color.White,
                            lineHeight = 22.sp
                        )
                    } else {
                        // AI 消息：Markdown 渲染（带打字机效果）
                        Column {
                            Box {
                                MarkdownText(
                                    markdown = message.content.formatCitations(),
                                    fontSize = 15.sp,
                                    color = Color(0xFF333333),
                                    style = LocalTextStyle.current.copy(
                                        lineHeight = 22.sp
                                    )
                                )
                                
                                // 🆕 打字机光标（只在最后一条AI消息且正在生成时显示）
                                if (showCursor && message.content.isNotBlank()) {
                                    TypewriterCursor(
                                        isGenerating = true,
                                        modifier = Modifier.align(Alignment.BottomEnd)
                                    )
                                }
                            }
                            
                            // 🆕 引用源列表（联网搜索结果）
                            if (groundingMetadata != null && groundingMetadata.groundingChunks.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(12.dp))
                                SourceReferences(
                                    groundingMetadata = groundingMetadata,
                                    context = context
                                )
                            }
                        }
                    }
                }
            } else if (!isUser && imageUris.isEmpty() && executionSteps.isEmpty()) {
                // 🆕 AI 思考中状态 或 已停止思考状态（无图片也无文字也无执行过程）
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White)
                        .border(
                            width = 1.dp,
                            color = Color(0xFFEEEEEE),
                            shape = RoundedCornerShape(16.dp)
                        )
                        .padding(horizontal = 16.dp, vertical = 10.dp)
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 4.dp)
                    ) {
                        if (isStopped) {
                            // 🆕 已停止思考状态
                            Icon(
                                imageVector = Icons.Default.StopCircle,
                                contentDescription = "已停止",
                                tint = Color(0xFF999999),
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = "已停止思考",
                                fontSize = 14.sp,
                                color = Color(0xFF999999)
                            )
                        } else {
                            // 正在思考中状态
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = Color(0xFF1A1A1A),
                                strokeWidth = 2.dp
                            )
                            Text(
                                text = "正在思考中...",
                                fontSize = 14.sp,
                                color = Color(0xFF666666)
                            )
                        }
                    }
                }
            }

            // 🆕 AI消息操作按钮（重新生成、复制、赞、踩、播报、分享）
            if (!isUser && message.content.isNotBlank()) {
                Row(
                    modifier = Modifier
                        .padding(top = 8.dp, start = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // 重新生成（仅最新一条AI消息显示）
                    if (isLastAIMessage) {
                        IconButton(
                            onClick = { onRegenerate?.invoke(message.id) },
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "重新生成",
                                tint = Color(0xFF666666),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    // 复制
                    IconButton(
                        onClick = {
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            val clip = ClipData.newPlainText("AI回复", message.content)
                            clipboard.setPrimaryClip(clip)
                            Toast.makeText(context, "复制成功", Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "复制",
                            tint = Color(0xFF666666),
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    // 赞
                    IconButton(
                        onClick = {
                            isLiked = !isLiked
                            if (isLiked) isDisliked = false
                        },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = if (isLiked) Icons.Default.ThumbUp else Icons.Outlined.ThumbUp,
                            contentDescription = "赞",
                            tint = if (isLiked) Color(0xFF1A1A1A) else Color(0xFF666666),
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    // 踩
                    IconButton(
                        onClick = {
                            isDisliked = !isDisliked
                            if (isDisliked) isLiked = false
                        },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = if (isDisliked) Icons.Default.ThumbDown else Icons.Outlined.ThumbDown,
                            contentDescription = "踩",
                            tint = if (isDisliked) Color(0xFFE53935) else Color(0xFF666666),
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    // 播报（支持播放/暂停）
                    IconButton(
                        onClick = {
                            if (isSpeaking) {
                                onStopSpeak?.invoke()
                                isSpeaking = false
                            } else {
                                onSpeak?.invoke(message.content)
                                isSpeaking = true
                            }
                        },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = if (isSpeaking) Icons.Default.Stop else Icons.Default.VolumeUp,
                            contentDescription = if (isSpeaking) "停止播报" else "播报",
                            tint = if (isSpeaking) Color(0xFF1A1A1A) else Color(0xFF666666),
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    // 分享
                    IconButton(
                        onClick = {
                            Toast.makeText(context, "正在开发中", Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Share,
                            contentDescription = "分享",
                            tint = Color(0xFF666666),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
            
            // 🆕 上下文菜单
            if (showContextMenu) {
                MessageContextMenu(
                    message = message,
                    isUser = isUser,
                    onDismiss = { showContextMenu = false },
                    onEdit = {
                        onEdit?.invoke(message)
                        showContextMenu = false
                    },
                    onCopy = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        val clip = ClipData.newPlainText(if (isUser) "用户消息" else "AI回复", message.content)
                        clipboard.setPrimaryClip(clip)
                        Toast.makeText(context, "复制成功", Toast.LENGTH_SHORT).show()
                        showContextMenu = false
                    },
                    onDelete = {
                        onDelete?.invoke(message.id)
                        showContextMenu = false
                    },
                    onSelectText = {
                        onSelectText?.invoke(message.content)
                        showContextMenu = false
                    },
                    onLike = {
                        isLiked = !isLiked
                        if (isLiked) isDisliked = false
                        showContextMenu = false
                    },
                    onDislike = {
                        isDisliked = !isDisliked
                        if (isDisliked) isLiked = false
                        showContextMenu = false
                    },
                    onShare = {
                        Toast.makeText(context, "正在开发中", Toast.LENGTH_SHORT).show()
                        showContextMenu = false
                    }
                )
            }
        }
    }
    
    // 🆕 图片放大预览Dialog（支持双指缩放）
    if (previewImageUri != null) {
        Dialog(
            onDismissRequest = { previewImageUri = null },
            properties = DialogProperties(
                usePlatformDefaultWidth = false,
                dismissOnBackPress = true,
                dismissOnClickOutside = false,
                decorFitsSystemWindows = false // 全屏模式
            )
        ) {
            var scale by remember { mutableFloatStateOf(1f) }
            var offsetX by remember { mutableFloatStateOf(0f) }
            var offsetY by remember { mutableFloatStateOf(0f) }
            
            val minScale = 0.8f
            val maxScale = 6f
            
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black)
                    .pointerInput(Unit) {
                        detectTapGestures(
                            onDoubleTap = {
                                if (scale > 1f) {
                                    scale = 1f
                                    offsetX = 0f
                                    offsetY = 0f
                                } else {
                                    scale = 2.5f
                                }
                            },
                            onTap = { previewImageUri = null }
                        )
                    }
            ) {
                AsyncImage(
                    model = Uri.parse(previewImageUri),
                    contentDescription = "图片查看",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer(
                            scaleX = scale,
                            scaleY = scale,
                            translationX = offsetX,
                            translationY = offsetY
                        )
                        .pointerInput(Unit) {
                            detectTransformGestures { _, pan, zoom, _ ->
                                val newScale = (scale * zoom).coerceIn(minScale, maxScale)
                                scale = newScale
                                if (scale > 0.8f) {
                                    offsetX += pan.x
                                    offsetY += pan.y
                                }
                                if (scale <= 1f) {
                                    offsetX = 0f
                                    offsetY = 0f
                                }
                            }
                        }
                )
                
                // 左上角返回按钮
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .systemBarsPadding()
                        .padding(16.dp)
                        .size(44.dp)
                        .shadow(
                            elevation = 8.dp,
                            shape = CircleShape,
                            ambientColor = Color.Black.copy(alpha = 0.3f),
                            spotColor = Color.Black.copy(alpha = 0.3f)
                        )
                        .background(Color.Black.copy(alpha = 0.5f), CircleShape)
                        .clickable { previewImageUri = null },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "返回",
                        tint = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun AgentExecutionCard(
    executionSteps: List<AgentExecutionStep>,
    expanded: Boolean,
    onToggle: () -> Unit
) {
    val visibleSteps = if (expanded) executionSteps else emptyList()
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = Color(0xFFF9F9F9).copy(alpha = 0.8f),
        border = BorderStroke(1.dp, Color(0xFFEEEEEE).copy(alpha = 0.6f))
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onToggle() },
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "执行过程",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFFAAAAAA)
                    )
                    Surface(
                        shape = RoundedCornerShape(999.dp),
                        color = Color(0xFFF0F0F0).copy(alpha = 0.5f)
                    ) {
                        Text(
                            text = "${executionSteps.size} 步",
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            fontSize = 11.sp,
                            color = Color(0xFFBBBBBB)
                        )
                    }
                }
                Icon(
                    imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (expanded) "收起" else "展开",
                    tint = Color(0xFFCCCCCC),
                    modifier = Modifier.size(18.dp)
                )
            }

            visibleSteps.forEach { step ->
                AgentExecutionStepRow(step)
            }
        }
    }
}

@Composable
private fun AgentExecutionStepRow(step: AgentExecutionStep) {
    val accent = when (step.status) {
        AgentStepStatus.SUCCESS -> Color(0xFF2E7D32)
        AgentStepStatus.ERROR -> Color(0xFFC62828)
        AgentStepStatus.FAILED -> Color(0xFFC62828)
        AgentStepStatus.WARNING -> Color(0xFFE65100)
        AgentStepStatus.WAITING -> Color(0xFFEF6C00)
        AgentStepStatus.INFO -> when (step.kind) {
            AgentStepKind.GOAL -> Color(0xFF1565C0)
            AgentStepKind.REVIEW -> Color(0xFF6A1B9A)
            AgentStepKind.FINAL -> Color(0xFF00897B)
            else -> Color(0xFF5D6673)
        }
    }

    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier
                .padding(top = 4.dp)
                .size(8.dp)
                .clip(CircleShape)
                .background(accent.copy(alpha = 0.5f))
        )
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = step.title,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = Color(0xFF888888)
            )
            Text(
                text = step.detail,
                fontSize = 12.sp,
                color = Color(0xFFAAAAAA),
                lineHeight = 18.sp
            )
        }
    }
}

/**
 * 消息上下文菜单 - iOS风格高级感弹窗
 */
@Composable
private fun MessageContextMenu(
    message: ChatMessage,
    isUser: Boolean,
    onDismiss: () -> Unit,
    onEdit: () -> Unit,
    onCopy: () -> Unit,
    onDelete: () -> Unit,
    onSelectText: () -> Unit,
    onLike: () -> Unit,
    onDislike: () -> Unit,
    onShare: () -> Unit
) {
    val context = LocalContext.current
    // 🎨 使用Dialog替代AlertDialog，实现完全自定义的iOS风格
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = true
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // 📦 主菜单容器
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(elevation = 20.dp, shape = RoundedCornerShape(16.dp), spotColor = Color.Black.copy(alpha = 0.15f), ambientColor = Color.Black.copy(alpha = 0.15f))
                    .background(Color.White, RoundedCornerShape(16.dp))
                    .clip(RoundedCornerShape(16.dp))
            ) {
                if (!isUser) {
                    // 🎯 AI回复：顶部显示"喜欢/不喜欢"按钮（iOS风格）
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(72.dp), // 🆕 增加高度，避免文字被截断
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // 喜欢按钮
                        IOSActionButton(
                            icon = Icons.Outlined.ThumbUp,
                            text = "喜欢",
                            onClick = onLike,
                            modifier = Modifier.weight(1f)
                        )
                        
                        // 分隔线
                        Box(
                            modifier = Modifier
                                .width(1.dp)
                                .height(48.dp) // 🆕 调整分隔线高度
                                .background(Color(0xFFE5E5E5))
                        )
                        
                        // 不喜欢按钮
                        IOSActionButton(
                            icon = Icons.Outlined.ThumbDown,
                            text = "不喜欢",
                            onClick = onDislike,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    
                    // 分隔线
                    Divider(color = Color(0xFFE5E5E5), thickness = 1.dp)
                }
                
                // 📋 菜单项列表
                if (isUser) {
                    // 用户消息菜单
                    IOSMenuItem(
                        icon = Icons.Outlined.Edit,
                        text = "修改",
                        onClick = onEdit,
                        showDivider = true
                    )
                    IOSMenuItem(
                        icon = Icons.Outlined.ContentCopy,
                        text = "复制",
                        onClick = onCopy,
                        showDivider = true
                    )
                    IOSMenuItem(
                        icon = Icons.Outlined.DeleteOutline,
                        text = "删除",
                        onClick = onDelete,
                        showDivider = false
                    )
                } else {
                    // AI回复菜单
                    IOSMenuItem(
                        icon = Icons.Outlined.ContentCopy,
                        text = "复制",
                        onClick = onCopy,
                        showDivider = true
                    )
                    IOSMenuItem(
                        icon = Icons.Outlined.TextFields,
                        text = "选取文字",
                        onClick = onSelectText,
                        showDivider = true
                    )
                    IOSMenuItem(
                        icon = Icons.Outlined.VolumeUp,
                        text = "朗读",
                        onClick = {
                            Toast.makeText(
                                context,
                                "正在开发中",
                                Toast.LENGTH_SHORT
                            ).show()
                            onDismiss()
                        },
                        showDivider = true
                    )
                    IOSMenuItem(
                        icon = Icons.Outlined.Share,
                        text = "分享",
                        onClick = onShare,
                        showDivider = false
                    )
                }
            }
            // 🆕 移除取消按钮，点击外部区域即可关闭
        }
    }
}

/**
 * 🆕 记忆已更新徽章 - 显示在AI回复顶部
 * 带有动画效果：从笔记图标变换到完成图标，表达"记住"的过程
 */
@Composable
private fun MemoryUpdatedBadge(
    status: Int, // 1=更新中, 2=已更新
    onClick: () -> Unit
) {
    // 动画进度：0f -> 1f
    var animationPlayed by remember { mutableStateOf(false) }
    val animationProgress by animateFloatAsState(
        targetValue = if (animationPlayed) 1f else 0f,
        animationSpec = tween(
            durationMillis = 800,
            easing = FastOutSlowInEasing
        ),
        label = "memory_icon_animation"
    )
    
    // 无限循环动画（用于更新中状态）
    val infiniteTransition = rememberInfiniteTransition(label = "memory_loading")
    val alphaAnim by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "alpha"
    )

    // 组件首次显示时触发动画
    LaunchedEffect(Unit) {
        delay(200)
        animationPlayed = true
    }
    
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFFF5F5F5)) // 浅灰色背景
            .border(
                width = 1.dp,
                color = Color(0xFFE8E8E8),
                shape = RoundedCornerShape(8.dp)
            )
            .clickable(enabled = status == 2) { onClick() } // 仅完成状态可点击
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        // 🎬 图标区域
        Box(
            modifier = Modifier.size(16.dp),
            contentAlignment = Alignment.Center
        ) {
            if (status == 1) {
                // 状态1: 更新中 - 闪烁的笔记图标
                Icon(
                    imageVector = Icons.Outlined.EditNote,
                    contentDescription = "记忆更新中",
                    tint = Color(0xFF1A1A1A),
                    modifier = Modifier
                        .size(14.dp)
                        .graphicsLayer { alpha = alphaAnim }
                )
            } else {
                // 状态2: 已更新 - 完成图标
                Icon(
                    imageVector = Icons.Outlined.CheckCircle,
                    contentDescription = "记忆已更新",
                    tint = Color(0xFF1A1A1A), // 黑色图标
                    modifier = Modifier
                        .size(14.dp)
                        .graphicsLayer {
                            alpha = animationProgress
                            scaleX = 0.7f + (animationProgress * 0.3f)
                            scaleY = 0.7f + (animationProgress * 0.3f)
                        }
                )
            }
        }
        
        // 文案
        Text(
            text = if (status == 1) "记忆更新中..." else "记忆已更新 >",
            fontSize = 12.sp,
            color = Color(0xFF666666), // 弱化的灰色文字
            fontWeight = FontWeight.Normal
        )
    }
}

/**
 * 🆕 文本选择Dialog - 支持系统文本选择功能
 * 用户可以长按选择文本，然后使用系统的复制/分享等功能
 */
@Composable
private fun TextSelectionDialog(
    text: String,
    onDismiss: () -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = true,
            usePlatformDefaultWidth = false
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // 文本选择区域
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 100.dp, max = 400.dp)
                    .shadow(elevation = 20.dp, shape = RoundedCornerShape(16.dp))
                    .background(Color.White, RoundedCornerShape(16.dp))
                    .clip(RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                // 使用SelectionContainer启用文本选择
                androidx.compose.foundation.text.selection.SelectionContainer {
                    androidx.compose.foundation.rememberScrollState().let { scrollState ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .verticalScroll(scrollState)
                        ) {
                            Text(
                                text = text,
                                fontSize = 15.sp,
                                lineHeight = 24.sp,
                                color = Color(0xFF333333),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // 提示文字
            Text(
                text = "长按文字可选择并复制",
                fontSize = 13.sp,
                color = Color.White.copy(alpha = 0.8f)
            )
        }
    }
}

/**
 * iOS风格顶部动作按钮（喜欢/不喜欢）
 */
@Composable
private fun IOSActionButton(
    icon: ImageVector,
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = text,
            tint = Color(0xFF1A1A1A),
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = text,
            fontSize = 13.sp,
            fontWeight = FontWeight.Normal,
            color = Color(0xFF1A1A1A)
        )
    }
}

/**
 * iOS风格菜单项
 */
@Composable
private fun IOSMenuItem(
    icon: ImageVector,
    text: String,
    onClick: () -> Unit,
    showDivider: Boolean
) {
    Column(
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = text,
                tint = Color(0xFF1A1A1A),
                modifier = Modifier.size(22.dp)
            )
            Spacer(modifier = Modifier.width(14.dp))
            Text(
                text = text,
                fontSize = 16.sp,
                fontWeight = FontWeight.Normal,
                color = Color(0xFF1A1A1A)
            )
        }
        
        if (showDivider) {
            Divider(
                color = Color(0xFFE5E5E5),
                thickness = 0.5.dp,
                modifier = Modifier.padding(start = 52.dp) // 与文字对齐
            )
        }
    }
}


/**
 * 音频波形动画组件
 */

@Composable
private fun AudioWaveform(
    isActive: Boolean,
    isCanceling: Boolean,
    modifier: Modifier = Modifier
) {
    val barCount = 24  // 增加波纹条数，更密集
    val color = if (isCanceling) Color(0xFFE53935) else Color(0xFF1A1A1A)  // 🔧 黑色/红色

    val infiniteTransition = rememberInfiniteTransition(label = "waveform")

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        repeat(barCount) { index ->
            val delay = index * 40  // 减少延迟，更流畅
            val animation by infiniteTransition.animateFloat(
                initialValue = 0.2f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(
                        durationMillis = 500,
                        delayMillis = delay,
                        easing = FastOutSlowInEasing
                    ),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "bar_$index"
            )

            val heightFraction = if (isActive) animation else 0.2f
            val barHeight = 6.dp + (36.dp * heightFraction)  // 更高的波纹

            Box(
                modifier = Modifier
                    .width(2.5.dp)  // 稍细的条
                    .height(barHeight)
                    .clip(RoundedCornerShape(1.25.dp))
                    .background(color.copy(alpha = 0.5f + 0.5f * heightFraction))  // 更明显的透明度变化
            )
        }
    }
}

/**
 * 底部输入区域
 */
@Composable
private fun ChatInputArea(
    isRecording: Boolean,
    isCanceling: Boolean,
    showTextInput: Boolean,
    inputText: String,
    capturedImageUris: List<Uri>, // 🆕 多图列表
    isInputFocused: Boolean,
    hasShownQuickQuestions: Boolean,
    messagesEmpty: Boolean,
    onInputTextChange: (String) -> Unit,
    onRecordingStateChange: (Boolean, Boolean) -> Unit,
    onShowTextInputChange: (Boolean) -> Unit,
    onSendMessage: () -> Unit,
    onMoreClick: () -> Unit,
    onCameraClick: () -> Unit,
    onRemoveImage: (Uri) -> Unit, // 🆕 删除指定图片
    onImageClick: (Uri) -> Unit, // 🆕 点击图片放大查看
    onInputFocusChange: (Boolean) -> Unit,
    inputFocusRequester: FocusRequester,
    onQuickQuestionClick: (String) -> Unit,
    isGenerating: Boolean = false, // 🆕 是否正在生成
    onStopGeneration: () -> Unit = {}, // 🆕 停止生成回调
    modifier: Modifier = Modifier
) {
    var isExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp)
            .padding(top = 8.dp)
            .padding(bottom = 8.dp) // 🔧 底部最小间距
    ) {
        // 🆕 录音状态不再在这里显示，改用RecordingOverlay遮罩层

        // 输入框容器（确保录音时高度与正常状态一致，有图片时增高）
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .then(
                    if (isExpanded) {
                        Modifier.fillMaxHeight(0.85f)
                    } else {
                        // 🆕 有图片时高度增加到168dp（原来的3倍），无图片时保持56dp
                        val baseHeight = if (capturedImageUris.isNotEmpty()) 168.dp else 56.dp
                        Modifier.height(baseHeight)
                    }
                )
                // 🚫 移除阴影，确保与导航栏融合
                .clip(RoundedCornerShape(28.dp))
                .background(
                    if (isRecording) {
                        // 录音时显示黑色/红色
                        if (isCanceling) Color(0xFFE53935) else Color(0xFF1A1A1A)
                    } else {
                        Color.White
                    }
                ),
            contentAlignment = Alignment.Center
        ) {
            if (showTextInput) {
                TextInputMode(
                    inputText = inputText,
                    capturedImageUris = capturedImageUris, // 🆕 多图列表
                    isExpanded = isExpanded,
                    isInputFocused = isInputFocused,
                    onInputTextChange = onInputTextChange,
                    onSwitchToVoice = {
                        isExpanded = false
                        onShowTextInputChange(false)
                    },
                    onSendMessage = {
                        isExpanded = false
                        onSendMessage()
                    },

                    onMoreClick = onMoreClick, // 🆕 传递更多按钮回调
                    onCameraClick = onCameraClick,
                    onRemoveImage = onRemoveImage, // 🆕 删除指定图片
                    onImageClick = onImageClick, // 🆕 点击图片放大查看
                    onRecordingStateChange = onRecordingStateChange, // 🆕 传递录音状态回调
                    onExpandChange = { isExpanded = it },
                    onInputFocusChange = onInputFocusChange,
                    inputFocusRequester = inputFocusRequester,
                    isGenerating = isGenerating, // 🆕 传递生成状态
                    onStopGeneration = onStopGeneration // 🆕 传递停止生成回调
                )
            } else {
                VoiceInputMode(
                    capturedImageUris = capturedImageUris, // 🆕 多图列表
                    isRecording = isRecording,
                    isCanceling = isCanceling,
                    onRecordingStateChange = onRecordingStateChange,
                    onShowTextInputChange = onShowTextInputChange,
                    onMoreClick = onMoreClick,
                    onCameraClick = onCameraClick,
                    onRemoveImage = onRemoveImage, // 🆕 删除指定图片
                    onImageClick = onImageClick, // 🆕 点击图片放大查看
                    isGenerating = isGenerating, // 🆕 传递生成状态
                    onStopGeneration = onStopGeneration // 🆕 传递停止生成回调
                )
            }
        }
    }
}

/**
 * 录音状态指示器 - 显示音波和提示文字
 */
@Composable
private fun RecordingIndicator(
    isCanceling: Boolean
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // 音频波形
        AudioWaveform(
            isActive = true,
            isCanceling = isCanceling,
            modifier = Modifier.fillMaxWidth(0.6f)
        )

        Spacer(modifier = Modifier.height(12.dp))

        // 提示文字
        Text(
            text = "松开发送", // 🆕 移除取消功能
            fontSize = 14.sp,
            color = Color(0xFF666666)
        )
    }
}

/**
 * 快捷问题组件
 */
@Composable
private fun QuickQuestions(onQuestionClick: (String) -> Unit) {
    val questions = listOf(
        "有什么调整饮食的方法，能养好肠胃？",
        "折叠屏手机的屏幕会被折坏吗？",
        "为什么我们做梦大多记不住？"
    )

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.Start,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        questions.forEach { question ->
            Box(
                modifier = Modifier
                    .wrapContentWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color.White)
                    .border(1.dp, Color(0xFFEEEEEE), RoundedCornerShape(20.dp))
                    .clickable { onQuestionClick(question) }
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                Text(
                    text = question,
                    fontSize = 14.sp,
                    color = Color(0xFF333333),
                    maxLines = 1
                )
            }
        }
    }
}

/**
 * 文本输入模式
 */
@Composable
private fun TextInputMode(
    inputText: String,
    capturedImageUris: List<Uri>, // 🆕 多图列表
    isExpanded: Boolean,
    isInputFocused: Boolean,
    onInputTextChange: (String) -> Unit,
    onSwitchToVoice: () -> Unit,
    onSendMessage: () -> Unit,
    onMoreClick: () -> Unit, // 🆕 更多按钮回调
    onCameraClick: () -> Unit,
    onRemoveImage: (Uri) -> Unit, // 🆕 删除指定图片
    onImageClick: (Uri) -> Unit, // 🆕 点击图片放大查看
    onRecordingStateChange: (Boolean, Boolean) -> Unit, // 🆕 录音状态回调
    onExpandChange: (Boolean) -> Unit,
    onInputFocusChange: (Boolean) -> Unit,
    inputFocusRequester: FocusRequester,
    isGenerating: Boolean = false, // 🆕 是否正在生成
    onStopGeneration: () -> Unit = {} // 🆕 停止生成回调
) {
    val keyboardController = LocalSoftwareKeyboardController.current
    // 计算实际行数（根据换行符和文字自动换行估算）
    val lineCount = remember(inputText) {
        val newlineCount = inputText.count { it == '\n' }
        // 估算每行大约能容纳20-25个中文字符
        val estimatedLinesPerRow = if (inputText.length > 0) {
            (inputText.length / 22).coerceAtLeast(1)
        } else 1
        // 取换行符数量和估算行数的较大值
        (newlineCount + 1).coerceAtLeast(estimatedLinesPerRow)
    }
    // 超过2行显示展开按钮
    val showExpandButton = lineCount >= 2
    // 超过1行开始自适应高度
    val shouldExpandHeight = lineCount > 1
    val haptic = LocalHapticFeedback.current

    // 自动获取焦点并弹出键盘（仅在首次显示时）
    LaunchedEffect(Unit) {
        inputFocusRequester.requestFocus()
        keyboardController?.show()
        onInputFocusChange(true)
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (isExpanded) Modifier.fillMaxHeight() else Modifier.wrapContentHeight())
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        // 🆕 第一行：图片预览区域（横向滚动，支持多图）
        if (capturedImageUris.isNotEmpty()) {
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(80.dp) // 🆕 固定高度，为第一行预留空间
                    .padding(bottom = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                items(capturedImageUris) { imageUri ->
                    Box(
                        modifier = Modifier
                            .size(64.dp) // 🆕 缩略图大小调整为64dp
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { onImageClick(imageUri) } // 🆕 点击放大查看
                    ) {
                        AsyncImage(
                            model = imageUri,
                            contentDescription = "图片",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                        // 删除按钮（右上角X）- 放大尺寸并添加阴影
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .offset(x = 6.dp, y = (-6).dp) // 调整位置，让X稍微在外面
                                .size(28.dp) // 🆕 增大到28dp，更容易点击
                                .shadow(
                                    elevation = 4.dp,
                                    shape = CircleShape,
                                    ambientColor = Color.Black.copy(alpha = 0.3f),
                                    spotColor = Color.Black.copy(alpha = 0.3f)
                                )
                                .background(Color.Black.copy(alpha = 0.7f), CircleShape)
                                .clip(CircleShape)
                                .clickable {
                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    onRemoveImage(imageUri)
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "删除",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp) // 🆕 图标增大到16dp
                            )
                        }
                    }
                }
            }
        }

        // 🆕 第二行：输入框和按钮区域
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 相机按钮（仅在输入框为空且没有图片时显示）
            if (inputText.isBlank() && capturedImageUris.isEmpty()) {
                IconButton(
                    onClick = {
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        onCameraClick()
                    },
                    modifier = Modifier
                        .size(36.dp)
                        .align(Alignment.CenterVertically)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.CameraAlt,
                        contentDescription = "拍照",
                        tint = Color(0xFF666666),
                        modifier = Modifier.size(22.dp)
                    )
                }
            }

            // 输入框
            Box(
                modifier = Modifier
                    .weight(1f)
                    .then(if (isExpanded) Modifier.fillMaxHeight() else Modifier.height(44.dp))
                    .align(Alignment.CenterVertically),
                contentAlignment = Alignment.CenterStart
            ) {
                val textFieldInteractionSource = remember { MutableInteractionSource() }
                // 监听焦点状态
                val isFocused by textFieldInteractionSource.collectIsFocusedAsState()
                LaunchedEffect(isFocused) {
                    onInputFocusChange(isFocused)
                }

                BasicTextField(
                    value = inputText,
                    onValueChange = onInputTextChange,
                    modifier = Modifier
                        .fillMaxWidth()
                        .then(
                            if (isExpanded) {
                                Modifier.fillMaxHeight()
                            } else {
                                // 移除固定高度，让内容撑开，避免光标截断
                                Modifier
                            }
                        )
                        .focusRequester(inputFocusRequester),
                    textStyle = LocalTextStyle.current.copy(
                        fontSize = 15.sp,
                        color = Color(0xFF333333)
                    ),
                    interactionSource = textFieldInteractionSource,
                    singleLine = !isExpanded,
                    maxLines = if (isExpanded) Int.MAX_VALUE else 1,
                    decorationBox = { innerTextField ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp) // 🔧 减小padding，避免文字被截断
                                .pointerInput(Unit) { // 🆕 添加长按录音手势
                                    awaitPointerEventScope {
                                        while (true) {
                                            val down = awaitFirstDown(requireUnconsumed = false)
                                            val startY = down.position.y
                                            // 记录初始是否有重按/长按意图，这里使用时间阈值
                                            
                                            try {
                                                withTimeout(500) { 
                                                    // 等待抬起
                                                    do {
                                                        val event = awaitPointerEvent()
                                                    } while (event.changes.any { it.pressed })
                                                    
                                                    // 如果在500ms内抬起，则视为点击
                                                    inputFocusRequester.requestFocus()
                                                    keyboardController?.show()
                                                }
                                            } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
                                                // 长按触发！
                                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                                // 立即开始录音
                                                onRecordingStateChange(true, false)
                                                
                                                // 持续跟踪拖动
                                                var isCanceling = false
                                                var finished = false
                                                
                                                while (!finished) {
                                                    val event = awaitPointerEvent()
                                                    val changes = event.changes
                                                    changes.forEach { change ->
                                                        if (change.pressed) {
                                                            val currentY = change.position.y
                                                            val dragOffset = currentY - startY
                                                            // 调整阈值为 -100f (约35dp)，更容易触发取消
                                                            if (dragOffset < -100f) { // 上滑取消阈值
                                                                if (!isCanceling) {
                                                                    isCanceling = true
                                                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                                                    onRecordingStateChange(true, true)
                                                                }
                                                            } else {
                                                                if (isCanceling) {
                                                                    isCanceling = false
                                                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                                                    onRecordingStateChange(true, false)
                                                                }
                                                            }
                                                            change.consume()
                                                        } else {
                                                            finished = true
                                                        }
                                                    }
                                                    if (changes.all { !it.pressed }) {
                                                        finished = true
                                                    }
                                                }
                                                
                                                // 手指抬起，结束录音
                                                onRecordingStateChange(false, isCanceling)
                                            }
                                        }
                                    }
                                },
                            contentAlignment = Alignment.CenterStart
                        ) {
                            if (inputText.isEmpty()) {
                                Text(
                                    "发消息或按住说话...",
                                    color = Color(0xFF999999),
                                    fontSize = 15.sp
                                )
                            }
                            innerTextField()
                        }
                    }
                )

                // 展开/收起按钮（当行数超过2行时显示）
                if (showExpandButton && !isExpanded) {
                    IconButton(
                        onClick = { onExpandChange(true) },
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .size(28.dp)
                            .background(Color.White.copy(alpha = 0.9f))
                    ) {
                        Icon(
                            imageVector = Icons.Default.KeyboardArrowUp,
                            contentDescription = "展开",
                            tint = Color(0xFF666666),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            // 语音切换按钮
            IconButton(
                onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    onSwitchToVoice()
                },
                modifier = Modifier
                    .size(36.dp)
                    .align(Alignment.CenterVertically)
            ) {
                Icon(
                    imageVector = Icons.Outlined.Mic,
                    contentDescription = "语音输入",
                    tint = Color(0xFF666666),
                    modifier = Modifier.size(22.dp)
                )
            }

            // 🆕 发送按钮/停止按钮/更多按钮（根据状态切换）
            // 优先级：正在生成 > 有内容 > 无内容
            when {
                // 🆕 【最高优先级】正在生成时显示停止按钮
                isGenerating -> {
                    IconButton(
                        onClick = {
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            onStopGeneration()
                        },
                        modifier = Modifier
                            .size(36.dp)
                            .align(Alignment.CenterVertically)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF1A1A1A)),
                            contentAlignment = Alignment.Center
                        ) {
                            // 内部白色方形（停止图标）
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .background(Color.White, RoundedCornerShape(2.dp))
                            )
                        }
                    }
                }
                // 有内容时显示发送按钮
                inputText.isNotBlank() || capturedImageUris.isNotEmpty() -> {
                    IconButton(
                        onClick = {
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            onSendMessage()
                        },
                        modifier = Modifier
                            .size(36.dp)
                            .align(Alignment.CenterVertically)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Send,
                            contentDescription = "发送",
                            tint = Color(0xFF1A1A1A),
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
                // 无内容且未生成时显示+号按钮
                else -> {
                    IconButton(
                        onClick = {
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            onMoreClick()
                        },
                        modifier = Modifier
                            .size(36.dp)
                            .align(Alignment.CenterVertically)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Add,
                            contentDescription = "更多",
                            tint = Color(0xFF666666),
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }
        }

        // 展开状态下的收起按钮
        if (isExpanded) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                IconButton(
                    onClick = { onExpandChange(false) },
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.KeyboardArrowDown,
                        contentDescription = "收起",
                        tint = Color(0xFF666666),
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }
    }
}

/**
 * 语音输入模式
 */
@Composable
private fun VoiceInputMode(
    capturedImageUris: List<Uri>, // 🆕 多图列表
    isRecording: Boolean,
    isCanceling: Boolean,
    onRecordingStateChange: (Boolean, Boolean) -> Unit,
    onShowTextInputChange: (Boolean) -> Unit,
    onMoreClick: () -> Unit,
    onCameraClick: () -> Unit = {},
    onRemoveImage: (Uri) -> Unit = {}, // 🆕 删除指定图片
    onImageClick: (Uri) -> Unit = {}, // 🆕 点击图片放大查看
    isGenerating: Boolean = false, // 🆕 是否正在生成
    onStopGeneration: () -> Unit = {} // 🆕 停止生成回调
) {
    var dragOffsetY by remember { mutableStateOf(0f) }
    val cancelThreshold = -80f
    val haptic = LocalHapticFeedback.current

    // 🆕 使用 Column 布局：第一行显示图片预览，第二行显示输入区
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = if (isRecording) 0.dp else 12.dp, vertical = 8.dp)
    ) {
        // 🆕 图片预览区域（横向滚动，支持多图）
        if (capturedImageUris.isNotEmpty()) {
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(80.dp)
                    .padding(bottom = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                items(capturedImageUris) { imageUri ->
                    Box(
                        modifier = Modifier
                            .size(64.dp) // 🆕 缩略图大小调整为64dp
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { onImageClick(imageUri) }
                    ) {
                        AsyncImage(
                            model = imageUri,
                            contentDescription = "图片",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                        // 删除按钮（右上角X）- 放大尺寸并添加阴影
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .offset(x = 6.dp, y = (-6).dp) // 调整位置，让X稍微在外面
                                .size(28.dp) // 🆕 增大到28dp，更容易点击
                                .shadow(
                                    elevation = 4.dp,
                                    shape = CircleShape,
                                    ambientColor = Color.Black.copy(alpha = 0.3f),
                                    spotColor = Color.Black.copy(alpha = 0.3f)
                                )
                                .background(Color.Black.copy(alpha = 0.7f), CircleShape)
                                .clip(CircleShape)
                                .clickable {
                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    onRemoveImage(imageUri)
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "删除",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp) // 🆕 图标增大到16dp
                            )
                        }
                    }
                }
            }
        }

        // 🆕 第二行：输入区域（原来的 Row）
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
        // 左侧相机按钮（录音时隐藏）
        if (!isRecording) {
            IconButton(
                onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    onCameraClick()
                },
                modifier = Modifier
                    .size(36.dp)
                    .align(Alignment.CenterVertically)
            ) {
                Icon(
                    imageVector = Icons.Outlined.CameraAlt, // 🆕 线型图标 (Request 4)
                    contentDescription = "拍照",
                    tint = Color(0xFF666666),
                    modifier = Modifier.size(24.dp)
                )
            }
        }

        // 核心区域：按住说话/录音状态
        Box(
            modifier = Modifier
                .weight(1f)
                .then(
                    if (isRecording) {
                        Modifier.fillMaxHeight()
                    } else {
                        Modifier.height(44.dp)
                    }
                )
                .clip(RoundedCornerShape(if (isRecording) 0.dp else 22.dp))
                .background(
                    if (isRecording) {
                        if (isCanceling) Color(0xFFE53935) else Color(0xFF1A1A1A)
                    } else {
                        Color.White
                    }
                )
                .align(Alignment.CenterVertically)
                .pointerInput(Unit) {
                    while (true) {
                        var isTooShort = false
                        // 🆕 记录录音开始时间
                        var recordingStartTime = 0L
                        val minRecordingDuration = 300L
                        
                        // 🆕 记录初始按下的Y坐标
                        var startY = 0f
                        
                        // 🆕 本地状态跟踪，避免重复回调，并用于最终决定
                        var currentIsCanceling = false

                        awaitPointerEventScope {
                            // 等待按下事件
                            val down = awaitFirstDown()
                            startY = down.position.y
                            dragOffsetY = 0f
                            
                            recordingStartTime = System.currentTimeMillis()
                            
                            // 开始录音
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            onRecordingStateChange(true, false)
                            
                            // 持续跟踪拖动直到松手
                            var isPressed = true
                            
                            while (isPressed) {
                                val event = awaitPointerEvent()
                                val changes = event.changes
                                
                                // 处理拖动
                                changes.forEach { change ->
                                    if (change.pressed) {
                                        // 🆕 计算拖动距离
                                        val currentY = change.position.y
                                        val currentDragOffsetY = currentY - startY
                                        
                                        // 检查是否触发取消 (上滑超过阈值)
                                        // 使用定义的 cancelThreshold = -80f
                                        val shouldCancel = currentDragOffsetY < cancelThreshold
                                        
                                        if (shouldCancel != currentIsCanceling) {
                                            currentIsCanceling = shouldCancel
                                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                            onRecordingStateChange(true, currentIsCanceling)
                                        }
                                        
                                        change.consume()
                                    } else {
                                        isPressed = false
                                    }
                                }
                                
                                // 检查是否所有手指都抬起
                                if (changes.all { !it.pressed }) {
                                    isPressed = false
                                }
                            }
                            
                            // 手指抬起，计算时长
                            val recordingDuration = System.currentTimeMillis() - recordingStartTime
                            if (recordingDuration < minRecordingDuration) {
                                isTooShort = true
                            }
                            
                            dragOffsetY = 0f
                        }
                        
                        // 退出受限作用域后处理结束逻辑
                        // 🆕 UI立即响应（震动和遮罩消失），后台录音延迟在回调中处理
                        if (isTooShort) {
                            // 录音时长太短，视为误触，立即取消
                            onRecordingStateChange(false, true)
                        } else {
                            // 有效录音：使用最终的取消状态
                            onRecordingStateChange(false, currentIsCanceling)
                        }
                    }
                },
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = if (isRecording) {
                    if (isCanceling) "松手取消" else "松开发送"
                } else {
                    "按住 说话"
                },
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                color = if (isRecording) Color.White else Color(0xFF666666)
            )
        }

        // 右侧按钮（录音时隐藏）
        if (!isRecording) {
            IconButton(
                onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    onShowTextInputChange(true)
                },
                modifier = Modifier
                    .size(36.dp)
                    .align(Alignment.CenterVertically)
            ) {
                Icon(
                    imageVector = Icons.Outlined.Keyboard,
                    contentDescription = "键盘",
                    tint = Color(0xFF666666),
                    modifier = Modifier.size(22.dp)
                )
            }

            // 🆕 停止按钮 / +号按钮（根据生成状态切换）
            if (isGenerating) {
                // 正在生成时显示停止按钮
                IconButton(
                    onClick = {
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        onStopGeneration()
                    },
                    modifier = Modifier
                        .size(36.dp)
                        .align(Alignment.CenterVertically)
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF1A1A1A)),
                        contentAlignment = Alignment.Center
                    ) {
                        // 内部白色方形（停止图标）
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .background(Color.White, RoundedCornerShape(2.dp))
                        )
                    }
                }
            } else {
                // 未生成时显示+号按钮
                IconButton(
                    onClick = {
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        onMoreClick()
                    },
                    modifier = Modifier
                        .size(36.dp)
                        .align(Alignment.CenterVertically)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.AddCircleOutline,
                        contentDescription = "更多",
                        tint = Color(0xFF666666),
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }
    } // Row 结束
} // Column 结束
}



/**
 * 功能项数据类
 */
data class FeatureItem(
    val icon: @Composable () -> Unit,
    val title: String,
    val subtitle: String,
    val iconTint: Color
)

/**
 * 底部功能浮层 - 可拖动展开
 */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FeatureBottomSheet(
    isVisible: Boolean,
    onDismiss: () -> Unit,
    onCameraClick: () -> Unit,
    onGalleryClick: () -> Unit
) {
    if (!isVisible) return

    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(
        skipPartiallyExpanded = false
    )

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color.White,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        dragHandle = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .width(40.dp)
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(Color(0xFFE0E0E0))
                )
            }
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 32.dp)
        ) {
            // 列表项
            FeatureItemRow(Icons.Outlined.CameraAlt, "拍照", onCameraClick)
            FeatureItemRow(Icons.Outlined.PhotoLibrary, "相册", onGalleryClick)
        }
    }
}

/**
 * 列表功能项
 */
@Composable
private fun FeatureItemRow(
    icon: ImageVector,
    title: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = Color(0xFF1A1A1A),
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(16.dp))
        Text(
            text = title,
            fontSize = 16.sp,
            color = Color(0xFF1A1A1A),
            fontWeight = FontWeight.Medium
        )
    }
}

/**
 * 顶部快捷功能网格 - 4个图标按钮
 */
@Composable
private fun QuickFeatureGrid(onFeatureClick: (String) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        // 联网搜索
        QuickFeatureItem(
            icon = {
                Icon(
                    imageVector = Icons.Outlined.Language,
                    contentDescription = null,
                    modifier = Modifier.size(28.dp)
                )
            },
            title = "联网搜索",
            onClick = { onFeatureClick("联网搜索") }
        )

        // 拍照
        QuickFeatureItem(
            icon = {
                Icon(
                    imageVector = Icons.Outlined.CameraAlt,
                    contentDescription = null,
                    modifier = Modifier.size(28.dp)
                )
            },
            title = "拍照",
            onClick = { onFeatureClick("拍照") }
        )

        // 相册
        QuickFeatureItem(
            icon = {
                Icon(
                    imageVector = Icons.Outlined.PhotoLibrary,
                    contentDescription = null,
                    modifier = Modifier.size(28.dp)
                )
            },
            title = "相册",
            onClick = { onFeatureClick("相册") }
        )

        // 文件
        QuickFeatureItem(
            icon = {
                Icon(
                    imageVector = Icons.Outlined.InsertDriveFile,
                    contentDescription = null,
                    modifier = Modifier.size(28.dp)
                )
            },
            title = "文件",
            onClick = { onFeatureClick("文件") }
        )
    }
}

/**
 * 单个快捷功能项
 */
@Composable
private fun QuickFeatureItem(
    icon: @Composable () -> Unit,
    title: String,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFFF5F5F5)),
            contentAlignment = Alignment.Center
        ) {
            icon()
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = title,
            fontSize = 12.sp,
            color = Color(0xFF333333)
        )
    }
}

/**
 * 功能列表
 */
@Composable
private fun FeatureList(onFeatureClick: (String) -> Unit) {
    val features = listOf(
        FeatureItem(
            icon = {
                Icon(
                    imageVector = Icons.Outlined.Palette,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = Color(0xFFFF6B6B)
                )
            },
            title = "AI生图",
            subtitle = "一句话生成优质画作，多样玩法灵感不断",
            iconTint = Color(0xFFFF6B6B)
        ),
        FeatureItem(
            icon = {
                Icon(
                    imageVector = Icons.Outlined.Mic,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = Color(0xFF4ECDC4)
                )
            },
            title = "AI录音笔",
            subtitle = "实时转写与总结，学习开会更高效",
            iconTint = Color(0xFF4ECDC4)
        ),
        FeatureItem(
            icon = {
                Icon(
                    imageVector = Icons.Outlined.AutoFixHigh,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = Color(0xFFFFA726)
                )
            },
            title = "智能P图",
            subtitle = "智能修图多种模版，轻松打造创意大片",
            iconTint = Color(0xFFFFA726)
        ),
        FeatureItem(
            icon = {
                Icon(
                    imageVector = Icons.Outlined.Quiz,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = Color(0xFF66BB6A)
                )
            },
            title = "拍题答疑",
            subtitle = "全学科解题大师，AI互动讲解难题",
            iconTint = Color(0xFF66BB6A)
        ),
        FeatureItem(
            icon = {
                Icon(
                    imageVector = Icons.Outlined.Edit,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = Color(0xFF42A5F5)
                )
            },
            title = "AI写作",
            subtitle = "作文周报朋友圈文案，全体裁写作帮手",
            iconTint = Color(0xFF42A5F5)
        ),
        FeatureItem(
            icon = {
                Icon(
                    imageVector = Icons.Outlined.Face,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = Color(0xFFAB47BC)
                )
            },
            title = "王者英雄COS照",
            subtitle = "化身王者英雄，解锁专属COS照",
            iconTint = Color(0xFFAB47BC)
        ),
        FeatureItem(
            icon = {
                Icon(
                    imageVector = Icons.Outlined.Phone,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = Color(0xFFEF5350)
                )
            },
            title = "打电话",
            subtitle = "沉浸式语音对话，元宝实时陪伴",
            iconTint = Color(0xFFEF5350)
        ),
        FeatureItem(
            icon = {
                Icon(
                    imageVector = Icons.Outlined.VideoLibrary,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = Color(0xFF26C6DA)
                )
            },
            title = "AI生视频",
            subtitle = "一键生成视频，玩转百变风格",
            iconTint = Color(0xFF26C6DA)
        ),
        FeatureItem(
            icon = {
                Icon(
                    imageVector = Icons.Outlined.MenuBook,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = Color(0xFF5C6BC0)
                )
            },
            title = "文档阅读",
            subtitle = "提炼重点内容，长文速读一目了然",
            iconTint = Color(0xFF5C6BC0)
        )
    )

    LazyColumn(
        modifier = Modifier.fillMaxWidth()
    ) {
        items(features) { feature ->
            FeatureListItem(feature = feature, onClick = { onFeatureClick(feature.title) })
        }
    }
}

/**
 * 单个功能列表项
 */
@Composable
private fun FeatureListItem(feature: FeatureItem, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 图标
        Box(
            modifier = Modifier.size(40.dp),
            contentAlignment = Alignment.Center
        ) {
            feature.icon()
        }

        Spacer(modifier = Modifier.width(12.dp))

        // 文字内容
        Column {
            Text(
                text = feature.title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = Color(0xFF1A1A1A)
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = feature.subtitle,
                fontSize = 12.sp,
                color = Color(0xFF999999)
            )
        }
    }
}

/**
 * 录音遮罩层 - 大面积遮罩，参考竞品设计
 * 顶部有渐变，遮挡部分对话内容和整个底部导航
 */

@Composable
private fun RecordingOverlay(
    isCanceling: Boolean,
    offsetY: Dp, // 🔧 Y轴偏移量
    bottomPadding: Dp, // 🔧 固定的底部间距
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFFF8F8F8).copy(alpha = 0.8f),  // 顶部半透明
                        Color(0xFFF8F8F8)  // 底部完全不透明
                    ),
                    startY = 0f,
                    endY = 200f
                )
            )
    ) {
        // 🎨 内容区域（波纹 + 文案 + 按钮）
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(modifier = Modifier.weight(0.3f))
            
            // 🎵 音频波纹动画
            AudioWaveform(
                isActive = true,
                isCanceling = isCanceling,
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .height(48.dp)
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // 📝 提示文字
            Text(
                text = "松开发送", // 🆕 移除取消功能
                fontSize = 14.sp,
                fontWeight = FontWeight.Normal,
                color = Color(0xFF666666)
            )
            
            Spacer(modifier = Modifier.weight(0.4f))
            
            // 🔘 大按钮（与输入框完全一致的位置和大小）
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .offset(y = offsetY) // 🔧 使用统一的Y轴偏移
                    .padding(bottom = bottomPadding) // 🔧 固定的底部间距
                    .padding(bottom = 12.dp) // 🔧 额外的间距
                    .height(56.dp)
                    .clip(RoundedCornerShape(28.dp))
                    .background(
                        if (isCanceling) Color(0xFFE53935) else Color(0xFF1A1A1A) // 🔧 绿色改为黑色
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "松开发送", // 🆕 移除取消功能
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White
                )
            }
        }
    }
}
/**
 * 聊天历史抽屉
 */
@Composable
fun ChatHistoryDrawer(
    viewModel: ChatViewModel,
    onSessionClick: (String) -> Unit,
    onNewChatClick: () -> Unit,
    onMemoryManagementClick: () -> Unit = {},
    onScheduledTasksClick: () -> Unit = {},
    onPermissionCenterClick: () -> Unit = {},
    onSkillsClick: () -> Unit = {},
    onIMSettingsClick: () -> Unit = {},
    onBrowserDebugClick: () -> Unit = {},
    onIotControlClick: () -> Unit = {}
) {
    val sessions by viewModel.sessions.collectAsState()
    val currentSessionId by viewModel.currentSessionId.collectAsState()
    var searchText by remember { mutableStateOf("") }
    val entryBackground = Color(0xFFF8FAFC)
    val pageBackground = Color(0xFFF6F7FB)
    val filteredSessions = if (searchText.isEmpty()) {
        sessions
    } else {
        sessions.filter { it.title.contains(searchText, ignoreCase = true) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(pageBackground)
    ) {
        Spacer(modifier = Modifier.height(WindowInsets.statusBars.asPaddingValues().calculateTopPadding()))
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.elevatedCardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(24.dp)
                ) {
                    Column(modifier = Modifier.padding(vertical = 6.dp)) {
                        DrawerListRow("记忆管理", Icons.Outlined.Psychology, Color(0xFFFF7A00), onMemoryManagementClick)
                        DrawerListRow("定时任务", Icons.Outlined.Schedule, Color(0xFF2563EB), onScheduledTasksClick)
                        DrawerListRow("权限中心", Icons.Outlined.Security, Color(0xFF2563EB), onPermissionCenterClick)
                        DrawerListRow("技能商店", Icons.Outlined.AutoAwesome, Color(0xFF7C3AED), onSkillsClick)
                        DrawerListRow("关联机器人", Icons.Outlined.Forum, Color(0xFF0F9D8A), onIMSettingsClick)
                        DrawerListRow("浏览器", Icons.Outlined.Language, Color(0xFF2563EB), onBrowserDebugClick)
                        DrawerListRow("智能家居", Icons.Outlined.Home, Color(0xFF10B981), onIotControlClick)
                    }
                }
            }

            item {
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.elevatedCardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(24.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                                .clip(RoundedCornerShape(18.dp))
                                .background(entryBackground)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(horizontal = 16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Search,
                                    contentDescription = "搜索会话",
                                    tint = Color(0xFF98A2B3),
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                BasicTextField(
                                    value = searchText,
                                    onValueChange = { searchText = it },
                                    modifier = Modifier.weight(1f),
                                    textStyle = LocalTextStyle.current.copy(
                                        fontSize = 15.sp,
                                        color = Color(0xFF1D2939)
                                    ),
                                    singleLine = true,
                                    decorationBox = { innerTextField ->
                                        if (searchText.isEmpty()) {
                                            Text(
                                                text = "搜索会话",
                                                color = Color(0xFF98A2B3),
                                                fontSize = 15.sp
                                            )
                                        }
                                        innerTextField()
                                    }
                                )
                            }
                        }
                    }
                }
            }

            item {
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.elevatedCardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(24.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "聊天记录",
                                modifier = Modifier.weight(1f),
                                fontSize = 17.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF101828)
                            )
                            Text(
                                text = "${filteredSessions.size} 条",
                                fontSize = 12.sp,
                                color = Color(0xFF667085)
                            )
                        }
                        if (filteredSessions.isEmpty()) {
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(20.dp),
                                color = entryBackground
                            ) {
                                Text(
                                    text = if (searchText.isBlank()) "还没有历史会话，开始一段新对话吧。" else "没有匹配的会话。",
                                    modifier = Modifier.padding(16.dp),
                                    fontSize = 13.sp,
                                    color = Color(0xFF667085)
                                )
                            }
                        } else {
                            filteredSessions.forEach { session ->
                                SessionItem(
                                    session = session,
                                    isSelected = session.id == currentSessionId,
                                    onClick = { onSessionClick(session.id) },
                                    onDelete = { viewModel.deleteSession(session.id) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DrawerBadge(
    label: String,
    color: Color
) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = color.copy(alpha = 0.2f)
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
            color = Color.White,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun DrawerActionTile(
    title: String,
    icon: ImageVector,
    tint: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(20.dp),
        color = Color(0xFFF8FAFC)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Surface(
                modifier = Modifier.size(38.dp),
                shape = RoundedCornerShape(14.dp),
                color = tint.copy(alpha = 0.14f)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = tint,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
            Text(
                text = title,
                fontSize = 14.sp,
                lineHeight = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF101828)
            )
        }
    }
}

@Composable
private fun DrawerListRow(
    title: String,
    icon: ImageVector,
    tint: Color,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            modifier = Modifier.size(32.dp),
            shape = RoundedCornerShape(10.dp),
            color = tint.copy(alpha = 0.12f)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = tint,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = title,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            color = Color(0xFF101828)
        )
    }
}

/**
 * 会话列表项
 */
@Composable
private fun SessionItem(
    session: ChatSession,
    isSelected: Boolean,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    var showDeleteDialog by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = if (isSelected) Color(0xFFEEF4FF) else Color(0xFFF8FAFC)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = session.title,
                    fontSize = 15.sp,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                    color = Color(0xFF101828),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (isSelected) {
                        Surface(
                            shape = RoundedCornerShape(999.dp),
                            color = Color(0xFF2563EB).copy(alpha = 0.12f)
                        ) {
                            Text(
                                text = "当前",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color(0xFF2563EB)
                            )
                        }
                    }
                    Text(
                        text = SimpleDateFormat("MM/dd HH:mm", Locale.getDefault()).format(Date(session.updatedAt)),
                        fontSize = 12.sp,
                        color = Color(0xFF667085)
                    )
                }
            }

            IconButton(
                onClick = { showDeleteDialog = true },
                modifier = Modifier.size(34.dp)
            ) {
                Icon(
                    imageVector = Icons.Outlined.DeleteOutline,
                    contentDescription = "删除",
                    tint = Color(0xFF98A2B3),
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }

    // 删除确认对话框
    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("删除聊天") },
            text = { Text("确定要删除这个聊天吗？") },
            confirmButton = {
                TextButton(onClick = {
                    onDelete()
                    showDeleteDialog = false
                }) {
                    Text("删除", color = Color(0xFFE53935))
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("取消")
                }
            }
        )
    }
}

/**
 * 打字机光标组件
 * 生成中：高频闪烁（500ms间隔）
 * 生成结束：停留500ms后消失
 */
@Composable
private fun TypewriterCursor(
    modifier: Modifier = Modifier,
    isGenerating: Boolean = true
) {
    // 光标闪烁动画（生成中）
    val alpha by rememberInfiniteTransition(label = "cursor_blink").animateFloat(
        initialValue = 1f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(
            animation = tween(500, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "cursor_alpha"
    )
    
    // 生成结束后的延迟消失动画
    var showCursor by remember { mutableStateOf(true) }
    
    LaunchedEffect(isGenerating) {
        if (!isGenerating) {
            kotlinx.coroutines.delay(500) // 停留500ms
            showCursor = false
        }
    }
    
    if (showCursor) {
        Box(
            modifier = modifier
                .padding(start = 4.dp)
                .width(2.dp)
                .height(18.dp)
                .background(
                    color = Color(0xFF1A1A1A).copy(alpha = if (isGenerating) alpha else 1f),
                    shape = RoundedCornerShape(1.dp)
                )
        )
    }
}

/**
 * 🆕 滚动到底部按钮（白色毛玻璃风格）
 * 当用户向上滚动查看历史消息时，显示此按钮
 * 点击后平滑滚动到底部
 */
@Composable
private fun ScrollToBottomButton(
    onClick: () -> Unit,
    isGenerating: Boolean,
    modifier: Modifier = Modifier
) {
    val haptic = LocalHapticFeedback.current

    // Rotation animation
    val transition = rememberInfiniteTransition(label = "loading")
    val rotation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "rotation"
    )

    Box(
        modifier = modifier
            .shadow(
                elevation = 12.dp, // Prominent shadow
                shape = CircleShape,
                ambientColor = Color.Black.copy(alpha = 0.4f),
                spotColor = Color.Black.copy(alpha = 0.5f)
            )
            .size(44.dp)
            .background(Color.White, CircleShape)
            .clickable {
                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                onClick()
            },
        contentAlignment = Alignment.Center
    ) {
        // Loading Border
        if (isGenerating) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val strokeWidth = 3.dp.toPx()
                rotate(degrees = rotation) {
                    drawArc(
                        color = Color.Black,
                        startAngle = 0f,
                        sweepAngle = 60f, // 1/6 circle
                        useCenter = false,
                        style = Stroke(width = strokeWidth, cap = StrokeCap.Round),
                        topLeft = Offset(strokeWidth / 2, strokeWidth / 2),
                        size = Size(size.width - strokeWidth, size.height - strokeWidth)
                    )
                }
            }
        }

        Icon(
            imageVector = Icons.Default.KeyboardArrowDown,
            contentDescription = "Scroll to bottom",
            tint = Color.Black, // Black arrow
            modifier = Modifier.size(28.dp)
        )
    }
}

/**
 * 🆕 调试日志查看Dialog
 * 显示当前请求的完整日志信息，用于排查问题
 * 触发方式：快速点击AI回复卡片4次
 */
@Composable
private fun DebugLogDialog(
    requestLog: com.xiaoxiami.app.viewmodel.RequestLog?,
    onDismiss: () -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = true,
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.6f))
                .clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() }
                ) { onDismiss() }
                .systemBarsPadding()
        ) {
            // 日志内容卡片
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(0.9f)
                    .align(Alignment.Center)
                    .padding(16.dp)
                    .shadow(24.dp, RoundedCornerShape(16.dp))
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFF1A1A1A))
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) { /* 阻止点击穿透 */ }
            ) {
                // 标题栏
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF2A2A2A))
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = null,
                            tint = Color(0xFF4FC3F7),
                            modifier = Modifier.size(24.dp)
                        )
                        Text(
                            text = "请求调试日志",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                    
                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "关闭",
                            tint = Color.White
                        )
                    }
                }
                
                // 日志内容（可滚动）
                val scrollState = rememberScrollState()
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(scrollState)
                        .padding(16.dp)
                ) {
                    if (requestLog != null) {
                        // 基本信息
                        DebugLogSection(
                            title = "📋 基本信息",
                            items = listOf(
                                "请求ID" to requestLog.requestId,
                                "会话ID" to requestLog.sessionId,
                                "时间" to java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", java.util.Locale.getDefault())
                                    .format(java.util.Date(requestLog.timestamp)),
                                "状态" to if (requestLog.isSuccess) "✅ 成功" else "❌ 失败",
                                "首包耗时" to "${requestLog.firstChunkTime}ms",
                                "总耗时" to "${requestLog.responseTime}ms"
                            )
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // 模型信息
                        DebugLogSection(
                            title = "🤖 模型信息",
                            items = listOf(
                                "模型ID" to requestLog.modelId,
                                "模型名称" to requestLog.modelName,
                                "是否带图" to if (requestLog.hasImages) "是 (${requestLog.imageCount}张)" else "否",
                                "联网搜索" to if (requestLog.enableSearch) "✅ 开启" else "❌ 关闭",  // 🆕
                                "深度思考" to if (requestLog.enableThinking) "✅ 开启" else "❌ 关闭"  // 🆕
                            )
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // 🆕 各链路耗时统计
                        if (requestLog.timeUserSent > 0) {
                            val totalE2E = if (requestLog.timeApiFirstChunk > 0) requestLog.timeApiFirstChunk - requestLog.timeUserSent else 0
                            val preProcess = requestLog.timeContextBuildStart - requestLog.timeUserSent
                            val ragTime = requestLog.timeContextBuildEnd - requestLog.timeContextBuildStart
                            val apiWait = if (requestLog.timeApiFirstChunk > 0) requestLog.timeApiFirstChunk - requestLog.timeApiCallStart else 0
                            
                            DebugLogSection(
                                title = "⚡ 各链路耗时统计",
                                items = listOf(
                                    "✨ 整体端到端 (首字)" to "${totalE2E}ms",
                                    "阶段 1: 预处理/等待" to "${preProcess}ms",
                                    "阶段 2: RAG与上下文构建" to "${ragTime}ms",
                                    "阶段 3: API网络首包 (TTFT)" to "${apiWait}ms",
                                    "---" to "---",
                                    "API总交互耗时" to "${requestLog.responseTime}ms"
                                )
                            )
                            
                            Spacer(modifier = Modifier.height(16.dp))
                        }
                        
                        // 用户输入
                        DebugLogSection(
                            title = "👤 用户输入",
                            content = requestLog.userInput.ifBlank { "(空)" }
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // 🆕 记忆检索详情
                        DebugLogSection(
                            title = "🔍 记忆检索详情",
                            items = listOf(
                                "关键词提取" to if (requestLog.memoryKeywords.isNotEmpty()) requestLog.memoryKeywords.joinToString(", ") else "未提取到关键词",
                                "向量检索" to when {
                                    requestLog.vectorSuccess -> "✅ 成功 (命中 ${requestLog.matchedCount} 条)"
                                    requestLog.vectorError.isNotBlank() -> "❌ 失败 (${requestLog.vectorError})"
                                    else -> "⏸️ 已跳过 (使用关键词匹配)"
                                },
                                "注入模式" to if (requestLog.isFullInjection) "⚠️ 全量注入 (RAG未命中回退)" else "✅ 精准注入 (RAG分析命中)",
                                "匹配总数" to "${requestLog.matchedCount} 条"
                            )
                        )

                        if (requestLog.vectorResults.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(8.dp))
                            DebugLogSection(
                                title = "  📌 检索出的记忆片段",
                                content = requestLog.vectorResults.joinToString("\n\n") { "• $it" }
                            )
                        }
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // 上下文注入
                        DebugLogSection(
                            title = "🧠 最终注入上下文 ${if (requestLog.memoryUpdated) "(已更新记忆)" else ""}",
                            content = requestLog.memoryContext.ifBlank { "(无记忆注入)" }
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // 时间位置
                        DebugLogSection(
                            title = "📍 时间/位置注入",
                            items = listOf(
                                "当前时间" to requestLog.currentTime,
                                "当前位置" to requestLog.currentLocation.ifBlank { "(未获取)" }
                            )
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // 对话历史
                        DebugLogSection(
                            title = "💬 对话历史 (最近6条)",
                            content = requestLog.conversationHistory.ifBlank { "(无历史)" }
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // 完整System Prompt
                        DebugLogSection(
                            title = "📝 完整 System Prompt",
                            content = requestLog.systemPrompt
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // 模型回复
                        DebugLogSection(
                            title = "💡 模型回复",
                            content = requestLog.modelResponse.ifBlank { "(无回复)" }
                        )
                        
                        // 错误信息（如果有）
                        if (requestLog.errorMessage.isNotBlank()) {
                            Spacer(modifier = Modifier.height(16.dp))
                            DebugLogSection(
                                title = "❌ 错误信息",
                                content = requestLog.errorMessage,
                                isError = true
                            )
                        }
                    } else {
                        // 无日志数据
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = Color(0xFFFFB74D),
                                    modifier = Modifier.size(48.dp)
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Text(
                                    text = "未找到该请求的日志",
                                    fontSize = 16.sp,
                                    color = Color(0xFFAAAAAA)
                                )
                                Text(
                                    text = "可能是旧消息或应用重启后的消息",
                                    fontSize = 14.sp,
                                    color = Color(0xFF888888)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * 🆕 调试日志分段组件
 */
@Composable
private fun DebugLogSection(
    title: String,
    items: List<Pair<String, String>>? = null,
    content: String? = null,
    isError: Boolean = false
) {
    Column {
        // 标题
        Text(
            text = title,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = if (isError) Color(0xFFEF5350) else Color(0xFF4FC3F7),
            modifier = Modifier.padding(bottom = 8.dp)
        )
        
        // 内容区域
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFF2A2A2A))
                .padding(12.dp)
        ) {
            if (items != null) {
                // 键值对显示
                Column(
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    items.forEach { (key, value) ->
                        Row {
                            Text(
                                text = "$key: ",
                                fontSize = 13.sp,
                                color = Color(0xFF888888)
                            )
                            Text(
                                text = value,
                                fontSize = 13.sp,
                                color = Color.White,
                                modifier = Modifier.weight(1f, fill = false)
                            )
                        }
                    }
                }
            } else if (content != null) {
                // 长文本显示
                SelectionContainer {
                    Text(
                        text = content,
                        fontSize = 12.sp,
                        color = if (isError) Color(0xFFEF9A9A) else Color(0xFFE0E0E0),
                        lineHeight = 18.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
}

/**
 * 🆕 引用源列表组件 - 简化版水平标签布局
 * 只显示来源序号，点击展开详情或打开链接
 */
@Composable
private fun SourceReferences(
    groundingMetadata: com.xiaoxiami.app.service.GroundingMetadata,
    context: android.content.Context
) {
    val chunks = groundingMetadata.groundingChunks
    if (chunks.isEmpty()) return
    
    // 🆕 简化为单行水平布局
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        // 简化标题
        Text(
            text = "来源",
            fontSize = 11.sp,
            color = Color(0xFF999999)
        )
        
        // 🆕 水平滚动的来源标签
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.weight(1f)
        ) {
            itemsIndexed(chunks) { index, chunk ->
                chunk.web?.let { webSource ->
                    if (webSource.uri.isNotBlank()) {
                        SourceReferenceChip(
                            index = index + 1,
                            title = webSource.title.ifBlank { 
                                // 从 URL 提取域名作为标题
                                try {
                                    android.net.Uri.parse(webSource.uri).host?.removePrefix("www.") ?: "来源"
                                } catch (e: Exception) { "来源" }
                            },
                            onClick = {
                                try {
                                    val intent = android.content.Intent(
                                        android.content.Intent.ACTION_VIEW,
                                        android.net.Uri.parse(webSource.uri)
                                    )
                                    context.startActivity(intent)
                                } catch (e: Exception) {
                                    android.widget.Toast.makeText(
                                        context,
                                        "无法打开链接",
                                        android.widget.Toast.LENGTH_SHORT
                                    ).show()
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

/**
 * 🆕 简化版引用源标签 - 紧凑的圆角标签
 */
@Composable
private fun SourceReferenceChip(
    index: Int,
    title: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFFF0F0F0))
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        // 序号角标
        Text(
            text = index.toCircledNumber(),
            fontSize = 12.sp,
            color = Color(0xFF666666),
            fontWeight = FontWeight.Bold
        )
        
        // 简化标题（截取前10个字符）
        Text(
            text = title.take(12).let { if (title.length > 12) "$it..." else it },
            fontSize = 11.sp,
            color = Color(0xFF666666),
            maxLines = 1
        )
    }
}

/**
 * 🆕 转换数字为带圈字符 (①-⑳)
 */
private fun Int.toCircledNumber(): String {
    return when (this) {
        1 -> "①"
        2 -> "②"
        3 -> "③"
        4 -> "④"
        5 -> "⑤"
        6 -> "⑥"
        7 -> "⑦"
        8 -> "⑧"
        9 -> "⑨"
        10 -> "⑩"
        11 -> "⑪"
        12 -> "⑫"
        13 -> "⑬"
        14 -> "⑭"
        15 -> "⑮"
        16 -> "⑯"
        17 -> "⑰"
        18 -> "⑱"
        19 -> "⑲"
        20 -> "⑳"
        else -> "[$this]"
    }
}

/**
 * 🆕 格式化文本中的引用标记 [1] -> ①
 */
private fun String.formatCitations(): String {
    var result = this
    // 按照从大到小的顺序替换，避免 [10] 被先替换成 ①0
    for (i in 20 downTo 1) {
        result = result.replace("[$i]", i.toCircledNumber())
    }
    return result
}
