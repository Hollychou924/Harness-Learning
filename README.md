# AI Agent 研究与实践工作台

这个仓库是一个人（周浩）用来研究 AI Agent、并亲手实践做 Agent 的工作台。它不是单一项目，而是三件事放在一起，互相喂料：

- **看别人怎么做** → 竞品分析知识库（26 款 Agent 产品的资料库）
- **想清楚为什么这么做** → Harness 方法论文章系列（9 篇深度文章）
- **自己动手做** → 桌面端 Agent 实践项目（小蓝鲸桌面 Agent）

三件事的关系：先看竞品学到设计 → 写文章把设计想透 → 自己做一遍验证设计。

---

## 一句话导航：我要找的东西在哪

| 我想… | 去这个文件夹 |
|---|---|
| 看 26 款 Agent 产品的资料和评测 | `research/` |
| 看 Agent 设计的方法论文章 | `articles/` |
| 看自己做桌面 Agent 的设计文档 | `projects/desktop-agent/docs/` |
| 看自己以前做的手机 Agent 源码 | `projects/mobile-agent/` |
| 看竞品分析管道的代码（采集/对比/报告） | `pipeline/` |
| 看怎么跑这些代码 | 本文件「快速开始」 |
| 看应聘 DeepSeek 的材料 | `docs/job-application/` |

---

## 目录结构（扫一眼就懂版）

```
ai-agent-competitive-analysis/
│
├── 📚 research/        竞品知识库——26款Agent产品的资料都在这
├── ✍️ articles/        文章系列——9篇"AI产品经理读懂Harness"
├── 🛠️ projects/        实践项目——自己动手做Agent
│   ├── desktop-agent/    小蓝鲸桌面Agent(开发中)
│   ├── mobile-agent/     手机端Agent(参考用)
│   └── reference/        内部参考仓库(只看不提交)
│
├── ⚙️ pipeline/        竞品分析管道的全部代码
│   ├── core/             核心逻辑(知识中枢/追踪/对比)
│   ├── sources/          数据采集器(4层:官方/雷达/搜索/通知)
│   ├── renderers/        输出渲染(MD/HTML/PPT/飞书)
│   ├── cli/              命令行入口
│   └── products/         产品清单配置
│
├── 📝 docs/            项目自身的规划/运维/应聘材料
├── 🧪 tests/           测试
├── 📋 scripts/         脚本工具
└── 📄 README.md        你正在看的这个
```

每个一级目录里都有自己的 `README.md`，点进去一句话说清装什么。

---

## 📚 research/ — 竞品知识库

26 款 AI Agent 产品（14 通用 + 12 编码）的资料库。详见 `research/README.md`。

关键子目录：`entities/`（产品档案）、`compiled/`（评测卡）、`raw/`（原始素材）、`topics/`（主题研究）、`reports/`（生成的报告）。

## ✍️ articles/ — Harness 方法论文章

《AI 产品经理读懂 Harness》9 篇系列。详见 `articles/README.md`。

## 🛠️ projects/ — 实践项目

详见 `projects/README.md`。`desktop-agent/docs/` 里有 8 份开工前契约文档（架构反思/设计基线/技术选型/数据契约/权限规则/验收规格/评测基线/跨端协议）。

## ⚙️ pipeline/ — 竞品管道代码

详见 `pipeline/README.md`。

---

## 快速开始（竞品管道部分）

```bash
# 安装
uv sync --all-extras

# 初始化知识库
uv run wiki init

# 跑测试
uv run pytest

# 编译 P0 产品（Path A）
uv run wiki compile --only claude-code,cursor,codex,hermes,manus

# 每日变更增量（Path B）
uv run wiki path-b --threshold 0.5
uv run wiki notify

# 按需对比报告（Path C）
uv run wiki compare claude-code cursor --formats markdown,html

# PM 作品集报告（Phase 4）
uv run wiki portfolio --theme harness-design --products claude-code,cursor,codex
```

---

## 三块产出的当前状态

| 模块 | 状态 |
|---|---|
| 竞品知识库（research + pipeline） | Phase 5 进行中（7 产品编译 + 7 篇报告 + harness 知识深化） |
| Harness 文章系列（articles） | 9 章大纲完成，写作中 |
| 小蓝鲸桌面 Agent（projects/desktop-agent） | 开工前 8 份契约文档就绪，待编码 |

---

## 给陌生 AI 的说明

如果你是接手这个仓库的 AI 助手：
1. 先读本 README 理解三块结构，再看各目录的 `README.md`。
2. 涉及桌面 Agent 开发，必读 `projects/desktop-agent/docs/` 全部文档，按技术选型约束干活。
3. `projects/reference/` 仅供分析，不得复制其源码进 `projects/desktop-agent/`。
4. `projects/mobile-agent/` 是已验证的参考实现，设计思路可借鉴。
5. AGENTS.md（若在子目录）的指令在该目录范围内生效。
