import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import json

# 未覆盖号码分析数据
data = {
    'tail_distribution': {
        'tail': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        'count': [15, 17, 27, 22, 22, 15, 12, 13, 10, 6],
        'percentage': [9.43, 10.69, 16.98, 13.84, 13.84, 9.43, 7.55, 8.18, 6.29, 3.77]
    },
    'interval_distribution': {
        'interval': ['区间1 (1-12)', '区间2 (13-24)', '区间3 (25-35)'],
        'count': [59, 54, 46],
        'percentage': [37.11, 33.96, 28.93]
    },
    'hot_distribution': {
        'hot_count': [0, 1, 2, 3],
        'count': [71, 76, 11, 1],
        'percentage': [44.65, 47.80, 6.92, 0.63]
    },
    'offset_distribution': {
        'offset': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 22],
        'count': [2, 21, 23, 31, 19, 12, 12, 13, 6, 3, 4, 6, 2, 1, 1, 1, 1, 1],
        'percentage': [1.26, 13.21, 14.47, 19.50, 11.95, 7.55, 7.55, 8.18, 3.77, 1.89, 2.52, 3.77, 1.26, 0.63, 0.63, 0.63, 0.63, 0.63]
    }
}

# 创建DataFrame
tail_df = pd.DataFrame(data['tail_distribution'])
interval_df = pd.DataFrame(data['interval_distribution'])
hot_df = pd.DataFrame(data['hot_distribution'])
offset_df = pd.DataFrame(data['offset_distribution'])

# 创建子图布局
fig = make_subplots(
    rows=2, cols=2,
    subplot_titles=('按尾号分布', '按区间分布', '按热号次数分布', '按偏移距离分布'),
    specs=[[{"type": "bar"}, {"type": "pie"}],
           [{"type": "bar"}, {"type": "scatter"}]]
)

# 1. 按尾号分布柱状图
fig.add_trace(
    go.Bar(
        x=tail_df['tail'].astype(str),
        y=tail_df['count'],
        text=tail_df['percentage'].apply(lambda x: f'{x:.2f}%'),
        textposition='auto',
        marker_color='#4C72B0',
        name='尾号分布'
    ),
    row=1, col=1
)

# 2. 按区间分布饼图
fig.add_trace(
    go.Pie(
        labels=interval_df['interval'],
        values=interval_df['count'],
        textinfo='label+percent',
        marker_colors=['#4C72B0', '#DD8452', '#55A868'],
        name='区间分布'
    ),
    row=1, col=2
)

# 3. 按热号次数分布柱状图
fig.add_trace(
    go.Bar(
        x=hot_df['hot_count'].astype(str),
        y=hot_df['count'],
        text=hot_df['percentage'].apply(lambda x: f'{x:.2f}%'),
        textposition='auto',
        marker_color='#55A868',
        name='热号分布'
    ),
    row=2, col=1
)

# 4. 按偏移距离分布折线图
fig.add_trace(
    go.Scatter(
        x=offset_df['offset'],
        y=offset_df['count'],
        mode='lines+markers+text',
        text=offset_df['count'],
        textposition='top center',
        marker_color='#C44E52',
        name='偏移分布'
    ),
    row=2, col=2
)

# 更新布局
fig.update_layout(
    title_text="未覆盖号码规律分析报告",
    title_x=0.5,
    height=800,
    showlegend=False,
    template='plotly_white'
)

# 更新x轴标签
fig.update_xaxes(title_text="尾号", row=1, col=1)
fig.update_yaxes(title_text="未覆盖次数", row=1, col=1)

fig.update_xaxes(title_text="热号次数", row=2, col=1)
fig.update_yaxes(title_text="未覆盖次数", row=2, col=1)

fig.update_xaxes(title_text="偏移距离", row=2, col=2)
fig.update_yaxes(title_text="未覆盖次数", row=2, col=2)

# 保存为HTML文件
fig.write_html('analysis_output/uncovered_analysis_dashboard.html')

# 创建单独的详细图表

# 图表1: 尾号分布详细分析
fig1 = px.bar(
    tail_df,
    x='tail',
    y='count',
    text='percentage',
    title='未覆盖号码按尾号分布',
    labels={'tail': '尾号', 'count': '未覆盖次数', 'percentage': '百分比'},
    color='count',
    color_continuous_scale='Blues'
)
fig1.update_traces(texttemplate='%{text:.2f}%', textposition='outside')
fig1.update_layout(
    xaxis=dict(tickmode='linear', dtick=1),
    template='plotly_white',
    height=500
)
fig1.write_html('analysis_output/tail_distribution.html')

# 图表2: 热号分布详细分析
fig2 = px.bar(
    hot_df,
    x='hot_count',
    y='count',
    text='percentage',
    title='未覆盖号码按热号次数分布',
    labels={'hot_count': '热号次数', 'count': '未覆盖次数', 'percentage': '百分比'},
    color='count',
    color_continuous_scale='Greens'
)
fig2.update_traces(texttemplate='%{text:.2f}%', textposition='outside')
fig2.update_layout(
    xaxis=dict(tickmode='linear', dtick=1),
    template='plotly_white',
    height=500
)
fig2.write_html('analysis_output/hot_distribution.html')

# 图表3: 偏移距离分布详细分析
fig3 = px.scatter(
    offset_df,
    x='offset',
    y='count',
    size='count',
    text='count',
    title='未覆盖号码按偏移距离分布',
    labels={'offset': '偏移距离', 'count': '未覆盖次数'},
    color='count',
    color_continuous_scale='Reds'
)
fig3.update_traces(textposition='top center')
fig3.update_layout(
    xaxis=dict(tickmode='linear', dtick=1),
    template='plotly_white',
    height=500
)
fig3.write_html('analysis_output/offset_distribution.html')

# 创建关键发现总结
key_findings = {
    'total_uncovered': 159,
    'avg_per_period': 1.56,
    'coverage_rate': 68.82,
    'coverage_improvement': 3.85,
    'main_reason': '被区间保底挤掉',
    'main_reason_percentage': 98.11,
    'low_hot_percentage': 92.45,
    'top_uncovered_tails': [
        {'tail': 2, 'count': 27, 'percentage': 16.98},
        {'tail': 4, 'count': 22, 'percentage': 13.84},
        {'tail': 3, 'count': 22, 'percentage': 13.84},
        {'tail': 1, 'count': 17, 'percentage': 10.69}
    ]
}

# 保存关键发现
with open('analysis_output/key_findings.json', 'w', encoding='utf-8') as f:
    json.dump(key_findings, f, ensure_ascii=False, indent=2)

print("可视化报告已生成:")
print("1. analysis_output/uncovered_analysis_dashboard.html - 综合仪表板")
print("2. analysis_output/tail_distribution.html - 尾号分布详细分析")
print("3. analysis_output/hot_distribution.html - 热号分布详细分析")
print("4. analysis_output/offset_distribution.html - 偏移距离分布详细分析")
print("5. analysis_output/key_findings.json - 关键发现数据")

# 创建改进建议报告
improvement_suggestions = """
# 未覆盖号码分析及改进建议

## 关键发现

### 1. 未覆盖号码统计
- 总未覆盖号码: 159个
- 平均每期未覆盖: 1.56个
- 覆盖率: 68.82% (相比原版提升+3.85%)

### 2. 未覆盖号码特征分析

#### 按尾号分布 (高频未覆盖尾号)
- 尾号2: 27次 (16.98%) - 最高频未覆盖
- 尾号4: 22次 (13.84%)
- 尾号3: 22次 (13.84%)
- 尾号1: 17次 (10.69%)

#### 按热号次数分布
- 热号0次: 71次 (44.65%)
- 热号1次: 76次 (47.80%)
- 低热号(≤1次)总计: 147次 (92.45%)

#### 被筛掉的主要原因
- 被区间保底挤掉: 156次 (98.11%)

## 改进建议

### 1. 针对高频未覆盖尾号
**问题**: 尾号2、4、3、1未覆盖频率较高
**建议**:
- 增加尾号2、4、3、1的评分权重
- 在尾号关联性分析中，提高这些尾号的匹配奖励
- 考虑为高频未覆盖尾号设置最低入选保障

### 2. 针对低热号号码
**问题**: 92.45%的未覆盖号码是低热号(热号≤1次)
**建议**:
- 调整热号评分机制，降低热号权重或增加冷号补偿
- 考虑引入"冷号回补"机制，为长期未出现的号码提供额外分数
- 分析热号统计窗口是否合适(当前为10期)

### 3. 针对区间保底机制
**问题**: 98.11%的未覆盖号码被区间保底挤掉
**建议**:
- 重新评估区间保底数量(当前每个区间至少6个)
- 考虑动态调整保底数量，根据区间历史表现
- 引入"高分号码优先"机制，确保高分号码不被保底挤掉
- 考虑设置"保底豁免"规则，对特定高分号码豁免保底限制

### 4. 综合改进方案

#### 方案A: 评分权重调整
```javascript
// 调整热号评分权重
const hotScore = h >= 4 ? 15 : h >= 3 ? 12 : h >= 2 ? 8 : h === 1 ? 6 : 2;

// 增加高频未覆盖尾号奖励
const tailBonus = [2, 4, 3, 1].includes(nTail) ? 5 : 0;
```

#### 方案B: 区间保底优化
```javascript
// 动态保底数量
const dynamicMinIv = iv.map((count, idx) => {
  const historicalPerformance = getIntervalPerformance(idx);
  return Math.max(4, Math.round(6 * historicalPerformance));
});
```

#### 方案C: 冷号回补机制
```javascript
// 冷号回补分数
const coldNumberBonus = hotCount === 0 ? 8 : hotCount === 1 ? 4 : 0;
```

## 实施优先级

1. **高优先级**: 调整热号评分权重，增加冷号补偿
2. **中优先级**: 优化区间保底机制，减少高分号码被挤掉
3. **低优先级**: 针对高频未覆盖尾号微调评分

## 预期效果

- 覆盖率预计提升至70-72%
- 低热号未覆盖比例降至80%以下
- 区间保底挤掉比例降至90%以下
"""

with open('analysis_output/improvement_suggestions.md', 'w', encoding='utf-8') as f:
    f.write(improvement_suggestions)

print("\n改进建议报告已生成: analysis_output/improvement_suggestions.md")