# Specification for Converting Markdown into a Responsive Thematic Webpage

## 1. Overview

- **HTML Structure**
  Includes a title, navigation bar, and content area. The layout must be fully responsive—optimized for mobile first, with consistent performance across all screen sizes. Incorporates modern UI elements such as cards and sidebars.

- **Responsive CSS Design**
  Styled in a contemporary news-report aesthetic. Employs well-balanced typography (e.g., serif headings with sans-serif body text) and a coherent color system built around primary and secondary hues. Thoughtful use of whitespace ensures a clean, breathable layout.
  Supports high-quality custom visuals, such as timelines, relationship diagrams, and relevant news images, integrated seamlessly with the content.

- **CSS Implementation Requirement**
  All visual styles must be implemented entirely within the `<style>` element of the HTML document.  
  No external CSS files, CDNs, inline `style=""` attributes, or third-party CSS frameworks (e.g., Tailwind, Bootstrap) are allowed.  
  All styling must be written as custom CSS rules defined inside the internal `<style>` block.

- **CSS color Design**
  All colors defined within any `<style></style>` block must maintain a contrast ratio greater than 3.0:1 with every other predefined color.
  Additionally, any non-predefined color used within the `<body></body>` must also maintain a contrast ratio greater than 3.0:1 against all predefined colors.
  This requirement ensures consistently high contrast and clear visual distinguishability.

- **JavaScript Interactions**
  Includes features such as table-of-contents navigation and smooth scrolling. Provides subtle hover effects and lightweight animations to guide user attention and deliver responsive feedback.

# 2. Detailed Specifications

## Section Guidelines
- One or more logical sections correspond to `<section>` tags in the final HTML.
- Each section includes a title, content blocks, images, and optional charts.
  - Page titles must avoid terms like “研究报告,” “分析,” or “简报.”  
    Use a **concise, engaging one-sentence headline** instead.
  - Section titles should be **8–14 characters** (or equivalent length), automatically distilled into key phrases.
- Section content may include text, images, and optional statistical charts.
  - Use **rich imagery** (around >3 images) placed at appropriate points in the narrative.
  - If data is present, convert tables into charts (bar, line, pie, combo, etc.).
  - Images must be displayed **inside cards**, resized appropriately to avoid disrupting text layout, and must be relevant to the current card.
- Each `<section>` uses a **card-based layout**.
  - Every section must end with a fully closed `</section>` tag for consistent HTML assembly.
  - Content must be structurally refined and concisely rewritten:
    - Convey the original core ideas and data accurately, without fabrication or omission.
    - Avoid copying text verbatim; improve clarity and information density.
    - Highlight key numbers and insights using bold text, accent colors, or dynamic numeric effects.
  - Include **in-depth interpretation** for any news-related content:
    - *Background*: Connect to historical context, structural issues, policy evolution, or long-term conflicts—explain **why** events occur.
    - *Perspectives*: Break down arguments and logic behind different viewpoints; analyze interests and value positions.
    - *Impact*: Evaluate political, economic, and social implications across short- and long-term horizons, including confidence estimates.
  - Section titles should vary slightly in style while maintaining visual consistency.
- Spacing:
  - Use subtle dividing lines between sections; keep whitespace moderate.
  - Maintain appropriate gaps between cards without excessive spacing.

## Section-Level Specifications

### Title–Subtitle–Keywords Section (Standalone `<section>`)

#### Layout & Structure
- Use a **card-based layout**.
- The section must have **content-based height only**.
  - **Do NOT** use any utility class that forces full-screen height.  
    **❌ Forbidden:** `min-h-screen`, `h-screen`, or any similar height-forcing classes.
- No large empty areas or heavy background blocks.

#### Background
- A background may use a **gradient colors** to enhance visual impact.
  - 
- **Do not use image backgrounds**.

#### Typography & Color (Strict Requirement)
- The **main title**, **subtitle**, and **keyword tags** must use **exactly the same font color**.
- **You must explicitly apply a single unified font color on the parent `<section>` container**.
- **All elements inside the section must inherit this color without overriding it.**
  - **❌ Do NOT assign individual text colors to titles, subtitles, or keyword tags.**
  - **❌ Do NOT use inline styles or arbitrary/custom colors.**
  - **Only theme-preset color utilities are allowed**, and only at the parent container level.

#### Content Requirements
- Include:
  - **Main Title** — narrative and engaging
  - **Subtitle**
  - **Keyword Tags**
- **no element inside the section may apply any background color to the text itself**.  
  **❌ Forbidden:** any `bg-xx` class (or any background-color style) applied to text elements.  
  All text must display directly over the section’s background color with **no additional backgrounds**.
- Keyword icons are optional.
- No action buttons (e.g., “查看详情” / “View Details”) inside this section.



#### Additional Restrictions
- No images in this section.
- No non-theme, arbitrary, or non-standard color classes may be used anywhere in the section.


### Divider Between Cover and Overview
- A visual divider must separate the cover and overview sections.
- Keep spacing minimal; a clean line without icons or text is recommended.
- For all subsequent sections, do not introduce additional vertical gaps.
- sections should connect directly without blank spacing between them.


### Overview / Summary Section (Standalone `<section>`)
- Card-based layout; contains **only one card**.
- No title required.
- Images optional; if used, they must be contextually relevant.
- Highlight key entities and data with bold text, accent color, or slight scaling.
- Provides a high-level summary of the entire report.


### Event Timeline Section (Mandatory)

- Use an engaging, story-driven section title (e.g., “xxxx之路”, “xxxx历程”, “xxxx回顾”).
- Present events strictly in chronological order.
- Choose **either** a **Nested Card Layout** or a **Vertical Timeline Layout**.

#### Option A: Nested Card Layout
- The section contains **one large outer card**.
- **No vertical timeline line** is used.
- Multiple smaller inner cards represent each timeline node.
- Nodes must be arranged in strict chronological order.

#### Option B: Vertical Timeline Layout
- A vertical timeline line appears on the **left side**, but:
  - **No icons**,
  - **No text**,
  - **No dates**,
  - **No additional `<div>` elements containing any text**
  may appear on or inside the left-side vertical timeline component.
- Each timeline node must appear as a card or `<div>` block to the right of the vertical line.
- **The date must be placed inside the same `<div>` as the timeline node card content.**
- No text of any kind is allowed on the vertical line itself—**all textual content belongs only inside the node cards**.
- Vertical Timeline Constraint
  The vertical timeline line must be placed directly adjacent to the right-side timeline cards with 0px horizontal gap; when no icons or markers are present, no space may be reserved—any margin, padding, gap, or placeholder between the line and cards is strictly forbidden.

#### Timeline Node Requirements
Each node card must include:
- A concise time marker (date or period), located **inside the same `<div>` as the event content**
- A clear description of the event
- Key data, insights, or highlights (with appropriate emphasis styles)
- Optional related imagery

If a vertical timeline line is used, **no icons, dots, circles, or pseudo-element markers** may be attached to the line.
  **❌ Forbidden examples:**
  - DO NOT any CSS like `.timeline-node::before { ... border-radius: 50%; ... }`
  - DO NOT any class such as `.timeline-dot { ... border-radius: 50%; ... }`
  - DO NOT any `<div>` or pseudo-element used to create a dot, marker, or circular shape on the timeline
  In short: **the vertical line must remain a plain line with no decorative or functional markers of any kind.**

#### Full coverage of time nodes
- All timeline points mentioned in **Chapter 1 of the original report must be included within that chapter**, without omission. This includes all dates and events listed in tables.
- Any **timeline reference appearing anywhere in the original report must also be included in Chapter 1**. No omissions or duplicates are allowed. Descriptions referring to the same time point should be merged into a single, coherent statement.


### Guidelines for the In-Depth News Insight Section (this section is mandatory; the title should be adapted to the content)
  - Card-style layout
    - Key points, data, and insights may use **nested cards** to highlight important information.
  - Titles should feel narrative and engaging. Avoid stiff wording like “xx解读” “xx分析” or “xx影响.” Prefer more attractive phrasing such as “xx揭秘” “xx透视,” or “xx洞察.”
  - PPT-style presentation with bold and enlarged highlights
    - The `<style></style>` tag must include CSS styles for structured text layout.
    - Icon-based subtitle styles
    - Enlarged key-data styles
    - Structured text layout styles
      - Blockquote text styling
      - Hierarchy and category distinction styling
      - Optional small icons before lines
    - Multi-line data should use data-point separator styles.
    - Each text segment may be wrapped with `<div class="xx xx xx">text</div>` for decoration.
  - Include **3–6 cards**, each using structured text formatting.
    - Key insights, major viewpoints, and core data must be presented using CSS-based structured layouts.
  - Each card should use rich CSS styling to present distilled content from the original report.
    - Text layout must be structured, with modular visual blocks.
    - Any content exceeding 20 characters must be displayed in a structured, styled format—**no long continuous paragraphs allowed**.
    - Cards may include images, but they must not overpower the text.
  - Important phrases, entities, and data must be highlighted using **bold** or **color accents**.
  - For comparison items or key datasets, use enlarged and visually striking CSS styles.


### Guidelines for Other Content Sections
  - Each section must be wrapped with a `<section>` tag.
  - Each section includes a title and several content cards.
  - Cards in these sections must have their own CSS designs, different from those in the In-Depth Insight section.
  - Section titles must avoid rigid terms like “Background” or “Event Review.” Use **engaging, one-sentence titles** such as “XX Uncovered” or “XX Decoded.”
  - Card content must be **structured and concisely rewritten**:
    - PPT-style presentation with bold/enlarged highlights for key points.
    - Each continuous text block (including punctuation) must be **under 25 characters**.
    - Additional text must use structured PPT-style CSS segmentation; **no long paragraphs**.
    - Comparison or key-data cards should use visually distinctive CSS (colors, layout, `class`/`span`-based styling).
    - Important phrases, entities, and data should be highlighted in bold or color.


### Guidelines for the Conclusion Section
  - The section title must avoid rigid expressions.
  - The conclusion must contain **2–5 cards**, ordered by importance.
  - Each card may include a small icon before its subtitle.
    - Content must be presented as core statements, bullet points, or key numeric indicators.
    - Use contrasting colors to emphasize keywords and core conclusions.
  - Cards in this section must not contain images.
  - No images are allowed in the conclusion or any following sections.


### Footer Requirements
  - The footer contains **only** the unified disclaimer:  
    “页面所用图片均来自公开网络，如有侵权请联系删除。”
  - The footer background color must match the overall page style.
  - No additional content such as copyright notices is allowed in the footer.


## Visual Animation Effects Guidelines
- Navigation Behavior
  - The navigation bar is hidden by default and only appears at the bottom when the user scrolls.
  - The active section is automatically highlighted during scrolling.
  - Apply custom scrollbar styling to enhance overall visual quality.
- Numeric Animation Rules
  - Animation should apply **only to a single continuous numeric token** (e.g., “75%” “7小时” “5亿”).
  - If the text contains **multiple numeric segments** (e.g., “9/0/11,” “11.25,” “6-6”) or **year/date-like numbers** (e.g., “2024,” “202506”), numeric animation must **not** be enabled.


## Navigation Guidelines
- Responsive Navigation Design  
  - Mobile-first approach, then adapt to desktop layouts.
- Core Navigation Rules
  - On mobile:
    - The navigation bar stays hidden by default.    
    - Tapping the button opens a floating navigation panel.  
    - Selecting an item closes the panel and smooth-scrolls back to the content.
- Design Notes
  - You may reference the sample navigation designs.


# 3. Technical Implementation Specifications

- The following CDN resources **must** be included; local resources are not allowed:
  - **技术依赖强制要求**：必须引入以下 CDN 资源，禁止本地资源：
  - 动画库：`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.css"/>`
    - 必须引入 AOS 动画库脚本：`<script src="https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js"></script>`
  - 图标：`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">`
  - 图表：`<script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>`
  - 字体：内嵌样式 `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap'); body { font-family: 'Noto Sans SC', sans-serif; }`

- Add the following styles inside the <head></head> block:
  ```css
<style>
/* 防止横向滚动, 注意必须完整控制html防止溢出 */
html, body {
    overflow-x: hidden;
    width: 100%;
    position: relative;
}
/* 确保所有容器不超出视口 */
* {
    max-width: 100%;
}
img {
    max-width: 100%;
    height: auto;
}
/* 图片容器，来装饰每个图片，使卡片中的图片大小自适应，不规则的图片边缘留默认背景色或裁剪防止异常图片展示过大 */
.image-container {
    xxx;
}
/* 预设主题色、文字大小、颜色等基础样式 */
:root {
    xxx;
}

/* 对于卡片式内容区块，设计多种样式，尤其是结构化文本表示（PPT风格） */
.card-style-1 {
    xxx;
}
.card-style-2 {
    xxx;
}
.card-style-3 ...
/* PPT式的嵌套卡片设计，用于深度解读区，关键短语和字要加粗和放大*/
.nested-card1 {
    xxx;
}
.nested-card1 .inner-card1 {
    xxx;
}
.nested-card1 .inner-card2 {
    xxx;
}
.nested-card1 .inner-card-title {
    xxx;
}
.nested-card1 .inner-card-content {
    xxx;
}
.nested-card1 .inner-card-footer {
    xxx;
}
.nested-card1 .inner-card-highlight {
    xxx;
}
.nested-card2 ...
/* 文字样式预设 */
.p-text-style-1 {
    xxx;
    #xxx; /* 颜色等 */
}
.p-text-style-2 {
    xxx;
    #xxx; /* 颜色等，注意和背景色保持高对比度 */
}
.p-title {
    xxx;
}
...
/* 渐变色字体样式, 用于深度解读区 */
.highlight-gradient-xxx {
    xxx;
}
...
</style>
```
- 上述样式必须包含在生成的 HTML 报告中，以确保在各种设备和屏幕尺寸下的良好显示效果。
- 注意文字颜色与卡片/嵌套卡片背景颜色需有足够对比度以提升可读性。

  - Color tips:
    - Select primary/secondary/background/etc colors based on report topic; avoid default blue unless tech.  
    - Use topic→color mapping: Tech(blue/cyan/purple), Finance(green/gold/navy), Sports(green/orange/red), Healthcare(teal/green/white), Society(grey/red/black), Education(blue-green/yellow), Environment(green/brown/aqua), Military(green/khaki/grey), Entertainment(pink/purple/yellow), Geopolitics(red/navy/gold), Business(blue-grey/black-gold/silver), Consumer(orange/red/green). These mappings are only references—choose colors based on actual report content.

Colors must be diverse, non-repetitive, and semantically aligned.

- Navigation bar reference example
  - Ensure that the implemented navigation bar automatically hides on mobile devices when not scrolling.  
  case:
```html
<head>
<meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.css"/>
  <script src="https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js"></script>
  <title>xxx</title>
  <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">
  <style>
    :root {
      /* 主题变量 */
      --primary: #xxxxxx; /* 示例主色，可根据实际修改 */
      --text: #333333; /* 主要文字颜色 */
      --text-light: #666666; /* 次要文字颜色 */
      --bg: transparent; /* 透明背景 */
      --border: rgba(226, 232, 240, 0.5); /* 半透明边框 */
      --shadow: 0 -2px 10px rgba(0,0,0,0.05); /* 朝上阴影 */
      --transition: all 0.3s ease;
      /* Logo变量*/
      --logo-icon: "\f015"; /* 示例图标（主页），可修改 */
      --logo-text: "xx"; /* 示例文本，可修改 */
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      overflow-x: hidden;
      width: 100%;
      position: relative;
      /* 移除底部内边距，导航栏隐藏时不占用空间 */
    }
    body { 
      font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: var(--text);
      /* 示例正文样式，方便测试 */
      padding: 1rem;
      line-height: 1.8;
    }

    /* 导航核心 - 底部定位+自动隐藏（移动端/桌面端统一） */
    .navbar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--bg); /* 透明背景 */
      box-shadow: var(--shadow);
      z-index: 50;
      transition: var(--transition);
      backdrop-filter: blur(8px); /* 毛玻璃效果 */
      transform: translateY(100%); /* 默认隐藏（完全移出屏幕底部） */
      opacity: 0; /* 初始透明 */
    }
    /* 滑动时显示导航栏 */
    .navbar.visible {
      transform: translateY(0); /* 滑入屏幕 */
      opacity: 1; /* 完全显示 */
    }
    .nav-wrap {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between; /* 左右分布：Logo+文字 + 导航按钮 */
      height: 4rem; /* 底部导航高度（桌面端适当加高） */
    }

    /* Logo样式（移动端/桌面端均显示图标+文字） */
    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      font-weight: 700;
      color: var(--primary);
      font-size: 1.1rem; /* 桌面端文字稍大 */
    }
    .logo-icon::before {
      content: var(--logo-icon);
      width: 2.2rem;
      height: 2.2rem;
      background: var(--primary);
      color: white;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      font-family: "FontAwesome";
      font-size: 1.1rem;
    }
    .logo-text {
      display: inline-block; /* 移动端/桌面端均显示文字 */
    }

    /* 导航按钮（移动端/桌面端统一显示） */
    .menu-btn {
      display: block; /* 强制显示，不分设备 */
      background: none;
      border: none;
      font-size: 1.8rem; /* 桌面端按钮稍大 */
      color: var(--text-light);
      cursor: pointer;
      padding: 0.5rem;
      transition: var(--transition);
    }
    .menu-btn:hover {
      color: var(--primary);
      transform: scale(1.05); /*  hover轻微放大 */
    }

    /* 展开菜单（移动端/桌面端统一样式） */
    .mobile-menu {
      position: absolute;
      bottom: 100%; /* 向上展开 */
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.98); /* 高透明白色背景（增强可读性） */
      border-bottom: 1px solid var(--border);
      display: none; /* 默认隐藏 */
      animation: slideUp 0.3s ease;
      border-radius: 12px 12px 0 0; /* 顶部圆角（更美观） */
      box-shadow: 0 -6px 15px rgba(0,0,0,0.1); /* 增强阴影层次感 */
    }
    .mobile-menu.active { 
      display: block; 
    }
    .mobile-nav {
      display: flex;
      flex-direction: column; /* 垂直菜单（统一样式） */
      padding: 1.5rem;
      gap: 1rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    .mobile-nav .nav-link {
      text-decoration: none;
      color: var(--text-light);
      font-weight: 500;
      transition: var(--transition);
      padding: 1rem 1.5rem;
      border-radius: 8px;
      font-size: 1.05rem; /* 文字稍大，便于点击 */
    }
    .mobile-nav .nav-link:hover, .mobile-nav .nav-link.active { 
      color: var(--primary); 
      background: rgba(66, 153, 225, 0.1); /* hover/活跃背景 */
    }
    .mobile-nav .nav-link.active {
      font-weight: 600;
      border-left: 3px solid var(--primary); /* 活跃状态左侧边框标识 */
    }

    /* 隐藏原桌面端导航目录（按需求移除） */
    .desktop-nav {
      display: none !important; /* 强制隐藏，不分设备 */
    }

    /* 响应式微调（仅调整尺寸，不改变核心逻辑） */
    @media (max-width: 767px) {
      .nav-wrap {
        height: 3.5rem; /* 移动端导航高度稍低 */
        padding: 0 1rem;
      }
      .logo {
        font-size: 1rem;
        gap: 0.5rem;
      }
      .logo-icon::before {
        width: 2rem;
        height: 2rem;
        font-size: 1rem;
      }
      .menu-btn {
        font-size: 1.5rem; /* 移动端按钮稍小 */
      }
      .mobile-nav {
        padding: 1rem;
        gap: 0.75rem;
      }
      .mobile-nav .nav-link {
        padding: 0.75rem 1rem;
        font-size: 0.95rem;
      }
    }

    /* 菜单展开动画 */
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(15px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* 示例正文样式（方便测试效果） */
    .content {
      max-width: 1000px;
      margin: 0 auto;
      padding: 2rem 0;
    }
    .section {
      margin-bottom: 4rem;
      padding: 2rem;
      background: #f9fafb;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.03);
    }
    .section h2 {
      color: var(--primary);
      margin-bottom: 1.5rem;
      font-size: 1.8rem;
    }
  </style>
</head>
<body>

  <!-- 底部导航栏（移动端/桌面端统一样式） -->
  <footer class="navbar">
    <div class="nav-wrap">
      <!-- Logo（图标+文字，两端统一显示） -->
      <a href="#hero" class="logo">
        <span class="logo-icon"></span>
        <span class="logo-text">xx</span>
      </a>
      
      <!-- 导航按钮（两端统一显示，点击展开菜单） -->
      <button class="menu-btn" id="menuBtn">
        <i class="fa fa-bars"></i>
      </button>
    </div>
    
    <!-- 展开菜单（两端统一样式） -->
    <div class="mobile-menu" id="mobileMenu">
      <nav class="mobile-nav">
        <a href="#hero" class="nav-link active">首页</a>
        <a href="#summary" class="nav-link">速览</a>
        <a href="#xx" class="nav-link">其他</a>
        <!-- 可按需添加更多导航链接 -->
      </nav>
    </div>
  </footer>

  <script>
    const menuBtn = document.getElementById('menuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const navLinks = document.querySelectorAll('.nav-link');
    const navbar = document.querySelector('.navbar');
    const icon = menuBtn.querySelector('i');
    let scrollTimer; // 滚动计时器
    const hideDelay = 2000; // 静止后隐藏延迟（2秒，可调整）

    // 菜单切换（两端统一逻辑）
    menuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('active');
      icon.classList.toggle('fa-bars');
      icon.classList.toggle('fa-times');
      
      // 打开菜单时，导航栏保持显示（不自动隐藏）
      if (mobileMenu.classList.contains('active')) {
        clearTimeout(scrollTimer);
      } else {
        // 关闭菜单后，恢复自动隐藏逻辑
        startHideTimer();
      }
    });

    // 导航链接处理（两端统一逻辑）
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        
        // 关闭菜单
        if (mobileMenu.classList.contains('active')) {
          mobileMenu.classList.remove('active');
          icon.classList.add('fa-bars');
          icon.classList.remove('fa-times');
        }
        
        // 更新活跃状态
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // 平滑滚动（无偏移，导航栏会隐藏）
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth'
          });
        }
        
        // 滚动后启动隐藏计时器
        startHideTimer();
      });
    });

    // 滚动事件：显示导航栏 + 重置隐藏计时器（两端统一逻辑）
    window.addEventListener('scroll', () => {
      // 所有设备都启用自动显示/隐藏
      navbar.classList.add('visible'); // 滑动时显示
      
      // 清除之前的计时器，重新计时
      clearTimeout(scrollTimer);
      
      // 如果菜单是关闭状态，才启动隐藏计时器（打开菜单时保持显示）
      if (!mobileMenu.classList.contains('active')) {
        startHideTimer();
      }
      
      // 导航栏阴影效果（滚动时增强）
      if (window.scrollY > 50) {
        navbar.style.boxShadow = '0 -4px 20px rgba(0,0,0,0.1)';
      } else {
        navbar.style.boxShadow = 'var(--shadow)';
      }
    });

    // 启动隐藏计时器
    function startHideTimer() {
      scrollTimer = setTimeout(() => {
        // 菜单关闭时，隐藏导航栏（所有设备统一）
        if (!mobileMenu.classList.contains('active')) {
          navbar.classList.remove('visible');
        }
      }, hideDelay);
    }

    // 初始化：所有设备默认隐藏导航栏
    window.addEventListener('load', () => {
      navbar.classList.remove('visible');
    });

    // 窗口大小变化时，保持导航栏状态一致
    window.addEventListener('resize', () => {
      // 菜单关闭时，隐藏导航栏；打开时保持显示
      if (!mobileMenu.classList.contains('active')) {
        navbar.classList.remove('visible');
      } else {
        navbar.classList.add('visible');
      }
    });

    // 点击页面空白处，关闭菜单（增强用户体验）
    document.addEventListener('click', (e) => {
      if (
        mobileMenu.classList.contains('active') &&
        !menuBtn.contains(e.target) &&
        !mobileMenu.contains(e.target)
      ) {
        mobileMenu.classList.remove('active');
        icon.classList.add('fa-bars');
        icon.classList.remove('fa-times');
        startHideTimer();
      }
    });
  </script>
</body>
```
- 注意上述导航栏实现仅供参考，具体样式和配色可根据报告主题进行调整。
- 不能出现按钮在点击后没有任何反应的情况。


# 4. Important Notes

- No copyright statements, references, or similar content are required.
- Do not reuse the same image in multiple places. Each image must have a unique purpose and placement.
- Match the provided image assets with the content cards whenever possible to avoid having many unused images.
- On mobile devices, horizontal scrollbars are strictly prohibited; all content must adapt to the screen width.
  - Avoid including charts in the HTML unless absolutely necessary.  
    If a chart is required, it must include explanatory text and the explanation must not duplicate the chart title.
- Text and background color contrast must be sufficient to ensure readability.
  - Avoid overly uniform global color schemes; use different background colors, text colors, and card styles to distinguish sections.
- When a text block exceeds 40 characters, use CSS-based structured formatting wherever possible.
- **Unified Disclaimer Placement**:
  - Do not place “来源：网络” or similar labels under each image.
  - Instead, include a single footer disclaimer:
    > "页面所用图片均来自公开网络，如有侵权请联系删除。"
- Target Output of the Web Report (**Critical Requirements**)
  - The generated webpage should *not* be a direct conversion of the original text.  
    Instead, it should be a **reconstructed and visually redesigned** version of the Markdown report:
    - Extract and rewrite key information; the text does not need to remain overly long.  
      If more information must be shown, use different layouts and CSS styles to display it.
    - Present information in modular, visually rhythmic sections.
    - Produce a clean, interactive, and clearly layered web-based thematic report.
- No fabrication, alteration, or inconsistencies:
  - No new content may be added beyond what exists in the original report; all information must remain faithful to the source.
  - Facts, data, and dates must remain accurate; no distortion or misleading modification is permitted.
  - Do not extend, infer, or speculate on information not present in the original report.

---
The above content constitutes the **Specification for Converting Markdown into a Responsive Thematic Webpage**.
Please follow these rules strictly and apply them to all upcoming HTML code generation tasks.