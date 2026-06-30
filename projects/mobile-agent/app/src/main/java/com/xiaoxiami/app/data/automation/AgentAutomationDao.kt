package com.xiaoxiami.app.data.automation

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface AgentAutomationDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSchedule(schedule: AgentScheduleEntity)

    @Query("SELECT * FROM agent_schedules WHERE id = :scheduleId LIMIT 1")
    suspend fun getSchedule(scheduleId: String): AgentScheduleEntity?

    @Query("SELECT * FROM agent_schedules ORDER BY updatedAt DESC")
    suspend fun listSchedules(): List<AgentScheduleEntity>

    @Query("DELETE FROM agent_schedules WHERE id = :scheduleId")
    suspend fun deleteScheduleById(scheduleId: String)

    @Query("DELETE FROM agent_schedule_runs WHERE scheduleId = :scheduleId")
    suspend fun deleteRunsForSchedule(scheduleId: String)

    // Enhanced: Count total runs for a schedule (for pruning)
    @Query("SELECT COUNT(*) FROM agent_schedule_runs WHERE scheduleId = :scheduleId")
    suspend fun countRunsForSchedule(scheduleId: String): Int

    // Enhanced: Delete oldest runs beyond the limit
    @Query("""
        DELETE FROM agent_schedule_runs WHERE id IN (
            SELECT id FROM agent_schedule_runs
            WHERE scheduleId = :scheduleId
            ORDER BY startedAt DESC
            LIMIT -1 OFFSET :keepCount
        )
    """)
    suspend fun pruneOldRuns(scheduleId: String, keepCount: Int)

    // Enhanced: Get expired schedules
    @Query("SELECT * FROM agent_schedules WHERE enabled = 1 AND expiresAt IS NOT NULL AND expiresAt <= :nowMs")
    suspend fun listExpiredSchedules(nowMs: Long): List<AgentScheduleEntity>

    // Enhanced: Update consecutive error count
    @Query("UPDATE agent_schedules SET consecutiveErrors = :count, lastStatus = :status, lastError = :error, lastDurationMs = :durationMs WHERE id = :scheduleId")
    suspend fun updateScheduleRunState(scheduleId: String, count: Int, status: String, error: String, durationMs: Long)

    // Enhanced: Auto-disable schedule
    @Query("UPDATE agent_schedules SET enabled = 0 WHERE id = :scheduleId")
    suspend fun disableSchedule(scheduleId: String)

    @Query("SELECT * FROM agent_schedules WHERE enabled = 1 AND nextRunAt IS NOT NULL ORDER BY nextRunAt ASC")
    suspend fun listEnabledSchedulesForReschedule(): List<AgentScheduleEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRun(run: AgentScheduleRunEntity)

    @Query("SELECT * FROM agent_schedule_runs WHERE id = :runId LIMIT 1")
    suspend fun getRun(runId: String): AgentScheduleRunEntity?

    @Query("SELECT * FROM agent_schedule_runs WHERE scheduleId = :scheduleId ORDER BY startedAt DESC LIMIT :limit")
    suspend fun listRunsForSchedule(scheduleId: String, limit: Int): List<AgentScheduleRunEntity>

    @Query(
        """
        SELECT
            r.id AS id,
            r.scheduleId AS scheduleId,
            r.triggerSource AS triggerSource,
            r.startedAt AS startedAt,
            r.completedAt AS completedAt,
            r.status AS status,
            r.summary AS summary,
            r.traceId AS traceId,
            r.errorMessage AS errorMessage,
            r.durationMs AS durationMs,
            COALESCE(s.name, '') AS scheduleName
        FROM agent_schedule_runs r
        LEFT JOIN agent_schedules s ON s.id = r.scheduleId
        ORDER BY r.startedAt DESC
        LIMIT :limit OFFSET :offset
        """
    )
    suspend fun listAllRuns(limit: Int, offset: Int): List<AgentScheduleRunWithName>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertRule(rule: AgentRuleEntity)

    @Query("SELECT * FROM agent_rules WHERE id = :ruleId LIMIT 1")
    suspend fun getRule(ruleId: String): AgentRuleEntity?

    @Query("SELECT * FROM agent_rules ORDER BY updatedAt DESC")
    suspend fun listRules(): List<AgentRuleEntity>

    @Query("DELETE FROM agent_rules WHERE id = :ruleId")
    suspend fun deleteRuleById(ruleId: String)

    @Query("SELECT * FROM agent_rules WHERE enabled = 1 AND triggerType = :triggerType ORDER BY updatedAt DESC")
    suspend fun listEnabledRulesByTrigger(triggerType: String): List<AgentRuleEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRuleRun(run: AgentRuleRunEntity)

    @Query("SELECT * FROM agent_rule_runs WHERE id = :runId LIMIT 1")
    suspend fun getRuleRun(runId: String): AgentRuleRunEntity?

    @Query("SELECT * FROM agent_rule_runs WHERE ruleId = :ruleId ORDER BY matchedAt DESC LIMIT :limit")
    suspend fun listRuleRuns(ruleId: String, limit: Int): List<AgentRuleRunEntity>

    @Query("DELETE FROM agent_rule_runs WHERE ruleId = :ruleId")
    suspend fun deleteRuleRunsForRule(ruleId: String)

    @Query(
        """
        SELECT COUNT(*) FROM agent_rule_runs
        WHERE ruleId = :ruleId
        AND matchedAt >= :sinceMs
        AND status IN ('PENDING_CONFIRM', 'QUEUED', 'RUNNING', 'SUCCESS')
        """
    )
    suspend fun countRuleTriggersSince(ruleId: String, sinceMs: Long): Int
}
