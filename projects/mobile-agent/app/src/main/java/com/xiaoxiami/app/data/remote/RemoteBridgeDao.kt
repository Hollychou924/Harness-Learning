package com.xiaoxiami.app.data.remote

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface RemoteBridgeDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDevice(device: RemoteDeviceEntity)

    @Query("SELECT * FROM remote_devices WHERE id = :deviceId LIMIT 1")
    suspend fun getDevice(deviceId: String): RemoteDeviceEntity?

    @Query("SELECT * FROM remote_devices ORDER BY updatedAt DESC LIMIT :limit")
    suspend fun listDevices(limit: Int): List<RemoteDeviceEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertRequest(request: RemoteBridgeRequestEntity)

    @Query("SELECT * FROM remote_bridge_requests WHERE id = :requestId LIMIT 1")
    suspend fun getRequest(requestId: String): RemoteBridgeRequestEntity?

    @Query(
        """
        SELECT * FROM remote_bridge_requests
        WHERE (:deviceId = '' OR deviceId = :deviceId)
        ORDER BY createdAt DESC LIMIT :limit
        """
    )
    suspend fun listRequests(deviceId: String, limit: Int): List<RemoteBridgeRequestEntity>

    @Query(
        """
        SELECT * FROM remote_bridge_requests
        WHERE status IN ('PENDING', 'SENT')
        AND timeoutAt <= :now
        """
    )
    suspend fun listExpiredRequests(now: Long): List<RemoteBridgeRequestEntity>
}
