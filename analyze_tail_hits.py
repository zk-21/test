#!/usr/bin/env python3
"""
分析回测文件中每期尾号预测命中个数
"""
import re
import sys

def analyze_tail_hits(file_path):
    """分析文件中的尾号命中统计"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取每期的命中信息
    period_pattern = r'第\s*(\d+)\s*期验证.*?源期:\s*(\d+)\s*→\s*目标期:\s*(\d+)'
    hit_pattern = r'Top(\d+):\s*\[.*?\]\s*→\s*命中\s*(\d+)\s*个'
    
    # 存储每期的命中信息
    periods = []
    
    # 按期分割内容
    period_blocks = re.split(r'─{40,}', content)
    
    for block in period_blocks:
        period_match = re.search(period_pattern, block)
        if not period_match:
            continue
        
        period_num = int(period_match.group(1))
        source_period = period_match.group(2)
        target_period = period_match.group(3)
        
        # 提取Top5的命中个数
        hits = []
        for i in range(1, 6):  # Top1到Top5
            pattern = f'Top{i}:\\s*\\[.*?\\]\\s*→\\s*命中\\s*(\\d+)\\s*个'
            match = re.search(pattern, block)
            if match:
                hits.append(int(match.group(1)))
            else:
                hits.append(0)
        
        # 计算Top5最高命中
        max_hit = max(hits) if hits else 0
        
        # 计算Top5总命中
        total_hit = sum(hits)
        
        periods.append({
            'period': period_num,
            'source': source_period,
            'target': target_period,
            'hits': hits,
            'max_hit': max_hit,
            'total_hit': total_hit
        })
    
    return periods

def print_statistics(periods):
    """打印统计信息"""
    if not periods:
        print("没有找到期数数据")
        return
    
    print(f"总共分析了 {len(periods)} 期数据\n")
    
    # 统计最高命中分布
    max_hit_dist = {}
    for p in periods:
        max_hit = p['max_hit']
        max_hit_dist[max_hit] = max_hit_dist.get(max_hit, 0) + 1
    
    print("Top5 最高命中分布:")
    for hit_count in sorted(max_hit_dist.keys(), reverse=True):
        count = max_hit_dist[hit_count]
        percentage = count / len(periods) * 100
        print(f"  命中{hit_count}个: {count}次 ({percentage:.1f}%)")
    
    # 统计总命中分布
    total_hit_dist = {}
    for p in periods:
        total_hit = p['total_hit']
        total_hit_dist[total_hit] = total_hit_dist.get(total_hit, 0) + 1
    
    print("\nTop5 总命中分布:")
    for hit_count in sorted(total_hit_dist.keys(), reverse=True):
        count = total_hit_dist[hit_count]
        percentage = count / len(periods) * 100
        print(f"  总命中{hit_count}个: {count}次 ({percentage:.1f}%)")
    
    # 计算平均值
    avg_max_hit = sum(p['max_hit'] for p in periods) / len(periods)
    avg_total_hit = sum(p['total_hit'] for p in periods) / len(periods)
    
    print(f"\n平均最高命中: {avg_max_hit:.2f}个")
    print(f"平均总命中: {avg_total_hit:.2f}个")
    
    # 打印每期详情（前20期和后20期）
    print("\n每期命中详情（前20期）:")
    print("期数 | 源期→目标期 | Top1 | Top2 | Top3 | Top4 | Top5 | 最高 | 总计")
    print("-" * 80)
    for p in periods[:20]:
        hits_str = " | ".join(str(h) for h in p['hits'])
        print(f"{p['period']:4d} | {p['source']}→{p['target']} | {hits_str} | {p['max_hit']} | {p['total_hit']}")
    
    print(f"\n... 中间 {len(periods)-40} 期省略 ...\n")
    
    print("每期命中详情（后20期）:")
    print("期数 | 源期→目标期 | Top1 | Top2 | Top3 | Top4 | Top5 | 最高 | 总计")
    print("-" * 80)
    for p in periods[-20:]:
        hits_str = " | ".join(str(h) for h in p['hits'])
        print(f"{p['period']:4d} | {p['source']}→{p['target']} | {hits_str} | {p['max_hit']} | {p['total_hit']}")

def main():
    file_path = r'c:\Users\61419\Downloads\selectBall-main7208\selectBall-main\backtest_main_tails_only.txt'
    
    try:
        periods = analyze_tail_hits(file_path)
        print_statistics(periods)
        
        # 保存详细数据到文件
        output_file = r'c:\Users\61419\Downloads\selectBall-main7208\selectBall-main\tail_hit_details.txt'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("期数,源期,目标期,Top1,Top2,Top3,Top4,Top5,最高,总计\n")
            for p in periods:
                hits_str = ",".join(str(h) for h in p['hits'])
                f.write(f"{p['period']},{p['source']},{p['target']},{hits_str},{p['max_hit']},{p['total_hit']}\n")
        
        print(f"\n详细数据已保存到: {output_file}")
        
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()