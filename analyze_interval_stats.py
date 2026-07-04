"""
源行与目标期间隔期数统计 - 基于最新 all_draws.js (181期)
分析不同间隔下号码重叠率、尾号转移率、区间比转移率
"""
import json
from collections import Counter, defaultdict

# 加载数据（从 all_draws.js 解析）
data = []
with open(r'C:\Users\61419\Downloads\selectBall-main7208\selectBall-main\all_draws.js', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line.startswith('{ issue:'):
            # 解析 { issue: "2026072", date: "2026-06-29", front: [1, 13, 26, 29, 30], back: [9, 11] }
            parts = line.split(',')
            issue = parts[0].split('"')[1]
            front_str = line.split('front: [')[1].split(']')[0]
            front = [int(x.strip()) for x in front_str.split(',')]
            back_str = line.split('back: [')[1].split(']')[0]
            back = [int(x.strip()) for x in back_str.split(',')]
            data.append({'issue': issue, 'front': front, 'back': back})

# 按期号排序（从旧到新）
data.sort(key=lambda x: x['issue'])

total = len(data)
print(f'总期数: {total} ({data[0]["issue"]} ~ {data[-1]["issue"]})')
print()

# 建立期号索引
issue_map = {d['issue']: d for d in data}

# ============ 辅助函数 ============
def get_interval(front):
    c = [0, 0, 0]
    for n in front:
        if n <= 12:   c[0] += 1
        elif n <= 24: c[1] += 1
        else:         c[2] += 1
    return tuple(c)

def get_tails(front):
    return set(n % 10 for n in front)

def get_odd(front):
    return sum(1 for n in front if n % 2 == 1)

def get_sum(front):
    return sum(front)

def get_span(front):
    return max(front) - min(front)

def get_repeat(src, tgt):
    return len(set(src) & set(tgt))

# ============ 主分析 ============
intervals_to_test = [3, 5, 7, 8, 9, 10, 11, 12, 15, 20]

print('=' * 80)
print('一、不同间隔期数的号码重叠率统计')
print('=' * 80)
print(f'{"间隔":>6} {"可配对":>6} {"平均重叠":>10} {"0个":>6} {"1个":>6} {"2个":>6} {"3个":>6} {"4个":>6} {"5个":>6}')
print('-' * 80)

for iv in intervals_to_test:
    overlaps = []
    dist = Counter()
    for d in data:
        src_issue = d['issue']
        src_num = int(src_issue[4:])
        year = src_issue[:4]
        tgt_num = src_num + iv
        # 处理跨年
        tgt_year = year
        if tgt_num > 150:  # 大乐透每年约150期
            tgt_year = str(int(year) + 1)
            tgt_num -= 150
        tgt_issue = tgt_year + str(tgt_num).zfill(3)
        if tgt_issue in issue_map:
            tgt = issue_map[tgt_issue]
            ov = get_repeat(d['front'], tgt['front'])
            overlaps.append(ov)
            dist[ov] += 1
    
    if overlaps:
        avg = sum(overlaps) / len(overlaps)
        print(f'{iv:>6} {len(overlaps):>6} {avg:>10.2f} {dist[0]:>6} {dist[1]:>6} {dist[2]:>6} {dist[3]:>6} {dist[4]:>6} {dist[5]:>6}')

print()
print('=' * 80)
print('二、不同间隔的尾号转移率')
print('=' * 80)
print(f'{"间隔":>6} {"可配对":>6} {"平均尾号重叠":>14} {"尾号转移率":>12}')
print('-' * 80)

for iv in intervals_to_test:
    tail_overlaps = []
    for d in data:
        src_issue = d['issue']
        src_num = int(src_issue[4:])
        year = src_issue[:4]
        tgt_num = src_num + iv
        tgt_year = year
        if tgt_num > 150:
            tgt_year = str(int(year) + 1)
            tgt_num -= 150
        tgt_issue = tgt_year + str(tgt_num).zfill(3)
        if tgt_issue in issue_map:
            tgt = issue_map[tgt_issue]
            src_tails = get_tails(d['front'])
            tgt_tails = get_tails(tgt['front'])
            overlap = len(src_tails & tgt_tails)
            tail_overlaps.append(overlap)
    
    if tail_overlaps:
        avg = sum(tail_overlaps) / len(tail_overlaps)
        rate = avg / 5 * 100
        print(f'{iv:>6} {len(tail_overlaps):>6} {avg:>14.2f} {rate:>11.1f}%')

print()
print('=' * 80)
print('三、不同间隔的区间比转移率')
print('=' * 80)
print(f'{"间隔":>6} {"可配对":>6} {"区间比相同":>10} {"转移率":>8}')
print('-' * 80)

for iv in intervals_to_test:
    same_count = 0
    total_count = 0
    for d in data:
        src_issue = d['issue']
        src_num = int(src_issue[4:])
        year = src_issue[:4]
        tgt_num = src_num + iv
        tgt_year = year
        if tgt_num > 150:
            tgt_year = str(int(year) + 1)
            tgt_num -= 150
        tgt_issue = tgt_year + str(tgt_num).zfill(3)
        if tgt_issue in issue_map:
            tgt = issue_map[tgt_issue]
            src_iv = get_interval(d['front'])
            tgt_iv = get_interval(tgt['front'])
            if src_iv == tgt_iv:
                same_count += 1
            total_count += 1
    
    if total_count > 0:
        rate = same_count / total_count * 100
        print(f'{iv:>6} {total_count:>6} {same_count:>10} {rate:>7.1f}%')

print()
print('=' * 80)
print('四、不同间隔的和值/跨度/奇偶比变化')
print('=' * 80)
print(f'{"间隔":>6} {"和值差均值":>12} {"跨度差均值":>12} {"奇偶差均值":>12}')
print('-' * 80)

for iv in intervals_to_test:
    sum_diffs = []
    span_diffs = []
    odd_diffs = []
    for d in data:
        src_issue = d['issue']
        src_num = int(src_issue[4:])
        year = src_issue[:4]
        tgt_num = src_num + iv
        tgt_year = year
        if tgt_num > 150:
            tgt_year = str(int(year) + 1)
            tgt_num -= 150
        tgt_issue = tgt_year + str(tgt_num).zfill(3)
        if tgt_issue in issue_map:
            tgt = issue_map[tgt_issue]
            sum_diffs.append(abs(get_sum(d['front']) - get_sum(tgt['front'])))
            span_diffs.append(abs(get_span(d['front']) - get_span(tgt['front'])))
            odd_diffs.append(abs(get_odd(d['front']) - get_odd(tgt['front'])))
    
    if sum_diffs:
        print(f'{iv:>6} {sum(sum_diffs)/len(sum_diffs):>12.1f} {sum(span_diffs)/len(span_diffs):>12.1f} {sum(odd_diffs)/len(odd_diffs):>12.2f}')

print()
print('=' * 80)
print('五、间隔10的详细配对信息（最近20对）')
print('=' * 80)
print(f'{"源期":>10} {"目标期":>10} {"源号码":>20} {"目标号码":>20} {"重叠":>4} {"尾号重叠":>8}')
print('-' * 80)

count = 0
pairs_detail = []
for d in reversed(data):
    if count >= 20:
        break
    src_issue = d['issue']
    src_num = int(src_issue[4:])
    year = src_issue[:4]
    tgt_num = src_num + 10
    tgt_year = year
    if tgt_num > 150:
        tgt_year = str(int(year) + 1)
        tgt_num -= 150
    tgt_issue = tgt_year + str(tgt_num).zfill(3)
    if tgt_issue in issue_map:
        tgt = issue_map[tgt_issue]
        ov = get_repeat(d['front'], tgt['front'])
        src_tails = get_tails(d['front'])
        tgt_tails = get_tails(tgt['front'])
        tail_ov = len(src_tails & tgt_tails)
        src_str = ','.join(str(x).rjust(2) for x in d['front'])
        tgt_str = ','.join(str(x).rjust(2) for x in tgt['front'])
        print(f'{src_issue:>10} {tgt_issue:>10} [{src_str}] [{tgt_str}] {ov:>4} {tail_ov:>8}')
        pairs_detail.append({'ov': ov, 'tail_ov': tail_ov})
        count += 1

print()
print('=' * 80)
print('六、间隔9/10/12互补分析')
print('=' * 80)

# 统计每个目标期被不同间隔覆盖的情况
iv9_cover = 0
iv10_cover = 0
iv12_cover = 0
any_cover = 0
multi_cover = 0
total_tgt = 0

for d in data:
    src_issue = d['issue']
    src_num = int(src_issue[4:])
    year = src_issue[:4]
    
    covered_by = []
    for iv in [9, 10, 12]:
        tgt_num = src_num + iv
        tgt_year = year
        if tgt_num > 150:
            tgt_year = str(int(year) + 1)
            tgt_num -= 150
        tgt_issue = tgt_year + str(tgt_num).zfill(3)
        if tgt_issue in issue_map:
            tgt = issue_map[tgt_issue]
            ov = get_repeat(d['front'], tgt['front'])
            if ov >= 2:
                covered_by.append(iv)
    
    if covered_by:
        total_tgt += 1
        if 9 in covered_by: iv9_cover += 1
        if 10 in covered_by: iv10_cover += 1
        if 12 in covered_by: iv12_cover += 1
        if len(covered_by) > 1: multi_cover += 1

print(f'有效配对目标期数: {total_tgt}')
print(f'间隔9覆盖(>=2重叠):  {iv9_cover} ({iv9_cover/max(total_tgt,1)*100:.1f}%)')
print(f'间隔10覆盖(>=2重叠): {iv10_cover} ({iv10_cover/max(total_tgt,1)*100:.1f}%)')
print(f'间隔12覆盖(>=2重叠): {iv12_cover} ({iv12_cover/max(total_tgt,1)*100:.1f}%)')
print(f'多间隔同时覆盖:      {multi_cover} ({multi_cover/max(total_tgt,1)*100:.1f}%)')

print()
print('=' * 80)
print('七、综合评分 - 各间隔排名')
print('=' * 80)

scores = {}
for iv in intervals_to_test:
    overlaps = []
    tail_overlaps = []
    same_iv = 0
    total_p = 0
    for d in data:
        src_issue = d['issue']
        src_num = int(src_issue[4:])
        year = src_issue[:4]
        tgt_num = src_num + iv
        tgt_year = year
        if tgt_num > 150:
            tgt_year = str(int(year) + 1)
            tgt_num -= 150
        tgt_issue = tgt_year + str(tgt_num).zfill(3)
        if tgt_issue in issue_map:
            tgt = issue_map[tgt_issue]
            overlaps.append(get_repeat(d['front'], tgt['front']))
            src_tails = get_tails(d['front'])
            tgt_tails = get_tails(tgt['front'])
            tail_overlaps.append(len(src_tails & tgt_tails))
            if get_interval(d['front']) == get_interval(tgt['front']):
                same_iv += 1
            total_p += 1
    
    if overlaps:
        avg_ov = sum(overlaps) / len(overlaps)
        avg_tail = sum(tail_overlaps) / len(tail_overlaps)
        iv_rate = same_iv / total_p * 100
        # 综合评分
        score = avg_ov * 10 + avg_tail * 5 + iv_rate * 0.5
        scores[iv] = {
            'avg_ov': avg_ov,
            'avg_tail': avg_tail,
            'iv_rate': iv_rate,
            'score': score,
            'pairs': len(overlaps)
        }

print(f'{"间隔":>6} {"配对数":>6} {"号码重叠":>10} {"尾号重叠":>10} {"区间转移":>10} {"综合评分":>10}')
print('-' * 80)
for iv in sorted(scores.keys(), key=lambda x: scores[x]['score'], reverse=True):
    s = scores[iv]
    marker = ' ★' if iv in [9, 10, 12] else ''
    print(f'{iv:>6} {s["pairs"]:>6} {s["avg_ov"]:>10.2f} {s["avg_tail"]:>10.2f} {s["iv_rate"]:>9.1f}% {s["score"]:>10.1f}{marker}')

print()
print('★ = 项目中使用的间隔')
print()
print('分析完成！')
