"""
首位球深度规律分析 + 动态预测回测
分析：参考行、+9期重复、相邻、等差等规律
"""
import json
from collections import Counter, defaultdict

with open(r'c:\Users\61419\Downloads\selectBall-main选尾号\selectBall-main\selectBall-main\all_draws.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

total = len(data)
print(f"回测期数: {total}")
print(f"期号范围: {data[0]['issue']} ~ {data[-1]['issue']}")
print()

# ============================================================
# 规律1: 参考行（当前期）首位球与下期首位球的关系
# ============================================================
print("=" * 60)
print("规律1: 参考行首位球 → 下期首位球")
print("=" * 60)

# 1a. 首位球差值分布
diffs = []
for i in range(total - 1):
    cur = data[i]['front'][0]
    nxt = data[i + 1]['front'][0]
    diffs.append(nxt - cur)

diff_counter = Counter(diffs)
print("首位球差值分布（下期-当期）:")
for d in sorted(diff_counter.keys()):
    if abs(d) <= 15:
        c = diff_counter[d]
        bar = '#' * c
        print(f"  {d:+3d}: {c:2d}次 ({c/(total-1)*100:4.1f}%) {bar}")

# 1b. 首位球尾号转移矩阵
print("\n首位球尾号转移矩阵（当期尾号→下期尾号）:")
trans_matrix = [[0]*10 for _ in range(10)]
for i in range(total - 1):
    src_tail = data[i]['front'][0] % 10
    tgt_tail = data[i + 1]['front'][0] % 10
    trans_matrix[src_tail][tgt_tail] += 1

for src in range(10):
    row_total = sum(trans_matrix[src])
    if row_total == 0:
        continue
    best_tgts = sorted(range(10), key=lambda t: -trans_matrix[src][t])[:3]
    best_str = ", ".join(f"尾号{t}({trans_matrix[src][t]}次/{row_total}={trans_matrix[src][t]/row_total*100:.0f}%)" for t in best_tgts)
    print(f"  尾号{src} → {best_str}")

# 1c. 首位球号码转移（具体号码）
print("\n首位球号码转移（当期号码→下期号码）:")
num_trans = defaultdict(Counter)
for i in range(total - 1):
    src = data[i]['front'][0]
    tgt = data[i + 1]['front'][0]
    num_trans[src][tgt] += 1

for src in sorted(num_trans.keys()):
    if sum(num_trans[src].values()) >= 3:
        top3 = num_trans[src].most_common(3)
        top3_str = ", ".join(f"{n}({c}次)" for n, c in top3)
        print(f"  {src:2d} → {top3_str}")

# ============================================================
# 规律2: +9期重复号与首位球的关系
# ============================================================
print()
print("=" * 60)
print("规律2: +9期重复号与首位球")
print("=" * 60)

# 分析：当期+9期的号码中，哪些成为下期首位球
plus9_hit_as_first = 0
plus9_total = 0
plus9_first_hit = 0  # +9期的首位球成为下期首位球

for i in range(9, total - 1):
    plus9_nums = set(data[i]['front'])
    next_first = data[i + 1]['front'][0]
    
    if next_first in plus9_nums:
        plus9_hit_as_first += 1
    plus9_total += 1
    
    if data[i]['front'][0] == next_first:
        plus9_first_hit += 1

print(f"+9期号码命中下期首位球: {plus9_hit_as_first}/{plus9_total} = {plus9_hit_as_first/plus9_total*100:.1f}%")
print(f"+9期首位球重复为下期首位球: {plus9_first_hit}/{plus9_total} = {plus9_first_hit/plus9_total*100:.1f}%")

# +9期号码与下期首位球的尾号关系
print("\n+9期号码尾号 → 下期首位球尾号:")
plus9_tail_trans = defaultdict(Counter)
for i in range(9, total - 1):
    plus9_tails = set(n % 10 for n in data[i]['front'])
    next_first_tail = data[i + 1]['front'][0] % 10
    for t in plus9_tails:
        plus9_tail_trans[t][next_first_tail] += 1

for src_t in sorted(plus9_tail_trans.keys()):
    total_cnt = sum(plus9_tail_trans[src_t].values())
    if total_cnt >= 3:
        top3 = plus9_tail_trans[src_t].most_common(3)
        top3_str = ", ".join(f"尾号{t}({c}次/{total_cnt}={c/total_cnt*100:.0f}%)" for t, c in top3)
        print(f"  +9期尾号{src_t} → 下期首位球{top3_str}")

# ============================================================
# 规律3: 相邻号（±1）与首位球
# ============================================================
print()
print("=" * 60)
print("规律3: 相邻号（±1）与首位球")
print("=" * 60)

adj_hit = 0
for i in range(total - 1):
    cur_nums = set(data[i]['front'])
    next_first = data[i + 1]['front'][0]
    # 检查next_first是否是当期某个号码的±1
    adjacent_nums = set()
    for n in cur_nums:
        if n - 1 >= 1: adjacent_nums.add(n - 1)
        if n + 1 <= 35: adjacent_nums.add(n + 1)
    adjacent_nums -= cur_nums  # 排除重复号
    
    if next_first in adjacent_nums:
        adj_hit += 1

print(f"下期首位球是当期号码的±1: {adj_hit}/{total-1} = {adj_hit/(total-1)*100:.1f}%")

# 当期首位球的±1成为下期首位球
first_adj_hit = 0
for i in range(total - 1):
    cur_first = data[i]['front'][0]
    next_first = data[i + 1]['front'][0]
    if abs(next_first - cur_first) == 1:
        first_adj_hit += 1

print(f"下期首位球 = 当期首位球±1: {first_adj_hit}/{total-1} = {first_adj_hit/(total-1)*100:.1f}%")

# ±2范围
first_adj2_hit = 0
for i in range(total - 1):
    cur_first = data[i]['front'][0]
    next_first = data[i + 1]['front'][0]
    if abs(next_first - cur_first) <= 2:
        first_adj2_hit += 1

print(f"下期首位球 = 当期首位球±2: {first_adj2_hit}/{total-1} = {first_adj2_hit/(total-1)*100:.1f}%")

# ±3范围
first_adj3_hit = 0
for i in range(total - 1):
    cur_first = data[i]['front'][0]
    next_first = data[i + 1]['front'][0]
    if abs(next_first - cur_first) <= 3:
        first_adj3_hit += 1

print(f"下期首位球 = 当期首位球±3: {first_adj3_hit}/{total-1} = {first_adj3_hit/(total-1)*100:.1f}%")

# ============================================================
# 规律4: 等差数列与首位球
# ============================================================
print()
print("=" * 60)
print("规律4: 等差数列与首位球")
print("=" * 60)

# 当期5个号码的等差关系，预测下期首位球
ap_hit = 0
for i in range(total - 1):
    nums = sorted(data[i]['front'])
    next_first = data[i + 1]['front'][0]
    
    # 检查当期是否存在等差数列，其延伸项是下期首位球
    for j in range(len(nums)):
        for k in range(j + 1, len(nums)):
            diff = nums[k] - nums[j]
            if diff <= 0 or diff > 15:
                continue
            # 向前延伸
            prev_val = nums[j] - diff
            if prev_val >= 1 and prev_val == next_first:
                ap_hit += 1
                break
            # 向后延伸（如果延伸项是首位球，说明首位球在等差中）
            # 这种情况不太可能因为首位球通常很小
        if ap_hit > 0 and i > 0:
            break

print(f"下期首位球在当期等差延伸中: {ap_hit}/{total-1} = {ap_hit/(total-1)*100:.1f}%")

# 当期号码间的差值，统计下期首位球最可能的差值
print("\n当期首位球与下期首位球的差值分布:")
first_diffs = Counter()
for i in range(total - 1):
    d = data[i + 1]['front'][0] - data[i]['front'][0]
    first_diffs[d] += 1

for d in sorted(first_diffs.keys()):
    if abs(d) <= 10:
        c = first_diffs[d]
        bar = '#' * c
        print(f"  {d:+3d}: {c:2d}次 ({c/(total-1)*100:4.1f}%) {bar}")

# ============================================================
# 规律5: 综合动态预测模型
# ============================================================
print()
print("=" * 60)
print("规律5: 综合动态预测模型回测")
print("=" * 60)

def predict_first_ball_comprehensive(draws, current_idx):
    """
    综合多种规律预测下期首位球候选号码（Top5）
    """
    scores = Counter()
    
    # 基础分：历史频率（近20期）
    for n in range(1, 16):  # 首位球几乎不会超过15
        recent_count = sum(1 for d in draws[max(0, current_idx - 20):current_idx] if n in d['front'])
        scores[n] += recent_count * 2
    
    if current_idx < 1:
        return scores.most_common(5)
    
    cur_draw = draws[current_idx - 1]
    cur_nums = cur_draw['front']
    cur_first = cur_nums[0]
    
    # 规律A: 参考行首位球±1/±2/±3
    for delta in [-3, -2, -1, 0, 1, 2, 3]:
        candidate = cur_first + delta
        if 1 <= candidate <= 15:
            weight = {0: 5, 1: 8, -1: 8, 2: 4, -2: 4, 3: 2, -3: 2}[delta]
            scores[candidate] += weight
    
    # 规律B: +9期重复号
    if current_idx >= 10:
        plus9_draw = draws[current_idx - 10]
        plus9_nums = plus9_draw['front']
        for n in plus9_nums:
            if 1 <= n <= 15:
                scores[n] += 6  # +9期号码作为首位球候选
    
    # 规律C: 相邻号（当期号码的±1）
    for n in cur_nums:
        for delta in [-1, 1]:
            candidate = n + delta
            if 1 <= candidate <= 15:
                scores[candidate] += 3
    
    # 规律D: 等差延伸
    sorted_nums = sorted(cur_nums)
    for j in range(len(sorted_nums)):
        for k in range(j + 1, len(sorted_nums)):
            diff = sorted_nums[k] - sorted_nums[j]
            if 1 <= diff <= 10:
                prev_val = sorted_nums[j] - diff
                if 1 <= prev_val <= 15:
                    scores[prev_val] += 4
    
    # 规律E: 尾号转移（当期首位球尾号→下期首位球尾号）
    cur_first_tail = cur_first % 10
    # 统计历史转移
    tail_trans = Counter()
    for i in range(max(0, current_idx - 30), current_idx - 1):
        if i + 1 < len(draws):
            src_t = draws[i]['front'][0] % 10
            tgt_t = draws[i + 1]['front'][0] % 10
            if src_t == cur_first_tail:
                tail_trans[tgt_t] += 1
    
    if tail_trans:
        for tgt_t, cnt in tail_trans.most_common(3):
            # 给匹配该尾号的小号加分
            for n in range(1, 16):
                if n % 10 == tgt_t:
                    scores[n] += cnt * 3
    
    return scores.most_common(5)

# 回测综合预测
hit_top1 = 0
hit_top3 = 0
hit_top5 = 0
test_count = 0

for i in range(30, total):
    predicted = predict_first_ball_comprehensive(data, i)
    predicted_nums = [n for n, _ in predicted]
    actual_first = data[i]['front'][0]
    
    test_count += 1
    if actual_first == predicted_nums[0]:
        hit_top1 += 1
    if actual_first in predicted_nums[:3]:
        hit_top3 += 1
    if actual_first in predicted_nums[:5]:
        hit_top5 += 1

print(f"测试期数: {test_count}")
print(f"综合预测Top1命中: {hit_top1}/{test_count} = {hit_top1/test_count*100:.1f}%")
print(f"综合预测Top3命中: {hit_top3}/{test_count} = {hit_top3/test_count*100:.1f}%")
print(f"综合预测Top5命中: {hit_top5}/{test_count} = {hit_top5/test_count*100:.1f}%")

# 对比：纯静态方法（总是选1-5中历史最高频的）
static_hit = 0
for i in range(30, total):
    freq = Counter()
    for d in data[max(0, i - 20):i]:
        for n in d['front']:
            if 1 <= n <= 5:
                freq[n] += 1
    if freq:
        best = freq.most_common(1)[0][0]
    else:
        best = 1
    if best == data[i]['front'][0]:
        static_hit += 1

print(f"\n静态方法(1-5最高频)命中: {static_hit}/{test_count} = {static_hit/test_count*100:.1f}%")

# 对比：随机选1-15
import random
random.seed(42)
random_hit = 0
for i in range(30, total):
    guess = random.randint(1, 15)
    if guess == data[i]['front'][0]:
        random_hit += 1
print(f"随机选(1-15)命中: {random_hit}/{test_count} = {random_hit/test_count*100:.1f}%")

# ============================================================
# 规律6: 首位球区间预测（不预测具体号码，预测区间）
# ============================================================
print()
print("=" * 60)
print("规律6: 首位球区间预测")
print("=" * 60)

# 预测首位球在1-5 / 6-10 / 11-15 的概率
zone_hit = {'1-5': 0, '6-10': 0, '11-15': 0}
zone_total = {'1-5': 0, '6-10': 0, '11-15': 0}

for i in range(30, total):
    predicted = predict_first_ball_comprehensive(data, i)
    predicted_nums = [n for n, _ in predicted]
    actual_first = data[i]['front'][0]
    
    # 预测最可能的区间
    zone_scores = {'1-5': 0, '6-10': 0, '11-15': 0}
    for n, s in predicted:
        if n <= 5: zone_scores['1-5'] += s
        elif n <= 10: zone_scores['6-10'] += s
        else: zone_scores['11-15'] += s
    
    predicted_zone = max(zone_scores, key=zone_scores.get)
    
    if actual_first <= 5:
        actual_zone = '1-5'
    elif actual_first <= 10:
        actual_zone = '6-10'
    else:
        actual_zone = '11-15'
    
    zone_total[predicted_zone] += 1
    if predicted_zone == actual_zone:
        zone_hit[predicted_zone] += 1

total_zone = sum(zone_total.values())
total_zone_hit = sum(zone_hit.values())
print(f"区间预测总命中率: {total_zone_hit}/{total_zone} = {total_zone_hit/total_zone*100:.1f}%")

# 静态区间预测（总是预测1-5）
static_zone_hit = sum(1 for i in range(30, total) if data[i]['front'][0] <= 5)
print(f"静态区间预测(总是1-5)命中率: {static_zone_hit}/{total-30} = {static_zone_hit/(total-30)*100:.1f}%")
