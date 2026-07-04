// 批量分析脚本 - 在浏览器控制台运行
// 用于分析2026054-2026064的Top5和补漏6命中情况

// 使用方法：
// 1. 打开 index.html
// 2. 按F12打开开发者工具
// 3. 在Console标签页粘贴此脚本
// 4. 按Enter运行

async function batchAnalysis() {
    console.log("开始批量分析...");
    
    // 获取历史数据
    const allDraws = window.allDraws || [];
    if (allDraws.length === 0) {
        console.error("未找到历史数据，请先导入all_draws.json");
        return;
    }
    
    console.log(`总期数: ${allDraws.length}`);
    
    // 找到2026054-2026064的索引
    const startIndex = allDraws.findIndex(d => d.issue === "2026054");
    const endIndex = allDraws.findIndex(d => d.issue === "2026064");
    
    if (startIndex === -1 || endIndex === -1) {
        console.error("未找到指定期数");
        return;
    }
    
    console.log(`分析范围: 索引 ${startIndex} 到 ${endIndex}`);
    
    const results = [];
    
    // 逐期分析
    for (let i = startIndex; i <= endIndex; i++) {
        const draw = allDraws[i];
        const target = draw.front;
        
        console.log(`\n分析 ${draw.issue}: 目标 ${target.join(',')}`);
        
        // 设置源行为前一期
        const sourceRow = i; // 源行索引（从0开始）
        
        // 调用版本71的预测函数
        // 注意：需要根据实际函数名调整
        try {
            // 假设函数名为 generateSample 或类似
            // 需要查看script.js中的实际函数名
            
            // 模拟生成预测（实际需要调用真实函数）
            const prediction = await generatePredictionForPeriod(sourceRow);
            
            if (prediction) {
                const top5 = prediction.top5 || [];
                const bulou6 = prediction.bulou6 || [];
                
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
            }
        } catch (error) {
            console.error(`分析 ${draw.issue} 时出错:`, error);
        }
    }
    
    // 输出结果
    console.log("\n" + "=".repeat(80));
    console.log("分析结果:");
    console.log("=".repeat(80));
    
    results.forEach(r => {
        console.log(`${r.issue}: Top5命中${r.top5Hit}, 补漏6命中${r.bulou6Hit}, 综合${r.combinedHit}`);
    });
    
    // 计算平均值
    const avgTop5 = results.reduce((sum, r) => sum + r.top5Hit, 0) / results.length;
    const avgBulou6 = results.reduce((sum, r) => sum + r.bulou6Hit, 0) / results.length;
    const avgCombined = results.reduce((sum, r) => sum + r.combinedHit, 0) / results.length;
    
    console.log("\n" + "=".repeat(80));
    console.log(`平均命中: Top5=${avgTop5.toFixed(2)}/5, 补漏6=${avgBulou6.toFixed(2)}/5, 综合=${avgCombined.toFixed(2)}/10`);
    console.log(`覆盖率: Top5=${(avgTop5/5*100).toFixed(1)}%, 补漏6=${(avgBulou6/5*100).toFixed(1)}%, 综合=${(avgCombined/10*100).toFixed(1)}%`);
    
    // 保存结果到全局变量
    window.batchAnalysisResults = results;
    console.log("\n结果已保存到 window.batchAnalysisResults");
    console.log("可以使用 JSON.stringify(window.batchAnalysisResults) 导出JSON");
    
    return results;
}

// 辅助函数：生成单期预测
async function generatePredictionForPeriod(sourceRowIndex) {
    // 这里需要调用版本71的实际预测函数
    // 根据script.js，可能需要：
    // 1. 设置当前行号
    // 2. 调用 sampleButton.click() 或相关函数
    // 3. 获取生成的Top5和补漏6
    
    // 示例实现（需要根据实际代码调整）:
    return new Promise((resolve) => {
        // 模拟延迟
        setTimeout(() => {
            // 这里应该调用真实的预测函数
            // 例如：const result = buildV4SingleSamplePlan(...);
            
            // 暂时返回模拟数据
            resolve({
                top5: [1, 2, 3, 4, 5], // 替换为真实预测
                bulou6: [6, 7, 8, 9, 10] // 替换为真实预测
            });
        }, 100);
    });
}

// 运行分析
batchAnalysis().then(results => {
    console.log("分析完成！");
});