#!/usr/bin/env python3
"""
深入分析尾号规律：聚类、转换矩阵、周期性等
"""
import json
import numpy as np
from collections import defaultdict, Counter
import itertools

def load_data():
    """加载开奖数据"""
    with open(r'c:\Users\61419\Downloads\selectBall-main7208\selectBall-main\all_draws.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def get_tails(numbers):
    """获取号码的尾号"""
    return [n % 10 for n in numbers]

def analyze_tail_clustering(data):
    """分析尾号聚类：哪些尾号倾向于一起出现"""
    print("=" * 60)
    print("1. 尾号聚类分析（共现矩阵）")
    print("=" * 60)
    
    # 创建10x10的共现矩阵
    cooccurrence = np.zeros((10, 10), dtype=int)
    
    for draw in data:
        tails = list(set(get_tails(draw['front'])))
        for i in range(len(tails)):
            for j in range(i+1, len(tails)):
                t1, t2 = tails[i], tails[j]
                cooccurrence[t1][t2] += 1
                cooccurrence[t2][t1] += 1
    
    print("尾号共现矩阵（出现次数）:")
    print("   ", end="")
    for i in range(10):
        print(f"{i:4}", end="")
    print()
    
    for i in range(10):
        print(f"{i:2} ", end="")
        for j in range(10):
            if i == j:
                print("   -", end="")
            else:
                print(f"{cooccurrence[i][j]:4}", end="")
        print()
    
    # 找出最强关联的尾号对
    print("\n最强关联的尾号对（Top10）:")
    pairs = []
    for i in range(10):
        for j in range(i+1, 10):
            pairs.append((i, j, cooccurrence[i][j]))
    
    pairs.sort(key=lambda x: x[2], reverse=True)
    for i, j, count in pairs[:10]:
        percentage = count / len(data) * 100
        print(f"  尾号{i}-{j}: {count}次 ({percentage:.1f}%)")

def analyze_tail_transition_matrix(data):
    """分析尾号转换矩阵：从一期到下一期的转换概率"""
    print("\n" + "=" * 60)
    print("2. 尾号转换矩阵分析")
    print("=" * 60)
    
    # 创建转换计数矩阵
    transition = np.zeros((10, 10), dtype=int)
    
    for i in range(1, len(data)):
        prev_tails = set(get_tails(data[i-1]['front']))
        curr_tails = set(get_tails(data[i]['front']))
        
        for prev_tail in prev_tails:
            for curr_tail in curr_tails:
                transition[prev_tail][curr_tail] += 1
    
    # 计算转换概率
    transition_prob = np.zeros((10, 10), dtype=float)
    for i in range(10):
        row_sum = transition[i].sum()
        if row_sum > 0:
            transition_prob[i] = transition[i] / row_sum
    
    print("尾号转换概率矩阵（行→列）:")
    print("   ", end="")
    for i in range(10):
        print(f"{i:6}", end="")
    print()
    
    for i in range(10):
        print(f"{i:2} ", end="")
        for j in range(10):
            print(f"{transition_prob[i][j]:6.2f}", end="")
        print()
    
    # 找出最可能的转换
    print("\n最可能的尾号转换（Top10）:")
    transitions = []
    for i in range(10):
        for j in range(10):
            if i != j:
                transitions.append((i, j, transition_prob[i][j]))
    
    transitions.sort(key=lambda x: x[2], reverse=True)
    for i, j, prob in transitions[:10]:
        print(f"  尾号{i}→{j}: {prob:.2f}")

def analyze_tail_periodicity(data):
    """分析尾号周期性：尾号出现的周期性模式"""
    print("\n" + "=" * 60)
    print("3. 尾号周期性分析")
    print("=" * 60)
    
    # 对每个尾号，分析其出现的周期性
    for target_tail in range(10):
        # 记录尾号出现的位置
        positions = []
        for i, draw in enumerate(data):
            tails = get_tails(draw['front'])
            if target_tail in tails:
                positions.append(i)
        
        if len(positions) < 3:
            print(f"尾号{target_tail}: 数据不足")
            continue
        
        # 计算间隔
        intervals = [positions[i+1] - positions[i] for i in range(len(positions)-1)]
        
        # 分析间隔分布
        interval_counter = Counter(intervals)
        most_common_interval = interval_counter.most_common(1)[0]
        
        # 计算周期性强度（间隔的标准差越小，周期性越强）
        interval_std = np.std(intervals)
        periodicity_strength = 1 / (1 + interval_std)  # 标准化到0-1
        
        print(f"尾号{target_tail}:")
        print(f"  出现次数: {len(positions)}")
        print(f"  平均间隔: {np.mean(intervals):.2f}期")
        print(f"  最常见间隔: {most_common_interval[0]}期 ({most_common_interval[1]}次)")
        print(f"  间隔标准差: {interval_std:.2f}")
        print(f"  周期性强度: {periodicity_strength:.2f} (1=最强, 0=最弱)")

def analyze_tail_odd_even_patterns(data):
    """分析尾号奇偶性规律"""
    print("\n" + "=" * 60)
    print("4. 尾号奇偶性规律分析")
    print("=" * 60)
    
    odd_even_patterns = Counter()
    
    for draw in data:
        tails = get_tails(draw['front'])
        unique_tails = sorted(set(tails))
        
        # 统计奇偶组合
        odd_count = sum(1 for t in unique_tails if t % 2 == 1)
        even_count = len(unique_tails) - odd_count
        
        pattern = f"{odd_count}奇{even_count}偶"
        odd_even_patterns[pattern] += 1
    
    print("尾号奇偶组合分布:")
    for pattern, count in odd_even_patterns.most_common():
        percentage = count / len(data) * 100
        print(f"  {pattern}: {count}次 ({percentage:.1f}%)")

def analyze_tail_size_patterns(data):
    """分析尾号大小规律（0-4小，5-9大）"""
    print("\n" + "=" * 60)
    print("5. 尾号大小规律分析")
    print("=" * 60)
    
    size_patterns = Counter()
    
    for draw in data:
        tails = get_tails(draw['front'])
        unique_tails = sorted(set(tails))
        
        # 统计大小组合
        small_count = sum(1 for t in unique_tails if t <= 4)
        large_count = len(unique_tails) - small_count
        
        pattern = f"{small_count}小{large_count}大"
        size_patterns[pattern] += 1
    
    print("尾号大小组合分布:")
    for pattern, count in size_patterns.most_common():
        percentage = count / len(data) * 100
        print(f"  {pattern}: {count}次 ({percentage:.1f}%)")

def analyze_tail_sum_ranges(data):
    """分析尾号和范围规律"""
    print("\n" + "=" * 60)
    print("6. 尾号和范围规律分析")
    print("=" * 60)
    
    sum_ranges = Counter()
    
    for draw in data:
        tails = get_tails(draw['front'])
        tail_sum = sum(tails)
        
        # 将尾号和分段
        if tail_sum < 15:
            range_key = "低和(9-14)"
        elif tail_sum < 20:
            range_key = "中低和(15-19)"
        elif tail_sum < 25:
            range_key = "中和(20-24)"
        elif tail_sum < 30:
            range_key = "中高和(25-29)"
        else:
            range_key = "高和(30-37)"
        
        sum_ranges[range_key] += 1
    
    print("尾号和范围分布:")
    for range_key in ["低和(9-14)", "中低和(15-19)", "中和(20-24)", "中高和(25-29)", "高和(30-37)"]:
        count = sum_ranges[range_key]
        percentage = count / len(data) * 100
        print(f"  {range_key}: {count}次 ({percentage:.1f}%)")

def analyze_tail_repetition_patterns(data):
    """分析尾号重复规律：同一尾号多个号码的情况"""
    print("\n" + "=" * 60)
    print("7. 尾号重复规律分析")
    print("=" * 60)
    
    repetition_patterns = Counter()
    tail_multiplicity = Counter()
    
    for draw in data:
        tails = get_tails(draw['front'])
        tail_counts = Counter(tails)
        
        # 统计重复模式
        max_repetition = max(tail_counts.values())
        repetition_patterns[f"最大重复{max_repetition}"] += 1
        
        # 统计每个尾号的出现次数
        for tail, count in tail_counts.items():
            tail_multiplicity[count] += 1
    
    print("尾号重复模式分布:")
    for pattern, count in sorted(repetition_patterns.items()):
        percentage = count / len(data) * 100
        print(f"  {pattern}: {count}次 ({percentage:.1f}%)")
    
    print("\n尾号出现次数分布:")
    for count, freq in sorted(tail_multiplicity.items()):
        print(f"  出现{count}次的尾号: {freq}个")

def analyze_tail_gap_correlation(data):
    """分析尾号间隔相关性：间隔与后续出现的关系"""
    print("\n" + "=" * 60)
    print("8. 尾号间隔相关性分析")
    print("=" * 60)
    
    # 对每个尾号，分析间隔与后续出现的关系
    for target_tail in [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]:
        # 记录间隔和后续是否出现
        gap_appearance = []
        
        last_seen = -1
        for i, draw in enumerate(data):
            tails = get_tails(draw['front'])
            
            if target_tail in tails:
                if last_seen >= 0:
                    gap = i - last_seen
                    # 检查下一期是否出现
                    if i + 1 < len(data):
                        next_tails = get_tails(data[i+1]['front'])
                        appears_next = 1 if target_tail in next_tails else 0
                        gap_appearance.append((gap, appears_next))
                last_seen = i
        
        if len(gap_appearance) < 10:
            continue
        
        # 分析间隔与后续出现的关系
        gap_counter = Counter()
        gap_appear_counter = Counter()
        
        for gap, appears in gap_appearance:
            gap_counter[gap] += 1
            if appears:
                gap_appear_counter[gap] += 1
        
        # 计算每个间隔的出现概率
        print(f"尾号{target_tail}间隔与后续出现关系:")
        for gap in sorted(gap_counter.keys()):
            if gap_counter[gap] >= 3:  # 至少出现3次才有统计意义
                appear_rate = gap_appear_counter[gap] / gap_counter[gap]
                print(f"  间隔{gap}期后: 下期出现概率{appear_rate:.2f} ({gap_appear_counter[gap]}/{gap_counter[gap]})")

def main():
    """主函数"""
    print("深入分析尾号规律...")
    
    data = load_data()
    print(f"加载数据完成，共{len(data)}期数据")
    
    # 执行各项分析
    analyze_tail_clustering(data)
    analyze_tail_transition_matrix(data)
    analyze_tail_periodicity(data)
    analyze_tail_odd_even_patterns(data)
    analyze_tail_size_patterns(data)
    analyze_tail_sum_ranges(data)
    analyze_tail_repetition_patterns(data)
    analyze_tail_gap_correlation(data)
    
    print("\n" + "=" * 60)
    print("深入分析完成！")
    print("=" * 60)

if __name__ == "__main__":
    main()