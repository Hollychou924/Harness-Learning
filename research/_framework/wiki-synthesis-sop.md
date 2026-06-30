---
id: wiki-synthesis-sop
type: framework
status: active
updated: 2026-05-25
owners: ["zhouhao"]
---

# AI Agent 竞品知识库 · wiki 沉淀 SOP

> 目标: 防止“只入库、不沉淀”。任何新素材进入 `wiki/raw/` 后,必须有最终去向: 升级成 wiki 页面、更新已有页面,或明确写 SKIP 原因。

## 1. 分层定义

| 层级 | 目录 | 职责 | 完成标准 |
|---|---|---|---|
| 原料层 | `wiki/raw/` | 保存原文、元信息、来源链接 | 原文存在,能回到源链接 |
| 单篇卡 | `wiki/review/source-cards/` | 逐篇提炼关键观点,防止综合时吞材料 | 每篇高价值素材一张卡 |
| 成品层 | `wiki/concepts/` `wiki/entities/` `wiki/comparisons/` `wiki/timelines/` `wiki/lessons/` `wiki/topics/` | 可复用知识页 | 有 frontmatter、证据、相关页面 |
| 覆盖账本 | `wiki/review/ingest-coverage/` | 记录每篇素材去哪了、哪些没用、为什么 | 每批入库一张覆盖表 |
| 入口层 | `wiki/index.md` | 人和 AI 的第一入口 | 新页面必须能从这里进入 |

## 2. 页面类型

| 类型 | 目录 | 用途 | 例子 |
|---|---|---|---|
| `entity` | `wiki/entities/` | 产品、框架、组织、协议、文件规范的画像 | Claude Code、OpenClaw、Hermes、AGENTS.md |
| `concept` | `wiki/concepts/` | 稳定概念和机制 | Harness Engineering、渐进式披露、上下文压缩 |
| `comparison` | `wiki/comparisons/` | 多产品、多方案并排判断 | OpenClaw vs Claude Code vs Hermes |
| `timeline` | `wiki/timelines/` | 范式、产品或决策演进 | Agent Harness 设计演进 |
| `lesson` | `wiki/lessons/` | 已验证的坑、反模式、不要再犯的错误 | 只写 Prompt 不做权限/恢复 |
| `topic` | `wiki/topics/` | 跨页面专题综述 | 中文社区 66 篇共识 |

## 3. 强制触发器

### 3.1 单篇即升级

命中任一条件,不得只入库:

| 素材类型 | 必须升级到 |
|---|---|
| 产品/框架深度拆解 | `entity` + 至少 1 个 `concept` 或 `comparison` |
| 明确提出新机制 | `concept` |
| 明确比较多个产品/方案 | `comparison` |
| 出现演进路径、版本阶段、取舍变化 | `timeline` |
| 明确指出失败路径、风险、反模式 | `lesson` |
| 对现有维度库有影响 | 更新 `wiki/compiled/<product>/_provenance.json` 或覆盖表记录待更新 |

### 3.2 多篇触发

| 条件 | 必须动作 |
|---|---|
| 同主题素材 >= 2 篇 | 新建或更新 `concept` |
| 同主题 wiki 页 >= 3 页 | 新建或更新 `topic` 综述 |
| 同一产品出现 >= 2 篇深度材料 | 新建或更新 `entity` |
| 同一机制跨 >= 3 个产品出现 | 新建或更新 `comparison` |

## 4. SKIP+REASON

不升级必须写进覆盖账本,禁止默默跳过。

合法原因只有这些:

| reason_code | 含义 | 必填字段 |
|---|---|---|
| `covered-by-wiki` | 已被现有 wiki 页完整覆盖 | `covered_by_page` |
| `low-signal` | 只有新闻/转述,没有可复用知识 | `why_low_signal` |
| `duplicate-source` | 与已有原文重复 | `duplicate_of` |
| `pending-human-review` | 需要人工判断立场或敏感内容 | `open_question` |

## 5. 证据消化率

每个成品页必须回答两个问题:

1. 这页用了哪些原文?
2. 每个关键结论来自哪篇原文?

最低要求:

| 页面类型 | 最低要求 |
|---|---|
| `concept` | 至少 3 条“结论 -> 来源”映射 |
| `entity` | 至少 3 条“能力/机制 -> 来源”映射 |
| `comparison` | 每个被比较对象至少 2 条来源映射 |
| `timeline` | 每个节点必须有来源 |
| `topic` | 至少列出覆盖范围、代表来源、未覆盖范围 |

如果 `sources` 里列了原文,但正文没有吸收它,就等于没有沉淀。

## 6. 涟漪更新

新增或大改任一成品页后,必须检查这些受影响位置:

| 改动类型 | 必查 |
|---|---|
| 新增产品/框架实体 | `wiki/index.md`、相关 `comparison`、`compiled/<product>` |
| 新增概念 | 相关 `topic`、相关 `comparison`、维度库 `wiki/schema/` |
| 新增比较 | 被比较产品的 `entity` 页、相关 `topic` |
| 新增教训 | 相关 `concept` 页是否要加“风险/边界” |
| 新增社区统计 | `wiki/analysis/`、作品集报告里的旧数字 |

覆盖账本里要写“已更新”和“待更新”。

## 7. 质量检查

每批入库完成前,至少检查:

| 检查项 | 通过标准 |
|---|---|
| 入口 | 新页面已进入 `wiki/index.md` |
| 来源 | raw 文件真实存在,原链接保留 |
| 证据 | 关键结论能回到原文 |
| 覆盖 | 每篇素材在覆盖账本有去向 |
| 关系 | 每个成品页至少 2 个相关页面 |
| 空洞 | 没有 `TBD`、`待补`、只写“详见原文”的段落 |
| 涟漪 | 影响范围已写明 |

## 8. 完成定义

以后“帮我把文章入库”默认不是只保存原文,而是:

1. 原文保存。
2. 单篇卡提炼。
3. 触发器判定。
4. 成品 wiki 更新。
5. 覆盖账本记录。
6. 涟漪影响检查。
7. 首页索引更新。
8. 日志记录。

只有 8 步都完成,才算“入库完成”。

