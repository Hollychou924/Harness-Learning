package com.xiaoxiami.app.agent.skills

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.xiaoxiami.app.agent.PlannerToolSchema
import com.xiaoxiami.app.agent.StructuredGoal
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolPolicy
import java.io.File

enum class SkillSourceKind {
    BUNDLED,
    LOCAL_FILE,
    MARKDOWN_PACKAGE
}

data class SkillManifest(
    val id: String,
    val title: String,
    val description: String,
    val instructions: String,
    val enabled: Boolean = true,
    val version: String = "1.0.0",
    val category: String = "general",
    val priority: Int = 0,
    val triggerKeywords: List<String> = emptyList(),
    val strategyChecklist: List<String> = emptyList(),
    val examples: List<String> = emptyList(),
    val preferredTools: List<String> = emptyList(),
    val discouragedTools: List<String> = emptyList(),
    val preferredHostKinds: List<ToolHostKind> = emptyList(),
    val requiredTools: List<String> = emptyList(),
    val requiredHostKinds: List<ToolHostKind> = emptyList(),
    val requiredAllowlistTags: List<String> = emptyList(),
    val sourceKind: SkillSourceKind = SkillSourceKind.BUNDLED
)

data class SkillActivation(
    val manifest: SkillManifest,
    val score: Int,
    val matchedKeywords: List<String> = emptyList(),
    val reason: String = ""
)

interface SkillSource {
    fun load(): List<SkillManifest>
}

object BundledSkillSource : SkillSource {
    override fun load(): List<SkillManifest> = BundledSkills.manifests
}

class LocalJsonSkillSource(
    private val directory: File
) : SkillSource {
    private val gson = Gson()

    override fun load(): List<SkillManifest> {
        if (!directory.exists() || !directory.isDirectory) {
            return emptyList()
        }
        return directory.listFiles()
            .orEmpty()
            .filter { it.isFile && it.extension.equals("json", ignoreCase = true) }
            .sortedBy { it.name }
            .flatMap { file ->
                runCatching {
                    val type = object : TypeToken<List<SkillManifest>>() {}.type
                    val raw = file.readText()
                    if (raw.trimStart().startsWith("[")) {
                        gson.fromJson<List<SkillManifest>>(raw, type)
                    } else {
                        listOf(gson.fromJson(raw, SkillManifest::class.java))
                    }.map { it.copy(sourceKind = SkillSourceKind.LOCAL_FILE) }
                }.getOrElse { emptyList() }
            }
    }
}

class LocalMarkdownSkillSource(
    private val directory: File
) : SkillSource {
    private val gson = Gson()

    override fun load(): List<SkillManifest> {
        if (!directory.exists() || !directory.isDirectory) {
            return emptyList()
        }
        return directory.listFiles()
            .orEmpty()
            .filter { it.isDirectory }
            .sortedBy { it.name }
            .mapNotNull { skillDir ->
                val skillFile = File(skillDir, "SKILL.md")
                if (!skillFile.exists()) return@mapNotNull null
                val raw = runCatching { skillFile.readText() }.getOrElse { return@mapNotNull null }
                val metadata = runCatching {
                    val metadataFile = File(skillDir, "skill.json")
                    if (metadataFile.exists()) {
                        gson.fromJson(metadataFile.readText(), SkillManifest::class.java)
                    } else {
                        null
                    }
                }.getOrNull()
                val title = metadata?.title
                    ?: extractTitle(raw)
                    ?: skillDir.name.replace("-", " ")
                val description = metadata?.description
                    ?: extractDescription(raw)
                    ?: "Imported SKILL.md package"
                val instructions = metadata?.instructions?.ifBlank { raw.trim() } ?: raw.trim()
                val triggerKeywords = metadata?.triggerKeywords?.takeIf { it.isNotEmpty() }
                    ?: inferKeywords(title, description, raw)
                val manifest = (metadata ?: SkillManifest(
                    id = skillDir.name,
                    title = title,
                    description = description,
                    instructions = instructions
                )).copy(
                    id = metadata?.id ?: skillDir.name,
                    title = title,
                    description = description,
                    instructions = instructions,
                    triggerKeywords = triggerKeywords,
                    sourceKind = SkillSourceKind.MARKDOWN_PACKAGE
                )
                manifest
            }
    }

    private fun extractTitle(markdown: String): String? {
        return markdown.lineSequence()
            .map { it.trim() }
            .firstOrNull { it.startsWith("# ") }
            ?.removePrefix("# ")
            ?.trim()
            ?.takeIf { it.isNotBlank() }
    }

    private fun extractDescription(markdown: String): String? {
        return markdown.lineSequence()
            .map { it.trim() }
            .firstOrNull { line ->
                line.isNotBlank() && !line.startsWith("#") && !line.startsWith("```")
            }
            ?.take(180)
    }

    private fun inferKeywords(title: String, description: String, markdown: String): List<String> {
        val raw = listOf(title, description, markdown)
            .joinToString("\n")
            .lowercase()
        val candidates = listOf(
            "通知", "日历", "联系人", "短信", "电话", "位置", "地图", "浏览器", "网页",
            "记忆", "自动化", "远端", "bridge", "browser", "shell", "pdf", "图片", "音乐"
        )
        return candidates.filter { raw.contains(it.lowercase()) }
    }
}

class SkillRegistry(
    private val sources: List<SkillSource> = listOf(BundledSkillSource)
) {
    private val manifests: List<SkillManifest> by lazy {
        val merged = linkedMapOf<String, SkillManifest>()
        sources.flatMap { it.load() }.forEach { manifest ->
            merged[manifest.id] = manifest
        }
        merged.values.toList()
    }

    fun matchingSkills(
        goal: StructuredGoal,
        conversationHistory: List<Pair<String, String>>,
        availableTools: List<PlannerToolSchema>,
        toolPolicy: ToolPolicy,
        limit: Int = 8
    ): List<SkillActivation> {
        val availableToolNames = availableTools.map { it.name }.toSet()
        val availableHostKinds = availableTools.flatMap { tool ->
            tool.routes.map { it.hostKind }
        }.toSet()
        val corpus = buildString {
            append(goal.rawGoal)
            append('\n')
            append(goal.task)
            append('\n')
            append(goal.successCriteria)
            append('\n')
            if (goal.requiredInformation.isNotEmpty()) {
                append(goal.requiredInformation.joinToString("\n"))
                append('\n')
            }
            if (goal.constraints.isNotEmpty()) {
                append(goal.constraints.joinToString("\n"))
                append('\n')
            }
            conversationHistory.forEach { (role, content) ->
                append(role)
                append(':')
                append(content)
                append('\n')
            }
        }.lowercase()

        return manifests.mapNotNull { manifest ->
            if (!manifest.enabled) return@mapNotNull null
            if (!manifest.requiredTools.all { availableToolNames.contains(it) }) return@mapNotNull null
            if (!manifest.requiredHostKinds.all { availableHostKinds.contains(it) }) return@mapNotNull null
            if (!manifest.requiredAllowlistTags.all { tag ->
                    toolPolicy.allowedOptionalTags.contains(tag) ||
                        toolPolicy.allowedOptionalTools.contains(tag)
                }
            ) {
                return@mapNotNull null
            }

            val matchedKeywords = manifest.triggerKeywords.filter { keyword ->
                corpus.contains(keyword.lowercase())
            }
            val preferredToolHits = manifest.preferredTools.count { availableToolNames.contains(it) }
            val preferredHostHits = manifest.preferredHostKinds.count { availableHostKinds.contains(it) }

            val baseScore = manifest.priority * 10
            val matchScore = matchedKeywords.size * 8 + preferredToolHits * 3 + preferredHostHits * 2
            val finalScore = baseScore + matchScore

            if (manifest.triggerKeywords.isNotEmpty() && matchedKeywords.isEmpty() && finalScore < 10) {
                return@mapNotNull null
            }

            val reason = buildString {
                if (matchedKeywords.isNotEmpty()) {
                    append("命中关键词: ")
                    append(matchedKeywords.joinToString(", "))
                }
                if (preferredToolHits > 0) {
                    if (isNotEmpty()) append("；")
                    append("具备偏好工具 ${preferredToolHits} 个")
                }
                if (preferredHostHits > 0) {
                    if (isNotEmpty()) append("；")
                    append("具备偏好 host ${preferredHostHits} 个")
                }
                if (isEmpty()) {
                    append("满足依赖条件，可作为当前任务的策略包")
                }
            }

            SkillActivation(
                manifest = manifest,
                score = finalScore,
                matchedKeywords = matchedKeywords,
                reason = reason
            )
        }
            .sortedWith(
                compareByDescending<SkillActivation> { it.score }
                    .thenBy { it.manifest.id }
            )
            .take(limit)
    }
}
