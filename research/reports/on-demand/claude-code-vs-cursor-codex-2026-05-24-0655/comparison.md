# Claude Code vs Cursor, Codex

> Generated 2026-05-24T06:55:05+00:00 from `wiki/compiled/`. Baseline: **Claude Code**.

## Comparison Matrix

| Dimension | Claude Code | Cursor | Codex | |---|---|---|---|| **E1** 终端/Shell 执行 | 完整 Shell + 权限模式 | 完整 Shell + 权限模式 | 完整 Shell + 权限模式 | | **E4** MCP 支持 | 原生 + Marketplace | 原生 + Marketplace | 原生 + Marketplace | | **E5** 自定义工具/Hook 系统 | 3 | 2 | 2 | | **E6** 长任务持久化 | 2 | 1 | 3 | | **F1** 项目配置文件 | CLAUDE.md + .claude/agents/ + .claude/skills/ | .cursor/rules/ + .cursorrules | AGENTS.md | | **F3** Memory + Context Compaction | 3 | 2 | 2 | 
## Per-Dimension Detail

### E1 — 终端/Shell 执行

**Group:** E. Agent Harness 执行 · **Importance:** high · **Weight:** 15.0%

**Rubric:** 是否能跑命令 / 是否有 Plan-Act 模式 / 危险命令是否拦截

**Claude Code** — Value: `完整 Shell + 权限模式` (Confidence: EXTRACTED)
- [https://docs.anthropic.com/en/docs/claude-code/security#permissions](https://docs.anthropic.com/en/docs/claude-code/security#permissions)
**Cursor** — Value: `完整 Shell + 权限模式` (Confidence: EXTRACTED)
- [https://docs.cursor.com/agent/terminal](https://docs.cursor.com/agent/terminal)
**Codex** — Value: `完整 Shell + 权限模式` (Confidence: EXTRACTED)
- [https://platform.openai.com/docs/codex/security](https://platform.openai.com/docs/codex/security)

### E4 — MCP 支持

**Group:** E. Agent Harness 执行 · **Importance:** high · **Weight:** 18.0%

**Rubric:** 原生支持级别 + Marketplace 数量

**Claude Code** — Value: `原生 + Marketplace` (Confidence: EXTRACTED)
- [https://docs.anthropic.com/en/docs/claude-code/mcp](https://docs.anthropic.com/en/docs/claude-code/mcp)
**Cursor** — Value: `原生 + Marketplace` (Confidence: EXTRACTED)
- [https://docs.cursor.com/context/mcp](https://docs.cursor.com/context/mcp)
**Codex** — Value: `原生 + Marketplace` (Confidence: EXTRACTED)
- [https://platform.openai.com/docs/codex/mcp](https://platform.openai.com/docs/codex/mcp)

### E5 — 自定义工具/Hook 系统

**Group:** E. Agent Harness 执行 · **Importance:** critical · **Weight:** 22.0%

**Rubric:** 0=无 / 1=Function call only / 2=Skill 系统 / 3=Skill+Hook+SubAgent 完整

**Claude Code** — Value: `3` (Confidence: EXTRACTED)
- [https://docs.anthropic.com/en/docs/claude-code/skills](https://docs.anthropic.com/en/docs/claude-code/skills)
**Cursor** — Value: `2` (Confidence: EXTRACTED)
- [https://docs.cursor.com/context/rules-for-ai](https://docs.cursor.com/context/rules-for-ai)
**Codex** — Value: `2` (Confidence: EXTRACTED)
- [https://platform.openai.com/docs/codex/agents](https://platform.openai.com/docs/codex/agents)

### E6 — 长任务持久化

**Group:** E. Agent Harness 执行 · **Importance:** critical · **Weight:** 20.0%

**Rubric:** 0=单回合 / 1=多回合 / 2=Checkpoint 恢复 / 3=Cloud Agent 异步

**Claude Code** — Value: `2` (Confidence: EXTRACTED)
- [https://docs.anthropic.com/en/docs/claude-code/checkpoints](https://docs.anthropic.com/en/docs/claude-code/checkpoints)
**Cursor** — Value: `1` (Confidence: EXTRACTED)
- [https://docs.cursor.com/agent/overview](https://docs.cursor.com/agent/overview)
**Codex** — Value: `3` (Confidence: EXTRACTED)
- [https://platform.openai.com/docs/codex/cloud](https://platform.openai.com/docs/codex/cloud)

### F1 — 项目配置文件

**Group:** F. Context Engineering · **Importance:** high · **Weight:** 25.0%

**Rubric:** 配置文件名 + 支持范围 (如 CLAUDE.md / AGENTS.md / .cursor)

**Claude Code** — Value: `CLAUDE.md + .claude/agents/ + .claude/skills/` (Confidence: EXTRACTED)
- [https://docs.anthropic.com/en/docs/claude-code/memory](https://docs.anthropic.com/en/docs/claude-code/memory)
**Cursor** — Value: `.cursor/rules/ + .cursorrules` (Confidence: EXTRACTED)
- [https://docs.cursor.com/context/rules-for-ai](https://docs.cursor.com/context/rules-for-ai)
**Codex** — Value: `AGENTS.md` (Confidence: EXTRACTED)
- [https://platform.openai.com/docs/codex/agents](https://platform.openai.com/docs/codex/agents)

### F3 — Memory + Context Compaction

**Group:** F. Context Engineering · **Importance:** critical · **Weight:** 30.0%

**Rubric:** 0=无 / 1=会话级 / 2=跨会话持久化 / 3=可编辑可分享

**Claude Code** — Value: `3` (Confidence: EXTRACTED)
- [https://docs.anthropic.com/en/docs/claude-code/memory](https://docs.anthropic.com/en/docs/claude-code/memory)
**Cursor** — Value: `2` (Confidence: EXTRACTED)
- [https://docs.cursor.com/context/rules-for-ai](https://docs.cursor.com/context/rules-for-ai)
**Codex** — Value: `2` (Confidence: EXTRACTED)
- [https://platform.openai.com/docs/codex/memory](https://platform.openai.com/docs/codex/memory)

