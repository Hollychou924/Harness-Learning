package com.xiaoxiami.app.config

import android.content.Context
import android.content.SharedPreferences
import com.xiaoxiami.app.prompts.GeminiPrompts
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * 运行时调试配置。
 * 仅保留当前主链仍在使用的开关和 prompt。
 */
object DebugConfig {

    private const val PREFS_NAME = "debug_config"

    private var prefs: SharedPreferences? = null

    private val _useProxyService = MutableStateFlow(true)
    val useProxyService: StateFlow<Boolean> = _useProxyService

    val DEFAULT_ACTION_ITEM_PROMPT: String
        get() = GeminiPrompts.ACTION_ITEM_EXTRACTION

    private val _actionItemPrompt = MutableStateFlow(DEFAULT_ACTION_ITEM_PROMPT)
    val actionItemPrompt: StateFlow<String> = _actionItemPrompt

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        loadFromPrefs()
    }

    private fun loadFromPrefs() {
        prefs?.let { p ->
            _useProxyService.value = p.getBoolean("use_proxy_service", true)
            _actionItemPrompt.value =
                p.getString("action_item_prompt", DEFAULT_ACTION_ITEM_PROMPT)
                    ?: DEFAULT_ACTION_ITEM_PROMPT
        }
    }

    fun setUseProxyService(enabled: Boolean) {
        _useProxyService.value = enabled
        prefs?.edit()?.putBoolean("use_proxy_service", enabled)?.apply()
    }

    fun setActionItemPrompt(prompt: String) {
        _actionItemPrompt.value = prompt
        prefs?.edit()?.putString("action_item_prompt", prompt)?.apply()
    }

    fun resetActionItemConfig() {
        setActionItemPrompt(DEFAULT_ACTION_ITEM_PROMPT)
    }
}
