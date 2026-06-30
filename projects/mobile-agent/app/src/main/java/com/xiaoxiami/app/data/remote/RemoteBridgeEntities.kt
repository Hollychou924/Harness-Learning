package com.xiaoxiami.app.data.remote

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "remote_devices",
    indices = [
        Index(value = ["status"]),
        Index(value = ["lastSeenAt"])
    ]
)
data class RemoteDeviceEntity(
    @PrimaryKey val id: String,
    val displayName: String,
    val platform: String = "android",
    val transport: String = "bridge_v1",
    val bridgeUrl: String = "",
    val status: String = "OFFLINE",
    val authScope: String = "paired",
    val trustLevel: String = "trusted",
    val sessionToken: String = "",
    val capabilitiesJson: String = "[]",
    val scopesJson: String = "[]",
    val lastSeenAt: Long? = null,
    val pairedAt: Long,
    val updatedAt: Long
)

@Entity(
    tableName = "remote_bridge_requests",
    indices = [
        Index(value = ["deviceId"]),
        Index(value = ["status"]),
        Index(value = ["timeoutAt"])
    ]
)
data class RemoteBridgeRequestEntity(
    @PrimaryKey val id: String,
    val deviceId: String,
    val requestType: String,
    val toolName: String,
    val payloadJson: String = "{}",
    val status: String,
    val createdAt: Long,
    val timeoutAt: Long,
    val completedAt: Long? = null,
    val responseJson: String = "",
    val errorMessage: String = ""
)
