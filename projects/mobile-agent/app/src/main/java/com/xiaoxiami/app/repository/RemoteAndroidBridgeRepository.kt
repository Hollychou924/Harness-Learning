package com.xiaoxiami.app.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.xiaoxiami.app.data.remote.RemoteBridgeDao
import com.xiaoxiami.app.data.remote.RemoteBridgeRequestEntity
import com.xiaoxiami.app.data.remote.RemoteDeviceEntity
import com.xiaoxiami.app.remote.RemoteBridgeDeviceHello
import com.xiaoxiami.app.remote.RemoteBridgeHeartbeat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID

class RemoteAndroidBridgeRepository(
    private val dao: RemoteBridgeDao
) {
    private val gson = Gson()

    data class DeviceSnapshot(
        val id: String,
        val displayName: String,
        val platform: String,
        val status: String,
        val transport: String,
        val bridgeUrl: String,
        val authScope: String,
        val trustLevel: String,
        val sessionToken: String,
        val capabilities: List<String>,
        val scopes: List<String>,
        val lastSeenAt: Long?,
        val pairedAt: Long
    )

    data class RequestSnapshot(
        val id: String,
        val deviceId: String,
        val toolName: String,
        val status: String,
        val payload: Map<String, Any?>,
        val response: Map<String, Any?>,
        val errorMessage: String,
        val createdAt: Long,
        val timeoutAt: Long,
        val completedAt: Long?
    )

    suspend fun upsertDeviceHello(
        hello: RemoteBridgeDeviceHello,
        bridgeUrl: String = "",
        sessionToken: String = ""
    ): DeviceSnapshot =
        withContext(Dispatchers.IO) {
            val now = System.currentTimeMillis()
            val existing = dao.getDevice(hello.deviceId)
            val entity = RemoteDeviceEntity(
                id = hello.deviceId,
                displayName = hello.displayName,
                platform = hello.platform,
                transport = "bridge_v1",
                bridgeUrl = bridgeUrl.ifBlank { existing?.bridgeUrl.orEmpty() },
                status = "ONLINE",
                authScope = existing?.authScope ?: "paired",
                trustLevel = existing?.trustLevel ?: "trusted",
                sessionToken = sessionToken.ifBlank { existing?.sessionToken.orEmpty() },
                capabilitiesJson = gson.toJson(hello.capabilities),
                scopesJson = gson.toJson(hello.scopes),
                lastSeenAt = now,
                pairedAt = existing?.pairedAt ?: now,
                updatedAt = now
            )
            dao.upsertDevice(entity)
            entity.toSnapshot()
        }

    suspend fun updateHeartbeat(heartbeat: RemoteBridgeHeartbeat): DeviceSnapshot? =
        withContext(Dispatchers.IO) {
            val existing = dao.getDevice(heartbeat.deviceId) ?: return@withContext null
            val updated = existing.copy(
                status = heartbeat.status,
                capabilitiesJson = if (heartbeat.capabilities.isEmpty()) existing.capabilitiesJson else gson.toJson(heartbeat.capabilities),
                lastSeenAt = System.currentTimeMillis(),
                updatedAt = System.currentTimeMillis()
            )
            dao.upsertDevice(updated)
            updated.toSnapshot()
        }

    suspend fun upsertPairedPeer(
        deviceId: String,
        displayName: String,
        platform: String,
        bridgeUrl: String,
        sessionToken: String,
        capabilities: List<String> = emptyList(),
        scopes: List<String> = emptyList(),
        status: String = "ONLINE"
    ): DeviceSnapshot = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val existing = dao.getDevice(deviceId)
        val entity = RemoteDeviceEntity(
            id = deviceId,
            displayName = displayName,
            platform = platform,
            transport = "bridge_v1",
            bridgeUrl = bridgeUrl,
            status = status,
            authScope = existing?.authScope ?: "paired",
            trustLevel = existing?.trustLevel ?: "trusted",
            sessionToken = sessionToken.ifBlank { existing?.sessionToken.orEmpty() },
            capabilitiesJson = gson.toJson(if (capabilities.isEmpty()) parseJsonList(existing?.capabilitiesJson.orEmpty()) else capabilities),
            scopesJson = gson.toJson(if (scopes.isEmpty()) parseJsonList(existing?.scopesJson.orEmpty()) else scopes),
            lastSeenAt = now,
            pairedAt = existing?.pairedAt ?: now,
            updatedAt = now
        )
        dao.upsertDevice(entity)
        entity.toSnapshot()
    }

    suspend fun listDevices(limit: Int = 50): List<DeviceSnapshot> = withContext(Dispatchers.IO) {
        sweepTimedOutRequests()
        dao.listDevices(limit.coerceIn(1, 200)).map { it.toSnapshot() }
    }

    suspend fun createPendingRequest(
        deviceId: String,
        toolName: String,
        payload: Map<String, Any?>,
        timeoutMs: Long = 30_000L
    ): RemoteBridgeRequestEntity = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val request = RemoteBridgeRequestEntity(
            id = UUID.randomUUID().toString(),
            deviceId = deviceId,
            requestType = "tool_request",
            toolName = toolName,
            payloadJson = gson.toJson(payload),
            status = "PENDING",
            createdAt = now,
            timeoutAt = now + timeoutMs.coerceIn(5_000L, 300_000L)
        )
        dao.upsertRequest(request)
        request
    }

    suspend fun completeRequest(
        requestId: String,
        success: Boolean,
        payload: Map<String, Any?> = emptyMap(),
        errorMessage: String = ""
    ): RemoteBridgeRequestEntity? = withContext(Dispatchers.IO) {
        val existing = dao.getRequest(requestId) ?: return@withContext null
        val updated = existing.copy(
            status = if (success) "COMPLETED" else "FAILED",
            completedAt = System.currentTimeMillis(),
            responseJson = gson.toJson(payload),
            errorMessage = errorMessage.take(1000)
        )
        dao.upsertRequest(updated)
        updated
    }

    suspend fun getRequestSnapshot(requestId: String): RequestSnapshot? = withContext(Dispatchers.IO) {
        dao.getRequest(requestId)?.toSnapshot()
    }

    suspend fun listRequests(
        deviceId: String = "",
        limit: Int = 20
    ): List<Map<String, Any?>> = withContext(Dispatchers.IO) {
        sweepTimedOutRequests()
        dao.listRequests(deviceId, limit.coerceIn(1, 200)).map { it.toSnapshot().toMap() }
    }

    suspend fun sweepTimedOutRequests(): Int = withContext(Dispatchers.IO) {
        val expired = dao.listExpiredRequests(System.currentTimeMillis())
        expired.forEach { request ->
            dao.upsertRequest(
                request.copy(
                    status = "TIMED_OUT",
                    completedAt = System.currentTimeMillis(),
                    errorMessage = if (request.errorMessage.isBlank()) "remote request timed out" else request.errorMessage
                )
            )
        }
        expired.size
    }

    private fun RemoteDeviceEntity.toSnapshot(): DeviceSnapshot {
        return DeviceSnapshot(
            id = id,
            displayName = displayName,
            platform = platform,
            status = status.lowercase(),
            transport = transport,
            bridgeUrl = bridgeUrl,
            authScope = authScope,
            trustLevel = trustLevel,
            sessionToken = sessionToken,
            capabilities = parseJsonList(capabilitiesJson),
            scopes = parseJsonList(scopesJson),
            lastSeenAt = lastSeenAt,
            pairedAt = pairedAt
        )
    }

    private fun RemoteBridgeRequestEntity.toSnapshot(): RequestSnapshot {
        return RequestSnapshot(
            id = id,
            deviceId = deviceId,
            toolName = toolName,
            status = status.lowercase(),
            payload = parseJsonMap(payloadJson),
            response = parseJsonMap(responseJson),
            errorMessage = errorMessage,
            createdAt = createdAt,
            timeoutAt = timeoutAt,
            completedAt = completedAt
        )
    }

    private fun RequestSnapshot.toMap(): Map<String, Any?> {
        return mapOf(
            "id" to id,
            "deviceId" to deviceId,
            "toolName" to toolName,
            "status" to status,
            "createdAt" to createdAt,
            "timeoutAt" to timeoutAt,
            "completedAt" to completedAt,
            "payload" to payload,
            "response" to response,
            "errorMessage" to errorMessage
        )
    }

    private fun parseJsonList(raw: String): List<String> {
        if (raw.isBlank()) return emptyList()
        return runCatching {
            gson.fromJson<List<String>>(raw, object : TypeToken<List<String>>() {}.type)
        }.getOrDefault(emptyList())
    }

    private fun parseJsonMap(raw: String): Map<String, Any?> {
        if (raw.isBlank()) return emptyMap()
        return runCatching {
            gson.fromJson<Map<String, Any?>>(raw, object : TypeToken<Map<String, Any?>>() {}.type)
        }.getOrDefault(emptyMap())
    }
}
