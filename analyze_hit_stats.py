import pandas as pd
import numpy as np

# 读取CSV文件
df = pd.read_csv('per_period_detail.csv')

print('='*80)
print('每期Top5、补漏6、候选池命中详细统计')
print('='*80)

# 1. Top1-Top5每注命中分布
print('\n【1】Top1-Top5 每注命中分布:')
print('-'*50)
for col in ['Top1命中', 'Top2命中', 'Top3命中', 'Top4命中', 'Top5命中']:
    counts = df[col].value_counts().sort_index()
    print('\n' + col + ':')
    for val, cnt in counts.items():
        pct = cnt/len(df)*100
        print('  命中%d个: %d次 (%.1f%%)' % (val, cnt, pct))
    avg = df[col].mean()
    print('  平均命中: %.2f个' % avg)

# 2. Top5联合覆盖分布
print('\n\n【2】Top5 联合覆盖分布:')
print('-'*50)
counts = df['Top5联合覆盖'].value_counts().sort_index()
for val, cnt in counts.items():
    pct = cnt/len(df)*100
    print('  覆盖%d个: %d次 (%.1f%%)' % (val, cnt, pct))
avg = df['Top5联合覆盖'].mean()
print('  平均覆盖: %.2f个' % avg)

# 3. Top5+补漏6联合覆盖分布
print('\n\n【3】Top5+补漏6 联合覆盖分布:')
print('-'*50)
counts = df['Top5+补漏6联合覆盖'].value_counts().sort_index()
for val, cnt in counts.items():
    pct = cnt/len(df)*100
    print('  覆盖%d个: %d次 (%.1f%%)' % (val, cnt, pct))
avg = df['Top5+补漏6联合覆盖'].mean()
print('  平均覆盖: %.2f个' % avg)

# 4. 候选池覆盖分布
print('\n\n【4】候选池覆盖分布:')
print('-'*50)
counts = df['候选池覆盖'].value_counts().sort_index()
for val, cnt in counts.items():
    pct = cnt/len(df)*100
    print('  覆盖%d个: %d次 (%.1f%%)' % (val, cnt, pct))
avg = df['候选池覆盖'].mean()
print('  平均覆盖: %.2f个' % avg)

# 5. 综合指标
print('\n\n【5】综合指标:')
print('-'*50)
# Top5最高命中（每期Top1-Top5中最大的命中数）
df['Top5最高命中'] = df[['Top1命中', 'Top2命中', 'Top3命中', 'Top4命中', 'Top5命中']].max(axis=1)
avg_top5 = df['Top5最高命中'].mean()
avg_joint = df['Top5+补漏6联合覆盖'].mean()
avg_pool = df['候选池覆盖'].mean()
print('Top5最高命中率: %.1f%% (平均%.2f/5)' % (avg_top5/5*100, avg_top5))
print('Top5+补漏6联合覆盖率: %.1f%% (平均%.2f/5)' % (avg_joint/5*100, avg_joint))
print('候选池覆盖率(Top30): %.1f%% (平均%.2f/5)' % (avg_pool/5*100, avg_pool))

# 6. Top5最高命中分布
print('\n\n【6】Top5 最高命中分布（每期Top1-Top5中最大命中数）:')
print('-'*50)
counts = df['Top5最高命中'].value_counts().sort_index()
for val, cnt in counts.items():
    pct = cnt/len(df)*100
    print('  命中%d个: %d次 (%.1f%%)' % (val, cnt, pct))

# 7. 补漏6命中分布
print('\n\n【7】补漏6 命中分布:')
print('-'*50)
counts = df['补漏6命中'].value_counts().sort_index()
for val, cnt in counts.items():
    pct = cnt/len(df)*100
    print('  命中%d个: %d次 (%.1f%%)' % (val, cnt, pct))
avg = df['补漏6命中'].mean()
print('  平均命中: %.2f个' % avg)

# 8. 统计命中>=3的情况
print('\n\n【8】命中>=3的情况统计:')
print('-'*50)
top5_hit3 = (df['Top5最高命中'] >= 3).sum()
joint_hit4 = (df['Top5+补漏6联合覆盖'] >= 4).sum()
pool_hit4 = (df['候选池覆盖'] >= 4).sum()
print('Top5>=3球: %d次 (%.1f%%)' % (top5_hit3, top5_hit3/len(df)*100))
print('Top5+补漏6联合覆盖>=4球: %d次 (%.1f%%)' % (joint_hit4, joint_hit4/len(df)*100))
print('候选池覆盖>=4球: %d次 (%.1f%%)' % (pool_hit4, pool_hit4/len(df)*100))

# 9. 早期/中期/近期分析
print('\n\n【9】分时段分析（早期/中期/近期）:')
print('-'*50)
n = len(df)
early = df.iloc[:n//3]
mid = df.iloc[n//3:2*n//3]
late = df.iloc[2*n//3:]

for name, period in [('早期(前1/3)', early), ('中期(中1/3)', mid), ('近期(后1/3)', late)]:
    print('\n%s (%d期):' % (name, len(period)))
    top5_avg = period[['Top1命中', 'Top2命中', 'Top3命中', 'Top4命中', 'Top5命中']].max(axis=1).mean()
    joint_avg = period['Top5+补漏6联合覆盖'].mean()
    pool_avg = period['候选池覆盖'].mean()
    print('  Top5最高命中率: %.1f%% (平均%.2f/5)' % (top5_avg/5*100, top5_avg))
    print('  Top5+补漏6联合覆盖率: %.1f%% (平均%.2f/5)' % (joint_avg/5*100, joint_avg))
    print('  候选池覆盖率: %.1f%% (平均%.2f/5)' % (pool_avg/5*100, pool_avg))
    top5_gte3 = (period['Top5最高命中']>=3).sum()
    joint_gte4 = (period['Top5+补漏6联合覆盖']>=4).sum()
    pool_gte4 = (period['候选池覆盖']>=4).sum()
    print('  Top5>=3球: %d次 (%.1f%%)' % (top5_gte3, top5_gte3/len(period)*100))
    print('  联合>=4球: %d次 (%.1f%%)' % (joint_gte4, joint_gte4/len(period)*100))
    print('  池>=4球: %d次 (%.1f%%)' % (pool_gte4, pool_gte4/len(period)*100))

print('\n' + '='*80)
print('统计完成!')
print('='*80)
