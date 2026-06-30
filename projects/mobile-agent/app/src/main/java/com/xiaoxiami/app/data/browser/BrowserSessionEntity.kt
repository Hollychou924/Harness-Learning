package com.xiaoxiami.app.data.browser

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query

@Entity(tableName = "browser_sessions")
data class BrowserSessionEntity(
    @PrimaryKey val id: String,
    val name: String,
    val url: String,
    val title: String,
    val cookiesJson: String = "",
    val createdAt: Long,
    val updatedAt: Long
)

@Dao
interface BrowserSessionDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: BrowserSessionEntity)

    @Query("SELECT * FROM browser_sessions ORDER BY updatedAt DESC")
    suspend fun listAll(): List<BrowserSessionEntity>

    @Query("SELECT * FROM browser_sessions WHERE id = :id")
    suspend fun getById(id: String): BrowserSessionEntity?

    @Query("DELETE FROM browser_sessions WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM browser_sessions")
    suspend fun deleteAll()
}
