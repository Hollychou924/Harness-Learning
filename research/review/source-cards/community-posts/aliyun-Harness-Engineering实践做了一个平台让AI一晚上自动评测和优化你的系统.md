---
id: source-card-community-aliyun-Harness-Engineering实践做了一个平台让AI一晚上自动评测和优化你的系统
type: source-card
status: triaged
source: wiki/raw/community-posts/aliyun-cloud-developer/2026-04-29-Harness-Engineering实践做了一个平台让AI一晚上自动评测和优化你的系统.md
updated: 2026-05-26
---

# 阿里云开发者文章卡 · Harness Engineering实践，做了一个平台让AI一晚上自动评测和优化你的系统

## 原文信息

- 来源: 阿里云开发者 微信公众号
- 作者: 凤聆
- 发布时间: 2026/04/29 08:30:00
- URL: https://mp.weixin.qq.com/s/UhWYE_XTQcFVmoSt8aosyg
- 原文: [raw](../../../raw/community-posts/aliyun-cloud-developer/2026-04-29-Harness-Engineering实践做了一个平台让AI一晚上自动评测和优化你的系统.md)

## 关键线索

| 线索 | 命中次数 |
|---|---:|
| 评测/反馈 | 122 |
| OpenClaw/Claude/Hermes | 14 |
| MCP/工具 | 10 |
| Skills/技能 | 6 |
| Agent/智能体 | 2 |
| Harness/驾驭 | 1 |
| Prompt/提示词 | 1 |
| 阿里/通义/百炼 | 1 |

## 内容结构

- 说起评测平台，大家想到的，都是先定义好要做什么评测任务，然后去收集一些评测集，用评测集进行任务的回放和评测指标的观测，最后拿到评测结果，这个是一个很自然的评测流程。
- 但很快遇到一个痛点：人去做评测集的收集很苦很累，评测的进行也很烧时间，评测同学的意愿也并不是很强。
- 现在AI时代，自然就会想着AI First，能否定义好评测任务，让AI自主的去生成评测集，并且自主的模拟用户去运行这些评测，最终生成评测报告，乃至于最终能够基于评测报告优化系统，并且继续持续往复的进行过程。
- 这种AI First的理念，落到平台上，其实尽量就是只允许AI操作，人是无法操作的，从入口层面杜绝了人去干苦力活，如下图所示，玩法其实很简单，平台分不同的工作空间，然后复制这个技能说明，到自己的AI Agent里去（（本地的cc、codex、qoderwork、悟空等等都可以），就可以发布评测任务、让AI认领评测任务去生成评测集、基于评测集评测、提交评测报告等等工作。

## 触发器判定

- 触发器: 阿里云开发者社区材料,围绕 Agent 工程、通义/百炼/Lingma 实践、Harness、Multi-Agent、Memory、Skills、Spec 等主题。
- 当前状态: triaged, 已进入阿里云开发者合集账本；核心结论由合集 topic 汇总并指向 Harness、Skills、Memory、评测等概念页。

## 已沉淀去向

- [topics/aliyun-cloud-developer-agent-collection.md](../../../topics/aliyun-cloud-developer-agent-collection.md)
- [concepts/harness-engineering.md](../../../concepts/harness-engineering.md)
- [concepts/progressive-disclosure.md](../../../concepts/progressive-disclosure.md)
- [concepts/spec-driven-agent-development.md](../../../concepts/spec-driven-agent-development.md)
- [topics/agent-evaluation-system.md](../../../topics/agent-evaluation-system.md)

## 待升级 / 待复核

- 进入概念页或竞品报告写作时按本文核验证据粒度。
