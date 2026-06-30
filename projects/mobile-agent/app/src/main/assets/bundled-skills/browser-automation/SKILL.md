---
name: "浏览器自动化"
description: "Android 浏览器任务：打开网址、搜索网页、抓取页面内容。当用户要求打开网站或与网页交互时触发。"
category: utility
enabled: true
---

# Browser Automation (Android)

## Available Tools

### Web Search
Use `web_search` to search the web for information. Returns search results with titles, URLs, and snippets.

### Web Fetch
Use `web_fetch` to fetch and extract readable content from web pages:
- Fetches the URL with timeout
- Removes scripts, styles, and HTML tags
- Returns clean text content

### HTTP Request
Use `http_request` for structured API calls:
- Supports GET, POST, PUT, DELETE methods
- Custom headers and body
- Returns response with status code

## Common Patterns

### Search and Read
```
1. web_search("query") -> get relevant URLs
2. web_fetch(url) -> read page content
3. Summarize findings for user
```

## Guidelines

- Use `web_search` for general information queries
- Use `web_fetch` to read specific page content
- Use `http_request` for API endpoints
- Handle network errors gracefully
