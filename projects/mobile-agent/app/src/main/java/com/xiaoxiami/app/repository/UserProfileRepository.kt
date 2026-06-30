package com.xiaoxiami.app.repository

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File

/**
 * 结构化用户画像仓库。
 *
 * 维护 4 个维度：
 * - work: 工作相关信息（公司、职业、工作习惯）
 * - personal: 个人信息（兴趣、生活方式）
 * - topOfMind: 近期关注点（最近在做什么、关注什么话题）
 * - preferences: 偏好设置（交互偏好、工具偏好）
 *
 * 每次对话结束后用 LLM 提取增量更新。
 */
class UserProfileRepository(
    private val context: Context,
    private val geminiRepository: GeminiRepository
) {
    companion object {
        private const val TAG = "UserProfile"
        private const val FILE_NAME = "user_profile.json"
        private const val MIN_UPDATE_INTERVAL_MS = 5 * 60 * 1000L // 5 分钟防抖
    }

    data class UserProfile(
        val work: MutableMap<String, String> = mutableMapOf(),
        val personal: MutableMap<String, String> = mutableMapOf(),
        val topOfMind: MutableList<String> = mutableListOf(),
        val preferences: MutableMap<String, String> = mutableMapOf()
    )

    private val gson = Gson()
    private val mutex = Mutex()
    private val profileFile: File by lazy {
        File(context.filesDir, FILE_NAME)
    }
    private var cachedProfile: UserProfile? = null
    private var lastUpdateTime: Long = 0

    /**
     * 加载用户画像。
     */
    suspend fun loadProfile(): UserProfile = mutex.withLock {
        cachedProfile?.let { return it }
        withContext(Dispatchers.IO) {
            if (profileFile.exists()) {
                try {
                    val json = profileFile.readText()
                    val profile = safeParseProfile(json)
                    cachedProfile = profile
                    profile
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to load profile", e)
                    UserProfile().also { cachedProfile = it }
                }
            } else {
                UserProfile().also { cachedProfile = it }
            }
        }
    }

    /**
     * 安全解析 UserProfile JSON，容忍 LLM 返回的类型不匹配（如 preferences 为数组）。
     */
    private fun safeParseProfile(json: String): UserProfile {
        val obj = gson.fromJson(json, JsonObject::class.java) ?: return UserProfile()
        val profile = UserProfile()

        fun readStringMap(key: String): MutableMap<String, String> {
            val element = obj.get(key) ?: return mutableMapOf()
            if (!element.isJsonObject) return mutableMapOf()
            val map = mutableMapOf<String, String>()
            element.asJsonObject.entrySet().forEach { (k, v) ->
                if (v.isJsonPrimitive) map[k] = v.asString
            }
            return map
        }

        fun readStringList(key: String): MutableList<String> {
            val element = obj.get(key) ?: return mutableListOf()
            if (!element.isJsonArray) return mutableListOf()
            return element.asJsonArray.mapNotNull { e ->
                if (e.isJsonPrimitive) e.asString else null
            }.toMutableList()
        }

        profile.work.putAll(readStringMap("work"))
        profile.personal.putAll(readStringMap("personal"))
        profile.topOfMind.addAll(readStringList("topOfMind"))
        profile.preferences.putAll(readStringMap("preferences"))
        return profile
    }

    /**
     * 保存用户画像。
     */
    private suspend fun saveProfile(profile: UserProfile) = withContext(Dispatchers.IO) {
        try {
            profileFile.writeText(gson.toJson(profile))
            cachedProfile = profile
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save profile", e)
        }
    }

    /**
     * 生成注入到系统 prompt 的画像摘要。
     * 返回精简文本（通常 50-100 token）。
     */
    suspend fun buildProfilePrompt(): String? {
        val profile = loadProfile()
        val parts = mutableListOf<String>()

        if (profile.work.isNotEmpty()) {
            parts += "工作: " + profile.work.entries.joinToString(", ") { "${it.key}=${it.value}" }
        }
        if (profile.personal.isNotEmpty()) {
            parts += "个人: " + profile.personal.entries.joinToString(", ") { "${it.key}=${it.value}" }
        }
        if (profile.topOfMind.isNotEmpty()) {
            parts += "近期关注: " + profile.topOfMind.takeLast(3).joinToString(", ")
        }
        if (profile.preferences.isNotEmpty()) {
            parts += "偏好: " + profile.preferences.entries.joinToString(", ") { "${it.key}=${it.value}" }
        }

        return if (parts.isEmpty()) null else parts.joinToString("; ")
    }

    /**
     * 从对话中异步提取画像更新。
     * 带 5 分钟防抖。
     */
    suspend fun updateProfileFromConversation(
        conversationHistory: List<Pair<String, String>>
    ) {
        val now = System.currentTimeMillis()
        if (now - lastUpdateTime < MIN_UPDATE_INTERVAL_MS) {
            Log.d(TAG, "Skipping profile update (debounce)")
            return
        }

        if (conversationHistory.size < 2) return // 对话太短，不值得提取

        val currentProfile = loadProfile()
        val currentJson = gson.toJson(currentProfile)

        val recentHistory = conversationHistory.takeLast(10).joinToString("\n") { (role, content) ->
            "[$role]: ${content.take(300)}"
        }

        val prompt = """分析以下对话，提取用户画像的增量更新。

当前用户画像:
$currentJson

最近对话:
$recentHistory

请返回 JSON 格式的增量更新，只包含需要新增或修改的字段。格式：
{
  "work": {"key": "value"},
  "personal": {"key": "value"},
  "topOfMind": ["近期关注点"],
  "preferences": {"key": "value"}
}

规则：
1. 只提取明确的事实，不要推测
2. topOfMind 只保留最近 5 个关注点
3. 如果没有新信息，返回空 JSON: {}
4. 直接输出 JSON，不要加其他文字"""

        try {
            val result = geminiRepository.generateContent(
                prompt = prompt,
                modelName = "gemini-2.0-flash"
            )

            val cleanJson = result.trim()
                .removePrefix("```json").removePrefix("```")
                .removeSuffix("```").trim()

            if (cleanJson == "{}" || cleanJson.isBlank()) return

            val updateType = object : TypeToken<Map<String, Any>>() {}.type
            val update: Map<String, Any> = gson.fromJson(cleanJson, updateType) ?: return

            mutex.withLock {
                val profile = cachedProfile ?: UserProfile()

                @Suppress("UNCHECKED_CAST")
                (update["work"] as? Map<String, String>)?.let { profile.work.putAll(it) }
                @Suppress("UNCHECKED_CAST")
                (update["personal"] as? Map<String, String>)?.let { profile.personal.putAll(it) }
                @Suppress("UNCHECKED_CAST")
                (update["topOfMind"] as? List<String>)?.let { items ->
                    profile.topOfMind.addAll(items)
                    while (profile.topOfMind.size > 5) profile.topOfMind.removeFirst()
                }
                @Suppress("UNCHECKED_CAST")
                when (val pref = update["preferences"]) {
                    is Map<*, *> -> (pref as? Map<String, String>)?.let { profile.preferences.putAll(it) }
                    is List<*> -> pref.forEachIndexed { i, v ->
                        if (v is String) profile.preferences[v] = "true"
                    }
                }

                saveProfile(profile)
            }
            lastUpdateTime = now
            Log.d(TAG, "Profile updated successfully")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to extract profile update", e)
        }
    }
}
