"""
v4.1引擎回测：统计命中率和候选池覆盖率
"""
import json
from collections import defaultdict

# 加载数据
with open('all_draws.json', 'r', encoding='utf-8') as f:
    ALL_DRAWS = json.load(f)

issue_map = {d['issue']: d for d in ALL_DRAWS}
all_issues = [d['issue'] for d in ALL_DRAWS]

# 导入v4.1引擎
import sys
sys.path.insert(0, '.')
from generate_v41_predictions import (
    build_pairs, predict, predict_back, generate_buLou6,
    CONFIG, tails, gi, interval_ratio
)

def run_backtest():
    pairs = build_pairs(10)
    print(f"回测配对数: {len(pairs)}")
    
    # 统计指标
    stats = {
        'top5_front_hits': [],      # Top5组合前区命中数
        'top5_back_hits': [],       # Top5组合后区命中数
        'pool_front_coverage': [],  # 候选池前区覆盖率（实际开奖号在池中的个数）
        'pool_back_coverage': [],   # 候选池后区覆盖率
        'buLou6_front_hits': [],    # 补漏6前区命中数
        'top1_front_hits': [],      # Top1组合前区命中数
    }
    
    for idx, (s_issue, t_issue) in enumerate(pairs):
        result = predict(s_issue, t_issue)
        if not result:
            continue
        
        target_draw = issue_map.get(t_issue)
        if not target_draw:
            continue
        
        actual_front = set(target_draw['front'])
        actual_back = set(target_draw['back'])
        
        # 候选池号码
        pool_numbers = set(c['number'] for c in result.get('pool', []))
        
        # Top5组合
        combos = result.get('combinations', [])
        top5_front_numbers = set()
        for combo in combos[:5]:
            for n in combo['numbers']:
                top5_front_numbers.add(n)
        
        # Top1组合
        top1_front = set(combos[0]['numbers']) if combos else set()
        
        # 后区预测
        src_idx = all_issues.index(s_issue)
        back_pred = predict_back(src_idx)
        back_pred_set = set(back_pred[:6])
        
        # 补漏6
        buLou6 = generate_buLou6(result, src_idx)
        buLou6_set = set(buLou6)
        
        # 计算命中
        pool_front_cov = len(actual_front & pool_numbers)
        pool_back_cov = len(actual_back & back_pred_set)
        top5_front_hit = len(actual_front & top5_front_numbers)
        top1_front_hit = len(actual_front & top1_front)
        buLou6_hit = len(actual_front & buLou6_set)
        
        stats['pool_front_coverage'].append(pool_front_cov)
        stats['pool_back_coverage'].append(pool_back_cov)
        stats['top5_front_hits'].append(top5_front_hit)
        stats['top1_front_hits'].append(top1_front_hit)
        stats['buLou6_front_hits'].append(buLou6_hit)
        
        if (idx + 1) % 20 == 0:
            print(f"  已完成 {idx+1}/{len(pairs)} 期")
    
    return stats

def print_stats(stats):
    print("\n" + "=" * 60)
    print("v4.1 引擎回测统计")
    print("=" * 60)
    
    total = len(stats['pool_front_coverage'])
    print(f"回测期数: {total}")
    
    # 候选池覆盖率（前区）
    pool_front = stats['pool_front_coverage']
    avg_pool_front = sum(pool_front) / total
    pool_front_dist = defaultdict(int)
    for v in pool_front:
        pool_front_dist[v] += 1
    
    print(f"\n【候选池前区覆盖率】（池24球 vs 实际5球）")
    print(f"  平均命中: {avg_pool_front:.2f}/5 ({avg_pool_front/5*100:.1f}%)")
    print(f"  分布:")
    for k in sorted(pool_front_dist.keys()):
        cnt = pool_front_dist[k]
        pct = cnt / total * 100
        print(f"    命中{k}个: {cnt}期 ({pct:.1f}%)")
    
    # 候选池覆盖率（后区）
    pool_back = stats['pool_back_coverage']
    avg_pool_back = sum(pool_back) / total
    pool_back_dist = defaultdict(int)
    for v in pool_back:
        pool_back_dist[v] += 1
    
    print(f"\n【候选池后区覆盖率】（后区预测6球 vs 实际2球）")
    print(f"  平均命中: {avg_pool_back:.2f}/2 ({avg_pool_back/2*100:.1f}%)")
    print(f"  分布:")
    for k in sorted(pool_back_dist.keys()):
        cnt = pool_back_dist[k]
        pct = cnt / total * 100
        print(f"    命中{k}个: {cnt}期 ({pct:.1f}%)")
    
    # Top5组合命中（前区）
    top5 = stats['top5_front_hits']
    avg_top5 = sum(top5) / total
    top5_dist = defaultdict(int)
    for v in top5:
        top5_dist[v] += 1
    
    print(f"\n【Top5组合前区命中】（5组×5球 vs 实际5球）")
    print(f"  平均命中: {avg_top5:.2f}/5 ({avg_top5/5*100:.1f}%)")
    print(f"  分布:")
    for k in sorted(top5_dist.keys()):
        cnt = top5_dist[k]
        pct = cnt / total * 100
        print(f"    命中{k}个: {cnt}期 ({pct:.1f}%)")
    
    # Top1组合命中（前区）
    top1 = stats['top1_front_hits']
    avg_top1 = sum(top1) / total
    top1_dist = defaultdict(int)
    for v in top1:
        top1_dist[v] += 1
    
    print(f"\n【Top1组合前区命中】（最佳1组×5球 vs 实际5球）")
    print(f"  平均命中: {avg_top1:.2f}/5 ({avg_top1/5*100:.1f}%)")
    print(f"  分布:")
    for k in sorted(top1_dist.keys()):
        cnt = top1_dist[k]
        pct = cnt / total * 100
        print(f"    命中{k}个: {cnt}期 ({pct:.1f}%)")
    
    # 补漏6命中（前区）
    buLou = stats['buLou6_front_hits']
    avg_buLou = sum(buLou) / total
    buLou_dist = defaultdict(int)
    for v in buLou:
        buLou_dist[v] += 1
    
    print(f"\n【补漏6前区命中】（补漏6球 vs 实际5球）")
    print(f"  平均命中: {avg_buLou:.2f}/5 ({avg_buLou/5*100:.1f}%)")
    print(f"  分布:")
    for k in sorted(buLou_dist.keys()):
        cnt = buLou_dist[k]
        pct = cnt / total * 100
        print(f"    命中{k}个: {cnt}期 ({pct:.1f}%)")
    
    # 综合：Top5 + 补漏6 联合覆盖
    combined = []
    for i in range(total):
        combined.append(stats['top5_front_hits'][i] + stats['buLou6_front_hits'][i])
    avg_combined = sum(combined) / total
    combined_dist = defaultdict(int)
    for v in combined:
        combined_dist[v] += 1
    
    print(f"\n【Top5+补漏6联合前区命中】（11球 vs 实际5球）")
    print(f"  平均命中: {avg_combined:.2f}/5 ({avg_combined/5*100:.1f}%)")
    print(f"  分布:")
    for k in sorted(combined_dist.keys()):
        cnt = combined_dist[k]
        pct = cnt / total * 100
        print(f"    命中{k}个: {cnt}期 ({pct:.1f}%)")

if __name__ == '__main__':
    stats = run_backtest()
    print_stats(stats)
