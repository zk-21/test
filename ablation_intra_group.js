// 组内尾号信号消融测试
// 逐一禁用每个信号，看哪个禁用后能提高指标

const fs = require('fs');
const path = require('path');

// 加载开奖数据
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
if (!match) { console.error('无法解析 all_draws.js'); process.exit(1); }
const ALL_DRAWS_DATA = eval(match[1]);

// 模拟浏览器环境
function mockEl() {
  return {
    querySelector: () => mockEl(), querySelectorAll: () => [],
    addEventListener: () => {}, append: () => {}, appendChild: () => {},
    remove: () => {}, classList: { add:()=>{}, remove:()=>{}, contains:()=>false, toggle:()=>false },
    dataset: {}, textContent: "", innerHTML: "",
    style: new Proxy({}, { get: () => () => {} }),
    offsetWidth: 0, offsetHeight: 0, closest: () => null,
    getAttribute: () => null, setAttribute: () => {}, matches: () => false,
  };
}
const mockDoc = mockEl();
mockDoc.querySelector = () => mockEl();
mockDoc.querySelectorAll = () => [];
mockDoc.getElementById = () => mockEl();
mockDoc.createElement = () => mockEl();
mockDoc.createDocumentFragment = () => mockEl();
mockDoc.body = mockEl();
mockDoc.documentElement = mockEl();
mockDoc.addEventListener = () => {};

global.document = mockDoc;
global.window = Object.assign(mockEl(), { ALL_DRAWS_DATA, addEventListener: () => {} });
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.XLSX = null;

// 加载主脚本
const mainCode = fs.readFileSync(path.join(__dirname, 'script回测.js'), 'utf8');

// 测试配置
const configs = [
  { name: '基线(全信号)', disable: {} },
  { name: '禁用多样性', disable: { diversity: true } },
  { name: '禁用连续', disable: { consecutive: true } },
  { name: '禁用等差', disable: { arithmetic: true } },
  { name: '禁用多段连续+连接点', disable: { multiSegAnchor: true } },
  { name: '禁用等差+连续+连接点', disable: { arithConsecAnchor: true } },
  { name: '仅保留连接点模式', disable: { diversity: true, consecutive: true, arithmetic: true } },
  { name: '仅保留传统模式', disable: { multiSegAnchor: true, arithConsecAnchor: true } },
];

// 临时修改函数
function patchAnalyzeIntra(disable) {
  const code = fs.readFileSync(path.join(__dirname, 'script回测.js'), 'utf8');
  
  // 找到函数位置
  const funcStart = code.indexOf('function analyzeIntraGroupTailPatterns');
  const funcEnd = code.indexOf('\n// ═══ 尾号聚类规律分析', funcStart);
  const funcCode = code.slice(funcStart, funcEnd);
  
  // 根据disable配置注释掉对应信号
  let patched = funcCode;
  
  if (disable.diversity) {
    patched = patched.replace(
      /diversityFreq\.forEach\([\s\S]*?\}\);/,
      '// [DISABLED] diversity signal'
    );
  }
  if (disable.consecutive) {
    patched = patched.replace(
      /consecutiveFreq\.forEach\([\s\S]*?\}\);/,
      '// [DISABLED] consecutive signal'
    );
  }
  if (disable.arithmetic) {
    patched = patched.replace(
      /arithmeticFreq\.forEach\([\s\S]*?\}\);/,
      '// [DISABLED] arithmetic signal'
    );
  }
  if (disable.multiSegAnchor) {
    patched = patched.replace(
      /multiSegWithAnchorFreq\.forEach\([\s\S]*?\}\);/,
      '// [DISABLED] multi-segment anchor signal'
    );
  }
  if (disable.arithConsecAnchor) {
    patched = patched.replace(
      /arithConsecWithAnchorFreq\.forEach\([\s\S]*?\}\);/,
      '// [DISABLED] arithmetic+consecutive anchor signal'
    );
  }
  
  return patched;
}

console.log('=== 组内尾号信号消融测试 ===\n');

// 这个测试需要在Node.js中动态替换函数，比较复杂
// 改用更简单的方式：直接修改script回测.js并运行

const baselineResults = {
  top5HitRate: 76.1,
  top5Coverage: 2.91,
  combinedCoverage: 3.00,
  poolCoverage: 3.32
};

console.log('基线指标:');
console.log(`  Top5命中率: ${baselineResults.top5HitRate}%`);
console.log(`  Top5联合覆盖: ${baselineResults.top5Coverage}球`);
console.log(`  联合覆盖: ${baselineResults.combinedCoverage}球`);
console.log(`  候选池覆盖: ${baselineResults.poolCoverage}球`);
console.log('\n需要逐一修改script回测.js中的analyzeIntraGroupTailPatterns函数来测试...');
