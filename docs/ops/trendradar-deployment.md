# TrendRadar 部署运维文档

> 本文档指导如何 fork [sansan0/TrendRadar](https://github.com/sansan0/TrendRadar)（58k+ stars 的中文社媒热搜聚合器），配置成我们竞品分析工作流的 L1 信号源。
>
> **架构定位**：TrendRadar 是 ADR A3 选定的"独立部署"模式 — 不集成进我们主仓库，而是作为外部信号源运行，输出 JSON 给我们的 `adapters/layer1_radar/trendradar.py` 适配器消费。

---

## 1. 概览

### 上游 TrendRadar 的能力

- **聚合 30+ 中文热榜平台**：微博、知乎、百度、今日头条、抖音、B 站等
- **关键词过滤**：通过 `frequency_words.txt` 配置我们关注的产品名
- **多渠道推送**：企业微信、钉钉、飞书、Telegram、Bark 等
- **历史归档**：每日 SQLite db 存到 `output/news/{YYYY-MM-DD}.db`
- **GitHub Pages**：仓库默认开启 Pages，可作为 JSON 输出 host

### 我们消费它的方式

```
TrendRadar Fork (你的 GitHub 账号)
   ↓ GitHub Actions cron (每日)
   ↓ 抓取热榜
   ↓ 过滤关键词 (我们 26 产品名)
   ↓ 写入 output/news/{date}.db
   ↓ [新增] 导出 JSON 到 docs/output.json (gh-pages branch)
                                  ↓
                          GitHub Pages URL
                                  ↓
   我们的 adapters/layer1_radar/trendradar.py
   ↓ 通过 TRENDRADAR_OUTPUT_URL env var 配置该 URL
   ↓ httpx 拉取 JSON
   ↓ 转 ChangelogEntry → SignalAggregator
```

---

## 2. 部署步骤

### 2.1 Fork 仓库

1. 访问 https://github.com/sansan0/TrendRadar
2. 点击右上角 Fork → Fork to your account (e.g. `<your-github>/TrendRadar`)
3. 取消勾选 "Copy the master branch only"（保留全部 branch 包括 gh-pages）

### 2.2 配置关键词（最重要）

编辑 `config/frequency_words.txt`，**WORD_GROUPS** 区添加我们 26 个产品的关键词：

```
[WORD_GROUPS]

# 通用 Agent 重点 (P0)
Claude Desktop
Claude Cowork
Codex Desktop
Manus
OpenClaw
Hermes
QoderWork
Marvis

# 编码 Agent 重点 (P0)
Claude Code
Cursor
OpenCode
GitHub Copilot
Trae
antigravity

# 长尾 (P1/P2) 选填
Cline
Windsurf
Devin
Aider
CodeBuddy
文心快码
Open Interpreter
Trae solo
WorkBuddy
Miclaw PC
LobsterAI
AutoClaw
EasyClaw

[GLOBAL_FILTER]
# 排除常见误命中
震惊
博彩
赌博
```

> **关键词调优 tip**：避免单字关键词（如 "Codex" 单独不行，会命中"密码学"等无关内容）。TrendRadar 支持 `/正则/` 语法。中文关键词可写 `/Codex|OpenAI Codex/` 这种组合。

### 2.3 配置基础设置

编辑 `config/config.yaml`：

```yaml
app:
  timezone: "Asia/Shanghai"  # 我们运维以北京时间为准
  show_version_update: true

# 我们不用 TrendRadar 的推送，全程用 JSON 拉取
schedule:
  enabled: false  # 关闭调度，所有信号一并落到日 db

# 数据源 — 启用 AI/科技类强相关平台，关掉娱乐八卦
sources:
  weibo: { enabled: true }
  zhihu: { enabled: true }
  baidu: { enabled: true }
  toutiao: { enabled: true }
  bilibili: { enabled: true }
  github: { enabled: true }    # ⭐ GitHub 热榜很重要,记得开
  douyin: { enabled: false }
  xiaohongshu: { enabled: false }
```

### 2.4 配置 GitHub Actions（自动运行）

TrendRadar 默认带了 `.github/workflows/`，但 fork 时 GH Actions 默认禁用。需要手动启用：

1. 进入你的 fork 仓库 → **Actions** 标签页
2. 点击绿色按钮 **"I understand my workflows, go ahead and enable them"**
3. 找到 `Daily News` 或类似名字的 workflow → 点 **Enable workflow**

如果 TrendRadar 升级了 workflow 命名，看 `.github/workflows/` 目录第一个 `*.yml`。

### 2.5 添加 JSON 导出步骤（关键）

TrendRadar 默认输出 SQLite，**我们的 trendradar.py adapter 期待 JSON**。需要在 fork 里加一个后处理脚本。

#### 步骤 a：创建 `scripts/export_json.py`

```python
#!/usr/bin/env python3
"""Export TrendRadar's daily SQLite to a flat JSON for downstream consumers.

Output: docs/trendradar-output.json (committed to gh-pages or main, served via GitHub Pages).
"""
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

OUTPUT_DIR = Path("output/news")
EXPORT_PATH = Path("docs/trendradar-output.json")
LOOKBACK_DAYS = 7

def collect_recent_items() -> list[dict]:
    items = []
    for db_path in sorted(OUTPUT_DIR.glob("*.db"))[-LOOKBACK_DAYS:]:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        try:
            for row in conn.execute(
                "SELECT title, url, platform, score, created_at FROM news "
                "WHERE matched_keyword IS NOT NULL "
                "ORDER BY score DESC LIMIT 200"
            ):
                items.append({
                    "title": row["title"],
                    "url": row["url"],
                    "platform": row["platform"],
                    "publishedAt": row["created_at"],
                    "score": float(row["score"]) if row["score"] else 0.0,
                })
        finally:
            conn.close()
    return items

def main() -> None:
    items = collect_recent_items()
    EXPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    EXPORT_PATH.write_text(
        json.dumps({"items": items, "exported_at": datetime.now(timezone.utc).isoformat()}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"exported {len(items)} items to {EXPORT_PATH}")

if __name__ == "__main__":
    main()
```

> **注意**：上面 SQL 字段名 (`title`, `url`, `platform`, `score`, `created_at`, `matched_keyword`) 是基于 TrendRadar v2.2 的推断，**部署时实测 db schema 可能要微调**。用 `sqlite3 output/news/2026-05-22.db ".schema"` 实地查一下。

#### 步骤 b：修改 `.github/workflows/daily.yml`（在抓取步骤后追加）

```yaml
      - name: Export to JSON
        run: python scripts/export_json.py
      
      - name: Commit JSON output
        run: |
          git config user.email "actions@github.com"
          git config user.name "github-actions[bot]"
          git add docs/trendradar-output.json
          git diff --staged --quiet || git commit -m "chore: update trendradar-output.json $(date -u +%Y-%m-%d)"
          git push || true
```

### 2.6 启用 GitHub Pages

1. Settings → Pages
2. Source: **Deploy from a branch**
3. Branch: `master` / Folder: `/docs`
4. 保存后等 1-2 分钟,JSON 即可访问:
   ```
   https://<your-github>.github.io/TrendRadar/trendradar-output.json
   ```

### 2.7 在主仓库配置环境变量

回到 `ai-agent-competitive-analysis` 仓库:

**本地开发**：
```bash
export TRENDRADAR_OUTPUT_URL="https://<your-github>.github.io/TrendRadar/trendradar-output.json"
```

**GitHub Actions** (Settings → Secrets and variables → Actions → New repository secret):
- Name: `TRENDRADAR_OUTPUT_URL`
- Value: 上面的 URL

我们的 `.github/workflows/daily-changelog.yml` (T28) 已经引用了这个 secret。

---

## 3. 验证部署

### 3.1 等第一次自动运行（24h 内）

TrendRadar 默认 cron 跑一次/天。耐心等 1 天,或者手动触发：

1. 进入 fork 仓库 → Actions
2. 选 Daily News workflow → Run workflow
3. 等 5-10 分钟跑完

### 3.2 检查 JSON 输出

```bash
curl -sL https://<your-github>.github.io/TrendRadar/trendradar-output.json | jq '.items[0:3]'
```

应看到类似：
```json
[
  {
    "title": "Claude Code 又出新功能",
    "url": "https://www.zhihu.com/question/123",
    "platform": "zhihu",
    "publishedAt": "2026-05-23T12:00:00Z",
    "score": 0.87
  }
]
```

### 3.3 在主仓库测试 adapter

```bash
cd ai-agent-competitive-analysis
export TRENDRADAR_OUTPUT_URL="https://<your-github>.github.io/TrendRadar/trendradar-output.json"
uv run python -c "
import asyncio, httpx
from adapters.layer1_radar.trendradar import fetch_trendradar_signals

async def main():
    async with httpx.AsyncClient() as client:
        entries = await fetch_trendradar_signals(client, keywords=['Claude Code', 'Cursor'])
    print(f'fetched {len(entries)} entries')
    for e in entries[:3]:
        print(f'  - {e.title} ({e.raw_metadata[\"platform\"]})')

asyncio.run(main())
"
```

预期输出：`fetched N entries` (N 取决于关键词命中)。

---

## 4. 监控与维护

### 4.1 每周检查

- [ ] JSON URL 仍可访问 (curl 200 OK)
- [ ] `output/news/{今日}.db` 存在
- [ ] `docs/trendradar-output.json` 的 `exported_at` 时间戳是最近 24h
- [ ] 主仓库 daily-changelog workflow 没有 TrendRadar 相关 warning

### 4.2 关键词调优周期

每月 review `frequency_words.txt`：
- 查看 `wiki/log.md` 里 path-b 命中率
- 如果某产品长期 0 命中 → 加更广的关键词或同义词
- 如果误命中多 → 加 GLOBAL_FILTER 排除项

### 4.3 跟进上游更新

```bash
cd TrendRadar
git remote add upstream https://github.com/sansan0/TrendRadar.git
git fetch upstream
git merge upstream/master  # 注意保留我们的 frequency_words.txt 和 export_json.py
```

如果上游 db schema 改了,`scripts/export_json.py` 的 SQL 也要相应改。

---

## 5. 故障排查

| 症状 | 可能原因 | 排查 |
|---|---|---|
| `fetch_trendradar_signals` 返回 [] | env var 未设 / URL 404 / JSON 格式不对 | `curl <URL>` 检查、`jq '.items[0]'` 验证字段 |
| JSON `items` 为空 | 关键词没命中任何热榜 | 看 `output/news/{date}.db` 有数据但全 `matched_keyword IS NULL` |
| GitHub Pages 显示 404 | Pages 没启用 / 路径错 | Settings → Pages 确认 Source 是 master/docs |
| GitHub Actions 失败 | Python 版本/依赖问题 | Actions 日志看具体错;TrendRadar 一般要 Python 3.9+ |
| db schema 变了导致 export_json 报错 | 上游升级 | `sqlite3 output/news/<date>.db ".schema"` 看真实字段对照修改 SQL |

---

## 6. 替代方案（如果 fork 部署嫌麻烦）

### 6.1 跳过 TrendRadar，仅用 AIHOT + wechat-search

这两个 L1 源已经覆盖 70% 的中文 AI 资讯需求。我们的 `sync_path_b` 在 TrendRadar 不可用时(`TRENDRADAR_OUTPUT_URL` 未设) 会优雅降级返回 [],不影响整体运转。

### 6.2 自建 TrendRadar（Docker）

如果想完全控制:

```bash
git clone https://github.com/<your-github>/TrendRadar.git
cd TrendRadar
docker build -t trendradar .
docker run -d \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/output:/app/output \
  --name trendradar \
  trendradar
```

然后用 cron 每日 `docker exec trendradar python scripts/export_json.py` + `scp` 推到任意静态站。

---

## 附录：参考链接

- TrendRadar 主仓库: https://github.com/sansan0/TrendRadar
- 可视化配置编辑器: https://sansan0.github.io/TrendRadar/
- 我们 adapter 源码: `adapters/layer1_radar/trendradar.py`
- 我们 Phase 2 plan: `docs/superpowers/plans/2026-05-24-phase2-changelog-incremental.md` Task 21
- 我们 ADR A3: `docs/superpowers/specs/2026-05-23-ai-agent-competitive-analysis-design.md` 附录 B
