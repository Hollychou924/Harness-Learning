package com.xiaoxiami.app.agent

/**
 * 延迟工具注册表。
 *
 * 当工具数量超过 [threshold] 时启用延迟模式：
 * - 只暴露核心工具 + tool_search 虚拟工具给 LLM
 * - Agent 可通过 tool_search 查找并激活更多工具
 * - 激活的工具会在后续迭代中暴露给 LLM
 */
class DeferredToolRegistry(
    private val threshold: Int = 30
) {
    /** 被动态激活的工具名集合 */
    private val activatedTools = mutableSetOf<String>()

    /**
     * 判断是否应该启用延迟模式。
     */
    fun shouldDefer(totalToolCount: Int): Boolean = totalToolCount > threshold

    /**
     * 对全量工具列表进行模糊搜索。
     * @return 匹配的工具名及其描述
     */
    fun search(
        query: String,
        allTools: List<PlannerToolSchema>,
        maxResults: Int = 5
    ): List<Pair<String, String>> {
        val q = query.lowercase()
        return allTools
            .map { tool ->
                val nameScore = if (tool.name.lowercase().contains(q)) 3 else 0
                val descScore = if (tool.description.lowercase().contains(q)) 2 else 0
                val capScore = if (tool.capabilities.any { it.lowercase().contains(q) }) 1 else 0
                tool to (nameScore + descScore + capScore)
            }
            .filter { it.second > 0 }
            .sortedByDescending { it.second }
            .take(maxResults)
            .map { it.first.name to it.first.description }
    }

    /**
     * 将搜索结果中的工具激活，使其在下一轮迭代中暴露给 LLM。
     */
    fun activate(toolNames: List<String>) {
        activatedTools.addAll(toolNames)
    }

    /**
     * 获取当前已激活的工具名集合。
     */
    fun getActivatedTools(): Set<String> = activatedTools.toSet()

    fun reset() {
        activatedTools.clear()
    }

    companion object {
        val TOOL_SEARCH_SCHEMA = PlannerToolSchema(
            name = "tool_search",
            description = "搜索可用工具。当你需要的工具没有在当前列表中时，用此工具查找。参数：query(搜索关键词)。",
            family = ToolFamily.GENERAL,
            defaultHostKind = ToolHostKind.LOCAL_ANDROID,
            routes = emptyList(),
            capabilities = listOf("tool_discovery"),
            riskLevel = ToolRiskLevel.LOW,
            availability = ToolAvailability.CORE,
            inputSchema = listOf(
                ToolParameterSchema(
                    name = "query",
                    type = ToolValueType.STRING,
                    description = "搜索关键词，如：日历、浏览器、文件",
                    required = true
                )
            )
        )
    }
}
