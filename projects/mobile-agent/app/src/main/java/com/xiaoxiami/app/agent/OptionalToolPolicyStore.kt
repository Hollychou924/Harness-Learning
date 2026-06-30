package com.xiaoxiami.app.agent

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class OptionalToolPolicyState(
    val enabledTags: Set<String> = setOf("high_risk", "remote_android")
)

class OptionalToolPolicyStore(
    context: Context
) {
    private val prefs = context.getSharedPreferences("optional_tool_policy", Context.MODE_PRIVATE)
    private val _state = MutableStateFlow(load())
    val state: StateFlow<OptionalToolPolicyState> = _state.asStateFlow()

    fun setTagEnabled(tag: String, enabled: Boolean) {
        val next = _state.value.enabledTags.toMutableSet().apply {
            if (enabled) add(tag) else remove(tag)
        }
        persist(OptionalToolPolicyState(next))
    }

    fun isEnabled(tag: String): Boolean = _state.value.enabledTags.contains(tag)

    private fun load(): OptionalToolPolicyState {
        val raw = prefs.getStringSet(KEY_ENABLED_TAGS, DEFAULT_TAGS) ?: DEFAULT_TAGS
        return OptionalToolPolicyState(enabledTags = raw.toSet())
    }

    private fun persist(state: OptionalToolPolicyState) {
        prefs.edit().putStringSet(KEY_ENABLED_TAGS, state.enabledTags).apply()
        _state.value = state
    }

    companion object {
        private const val KEY_ENABLED_TAGS = "enabled_tags"
        private val DEFAULT_TAGS = setOf("high_risk", "remote_android", "shell_runtime")
    }
}
