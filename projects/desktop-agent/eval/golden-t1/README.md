# Golden-T1

样板任务族 T1 的黄金回归集。定义见 `docs/20-m0-execution-baseline.md`。

## 规则

- case 正文 **禁止**进入 system prompt / tactic 示例（防刷分）
- 发布门禁：全量回跑零退化（M1）
- 优先从真实 badcase 增长到 20+

## 本地校验

```bash
cd projects/desktop-agent
pnpm test:evolution
pnpm test:golden-t1              # schema，≥20 cases
pnpm test:golden-t1-batch        # fixture 基线期望 + oracle 上界
pnpm test:golden-t1-agent-stub   # stub Agent（oracle 补丁）一次成功率
# live（真烧 Token，需显式开关）：
# XIAOLANJING_AGENT_BATCH=1 XIAOLANJING_API_KEY=sk-... pnpm test:golden-t1-agent-live
```

当前：**20** 条均可跑 fixture（001–020）+ 对应 oracle（003/005 为已绿基线，无需 oracle）。
