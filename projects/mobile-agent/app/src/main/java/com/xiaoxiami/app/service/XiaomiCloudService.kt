package com.xiaoxiami.app.service

import android.util.Base64
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.FormBody
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.URLEncoder
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.TimeZone
import java.util.concurrent.TimeUnit
import java.util.zip.GZIPInputStream
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

class XiaomiCloudService {

    companion object {
        private const val TAG = "XiaomiCloudService"

        /**
         * 根据区域返回小米 IoT API 地址。
         * 中国区用 api.io.mi.com，其他区域用 {region}.api.io.mi.com。
         */
        fun getApiBaseUrl(country: String): String {
            return if (country == "cn") {
                "https://api.io.mi.com/app"
            } else {
                "https://$country.api.io.mi.com/app"
            }
        }
    }

    /** 限制并发 API 请求数量，防止触发小米限流 */
    private val requestSemaphore = Semaphore(5)
    private val cookieStore = mutableMapOf<String, MutableList<Cookie>>()
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .cookieJar(object : CookieJar {
            override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
                val host = url.host
                cookieStore.getOrPut(host) { mutableListOf() }.apply {
                    cookies.forEach { newCookie ->
                        removeAll { it.name == newCookie.name }
                        add(newCookie)
                    }
                }
            }
            override fun loadForRequest(url: HttpUrl): List<Cookie> {
                val result = mutableListOf<Cookie>()
                cookieStore.forEach { (_, cookies) ->
                    cookies.forEach { cookie ->
                        if (cookie.matches(url)) result.add(cookie)
                    }
                }
                return result
            }
        })
        .build()

    // ==================== RC4 Crypto (Pure Kotlin) ====================

    private fun rc4Crypt(key: ByteArray, data: ByteArray): ByteArray {
        val s = IntArray(256) { it }
        var j = 0
        for (i in 0..255) {
            j = (j + s[i] + (key[i % key.size].toInt() and 0xFF)) and 0xFF
            s[i] = s[j].also { s[j] = s[i] }
        }
        // Skip first 1024 bytes (as per Xiaomi protocol)
        var i2 = 0; var j2 = 0
        repeat(1024) {
            i2 = (i2 + 1) and 0xFF
            j2 = (j2 + s[i2]) and 0xFF
            s[i2] = s[j2].also { s[j2] = s[i2] }
        }
        val output = ByteArray(data.size)
        for (k in data.indices) {
            i2 = (i2 + 1) and 0xFF
            j2 = (j2 + s[i2]) and 0xFF
            s[i2] = s[j2].also { s[j2] = s[i2] }
            output[k] = (data[k].toInt() xor s[(s[i2] + s[j2]) and 0xFF]).toByte()
        }
        return output
    }

    private fun encryptRc4(signedNonce: String, payload: String): String {
        val key = Base64.decode(signedNonce, Base64.NO_WRAP)
        val encrypted = rc4Crypt(key, payload.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(encrypted, Base64.NO_WRAP)
    }

    private fun decryptRc4(signedNonce: String, payload: String): ByteArray {
        val key = Base64.decode(signedNonce, Base64.NO_WRAP)
        return rc4Crypt(key, Base64.decode(payload, Base64.NO_WRAP))
    }

    // ==================== Nonce & Signature ====================

    private fun genNonce(): String {
        val millis = System.currentTimeMillis()
        val random = ByteArray(8).also { SecureRandom().nextBytes(it) }
        val timePart = (millis / 60000).toInt()
        val buffer = ByteBuffer.allocate(12)
        buffer.put(random)
        buffer.putInt(timePart)
        return Base64.encodeToString(buffer.array(), Base64.NO_WRAP)
    }

    private fun getSignedNonce(ssecurity: String, nonce: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        md.update(Base64.decode(ssecurity, Base64.NO_WRAP))
        md.update(Base64.decode(nonce, Base64.NO_WRAP))
        return Base64.encodeToString(md.digest(), Base64.NO_WRAP)
    }

    private fun genEncSignature(uri: String, method: String, signedNonce: String, params: Map<String, String>): String {
        val parts = mutableListOf(method.uppercase(), uri)
        params.forEach { (k, v) -> parts.add("$k=$v") }
        parts.add(signedNonce)
        val signatureString = parts.joinToString("&")
        val md = MessageDigest.getInstance("SHA-1")
        return Base64.encodeToString(md.digest(signatureString.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
    }

    private fun generateEncParams(
        uri: String, method: String, signedNonce: String, nonce: String,
        params: MutableMap<String, String>, ssecurity: String
    ): Map<String, String> {
        params["rc4_hash__"] = genEncSignature(uri, method, signedNonce, params)
        params.keys.toList().forEach { k ->
            params[k] = encryptRc4(signedNonce, params[k]!!)
        }
        params["signature"] = genEncSignature(uri, method, signedNonce, params)
        params["ssecurity"] = ssecurity
        params["_nonce"] = nonce
        return params
    }

    private fun decryptResponse(ssecurity: String, nonce: String, responseText: String): String {
        val signedNonce = getSignedNonce(ssecurity, nonce)
        val decrypted = decryptRc4(signedNonce, responseText)
        return try {
            String(decrypted, Charsets.UTF_8)
        } catch (e: Exception) {
            // Try GZIP decompression
            try {
                val gis = GZIPInputStream(ByteArrayInputStream(decrypted))
                val bos = ByteArrayOutputStream()
                gis.copyTo(bos)
                String(bos.toByteArray(), Charsets.UTF_8)
            } catch (e2: Exception) {
                String(decrypted, Charsets.UTF_8)
            }
        }
    }

    // ==================== Helper ====================

    private fun generateUserAgent(): String {
        val chars = "0123456789ABCDEF"
        fun randHex(len: Int) = (1..len).map { chars.random() }.joinToString("")
        val id1 = randHex(40)
        val id2 = randHex(32)
        val id3 = randHex(32)
        val id4 = randHex(40)
        val passO = (1..16).map { "0123456789abcdef".random() }.joinToString("")
        return "Android-15-11.0.701-Xiaomi-23046RP50C-OS2.0.212.0.VMYCNXM-$id1-CN-$id3-$id2-SmartHome-MI_APP_STORE-$id1|$id4|$passO-64"
    }

    private fun generateDeviceId(): String {
        val chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-"
        return (1..16).map { chars.random() }.joinToString("")
    }

    private fun parseServiceResponse(text: String): JSONObject {
        return JSONObject(text.replace("&&&START&&&", ""))
    }

    private fun md5Hash(input: String): String {
        val md = MessageDigest.getInstance("MD5")
        val digest = md.digest(input.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02X".format(it) }
    }

    // ==================== Password Login ====================

    suspend fun loginWithPassword(
        username: String,
        password: String,
        country: String = "cn"
    ): Result<XiaomiCredentials> = withContext(Dispatchers.IO) {
        try {
            val userAgent = generateUserAgent()
            val deviceId = generateDeviceId()

            // Step 1: Get _sign
            val step1Url = "https://account.xiaomi.com/pass/serviceLogin?sid=xiaomiio&_json=true"
            val step1Request = Request.Builder()
                .url(step1Url)
                .header("User-Agent", userAgent)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Cookie", "sdkVersion=accountsdk-18.8.15; deviceId=$deviceId; userId=${URLEncoder.encode(username, "UTF-8")}")
                .get()
                .build()

            val step1Response = client.newCall(step1Request).execute()
            if (!step1Response.isSuccessful) {
                return@withContext Result.failure(Exception("登录失败: 无法连接小米服务器"))
            }
            val step1Json = parseServiceResponse(step1Response.body?.string() ?: "")

            val sign = step1Json.optString("_sign", "")
            if (sign.isEmpty() && !step1Json.has("ssecurity")) {
                return@withContext Result.failure(Exception("登录失败: 无效的用户名"))
            }

            // If already has ssecurity (session still valid)
            if (step1Json.has("ssecurity") && step1Json.optString("ssecurity").length > 4) {
                val location = step1Json.optString("location")
                val ssecurity = step1Json.optString("ssecurity")
                val userId = step1Json.optString("userId")
                val cUserId = step1Json.optString("cUserId")
                val passToken = step1Json.optString("passToken")

                // Step 3: Get serviceToken
                val step3Request = Request.Builder()
                    .url(location)
                    .header("User-Agent", userAgent)
                    .get()
                    .build()
                val step3Response = client.newCall(step3Request).execute()
                val serviceToken = extractServiceToken(step3Response)

                if (serviceToken != null) {
                    return@withContext Result.success(XiaomiCredentials(
                        userId = userId, serviceToken = serviceToken, ssecurity = ssecurity,
                        cUserId = cUserId, passToken = passToken, country = country,
                        userAgent = userAgent, deviceId = deviceId
                    ))
                }
            }

            // Step 2: Login with password
            val passwordHash = md5Hash(password)
            val step2Url = "https://account.xiaomi.com/pass/serviceLoginAuth2?" +
                    "sid=xiaomiio&hash=$passwordHash" +
                    "&callback=${URLEncoder.encode("https://sts.api.io.mi.com/sts", "UTF-8")}" +
                    "&qs=${URLEncoder.encode("%3Fsid%3Dxiaomiio%26_json%3Dtrue", "UTF-8")}" +
                    "&user=${URLEncoder.encode(username, "UTF-8")}" +
                    "&_sign=${URLEncoder.encode(sign, "UTF-8")}" +
                    "&_json=true"

            val step2Request = Request.Builder()
                .url(step2Url)
                .header("User-Agent", userAgent)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .post(FormBody.Builder().build())
                .build()

            val step2Response = client.newCall(step2Request).execute()
            if (!step2Response.isSuccessful) {
                return@withContext Result.failure(Exception("登录失败: 密码错误或账号不存在"))
            }

            val step2Json = parseServiceResponse(step2Response.body?.string() ?: "")

            // Check for captcha
            if (step2Json.has("captchaUrl") && !step2Json.isNull("captchaUrl")) {
                return@withContext Result.failure(CaptchaRequiredException(step2Json.optString("captchaUrl")))
            }

            // Check for 2FA
            if (step2Json.has("notificationUrl")) {
                return@withContext Result.failure(TwoFactorRequiredException(step2Json.optString("notificationUrl")))
            }

            val ssecurity = step2Json.optString("ssecurity", "")
            if (ssecurity.length <= 4) {
                return@withContext Result.failure(Exception("登录失败: 密码错误"))
            }

            val userId = step2Json.optString("userId")
            val cUserId = step2Json.optString("cUserId")
            val passToken = step2Json.optString("passToken")
            val location = step2Json.optString("location")

            // Step 3: Get serviceToken from location redirect
            val step3Request = Request.Builder()
                .url(location)
                .header("User-Agent", userAgent)
                .get()
                .build()
            val step3Response = client.newCall(step3Request).execute()
            val serviceToken = extractServiceToken(step3Response)
                ?: return@withContext Result.failure(Exception("登录失败: 无法获取 serviceToken"))

            Result.success(XiaomiCredentials(
                userId = userId, serviceToken = serviceToken, ssecurity = ssecurity,
                cUserId = cUserId, passToken = passToken, country = country,
                userAgent = userAgent, deviceId = deviceId
            ))
        } catch (e: CaptchaRequiredException) {
            Result.failure(e)
        } catch (e: TwoFactorRequiredException) {
            Result.failure(e)
        } catch (e: Exception) {
            Log.e(TAG, "Login failed", e)
            Result.failure(Exception("登录失败: ${e.message}"))
        }
    }

    private fun extractServiceToken(response: okhttp3.Response): String? {
        // Look in cookie store for serviceToken
        cookieStore.values.flatten().find { it.name == "serviceToken" }?.let {
            return it.value
        }
        // Also check response headers Set-Cookie
        response.headers("Set-Cookie").forEach { header ->
            if (header.startsWith("serviceToken=")) {
                return header.substringAfter("serviceToken=").substringBefore(";")
            }
        }
        return null
    }

    // ==================== QR Code Login ====================

    fun startQrLogin(country: String = "cn"): Flow<QrLoginEvent> = flow {
        try {
            val userAgent = generateUserAgent()
            val deviceId = generateDeviceId()

            // Step 1: Get service login params
            val serviceLoginUrl = "https://account.xiaomi.com/pass/serviceLogin?_json=true&sid=mijia&_locale=zh_CN"
            val step1Request = Request.Builder()
                .url(serviceLoginUrl)
                .header("User-Agent", userAgent)
                .header("Cookie", "deviceId=$deviceId")
                .get()
                .build()

            val step1Response = withContext(Dispatchers.IO) { client.newCall(step1Request).execute() }
            val step1Data = parseServiceResponse(step1Response.body?.string() ?: "")

            // Build login URL params
            val loginUrlParams = buildString {
                append("https://account.xiaomi.com/longPolling/loginUrl?")
                if (step1Data.has("qs")) append("qs=${URLEncoder.encode(step1Data.optString("qs"), "UTF-8")}&")
                if (step1Data.has("callback")) append("callback=${URLEncoder.encode(step1Data.optString("callback"), "UTF-8")}&")
                append("sid=mijia&_hasLogo=false&_qrsize=240&_dc=${System.currentTimeMillis()}")
            }

            val loginRequest = Request.Builder()
                .url(loginUrlParams)
                .header("User-Agent", userAgent)
                .get()
                .build()

            val loginResponse = withContext(Dispatchers.IO) { client.newCall(loginRequest).execute() }
            val loginData = parseServiceResponse(loginResponse.body?.string() ?: "")

            if (!loginData.has("loginUrl")) {
                emit(QrLoginEvent.Error("无法获取登录二维码"))
                return@flow
            }

            val loginUrl = loginData.optString("loginUrl")
            val lpUrl = loginData.optString("lp")

            emit(QrLoginEvent.QrCodeReady(loginUrl))
            emit(QrLoginEvent.WaitingForScan)

            // Step 3: Long poll waiting for scan
            val lpClient = OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(120, TimeUnit.SECONDS)
                .cookieJar(client.cookieJar)
                .build()

            val lpRequest = Request.Builder()
                .url(lpUrl)
                .header("User-Agent", userAgent)
                .get()
                .build()

            val lpResponse = withContext(Dispatchers.IO) {
                try {
                    lpClient.newCall(lpRequest).execute()
                } catch (e: Exception) {
                    null
                }
            }

            if (lpResponse == null || !lpResponse.isSuccessful) {
                emit(QrLoginEvent.Timeout)
                return@flow
            }

            val lpData = parseServiceResponse(lpResponse.body?.string() ?: "")
            val ssecurity = lpData.optString("ssecurity")
            val userId = lpData.optString("userId")
            val cUserId = lpData.optString("cUserId")
            val passToken = lpData.optString("passToken")
            val callbackUrl = lpData.optString("location")

            // Step 4: Get serviceToken
            val callbackRequest = Request.Builder()
                .url(callbackUrl)
                .header("User-Agent", userAgent)
                .get()
                .build()

            val callbackResponse = withContext(Dispatchers.IO) { client.newCall(callbackRequest).execute() }
            val serviceToken = extractServiceToken(callbackResponse)

            if (serviceToken != null) {
                _lastQrCredentials = XiaomiCredentials(
                    userId = userId, serviceToken = serviceToken, ssecurity = ssecurity,
                    cUserId = cUserId, passToken = passToken, country = country,
                    userAgent = userAgent, deviceId = deviceId
                )
                emit(QrLoginEvent.Success)
            } else {
                emit(QrLoginEvent.Error("无法获取认证令牌"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "QR login failed", e)
            emit(QrLoginEvent.Error("扫码登录失败: ${e.message}"))
        }
    }

    @Volatile
    private var _lastQrCredentials: XiaomiCredentials? = null
    fun getLastQrCredentials(): XiaomiCredentials? = _lastQrCredentials

    // ==================== Token Refresh ====================

    suspend fun refreshServiceToken(credentials: XiaomiCredentials): XiaomiCredentials? = withContext(Dispatchers.IO) {
        try {
            if (credentials.passToken.isBlank() || credentials.userId.isBlank()) {
                Log.w(TAG, "Cannot refresh: missing passToken or userId")
                return@withContext null
            }

            val userAgent = credentials.userAgent.ifEmpty { generateUserAgent() }
            val deviceId = credentials.deviceId.ifEmpty { generateDeviceId() }

            val url = "https://account.xiaomi.com/pass/serviceLogin?sid=xiaomiio&_json=true"
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", userAgent)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Cookie", "userId=${credentials.userId}; passToken=${credentials.passToken}; deviceId=$deviceId")
                .get()
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                Log.w(TAG, "Token refresh step1 failed: ${response.code}")
                return@withContext null
            }

            val json = parseServiceResponse(response.body?.string() ?: "")
            val location = json.optString("location", "")
            val ssecurity = json.optString("ssecurity", "")

            if (location.isBlank() || ssecurity.length <= 4) {
                Log.w(TAG, "Token refresh: no valid session returned")
                return@withContext null
            }

            // Follow redirect to get new serviceToken
            val redirectRequest = Request.Builder()
                .url(location)
                .header("User-Agent", userAgent)
                .get()
                .build()
            val redirectResponse = client.newCall(redirectRequest).execute()
            val newServiceToken = extractServiceToken(redirectResponse)

            if (newServiceToken != null) {
                Log.d(TAG, "Token refreshed successfully")
                credentials.copy(
                    serviceToken = newServiceToken,
                    ssecurity = ssecurity
                )
            } else {
                Log.w(TAG, "Token refresh: failed to extract new serviceToken")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Token refresh failed", e)
            null
        }
    }

    // ==================== API Communication ====================

    suspend fun request(
        uri: String,
        data: Map<String, Any>,
        credentials: XiaomiCredentials
    ): JSONObject? = withContext(Dispatchers.IO) {
        requestSemaphore.withPermit {
        try {
            val url = getApiBaseUrl(credentials.country) + uri
            val params = mutableMapOf("data" to JSONObject(data).toString())
            val nonce = genNonce()
            val signedNonce = getSignedNonce(credentials.ssecurity, nonce)
            val encParams = generateEncParams(uri, "POST", signedNonce, nonce, params, credentials.ssecurity)

            val tz = TimeZone.getDefault()
            val tzName = tz.id
            val offsetMs = tz.rawOffset
            val offsetHours = offsetMs / 3600000
            val offsetMins = Math.abs((offsetMs % 3600000) / 60000)
            val tzStr = "GMT%+03d:%02d".format(offsetHours, offsetMins)

            val cookieStr = buildString {
                append("cUserId=${credentials.cUserId};")
                append("yetAnotherServiceToken=${credentials.serviceToken};")
                append("serviceToken=${credentials.serviceToken};")
                append("timezone_id=$tzName;")
                append("timezone=$tzStr;")
                append("is_daylight=0;")
                append("dst_offset=0;")
                append("channel=MI_APP_STORE;")
                append("countryCode=CN;")
                append("PassportDeviceId=${credentials.deviceId};")
                append("locale=zh_CN")
            }

            val formBody = FormBody.Builder().apply {
                encParams.forEach { (k, v) -> add(k, v) }
            }.build()

            val request = Request.Builder()
                .url(url)
                .header("User-Agent", credentials.userAgent.ifEmpty { generateUserAgent() })
                .header("Accept-Encoding", "identity")
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("miot-accept-encoding", "GZIP")
                .header("miot-encrypt-algorithm", "ENCRYPT-RC4")
                .header("x-xiaomi-protocal-flag-cli", "PROTOCAL-HTTP2")
                .header("Cookie", cookieStr)
                .post(formBody)
                .build()

            val response = client.newCall(request).execute()
            val responseText = response.body?.string() ?: return@withContext null

            // Try plain JSON first
            val jsonResult = try {
                JSONObject(responseText)
            } catch (e: Exception) {
                // Decrypt RC4
                val decrypted = decryptResponse(credentials.ssecurity, nonce, responseText)
                JSONObject(decrypted)
            }

            val code = jsonResult.optInt("code", -1)
            if (code != 0) {
                val msg = jsonResult.optString("message", jsonResult.optString("desc", "Unknown"))
                throw MiotApiException(code, msg)
            }

            jsonResult
        } catch (e: MiotApiException) {
            throw e  // 重新抛出，让上层处理
        } catch (e: Exception) {
            Log.e(TAG, "API request failed: $uri", e)
            null
        }
        } // withPermit
    }

    // ==================== Device APIs ====================

    suspend fun getHomes(credentials: XiaomiCredentials): List<XiaomiHome> {
        val data = mapOf(
            "fg" to true, "fetch_share" to true, "fetch_share_dev" to true,
            "fetch_cariot" to true, "limit" to 300, "app_ver" to 7, "plat_form" to 0
        )
        val result = request("/v2/homeroom/gethome_merged", data, credentials) ?: return emptyList()
        val homeList = result.optJSONObject("result")?.optJSONArray("homelist") ?: return emptyList()

        return (0 until homeList.length()).map { i ->
            val home = homeList.getJSONObject(i)
            val rooms = mutableListOf<XiaomiRoom>()
            home.optJSONArray("roomlist")?.let { roomArray ->
                for (j in 0 until roomArray.length()) {
                    val room = roomArray.getJSONObject(j)
                    rooms.add(XiaomiRoom(room.optString("id"), room.optString("name")))
                }
            }
            XiaomiHome(
                id = home.optString("id"),
                name = home.optString("name"),
                ownerId = home.optLong("uid"),
                roomList = rooms
            )
        }
    }

    suspend fun getDevices(credentials: XiaomiCredentials, homeId: String, ownerId: Long): List<XiaomiDevice> {
        val allDevices = mutableListOf<XiaomiDevice>()
        var startDid = ""
        var hasMore = true

        while (hasMore) {
            val data = mutableMapOf<String, Any>(
                "home_owner" to ownerId,
                "home_id" to (homeId.toLongOrNull() ?: homeId) as Any,
                "limit" to 200,
                "start_did" to startDid,
                "get_split_device" to true,
                "support_smart_home" to true,
                "get_cariot_device" to true,
                "get_third_device" to true
            )
            val result = request("/home/home_device_list", data, credentials) ?: break
            val deviceInfo = result.optJSONObject("result")?.optJSONArray("device_info")

            if (deviceInfo != null && deviceInfo.length() > 0) {
                for (i in 0 until deviceInfo.length()) {
                    val d = deviceInfo.getJSONObject(i)
                    allDevices.add(XiaomiDevice(
                        did = d.optString("did"),
                        name = d.optString("name"),
                        model = d.optString("model"),
                        mac = d.optString("mac"),
                        localIp = d.optString("localip"),
                        token = d.optString("token"),
                        homeId = homeId,
                        roomId = d.optString("roomId", ""),
                        roomName = "",  // Will be resolved later
                        isOnline = d.optBoolean("isOnline", false)
                    ))
                }
                val maxDid = result.optJSONObject("result")?.optString("max_did", "") ?: ""
                hasMore = result.optJSONObject("result")?.optBoolean("has_more", false) == true && maxDid.isNotEmpty()
                startDid = maxDid
            } else {
                hasMore = false
            }
        }
        return allDevices
    }

    suspend fun getAllDevices(credentials: XiaomiCredentials): List<XiaomiDevice> {
        Log.d(TAG, "getAllDevices: country=${credentials.country}, apiBase=${getApiBaseUrl(credentials.country)}")
        val homes = getHomes(credentials)
        Log.d(TAG, "getAllDevices: found ${homes.size} homes")
        val allDevices = mutableListOf<XiaomiDevice>()

        for (home in homes) {
            val roomMap = home.roomList.associate { it.id to it.name }
            val devices = getDevices(credentials, home.id, home.ownerId)
            Log.d(TAG, "getAllDevices: home='${home.name}' ownerId=${home.ownerId} → ${devices.size} devices")
            allDevices.addAll(devices.map { device ->
                device.copy(
                    homeName = home.name,
                    roomName = roomMap[device.roomId] ?: "默认房间"
                )
            })
        }
        return allDevices
    }

    suspend fun getDeviceProperties(
        credentials: XiaomiCredentials,
        params: List<Map<String, Any>>
    ): List<PropertyValue> {
        val data = mapOf("params" to params, "datasource" to 1)
        val result = request("/miotspec/prop/get", data, credentials) ?: return emptyList()
        val resultArray = result.optJSONArray("result") ?: return emptyList()

        return (0 until resultArray.length()).map { i ->
            val item = resultArray.getJSONObject(i)
            PropertyValue(
                did = item.optString("did"),
                siid = item.optInt("siid"),
                piid = item.optInt("piid"),
                value = item.opt("value"),
                code = item.optInt("code"),
                updateTime = item.optLong("updateTime")
            )
        }
    }

    suspend fun setDeviceProperty(
        credentials: XiaomiCredentials,
        params: List<Map<String, Any>>
    ): List<PropertyValue> {
        val data = mapOf("params" to params)
        val result = request("/miotspec/prop/set", data, credentials) ?: return emptyList()
        val resultArray = result.optJSONArray("result") ?: return emptyList()

        return (0 until resultArray.length()).map { i ->
            val item = resultArray.getJSONObject(i)
            PropertyValue(
                did = item.optString("did"),
                siid = item.optInt("siid"),
                piid = item.optInt("piid"),
                code = item.optInt("code")
            )
        }
    }

    suspend fun runAction(
        credentials: XiaomiCredentials,
        params: Map<String, Any>
    ): Int {
        val result = request("/miotspec/action", mapOf("params" to params), credentials) ?: return -1
        return result.optJSONObject("result")?.optInt("code", -1) ?: -1
    }

    // ==================== Scenes ====================

    suspend fun getScenes(credentials: XiaomiCredentials, homeId: String, ownerId: Long): List<XiaomiScene> {
        val data = mapOf(
            "app_version" to 12, "get_type" to 2,
            "home_id" to homeId, "owner_uid" to ownerId
        )
        val result = request("/appgateway/miot/appsceneservice/AppSceneService/GetSimpleSceneList", data, credentials)
            ?: return emptyList()
        val sceneList = result.optJSONObject("result")?.optJSONArray("manual_scene_info_list")
            ?: return emptyList()

        return (0 until sceneList.length()).map { i ->
            val scene = sceneList.getJSONObject(i)
            XiaomiScene(
                sceneId = scene.optString("scene_id"),
                name = scene.optString("name"),
                homeId = homeId
            )
        }
    }

    suspend fun runScene(credentials: XiaomiCredentials, sceneId: String, homeId: String, ownerId: Long): Boolean {
        val data = mapOf(
            "scene_id" to sceneId, "scene_type" to 2,
            "phone_id" to "null", "home_id" to homeId, "owner_uid" to ownerId
        )
        val result = request("/appgateway/miot/appsceneservice/AppSceneService/NewRunScene", data, credentials)
        return result != null
    }
}

class CaptchaRequiredException(val captchaUrl: String) : Exception("需要验证码")
class TwoFactorRequiredException(val notificationUrl: String) : Exception("需要两步验证")
