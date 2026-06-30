---
name: "网页数据采集"
description: "Android 网页自动化：使用 web_fetch 和 http_request 工具进行网页抓取和数据提取。"
category: development
enabled: true
---

# Web Page Automation (Android)

On Android, browser automation is handled through built-in web tools rather than Playwright.

## Available Tools

- `web_fetch(url)` - Fetch and extract readable content from any URL
- `http_request(url, method, headers, body)` - Make HTTP API calls
- `web_search(query)` - Search the web

## Use Cases

- Extract article content from URLs
- Call REST APIs
- Scrape structured data from web pages
- Search for information

## Guidelines

- Prefer `web_fetch` for simple page content extraction
- Use `http_request` for API endpoints that return JSON
- Chain `web_search` + `web_fetch` for research tasks
