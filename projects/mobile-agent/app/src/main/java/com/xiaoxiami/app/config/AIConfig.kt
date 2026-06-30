package com.xiaoxiami.app.config

/**
 * AI 模型与 Prompt 集中配置中心
 * 方便后续维护与 A/B Test
 */
object AIConfig {

    // ==================== Keys & Models ====================
    
    // Updated Key
    const val GEMINI_API_KEY: String = "REDACTED-GEMINI-KEY"

    // Gemini Key Pool (Only use the new key)
    private val GEMINI_KEY_POOL = listOf(
        GEMINI_API_KEY
    )

    private var geminiKeyCache: String? = null

    fun getGeminiKey(context: android.content.Context? = null): String {
        // 1. Try Cache
        if (!geminiKeyCache.isNullOrBlank()) return geminiKeyCache!!
        
        // 2. Try SharedPreferences (if context provided)
        if (context != null) {
            val prefs = context.getSharedPreferences("api_keys", android.content.Context.MODE_PRIVATE)
            val saved = prefs.getString("gemini_key", null)
            if (!saved.isNullOrBlank()) {
                geminiKeyCache = saved
                return saved
            }
        }

        // 3. Try BuildConfig / Pool
        return if (GEMINI_KEY_POOL.isNotEmpty()) {
            GEMINI_KEY_POOL.random()
        } else {
            GEMINI_API_KEY
        }
    }

    fun setGeminiKey(context: android.content.Context, key: String) {
        geminiKeyCache = key
        val prefs = context.getSharedPreferences("api_keys", android.content.Context.MODE_PRIVATE)
        prefs.edit().putString("gemini_key", key).apply()
    }

    fun loadGeminiKey(context: android.content.Context) {
        val prefs = context.getSharedPreferences("api_keys", android.content.Context.MODE_PRIVATE)
        val saved = prefs.getString("gemini_key", null)
        if (!saved.isNullOrBlank()) {
            geminiKeyCache = saved
        }
    }

    // Doubao (Volcengine) - 🆕 已开通联网搜索
    const val DOUBAO_API_KEY = "REDACTED-DOUBAO-KEY"
    const val DOUBAO_MODEL_ID = "doubao-seed-1-6-flash-250828" // Endpoint ID or Model ID
    const val DOUBAO_MODEL_IMAGE = "doubao-seedream-4-5-251128" // Text-to-Image Model ID
    const val DOUBAO_MODEL_IMAGE_BACKUP = "doubao-seedream-4-0-250828" // Backup Model ID
    const val DOUBAO_MODEL_VISION = "doubao-seed-1-6-vision-250815" // Vision Model ID
    const val DOUBAO_MODEL_CODE = "doubao-seed-code-preview-251028" // Code Generation Model ID
    const val DOUBAO_IMAGE_KEY = "REDACTED-DOUBAO-KEY"
    const val DOUBAO_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    const val DOUBAO_IMAGE_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations"
    // 🆕 Responses API 端点（支持联网搜索、图像处理等内置工具）
    const val DOUBAO_RESPONSES_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/responses"
    
    // Doubao 2.0 (Volcengine - 使用 Responses API)
    const val DOUBAO_2_API_KEY = "REDACTED-DOUBAO-KEY"
    const val DOUBAO_2_MODEL_ID = "doubao-seed-2-0-pro-260215"
    
    // 🆕 Doubao 1.8 使用 Responses API（支持联网搜索）
    // 模型 ID: doubao-seed-1-8-251228 (Seed 1.8 251228 版本)
    const val DOUBAO_RESPONSES_MODEL_ID = "doubao-seed-1-8-251228"
    
    // 🆕 Doubao Embedding API 配置
    const val DOUBAO_EMBEDDING_API_KEY = "REDACTED-DOUBAO-KEY"
    const val DOUBAO_EMBEDDING_MODEL_ID = "doubao-embedding-vision-251215"
    const val DOUBAO_EMBEDDING_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal"

    val BAIDU_BCE_API_KEY: String = "REDACTED-BAIDU-KEY" // Updated Key

    // Mify (GPT-4o / mimo-v2-flash)
    const val MIFY_API_KEY = "REDACTED-MIFY-KEY"
    const val MIFY_ENDPOINT = "https://mify.p.xiaomi.com/v1/chat/completions"
    const val MIFY_ENDPOINT_HTTP = "http://mify.p.xiaomi.com/v1/chat/completions"
    const val MIFY_ENDPOINT_BACKUP = "https://api.mify.io/v1/chat/completions"
    const val MIFY_MODEL_MIMO_V2_FLASH = "mimo-v2-flash"

    // ==================== Sleep Mode Prompts ====================

    const val DEFAULT_ASSET_COVER: String = "file:///android_asset/pic/PIC.png"
    const val DEFAULT_COVER_URL: String = "https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=Warm%20sunlit%20executive%20workspace%20with%20wood%20desk%2C%20laptop%2C%20vintage%20clock%2C%20globe%2C%20hourglass%2C%20coffee%20cup%2C%20papers%20and%20gold%20pen%2C%20city%20skyline%20outside%20window%2C%20cinematic%20lighting%2C%20photorealistic%2C%20high%20detail%2C%20soft%20depth%20of%20field&image_size=landscape_16_9"

    // 智能模型：用于复杂的通用内容生成
    const val MODEL_SMART = "gemini-3-pro-preview"
    const val MODEL_FLASH = "gemini-3-flash-preview"
    const val MODEL_FLASH_2 = "gemini-2.0-flash-exp"  // 实验性 Flash 模型

    // ==================== Demo Configuration ====================
    /**
     * Demo 模式开关
     * true: 降低/绕过部分严格过滤逻辑 (如 Topic 聚合阈值)，保证演示效果
     * false: 生产环境严格逻辑
     */
    const val DEMO_MODE = true

    // ==================== Prompts ====================

    // REMOVED: PROMPT_SOURCE_PARSING_IMAGE (视觉记忆截屏分析 prompt) - 已移除
    // REMOVED: PROMPT_SOURCE_PARSING_AUDIO (听觉记忆音频场景分析 prompt) - 已移除

    val PROMPT_GENUI_STREAMING = """
    val PROMPT_GENUI_STREAMING = “””
        你是「顶级移动端信息网页总编 + 前端架构师 + 数据可视化设计师」。
        目标：把我提供的【报告正文】转成一个“可本地运行、移动端高端大气、图表并茂、可交互”的完整网页，并且必须支持【流式实时输出】，让客户端可以边接收边渲染，像“灵光App”那样即时看到页面逐步成型。

        ========================
        0) 绝对硬约束（必须遵守）
        ========================
        A. 你必须以 NDJSON 流式事件输出：每一行都是一个独立 JSON 对象（单行、无换行、无 Markdown、无代码块围栏）。
        B. 禁止一次性输出完整 HTML 再结束；必须先输出可渲染的“页面骨架”，然后分段补齐内容与交互。
        C. 输出必须是“追加式（append-only）”：后续事件只能追加/补齐，不允许要求客户端回滚或删除已渲染内容。
        D. 稳定性优先：宁可少而精、结构清晰，也不要花哨炫技导致不稳定。
        E. 任何时候（从第一个事件起）客户端都能渲染出一个“像样的页面”，并随着事件持续变好。

        ========================
        1) 输出协议（NDJSON Event Schema）
        ========================
        每行 JSON 必须包含字段：
        - "type": 事件类型（见下）
        - "seq": 从 1 递增的整数（严格递增，不跳号）
        - "ts": 生成时刻的 ISO 字符串（可用占位，如 "2025-12-28T00:00:00Z"）
        - "payload": 事件内容对象（不同 type 不同结构）

        允许的 type（只能用这些）：
        1) "meta"
        2) "bootstrap_html"
        3) "append_head"
        4) "append_css"
        5) "append_section"
        6) "append_chart"
        7) "append_script"
        8) "finalize"
        9) "error"

        ========================
        2) 客户端渲染约定（你需要按这个来组织输出）
        ========================
        - 客户端会在收到 "bootstrap_html" 后立刻把 HTML 写入 WebView/iframe 并显示。
        - 后续：
          - "append_head": 追加到 <head>（如 meta、title、少量结构化数据）
          - "append_css": 追加到一个 <style id="app-css"> 的末尾
          - "append_section": 把 HTML 片段追加到 <main id="app"> 末尾
          - "append_chart": 生成可视化（SVG/Canvas/纯HTML），并以 HTML 片段形式插入（或给出 chart_spec 由你同时输出对应渲染脚本）
          - "append_script": 追加到 <script id="app-js"> 的末尾（必须幂等：重复执行不炸）
        - 所有 append_* 的内容必须是“可直接拼接”的字符串，不能包含未闭合标签导致 DOM 崩坏。

        ========================
        3) 网页成品质量要求（高端移动端网页）
        ========================
        风格：
        - 质感参考：Apple News / 苹果官网 / 顶级投研报告的克制美学
        - 低饱和、留白充足、强层级弱装饰、字号与间距全部用 rem
        - 可读性：正文行高 >= 1.75，段落宽松，最大内容宽度 720px 居中
        
        **字体选择（P0级 - 避免AI流水线美学）**：
        ❌ 严禁使用通用字体：Inter、Roboto、Open Sans、Lato、Arial、系统默认字体
        
        ✅ 必须从以下独特字体中选择（通过Google Fonts加载）：
        - **代码美学**：JetBrains Mono、Fira Code、Space Grotesk
        - **编辑风格**：Playfair Display、Crimson Pro、Newsreader
        - **技术感**：IBM Plex Sans、IBM Plex Serif、Source Sans 3
        - **独特性**：Bricolage Grotesque、Inter Tight、Manrope
        - **中文字体**：Noto Sans SC、Noto Serif SC（配合英文字体使用）
        
        **字体配对原则（必须遵守）**：
        - 高对比度 = 有趣：标题字体 + 正文字体要有明显差异
        - 推荐组合：衬线标题(Playfair Display/Crimson Pro) + 等宽正文(JetBrains Mono)
        - 或：几何无衬线标题(Space Grotesk) + 人文无衬线正文(Source Sans 3)
        - 使用极端字重：100/200 vs 800/900，而不是400 vs 600
        - 尺寸跳跃：标题 vs 正文至少3倍以上（如：标题3rem vs 正文1rem）
        
        **色彩系统（避免陈词滥调）**：
        ❌ 禁止：白底紫色渐变、蓝色渐变、常见的AI生成配色
        ✅ 推荐：
        - 从IDE主题汲取灵感（如：Monokai、Dracula、Nord、Tokyo Night）
        - 或从文化美学汲取灵感（如：日式侘寂、北欧简约、赛博朋克）
        - 使用主导色 + 鲜明强调色，而不是平均分布
        - 背景不用纯色：叠加CSS渐变、几何图案、或符合美学的情境效果
        
        **动效原则（高影响力时刻）**：
        - 一个精心编排的页面加载（带交错显示）比分散的微交互更令人愉悦
        - 关注进入动画、数据可视化动画、交互反馈动画
        - 使用CSS transition和animation，避免过度依赖JavaScript

        结构（必须具备，并按顺序逐步流式输出）：
        1) 顶部 Hero（标题 + 一句话定位 + 3-5 条“核心结论”）
        2) “一屏读懂”区（把报告最关键的观点/结论/数据浓缩成可扫读模块）
        3) 目录（可折叠，点击平滑滚动）
        4) 正文重构（不是原文平铺）：
           - 关键观点（What）
           - 论据与数据（Evidence）
           - 推理链路（Why）
           - 结论与影响（So what）
           - 风险与不确定性（Risk）
        5) 图表并茂（至少 3 个图/表/时间线/对比卡，按内容选择）
        6) 交互（克制但好用）：
           - 目录跳转
           - “展开/收起证据细节”
           - “一键切换视角”（如：结论/证据/数据）
           - 段落级引用标记（非外链也可，用脚注区块）
        7) 结尾：关键要点回顾 + 可选行动建议（如果报告适合）

        图表要求（不依赖第三方库）：
        - 优先 SVG（最稳、可内嵌、可控）
        - 可选 Canvas（必须给出渲染脚本）
        - 图表必须“信息清晰 > 视觉冲击”，灰阶为主，强调色极少量使用
        - 常用图表类型：对比条形图、趋势折线图、瀑布/分解结构示意、时间线、要点矩阵表

        ========================
        4) 内容编辑要求（把报告变成“可读的产品级网页”）
        ========================
        你必须“编辑级重构”报告，而不是简单摘要：
        - 提取：最核心的观点、论据、结论、知识点、关键数据
        - 组织：层级清晰、可扫读、先结论后证据
        - 控制信息密度：每屏都有“主结论”，细节默认折叠
        - 对数据/结论不确定的地方要明确标注“不确定/可能/缺乏证据”
        - 如果原文缺少数据但存在量化描述，请用“区间/量级/相对变化”表达，不要编造具体数字

        ========================
        5) 流式输出策略（非常关键：保证"边出边像样"）
        ========================
        你必须按以下顺序输出事件：
        Step 1: 先发 "meta"：告诉客户端将生成哪些模块（目录、章节、图表数量、交互点）
        Step 2: 立刻发 "bootstrap_html"：
          - 输出一个可运行的最小完整 HTML（含 <head>、<body>、<main id="app">、<style id="app-css">、<script id="app-js">）
          - 页面先显示一个居中的优雅加载动画（小球融合动画），不使用骨架屏
          - 加载动画必须垂直水平居中，背景色与最终页面主题色协调
        Step 3: 逐步补齐：
          - append_css：先把基础排版与卡片系统做完
          - append_section：先填 Hero / 一屏读懂 / 目录（内容出现时加载动画自动消失）
          - append_section：再按章节逐段输出正文（每次输出一个完整 section，不要一次输出太多）
          - append_chart：每个图表单独事件输出（并立即可见）
          - append_script：交互脚本分段输出（并保证幂等）
        Step 4: finalize：输出收尾（校验点/完成标记）

        每个 append_section 建议长度：
        - 150~350 行 HTML 以内（不要超长，避免流式卡顿）
        - 每个 section 自带标题、摘要、内容块、必要的可折叠细节

        ========================
        6) 事件 payload 规范（必须严格遵守）
        ========================
        meta.payload:
        {
          "page_title": "...",
          "subtitle": "...",
          "sections": [{"id":"sec-1","title":"..."}, ...],
          "charts": [{"id":"chart-1","title":"...","type":"svg_bar|svg_line|timeline|table|diagram"}, ...],
          "interactions": ["toc_scroll","toggle_details","view_switcher"],
          "estimated_total_events": 30-80
        }

        bootstrap_html.payload:
        {
          "html": "<!doctype html>...（一个可直接运行的完整HTML，注意字符串里要转义必要字符）"
        }
        
        **字体加载示例（必须包含在bootstrap_html的<head>中）**：
        ```html
        <!-- 选择1: 代码美学风格 -->
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;700;900&family=JetBrains+Mono:wght@400;700&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --font-heading: 'Space Grotesk', sans-serif;
            --font-body: 'JetBrains Mono', monospace;
            --font-chinese: 'Noto Sans SC', sans-serif;
          }
          h1, h2, h3 { font-family: var(--font-heading), var(--font-chinese); font-weight: 900; }
          body, p { font-family: var(--font-body), var(--font-chinese); font-weight: 400; }
        </style>
        
        <!-- 选择2: 编辑风格 -->
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Source+Sans+3:wght@300;400;600&family=Noto+Serif+SC:wght@400;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --font-heading: 'Playfair Display', serif;
            --font-body: 'Source Sans 3', sans-serif;
            --font-chinese: 'Noto Serif SC', serif;
          }
          h1, h2, h3 { font-family: var(--font-heading), var(--font-chinese); font-weight: 900; }
          body, p { font-family: var(--font-body), 'Noto Sans SC', sans-serif; font-weight: 300; }
        </style>
        
        <!-- 选择3: 技术感风格 -->
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@200;400;700&family=IBM+Plex+Mono:wght@400;600&family=Noto+Sans+SC:wght@300;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --font-heading: 'IBM Plex Sans', sans-serif;
            --font-body: 'IBM Plex Sans', sans-serif;
            --font-code: 'IBM Plex Mono', monospace;
            --font-chinese: 'Noto Sans SC', sans-serif;
          }
          h1, h2, h3 { font-family: var(--font-heading), var(--font-chinese); font-weight: 700; }
          body, p { font-family: var(--font-body), var(--font-chinese); font-weight: 200; }
          code, .data { font-family: var(--font-code), var(--font-chinese); }
        </style>
        ```
        
        **根据报告主题选择字体风格**：
        - 科技/AI/编程类 → 代码美学风格（Space Grotesk + JetBrains Mono）
        - 文化/艺术/人文类 → 编辑风格（Playfair Display + Source Sans 3）
        - 商业/数据/分析类 → 技术感风格（IBM Plex系列）

        **加载动画示例（必须包含在bootstrap_html的<body>中，放在<main id="app">之前）**：
        
        在 bootstrap_html 中，必须在 <body> 开头添加以下加载动画结构：
        
        ```html
        <body>
          <!-- 加载动画容器（流式渲染时显示，内容出现后自动隐藏） -->
          <div id="page-loading" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8f9fa; z-index: 9999;">
            <div class="loading la-2x">
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
          
          <!-- 主内容容器 -->
          <main id="app"></main>
          
          <style id="app-css">
            /* 加载动画样式（小球融合动画） */
            .loading,
            .loading > div {
              position: relative;
              box-sizing: border-box;
            }
            
            .loading {
              display: block;
              font-size: 0;
              color: #667eea; /* 必须从封面渐变色的第一个色值提取 */
            }
            
            .loading > div {
              display: inline-block;
              float: none;
              background-color: currentColor;
              border: 0 solid currentColor;
            }
            
            .loading {
              width: 8px;
              height: 8px;
            }
            
            .loading > div {
              position: absolute;
              width: 12px;
              height: 12px;
              border-radius: 100%;
              transform: translate(-50%, -50%);
              animation: ball-fussion-ball1 1s 0s ease infinite;
            }
            
            .loading > div:nth-child(1) {
              top: 0;
              left: 50%;
              z-index: 1;
            }
            
            .loading > div:nth-child(2) {
              top: 50%;
              left: 100%;
              z-index: 2;
              animation-name: ball-fussion-ball2;
            }
            
            .loading > div:nth-child(3) {
              top: 100%;
              left: 50%;
              z-index: 1;
              animation-name: ball-fussion-ball3;
            }
            
            .loading > div:nth-child(4) {
              top: 50%;
              left: 0;
              z-index: 2;
              animation-name: ball-fussion-ball4;
            }
            
            .loading.la-2x {
              width: 16px;
              height: 16px;
            }
            
            .loading.la-2x > div {
              width: 24px;
              height: 24px;
            }
            
            @keyframes ball-fussion-ball1 {
              0% { opacity: 0.35; }
              50% { top: -100%; left: 200%; opacity: 1; }
              100% { top: 50%; left: 100%; z-index: 2; opacity: 0.35; }
            }
            
            @keyframes ball-fussion-ball2 {
              0% { opacity: 0.35; }
              50% { top: 200%; left: 200%; opacity: 1; }
              100% { top: 100%; left: 50%; z-index: 1; opacity: 0.35; }
            }
            
            @keyframes ball-fussion-ball3 {
              0% { opacity: 0.35; }
              50% { top: 200%; left: -100%; opacity: 1; }
              100% { top: 50%; left: 0; z-index: 2; opacity: 0.35; }
            }
            
            @keyframes ball-fussion-ball4 {
              0% { opacity: 0.35; }
              50% { top: -100%; left: -100%; opacity: 1; }
              100% { top: 0; left: 50%; z-index: 1; opacity: 0.35; }
            }
            
            /* 淡出动画 */
            @keyframes fadeOut {
              from { opacity: 1; }
              to { opacity: 0; visibility: hidden; }
            }
            
            .fade-out {
              animation: fadeOut 0.5s ease-out forwards;
            }
          </style>
          
          <script id="app-js">
            // 当第一个section追加时，自动隐藏加载动画
            (function() {
              const observer = new MutationObserver(function(mutations) {
                const appContainer = document.getElementById('app');
                if (appContainer && appContainer.children.length > 0) {
                  const loadingEl = document.getElementById('page-loading');
                  if (loadingEl && !loadingEl.classList.contains('fade-out')) {
                    loadingEl.classList.add('fade-out');
                    setTimeout(() => loadingEl.remove(), 500);
                  }
                  observer.disconnect();
                }
              });
              observer.observe(document.getElementById('app'), { childList: true });
            })();
          </script>
        </body>
        ```
        
        **注意事项**：
        1. **加载动画的颜色必须从封面渐变色中提取**（P0级）：
           - 从"Title–Subtitle–Keywords Section"的 background gradient 中提取主色值
           - 例如：如果封面用 `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`，则加载动画 `color: #667eea`
           - 例如：如果封面用 `linear-gradient(135deg, #f093fb 0%, #f5576c 100%)`，则加载动画 `color: #f093fb`
           - 确保加载动画和封面视觉统一，形成连贯的主题色体验
        2. 背景色（`background: #f8f9fa`）也应该与最终页面的背景色协调
        3. 当第一个 section 被追加到 `<main id="app">` 时，加载动画会自动淡出并移除
        4. 加载动画使用 fixed 定位，确保在流式渲染过程中始终居中显示

        append_head.payload:
        { "html": "追加到<head>的片段" }

        append_css.payload:
        { "css": "追加到#app-css的CSS文本" }

        append_section.payload:
        {
          "section_id": "sec-2",
          "html": "<section id='sec-2'>...</section>"
        }

        append_chart.payload:
        {
          "chart_id": "chart-1",
          "title": "...",
          "html": "<div class='chart' id='chart-1'>...（SVG或Canvas容器或表格）</div>",
          "data_note": "数据来源/不确定性说明（如有）"
        }

        append_script.payload:
        {
          "js": "追加到#app-js的JS文本（必须幂等，避免重复绑定导致多次触发）"
        }

        finalize.payload:
        {
          "status": "ok",
          "summary": ["本页已生成：X个章节","Y个图表","交互：目录滚动/折叠/切换视角"],
          "checks": ["HTML结构闭合","移动端可读性","无外部依赖"]
        }

        error.payload:
        {
          "message": "...",
          "safe_fallback": "如果失败，继续输出最小可读正文，不要中断"
        }

        ========================
        7) HTML/CSS/JS 设计系统（必须内置）
        ========================
        
        **关键CSS规则（P0级 - 必须包含在bootstrap_html中，防止挤压感）**：
        
        在bootstrap_html的<style>标签中，必须包含以下基础CSS：
        
        ```css
        /* === 基础重置（防止浏览器默认样式干扰） === */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        html {
            font-size: 16px; /* 基准字号 */
            -webkit-text-size-adjust: 100%;
        }
        
        body {
            margin: 0;
            padding: 0;
            overflow-x: hidden;
        }
        
        /* === 主容器间距（防止内容紧贴边缘） === */
        main#app {
            max-width: 720px;
            margin: 0 auto;
            padding: 28px 20px; /* 上下28px，左右20px - 给内容呼吸空间 */
        }
        
        @media (max-width: 768px) {
            main#app {
                padding: 24px 16px; /* 移动端稍小但仍然舒适 */
            }
        }
        
        /* === 标题间距（防止标题和内容粘连） === */
        h1 {
            margin: 2.5rem 0 1.5rem 0; /* 上方留大白，下方适中 */
            line-height: 1.3;
            font-size: 2rem; /* 32px */
        }
        
        h2 {
            margin: 3rem 0 1.25rem 0; /* 章节间留更多白 */
            line-height: 1.35;
            font-size: 1.5rem; /* 24px */
        }
        
        h3 {
            margin: 2.25rem 0 1rem 0;
            line-height: 1.4;
            font-size: 1.25rem; /* 20px */
        }
        
        /* === 段落间距（防止文字堆积） === */
        p {
            margin-bottom: 1.5rem; /* 段落之间留白 */
            line-height: 1.75; /* 行高增加可读性 */
        }
        
        /* === 列表间距 === */
        ul, ol {
            margin: 1.5rem 0;
            padding-left: 2rem;
        }
        
        li {
            margin-bottom: 0.75rem;
            line-height: 1.65;
        }
        
        /* === 章节间距（防止章节拥挤） === */
        section {
            margin-bottom: 4rem; /* 章节之间大留白 */
        }
        
        section:first-child {
            margin-top: 0;
        }
        
        section:last-child {
            margin-bottom: 2rem;
        }
        
        /* === 卡片间距（防止卡片堆叠） === */
        .card {
            margin-bottom: 2rem;
            padding: 1.75rem 1.5rem; /* 内边距让内容不贴边 */
            border-radius: 12px;
        }
        
        .nested-card {
            margin: 1.25rem 0;
            padding: 1.5rem 1.25rem;
            border-radius: 8px;
        }
        
        /* === 卡片内部元素间距 === */
        .card > * + *,
        .nested-card > * + * {
            margin-top: 1rem; /* 相邻元素之间留白 */
        }
        
        /* === 图片间距 === */
        img {
            max-width: 100%;
            height: auto;
            margin: 1.5rem 0;
            display: block;
        }
        
        /* === 表格间距 === */
        table {
            width: 100%;
            margin: 2rem 0;
            border-collapse: collapse;
        }
        
        th, td {
            padding: 0.75rem 1rem; /* 单元格内边距 */
            text-align: left;
        }
        
        /* === 引用块间距 === */
        blockquote {
            margin: 2rem 0;
            padding: 1rem 1.5rem;
            border-left: 4px solid #e0e0e0;
        }
        
        /* === 代码块间距 === */
        pre, code {
            margin: 1.5rem 0;
            padding: 1rem 1.25rem;
            border-radius: 8px;
            overflow-x: auto;
        }
        ```
        
        **其他设计要求**：
        - 布局：<main id="app"> 内用统一的 section / card / callout / table 样式
        - 卡片圆角与阴影克制（轻阴影、边框极浅）
        - 表格移动端可横滑（overflow-x）
        - 代码/引用块易读（等宽字体可选，背景极浅）
        - 所有交互必须可触控、命中区足够大（>=44px）

        交互脚本必须包含：
        - TOC 点击平滑滚动（scrollIntoView + smooth）
        - details 折叠（用 data-toggle + aria-expanded）
        - 视角切换（如 data-view="conclusion|evidence|data" 切换显示）

        ========================
        8) 输入（我将提供）
        ========================
        - report_title（可空）
        - report_date（可空）
        - report_body（正文，可能很长）
        - optional: audience（默认“通用但偏专业”）
        - optional: emphasis（我希望你特别强调的方向）

        ========================
        9) 现在开始生成（立即输出 NDJSON）
        ========================
        你必须从 seq=1 的 meta 开始输出。
        不要输出任何解释文字，只能输出 NDJSON。
    """.trimIndent()

    // ==================== 记忆系统 Prompts ====================
    
    /**
     * Prompt: 会话摘要生成
     * 用于从聊天对话中提取核心内容、关键决策和标签
     */
    val PROMPT_SESSION_SUMMARY = """
        你是一个对话内容分析助手，负责从聊天记录中提取关键信息。
        
        **对话内容**：
        {conversation}
        
        **任务**：
        分析以上对话内容，生成结构化摘要。
        
        **输出要求**：
        请严格按照以下 JSON 格式输出结果（必须是有效的 JSON）：
        
        {
          "summary": "对话核心内容摘要（50-100字，概括对话的主要话题和结论）",
          "key_decisions": ["决策1：具体的决定或共识", "决策2：达成的方案"],
          "tags": ["标签1", "标签2", "标签3"],
          "importance": 7,
          "detected_preferences": ["偏好1：用户表达的倾向", "偏好2：用户的习惯"]
        }
        
        **字段说明**：
        - `summary`: 对话的核心内容摘要，50-100字
        - `key_decisions`: 对话中达成的明确决策或共识（如："确定了功能设计方案"、"决定使用XX技术"）
        - `tags`: 对话涉及的主题标签，2-5个（如："技术"、"工作"、"生活"）
        - `importance`: 重要性评分 0-10，考虑因素：
          * 是否包含重要决策（+3分）
          * 是否涉及用户偏好（+2分）
          * 是否包含需要记住的事实（+2分）
          * 对话深度和价值（+3分）
        - `detected_preferences`: 检测到的用户偏好（如："喜欢简短回复"、"倾向于技术解决方案"）
        
        **注意事项**：
        1. 如果对话没有明确的决策，`key_decisions` 为空数组
        2. 如果没有检测到偏好，`detected_preferences` 为空数组
        3. 临时信息（天气、快递单号等）不应被标记为高重要性
        4. 涉及长期规划、价值观、专业知识的对话应给予高评分
        5. 必须输出有效的 JSON，不要包含任何额外的文字说明
    """.trimIndent()
    
    /**
     * Prompt: 记忆类型判断
     * 用于判断提取的内容属于哪种记忆类型
     */
    val PROMPT_MEMORY_TYPE_DETECTION = """
        你是一个记忆分类专家，负责判断内容应归类为哪种记忆类型。
        
        **待分类内容**：
        {content}
        
        **记忆类型定义**：
        1. **FACT（事实）**：客观信息，不随时间轻易改变
           - 示例："我在北京工作"、"我的邮箱是xxx@example.com"、"我毕业于XX大学"
           
        2. **PREFERENCE（偏好）**：主观倾向性，体现用户的喜好和习惯
           - 示例："我喜欢简短的回复"、"我倾向于使用列表展示信息"、"我不喜欢过度设计"
           
        3. **DECISION（决策）**：针对特定项目或场景达成的共识和方案
           - 示例："就按这个方案来"、"确定了功能的交互逻辑"、"决定使用XX技术栈"
           
        4. **LESSON（教训）**：错误记录、失败经验或需要纠正的地方
           - 示例："上次这样做导致了XX问题"、"这个方法不可行"、"之前犯过类似的错误"
        
        **判断依据**：
        - 关键动词："我是/我在" → FACT，"我喜欢/我想要" → PREFERENCE，"就这样定/确定了" → DECISION，"失败了/错误" → LESSON
        - 时态：陈述客观状态 → FACT，表达倾向 → PREFERENCE，达成共识 → DECISION，回顾过去 → LESSON
        - 上下文：技术方案 → DECISION，个人习惯 → PREFERENCE，背景信息 → FACT，问题反思 → LESSON
        
        **输出要求**：
        只返回类型名称，四选一：**FACT** 或 **PREFERENCE** 或 **DECISION** 或 **LESSON**
        不要包含任何额外的文字说明，只输出一个词。
    """.trimIndent()
    
    /**
     * Prompt: 记忆相似度判断（用于去重）
     * 用于判断两条记忆是否相似，以及如何处理
     */
    val PROMPT_MEMORY_SIMILARITY_CHECK = """
        你是一个记忆去重专家，负责判断新记忆与已有记忆的关系。
        
        **新记忆**：
        {new_memory}
        
        **已有记忆**：
        {existing_memories}
        
        **任务**：
        判断新记忆与哪条已有记忆最相似，以及应该如何处理。
        
        **关系类型**：
        1. **DUPLICATE（重复/合并）**：内容描述的是同一件事，或者新内容是旧内容的补充/细化。
           - 建议动作：`merge`（合并为更完整的描述）
        
        2. **CORRECTION（纠错/覆盖）**：新内容指出了旧内容的错误，或者新内容是时间上的最新状态。
           - 示例：新"身份证号末尾是X不是0" vs 旧"身份证号末尾是0" → CORRECTION
           - 建议动作：`replace`（用新记忆彻底替换旧记忆）
        
        3. **SUPPLEMENT（补充）**：新内容提到了同一主题下的不同维度。
           - 建议动作：`link`（保持独立但建立关联）
        
        4. **CONFLICT（矛盾）**：新旧内容完全矛盾且没有明确的纠错语义。
           - 建议动作：`ask_user`（询问用户哪份是准的）
        
        5. **INDEPENDENT（独立）**：新内容与已有记忆无关，独立保存
           - 建议动作：`save_new`
         
        **优先级判断**：
        - 只要包含“不对”、“更正”、“其实是”、“记错了”等含义，优先判定为 **CORRECTION**。
        - 如果内容语义高度重合（如证件号、姓名、关键事实），哪怕只差一个字，也应判定为 **CORRECTION** 或 **DUPLICATE**，严禁存为两条独立记忆。
        
        **输出要求**：
        请严格按照以下 JSON 格式输出结果：
        
        {
          "relationship": "DUPLICATE",
          "most_similar_id": "记忆ID",
          "similarity_score": 0.95,
          "suggested_action": "merge",
          "merged_content": "合并后的内容（如果是 DUPLICATE 或 CORRECTION）",
          "explanation": "判断理由"
        }
        
        **字段说明**：
        - `relationship`: 关系类型（DUPLICATE/CORRECTION/SUPPLEMENT/CONFLICT/INDEPENDENT）
        - `most_similar_id`: 最相似的已有记忆ID（如果是 INDEPENDENT 则为 null）
        - `similarity_score`: 相似度评分 0-1
        - `suggested_action`: 建议操作（merge/replace/link/ask_user/save_new）
        - `merged_content`: 如果需要合并或更新，提供合并后的内容
        - `explanation`: 简短说明判断理由
        
        **注意事项**：
        1. 相似度评分 > 0.8 才考虑 DUPLICATE
        2. UPDATE 必须确认新内容是时间上的更新
        3. 如果不确定，宁可标记为 CONFLICT 或 INDEPENDENT
        4. 必须输出有效的 JSON，不要包含额外文字
    """.trimIndent()
    
    /**
     * Prompt: RAG 语义相似度评分
     * 用于对候选记忆进行语义相似度评分（平衡方案的第二步）
     */
    val PROMPT_MEMORY_SEMANTIC_SCORING = """
        你是一个语义相似度评分专家，负责评估记忆内容与用户查询的相关性。
        
        **用户查询**：
        {query}
        
        **候选记忆列表**：
        {candidate_memories}
        
        **任务**：
        为每条候选记忆评分，评估它对回答用户查询的帮助程度。
        
        **评分标准（0-10分）**：
        - **9-10分**：直接相关，包含回答问题所需的核心信息
        - **7-8分**：高度相关，提供有用的背景或上下文
        - **5-6分**：中度相关，可能提供一些参考
        - **3-4分**：弱相关，仅有概念上的联系
        - **0-2分**：基本无关
        
        **输出要求**：
        请严格按照以下 JSON 数组格式输出结果：
        
        [
          {
            "memory_id": "记忆ID",
            "score": 9,
            "reason": "直接相关，用户明确表达过这个偏好"
          },
          {
            "memory_id": "记忆ID2",
            "score": 6,
            "reason": "中度相关，提供了相关领域的背景信息"
          }
        ]
        
        **注意事项**：
        1. 评分应严格，只有真正有帮助的记忆才给高分
        2. 考虑语义相关性，而非仅仅关键词匹配
        3. 按评分从高到低排序
        4. 必须输出有效的 JSON 数组
    """.trimIndent()
}
