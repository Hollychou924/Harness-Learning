---
name: "获取时间"
description: "可以获取现在的时间"
category: custom
enabled: true
---

name: Time Skill
version: 1.0
description: A skill to get the current time.
tools:
  - name: get_time
    description: Get the current time.
    parameters: []
    returns:
      type: string
      description: The current time in ISO format.