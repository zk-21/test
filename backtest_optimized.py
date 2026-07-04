#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
回测验证脚本 - 验证优化后的命中率和覆盖率
验证内容：
1. 首位球动态预测命中率（5种规律融合）
2. 尾号模式覆盖率
3. 整体前区命中率
"""

import json
import os
from collections import defaultdict

def load_draws():
    """加载历史开奖数据"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, 'all_draws.json')
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    draws = []
    for idx, item in enumerate(data):
        # 支持issue或row字段
        row = item.get('row') or item.get('issue') or (idx + 1)
        front = item.get('front', [])
        back = item.get('back', [])
        if len(front) == 5 and len(back) == 2:
            draws.append({
                'row': row,
                'front': sorted(front),
                'back': sorted(back)
            })
    
    draws.sort(key=lambda x: x['row'])
    return draws

def predict_first_ball_comprehensive(current_draw, all_draws, current_idx):
    """
    首位球综合动态预测（模拟JS逻辑）
    返回预测的1-15号码评分列表
    """
    scores = {n: 0 for n in range(1, 16)}
    
    cur_nums = current_draw['front']
    cur_first = cur_nums[0]
    
    # 规律A: 当期首位球±3范围（54.2%覆盖）- 高权重
    for delta in range(-3, 4):
        candidate = cur_first + delta
        if 1 <= candidate <= 15:
            if delta == 0:
                weight = 8
            elif abs(delta) == 1:
                weight = 10
            elif abs(delta) == 2:
                weight = 6
            else:
                weight = 4
            scores[candidate] += weight
    
    # 规律B: 当期号码的±1（22.0%命中）- 中权重
    for n in cur_nums:
        for delta in [-1, 1]:
            candidate = n + delta
            if 1 <= candidate <= 15:
                scores[candidate] += 5
    
    # 规律C: +9期号码（17.4%命中）- 中权重
    if current_idx >= 9:
        plus9_draw = all_draws[current_idx - 9]
        for n in plus9_draw['front']:
            if 1 <= n <= 15:
                scores[n] += 6
    
    # 规律D: 等差延伸（9.3%命中）- 低权重
    for i in range(len(cur_nums)):
        for j in range(i + 1, len(cur_nums)):
            diff = cur_nums[j] - cur_nums[i]
            if 1 <= diff <= 10:
                prev_val = cur_nums[i] - diff
                if 1 <= prev_val <= 15:
                    scores[prev_val] += 3
    
    # 规律E: 尾号转移预测（简化版）
    cur_first_tail = cur_first % 10
    # 统计历史转移
    trans_count = defaultdict(int)
    lookback = min(20, current_idx)
    for i in range(max(0, current_idx - lookback), current_idx):
        src_first = all_draws[i]['front'][0]
        tgt_first = all_draws[i + 1]['front'][0]
        src_tail = src_first % 10
        tgt_tail = tgt_first % 10
        if src_tail == cur_first_tail:
            trans_count[tgt_tail] += 1
    
    # 取转移最多的3个尾号
    top_tails = sorted(trans_count.items(), key=lambda x: -x[1])[:3]
    for tail, _ in top_tails:
        for n in range(1, 16):
            if n % 10 == tail:
                scores[n] += 4
    
    # 基础分：历史频率（近20期）
    for n in range(1, 16):
        recent_count = 0
        for i in range(max(0, current_idx - 20), current_idx):
            if n in all_draws[i]['front']:
                recent_count += 1
        scores[n] += recent_count * 2
    
    # 返回排序后的预测结果
    sorted_scores = sorted(scores.items(), key=lambda x: -x[1])
    return sorted_scores

def backtest_first_ball_prediction(draws):
    """回测首位球动态预测命中率"""
    print("=" * 60)
    print("首位球动态预测回测")
    print("=" * 60)
    
    top1_hits = 0
    top3_hits = 0
    top5_hits = 0
    top10_hits = 0
    total = 0
    
    # 确保有足够的历史数据
    if len(draws) < 22:
        print(f"数据不足，需要至少22期，当前只有{len(draws)}期")
        return {'top1': 0, 'top3': 0, 'top5': 0, 'top10': 0}
    
    start_idx = 20  # 从第21期开始预测（需要前20期作为历史）
    for idx in range(start_idx, len(draws) - 1):
        current_draw = draws[idx]
        next_draw = draws[idx + 1]
        next_first = next_draw['front'][0]
        
        # 获取预测结果
        predictions = predict_first_ball_comprehensive(current_draw, draws, idx)
        predicted_nums = [n for n, _ in predictions]
        
        # 统计命中
        if next_first in predicted_nums[:1]:
            top1_hits += 1
        if next_first in predicted_nums[:3]:
            top3_hits += 1
        if next_first in predicted_nums[:5]:
            top5_hits += 1
        if next_first in predicted_nums[:10]:
            top10_hits += 1
        
        total += 1
    
    if total == 0:
        print("回测期数为0，无法计算")
        return {'top1': 0, 'top3': 0, 'top5': 0, 'top10': 0}
    
    print(f"回测期数: {total}")
    print(f"Top1 命中: {top1_hits} ({top1_hits/total*100:.1f}%)")
    print(f"Top3 命中: {top3_hits} ({top3_hits/total*100:.1f}%)")
    print(f"Top5 命中: {top5_hits} ({top5_hits/total*100:.1f}%)")
    print(f"Top10命中: {top10_hits} ({top10_hits/total*100:.1f}%)")
    print()
    
    return {
        'top1': top1_hits / total,
        'top3': top3_hits / total,
        'top5': top5_hits / total,
        'top10': top10_hits / total
    }

def backtest_tail_mode(draws, selected_tails):
    """回测尾号模式覆盖率"""
    print("=" * 60)
    print(f"尾号模式回测 - 选中尾号: {selected_tails}")
    print("=" * 60)
    
    # 构建候选池
    tail_pool = []
    for n in range(1, 36):
        if n % 10 in selected_tails:
            tail_pool.append(n)
    
    print(f"候选池: {tail_pool} ({len(tail_pool)}个号码)")
    
    # 统计每期开奖号码中命中尾号的数量
    tail_hits = 0
    number_hits = 0
    total = 0
    
    for draw in draws:
        front = draw['front']
        total += 1
        
        # 统计命中尾号的号码
        hit_numbers = [n for n in front if n % 10 in selected_tails]
        if len(hit_numbers) > 0:
            tail_hits += 1
        number_hits += len(hit_numbers)
    
    print(f"回测期数: {total}")
    if total == 0:
        print("回测期数为0，无法计算")
        return {'tail_hit_rate': 0, 'avg_hits': 0, 'pool_coverage': len(tail_pool)/35}
    print(f"命中尾号的期数: {tail_hits} ({tail_hits/total*100:.1f}%)")
    print(f"平均每期命中号码数: {number_hits/total:.2f}")
    print(f"候选池覆盖率: {len(tail_pool)/35*100:.1f}%")
    print()
    
    return {
        'tail_hit_rate': tail_hits / total,
        'avg_hits': number_hits / total,
        'pool_coverage': len(tail_pool) / 35
    }

def backtest_overall(draws):
    """回测整体命中率（模拟V4模式24球候选池）"""
    print("=" * 60)
    print("整体命中率回测（模拟V4模式24球候选池）")
    print("=" * 60)
    
    total_hits = 0
    total = 0
    
    # 确保有足够的历史数据
    if len(draws) < 22:
        print(f"数据不足，需要至少22期，当前只有{len(draws)}期")
        return {'avg_hits': 0, 'hit_rate': 0}
    
    start_idx = 20  # 从第21期开始预测
    for idx in range(start_idx, len(draws) - 1):
        current_draw = draws[idx]
        next_draw = draws[idx + 1]
        next_front = set(next_draw['front'])
        
        # 模拟V4候选池生成（简化版：基于历史频率+偏移评分）
        scores = {}
        for n in range(1, 36):
            score = 0
            
            # 历史频率
            recent_count = 0
            for i in range(max(0, idx - 20), idx):
                if n in draws[i]['front']:
                    recent_count += 1
            score += recent_count * 3
            
            # 偏移评分（与当期号码的距离）
            cur_nums = current_draw['front']
            min_offset = min(abs(n - a) for a in cur_nums)
            if min_offset == 0:
                score += 15  # 重复号
            elif min_offset == 1:
                score += 12
            elif min_offset == 2:
                score += 8
            elif min_offset == 3:
                score += 5
            
            # 首位球预测加分
            if n <= 15:
                predictions = predict_first_ball_comprehensive(current_draw, draws, idx)
                predicted_nums = [num for num, _ in predictions]
                if n in predicted_nums[:5]:
                    score += 12
                elif n in predicted_nums[:10]:
                    score += 6
            
            scores[n] = score
        
        # 取Top24作为候选池
        sorted_scores = sorted(scores.items(), key=lambda x: -x[1])
        pool = set(n for n, _ in sorted_scores[:24])
        
        # 统计命中
        hits = len(pool & next_front)
        total_hits += hits
        total += 1
    
    avg_hits = total_hits / total if total > 0 else 0
    print(f"回测期数: {total}")
    print(f"平均每期命中号码数: {avg_hits:.2f}/5")
    print(f"命中率: {avg_hits/5*100:.1f}%")
    print()
    
    return {
        'avg_hits': avg_hits,
        'hit_rate': avg_hits / 5
    }

def main():
    print("\n" + "=" * 60)
    print("大乐透选号系统回测验证")
    print("=" * 60 + "\n")
    
    draws = load_draws()
    print(f"加载历史数据: {len(draws)}期\n")
    
    # 1. 首位球动态预测回测
    first_ball_results = backtest_first_ball_prediction(draws)
    
    # 2. 尾号模式回测（测试不同尾号组合）
    tail_results = {}
    for tails in [{0, 1, 2}, {3, 4, 5}, {0, 1, 2, 3}, {5, 6, 7, 8}]:
        result = backtest_tail_mode(draws, tails)
        tail_results[str(sorted(tails))] = result
    
    # 3. 整体命中率回测
    overall_results = backtest_overall(draws)
    
    # 汇总
    print("=" * 60)
    print("回测结果汇总")
    print("=" * 60)
    print(f"\n首位球预测:")
    print(f"  Top1命中率: {first_ball_results['top1']*100:.1f}%")
    print(f"  Top5命中率: {first_ball_results['top5']*100:.1f}%")
    print(f"  Top10命中率: {first_ball_results['top10']*100:.1f}%")
    
    print(f"\n尾号模式:")
    for tails, result in tail_results.items():
        print(f"  尾号{tails}: 命中率{result['tail_hit_rate']*100:.1f}%, 平均命中{result['avg_hits']:.2f}个")
    
    print(f"\n整体命中率:")
    print(f"  平均命中: {overall_results['avg_hits']:.2f}/5")
    print(f"  命中率: {overall_results['hit_rate']*100:.1f}%")
    
    print("\n" + "=" * 60)
    print("回测完成")
    print("=" * 60)

if __name__ == '__main__':
    main()
