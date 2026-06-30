---
name: "网页构件生成"
description: "生成 HTML/CSS/JS 网页构件，可在 Android WebView 中渲染。适用于交互页面、仪表盘、数据可视化等。"
category: development
enabled: true
---

# Web Artifacts Builder (Android)

Create self-contained HTML artifacts that render in Android's WebView.

## Output Format

Generate a single HTML file containing:
- Inline CSS (in `<style>` tags)
- Inline JavaScript (in `<script>` tags)
- Responsive design for mobile screens

## Guidelines

- Use vanilla HTML/CSS/JS for maximum compatibility
- Include viewport meta tag for mobile rendering
- Use CSS Flexbox/Grid for responsive layouts
- Keep file size reasonable (< 500KB)
- Test with mobile viewport sizes (360x640, 375x812)
- Use `file_write` tool to save the HTML file
- Avoid external CDN dependencies when possible

## Design Tips

- Use system fonts for better performance
- Avoid excessive animations on mobile
- Touch-friendly interactive elements (min 44px tap targets)
- Dark mode support via `prefers-color-scheme`
