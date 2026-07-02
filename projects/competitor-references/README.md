# competitor-references/ — 本地竞品参考项目总库

> 日常说法"竞品项目""参考项目""同类产品"都指向本目录。

这里统一存放所有本地可分析的 AI Agent 竞品/参考项目源码。

包含两类：
- 公开开源项目：从公开仓库拉取，用于竞品对比和设计参考。
- 本地学习项目：已有的学习/实验项目，用于补充参考。

## 目录结构

本目录按 6 类物理分目录存放，进入后先读 `_category-index.md`（总索引），
再进入子目录读 `_category.md`（分类说明）。

```
competitor-references/
├── _category-index.md            分类总索引（AI 第一入口）
├── 01-desktop-apps/              PC 桌面应用（8 个）
├── 02-cli-terminals/             CLI / 终端工具（5 个）
├── 03-cli-multi-form/            CLI 为主、多形态扩展（6 个）
├── 04-agent-frameworks/          Agent 框架 / 库（3 个）
├── 05-selfhosted-web/            自托管 / Web 平台（2 个）
├── 06-multi-platform-engine/     多端综合 / 后端引擎（2 个）
├── README.md                     本文件
├── repos.yaml                    项目源地址登记
└── .gitignore                    忽略源码，只提交说明文件
```

## 分类速查

| 编号 | 目录 | 类别 | 数量 |
|------|------|------|------|
| 01 | `01-desktop-apps/` | PC 桌面应用 | 8 |
| 02 | `02-cli-terminals/` | CLI / 终端工具 | 5 |
| 03 | `03-cli-multi-form/` | CLI 为主多形态扩展 | 6 |
| 04 | `04-agent-frameworks/` | Agent 框架 / 库 | 3 |
| 05 | `05-selfhosted-web/` | 自托管 / Web 平台 | 2 |
| 06 | `06-multi-platform-engine/` | 多端综合 / 后端引擎 | 2 |

合计 **26 个**项目（25 个公开开源 + 1 个本地学习项目 claude-code）。

各分类的共性特征、包含项目、逐个定位，见对应子目录的 `_category.md`。

## 规则

- 这里的源码只在本机分析，不提交到当前仓库（.gitignore 已忽略）。
- 新项目小蓝鲸不能直接复制这些源码，只能借鉴设计思路。
- claude-code 是本地学习项目，不是泄露源码。
- 每个子目录的 `_category.md` 和本目录的 `_category-index.md` 会提交，用于 AI 导航。

## 待补充

- **DeepSeek-GUI**：即 Kun 改名前的旧名，已归入 `01-desktop-apps/Kun`，无需重复拉取。
