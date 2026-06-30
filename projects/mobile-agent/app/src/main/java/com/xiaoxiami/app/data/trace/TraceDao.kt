package com.xiaoxiami.app.data.trace

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface TraceDao {
    // ==================== Trace Runs ====================
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRun(run: TraceRun)

    @Update
    suspend fun updateRun(run: TraceRun)

    @Query("SELECT * FROM trace_runs ORDER BY startAt DESC")
    fun getAllRuns(): Flow<List<TraceRun>>

    @Query("SELECT * FROM trace_runs WHERE traceId = :traceId")
    suspend fun getRun(traceId: String): TraceRun?

    // ==================== Trace Spans ====================
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSpan(span: TraceSpan)

    @Update
    suspend fun updateSpan(span: TraceSpan)

    @Query("SELECT * FROM trace_spans WHERE traceId = :traceId ORDER BY startAt ASC")
    fun getSpansForTrace(traceId: String): Flow<List<TraceSpan>>
    
    @Query("SELECT * FROM trace_spans WHERE traceId = :traceId ORDER BY startAt ASC")
    suspend fun getSpansForTraceSync(traceId: String): List<TraceSpan>

    // ==================== Artifacts ====================
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertArtifact(artifact: TraceArtifact)

    @Query("SELECT * FROM trace_artifacts WHERE traceId = :traceId")
    suspend fun getArtifactsForTrace(traceId: String): List<TraceArtifact>

    @Query("SELECT * FROM trace_artifacts WHERE artifactId = :artifactId")
    suspend fun getArtifact(artifactId: String): TraceArtifact?

    // ==================== Cleanup ====================
    @Query("DELETE FROM trace_runs")
    suspend fun deleteAllRuns()

    @Query("DELETE FROM trace_spans")
    suspend fun deleteAllSpans()

    @Query("DELETE FROM trace_artifacts")
    suspend fun deleteAllArtifacts()
}
