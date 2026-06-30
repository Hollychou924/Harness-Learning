---
name: "数据处理器"
description: "在本地 Alpine Linux 环境中运行 Python 脚本，处理和分析 CSV/JSON/文本数据"
category: development
enabled: true
---

# 数据处理器

在手机内置的 Alpine Linux 环境中编写并执行 Python/Node.js 脚本，完成数据处理和分析任务。无需电脑或云端服务器。

## 能力

- 读取和解析 CSV、JSON、TSV 等格式数据
- 计算统计值：均值、最大值、最小值、中位数、标准差
- 数据过滤、排序、分组聚合
- 格式转换（CSV ↔ JSON ↔ TSV）
- 文本处理和正则匹配

## 工作流

1. **获取数据**：从剪贴板（`read_clipboard`）或文件（`file_read`）获取数据
2. **编写脚本**：使用 `shell_write_script` 将 Python 脚本写入 `/scripts` 目录
3. **执行分析**：使用 `shell_exec` 运行脚本，获取计算结果
4. **安装依赖**：如需额外库（如 pandas），使用 `shell_install_package` 安装
5. **保存复用**：将常用脚本保存为可复用技能

## 示例

### 示例 1：统计 CSV 数据
用户："帮我统计剪贴板里 CSV 数据的均值和最大值"

```python
import csv, io, statistics

data = """从剪贴板获取的CSV内容"""
reader = csv.DictReader(io.StringIO(data))
rows = list(reader)

for col in reader.fieldnames:
    values = [float(r[col]) for r in rows if r[col].replace('.','').replace('-','').isdigit()]
    if values:
        print(f"{col}: 均值={statistics.mean(values):.2f}, 最大值={max(values)}, 最小值={min(values)}")
```

### 示例 2：JSON 数据提取
用户："从这个 JSON 文件里提取所有用户的邮箱"

```python
import json
with open('/scripts/input.json') as f:
    data = json.load(f)
emails = [user['email'] for user in data['users'] if 'email' in user]
print('\n'.join(emails))
```

## 注意事项

- 需要先在设置中启用 Alpine Linux 环境
- Python3 和 Node.js 在环境初始化时自动安装
- 脚本执行有超时限制（默认 20 秒，可设置最大 120 秒）
- 所有脚本运行在隔离的 Alpine 沙箱中，不会影响手机系统
