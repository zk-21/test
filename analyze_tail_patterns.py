#!/usr/bin/env python3
"""
分析组内尾号和跨行尾号的深层规律
"""
import json
import itertools
from collections import defaultdict, Counter
import numpy as np

def load_data():
    """加载开奖数据"""
    with open(r'c:\Users\61419\Downloads\selectBall-main7208\selectBall-main\all_draws.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def get_tails(numbers):
    """获取号码的尾号"""
    return [n % 10 for n in numbers]

def analyze_tail_frequency(data):
    """分析尾号出现频率"""
    print("=" * 60)
    print("1. 尾号出现频率分析")
    print("=" * 60)
    
    tail_counter = Counter()
    total_numbers = 0
    
    for draw in data:
        tails = get_tails(draw['front'])
        tail_counter.update(tails)
        total_numbers += len(tails)
    
    print(f"总号码数: {total_numbers}")
    print(f"总期数: {len(data)}")
    print("\n尾号频率分布:")
    for tail in range(10):
        count = tail_counter[tail]
        percentage = count / total_numbers * 100
        print(f"  尾号{tail}: {count}次 ({percentage:.1f}%)")
    
    return tail_counter

def analyze_tail_intervals(data):
    """分析尾号出现间隔"""
    print("\n" + "=" * 60)
    print("2. 尾号出现间隔分析")
    print("=" * 60)
    
    # 记录每个尾号最后一次出现的位置
    last_seen = {}
    intervals = defaultdict(list)
    
    for i, draw in enumerate(data):
        tails = get_tails(draw['front'])
        current_tails = set(tails)
        
        for tail in range(10):
            if tail in current_tails:
                if tail in last_seen:
                    interval = i - last_seen[tail]
                    intervals[tail].append(interval)
                last_seen[tail] = i
    
    print("尾号平均出现间隔（期数）:")
    for tail in range(10):
        if intervals[tail]:
            avg_interval = np.mean(intervals[tail])
            max_interval = max(intervals[tail])
            min_interval = min(intervals[tail])
            print(f"  尾号{tail}: 平均{avg_interval:.1f}期, 最小{min_interval}期, 最大{max_interval}期")
        else:
            print(f"  尾号{tail}: 数据不足")

def analyze_tail_combinations(data):
    """分析尾号组合模式"""
    print("\n" + "=" * 60)
    print("3. 尾号组合模式分析")
    print("=" * 60)
    
    # 统计每期出现的尾号组合
    tail_combos = Counter()
    tail_sets = []
    
    for draw in data:
        tails = get_tails(draw['front'])
        unique_tails = sorted(set(tails))
        tail_sets.append(unique_tails)
        
        # 统计2尾号组合
        for combo in itertools.combinations(unique_tails, 2):
            tail_combos[combo] += 1
        
        # 统计3尾号组合
        if len(unique_tails) >= 3:
            for combo in itertools.combinations(unique_tails, 3):
                tail_combos[combo] += 1
    
    print("最常见的2尾号组合（Top20）:")
    for combo, count in tail_combos.most_common(20):
        if len(combo) == 2:
            percentage = count / len(data) * 100
            print(f"  {combo}: {count}次 ({percentage:.1f}%)")
    
    print("\n最常见的3尾号组合（Top10）:")
    for combo, count in tail_combos.most_common(30):
        if len(combo) == 3:
            percentage = count / len(data) * 100
            print(f"  {combo}: {count}次 ({percentage:.1f}%)")

def analyze_consecutive_tails(data):
    """分析连续尾号规律"""
    print("\n" + "=" * 60)
    print("4. 连续尾号规律分析")
    print("=" * 60)
    
    consecutive_stats = {
        'two_consecutive': 0,
        'three_consecutive': 0,
        'four_consecutive': 0,
        'five_consecutive': 0,
        'arithmetic_2': 0,
        'arithmetic_3': 0,
        'same_tail_multiple': 0
    }
    
    for draw in data:
        tails = get_tails(draw['front'])
        unique_tails = sorted(set(tails))
        
        # 检查连续尾号
        for i in range(len(unique_tails) - 1):
            if unique_tails[i+1] - unique_tails[i] == 1:
                consecutive_stats['two_consecutive'] += 1
                break
        
        # 检查三个连续
        for i in range(len(unique_tails) - 2):
            if (unique_tails[i+1] - unique_tails[i] == 1 and 
                unique_tails[i+2] - unique_tails[i+1] == 1):
                consecutive_stats['three_consecutive'] += 1
                break
        
        # 检查四个连续
        for i in range(len(unique_tails) - 3):
            if (unique_tails[i+1] - unique_tails[i] == 1 and 
                unique_tails[i+2] - unique_tails[i+1] == 1 and
                unique_tails[i+3] - unique_tails[i+2] == 1):
                consecutive_stats['four_consecutive'] += 1
                break
        
        # 检查五个连续
        for i in range(len(unique_tails) - 4):
            if (unique_tails[i+1] - unique_tails[i] == 1 and 
                unique_tails[i+2] - unique_tails[i+1] == 1 and
                unique_tails[i+3] - unique_tails[i+2] == 1 and
                unique_tails[i+4] - unique_tails[i+3] == 1):
                consecutive_stats['five_consecutive'] += 1
                break
        
        # 检查等差数列（差为2）
        for i in range(len(unique_tails) - 2):
            if (unique_tails[i+1] - unique_tails[i] == 2 and 
                unique_tails[i+2] - unique_tails[i+1] == 2):
                consecutive_stats['arithmetic_2'] += 1
                break
        
        # 检查等差数列（差为3）
        for i in range(len(unique_tails) - 2):
            if (unique_tails[i+1] - unique_tails[i] == 3 and 
                unique_tails[i+2] - unique_tails[i+1] == 3):
                consecutive_stats['arithmetic_3'] += 1
                break
        
        # 检查同一尾号多个号码
        tail_counts = Counter(tails)
        if any(count >= 2 for count in tail_counts.values()):
            consecutive_stats['same_tail_multiple'] += 1
    
    total = len(data)
    print("连续尾号出现频率:")
    print(f"  两个连续尾号: {consecutive_stats['two_consecutive']}次 ({consecutive_stats['two_consecutive']/total*100:.1f}%)")
    print(f"  三个连续尾号: {consecutive_stats['three_consecutive']}次 ({consecutive_stats['three_consecutive']/total*100:.1f}%)")
    print(f"  四个连续尾号: {consecutive_stats['four_consecutive']}次 ({consecutive_stats['four_consecutive']/total*100:.1f}%)")
    print(f"  五个连续尾号: {consecutive_stats['five_consecutive']}次 ({consecutive_stats['five_consecutive']/total*100:.1f}%)")
    print(f"  等差数列(差2): {consecutive_stats['arithmetic_2']}次 ({consecutive_stats['arithmetic_2']/total*100:.1f}%)")
    print(f"  等差数列(差3): {consecutive_stats['arithmetic_3']}次 ({consecutive_stats['arithmetic_3']/total*100:.1f}%)")
    print(f"  同尾号多号码: {consecutive_stats['same_tail_multiple']}次 ({consecutive_stats['same_tail_multiple']/total*100:.1f}%)")

def analyze_cross_period_patterns(data):
    """分析跨期尾号规律"""
    print("\n" + "=" * 60)
    print("5. 跨期尾号规律分析")
    print("=" * 60)
    
    # 分析相邻期尾号重复
    repeat_counts = []
    neighbor_counts = []
    new_tail_counts = []
    
    for i in range(1, len(data)):
        prev_tails = set(get_tails(data[i-1]['front']))
        curr_tails = set(get_tails(data[i]['front']))
        
        # 重复尾号
        repeats = prev_tails & curr_tails
        repeat_counts.append(len(repeats))
        
        # 相邻尾号（±1）
        neighbors = 0
        for t in prev_tails:
            if (t-1) % 10 in curr_tails or (t+1) % 10 in curr_tails:
                neighbors += 1
        neighbor_counts.append(neighbors)
        
        # 新出现的尾号
        new_tails = curr_tails - prev_tails
        new_tail_counts.append(len(new_tails))
    
    print("相邻期尾号关系:")
    print(f"  平均重复尾号数: {np.mean(repeat_counts):.2f}")
    print(f"  平均相邻尾号数: {np.mean(neighbor_counts):.2f}")
    print(f"  平均新尾号数: {np.mean(new_tail_counts):.2f}")
    
    # 分析尾号重复分布
    repeat_dist = Counter(repeat_counts)
    print("\n尾号重复分布:")
    for count in sorted(repeat_dist.keys()):
        percentage = repeat_dist[count] / len(repeat_counts) * 100
        print(f"  重复{count}个: {repeat_dist[count]}次 ({percentage:.1f}%)")

def analyze_tail_position_patterns(data):
    """分析尾号在不同位置的分布"""
    print("\n" + "=" * 60)
    print("6. 尾号位置分布分析")
    print("=" * 60)
    
    # 分析每个位置（1-5）的尾号分布
    position_tails = defaultdict(lambda: defaultdict(int))
    
    for draw in data:
        sorted_numbers = sorted(draw['front'])
        for pos, num in enumerate(sorted_numbers):
            tail = num % 10
            position_tails[pos][tail] += 1
    
    print("各位置尾号分布:")
    for pos in range(5):
        print(f"\n位置{pos+1} (第{pos+1}小号码):")
        total = sum(position_tails[pos].values())
        for tail in range(10):
            count = position_tails[pos][tail]
            percentage = count / total * 100
            if percentage > 10:  # 只显示频率>10%的尾号
                print(f"  尾号{tail}: {count}次 ({percentage:.1f}%)")

def analyze_tail_sum_patterns(data):
    """分析尾号和规律"""
    print("\n" + "=" * 60)
    print("7. 尾号和规律分析")
    print("=" * 60)
    
    tail_sums = []
    tail_sum_mod10 = []
    
    for draw in data:
        tails = get_tails(draw['front'])
        tail_sum = sum(tails)
        tail_sums.append(tail_sum)
        tail_sum_mod10.append(tail_sum % 10)
    
    print("尾号和统计:")
    print(f"  平均尾号和: {np.mean(tail_sums):.2f}")
    print(f"  最小尾号和: {min(tail_sums)}")
    print(f"  最大尾号和: {max(tail_sums)}")
    print(f"  标准差: {np.std(tail_sums):.2f}")
    
    # 尾号和模10分布
    mod10_dist = Counter(tail_sum_mod10)
    print("\n尾号和模10分布:")
    for mod in range(10):
        count = mod10_dist[mod]
        percentage = count / len(data) * 100
        print(f"  模10={mod}: {count}次 ({percentage:.1f}%)")

def analyze_tail_gap_patterns(data):
    """分析尾号间隔规律"""
    print("\n" + "=" * 60)
    print("8. 尾号间隔规律分析")
    print("=" * 60)
    
    # 分析相邻号码的尾号间隔
    gap_patterns = Counter()
    
    for draw in data:
        sorted_numbers = sorted(draw['front'])
        tails = [n % 10 for n in sorted_numbers]
        
        # 计算相邻尾号间隔
        for i in range(len(tails) - 1):
            gap = (tails[i+1] - tails[i]) % 10
            gap_patterns[gap] += 1
    
    print("相邻号码尾号间隔分布:")
    total_gaps = sum(gap_patterns.values())
    for gap in range(10):
        count = gap_patterns[gap]
        percentage = count / total_gaps * 100
        print(f"  间隔{gap}: {count}次 ({percentage:.1f}%)")

def analyze_tail_evolution(data):
    """分析尾号演化规律"""
    print("\n" + "=" * 60)
    print("9. 尾号演化规律分析")
    print("=" * 60)
    
    # 分析尾号出现周期
    tail_periods = defaultdict(list)
    last_seen = {}
    
    for i, draw in enumerate(data):
        tails = set(get_tails(draw['front']))
        
        for tail in range(10):
            if tail in tails:
                if tail in last_seen:
                    period = i - last_seen[tail]
                    tail_periods[tail].append(period)
                last_seen[tail] = i
    
    print("尾号出现周期分析:")
    for tail in range(10):
        if tail_periods[tail]:
            periods = tail_periods[tail]
            avg_period = np.mean(periods)
            std_period = np.std(periods)
            print(f"  尾号{tail}: 平均周期{avg_period:.1f}期, 标准差{std_period:.1f}")
        else:
            print(f"  尾号{tail}: 数据不足")

def main():
    """主函数"""
    print("开始分析组内尾号和跨行尾号规律...")
    
    data = load_data()
    print(f"加载数据完成，共{len(data)}期数据")
    
    # 执行各项分析
    analyze_tail_frequency(data)
    analyze_tail_intervals(data)
    analyze_tail_combinations(data)
    analyze_consecutive_tails(data)
    analyze_cross_period_patterns(data)
    analyze_tail_position_patterns(data)
    analyze_tail_sum_patterns(data)
    analyze_tail_gap_patterns(data)
    analyze_tail_evolution(data)
    
    print("\n" + "=" * 60)
    print("分析完成！")
    print("=" * 60)

if __name__ == "__main__":
    main()