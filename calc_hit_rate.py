# -*- coding: utf-8 -*-
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('real_predictions_2025101_2025111.json', 'r', encoding='utf-8') as f:
    predictions = json.load(f)

# 统计
total_target_balls = len(predictions) * 5  # 每期5个前区目标球
total_back_balls = len(predictions) * 2    # 每期2个后区目标球

top1_hits = 0
top3_hits = 0
top5_hits = 0
top5_covered = 0  # Top5联合覆盖（去重）

bulou6_hits = 0
bulou6_covered = 0

top5_plus_bulou6_covered = 0  # Top5+补漏6联合覆盖

back_pred_hits = 0

for pred in predictions:
    tgt_front = set(pred['tgtFront'])
    tgt_back = set(pred['tgtBack'])
    top5 = pred['top5']
    bulou6 = pred['buLou6']
    
    # Top1命中
    top1_set = set(top5[0]['numbers'])
    top1_hits += len(top1_set & tgt_front)
    
    # Top3命中
    top3_set = set()
    for i in range(3):
        top3_set.update(top5[i]['numbers'])
    top3_hits += len(top3_set & tgt_front)
    
    # Top5命中（每个组合分别统计）
    for i in range(5):
        combo_set = set(top5[i]['numbers'])
        top5_hits += len(combo_set & tgt_front)
    
    # Top5联合覆盖（去重）
    top5_union = set()
    for i in range(5):
        top5_union.update(top5[i]['numbers'])
    top5_covered += len(top5_union & tgt_front)
    
    # 补漏6命中
    bulou6_set = set(bulou6['numbers'])
    bulou6_hits += len(bulou6_set & tgt_front)
    
    # Top5+补漏6联合覆盖
    all_covered = top5_union | bulou6_set
    top5_plus_bulou6_covered += len(all_covered & tgt_front)
    
    # 后区命中
    back_pred = set(pred['backPred'][:2])
    back_pred_hits += len(back_pred & tgt_back)

# 计算率
top1_rate = top1_hits / total_target_balls * 100
top3_rate = top3_hits / (total_target_balls * 3) * 100  # Top3共15个号码
top5_rate = top5_hits / (total_target_balls * 5) * 100  # Top5共25个号码
top5_cover_rate = top5_covered / total_target_balls * 100
bulou6_rate = bulou6_hits / (total_target_balls) * 100  # 补漏6有6个号码，但目标只有5个
all_cover_rate = top5_plus_bulou6_covered / total_target_balls * 100
back_rate = back_pred_hits / total_back_balls * 100

print(f"=== 预测命中率统计 ({len(predictions)}期) ===\n")
print(f"目标球总数: 前区{total_target_balls}个, 后区{total_back_balls}个\n")

print(f"【前区命中率】")
print(f"  Top1 命中: {top1_hits}/{total_target_balls} = {top1_rate:.1f}%")
print(f"  Top3 命中: {top3_hits}/{total_target_balls*3} = {top3_rate:.1f}%")
print(f"  Top5 命中: {top5_hits}/{total_target_balls*5} = {top5_rate:.1f}%")
print(f"")
print(f"【前区覆盖率】")
print(f"  Top5 联合覆盖: {top5_covered}/{total_target_balls} = {top5_cover_rate:.1f}%")
print(f"  补漏6 命中: {bulou6_hits}/{total_target_balls} = {bulou6_rate:.1f}%")
print(f"  Top5+补漏6 联合覆盖: {top5_plus_bulou6_covered}/{total_target_balls} = {all_cover_rate:.1f}%")
print(f"")
print(f"【后区命中率】")
print(f"  后区预测命中: {back_pred_hits}/{total_back_balls} = {back_rate:.1f}%")
