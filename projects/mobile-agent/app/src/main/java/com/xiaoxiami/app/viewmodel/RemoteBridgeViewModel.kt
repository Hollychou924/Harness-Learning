package com.xiaoxiami.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.xiaoxiami.app.MyApplication
import com.xiaoxiami.app.remote.RemoteBridgeConfig
import com.xiaoxiami.app.remote.RemoteBridgeConnectionState
import com.xiaoxiami.app.repository.RemoteAndroidBridgeRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class RemoteBridgeViewModel(
    application: Application
) : AndroidViewModel(application) {
    private val app = application as MyApplication

    val bridgeConfig = app.remoteBridgeConfigStore.state
    val connectionState = app.remoteBridgeManager.state

    private val _devices = MutableStateFlow<List<RemoteAndroidBridgeRepository.DeviceSnapshot>>(emptyList())
    val devices: StateFlow<List<RemoteAndroidBridgeRepository.DeviceSnapshot>> = _devices.asStateFlow()

    private val _draftBridgeUrl = MutableStateFlow(bridgeConfig.value.bridgeUrl)
    val draftBridgeUrl: StateFlow<String> = _draftBridgeUrl.asStateFlow()

    private val _draftPairingCode = MutableStateFlow(
        bridgeConfig.value.pairingCode.ifBlank { app.remoteBridgeConfigStore.generatePairingCode() }
    )
    val draftPairingCode: StateFlow<String> = _draftPairingCode.asStateFlow()

    private val _draftDisplayName = MutableStateFlow(bridgeConfig.value.localDisplayName)
    val draftDisplayName: StateFlow<String> = _draftDisplayName.asStateFlow()

    init {
        refreshDevices()
    }

    fun updateBridgeUrl(value: String) {
        _draftBridgeUrl.value = value
    }

    fun updatePairingCode(value: String) {
        _draftPairingCode.value = value.uppercase()
    }

    fun updateDisplayName(value: String) {
        _draftDisplayName.value = value
    }

    fun generatePairingCode() {
        _draftPairingCode.value = app.remoteBridgeConfigStore.generatePairingCode()
    }

    fun connect() {
        app.remoteBridgeManager.pairAndConnect(
            bridgeUrl = _draftBridgeUrl.value,
            pairingCode = _draftPairingCode.value,
            localDisplayName = _draftDisplayName.value
        )
        refreshDevices()
    }

    fun disconnect(clearPairing: Boolean = false) {
        app.remoteBridgeManager.disconnect(clearPairing)
    }

    fun refreshDevices() {
        viewModelScope.launch {
            _devices.value = app.remoteBridgeRepository.listDevices()
        }
    }
}
