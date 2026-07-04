/**
 * 预测引擎模块 - 从optimized_picker.js提取核心函数
 */

const fs = require('fs');
const path = require('path');

// 加载optimized_picker.js的内容
const pickerPath = path.join(__dirname, 'optimized_picker.js');
const pickerCode = fs.readFileSync(pickerPath, 'utf8');

// 创建一个新的函数来包装代码，避免全局执行
const wrappedCode = `
  // 保存原始的process.argv
  const originalArgv = process.argv;
  // 设置空的参数数组，避免命令行处理
  process.argv = ['node', 'prediction_engine.js'];
  
  ${pickerCode}
  
  // 恢复原始的process.argv
  process.argv = originalArgv;
  
  // 返回需要的函数和数据
  return {
    predict: predict,
    predictBack: predictBack,
    ALL_DRAWS: ALL_DRAWS,
    issueMap: issueMap,
    CONFIG: CONFIG
  };
`;

// 创建模块
const moduleFunction = new Function(wrappedCode);
const engine = moduleFunction();

// 导出
module.exports = {
  predict: engine.predict,
  predictBack: engine.predictBack,
  ALL_DRAWS: engine.ALL_DRAWS,
  issueMap: engine.issueMap,
  CONFIG: engine.CONFIG
};