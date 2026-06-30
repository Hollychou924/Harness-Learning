package com.xiaoxiami.app.repository

import android.content.Context
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.xiaoxiami.app.data.iot.IotDao
import com.xiaoxiami.app.data.iot.IotDeviceEntity
import com.xiaoxiami.app.service.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

sealed class IotLoginState {
    data object Unknown : IotLoginState()
    data object LoggedOut : IotLoginState()
    data class LoggedIn(val userId: String) : IotLoginState()
    data class Error(val message: String) : IotLoginState()
}

class IotRepository(
    private val context: Context,
    private val iotDao: IotDao,
    private val cloudService: XiaomiCloudService,
    val miotSpecService: MiotSpecService
) {
    companion object {
        private const val TAG = "IotRepository"
        private const val PREFS_NAME = "xiaomi_iot_credentials"
        private const val KEY_USER_ID = "userId"
        private const val KEY_SERVICE_TOKEN = "serviceToken"
        private const val KEY_SSECURITY = "ssecurity"
        private const val KEY_C_USER_ID = "cUserId"
        private const val KEY_PASS_TOKEN = "passToken"
        private const val KEY_COUNTRY = "country"
        private const val KEY_USER_AGENT = "userAgent"
        private const val KEY_DEVICE_ID = "deviceId"
    }

    private val _loginState = MutableStateFlow<IotLoginState>(IotLoginState.Unknown)
    val loginState: StateFlow<IotLoginState> = _loginState.asStateFlow()

    private val _devices = MutableStateFlow<List<IotDeviceEntity>>(emptyList())
    val devices: StateFlow<List<IotDeviceEntity>> = _devices.asStateFlow()

    private val encryptedPrefs by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context, PREFS_NAME, masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    init {
        // Check login state on init
        val creds = getCredentialsSync()
        if (creds != null) {
            _loginState.value = IotLoginState.LoggedIn(creds.userId)
        } else {
            _loginState.value = IotLoginState.LoggedOut
        }
    }

    // ==================== Auth ====================

    suspend fun loginWithPassword(username: String, password: String, country: String = "cn"): Result<Unit> {
        return withContext(Dispatchers.IO) {
            val result = cloudService.loginWithPassword(username, password, country)
            result.fold(
                onSuccess = { credentials ->
                    saveCredentials(credentials)
                    _loginState.value = IotLoginState.LoggedIn(credentials.userId)
                    // Auto-sync devices after login
                    syncDevices()
                    Result.success(Unit)
                },
                onFailure = { error ->
                    _loginState.value = IotLoginState.Error(error.message ?: "登录失败")
                    Result.failure(error)
                }
            )
        }
    }

    fun startQrLogin(country: String = "cn"): Flow<QrLoginEvent> {
        return cloudService.startQrLogin(country)
    }

    suspend fun onQrLoginSuccess() {
        val credentials = cloudService.getLastQrCredentials()
        if (credentials != null) {
            saveCredentials(credentials)
            _loginState.value = IotLoginState.LoggedIn(credentials.userId)
            syncDevices()
        }
    }

    suspend fun logout() {
        withContext(Dispatchers.IO) {
            encryptedPrefs.edit().clear().apply()
            iotDao.deleteAllDevices()
            _devices.value = emptyList()
            _loginState.value = IotLoginState.LoggedOut
        }
    }

    fun getCredentials(): XiaomiCredentials? = getCredentialsSync()

    private fun getCredentialsSync(): XiaomiCredentials? {
        val userId = encryptedPrefs.getString(KEY_USER_ID, null) ?: return null
        val serviceToken = encryptedPrefs.getString(KEY_SERVICE_TOKEN, null) ?: return null
        val ssecurity = encryptedPrefs.getString(KEY_SSECURITY, null) ?: return null
        return XiaomiCredentials(
            userId = userId,
            serviceToken = serviceToken,
            ssecurity = ssecurity,
            cUserId = encryptedPrefs.getString(KEY_C_USER_ID, "") ?: "",
            passToken = encryptedPrefs.getString(KEY_PASS_TOKEN, "") ?: "",
            country = encryptedPrefs.getString(KEY_COUNTRY, "cn") ?: "cn",
            userAgent = encryptedPrefs.getString(KEY_USER_AGENT, "") ?: "",
            deviceId = encryptedPrefs.getString(KEY_DEVICE_ID, "") ?: ""
        )
    }

    private fun saveCredentials(credentials: XiaomiCredentials) {
        encryptedPrefs.edit()
            .putString(KEY_USER_ID, credentials.userId)
            .putString(KEY_SERVICE_TOKEN, credentials.serviceToken)
            .putString(KEY_SSECURITY, credentials.ssecurity)
            .putString(KEY_C_USER_ID, credentials.cUserId)
            .putString(KEY_PASS_TOKEN, credentials.passToken)
            .putString(KEY_COUNTRY, credentials.country)
            .putString(KEY_USER_AGENT, credentials.userAgent)
            .putString(KEY_DEVICE_ID, credentials.deviceId)
            .apply()
    }

    // ==================== Token Auto-Refresh ====================

    private val refreshMutex = Mutex()

    /**
     * 执行 API 调用，当 token 过期时自动用 passToken 刷新并重试一次。
     * MiotApiException 除 token 过期外直接重抛。
     */
    private suspend fun <T> executeWithAutoRefresh(
        block: suspend (XiaomiCredentials) -> T
    ): T {
        val credentials = getCredentials() ?: throw IllegalStateException("未登录")
        return try {
            block(credentials)
        } catch (e: MiotApiException) {
            if (!e.isTokenExpired) throw e
            // Token 过期，尝试刷新（用 Mutex 防止并发刷新）
            val refreshed = refreshMutex.withLock {
                // 双重检查：可能其他协程已经刷新过了
                val current = getCredentials()
                if (current != null && current.serviceToken != credentials.serviceToken) {
                    current  // 已被其他协程刷新
                } else {
                    cloudService.refreshServiceToken(credentials)?.also { saveCredentials(it) }
                }
            }
            if (refreshed != null) {
                Log.d(TAG, "Token refreshed, retrying request")
                block(refreshed)
            } else {
                Log.w(TAG, "Token refresh failed, logging out")
                _loginState.value = IotLoginState.LoggedOut
                throw e
            }
        }
    }

    // ==================== Devices ====================

    suspend fun syncDevices() {
        withContext(Dispatchers.IO) {
            try {
                val devices = executeWithAutoRefresh { creds ->
                    cloudService.getAllDevices(creds)
                }
                // 保留收藏状态
                val favoriteDids = iotDao.getFavoriteDids().toSet()
                val entities = devices.map { d ->
                    IotDeviceEntity(
                        did = d.did, name = d.name, model = d.model,
                        mac = d.mac, localIp = d.localIp, token = d.token,
                        homeId = d.homeId, homeName = d.homeName,
                        roomId = d.roomId, roomName = d.roomName,
                        isOnline = d.isOnline,
                        isFavorite = d.did in favoriteDids,
                        lastSyncAt = System.currentTimeMillis()
                    )
                }
                iotDao.deleteAllDevices()
                iotDao.upsertDevices(entities)
                _devices.value = iotDao.getAllDevices()
                Log.d(TAG, "Synced ${entities.size} devices")

                // 后台预加载所有不同 model 的 MIOT Spec
                val uniqueModels = entities.map { it.model }.distinct()
                preloadSpecs(uniqueModels)
            } catch (e: MiotApiException) {
                Log.e(TAG, "Failed to sync devices: ${e.message}")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to sync devices", e)
            }
        }
    }

    suspend fun toggleFavorite(did: String) {
        withContext(Dispatchers.IO) {
            val device = iotDao.getDevice(did) ?: return@withContext
            iotDao.setFavorite(did, !device.isFavorite)
            _devices.value = iotDao.getAllDevices()
        }
    }

    suspend fun loadCachedDevices() {
        withContext(Dispatchers.IO) {
            _devices.value = iotDao.getAllDevices()
        }
    }

    suspend fun getDeviceSpec(model: String): MiotSpec? {
        return miotSpecService.getDeviceSpec(model)
    }

    private suspend fun preloadSpecs(models: List<String>) {
        supervisorScope {
            models.forEach { model ->
                launch {
                    try {
                        miotSpecService.getDeviceSpec(model)
                    } catch (e: Exception) {
                        Log.w(TAG, "Spec preload failed for $model", e)
                    }
                }
            }
        }
        Log.d(TAG, "Preloaded specs for ${models.size} models")
    }

    suspend fun getDeviceProperties(did: String, pairs: List<Pair<Int, Int>>): List<PropertyValue> {
        return try {
            executeWithAutoRefresh { creds ->
                val params = pairs.map { (siid, piid) ->
                    mapOf("did" to did as Any, "siid" to siid as Any, "piid" to piid as Any)
                }
                cloudService.getDeviceProperties(creds, params)
            }
        } catch (e: MiotApiException) {
            Log.w(TAG, "获取属性失败: ${e.message}")
            emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "获取属性失败", e)
            emptyList()
        }
    }

    suspend fun setDeviceProperty(did: String, siid: Int, piid: Int, value: Any): Boolean {
        return try {
            val results = executeWithAutoRefresh { creds ->
                val params = listOf(mapOf("did" to did as Any, "siid" to siid as Any, "piid" to piid as Any, "value" to value))
                cloudService.setDeviceProperty(creds, params)
            }
            results.isNotEmpty() && results[0].code in listOf(0, 1)
        } catch (e: MiotApiException) {
            Log.w(TAG, "设置属性失败: ${e.message}")
            false
        } catch (e: Exception) {
            Log.e(TAG, "设置属性失败", e)
            false
        }
    }

    suspend fun runAction(did: String, siid: Int, aiid: Int, value: List<Any>? = null): Boolean {
        return try {
            val code = executeWithAutoRefresh { creds ->
                val params = mutableMapOf<String, Any>("did" to did, "siid" to siid, "aiid" to aiid)
                if (value != null) params["value"] = value
                cloudService.runAction(creds, params)
            }
            code in listOf(0, 1)
        } catch (e: MiotApiException) {
            Log.w(TAG, "执行动作失败: ${e.message}")
            false
        } catch (e: Exception) {
            Log.e(TAG, "执行动作失败", e)
            false
        }
    }

    // ==================== Scenes ====================

    suspend fun getAllScenes(): List<XiaomiScene> {
        return try {
            executeWithAutoRefresh { creds ->
                val homes = cloudService.getHomes(creds)
                val allScenes = mutableListOf<XiaomiScene>()
                for (home in homes) {
                    allScenes.addAll(cloudService.getScenes(creds, home.id, home.ownerId))
                }
                allScenes
            }
        } catch (e: MiotApiException) {
            Log.w(TAG, "获取场景失败: ${e.message}")
            emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "获取场景失败", e)
            emptyList()
        }
    }

    suspend fun runScene(sceneId: String, homeId: String): Boolean {
        return try {
            executeWithAutoRefresh { creds ->
                val homes = cloudService.getHomes(creds)
                val home = homes.find { it.id == homeId }
                    ?: throw IllegalArgumentException("未找到家庭: $homeId")
                cloudService.runScene(creds, sceneId, homeId, home.ownerId)
            }
        } catch (e: MiotApiException) {
            Log.w(TAG, "执行场景失败: ${e.message}")
            false
        } catch (e: Exception) {
            Log.e(TAG, "执行场景失败", e)
            false
        }
    }
}
