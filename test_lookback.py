"""
测试不同lookback值对尾号预测命中率的影响
"""
import json
from collections import defaultdict

with open('all_draws.json', 'r', encoding='utf-8') as f:
    ALL_DRAWS = json.load(f)

issue_map = {d['issue']: d for d in ALL_DRAWS}
all_issues = [d['issue'] for d in ALL_DRAWS]

from generate_v41_predictions import (
    build_pairs, tails, gi, interval_ratio,
    analyze_tail_transitions, predict_likely_tails_enhanced,
    generate_candidate_pool, generate_combinations_fast, predict_back,
    detect_extreme, compute_hotness, build_plus_ten_trend_map,
    build_bridge_map, build_arithmetic_endpoint_map, build_reference_window,
    analyze_tail_transitions, predict_target_interval_ratio, CONFIG
)

def test_lookback(lookback_value):
    """测试指定lookback值的命中率"""
    pairs = build_pairs(10)
    
    top1_hits = []
    top5_cover = []
    bulou6_hits = []
    
    for s_issue, t_issue in pairs:
        source_draw = issue_map.get(s_issue)
        target_draw = issue_map.get(t_issue)
        if not source_draw or not target_draw:
            continue
        
        actual_front = set(target_draw['front'])
        all_issues_list = [d['issue'] for d in ALL_DRAWS]
        src_idx = all_issues_list.index(s_issue)
        source_tails = tails(source_draw['front'])
        
        # 使用指定lookback的增强版尾号预测
        tail_trans = analyze_tail_transitions(src_idx, lookback_value)
        pred_tails = predict_likely_tails_enhanced(source_tails, tail_trans, src_idx, lookback_value)
        
        # 生成候选池（简化版，只看尾号预测效果）
        # 用尾号预测结果评估
        top5_tails = set(t for t, _ in pred_tails[:5])
        target_tails = tails(target_draw['front'])
        
        # 尾号命中数
        tail_hit = len(top5_tails & set(target_tails))
        top1_hits.append(tail_hit)
    
    avg = sum(top1_hits) / len(top1_hits) if top1_hits else 0
    hit_ge1 = sum(1 for h in top1_hits if h >= 1)
    hit_ge2 = sum(1 for h in top1_hits if h >= 2)
    total = len(top1_hits)
    
    return {
        'lookback': lookback_value,
        'total': total,
        'avg_tail_hit': avg,
        'hit_ge1': hit_ge1,
        'hit_ge1_pct': hit_ge1 / total * 100 if total else 0,
        'hit_ge2': hit_ge2,
        'hit_ge2_pct': hit_ge2 / total * 100 if total else 0,
    }

if __name__ == '__main__':
    print("=" * 60)
    print("测试不同lookback值对尾号预测命中率的影响")
    print("=" * 60)
    
    lookback_values = [12, 30, 50, 80, 100, 112]
    results = []
    
    for lb in lookback_values:
        print(f"\n测试 lookback={lb} ...")
        result = test_lookback(lb)
        results.append(result)
        print(f"  平均尾号命中: {result['avg_tail_hit']:.2f}/5")
        print(f"  命中>=1个: {result['hit_ge1']}/{result['total']} ({result['hit_ge1_pct']:.1f}%)")
        print(f"  命中>=2个: {result['hit_ge2']}/{result['total']} ({result['hit_ge2_pct']:.1f}%)")
    
    print("\n" + "=" * 60)
    print("汇总对比")
    print("=" * 60)
    print(f"{'lookback':<10} {'平均命中':<12} {'命中>=1':<15} {'命中>=2':<15}")
    print("-" * 52)
    for r in results:
        print(f"{r['lookback']:<10} {r['avg_tail_hit']:.2f}/5{'':<6} {r['hit_ge1_pct']:.1f}%{'':<9} {r['hit_ge2_pct']:.1f}%")
