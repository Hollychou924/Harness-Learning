---
id: first-principles-and-adversarial-review
type: lesson
status: active
updated: 2026-06-30
source:
  - https://mp.weixin.qq.com/s/umPqTD_-IubbhXIgiS47eQ（卡兹克《分享2个Vibe Coding必备的超实用Prompt》）
  - 项目落地：根目录 CLAUDE.md、.claude/commands/{first-principles,adversarial-review,full-audit}.md
owners: ["zhouhao"]
---

# 第一性原理 + 对抗式审查：Vibe Coding 两大基石

## 来源

卡兹克 2026-06-29 文章《分享2个Vibe Coding必备的超实用Prompt》。作者是AIHOT的作者（非专业程序员，纯Vibe Coding做出周请求千万级的产品），分享自己用了近一年、频率最高的两个神级Prompt。

## 核心思想

两个Prompt构成一个闭环：**前者管生成，后者管验证**。

### 1. 第一性原理（"从第一性原理出发"）

- **用法**：在修bug、做方案、找问题时，在Prompt最后加一句"从第一性原理出发"。
- **作用**：强制打断AI的类比推理（AI倾向于在训练数据里找类似方案拼一个），逼它回到最基本的事实重新推导。
- **案例**：AIHOT飞书推送事故，表层原因是"测试国产模型时改坏了OpenAI抓取"；从第一性原理重查后，发现底层流量路由存在了两个月的深层隐患，花半天重构，从机制上根除未来风险，而不是继续给破船打补丁。
- **本质**：回到最根本的事实重新推导，不接受行业惯例和"大家都是这么做的"作为理由。

### 2. 对抗式审查

- **用法**：开发完/上线前，让多个Agent并发站在"我要用各种奇怪数据搞崩你"的视角挑毛病。Claude Code用动态工作流（Ultracode）、Codex直接说"开启多Agent对抗审查"。
- **作用**：作者自陈"不懂代码，只能靠AI"，Vibe Coding产物天然漏洞多；对抗式审查能挖出自己写代码时根本想不到的边界。
- **案例**：6月审查找出：OOM死循环（大任务爆内存被系统杀→自动重试→再爆）、未来时间污染（信源时区错导致"明天的文章"排到信息流最前面污染所有渠道）、HTML清洗性能炸弹、翻译模块同类隐患、部署探活缓存穿透假阳性等。
- **定期化**：作者每2-3周做一次"从第一性原理出发的全局对抗式审查"，顺便测试新模型能力，每次都能挑出没注意的技术债和风险。

## 为什么对我们有用

我们这个项目（AI Agent竞品分析wiki + 自动化抓取管道）的特点：
- 主要写作者/产品经理就是自己，不是专业后端，很多代码靠Vibe Coding出来；
- 有大量外部输入（微信、RSS、官方博客），脏数据/异常/注入风险天然高；
- 产物是wiki和发布文章，数据污染/事实错误/半成品残留的后果是直接输出给读者看；
- 目前项目还缺系统化的"交卷前自检"和"定期体检"机制。

这两个思维模型正好补上这两个缺口。

## 怎么落地到本项目

已经落地的三件事：

1. **根目录 `CLAUDE.md`**：把两个思维模型作为默认工作习惯写进去，而不是要每次手打。所有Claude Code会话启动时自动加载。里面规定了：
   - 什么情况下必须用第一性原理（修bug、做方案、看到"看起来修好了"的patch时）
   - 对抗式审查必须覆盖的6个维度（异常边界、资源性能、正确性、文档一致性、回归、安全）
   - 每2-3周一次全局审计的组合流程
   - 真出事故后必须做的两件事：写复盘、沉淀为测试/检查点防复发

2. **三个斜杠命令**（`.claude/commands/`）：
   - `/first-principles`：停下来查事实→剥洋葱找根因→给治标/治本两方案→汇报确认后再改，禁止"看到报错就改那一行"。
   - `/adversarial-review`：并发启动5-6个视角的子Agent（攻击者/挑剔用户/未来维护者/性能/回归/注入），交叉验证去重，分P0/P1/P2，直接修P0，并且每个P0都要沉淀为防线（测试/lint/检查点）。
   - `/full-audit`：组合大招，分5个Phase，先做第一性原理复盘，再分模块并发对抗审查，再识别技术债hotspot和方向偏航，输出报告到wiki/reports/on-demand/，修完P0并沉淀防线。

3. **本lesson文件**：沉淀来源和思考，方便以后回溯为什么这样设计。

## 反模式提醒

- 第一性原理 ≠ 每次都重写。紧急止血用治标方案没问题，但要明确告知"这是A方案，B方案治本建议什么时候做"。
- 对抗式审查 ≠ 让一个Agent自审。必须是多Agent并发多视角，然后交叉验证；单个Agent自审经常"自我感觉良好"。
- full-audit 是重操作，会消耗大量token，不要默认触发，2-3周一次、大功能后、事故后、新模型测试时用。

## 可延伸的方向

- 未来可以把 `/adversarial-review` 做进git pre-push hook 或 CI，每次提交自动跑轻量版对抗审查；
- 可以给wiki文章写作也做一个对抗式审查视角（事实准确性、逻辑漏洞、过时引用、论证力度）；
- P0沉淀防线这条机制可以和tests/、review/queue串起来，形成"出bug→加测试→以后自动拦住"的闭环。

## 2026-06-30 更新：改为全局生效

之前落地在单个项目里是错的，会被全局配置覆盖。现在已经改为全局生效，打开任何项目都自动带上这两条思维习惯：

**全局配置位置：**
- Claude Code: `~/.claude/CLAUDE.md`（追加了中文版本的两大基石段），命令在 `~/.claude/commands/{first-principles,adversarial-review,full-audit}.md`
- Codex CLI: `~/.codex/AGENTS.md`（追加了产品语言版本的两大习惯段，保留原有的小爱PM沟通铁律），命令在 `~/.codex/prompts/{first-principles,adversarial-review,full-audit}.md`
- OpenCode: `~/.config/opencode/AGENTS.md`（追加了英文版本，因为该文件原本是英文CodeGraph块）
- 原项目（ai-agent-competitive-analysis）内误建的项目级 CLAUDE.md 和 .claude/commands 已删除，避免覆盖全局。

**使用方式：**
- 不用显式说什么，Agent默认就会按这两个习惯做事（写在全局指令里）；
- 想主动触发：直接说"从第一性原理出发帮我看一下"、"对这个做对抗式审查"、"做一次全局体检/full-audit"即可；
- 也可以用斜杠命令：`/first-principles`、`/adversarial-review`、`/full-audit`（Claude Code和Codex都支持）。

**备份：**
三份原文件都做了带时间戳的备份：`*.bak-20260630-003448`，如果发现问题可以随时回滚。
