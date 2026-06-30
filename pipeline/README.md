# pipeline/ — 竞品分析管道（代码）

把 26 款 AI Agent 产品的资料自动采集、整理、对比、输出报告的全部代码。

| 子目录 | 作用 |
|---|---|
| `core/` | 核心逻辑包：知识中枢(llm_wiki)、追踪器(ai_agent_research)、对比引擎(competitive_analysis)、数据结构(schemas) |
| `sources/` | 数据采集器，分 4 层：L0 官方源 / L1 雷达 / L2 搜索交叉验证 / L3 飞书通知 |
| `renderers/` | 输出渲染：Markdown / HTML / PPTX / 飞书同步 |
| `cli/` | 命令行入口，`wiki` 命令在这里 |
| `products/` | 产品清单配置（yaml） |

跑法见根 README 的「快速开始」。
