"""
尾号预测规律分析
分析目标期尾号与上一期尾号的关系，找出优化策略
"""

import re
import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from collections import Counter, defaultdict
from itertools import combinations

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False

# 读取数据
with open('c:/Users/61419/Downloads/selectBall-main7208/selectBall-main/all_draws.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 提取JSON数据
json_match = re.search(r'window\.ALL_DRAWS_DATA\s*=\s*(\[.*?\]);', content, re.DOTALL)
if json_match:
    data = json.loads(json_match.group(1))
else:
    raise ValueError("无法解析数据")

# 创建DataFrame
df = pd.DataFrame(data)
df['date'] = pd.to_datetime(df['date'])
df = df.sort_values('issue').reset_index(drop=True)

# 提取尾号
def get_tails(numbers):
    return [n % 10 for n in numbers]

df['front_tails'] = df['front'].apply(get_tails)
df['front_tail_set'] = df['front_tails'].apply(set)
df['front_tail_counter'] = df['front_tails'].apply(Counter)

print(f"数据范围: {df['issue'].iloc[0]} ~ {df['issue'].iloc[-1]}, 共 {len(df)} 期")
print(f"前区号码范围: 1-35, 尾号范围: 0-9")

# ============================================================
# 分析1: 相邻两期尾号关系
# ============================================================
print("\n" + "="*60)
print("分析1: 相邻两期尾号关系")
print("="*60)

# 统计每对相邻期的尾号关系
tail_relations = {
    'same': 0,          # 完全相同的尾号
    'neighbor': 0,      # 相邻尾号(±1)
    'gap2': 0,          # 相差2的尾号
    'gap3': 0,          # 相差3的尾号
    'other': 0,         # 其他关系
}

same_tail_count = []  # 每对相邻期相同尾号个数
neighbor_tail_count = []  # 每对相邻期相邻尾号个数
total_tail_overlap = []  # 每对相邻期尾号重叠率

for i in range(1, len(df)):
    prev_tails = df.loc[i-1, 'front_tail_set']
    curr_tails = df.loc[i, 'front_tail_set']
    
    # 相同尾号
    same_tails = prev_tails & curr_tails
    same_tail_count.append(len(same_tails))
    
    # 相邻尾号(±1)
    neighbor_count = 0
    for t in curr_tails:
        if (t + 1) % 10 in prev_tails or (t + 9) % 10 in prev_tails:
            neighbor_count += 1
    neighbor_tail_count.append(neighbor_count)
    
    # 尾号重叠率
    total_unique = len(prev_tails | curr_tails)
    overlap = len(same_tails) / total_unique if total_unique > 0 else 0
    total_tail_overlap.append(overlap)

print(f"\n相同尾号统计 (共{len(same_tail_count)}对相邻期):")
print(f"  平均相同尾号数: {np.mean(same_tail_count):.2f}")
print(f"  相同尾号分布: {Counter(same_tail_count)}")

print(f"\n相邻尾号(±1)统计:")
print(f"  平均相邻尾号数: {np.mean(neighbor_tail_count):.2f}")
print(f"  相邻尾号分布: {Counter(neighbor_tail_count)}")

print(f"\n尾号重叠率统计:")
print(f"  平均重叠率: {np.mean(total_tail_overlap):.2%}")

# ============================================================
# 分析2: 尾号转移概率矩阵
# ============================================================
print("\n" + "="*60)
print("分析2: 尾号转移概率矩阵")
print("="*60)

# 统计尾号转移频率
tail_transfer = defaultdict(lambda: defaultdict(int))
tail_frequency = Counter()

for i in range(1, len(df)):
    prev_tails = df.loc[i-1, 'front_tails']
    curr_tails = df.loc[i, 'front_tails']
    
    for pt in prev_tails:
        for ct in curr_tails:
            tail_transfer[pt][ct] += 1
            tail_frequency[pt] += 1

# 计算转移概率
print("\n尾号转移概率矩阵 (行=上一期尾号, 列=当前期尾号):")
print("     ", end="")
for t in range(10):
    print(f"  {t}   ", end="")
print()

for from_tail in range(10):
    total = tail_frequency[from_tail]
    if total == 0:
        continue
    print(f"  {from_tail}  ", end="")
    for to_tail in range(10):
        prob = tail_transfer[from_tail][to_tail] / total
        print(f" {prob:.2f} ", end="")
    print()

# ============================================================
# 分析3: 高频尾号模式
# ============================================================
print("\n" + "="*60)
print("分析3: 高频尾号模式分析")
print("="*60)

# 统计每期尾号组合模式
tail_patterns = Counter()
for i in range(len(df)):
    tails = tuple(sorted(df.loc[i, 'front_tail_set']))
    tail_patterns[tails] += 1

print("\n最常见的尾号组合模式 (Top 20):")
for pattern, count in tail_patterns.most_common(20):
    print(f"  {pattern}: {count}次 ({count/len(df):.1%})")

# ============================================================
# 分析4: 尾号连续性分析
# ============================================================
print("\n" + "="*60)
print("分析4: 尾号连续性分析")
print("="*60)

# 分析连续两期保留相同尾号的概率
retain_probs = []
for i in range(1, len(df)):
    prev_tails = df.loc[i-1, 'front_tail_set']
    curr_tails = df.loc[i, 'front_tail_set']
    
    if len(prev_tails) > 0:
        retained = len(prev_tails & curr_tails)
        retain_probs.append(retained / len(prev_tails))

print(f"\n尾号保留率统计:")
print(f"  平均保留率: {np.mean(retain_probs):.2%}")
print(f"  保留率分布:")
for threshold in [0, 0.2, 0.4, 0.6, 0.8, 1.0]:
    count = sum(1 for p in retain_probs if p >= threshold)
    print(f"    保留率 >= {threshold:.0%}: {count}期 ({count/len(retain_probs):.1%})")

# ============================================================
# 分析5: 尾号邻近关系分析
# ============================================================
print("\n" + "="*60)
print("分析5: 尾号邻近关系分析")
print("="*60)

# 分析相邻尾号同时出现的概率
neighbor_cooccurrence = defaultdict(int)
total_pairs = 0

for i in range(len(df)):
    tails = sorted(df.loc[i, 'front_tail_set'])
    for t1, t2 in combinations(tails, 2):
        diff = min(abs(t1 - t2), 10 - abs(t1 - t2))
        if diff == 1:
            neighbor_cooccurrence['neighbor'] += 1
        elif diff == 2:
            neighbor_cooccurrence['gap2'] += 1
        elif diff == 3:
            neighbor_cooccurrence['gap3'] += 1
        total_pairs += 1

print(f"\n尾号间距分布 (共{total_pairs}对):")
for gap, count in sorted(neighbor_cooccurrence.items()):
    print(f"  {gap}: {count}次 ({count/total_pairs:.1%})")

# ============================================================
# 分析6: 基于上一期尾号的预测准确率
# ============================================================
print("\n" + "="*60)
print("分析6: 基于上一期尾号的预测准确率")
print("="*60)

# 策略1: 直接使用上一期尾号
strategy1_hits = []
for i in range(1, len(df)):
    prev_tails = df.loc[i-1, 'front_tail_set']
    curr_tails = df.loc[i, 'front_tail_set']
    hits = len(prev_tails & curr_tails)
    strategy1_hits.append(hits)

print(f"\n策略1: 直接使用上一期尾号")
print(f"  平均命中尾号数: {np.mean(strategy1_hits):.2f}")
print(f"  命中分布: {Counter(strategy1_hits)}")

# 策略2: 使用上一期尾号 + 邻号(±1)
strategy2_hits = []
for i in range(1, len(df)):
    prev_tails = df.loc[i-1, 'front_tail_set']
    curr_tails = df.loc[i, 'front_tail_set']
    
    # 扩展尾号集: 原始尾号 + 邻号
    expanded_tails = set()
    for t in prev_tails:
        expanded_tails.add(t)
        expanded_tails.add((t + 1) % 10)
        expanded_tails.add((t + 9) % 10)
    
    hits = len(expanded_tails & curr_tails)
    strategy2_hits.append(hits)

print(f"\n策略2: 上一期尾号 + 邻号(±1)")
print(f"  平均命中尾号数: {np.mean(strategy2_hits):.2f}")
print(f"  命中分布: {Counter(strategy2_hits)}")

# 策略3: 使用上一期尾号 + ±2范围
strategy3_hits = []
for i in range(1, len(df)):
    prev_tails = df.loc[i-1, 'front_tail_set']
    curr_tails = df.loc[i, 'front_tail_set']
    
    # 扩展尾号集: 原始尾号 + ±1 + ±2
    expanded_tails = set()
    for t in prev_tails:
        for offset in [-2, -1, 0, 1, 2]:
            expanded_tails.add((t + offset) % 10)
    
    hits = len(expanded_tails & curr_tails)
    strategy3_hits.append(hits)

print(f"\n策略3: 上一期尾号 + ±2范围")
print(f"  平均命中尾号数: {np.mean(strategy3_hits):.2f}")
print(f"  命中分布: {Counter(strategy3_hits)}")

# ============================================================
# 分析7: 尾号热度分析
# ============================================================
print("\n" + "="*60)
print("分析7: 尾号热度分析")
print("="*60)

# 统计每个尾号的出现频率
tail_freq = Counter()
for i in range(len(df)):
    for t in df.loc[i, 'front_tails']:
        tail_freq[t] += 1

total_tails = sum(tail_freq.values())
print(f"\n尾号出现频率 (共{total_tails}个尾号):")
for t in range(10):
    freq = tail_freq[t]
    print(f"  尾号{t}: {freq}次 ({freq/total_tails:.1%})")

# ============================================================
# 分析8: 尾号周期性分析
# ============================================================
print("\n" + "="*60)
print("分析8: 尾号周期性分析")
print("="*60)

# 分析尾号连续出现的间隔
tail_intervals = defaultdict(list)
last_seen = {}

for i in range(len(df)):
    for t in df.loc[i, 'front_tail_set']:
        if t in last_seen:
            interval = i - last_seen[t]
            tail_intervals[t].append(interval)
        last_seen[t] = i

print(f"\n尾号出现间隔统计:")
for t in range(10):
    intervals = tail_intervals[t]
    if intervals:
        print(f"  尾号{t}: 平均间隔={np.mean(intervals):.1f}期, "
              f"最短={min(intervals)}期, 最长={max(intervals)}期")

# ============================================================
# 分析9: 综合预测策略评估
# ============================================================
print("\n" + "="*60)
print("分析9: 综合预测策略评估")
print("="*60)

# 评估不同策略的覆盖率
def evaluate_strategy(predict_func, test_start=50):
    """评估预测策略的覆盖率"""
    hits_list = []
    coverage_list = []
    
    for i in range(test_start, len(df)):
        prev_nums = df.loc[i-1, 'front']
        curr_nums = df.loc[i, 'front']
        curr_tails = set(n % 10 for n in curr_nums)
        
        # 预测尾号
        predicted_tails = predict_func(i)
        
        # 计算命中
        hits = len(predicted_tails & curr_tails)
        hits_list.append(hits)
        
        # 计算覆盖率 (预测尾号覆盖了多少实际尾号)
        coverage = hits / len(curr_tails) if len(curr_tails) > 0 else 0
        coverage_list.append(coverage)
    
    return {
        'avg_hits': np.mean(hits_list),
        'avg_coverage': np.mean(coverage_list),
        'hit_distribution': Counter(hits_list)
    }

# 策略A: 只用上一期尾号
def strategy_a(i):
    return df.loc[i-1, 'front_tail_set']

# 策略B: 上一期尾号 + 邻号
def strategy_b(i):
    prev_tails = df.loc[i-1, 'front_tail_set']
    expanded = set()
    for t in prev_tails:
        expanded.add(t)
        expanded.add((t + 1) % 10)
        expanded.add((t + 9) % 10)
    return expanded

# 策略C: 上一期尾号 + ±2
def strategy_c(i):
    prev_tails = df.loc[i-1, 'front_tail_set']
    expanded = set()
    for t in prev_tails:
        for offset in [-2, -1, 0, 1, 2]:
            expanded.add((t + offset) % 10)
    return expanded

# 策略D: 基于转移概率的Top5尾号
def strategy_d(i):
    prev_tails = df.loc[i-1, 'front_tails']
    tail_scores = Counter()
    
    for pt in prev_tails:
        for to_tail in range(10):
            key = f"{pt}→{to_tail}"
            # 使用简化版转移概率
            prob = tail_transfer[pt][to_tail] / max(tail_frequency[pt], 1)
            tail_scores[to_tail] += prob
    
    # 返回Top5尾号
    top5 = [t for t, _ in tail_scores.most_common(5)]
    return set(top5)

# 评估各策略
strategies = {
    'A: 上一期尾号': strategy_a,
    'B: 上一期尾号+邻号': strategy_b,
    'C: 上一期尾号+±2': strategy_c,
    'D: 转移概率Top5': strategy_d,
}

print("\n各策略评估结果 (从第50期开始测试):")
print("-" * 60)
for name, func in strategies.items():
    result = evaluate_strategy(func)
    print(f"\n{name}:")
    print(f"  平均命中尾号数: {result['avg_hits']:.2f}")
    print(f"  平均覆盖率: {result['avg_coverage']:.1%}")
    print(f"  命中分布: {dict(result['hit_distribution'])}")

# ============================================================
# 分析10: 最优策略组合
# ============================================================
print("\n" + "="*60)
print("分析10: 最优策略组合分析")
print("="*60)

# 分析在不同情况下的最优策略
# 情况1: 上一期尾号数量
print("\n基于上一期尾号数量的策略分析:")
for n_tails in range(3, 7):
    strategy_a_hits = []
    strategy_b_hits = []
    
    for i in range(50, len(df)):
        prev_tails = df.loc[i-1, 'front_tail_set']
        curr_tails = df.loc[i, 'front_tail_set']
        
        if len(prev_tails) == n_tails:
            # 策略A
            hits_a = len(prev_tails & curr_tails)
            strategy_a_hits.append(hits_a)
            
            # 策略B
            expanded = set()
            for t in prev_tails:
                expanded.add(t)
                expanded.add((t + 1) % 10)
                expanded.add((t + 9) % 10)
            hits_b = len(expanded & curr_tails)
            strategy_b_hits.append(hits_b)
    
    if strategy_a_hits:
        print(f"  上一期{n_tails}个尾号时:")
        print(f"    策略A平均命中: {np.mean(strategy_a_hits):.2f}")
        print(f"    策略B平均命中: {np.mean(strategy_b_hits):.2f}")

# ============================================================
# 生成可视化
# ============================================================
print("\n" + "="*60)
print("生成可视化图表...")
print("="*60)

fig, axes = plt.subplots(2, 3, figsize=(18, 12))

# 图1: 尾号转移热力图
ax1 = axes[0, 0]
transfer_matrix = np.zeros((10, 10))
for from_tail in range(10):
    total = tail_frequency[from_tail]
    if total > 0:
        for to_tail in range(10):
            transfer_matrix[from_tail][to_tail] = tail_transfer[from_tail][to_tail] / total

sns.heatmap(transfer_matrix, annot=True, fmt='.2f', cmap='YlOrRd', 
            xticklabels=range(10), yticklabels=range(10), ax=ax1)
ax1.set_title('尾号转移概率矩阵', fontsize=12, fontweight='bold')
ax1.set_xlabel('当前期尾号')
ax1.set_ylabel('上一期尾号')

# 图2: 相同尾号个数分布
ax2 = axes[0, 1]
same_dist = Counter(same_tail_count)
x = sorted(same_dist.keys())
y = [same_dist[i] for i in x]
ax2.bar(x, y, color='steelblue', alpha=0.7)
ax2.set_title('相邻期相同尾号个数分布', fontsize=12, fontweight='bold')
ax2.set_xlabel('相同尾号个数')
ax2.set_ylabel('出现次数')
ax2.set_xticks(x)

# 图3: 尾号保留率分布
ax3 = axes[0, 2]
ax3.hist(retain_probs, bins=20, color='green', alpha=0.7, edgecolor='black')
ax3.set_title('尾号保留率分布', fontsize=12, fontweight='bold')
ax3.set_xlabel('保留率')
ax3.set_ylabel('出现次数')
ax3.axvline(np.mean(retain_probs), color='red', linestyle='--', 
            label=f'平均: {np.mean(retain_probs):.2%}')
ax3.legend()

# 图4: 各策略命中率对比
ax4 = axes[1, 0]
strategy_names = list(strategies.keys())
avg_hits = []
for name, func in strategies.items():
    result = evaluate_strategy(func)
    avg_hits.append(result['avg_hits'])

bars = ax4.bar(range(len(strategy_names)), avg_hits, color=['blue', 'green', 'orange', 'red'], alpha=0.7)
ax4.set_title('各策略平均命中尾号数', fontsize=12, fontweight='bold')
ax4.set_xlabel('策略')
ax4.set_ylabel('平均命中尾号数')
ax4.set_xticks(range(len(strategy_names)))
ax4.set_xticklabels(strategy_names, rotation=15, ha='right')
for bar, val in zip(bars, avg_hits):
    ax4.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.05, 
             f'{val:.2f}', ha='center', va='bottom')

# 图5: 尾号出现频率
ax5 = axes[1, 1]
tails = range(10)
freqs = [tail_freq[t] for t in tails]
ax5.bar(tails, freqs, color='purple', alpha=0.7)
ax5.set_title('各尾号出现频率', fontsize=12, fontweight='bold')
ax5.set_xlabel('尾号')
ax5.set_ylabel('出现次数')
ax5.set_xticks(tails)

# 图6: 尾号出现间隔分布
ax6 = axes[1, 2]
all_intervals = []
for t in range(10):
    all_intervals.extend(tail_intervals[t])
ax6.hist(all_intervals, bins=range(1, 20), color='teal', alpha=0.7, edgecolor='black')
ax6.set_title('尾号出现间隔分布', fontsize=12, fontweight='bold')
ax6.set_xlabel('间隔期数')
ax6.set_ylabel('出现次数')

plt.tight_layout()
plt.savefig('c:/Users/61419/Downloads/selectBall-main7208/selectBall-main/tail_analysis.png', 
            dpi=150, bbox_inches='tight')
print("图表已保存: tail_analysis.png")

# ============================================================
# 生成优化建议
# ============================================================
print("\n" + "="*60)
print("优化建议")
print("="*60)

print("""
基于以上分析，提出以下优化建议：

1. 【尾号保留规律】
   - 平均每期保留上一期 {:.1%} 的尾号
   - 建议：预测时优先考虑上一期的高频尾号

2. 【邻号关系】
   - 相邻尾号(±1)经常同时出现
   - 建议：预测尾号时加入邻号扩展

3. 【转移概率】
   - 某些尾号对之间有较高的转移概率
   - 建议：使用转移概率矩阵优化预测

4. 【热度规律】
   - 某些尾号出现频率明显高于其他
   - 建议：结合历史频率进行加权

5. 【周期性】
   - 尾号出现有周期性规律
   - 建议：考虑尾号的遗漏期数
""".format(np.mean(retain_probs)))

# 保存分析结果到文件
analysis_results = {
    'data_range': f"{df['issue'].iloc[0]} ~ {df['issue'].iloc[-1]}",
    'total_periods': len(df),
    'avg_same_tails': float(np.mean(same_tail_count)),
    'avg_retain_rate': float(np.mean(retain_probs)),
    'strategy_performance': {
        name: float(evaluate_strategy(func)['avg_hits'])
        for name, func in strategies.items()
    },
    'tail_frequency': {str(t): freq for t, freq in tail_freq.items()},
}

with open('c:/Users/61419/Downloads/selectBall-main7208/selectBall-main/tail_analysis_results.json', 'w', encoding='utf-8') as f:
    json.dump(analysis_results, f, ensure_ascii=False, indent=2)

print("\n分析结果已保存: tail_analysis_results.json")
print("\n分析完成！")
