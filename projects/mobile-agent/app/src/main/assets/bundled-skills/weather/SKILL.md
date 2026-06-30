---
name: "天气查询"
description: "获取任意地点的实时天气数据，包括当前天气和预报信息。"
category: utility
enabled: true
---

# Weather Data

Fetch weather information using free APIs.

## Using wttr.in (no API key needed)

```bash
# Current weather (terminal-friendly)
curl "wttr.in/Beijing?format=3"

# Detailed forecast
curl "wttr.in/Shanghai"

# JSON format
curl "wttr.in/Tokyo?format=j1"

# Specific fields
curl "wttr.in/London?format=%l:+%c+%t+%w+%h"
```

## Format Codes

- `%l` - Location
- `%c` - Weather icon
- `%t` - Temperature
- `%w` - Wind speed
- `%h` - Humidity
- `%p` - Precipitation

## Python Usage

```python
import json, urllib.request

url = "https://wttr.in/Beijing?format=j1"
data = json.loads(urllib.request.urlopen(url).read())
current = data["current_condition"][0]
print(f"Temperature: {current['temp_C']}°C, {current['weatherDesc'][0]['value']}")
```

## Guidelines

- Use city names in English for best results
- Append `?lang=zh` for Chinese output
- Cache results to avoid repeated API calls
- Handle network errors gracefully
