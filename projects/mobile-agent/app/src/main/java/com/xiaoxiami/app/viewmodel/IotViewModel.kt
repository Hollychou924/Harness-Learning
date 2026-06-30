package com.xiaoxiami.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.xiaoxiami.app.MyApplication
import com.xiaoxiami.app.data.iot.IotDeviceEntity
import com.xiaoxiami.app.repository.IotLoginState
import com.xiaoxiami.app.service.*
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class IotViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = (application as MyApplication).iotRepository

    val loginState: StateFlow<IotLoginState> = repository.loginState
    val devices: StateFlow<List<IotDeviceEntity>> = repository.devices

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _loginStep = MutableStateFlow<LoginStep>(LoginStep.InputCredentials)
    val loginStep: StateFlow<LoginStep> = _loginStep.asStateFlow()

    // QR login state
    private val _qrLoginUrl = MutableStateFlow<String?>(null)
    val qrLoginUrl: StateFlow<String?> = _qrLoginUrl.asStateFlow()

    // Device specs cache
    private val _deviceSpecs = MutableStateFlow<Map<String, MiotSpec>>(emptyMap())
    val deviceSpecs: StateFlow<Map<String, MiotSpec>> = _deviceSpecs.asStateFlow()

    // Device property values cache
    private val _deviceProperties = MutableStateFlow<Map<String, List<PropertyValue>>>(emptyMap())
    val deviceProperties: StateFlow<Map<String, List<PropertyValue>>> = _deviceProperties.asStateFlow()

    // Scenes
    private val _scenes = MutableStateFlow<List<XiaomiScene>>(emptyList())
    val scenes: StateFlow<List<XiaomiScene>> = _scenes.asStateFlow()

    init {
        viewModelScope.launch {
            repository.loadCachedDevices()
        }
    }

    fun login(username: String, password: String, country: String = "cn") {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            _loginStep.value = LoginStep.InputCredentials

            val result = repository.loginWithPassword(username, password, country)
            result.fold(
                onSuccess = {
                    _loginStep.value = LoginStep.Success
                    loadScenes()
                },
                onFailure = { error ->
                    when (error) {
                        is CaptchaRequiredException -> {
                            _loginStep.value = LoginStep.CaptchaRequired(error.captchaUrl)
                        }
                        is TwoFactorRequiredException -> {
                            _loginStep.value = LoginStep.TwoFactorRequired(error.notificationUrl)
                        }
                        else -> {
                            _errorMessage.value = error.message
                            _loginStep.value = LoginStep.Error(error.message ?: "登录失败")
                        }
                    }
                }
            )
            _isLoading.value = false
        }
    }

    private val _qrRefreshing = MutableStateFlow(false)
    val qrRefreshing: StateFlow<Boolean> = _qrRefreshing.asStateFlow()

    fun startQrLogin(country: String = "cn") {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            var retryCount = 0
            val maxRetries = 3

            while (retryCount <= maxRetries) {
                var shouldRetry = false

                repository.startQrLogin(country).collect { event ->
                    when (event) {
                        is QrLoginEvent.QrCodeReady -> {
                            _qrLoginUrl.value = event.loginUrl
                            _qrRefreshing.value = false
                        }
                        is QrLoginEvent.WaitingForScan -> { /* Keep showing QR */ }
                        is QrLoginEvent.Success -> {
                            repository.onQrLoginSuccess()
                            _qrLoginUrl.value = null
                            _qrRefreshing.value = false
                            _isLoading.value = false
                            retryCount = maxRetries + 1 // break outer loop
                            loadScenes()
                        }
                        is QrLoginEvent.Error -> {
                            _errorMessage.value = event.message
                            _qrLoginUrl.value = null
                            _qrRefreshing.value = false
                            _isLoading.value = false
                            retryCount = maxRetries + 1 // break outer loop
                        }
                        is QrLoginEvent.Timeout -> {
                            if (retryCount < maxRetries) {
                                _qrRefreshing.value = true
                                shouldRetry = true
                            } else {
                                _errorMessage.value = "扫码超时，请重试"
                                _qrLoginUrl.value = null
                                _qrRefreshing.value = false
                                _isLoading.value = false
                            }
                        }
                    }
                }

                if (shouldRetry) {
                    retryCount++
                } else {
                    break
                }
            }
        }
    }

    fun syncDevices() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                repository.syncDevices()
                loadScenes()
            } catch (e: Exception) {
                _errorMessage.value = "同步设备失败: ${e.message}"
            }
            _isLoading.value = false
        }
    }

    fun logout() {
        viewModelScope.launch {
            repository.logout()
            _deviceSpecs.value = emptyMap()
            _deviceProperties.value = emptyMap()
            _scenes.value = emptyList()
            _qrLoginUrl.value = null
            _loginStep.value = LoginStep.InputCredentials
        }
    }

    fun loadDeviceSpec(model: String) {
        if (_deviceSpecs.value.containsKey(model)) return
        viewModelScope.launch {
            val spec = repository.getDeviceSpec(model) ?: return@launch
            _deviceSpecs.value = _deviceSpecs.value + (model to spec)
        }
    }

    fun loadDeviceProperties(did: String, model: String) {
        viewModelScope.launch {
            val spec = _deviceSpecs.value[model] ?: repository.getDeviceSpec(model) ?: return@launch
            if (!_deviceSpecs.value.containsKey(model)) {
                _deviceSpecs.value = _deviceSpecs.value + (model to spec)
            }
            val readableProps = spec.properties.filter { "r" in it.rw }
            if (readableProps.isEmpty()) return@launch

            val pairs = readableProps.map { it.siid to it.piid }
            val values = repository.getDeviceProperties(did, pairs)
            _deviceProperties.value = _deviceProperties.value + (did to values)
        }
    }

    fun toggleFavorite(did: String) {
        viewModelScope.launch {
            repository.toggleFavorite(did)
        }
    }

    fun toggleDevice(did: String, on: Boolean) {
        viewModelScope.launch {
            val device = devices.value.find { it.did == did } ?: return@launch
            if (!device.isOnline) {
                _errorMessage.value = "设备离线，无法操作"
                return@launch
            }
            val spec = _deviceSpecs.value[device.model] ?: repository.getDeviceSpec(device.model) ?: return@launch

            // Find power/on property (commonly siid=2, piid=1 or name "on")
            val powerProp = repository.miotSpecService.findProperty(spec, "on")
                ?: spec.properties.find { it.name == "switch-status" || it.name == "power" }
                ?: spec.properties.find { it.siid == 2 && it.piid == 1 && it.type == "bool" }

            if (powerProp != null) {
                try {
                    val success = repository.setDeviceProperty(did, powerProp.siid, powerProp.piid, on)
                    if (success) {
                        loadDeviceProperties(did, device.model)
                    } else {
                        _errorMessage.value = "操作失败，请重试"
                    }
                } catch (e: Exception) {
                    Log.e("IotViewModel", "toggleDevice failed", e)
                    _errorMessage.value = "操作失败: ${e.message}"
                }
            }
        }
    }

    fun setProperty(did: String, siid: Int, piid: Int, value: Any) {
        viewModelScope.launch {
            val device = devices.value.find { it.did == did }
            if (device != null && !device.isOnline) {
                _errorMessage.value = "设备离线，无法操作"
                return@launch
            }
            try {
                val success = repository.setDeviceProperty(did, siid, piid, value)
                if (success) {
                    if (device != null) loadDeviceProperties(did, device.model)
                } else {
                    _errorMessage.value = "操作失败，请重试"
                }
            } catch (e: Exception) {
                Log.e("IotViewModel", "setProperty failed", e)
                _errorMessage.value = "操作失败: ${e.message}"
            }
        }
    }

    fun runAction(did: String, siid: Int, aiid: Int) {
        viewModelScope.launch {
            val device = devices.value.find { it.did == did }
            if (device != null && !device.isOnline) {
                _errorMessage.value = "设备离线，无法执行操作"
                return@launch
            }
            try {
                val success = repository.runAction(did, siid, aiid)
                if (!success) {
                    _errorMessage.value = "操作执行失败"
                }
            } catch (e: Exception) {
                Log.e("IotViewModel", "runAction failed", e)
                _errorMessage.value = "操作失败: ${e.message}"
            }
        }
    }

    private fun loadScenes() {
        viewModelScope.launch {
            try {
                _scenes.value = repository.getAllScenes()
            } catch (e: Exception) {
                // Scenes are optional, don't show error
            }
        }
    }

    fun runScene(sceneId: String, homeId: String) {
        viewModelScope.launch {
            repository.runScene(sceneId, homeId)
        }
    }

    fun clearError() {
        _errorMessage.value = null
    }
}
