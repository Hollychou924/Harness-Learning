---
name: "网页抓取"
description: "抓取并提取网页中的可读内容，适用于阅读特定网址、提取文章正文或收集网站信息。"
category: utility
enabled: true
---

# Web Content Fetching

Extract readable content from web pages.

## Using the built-in web_fetch tool

The `web_fetch` tool strips HTML tags and returns clean text. Use it directly:
- Fetches the URL with a 15-second timeout
- Removes scripts, styles, and HTML tags
- Returns plain text content (truncated to 10K chars)

## For more control, use Python

```python
import urllib.request
from html.parser import HTMLParser

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'nav', 'footer'):
            self.skip = True

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'nav', 'footer'):
            self.skip = False

    def handle_data(self, data):
        if not self.skip:
            self.text.append(data.strip())

url = "https://example.com"
html = urllib.request.urlopen(url).read().decode()
parser = TextExtractor()
parser.feed(html)
content = ' '.join(filter(None, parser.text))
```

## Guidelines

- Use `web_fetch` tool for simple page reads
- Use Python for pages needing JavaScript rendering (with Playwright)
- Respect robots.txt and rate limits
- Handle encoding issues (UTF-8 fallback)
- Cache responses for repeated access
