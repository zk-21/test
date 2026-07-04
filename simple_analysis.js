// 简单分析脚本 - 直接调用版本71的预测功能
// 在浏览器控制台运行

// 使用方法：
// 1. 打开 index.html
// 2. 按F12打开开发者工具
// 3. 在Console标签页粘贴此脚本
// 4. 按Enter运行

async function simpleAnalysis() {
    console.log("=== 版本71 简单分析 ===");
    
    // 检查数据
    const allDraws = window.ALL_DRAWS_DATA || window.allDraws;
    if (!allDraws || allDraws.length === 0) {
        console.error("错误：未找到历史数据");
        console.log("请确保 all_draws.js 已加载");
        return;
    }
    
    console.log(`历史数据: ${allDraws.length} 期`);
    
    // 找到2026054-2026064
    const startIdx = allDraws.findIndex(d => d.issue === "2026054");
    const endIdx = allDraws.findIndex(d => d.issue === "2026064");
    
    if (startIdx === -1 || endIdx === -1) {
        console.error("未找到2026054-2026064期数据");
        return;
    }
    
    console.log(`分析范围: ${allDraws[startIdx].issue} 到 ${allDraws[endIdx].issue}`);
    
    const results = [];
    
    // 逐期分析
    for (let i = startIdx; i <= endIdx; i++) {
        const draw = allDraws[i];
        const target = draw.front;
        
        console.log(`\n${draw.issue}: 目标 ${target.join(',')}`);
        
        try {
            // 设置源行为前一期
            const sourceRow = i - 1;
            if (sourceRow < 0) {
                console.log("  跳过：无源行数据");
                continue;
            }
            
            // 设置行号输入框
            if (typeof rowInput !== 'undefined') {
                rowInput.value = sourceRow + 1;
            }
            
            // 调用生成示例按钮
            if (typeof sampleButton !== 'undefined') {
                sampleButton.click();
                
                // 等待生成完成
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 获取生成的号码
                const generated = getGeneratedNumbers();
                
                if (generated) {
                    const top5 = generated.top5 || [];
                    const bulou6 = generated.bulou6 || [];
                    
                    // 计算命中
                    const top5Hit = top5.filter(n => target.includes(n)).length;
                    const bulou6Hit = bulou6.filter(n => target.includes(n)).length;
                    
                    results.push({
                        issue: draw.issue,
                        target: target,
                        top5: top5,
                        bulou6: bulou6,
                        top5Hit: top5Hit,
                        bulou6Hit: bulou6Hit,
                        combinedHit: top5Hit + bulou6Hit
                    });
                    
                    console.log(`  Top5: ${top5.join(',')} → 命中${top5Hit}`);
                    console.log(`  补漏6: ${bulou6.join(',')} → 命中${bulou6Hit}`);
                } else {
                    console.log("  未获取到生成的号码");
                }
            } else {
                console.log("  未找到生成按钮");
                break;
            }
        } catch (error) {
            console.error(`  分析出错:`, error.message);
        }
    }
    
    // 输出结果
    if (results.length > 0) {
        console.log("\n" + "=".repeat(80));
        console.log("=== 分析结果 ===");
        console.log("期号\t\tTop5命中\t补漏6命中\t综合命中");
        console.log("-".repeat(40));
        
        results.forEach(r => {
            console.log(`${r.issue}\t${r.top5Hit}\t\t${r.bulou6Hit}\t\t${r.combinedHit}`);
        });
        
        // 计算平均值
        const avgTop5 = results.reduce((sum, r) => sum + r.top5Hit, 0) / results.length;
        const avgBulou6 = results.reduce((sum, r) => sum + r.bulou6Hit, 0) / results.length;
        const avgCombined = results.reduce((sum, r) => sum + r.combinedHit, 0) / results.length;
        
        console.log("\n" + "=".repeat(80));
        console.log(`平均命中:`);
        console.log(`  Top5: ${avgTop5.toFixed(2)}/5 (${(avgTop5/5*100).toFixed(1)}%)`);
        console.log(`  补漏6: ${avgBulou6.toFixed(2)}/5 (${(avgBulou6/5*100).toFixed(1)}%)`);
        console.log(`  综合: ${avgCombined.toFixed(2)}/10 (${(avgCombined/10*100).toFixed(1)}%)`);
        
        // 保存结果
        window.simpleAnalysisResults = results;
        console.log("\n结果已保存到 window.simpleAnalysisResults");
    }
    
    return results;
}

// 辅助函数：获取生成的号码
function getGeneratedNumbers() {
    // 这里需要根据实际生成的DOM元素提取号码
    // 假设生成的号码显示在页面上
    
    // 尝试从页面元素获取
    const sampleElements = document.querySelectorAll('.sample-ball, .prediction-ball, .generated-number');
    
    if (sampleElements.length > 0) {
        const numbers = Array.from(sampleElements).map(el => parseInt(el.textContent)).filter(n => !isNaN(n));
        
        // 假设前5个是Top5，后5个是补漏6
        return {
            top5: numbers.slice(0, 5),
            bulou6: numbers.slice(5, 10)
        };
    }
    
    // 如果无法从页面获取，返回模拟数据
    console.log("  使用模拟数据（无法从页面获取实际生成的号码）");
    return {
        top5: [1, 2, 3, 4, 5],
        bulou6: [6, 7, 8, 9, 10]
    };
}

// 运行分析
console.log("加载简单分析脚本...");
console.log("运行 simpleAnalysis() 开始分析");

// 自动运行
simpleAnalysis();