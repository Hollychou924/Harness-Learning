---
name: "旅行规划"
description: "规划城市旅行路线，生成景点地图和游玩时间建议。当用户提到旅游规划、景点推荐、游玩路线、旅行地图、城市观光、X日游、景点距离、方位标注、推荐游玩时间等时，必须使用此技能。特别适用于'去南京玩2天'、'帮我规划上海行程'、'推荐北京必去景点并画路线图'等具体需求。"
category: travel
enabled: true
---

# Travel Planner Skill

为城市旅行规划路线，生成可视化景点地图，计算景点间的距离和方位，并提供每个景点的推荐游玩时间。

## 触发条件

当用户请求：
- "帮我规划XX城市的旅行路线"
- "推荐XX的热门景点"
- "X日游攻略"
- "景点之间的距离和方位"
- "画一个旅行路线图"
- "推荐游玩时间"

**必须**使用此技能。即使用户没有明确要求"规划"，只要涉及城市旅游、景点推荐、行程安排，就应主动触发。

## 核心工作流程

### 1. 收集信息（使用web_fetch）
- 搜索城市热门景点（如："南京热门景点 排名"）
- 获取景点开放时间、门票信息
- 提取景点地理坐标（经纬度）

### 2. 计算距离和方位（使用Python脚本）
```python
# 计算两点间距离（Haversine公式）
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # 地球半径（km）
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# 计算方位角（从点1到点2）
def bearing(lat1, lon1, lat2, lon2):
    dlon = math.radians(lon2 - lon1)
    lat1 = math.radians(lat1)
    lat2 = math.radians(lat2)
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.atan2(x, y)
    return (math.degrees(bearing) + 360) % 360
```

### 3. 生成路线图（使用matplotlib）
- 绘制城市地图背景
- 标注景点位置
- 连接路线，显示距离和方向
- 添加图例和时间标注

**必须自动打开图片**：生成图片后，立即执行 `open <图片路径>`。

### 4. 推荐游玩时间
根据景点类型、规模和用户时间约束，给出每个景点的建议游玩时长（单位：小时）。

## 输出格式

### 1. 行程概览表格
| 天数 | 景点顺序 | 景点名称 | 推荐游玩时间 | 距离（与上一个景点） | 方位 | 备注 |
|------|----------|----------|--------------|----------------------|------|------|
| Day 1 | 1 | 景点A | 2小时 | - | - | 开放时间 |
| Day 1 | 2 | 景点B | 1.5小时 | 3.2km | 东南 | 需要门票 |

### 2. 路线图
- 图片文件：`/Users/wanglinjie/Desktop/travel_route.png`
- 自动打开查看
- 包含：景点标注、路线箭头、距离标签、方位指示

### 3. 详细建议
- 交通方式建议
- 用餐推荐（如适用）
- 注意事项

## 实现步骤（当调用此技能时）

1. **询问确认**：确认城市、天数、偏好（如"历史文化"、"自然风光"、"美食探店"）
2. **搜索景点**：使用 `web_fetch` 搜索"XX市 热门景点 Top 10"
3. **获取坐标**：对于每个景点，搜索"XX景点 经纬度"或使用 `web_fetch` 到地图API
4. **计算路线**：按天数划分，优化游览顺序（如按地理位置聚类，减少折返）
5. **生成地图**：使用Python + matplotlib绘图
6. **输出结果**：提供表格、图片和文字建议

## Python绘图脚本模板

```python
import matplotlib.pyplot as plt
import matplotlib
import numpy as np
from matplotlib.patches import FancyArrowPatch

# 设置中文字体
matplotlib.rcParams["font.sans-serif"] = ["PingFang SC", "Heiti SC", "SimHei", "Arial Unicode MS"]
matplotlib.rcParams["axes.unicode_minus"] = False

# 创建图形
fig, ax = plt.subplots(figsize=(12, 10))

# 绘制景点
# 绘制路线箭头
# 添加标注

plt.title("XX城市X日游路线图", fontsize=16)
plt.xlabel("经度")
plt.ylabel("纬度")
plt.legend()
plt.grid(True, alpha=0.3)

# 保存并打开
output_path = "/Users/wanglinjie/Desktop/travel_route.png"
plt.savefig(output_path, dpi=150, bbox_inches='tight')
plt.close()

# 自动打开
import subprocess
subprocess.run(["open", output_path])
```

## 注意事项
- 如果用户只说"XX城市X日游"，主动询问偏好和约束
- 优先选择免费或低门票景点（除非用户指定）
- 考虑景点之间的交通便利性
- 天气因素可集成 `weather` 技能获取实时天气

## 示例输出（南京2日游）
```
Day 1:
1. 中山陵 (推荐2.5小时) - 明孝陵附近
2. 明孝陵 (推荐2小时) - 距中山陵 1.2km，东南
3. 夫子庙-秦淮河风光带 (推荐3小时) - 距明孝陵 5.8km，西南

Day 2:
1. 玄武湖公园 (推荐2小时) - 夫子庙附近
2. 南京总统府 (推荐2小时) - 距玄武湖 2.1km，西南
3. 侵华日军南京大屠杀遇难同胞纪念馆 (推荐1.5小时) - 距总统府 3.5km，西北
```
