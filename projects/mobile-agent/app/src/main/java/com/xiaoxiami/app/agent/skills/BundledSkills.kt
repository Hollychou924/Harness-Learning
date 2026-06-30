package com.xiaoxiami.app.agent.skills

import com.xiaoxiami.app.agent.ToolHostKind

object BundledSkills {
    val manifests = listOf(
        SkillManifest(
            id = "notification_triage",
            title = "通知分拣",
            description = "读取通知，按紧急程度分类，决定是摘要、提醒还是起草回复。",
            instructions = "先读通知，再结合 memory、calendar、communication tools 判断优先级；没有必要时不要过度打扰用户。",
            category = "productivity",
            priority = 9,
            triggerKeywords = listOf("通知", "消息", "提醒", "未读", "notification"),
            strategyChecklist = listOf(
                "先读取最近通知，不要直接猜测通知内容",
                "识别是否和日程、联系人或短信有关",
                "若用户要自动化，优先走 rules，而不是手工重复操作"
            ),
            preferredTools = listOf("read_notifications", "read_calendar", "search_contacts", "draft_sms")
        ),
        SkillManifest(
            id = "calendar_assistant",
            title = "日程助手",
            description = "结合日历和联系人上下文，安全地查看、新建或修改日程。",
            instructions = "涉及新增或修改日程时，先读日历检查冲突，再决定是否写入。",
            category = "productivity",
            priority = 8,
            triggerKeywords = listOf("日程", "会议", "安排", "提醒", "calendar"),
            strategyChecklist = listOf(
                "先读现有日程再写入",
                "涉及联系人或地点时优先补全上下文",
                "高风险写操作要让 runtime 走审批"
            ),
            preferredTools = listOf("read_calendar", "create_calendar_event", "update_calendar_event", "search_contacts")
        ),
        SkillManifest(
            id = "memory_curator",
            title = "记忆管理",
            description = "通过搜索、存储和遗忘操作，有策略地维护长期记忆质量。",
            instructions = "只有当用户明确表示要记住、纠正或忘记信息时，才操作记忆库。",
            category = "memory",
            priority = 7,
            triggerKeywords = listOf("记住", "别忘了", "忘掉", "偏好", "习惯", "memory"),
            strategyChecklist = listOf(
                "先查重，避免重复记忆",
                "优先存事实、偏好、长期约束，不要存一次性噪音",
                "忘记时要尽量精确定位要删除的事实"
            ),
            preferredTools = listOf("memory_search", "memory_store", "memory_forget")
        ),
        SkillManifest(
            id = "document_reader",
            title = "文档阅读",
            description = "处理 PDF、图片和网页文档，先提取客观内容再回答问题。",
            instructions = "文档型任务先拿客观 observation，再做总结或提取，不要直接编造内容。",
            category = "document",
            priority = 6,
            triggerKeywords = listOf("pdf", "文档", "合同", "图片", "网页", "文章"),
            strategyChecklist = listOf(
                "PDF 优先用 pdf_read",
                "图片元信息优先用 image_info，需要理解内容时再用 analyze_images",
                "网页正文优先用 web_fetch，而不是凭 URL 猜内容"
            ),
            preferredTools = listOf("pdf_read", "image_info", "analyze_images", "web_fetch")
        ),
        SkillManifest(
            id = "device_operator",
            title = "设备控制",
            description = "先查看手机状态和前台应用，再执行亮度、音量等轻量设备操作。",
            instructions = "先确认当前设备状态和前台上下文，再决定是否执行设备动作。",
            category = "device",
            priority = 6,
            triggerKeywords = listOf("手机", "设备", "蓝牙", "wifi", "亮度", "音量", "手电筒"),
            strategyChecklist = listOf(
                "读状态优先于改状态",
                "settings_redirect 工具只能拉起页面，不是静默控制",
                "高风险设备动作要让 runtime 控制审批"
            ),
            preferredTools = listOf("get_foreground_app", "query_battery_status", "query_network_status", "set_stream_volume"),
            preferredHostKinds = listOf(ToolHostKind.LOCAL_ANDROID, ToolHostKind.REMOTE_ANDROID)
        ),
        SkillManifest(
            id = "communication_operator",
            title = "通信助手",
            description = "处理短信、电话和通知回复，先查联系人和上下文再操作。",
            instructions = "通信任务先查联系人和上下文，再决定拨号、发短信还是只出草稿。",
            category = "communication",
            priority = 7,
            triggerKeywords = listOf("短信", "电话", "联系", "回复", "发给", "message", "call"),
            strategyChecklist = listOf(
                "先确认联系人身份和号码",
                "能出草稿就不要直接发送",
                "高风险发送/拨号动作依赖审批"
            ),
            preferredTools = listOf("search_contacts", "get_contact_detail", "draft_sms", "send_sms_confirmed", "place_call_confirmed")
        ),
        SkillManifest(
            id = "automation_designer",
            title = "自动化设计",
            description = "把用户的重复需求转化为定时任务、Cron 或通知规则，安全执行。",
            instructions = "自动化类需求优先考虑 schedule / cron / rules，不要手工描述一遍就结束。",
            category = "automation",
            priority = 8,
            triggerKeywords = listOf("自动", "定时", "每天", "每周", "提醒我", "规则", "cron"),
            strategyChecklist = listOf(
                "一次性延后任务用 schedule",
                "周期任务用 cron",
                "事件触发任务用 rules",
                "默认优先 confirm，而不是 auto"
            ),
            preferredTools = listOf("schedule", "cron_add", "rules_add", "rules_preview", "rules_runs")
        ),
        SkillManifest(
            id = "remote_bridge_operator",
            title = "跨端桥接",
            description = "查看已配对节点，选择远端路由，处理跨设备任务执行。",
            instructions = "跨端任务先看 bridge 状态和可用路由，再决定是否走 remote_android。",
            category = "remote",
            priority = 9,
            triggerKeywords = listOf("远端", "另一台手机", "跨端", "bridge", "remote"),
            strategyChecklist = listOf(
                "先检查 bridge 连接和已配对设备",
                "优先使用逻辑工具的 remote_android 路由，而不是低级桥接调用",
                "如果远端离线，及时回退到本地或告诉用户"
            ),
            preferredTools = listOf("remote_android_bridge_status", "remote_android_devices", "remote_android_request_status"),
            preferredHostKinds = listOf(ToolHostKind.REMOTE_ANDROID),
            requiredTools = listOf("remote_android_bridge_status", "remote_android_devices", "remote_android_request_status"),
            requiredHostKinds = listOf(ToolHostKind.REMOTE_ANDROID),
            requiredAllowlistTags = listOf("remote_android")
        ),
        SkillManifest(
            id = "research_fetcher",
            title = "联网搜索",
            description = "通过搜索引擎、网页抓取和 HTTP 请求获取最新外部信息。",
            instructions = "涉及时效性外部信息时，先抓事实，再整理答案。",
            category = "knowledge",
            priority = 7,
            triggerKeywords = listOf("最新", "联网", "查一下", "官网", "接口", "api", "http"),
            strategyChecklist = listOf(
                "搜索适合找候选来源，fetch 适合读正文，http_request 适合结构化接口",
                "不要把 web_search 当成万能浏览器",
                "先看 observation，再决定是否继续抓取"
            ),
            preferredTools = listOf("web_search", "web_fetch", "http_request")
        ),
        SkillManifest(
            id = "browser_operator",
            title = "浏览器操作",
            description = "使用浏览器工具打开页面、提取内容，或进行多步网页交互。",
            instructions = "如果目标是把页面直接展示给用户，优先用 browser_open；如果目标是从网页拿客观内容，优先用 browser_extract；如果任务需要多步浏览器交互，先建 browser_session_create 会话，再用 navigate / snapshot / query / click / fill / wait / extract_page 这一组工具。",
            category = "browser",
            priority = 6,
            triggerKeywords = listOf("浏览器", "网页", "打开页面", "网站", "browser"),
            strategyChecklist = listOf(
                "展示页面和读取页面是两类动作，不要混用",
                "抽取网页内容优先 browser_extract，其次 web_fetch",
                "多步网页任务优先 browser_runtime，会话内先观察 DOM 再点击或填写",
                "需要跳系统浏览器时，回答尽量简短避免 App 切后台断流"
            ),
            preferredTools = listOf(
                "browser_open",
                "browser_extract",
                "browser_session_create",
                "browser_navigate",
                "browser_dom_snapshot",
                "browser_query_elements",
                "browser_click",
                "browser_fill_form",
                "browser_wait_for",
                "browser_extract_page"
            ),
            preferredHostKinds = listOf(ToolHostKind.LOCAL_ANDROID, ToolHostKind.CLOUD_SERVICE)
        ),
        SkillManifest(
            id = "data_processor",
            title = "数据处理",
            description = "在本地 Alpine Linux 环境中运行 Python/Node.js 脚本，处理和分析 CSV/JSON/文本数据。",
            instructions = "数据处理任务先获取数据源（剪贴板、文件），再编写脚本写入 /scripts 目录，然后在 Alpine 环境中执行。脚本可保存为技能复用。",
            category = "development",
            priority = 7,
            triggerKeywords = listOf(
                "csv", "数据", "统计", "分析", "均值", "最大值", "最小值", "求和",
                "json", "处理数据", "python脚本", "数据处理", "表格", "计算",
                "排序", "过滤", "聚合", "转换格式", "data", "analyze", "parse"
            ),
            strategyChecklist = listOf(
                "先获取数据源：read_clipboard 读剪贴板，file_read 读文件",
                "用 shell_write_script 写入 Python/Node.js 脚本到 /scripts",
                "用 shell_exec 执行脚本并获取结果",
                "如果缺少 Python 库，用 shell_install_package 安装",
                "向用户展示结果，询问是否保存为可复用技能"
            ),
            preferredTools = listOf(
                "shell_exec", "shell_write_script", "shell_install_package",
                "read_clipboard", "file_read", "file_write"
            ),
            requiredAllowlistTags = listOf("shell_runtime")
        ),
        SkillManifest(
            id = "shell_operations",
            title = "Linux 终端",
            description = "在内置 Alpine Linux 环境中执行 Shell 命令、编写脚本、安装工具包。手机变移动开发终端。",
            instructions = "Shell 任务先检查 Alpine 环境是否就绪，再执行命令或编写脚本。需要额外工具时通过 apk 安装。",
            category = "development",
            priority = 6,
            triggerKeywords = listOf(
                "shell", "终端", "命令行", "linux", "alpine", "脚本",
                "运行命令", "执行", "bash", "python", "node", "npm", "pip",
                "terminal", "command", "script", "编程", "代码"
            ),
            strategyChecklist = listOf(
                "确认 Alpine 环境已就绪（shell_exec 会自动检查）",
                "简单命令直接用 shell_exec",
                "多行脚本用 shell_write_script 写入再执行",
                "需要额外包时用 shell_install_package",
                "注意命令超时限制（默认 20 秒，最大 120 秒）"
            ),
            preferredTools = listOf("shell_exec", "shell_write_script", "shell_install_package"),
            requiredAllowlistTags = listOf("shell_runtime")
        )
    )
}
