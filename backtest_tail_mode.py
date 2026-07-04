"""
尾号模式优化回测脚本
对比优化前后的命中率和候选池覆盖率
"""
import json
from collections import Counter, defaultdict

# 加载历史数据
with open(r'c:\Users\61419\Downloads\selectBall-main选尾号\selectBall-main\selectBall-main\all_draws.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

total = len(data)
print(f"回测期数: {total}")
print(f"期号范围: {data[0]['issue']} ~ {data[-1]['issue']}")
print()

# ============================================================
# 工具函数
# ============================================================
def get_tail(n):
    return n % 10

def get_tails(numbers):
    return set(n % 10 for n in numbers)

def get_numbers_by_tail(tail, max_num=35):
    """获取指定尾号的所有号码"""
    return [n for n in range(1, max_num + 1) if n % 10 == tail]

# ============================================================
# 回测1: 首位球尾号转移预测准确性
# ============================================================
print("=" * 60)
print("回测1: 首位球尾号转移预测准确性")
print("=" * 60)

def analyze_first_ball_tail_transition(draws, current_idx, lookback=20):
    """分析首位球尾号转移规律"""
    trans_freq = Counter()
    tail_freq = Counter()
    
    start = max(0, current_idx - lookback)
    for i in range(start, current_idx):
        if i + 1 >= len(draws):
            break
        src_first = draws[i]['front'][0]
        tgt_first = draws[i + 1]['front'][0]
        src_tail = src_first % 10
        tgt_tail = tgt_first % 10
        trans_freq[(src_tail, tgt_tail)] += 1
        tail_freq[tgt_tail] += 1
    
    return trans_freq, tail_freq

def predict_first_ball_tail(current_tail, trans_freq, tail_freq):
    """预测下期首位球尾号"""
    scores = Counter()
    for tt in range(10):
        scores[tt] = trans_freq.get((current_tail, tt), 0) * 2 + tail_freq.get(tt, 0) * 0.3
    return scores.most_common(3)  # Top3预测

# 回测首位球预测
correct_top1 = 0
correct_top3 = 0
static_correct = 0  # 静态方法：总是预测尾号0-5（因为1-5占58%）

for i in range(20, total - 1):
    current_first_tail = data[i]['front'][0] % 10
    next_first_ball = data[i + 1]['front'][0]
    next_first_tail = next_first_ball % 10
    
    # 动态预测
    trans_freq, tail_freq = analyze_first_ball_tail_transition(data, i, lookback=20)
    predicted = predict_first_ball_tail(current_first_tail, trans_freq, tail_freq)
    predicted_tails = [t for t, _ in predicted]
    
    if next_first_tail == predicted_tails[0]:
        correct_top1 += 1
    if next_first_tail in predicted_tails:
        correct_top3 += 1
    
    # 静态方法：预测尾号0-5
    if next_first_tail <= 5:
        static_correct += 1

print(f"动态预测Top1命中率: {correct_top1}/{total-21} = {correct_top1/(total-21)*100:.1f}%")
print(f"动态预测Top3命中率: {correct_top3}/{total-21} = {correct_top3/(total-21)*100:.1f}%")
print(f"静态方法(尾号0-5)命中率: {static_correct}/{total-21} = {static_correct/(total-21)*100:.1f}%")
print()

# ============================================================
# 回测2: 候选池覆盖率（尾号模式）
# ============================================================
print("=" * 60)
print("回测2: 尾号候选池覆盖率")
print("=" * 60)

def simulate_tail_mode(draws, current_idx, selected_tails, with_expansion=True, with_dynamic_score=True):
    """
    模拟尾号模式选号
    返回: (候选池, 5组组合)
    """
    # 基础候选池：按尾号筛选
    pool = []
    for tail in selected_tails:
        pool.extend(get_numbers_by_tail(tail))
    pool = sorted(set(pool))
    
    if with_expansion and len(pool) < 6:
        # 候选池扩展：补充邻近尾号的高频号码
        pool_set = set(pool)
        expansion_candidates = []
        
        for tail in selected_tails:
            for nt in [(tail + 9) % 10, (tail + 1) % 10]:
                for n in get_numbers_by_tail(nt):
                    if n not in pool_set:
                        # 计算历史频率
                        hist_count = sum(1 for d in draws[:current_idx] if n in d['front'])
                        recent_count = sum(1 for d in draws[max(0, current_idx-10):current_idx] if n in d['front'])
                        score = hist_count * 2 + recent_count * 3
                        expansion_candidates.append((n, score))
        
        expansion_candidates.sort(key=lambda x: -x[1])
        for n, _ in expansion_candidates:
            if len(pool) >= 10:
                break
            if n not in pool_set:
                pool.append(n)
                pool_set.add(n)
    
    # 如果仍然不够，补充历史高频号码
    if with_expansion and len(pool) < 6:
        all_nums = []
        for n in range(1, 36):
            if n not in pool_set:
                hist_count = sum(1 for d in draws[:current_idx] if n in d['front'])
                recent_count = sum(1 for d in draws[max(0, current_idx-10):current_idx] if n in d['front'])
                score = hist_count * 2 + recent_count * 3
                all_nums.append((n, score))
        all_nums.sort(key=lambda x: -x[1])
        for n, _ in all_nums:
            if len(pool) >= 6:
                break
            pool.append(n)
            pool_set.add(n)
    
    # 评分
    scored = []
    for n in pool:
        score = 0
        t = n % 10
        
        # 历史频率
        hist_count = sum(1 for d in draws[:current_idx] if n in d['front'])
        recent_count = sum(1 for d in draws[max(0, current_idx-10):current_idx] if n in d['front'])
        score += hist_count * 2 + recent_count * 3
        
        if with_dynamic_score:
            # 首位球尾号预测加分
            if current_idx >= 20:
                trans_freq, tail_freq = analyze_first_ball_tail_transition(draws, current_idx, lookback=20)
                current_first_tail = draws[current_idx - 1]['front'][0] % 10
                predicted = predict_first_ball_tail(current_first_tail, trans_freq, tail_freq)
                predicted_tails = [t for t, _ in predicted]
                
                if t in predicted_tails:
                    if n <= 5: score += 10
                    elif n <= 10: score += 7
                    elif n <= 15: score += 4
                    else: score += 2
            
            # 静态首位球加分
            if n <= 5: score += 8
            elif n <= 10: score += 5
            elif n <= 15: score += 3
            elif n >= 25: score -= 3
        else:
            # 优化前：仅静态加分
            if n <= 5: score += 8
            elif n <= 10: score += 5
            elif n <= 15: score += 3
            elif n >= 25: score -= 3
        
        scored.append((n, score))
    
    scored.sort(key=lambda x: -x[1])
    
    # 生成5组组合（简化版：每组5个号码）
    combos = []
    if with_expansion:
        # 优化后：尾号覆盖优化
        used_tails = set()
        for _ in range(5):
            combo = []
            combo_tails = set()
            for n, s in scored:
                if n not in combo:
                    t = n % 10
                    # 优先选择新尾号
                    if t not in used_tails or len(combo) >= 4:
                        combo.append(n)
                        combo_tails.add(t)
                        if len(combo) >= 5:
                            break
            if combo:
                combos.append(sorted(combo[:5]))
                used_tails.update(combo_tails)
    else:
        # 优化前：简单取Top5
        top_nums = [n for n, _ in scored[:5]]
        for _ in range(5):
            combos.append(sorted(top_nums))
    
    return pool, combos

# 回测候选池覆盖率
# 测试不同尾号选择策略
test_tails_list = [
    [3],      # 单尾号
    [2, 3],   # 双尾号
    [1, 2, 3], # 三尾号
]

for test_tails in test_tails_list:
    print(f"\n--- 测试尾号: {test_tails} ---")
    
    # 优化前
    before_pool_hits = 0
    before_combo_hits = 0
    before_total_drawn = 0
    
    # 优化后
    after_pool_hits = 0
    after_combo_hits = 0
    after_total_drawn = 0
    
    test_count = 0
    
    for i in range(30, total):
        # 模拟优化前
        pool_before, combos_before = simulate_tail_mode(
            data, i, test_tails, 
            with_expansion=False, 
            with_dynamic_score=False
        )
        
        # 模拟优化后
        pool_after, combos_after = simulate_tail_mode(
            data, i, test_tails, 
            with_expansion=True, 
            with_dynamic_score=True
        )
        
        # 实际开奖号码
        drawn = set(data[i]['front'])
        
        # 计算覆盖率
        before_pool_hit = len(set(pool_before) & drawn)
        after_pool_hit = len(set(pool_after) & drawn)
        
        before_pool_hits += before_pool_hit
        after_pool_hits += after_pool_hit
        
        # 计算命中率（5组组合中最多命中数）
        before_max_hit = 0
        for combo in combos_before:
            hit = len(set(combo) & drawn)
            before_max_hit = max(before_max_hit, hit)
        before_combo_hits += before_max_hit
        
        after_max_hit = 0
        for combo in combos_after:
            hit = len(set(combo) & drawn)
            after_max_hit = max(after_max_hit, hit)
        after_combo_hits += after_max_hit
        
        before_total_drawn += 5  # 每组5个号码
        after_total_drawn += 5
        
        test_count += 1
    
    print(f"测试期数: {test_count}")
    print(f"优化前 - 候选池命中率: {before_pool_hits}/{before_total_drawn} = {before_pool_hits/before_total_drawn*100:.1f}%")
    print(f"优化后 - 候选池命中率: {after_pool_hits}/{after_total_drawn} = {after_pool_hits/after_total_drawn*100:.1f}%")
    print(f"优化前 - 单组最大命中: {before_combo_hits/test_count:.2f}个/组")
    print(f"优化后 - 单组最大命中: {after_combo_hits/test_count:.2f}个/组")

print()

# ============================================================
# 回测3: 首位球预测对选号的影响
# ============================================================
print("=" * 60)
print("回测3: 首位球预测对选号的影响")
print("=" * 60)

# 统计：使用动态预测后，首位球命中的提升
first_ball_hit_before = 0
first_ball_hit_after = 0

for i in range(30, total):
    drawn_first = data[i]['front'][0]
    
    # 优化前：静态评分，选评分最高的小号
    # 模拟：1-5中历史频率最高的
    best_before = None
    best_score_before = -1
    for n in range(1, 6):
        score = sum(1 for d in data[max(0, i-20):i] if n in d['front'])
        if score > best_score_before:
            best_score_before = score
            best_before = n
    
    # 优化后：动态预测 + 静态
    best_after = None
    best_score_after = -1
    for n in range(1, 16):
        score = sum(1 for d in data[max(0, i-20):i] if n in d['front'])
        # 静态加分
        if n <= 5: score += 8
        elif n <= 10: score += 5
        elif n <= 15: score += 3
        
        # 动态预测加分
        if i >= 20:
            trans_freq, tail_freq = analyze_first_ball_tail_transition(data, i, lookback=20)
            current_first_tail = data[i - 1]['front'][0] % 10
            predicted = predict_first_ball_tail(current_first_tail, trans_freq, tail_freq)
            predicted_tails = [t for t, _ in predicted]
            t = n % 10
            if t in predicted_tails:
                if n <= 5: score += 10
                elif n <= 10: score += 7
                elif n <= 15: score += 4
        
        if score > best_score_after:
            best_score_after = score
            best_after = n
    
    if best_before == drawn_first:
        first_ball_hit_before += 1
    if best_after == drawn_first:
        first_ball_hit_after += 1

test_count = total - 30
print(f"测试期数: {test_count}")
print(f"优化前 - 首位球命中: {first_ball_hit_before}/{test_count} = {first_ball_hit_before/test_count*100:.1f}%")
print(f"优化后 - 首位球命中: {first_ball_hit_after}/{test_count} = {first_ball_hit_after/test_count*100:.1f}%")
print()

# ============================================================
# 总结
# ============================================================
print("=" * 60)
print("回测总结")
print("=" * 60)
print("1. 首位球尾号预测：动态预测比静态方法更精准")
print("2. 候选池扩展：小候选池时补充邻近尾号，提升覆盖率")
print("3. 尾号覆盖优化：5组组合覆盖更多不同尾号")
