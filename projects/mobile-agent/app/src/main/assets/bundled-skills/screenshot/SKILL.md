---
name: "屏幕截图"
description: "在 Android 上截取屏幕画面。当用户要求截屏或查看当前屏幕时触发。"
category: utility
enabled: true
---

# Screen Screenshot

Capture screenshots on Android using the built-in screen capture tool.

## Using the built-in tool

Use the `screen_capture` tool to take a screenshot of the current screen. The tool uses Android's MediaProjection API.

## Capabilities

- Full screen capture
- Automatic analysis of screenshot content using AI vision
- Save to device storage with timestamps
- Share captured screenshots

## Guidelines

- The screen capture tool requires MediaProjection permission (user will be prompted on first use)
- Screenshots are saved to the app's internal storage
- Use `analyze_images` tool after capture to understand what's on screen
- For automated workflows, combine with scheduled tasks
- Include timestamps in filenames for multiple captures
