package com.xiaoxiami.app.data.iot

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query

@Entity(
    tableName = "iot_devices",
    indices = [
        Index("homeId"),
        Index("model")
    ]
)
data class IotDeviceEntity(
    @PrimaryKey val did: String,
    val name: String,
    val model: String,
    val mac: String = "",
    val localIp: String = "",
    val token: String = "",
    val homeId: String = "",
    val homeName: String = "",
    val roomId: String = "",
    val roomName: String = "",
    val isOnline: Boolean = false,
    val isFavorite: Boolean = false,
    val lastSyncAt: Long = System.currentTimeMillis()
)

@Dao
interface IotDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDevices(devices: List<IotDeviceEntity>)

    @Query("SELECT * FROM iot_devices ORDER BY isFavorite DESC, homeName, roomName, name")
    suspend fun getAllDevices(): List<IotDeviceEntity>

    @Query("SELECT * FROM iot_devices WHERE did = :did")
    suspend fun getDevice(did: String): IotDeviceEntity?

    @Query("SELECT * FROM iot_devices WHERE name = :name LIMIT 1")
    suspend fun getDeviceByName(name: String): IotDeviceEntity?

    @Query("SELECT did FROM iot_devices WHERE isFavorite = 1")
    suspend fun getFavoriteDids(): List<String>

    @Query("UPDATE iot_devices SET isFavorite = :favorite WHERE did = :did")
    suspend fun setFavorite(did: String, favorite: Boolean)

    @Query("DELETE FROM iot_devices")
    suspend fun deleteAllDevices()

    @Query("SELECT COUNT(*) FROM iot_devices")
    suspend fun getDeviceCount(): Int
}
