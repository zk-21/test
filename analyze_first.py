import json
import statistics
from collections import Counter

with open(r'c:\Users\61419\Downloads\selectBall-main选尾号\selectBall-main\selectBall-main\all_draws.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

total = len(data)
first_issue = data[0]['issue']
last_issue = data[-1]['issue']
print(f'总期数: {total}')
print(f'期号范围: {first_issue} ~ {last_issue}')
print()

# 提取第一个球
first_balls = [d['front'][0] for d in data]

# 1. 频率统计
freq = Counter(first_balls)
print('=== 第一个球频率统计 ===')
for num in sorted(freq.keys()):
    bar = '*' * freq[num]
    print(f'  {num:2d}: {freq[num]:2d}次 {bar}')

print()
# 2. 基本统计
mean_val = statistics.mean(first_balls)
median_val = statistics.median(first_balls)
stdev_val = statistics.stdev(first_balls)
print('=== 基本统计 ===')
print(f'  平均值: {mean_val:.1f}')
print(f'  中位数: {median_val:.1f}')
print(f'  标准差: {stdev_val:.1f}')
print(f'  最小值: {min(first_balls)}')
print(f'  最大值: {max(first_balls)}')

print()
# 3. 区间分布
zones = {'1-5': 0, '6-10': 0, '11-15': 0, '16-20': 0, '21-25': 0, '26-30': 0, '31-35': 0}
for n in first_balls:
    if n <= 5: zones['1-5'] += 1
    elif n <= 10: zones['6-10'] += 1
    elif n <= 15: zones['11-15'] += 1
    elif n <= 20: zones['16-20'] += 1
    elif n <= 25: zones['21-25'] += 1
    elif n <= 30: zones['26-30'] += 1
    else: zones['31-35'] += 1
print('=== 区间分布 ===')
for z, c in zones.items():
    pct = c / total * 100
    bar = '#' * c
    print(f'  {z}: {c:2d}次 ({pct:5.1f}%) {bar}')

print()
# 4. 奇偶分布
odd_count = sum(1 for n in first_balls if n % 2 == 1)
even_count = total - odd_count
print('=== 奇偶分布 ===')
print(f'  奇数: {odd_count}次 ({odd_count/total*100:.1f}%)')
print(f'  偶数: {even_count}次 ({even_count/total*100:.1f}%)')

print()
# 5. 尾号分布
tail_freq = Counter(n % 10 for n in first_balls)
print('=== 尾号分布 ===')
for t in range(10):
    c = tail_freq.get(t, 0)
    bar = '*' * c
    print(f'  尾号{t}: {c:2d}次 {bar}')

print()
# 6. 近20期走势
print('=== 近20期第一个球走势 ===')
recent = data[-20:]
for d in recent:
    n = d['front'][0]
    bar = '.' * (n - 1) + 'O'
    issue = d['issue']
    print(f'  {issue}: {n:2d} {bar}')

print()
# 7. 连续变化分析
print('=== 相邻期变化分析 ===')
changes = [first_balls[i+1] - first_balls[i] for i in range(len(first_balls)-1)]
up = sum(1 for c in changes if c > 0)
down = sum(1 for c in changes if c < 0)
same = sum(1 for c in changes if c == 0)
print(f'  上升: {up}次 ({up/len(changes)*100:.1f}%)')
print(f'  下降: {down}次 ({down/len(changes)*100:.1f}%)')
print(f'  相同: {same}次 ({same/len(changes)*100:.1f}%)')
avg_change = statistics.mean(abs(c) for c in changes)
print(f'  平均变化幅度: {avg_change:.1f}')

print()
# 8. 遗漏分析
print('=== 当前遗漏分析 ===')
last_seen = {}
for i, n in enumerate(first_balls):
    last_seen[n] = i
current_idx = len(first_balls) - 1
miss_list = []
for n in range(1, 36):
    if n in last_seen:
        miss = current_idx - last_seen[n]
        miss_list.append((n, miss))
    else:
        miss_list.append((n, 999))
miss_list.sort(key=lambda x: -x[1])
print('  遗漏最大的号码（Top10）:')
for n, miss in miss_list[:10]:
    print(f'    号码{n:2d}: 遗漏{miss}期')
print('  最近出现的号码（Top10）:')
for n, miss in miss_list[-10:]:
    print(f'    号码{n:2d}: {miss}期前出现')

print()
# 9. 连号分析
print('=== 连号分析 ===')
consec = 0
for i in range(1, len(first_balls)):
    if abs(first_balls[i] - first_balls[i-1]) == 1:
        consec += 1
print(f'  相邻期出现连号: {consec}次 ({consec/len(changes)*100:.1f}%)')

# 10. 大小分布
big = sum(1 for n in first_balls if n >= 18)
small = total - big
print()
print('=== 大小分布（1-17小，18-35大）===')
print(f'  小号(1-17): {small}次 ({small/total*100:.1f}%)')
print(f'  大号(18-35): {big}次 ({big/total*100:.1f}%)')
