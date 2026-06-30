package com.xiaoxiami.app.agent.skills

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Manages skills from multiple directories with precedence:
 *   1. User custom skills (external storage) — highest priority
 *   2. Managed/installed skills (app internal storage)
 *   3. Built-in assets skills (APK bundled) — lowest priority
 *   4. Hardcoded BundledSkills — fallback
 *
 * Ported from desktop-claw's agent/src/skills/manager.ts
 */
class SkillManager(private val context: Context) {

    private val gson = Gson()

    // Directories
    private val managedSkillsDir = File(context.filesDir, "skills/managed")
    private val userSkillsDir = File(context.getExternalFilesDir(null), "skills")

    // Skill sources in precedence order
    private val sources: List<SkillSource> by lazy {
        listOf(
            LocalMarkdownSkillSource(userSkillsDir),
            LocalMarkdownSkillSource(managedSkillsDir),
            AssetBundledSkillSource(context),
            BundledSkillSource
        )
    }

    // Registry wrapping all sources
    val registry: SkillRegistry by lazy {
        SkillRegistry(sources)
    }

    // Observable state for UI
    private val _allSkills = MutableStateFlow<List<SkillManifest>>(emptyList())
    val allSkills: StateFlow<List<SkillManifest>> = _allSkills.asStateFlow()

    // Track toggled-off skills
    private val disabledSkillsFile = File(context.filesDir, "skills/disabled_skills.json")
    private val disabledSkillIds = mutableSetOf<String>()

    init {
        managedSkillsDir.mkdirs()
        userSkillsDir?.mkdirs()
        loadDisabledSkills()
    }

    /** Refresh the skill list from all sources. */
    suspend fun refreshSkills() = withContext(Dispatchers.IO) {
        val seen = linkedMapOf<String, SkillManifest>()
        for (source in sources) {
            for (skill in source.load()) {
                if (skill.id !in seen) {
                    val effectiveEnabled = skill.id !in disabledSkillIds && skill.enabled
                    seen[skill.id] = skill.copy(enabled = effectiveEnabled)
                }
            }
        }
        _allSkills.value = seen.values.toList()
    }

    /** Get all skills, refreshing if needed. */
    fun getAllSkills(): List<SkillManifest> {
        if (_allSkills.value.isEmpty()) {
            val seen = linkedMapOf<String, SkillManifest>()
            for (source in sources) {
                for (skill in source.load()) {
                    if (skill.id !in seen) {
                        val effectiveEnabled = skill.id !in disabledSkillIds && skill.enabled
                        seen[skill.id] = skill.copy(enabled = effectiveEnabled)
                    }
                }
            }
            _allSkills.value = seen.values.toList()
        }
        return _allSkills.value
    }

    /** Get only enabled/active skills. */
    fun getActiveSkills(): List<SkillManifest> {
        return getAllSkills().filter { it.enabled }
    }

    /** Toggle a skill on/off. */
    suspend fun toggleSkill(skillId: String, enabled: Boolean) = withContext(Dispatchers.IO) {
        if (enabled) {
            disabledSkillIds.remove(skillId)
        } else {
            disabledSkillIds.add(skillId)
        }
        saveDisabledSkills()
        refreshSkills()
    }

    /** Create a new skill in the managed directory. */
    suspend fun createSkill(
        name: String,
        description: String,
        content: String,
        category: String = "custom"
    ): SkillManifest = withContext(Dispatchers.IO) {
        val skillId = sanitizeName(name)
        val skillDir = File(managedSkillsDir, skillId)
        skillDir.mkdirs()
        File(skillDir, "references").mkdirs()
        File(skillDir, "scripts").mkdirs()

        val skillMd = buildString {
            appendLine("---")
            appendLine("name: \"$name\"")
            appendLine("description: \"$description\"")
            appendLine("category: $category")
            appendLine("enabled: true")
            appendLine("---")
            appendLine()
            append(content)
        }
        File(skillDir, "SKILL.md").writeText(skillMd, Charsets.UTF_8)

        refreshSkills()

        SkillManifest(
            id = skillId,
            title = name,
            description = description,
            instructions = content,
            category = category,
            sourceKind = SkillSourceKind.MARKDOWN_PACKAGE
        )
    }

    /** Update an existing skill's content. */
    suspend fun updateSkill(skillId: String, newContent: String): Boolean = withContext(Dispatchers.IO) {
        // Only update managed or user skills
        for (dir in listOf(userSkillsDir, managedSkillsDir)) {
            val skillFile = File(dir, "$skillId/SKILL.md")
            if (skillFile.exists()) {
                val raw = skillFile.readText()
                // Preserve frontmatter, replace body
                val fmEnd = raw.indexOf("---", raw.indexOf("---") + 3)
                if (fmEnd >= 0) {
                    val frontmatter = raw.substring(0, fmEnd + 3)
                    skillFile.writeText("$frontmatter\n\n$newContent", Charsets.UTF_8)
                } else {
                    skillFile.writeText(newContent, Charsets.UTF_8)
                }
                refreshSkills()
                return@withContext true
            }
        }
        false
    }

    /** Delete a non-builtin skill. */
    suspend fun deleteSkill(skillId: String): Boolean = withContext(Dispatchers.IO) {
        for (dir in listOf(userSkillsDir, managedSkillsDir)) {
            val skillDir = File(dir, skillId)
            if (skillDir.exists() && skillDir.isDirectory) {
                skillDir.deleteRecursively()
                disabledSkillIds.remove(skillId)
                saveDisabledSkills()
                refreshSkills()
                return@withContext true
            }
        }
        false
    }

    /** Import a skill from URL (downloads SKILL.md). */
    suspend fun importSkillFromUrl(url: String): ImportResult = withContext(Dispatchers.IO) {
        try {
            val response = java.net.URL(url).readText(Charsets.UTF_8)
            val nameMatch = Regex("^name:\\s*[\"']?(.+?)[\"']?\\s*$", RegexOption.MULTILINE)
                .find(response)
            val name = nameMatch?.groupValues?.get(1) ?: extractNameFromUrl(url)
            val skillId = sanitizeName(name)
            val skillDir = File(managedSkillsDir, skillId)
            skillDir.mkdirs()
            File(skillDir, "references").mkdirs()
            File(skillDir, "scripts").mkdirs()
            File(skillDir, "SKILL.md").writeText(response, Charsets.UTF_8)
            refreshSkills()
            ImportResult(true, name, "Skill \"$name\" imported successfully")
        } catch (e: Exception) {
            ImportResult(false, "", "Import failed: ${e.message}")
        }
    }

    // --- Private helpers ---

    private fun loadDisabledSkills() {
        try {
            if (disabledSkillsFile.exists()) {
                val type = object : TypeToken<Set<String>>() {}.type
                val ids: Set<String> = gson.fromJson(disabledSkillsFile.readText(), type)
                disabledSkillIds.addAll(ids)
            }
        } catch (_: Exception) {}
    }

    private fun saveDisabledSkills() {
        try {
            disabledSkillsFile.parentFile?.mkdirs()
            disabledSkillsFile.writeText(gson.toJson(disabledSkillIds))
        } catch (_: Exception) {}
    }

    private fun sanitizeName(name: String): String {
        return name.lowercase()
            .replace(Regex("[^a-z0-9_-]"), "-")
            .replace(Regex("-+"), "-")
            .trim('-')
    }

    private fun extractNameFromUrl(url: String): String {
        val parts = url.split("/").filter { it.isNotBlank() }
        for (i in parts.indices.reversed()) {
            val part = parts[i]
            if (part != "SKILL.md" && part != "raw" && part != "main" && part != "master") {
                return part
            }
        }
        return "imported-${System.currentTimeMillis()}"
    }
}

data class ImportResult(
    val success: Boolean,
    val name: String,
    val message: String
)

/**
 * SkillSource that reads SKILL.md files from Android assets/bundled-skills/ directory.
 * This loads the 28 skills ported from desktop-claw.
 */
class AssetBundledSkillSource(private val context: Context) : SkillSource {

    override fun load(): List<SkillManifest> {
        return try {
            val assetManager = context.assets
            val skillDirs = assetManager.list("bundled-skills") ?: return emptyList()
            skillDirs.mapNotNull { skillId ->
                loadSkillFromAsset(skillId)
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun loadSkillFromAsset(skillId: String): SkillManifest? {
        return try {
            val raw = context.assets.open("bundled-skills/$skillId/SKILL.md")
                .bufferedReader().use { it.readText() }
            parseSkillMd(skillId, raw)
        } catch (_: Exception) {
            null
        }
    }

    private fun parseSkillMd(skillId: String, raw: String): SkillManifest? {
        // Parse YAML frontmatter manually (between --- markers)
        val trimmed = raw.trim()
        if (!trimmed.startsWith("---")) return null

        val secondDash = trimmed.indexOf("---", 3)
        if (secondDash < 0) return null

        val frontmatter = trimmed.substring(3, secondDash).trim()
        val body = trimmed.substring(secondDash + 3).trim()

        val fields = mutableMapOf<String, String>()
        for (line in frontmatter.lines()) {
            val colonIdx = line.indexOf(':')
            if (colonIdx > 0) {
                val key = line.substring(0, colonIdx).trim()
                val value = line.substring(colonIdx + 1).trim()
                    .removeSurrounding("\"")
                    .removeSurrounding("'")
                fields[key] = value
            }
        }

        val name = fields["name"] ?: skillId
        val description = fields["description"] ?: ""
        val category = fields["category"] ?: "custom"
        val enabled = fields["enabled"]?.toBooleanStrictOrNull() ?: true

        // Extract title from first # heading if present
        val title = body.lineSequence()
            .map { it.trim() }
            .firstOrNull { it.startsWith("# ") }
            ?.removePrefix("# ")
            ?.trim()
            ?: name.replace("-", " ").replaceFirstChar { it.uppercase() }

        // Infer trigger keywords from name + description + body
        val keywords = inferKeywords(name, description, body)

        return SkillManifest(
            id = skillId,
            title = title,
            description = description,
            instructions = body,
            enabled = enabled,
            category = category,
            triggerKeywords = keywords,
            sourceKind = SkillSourceKind.MARKDOWN_PACKAGE
        )
    }

    private fun inferKeywords(name: String, description: String, body: String): List<String> {
        val combined = "$name $description $body".lowercase()
        val candidates = listOf(
            "pdf", "pptx", "docx", "xlsx", "weather", "screenshot", "browser",
            "web", "fetch", "search", "time", "skill", "mcp", "design",
            "travel", "art", "summarize", "template", "gif", "test",
            "baidu", "meituan", "外卖", "天气", "截图", "浏览器", "搜索",
            "文档", "表格", "演示", "旅行", "设计", "模板", "总结"
        )
        return candidates.filter { combined.contains(it) }
    }
}
