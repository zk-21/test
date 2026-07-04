// batch_retest_full.js — 用 jsdom 运行完整算法批量回测
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// 读取 HTML 文件
const htmlPath = path.join(__dirname, 'verify_image_pair.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// 修改 URL 参数触发批量模式
const modifiedHtml = htmlContent.replace(
  'const mode = params.get("mode") || "single";',
  'const mode = "batch";'
).replace(
  'params.get("step") || 10',
  '10'
);

// 创建 jsdom
const dom = new JSDOM(modifiedHtml, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  url: 'http://localhost/verify_image_pair.html'
});

const { window } = dom;

// 等待执行完成
let checkCount = 0;
const maxChecks = 100; // 最多等10秒

function checkResult() {
  checkCount++;
  const resultEl = window.document.getElementById('result');
  
  if (resultEl && resultEl.textContent && resultEl.textContent.length > 100) {
    try {
      const result = JSON.parse(resultEl.textContent);
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('解析结果失败:', e.message);
      console.log('原始内容:', resultEl.textContent.substring(0, 500));
    }
    dom.window.close();
    process.exit(0);
  }
  
  if (checkCount >= maxChecks) {
    console.log('超时：等待脚本执行完成');
    if (resultEl) {
      console.log('当前结果内容:', resultEl.textContent.substring(0, 500));
    }
    dom.window.close();
    process.exit(1);
  }
  
  setTimeout(checkResult, 100);
}

setTimeout(checkResult, 500);
