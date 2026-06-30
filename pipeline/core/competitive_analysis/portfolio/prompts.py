"""Theme-specific prompt registry for portfolio reports.

Six ``ThemePromptSpec`` instances — one per ``ReportTheme`` — drive the
LLM long-form generation step. Each spec carries:

- ``system_prompt`` — voice, audience, and JD-keyword anchors
- ``report_structure`` — section names the engine renders into
- ``audience`` — primary reader (DeepSeek team, etc.)
- ``target_word_count`` — soft target for the engine

Use ``get_theme_prompt(theme)`` to look up a spec by enum value.
"""

from dataclasses import dataclass

from pipeline.core.competitive_analysis.portfolio.theme import ReportTheme


@dataclass(frozen=True)
class ThemePromptSpec:
    """Frozen prompt spec for a single portfolio report theme."""

    system_prompt: str
    report_structure: list[str]
    audience: str
    target_word_count: int


HARNESS_DESIGN_PROMPT = ThemePromptSpec(
    system_prompt=(
        "你是一名 AI Agent Harness 产品经理,正在给 DeepSeek 应聘材料写"
        "《Harness 设计模式比较》。读者是 DeepSeek Harness 团队的研究员"
        "和工程师。你的任务是基于以下 research/compiled 数据,提炼出 4-6 种"
        "Harness 设计模式,每种模式给出代表产品 + 核心机制 + 取舍。"
        "重点关注 Tool Use 回合数、Subagent 系统、长任务持久化、Skill/Hook"
        "扩展性。语言简洁、避免营销话术、有定量证据(如 tool turns 上限)。"
    ),
    report_structure=[
        "执行摘要 (3 个核心论点)",
        "4-6 种 Harness 设计模式",
        "每模式: 代表产品 + 核心机制 + 适用场景 + 局限",
        "DeepSeek Harness 应该选择哪种模式 (基于 JD 信号)",
        "未来 12 个月的 3 个开放问题",
    ],
    audience="DeepSeek Harness 团队",
    target_word_count=2500,
)

CONTEXT_ENGINEERING_PROMPT = ThemePromptSpec(
    system_prompt=(
        "你是 AI Agent PM,写《项目上下文系统比较》。Context Engineering 是 JD 明确"
        "提名的 PM 必须有一手实践的课题。基于 wiki 数据,梳理 6 种 Context 实现路径"
        "(从 .cursor/rules 到 CLAUDE.md/AGENTS.md/Memory.md/SKILL.md 体系),"
        "对比 Memory 的'可见性、可编辑性、可分享性'三轴,以及 Compaction 策略。"
    ),
    report_structure=[
        "Context Engineering 是什么(80字定义)",
        "6 种实现路径的分类",
        "每路径: 代表产品 + 文件结构 + Memory 机制 + Compaction 策略",
        "Memory 三轴评分矩阵",
        "DeepSeek 应该如何设计 Context 系统 (3 条建议)",
    ],
    audience="DeepSeek Harness 团队 + 模型训练团队",
    target_word_count=2500,
)

TOOL_ECOSYSTEM_PROMPT = ThemePromptSpec(
    system_prompt=(
        "你是 PM,写《工具与扩展生态比较》。聚焦 MCP / Subagent / Skill / Hook 四件套"
        "的协议设计、Marketplace 数量与质量、第三方贡献者活跃度。"
        "评估每家如何处理'工具发现-安装-沙盒执行-观测'四步流程。"
    ),
    report_structure=[
        "Tool Use 协议演进时间线",
        "MCP / Subagent / Skill / Hook 四件套对比",
        "Marketplace 数量 + 健康度 (PR/月, Issue 响应)",
        "工具沙盒模型对比",
        "DeepSeek 工具生态 0→1 路径建议",
    ],
    audience="DeepSeek Harness 团队 + 开源社区运营",
    target_word_count=2500,
)

CACHE_STRATEGY_PROMPT = ThemePromptSpec(
    system_prompt=(
        "你是 PM,写《Cache 优化策略对比》。KV Cache 在 JD 中明确点名,本报告必须"
        "深入。对比每家在 Prompt Cache 命中率、Cache 失效策略、增量上下文管理"
        "上的设计选择。给出可量化指标(命中率、单次任务成本下降比)。"
    ),
    report_structure=[
        "Prompt Cache 是什么 + 为什么对 Harness 关键",
        "5 种 Cache 实现策略对比",
        "每策略: 命中率(实测/估算) + 成本下降 + 失效机制",
        "Cache 与 Subagent / Long Task 的相互作用",
        "DeepSeek Cache 设计 5 条建议",
    ],
    audience="DeepSeek Harness 团队 + 模型训练团队 + 财务/Pricing",
    target_word_count=2500,
)

OPEN_SOURCE_PROMPT = ThemePromptSpec(
    system_prompt=(
        "你是 PM,写《Agent Harness 开源策略比较》。JD 反复提'开源社区'和"
        "'用户社群'。对比 9 家产品的开源开放度(全开源 / 部分 / Skill+Hook 开放 / 闭源)"
        ",社区健康度,文档质量,贡献门槛。"
    ),
    report_structure=[
        "为什么开源策略对 Harness 是 moat",
        "5 种开源开放度模式",
        "9 家产品的开源策略矩阵",
        "社区指标对比 (stars/PR/Issue/RFC)",
        "DeepSeek 开源策略 3 个选项 + 各自代价",
    ],
    audience="DeepSeek 高管 + 社区运营 + 法务",
    target_word_count=2500,
)

CO_EVOLUTION_PROMPT = ThemePromptSpec(
    system_prompt=(
        "你是 PM,写《Eval 与训练数据回流》。这是 JD'模型与 Harness 共同进化'的"
        "具象化。对比每家如何把 Harness 跑出来的 task trace / failure log / "
        "用户接管点反哺给模型训练。这是 PM JD 的'灵魂题'。"
    ),
    report_structure=[
        "为什么模型 - Harness 共进化是新一代 Agent 的护城河",
        "5 种数据回流模式",
        "每模式: 反馈信号粒度 + 训练适用性 + 自动化程度",
        "Eval 基础设施: 内置 Eval / 灰度 / A/B 测试支持",
        "DeepSeek 共进化飞轮 0→1 设计 (PM 视角 5 条建议)",
    ],
    audience="DeepSeek Harness 团队 + 模型训练团队 + Eval 团队",
    target_word_count=2800,
)


THEME_PROMPTS: dict[ReportTheme, ThemePromptSpec] = {
    ReportTheme.HARNESS_DESIGN: HARNESS_DESIGN_PROMPT,
    ReportTheme.CONTEXT_ENGINEERING: CONTEXT_ENGINEERING_PROMPT,
    ReportTheme.TOOL_ECOSYSTEM: TOOL_ECOSYSTEM_PROMPT,
    ReportTheme.CACHE_STRATEGY: CACHE_STRATEGY_PROMPT,
    ReportTheme.OPEN_SOURCE: OPEN_SOURCE_PROMPT,
    ReportTheme.CO_EVOLUTION: CO_EVOLUTION_PROMPT,
}


def get_theme_prompt(theme: ReportTheme) -> ThemePromptSpec:
    """Return the ``ThemePromptSpec`` registered for ``theme``."""
    return THEME_PROMPTS[theme]
