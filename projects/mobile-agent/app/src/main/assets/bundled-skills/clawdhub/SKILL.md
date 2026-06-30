---
name: "技能商店"
description: "从在线技能仓库搜索、安装和管理 Agent 技能。"
category: meta
enabled: true
---

# Skill Hub

Search and install skills from online repositories.

## Importing Skills

Skills can be imported from URLs pointing to SKILL.md files:
- GitHub repositories
- Direct SKILL.md URLs

The SkillManager handles downloading and installing skills to the managed skills directory.

## Skill Format

Each skill is a directory containing:
- `SKILL.md` - Main skill definition (YAML frontmatter + markdown)
- `references/` - Supporting documentation (optional)

## Guidelines

- Search for skills by topic or capability
- Import skills via URL using the skill manager
- Managed skills are stored in app internal storage
- User custom skills (in external storage) take priority over managed skills
