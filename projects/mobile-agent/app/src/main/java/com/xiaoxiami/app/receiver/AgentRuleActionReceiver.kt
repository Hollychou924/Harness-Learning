package com.xiaoxiami.app.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.xiaoxiami.app.data.MemoryDatabase
import com.xiaoxiami.app.repository.AgentAutomationRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class AgentRuleActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_CONFIRM_RULE_RUN = "com.xiaoxiami.app.action.CONFIRM_RULE_RUN"
        const val EXTRA_RULE_RUN_ID = "rule_run_id"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != ACTION_CONFIRM_RULE_RUN) return
        val ruleRunId = intent.getStringExtra(EXTRA_RULE_RUN_ID).orEmpty()
        if (ruleRunId.isBlank()) return

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            runCatching {
                AgentAutomationRepository(
                    context = context.applicationContext,
                    dao = MemoryDatabase.getDatabase(context.applicationContext).agentAutomationDao()
                ).confirmRuleRun(ruleRunId)
            }.also {
                pendingResult.finish()
            }
        }
    }
}
