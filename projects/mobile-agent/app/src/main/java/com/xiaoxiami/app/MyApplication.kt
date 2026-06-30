package com.xiaoxiami.app
 

import android.app.Application
import com.xiaoxiami.app.agent.AndroidToolRegistry
import com.xiaoxiami.app.agent.OptionalToolPolicyStore
import com.xiaoxiami.app.agent.ToolPolicy
import com.xiaoxiami.app.agent.ToolExecutor
import com.xiaoxiami.app.agent.skills.BundledSkillSource
import com.xiaoxiami.app.agent.skills.LocalJsonSkillSource
import com.xiaoxiami.app.agent.skills.LocalMarkdownSkillSource
import com.xiaoxiami.app.agent.skills.SkillRegistry
import com.xiaoxiami.app.agent.runtime.AlpineBootstrapper
import com.xiaoxiami.app.agent.runtime.AlpineShellRuntime
import com.xiaoxiami.app.agent.runtime.NoopShellRuntime
import com.xiaoxiami.app.agent.runtime.ShellRuntime
import com.xiaoxiami.app.browser.BrowserRuntimeManager
import com.xiaoxiami.app.service.DoubaoEmbeddingService
import com.xiaoxiami.app.service.FaissVectorStoreService
import com.xiaoxiami.app.config.AIConfig
import com.xiaoxiami.app.repository.AgentAutomationRepository
import com.xiaoxiami.app.repository.GeminiRepository
import com.xiaoxiami.app.repository.MemoryRepository
import com.xiaoxiami.app.repository.RemoteAndroidBridgeRepository
import com.xiaoxiami.app.remote.RemoteAndroidBridgeManager
import com.xiaoxiami.app.remote.RemoteBridgeConfigStore
import com.xiaoxiami.app.im.IMGatewayManager
import com.xiaoxiami.app.im.IMAgentBridge
import com.xiaoxiami.app.im.gateways.*
import com.xiaoxiami.app.utils.NotificationHelper
import android.util.Log
import com.tencent.bugly.crashreport.CrashReport
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.io.File

class MyApplication : Application() {
    
    // 🆕 向量服务（用于记忆系统的语义检索）
    lateinit var vectorStoreService: FaissVectorStoreService
        private set
    // 🆕 使用字节 Embedding 服务（替代 Gemini）
    lateinit var embeddingService: DoubaoEmbeddingService
        private set
    lateinit var remoteBridgeConfigStore: RemoteBridgeConfigStore
        private set
    lateinit var remoteBridgeRepository: RemoteAndroidBridgeRepository
        private set
    lateinit var remoteBridgeManager: RemoteAndroidBridgeManager
        private set
    lateinit var skillRegistry: SkillRegistry
        private set
    lateinit var shellRuntime: ShellRuntime
        private set
    var alpineBootstrapper: AlpineBootstrapper? = null
        private set
    lateinit var browserRuntimeManager: BrowserRuntimeManager
        private set
    lateinit var optionalToolPolicyStore: OptionalToolPolicyStore
        private set
    lateinit var imGatewayManager: IMGatewayManager
        private set
    lateinit var imAgentBridge: IMAgentBridge
        private set
    lateinit var iotRepository: com.xiaoxiami.app.repository.IotRepository
        private set
        
    // 全局协程作用域（用于初始化后台任务）
    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate() {
        super.onCreate()
        // Bugly 初始化
        CrashReport.initCrashReport(applicationContext, "7419cb217f", BuildConfig.DEBUG)
        
        /*
        // Shiply 应用升级初始化
        val upgradeConfig = UpgradeConfig.Builder()
            .appId("44a0d6165e")
            .appKey("5214f42e-5722-45f4-b2fb-e7fc2005f96e")
            .build()
        UpgradeManager.getInstance().init(this, upgradeConfig)
        */
        
        // 🆕 初始化向量服务（记忆系统 RAG）
        setupVectorServices()
        optionalToolPolicyStore = OptionalToolPolicyStore(this)
        setupSkillRegistry()
        setupShellRuntime()
        setupBrowserRuntime()
        setupRemoteBridge()
        setupIMGateways()
        setupIotServices()
        NotificationHelper.createNotificationChannel(this)
        rescheduleAgentAutomations()
    }
    
    /**
     * 🆕 初始化向量检索服务
     * 
     * 使用 ObjectBox + 字节 Embedding 实现语义搜索
     */
    private fun setupVectorServices() {
        try {
            // 初始化 Faiss 风格向量存储 (基于 ObjectBox)
            vectorStoreService = FaissVectorStoreService(this)
            
            // 🆕 初始化字节 Embedding 服务（替代 Gemini）
            val apiKey = AIConfig.DOUBAO_EMBEDDING_API_KEY
            if (apiKey.isNotBlank()) {
                embeddingService = DoubaoEmbeddingService(apiKey)
                android.util.Log.d("MyApplication", "✅ 字节向量服务初始化成功")
                
                // 🆕 启动索引后台重构任务（静默升级）
                applicationScope.launch {
                    val repository = MemoryRepository(
                        context = this@MyApplication,
                        embeddingService = embeddingService,
                        vectorStore = vectorStoreService
                    )
                    repository.reindexMemoriesIfNeeded()
                }
            } else {
                android.util.Log.w("MyApplication", "⚠️ DOUBAO_EMBEDDING_API_KEY 未配置，向量服务将不可用")
                // 创建一个占位服务，避免 lateinit 报错
                embeddingService = DoubaoEmbeddingService("")
            }
        } catch (e: Exception) {
            android.util.Log.e("MyApplication", "❌ 向量服务初始化失败", e)
            // 创建占位服务，避免崩溃
            embeddingService = DoubaoEmbeddingService("")
        }
    }
    
    private fun setupIotServices() {
        try {
            val database = com.xiaoxiami.app.data.MemoryDatabase.getDatabase(this)
            val cloudService = com.xiaoxiami.app.service.XiaomiCloudService()
            val miotSpecService = com.xiaoxiami.app.service.MiotSpecService(this)
            iotRepository = com.xiaoxiami.app.repository.IotRepository(
                context = this,
                iotDao = database.iotDao(),
                cloudService = cloudService,
                miotSpecService = miotSpecService
            )
            Log.d("MyApplication", "IoT services initialized")
        } catch (e: Exception) {
            Log.e("MyApplication", "Failed to initialize IoT services", e)
            // Create with defaults to avoid crash
            val database = com.xiaoxiami.app.data.MemoryDatabase.getDatabase(this)
            iotRepository = com.xiaoxiami.app.repository.IotRepository(
                context = this,
                iotDao = database.iotDao(),
                cloudService = com.xiaoxiami.app.service.XiaomiCloudService(),
                miotSpecService = com.xiaoxiami.app.service.MiotSpecService(this)
            )
        }
    }

    private fun rescheduleAgentAutomations() {
        applicationScope.launch(Dispatchers.IO) {
            runCatching {
                val database = com.xiaoxiami.app.data.MemoryDatabase.getDatabase(this@MyApplication)
                AgentAutomationRepository(
                    context = this@MyApplication,
                    dao = database.agentAutomationDao()
                ).rescheduleAllEnabledSchedules()
                RemoteAndroidBridgeRepository(
                    dao = database.remoteBridgeDao()
                ).sweepTimedOutRequests()
            }.onFailure {
                android.util.Log.e("MyApplication", "❌ 自动任务重建失败", it)
            }
        }
    }

    private fun setupSkillRegistry() {
        val localSkillDir = File(filesDir, "skills").apply { mkdirs() }
        skillRegistry = SkillRegistry(
            sources = listOf(
                BundledSkillSource,
                LocalJsonSkillSource(localSkillDir),
                LocalMarkdownSkillSource(localSkillDir)
            )
        )
    }

    private fun setupShellRuntime() {
        val prefs = getSharedPreferences("app_settings", MODE_PRIVATE)
        val alpineEnabled = prefs.getBoolean("alpine_enabled", true)

        if (alpineEnabled) {
            val bootstrapper = AlpineBootstrapper(this, applicationScope)
            alpineBootstrapper = bootstrapper
            shellRuntime = AlpineShellRuntime(bootstrapper)

            // 异步引导，不阻塞 App 启动
            applicationScope.launch(Dispatchers.IO) {
                if (!bootstrapper.isBootstrapped()) {
                    bootstrapper.bootstrap()
                } else {
                    // 已引导完成，直接标记就绪
                    bootstrapper.launchBootstrap()
                }
            }
            Log.i("MyApplication", "Alpine Linux 环境已启用，正在后台初始化")
        } else {
            shellRuntime = NoopShellRuntime()
        }
    }

    private fun setupBrowserRuntime() {
        val database = com.xiaoxiami.app.data.MemoryDatabase.getDatabase(this)
        browserRuntimeManager = BrowserRuntimeManager(this, database.browserSessionDao())
        // Restore persisted browser sessions on startup
        applicationScope.launch(Dispatchers.IO) {
            runCatching { browserRuntimeManager.restoreSessions() }
                .onFailure { Log.e("MyApplication", "浏览器会话恢复失败", it) }
        }
    }

    private fun setupIMGateways() {
        imGatewayManager = IMGatewayManager(this)
        imAgentBridge = IMAgentBridge(this)

        // Register all 7 platform gateways
        imGatewayManager.registerGateway(TelegramGateway())
        imGatewayManager.registerGateway(FeishuGateway())
        imGatewayManager.registerGateway(DingtalkGateway())
        imGatewayManager.registerGateway(WecomGateway())
        imGatewayManager.registerGateway(DiscordGateway())
        imGatewayManager.registerGateway(QQGateway())
        imGatewayManager.registerGateway(WeixinGateway(this))

        // Wire message callback: IM messages → Agent processing → reply
        imGatewayManager.setMessageCallback(imAgentBridge.messageCallback)

        // Auto-start enabled gateways
        imGatewayManager.startAllEnabled()
    }

    private fun setupRemoteBridge() {
        val database = com.xiaoxiami.app.data.MemoryDatabase.getDatabase(this)
        remoteBridgeConfigStore = RemoteBridgeConfigStore(this)
        remoteBridgeRepository = RemoteAndroidBridgeRepository(
            dao = database.remoteBridgeDao()
        )
        remoteBridgeManager = RemoteAndroidBridgeManager(
            appContext = this,
            configStore = remoteBridgeConfigStore,
            repository = remoteBridgeRepository,
            toolExecutorFactory = {
                val memoryRepository = MemoryRepository(
                    context = this,
                    embeddingService = embeddingService,
                    vectorStore = vectorStoreService
                )
                val geminiRepository = GeminiRepository(this)
                ToolExecutor(
                    tools = AndroidToolRegistry.build(
                        context = this,
                        geminiRepository = geminiRepository,
                        memoryRepository = memoryRepository
                    ),
                    androidContext = this,
                    policy = ToolPolicy.remoteOperator()
                )
            }
        )
        remoteBridgeManager.connectIfConfigured()
    }
}
