package com.xiaoxiami.app.service

data class XiaomiCredentials(
    val userId: String,
    val serviceToken: String,
    val ssecurity: String,
    val cUserId: String = "",
    val passToken: String = "",
    val country: String = "cn",
    val userAgent: String = "",
    val deviceId: String = ""
)

data class XiaomiHome(
    val id: String,
    val name: String,
    val ownerId: Long,
    val roomList: List<XiaomiRoom> = emptyList()
)

data class XiaomiRoom(
    val id: String,
    val name: String
)

data class XiaomiDevice(
    val did: String,
    val name: String,
    val model: String,
    val mac: String = "",
    val localIp: String = "",
    val token: String = "",
    val homeId: String = "",
    val homeName: String = "",
    val roomId: String = "",
    val roomName: String = "",
    val isOnline: Boolean = false
)

data class PropertyValue(
    val did: String,
    val siid: Int,
    val piid: Int,
    val value: Any? = null,
    val code: Int = 0,
    val updateTime: Long = 0
)

data class MiotSpec(
    val name: String,
    val model: String,
    val properties: List<MiotProperty> = emptyList(),
    val actions: List<MiotAction> = emptyList()
)

data class MiotProperty(
    val name: String,
    val description: String = "",
    val type: String = "bool",
    val rw: String = "r",
    val unit: String? = null,
    val range: List<Number>? = null,
    val valueList: List<MiotValueItem>? = null,
    val siid: Int,
    val piid: Int
)

data class MiotAction(
    val name: String,
    val description: String = "",
    val siid: Int,
    val aiid: Int
)

data class MiotValueItem(
    val value: Int,
    val description: String
)

data class XiaomiScene(
    val sceneId: String,
    val name: String,
    val homeId: String
)

sealed class LoginStep {
    data object InputCredentials : LoginStep()
    data class CaptchaRequired(val captchaUrl: String, val captchaImage: ByteArray? = null) : LoginStep()
    data class TwoFactorRequired(val notificationUrl: String) : LoginStep()
    data object Success : LoginStep()
    data class Error(val message: String) : LoginStep()
}

sealed class QrLoginEvent {
    data class QrCodeReady(val loginUrl: String) : QrLoginEvent()
    data object WaitingForScan : QrLoginEvent()
    data object Success : QrLoginEvent()
    data class Error(val message: String) : QrLoginEvent()
    data object Timeout : QrLoginEvent()
}

class MiotApiException(
    val errorCode: Int,
    val errorMessage: String
) : Exception("MiotAPI 错误 [$errorCode]: $errorMessage") {
    val isTokenExpired: Boolean get() = errorCode == -3
    val isDeviceOffline: Boolean get() = errorCode == -6
    val isRateLimited: Boolean get() = errorCode == -8
    val isPermissionDenied: Boolean get() = errorCode == -9
}
