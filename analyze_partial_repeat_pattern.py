#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
分析跨行尾号的部分重复模式
例如：当前期尾号 [4,4,5,7,9] -> 下期尾号 [2,3,4,7,9]
重复尾号：4,7,9（3个）
不重复尾号：5（1个）
新出现尾号：2,3（2个）
"""

import json
import os
from collections import defaultdict, Counter

def load_data():
    """加载历史开奖数据"""
    data_path = os.path.join(os.path.dirname(__file__), 'all_draws.json')
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def get_tails(numbers):
    """获取号码的尾号（最后一位数字）"""
    return [n % 10 for n in numbers]

def analyze_partial_repeat_pattern(data):
    """分析部分重复模式"""
    print("=" * 80)
    print("跨行尾号部分重复模式分析")
    print("=" * 80)
    
    # 提取前区号码
    front_draws = []
    for draw in data:
        front_draws.append(draw['front'])
    
    print(f"总期数: {len(front_draws)}")
    
    # 分析每连续两期之间的尾号重复情况
    repeat_counts = []  # 每期的重复尾号数量
    new_counts = []     # 每期的新出现尾号数量
    disappeared_counts = []  # 每期的消失尾号数量
    
    # 记录各种重复模式
    repeat_patterns = Counter()  # 例如 "3重复2新" 模式
    
    # 记录重复尾号和新尾号的具体情况
    repeat_tail_freq = defaultdict(int)  # 重复尾号的频率
    new_tail_freq = defaultdict(int)     # 新出现尾号的频率
    disappeared_tail_freq = defaultdict(int)  # 消失尾号的频率
    
    # 记录连续重复的尾号
    consecutive_repeat_tails = defaultdict(int)  # 连续出现的尾号
    
    # 分析每连续两期
    for i in range(len(front_draws) - 1):
        current_tails = set(get_tails(front_draws[i]))
        next_tails = set(get_tails(front_draws[i + 1]))
        
        # 计算重复尾号
        repeat_tails = current_tails & next_tails
        new_tails = next_tails - current_tails
        disappeared_tails = current_tails - next_tails
        
        repeat_counts.append(len(repeat_tails))
        new_counts.append(len(new_tails))
        disappeared_counts.append(len(disappeared_tails))
        
        # 记录重复模式
        pattern = f"{len(repeat_tails)}重复{len(new_tails)}新"
        repeat_patterns[pattern] += 1
        
        # 记录重复尾号的频率
        for tail in repeat_tails:
            repeat_tail_freq[tail] += 1
        
        # 记录新出现尾号的频率
        for tail in new_tails:
            new_tail_freq[tail] += 1
        
        # 记录消失尾号的频率
        for tail in disappeared_tails:
            disappeared_tail_freq[tail] += 1
        
        # 记录连续重复的尾号（连续两期都出现的尾号）
        if i > 0:
            prev_tails = set(get_tails(front_draws[i - 1]))
            consecutive_tails = prev_tails & current_tails & next_tails
            for tail in consecutive_tails:
                consecutive_repeat_tails[tail] += 1
    
    # 统计结果
    total_periods = len(repeat_counts)
    
    print(f"\n分析期数: {total_periods}")
    
    # 1. 重复尾号数量分布
    print("\n1. 重复尾号数量分布:")
    repeat_counter = Counter(repeat_counts)
    for count in sorted(repeat_counter.keys()):
        freq = repeat_counter[count]
        percentage = freq / total_periods * 100
        print(f"   {count}个重复: {freq}次 ({percentage:.1f}%)")
    
    # 2. 新出现尾号数量分布
    print("\n2. 新出现尾号数量分布:")
    new_counter = Counter(new_counts)
    for count in sorted(new_counter.keys()):
        freq = new_counter[count]
        percentage = freq / total_periods * 100
        print(f"   {count}个新出现: {freq}次 ({percentage:.1f}%)")
    
    # 3. 消失尾号数量分布
    print("\n3. 消失尾号数量分布:")
    disappeared_counter = Counter(disappeared_counts)
    for count in sorted(disappeared_counter.keys()):
        freq = disappeared_counter[count]
        percentage = freq / total_periods * 100
        print(f"   {count}个消失: {freq}次 ({percentage:.1f}%)")
    
    # 4. 重复模式统计
    print("\n4. 重复模式统计 (前10):")
    for pattern, count in repeat_patterns.most_common(10):
        percentage = count / total_periods * 100
        print(f"   {pattern}: {count}次 ({percentage:.1f}%)")
    
    # 5. 重复尾号频率（哪些尾号更容易重复）
    print("\n5. 重复尾号频率 (尾号 -> 重复次数):")
    for tail in range(10):
        count = repeat_tail_freq.get(tail, 0)
        print(f"   尾号{tail}: {count}次")
    
    # 6. 新出现尾号频率（哪些尾号更容易新出现）
    print("\n6. 新出现尾号频率 (尾号 -> 新出现次数):")
    for tail in range(10):
        count = new_tail_freq.get(tail, 0)
        print(f"   尾号{tail}: {count}次")
    
    # 7. 消失尾号频率（哪些尾号更容易消失）
    print("\n7. 消失尾号频率 (尾号 -> 消失次数):")
    for tail in range(10):
        count = disappeared_tail_freq.get(tail, 0)
        print(f"   尾号{tail}: {count}次")
    
    # 8. 连续重复尾号（连续两期都出现的尾号）
    print("\n8. 连续重复尾号频率 (尾号 -> 连续出现次数):")
    for tail in range(10):
        count = consecutive_repeat_tails.get(tail, 0)
        print(f"   尾号{tail}: {count}次")
    
    # 9. 分析用户提到的模式：3重复2新
    print("\n9. 用户提到的模式分析 (3重复2新):")
    pattern_count = repeat_patterns.get("3重复2新", 0)
    if pattern_count > 0:
        print(f"   出现次数: {pattern_count}次 ({pattern_count/total_periods*100:.1f}%)")
        
        # 分析这种模式中重复尾号和新尾号的具体情况
        print("   这种模式中重复尾号的平均数量: 3个")
        print("   这种模式中新出现尾号的平均数量: 2个")
        
        # 分析这种模式中哪些尾号更容易重复
        print("   这种模式中重复尾号的分布:")
        # 这里需要更详细的分析，暂时省略
    else:
        print("   未发现此模式")
    
    # 10. 分析重复尾号数量与新尾号数量的关系
    print("\n10. 重复尾号数量与新尾号数量的关系:")
    print("    重复数 | 新出现数 | 频率")
    print("    " + "-" * 30)
    for repeat_count in sorted(repeat_counter.keys()):
        for new_count in sorted(new_counter.keys()):
            # 计算同时出现的次数
            both_count = 0
            for i in range(len(repeat_counts)):
                if repeat_counts[i] == repeat_count and new_counts[i] == new_count:
                    both_count += 1
            if both_count > 0:
                print(f"    {repeat_count}      | {new_count}        | {both_count}次")

def analyze_specific_pattern(data, pattern_name="3重复2新"):
    """分析特定模式的具体情况"""
    print("\n" + "=" * 80)
    print(f"特定模式分析: {pattern_name}")
    print("=" * 80)
    
    front_draws = [draw['front'] for draw in data]
    
    # 找出所有符合模式的期数
    matching_periods = []
    
    for i in range(len(front_draws) - 1):
        current_tails = set(get_tails(front_draws[i]))
        next_tails = set(get_tails(front_draws[i + 1]))
        
        repeat_tails = current_tails & next_tails
        new_tails = next_tails - current_tails
        
        if len(repeat_tails) == 3 and len(new_tails) == 2:
            matching_periods.append({
                'period': i + 1,
                'current_tails': sorted(current_tails),
                'next_tails': sorted(next_tails),
                'repeat_tails': sorted(repeat_tails),
                'new_tails': sorted(new_tails),
                'disappeared_tails': sorted(current_tails - next_tails)
            })
    
    print(f"总期数: {len(front_draws)}")
    print(f"符合模式的期数: {len(matching_periods)}")
    print(f"模式出现频率: {len(matching_periods)/(len(front_draws)-1)*100:.1f}%")
    
    if matching_periods:
        # 分析重复尾号的分布
        repeat_tail_counter = Counter()
        new_tail_counter = Counter()
        disappeared_tail_counter = Counter()
        
        for period in matching_periods:
            for tail in period['repeat_tails']:
                repeat_tail_counter[tail] += 1
            for tail in period['new_tails']:
                new_tail_counter[tail] += 1
            for tail in period['disappeared_tails']:
                disappeared_tail_counter[tail] += 1
        
        print("\n重复尾号分布:")
        for tail in range(10):
            count = repeat_tail_counter.get(tail, 0)
            if count > 0:
                print(f"  尾号{tail}: {count}次 ({count/len(matching_periods)*100:.1f}%)")
        
        print("\n新出现尾号分布:")
        for tail in range(10):
            count = new_tail_counter.get(tail, 0)
            if count > 0:
                print(f"  尾号{tail}: {count}次 ({count/len(matching_periods)*100:.1f}%)")
        
        print("\n消失尾号分布:")
        for tail in range(10):
            count = disappeared_tail_counter.get(tail, 0)
            if count > 0:
                print(f"  尾号{tail}: {count}次 ({count/len(matching_periods)*100:.1f}%)")
        
        # 显示前5个例子
        print("\n前5个例子:")
        for i, period in enumerate(matching_periods[:5]):
            print(f"  期数{period['period']}:")
            print(f"    当前期尾号: {period['current_tails']}")
            print(f"    下期尾号: {period['next_tails']}")
            print(f"    重复尾号: {period['repeat_tails']}")
            print(f"    新出现尾号: {period['new_tails']}")
            print(f"    消失尾号: {period['disappeared_tails']}")

def main():
    """主函数"""
    print("开始分析跨行尾号部分重复模式...")
    
    # 加载数据
    data = load_data()
    print(f"加载数据完成，共{len(data)}期")
    
    # 分析部分重复模式
    analyze_partial_repeat_pattern(data)
    
    # 分析用户提到的特定模式
    analyze_specific_pattern(data, "3重复2新")
    
    print("\n分析完成!")

if __name__ == "__main__":
    main()