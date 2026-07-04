#!/usr/bin/env python3
"""
消融实验脚本：逐个禁用信号，测试每个信号的贡献
"""
import re
import subprocess
import time
import os

# 实验配置
EXPERIMENTS = [
    {"name": "baseline", "config": {}},  # 基线（所有信号启用）
    {"name": "no_sameOrNeighbor", "config": {"disable_sameOrNeighbor": True}},
    {"name": "no_crossRowTail", "config": {"disable_crossRowTail": True}},
    {"name": "no_intraGroupPattern", "config": {"disable_intraGroupPattern": True}},
    {"name": "no_arithmeticNumber", "config": {"disable_arithmeticNumber": True}},
    {"name": "no_crossRowArithmetic", "config": {"disable_crossRowArithmetic": True}},
    {"name": "no_bridgeTails", "config": {"disable_bridgeTails": True}},
    {"name": "no_overlap1", "config": {"disable_overlap1": True}},
    {"name": "no_arith1", "config": {"disable_arith1": True}},
]

SCRIPT_FILE = "script回测.js"
RESULT_FILE = "ablation_results.txt"

def read_script():
    """读取脚本文件"""
    with open(SCRIPT_FILE, 'r', encoding='utf-8') as f:
        return f.read()

def modify_config(script, config):
    """修改消融配置"""
    if not config:
        return script
    
    for key, value in config.items():
        # 替换配置值
        pattern = f"{key}: (true|false)"
        replacement = f"{key}: {str(value).lower()}"
        script = re.sub(pattern, replacement, script, count=1)
    
    return script

def run_backtest():
    """运行回测并提取结果"""
    try:
        # 运行回测
        result = subprocess.run(
            ["node", SCRIPT_FILE],
            capture_output=True,
            text=True,
            timeout=300  # 5分钟超时
        )
        
        # 从输出中提取结果
        output = result.stdout + result.stderr
        
        # 查找Top5命中率
        match = re.search(r"Top5最高命中率: ([\d.]+)%", output)
        if match:
            return float(match.group(1))
        
        # 如果没有找到，尝试从文件中读取
        if os.path.exists("backtest_result.txt"):
            with open("backtest_result.txt", 'r', encoding='utf-8') as f:
                content = f.read()
                match = re.search(r"Top5最高命中率: ([\d.]+)%", content)
                if match:
                    return float(match.group(1))
        
        return None
    except Exception as e:
        print(f"Error running backtest: {e}")
        return None

def main():
    """主函数"""
    print("开始消融实验...")
    print("=" * 60)
    
    # 读取原始脚本
    original_script = read_script()
    
    results = []
    
    for exp in EXPERIMENTS:
        print(f"\n运行实验: {exp['name']}")
        
        # 修改配置
        modified_script = modify_config(original_script, exp['config'])
        
        # 写入临时脚本
        temp_script = f"temp_{exp['name']}.js"
        with open(temp_script, 'w', encoding='utf-8') as f:
            f.write(modified_script)
        
        # 备份原脚本
        os.rename(SCRIPT_FILE, f"{SCRIPT_FILE}.bak")
        os.rename(temp_script, SCRIPT_FILE)
        
        # 运行回测
        start_time = time.time()
        hit_rate = run_backtest()
        elapsed = time.time() - start_time
        
        # 恢复原脚本
        os.rename(SCRIPT_FILE, temp_script)
        os.rename(f"{SCRIPT_FILE}.bak", SCRIPT_FILE)
        
        # 清理临时文件
        if os.path.exists(temp_script):
            os.remove(temp_script)
        
        results.append({
            "name": exp['name'],
            "hit_rate": hit_rate,
            "time": elapsed
        })
        
        if hit_rate is not None:
            print(f"  Top5命中率: {hit_rate:.1f}%")
            print(f"  耗时: {elapsed:.1f}秒")
        else:
            print(f"  实验失败")
    
    # 生成报告
    print("\n" + "=" * 60)
    print("消融实验结果汇总")
    print("=" * 60)
    
    baseline = results[0]["hit_rate"]
    
    with open(RESULT_FILE, 'w', encoding='utf-8') as f:
        f.write("消融实验结果汇总\n")
        f.write("=" * 60 + "\n")
        f.write(f"基线Top5命中率: {baseline:.1f}%\n\n")
        
        print(f"{'实验名称':<25} {'Top5命中率':<15} {'变化':<10} {'耗时(秒)':<10}")
        print("-" * 60)
        
        for r in results:
            if r["hit_rate"] is not None:
                change = r["hit_rate"] - baseline
                change_str = f"{change:+.1f}%" if r["name"] != "baseline" else "-"
                
                line = f"{r['name']:<25} {r['hit_rate']:<15.1f} {change_str:<10} {r['time']:<10.1f}"
                print(line)
                f.write(line + "\n")
            else:
                line = f"{r['name']:<25} {'失败':<15} {'-':<10} {'-':<10}"
                print(line)
                f.write(line + "\n")
        
        # 计算每个信号的贡献
        f.write("\n\n信号贡献分析（Top5命中率下降幅度）:\n")
        f.write("-" * 40 + "\n")
        
        for r in results[1:]:  # 跳过基线
            if r["hit_rate"] is not None and baseline is not None:
                contribution = baseline - r["hit_rate"]
                signal_name = r["name"].replace("no_", "")
                line = f"{signal_name:<20} 贡献: {contribution:+.1f}%"
                print(line)
                f.write(line + "\n")
    
    print(f"\n详细结果已保存到: {RESULT_FILE}")

if __name__ == "__main__":
    main()
