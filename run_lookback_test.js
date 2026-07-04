/**
 * lookback参数敏感性测试 - 直接修改script回测.js参数
 * 运行: node run_lookback_test.js
 */

const fs = require('fs');
const path = require('path');

// 读取原始脚本
const scriptPath = path.join(__dirname, 'script回测.js');
let originalScript = fs.readFileSync(scriptPath, 'utf8');

// 测试配置
const testConfigs = [
  // 基准（当前参数）
  { tailTrans: 50, tailCorr: 100, ivWindow: 60, hotWindow: 5, name: '基准-当前' },
  
  // 测试尾号转移lookback
  { tailTrans: 30, tailCorr: 100, ivWindow: 60, hotWindow: 5, name: '尾号转移30' },
  { tailTrans: 70, tailCorr: 100, ivWindow: 60, hotWindow: 5, name: '尾号转移70' },
  { tailTrans: 100, tailCorr: 100, ivWindow: 60, hotWindow: 5, name: '尾号转移100' },
  
  // 测试尾号关联lookback
  { tailTrans: 50, tailCorr: 60, ivWindow: 60, hotWindow: 5, name: '尾号关联60' },
  { tailTrans: 50, tailCorr: 150, ivWindow: 60, hotWindow: 5, name: '尾号关联150' },
  
  // 测试区间比窗口
  { tailTrans: 50, tailCorr: 100, ivWindow: 40, hotWindow: 5, name: '区间窗口40' },
  { tailTrans: 50, tailCorr: 100, ivWindow: 80, hotWindow: 5, name: '区间窗口80' },
  
  // 测试热号窗口
  { tailTrans: 50, tailCorr: 100, ivWindow: 60, hotWindow: 3, name: '热号窗口3' },
  { tailTrans: 50, tailCorr: 100, ivWindow: 60, hotWindow: 8, name: '热号窗口8' },
  { tailTrans: 50, tailCorr: 100, ivWindow: 60, hotWindow: 10, name: '热号窗口10' },
  
  // 组合优化
  { tailTrans: 70, tailCorr: 120, ivWindow: 70, hotWindow: 7, name: '组合-中等' },
  { tailTrans: 100, tailCorr: 150, ivWindow: 80, hotWindow: 8, name: '组合-大窗口' },
];

console.log('lookback参数敏感性测试');
console.log('='.repeat(80));
console.log('测试配置数:', testConfigs.length);
console.log('');

const results = [];

for (const config of testConfigs) {
  console.log(`测试: ${config.name} (tailTrans=${config.tailTrans}, tailCorr=${config.tailCorr}, ivWindow=${config.ivWindow}, hotWindow=${config.hotWindow})`);
  
  // 修改脚本参数
  let modifiedScript = originalScript;
  
  // 1. 修改尾号转移lookback
  modifiedScript = modifiedScript.replace(
    /const tailTransData = analyzeTailTransitionsV4\(sourceRow, \d+, allBalls\);/g,
    `const tailTransData = analyzeTailTransitionsV4(sourceRow, ${config.tailTrans}, allBalls);`
  );
  
  // 2. 修改尾号关联lookback
  modifiedScript = modifiedScript.replace(
    /const tailCorrelationData = analyzeTailCorrelation\(allBalls, sourceRow, \d+\);/g,
    `const tailCorrelationData = analyzeTailCorrelation(allBalls, sourceRow, ${config.tailCorr});`
  );
  
  // 3. 修改区间比窗口
  modifiedScript = modifiedScript.replace(
    /const windowSize = Math\.min\(\d+, draws\.length\);/g,
    `const windowSize = Math.min(${config.ivWindow}, draws.length);`
  );
  
  // 4. 修改热号窗口
  modifiedScript = modifiedScript.replace(
    /for \(let r = Math\.max\(1, sourceRow - \d+\); r < sourceRow; r\+\+\) \{/g,
    `for (let r = Math.max(1, sourceRow - ${config.hotWindow}); r < sourceRow; r++) {`
  );
  
  // 5. 修改历史频率近期窗口
  modifiedScript = modifiedScript.replace(
    /const recentWindow = Math\.min\(\d+, draws\.length\);/g,
    `const recentWindow = Math.min(${Math.max(20, config.hotWindow * 4)}, draws.length);`
  );
  
  // 写入临时文件
  const tempScriptPath = path.join(__dirname, 'temp_backtest.js');
  fs.writeFileSync(tempScriptPath, modifiedScript);
  
  // 运行回测试
  try {
    const { execSync } = require('child_process');
    const output = execSync(`node "${tempScriptPath}"`, { 
      encoding: 'utf8',
      timeout: 120000,
      cwd: __dirname
    });
    
    // 解析结果
    const lines = output.split('\n');
    let poolCoverage = '';
    let top5Rate = '';
    let jointCoverage = '';
    
    for (const line of lines) {
      if (line.includes('候选池覆盖率')) {
        const match = line.match(/(\d+\.\d+)%/);
        if (match) poolCoverage = match[1];
      }
      if (line.includes('Top5最高命中率')) {
        const match = line.match(/(\d+\.\d+)%/);
        if (match) top5Rate = match[1];
      }
      if (line.includes('Top5+补漏6 联合覆盖率')) {
        const match = line.match(/(\d+\.\d+)%/);
        if (match) jointCoverage = match[1];
      }
    }
    
    results.push({
      name: config.name,
      params: config,
      poolCoverage,
      top5Rate,
      jointCoverage,
      status: '成功'
    });
    
    console.log(`  结果: 池覆盖=${poolCoverage}%, Top5=${top5Rate}%, 联合=${jointCoverage}%`);
    
  } catch (error) {
    console.log(`  错误: ${error.message.substring(0, 50)}`);
    results.push({
      name: config.name,
      params: config,
      error: error.message.substring(0, 100),
      status: '失败'
    });
  }
  
  // 删除临时文件
  try {
    fs.unlinkSync(tempScriptPath);
  } catch (e) {}
}

// 输出结果表格
console.log('\n' + '='.repeat(100));
console.log('测试结果汇总');
console.log('='.repeat(100));

// 表头
console.log('配置名称'.padEnd(12) + '| ' + 
            '尾号转移'.padEnd(8) + '| ' +
            '尾号关联'.padEnd(8) + '| ' +
            '区间窗口'.padEnd(8) + '| ' +
            '热号窗口'.padEnd(8) + '| ' +
            '池覆盖率'.padEnd(8) + '| ' +
            'Top5命中'.padEnd(8) + '| ' +
            '联合覆盖'.padEnd(8));
console.log('-'.repeat(100));

for (const r of results) {
  if (r.status === '成功') {
    console.log(
      r.name.padEnd(12) + '| ' +
      String(r.params.tailTrans).padEnd(8) + '| ' +
      String(r.params.tailCorr).padEnd(8) + '| ' +
      String(r.params.ivWindow).padEnd(8) + '| ' +
      String(r.params.hotWindow).padEnd(8) + '| ' +
      (r.poolCoverage + '%').padEnd(8) + '| ' +
      (r.top5Rate + '%').padEnd(8) + '| ' +
      (r.jointCoverage + '%').padEnd(8)
    );
  }
}

// 找出最优
const successful = results.filter(r => r.status === '成功');
if (successful.length > 0) {
  const bestPool = successful.reduce((best, r) => 
    parseFloat(r.poolCoverage) > parseFloat(best.poolCoverage) ? r : best, successful[0]);
  const bestTop5 = successful.reduce((best, r) => 
    parseFloat(r.top5Rate) > parseFloat(best.top5Rate) ? r : best, successful[0]);
  const bestJoint = successful.reduce((best, r) => 
    parseFloat(r.jointCoverage) > parseFloat(best.jointCoverage) ? r : best, successful[0]);
  
  console.log('\n最优配置:');
  console.log('  池覆盖率最优:', bestPool.name, '-', bestPool.poolCoverage + '%');
  console.log('  Top5命中最优:', bestTop5.name, '-', bestTop5.top5Rate + '%');
  console.log('  联合覆盖最优:', bestJoint.name, '-', bestJoint.jointCoverage + '%');
}

// 保存结果
fs.writeFileSync(path.join(__dirname, 'lookback_test_results.json'), JSON.stringify(results, null, 2));
console.log('\n结果已保存到 lookback_test_results.json');
