---
name: "网页应用测试"
description: "测试网页应用的工具包，检查网页端点、API 响应和页面内容。"
category: development
enabled: true
---

# Web Application Testing (Android)

Test web applications using HTTP tools available on Android.

## Available Tools

- `web_fetch(url)` - Fetch page content and verify HTML structure
- `http_request(url, method, headers, body)` - Test API endpoints

## Testing Patterns

### API Endpoint Testing
```
1. http_request(url, "GET") -> verify status 200
2. Parse JSON response
3. Validate expected fields exist
4. Report results
```

### Page Content Verification
```
1. web_fetch(url) -> get page text
2. Check for expected content
3. Verify links and structure
4. Report findings
```

## Guidelines

- Test both success and error scenarios
- Verify response status codes
- Check content-type headers
- Handle timeouts gracefully
