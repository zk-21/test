const fs = require('fs');
const path = require('path');
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
const ALL_DRAWS_DATA = eval(match[1]);

var neighborStats = {};
var repeatStats = {};
var consecStats = {};
var apStats = {};
for (var k = 0; k <= 5; k++) { neighborStats[k] = 0; repeatStats[k] = 0; consecStats[k] = 0; apStats[k] = 0; }

for (var i = 1; i < ALL_DRAWS_DATA.length; i++) {
  var prev = ALL_DRAWS_DATA[i-1].front;
  var curr = ALL_DRAWS_DATA[i].front;
  
  var prevTails = Array.from(new Set(prev.map(function(n) { return n % 10; })));
  var currTails = Array.from(new Set(curr.map(function(n) { return n % 10; })));
  
  // 相邻统计
  var neighborCount = 0;
  currTails.forEach(function(t) {
    if (prevTails.some(function(pt) { return Math.abs(pt - t) === 1 || Math.abs(pt - t) === 9; })) {
      neighborCount++;
    }
  });
  if (neighborStats[neighborCount] !== undefined) neighborStats[neighborCount]++;
  
  // 重复统计
  var repeatCount = currTails.filter(function(t) { return prevTails.includes(t); }).length;
  if (repeatStats[repeatCount] !== undefined) repeatStats[repeatCount]++;
  
  // 连续尾号统计
  var sorted = currTails.slice().sort(function(a,b){return a-b;});
  var maxConsec = 1, curConsec = 1;
  for (var j = 1; j < sorted.length; j++) {
    if (sorted[j] === sorted[j-1] + 1 || (sorted[j-1] === 9 && sorted[j] === 0)) {
      curConsec++;
      maxConsec = Math.max(maxConsec, curConsec);
    } else {
      curConsec = 1;
    }
  }
  if (consecStats[maxConsec] !== undefined) consecStats[maxConsec]++;
  
  // 组合内等差统计
  var apLen = 0;
  for (var td = 2; td <= 4; td++) {
    for (var ts = 0; ts <= 9 - td * 2; ts++) {
      var tcnt = 0;
      for (var tv = ts; tv <= 9; tv += td) {
        if (sorted.includes(tv)) tcnt++;
        else break;
      }
      apLen = Math.max(apLen, tcnt);
    }
  }
  if (apStats[apLen] !== undefined) apStats[apLen]++;
}

var total = ALL_DRAWS_DATA.length - 1;
console.log('=== 相邻尾号分布（跨期）总' + total + '期 ===');
for (var k = 0; k <= 5; k++) {
  console.log(k + '个相邻: ' + neighborStats[k] + '次 (' + (neighborStats[k]/total*100).toFixed(1) + '%)');
}

console.log('\n=== 重复尾号分布（跨期）===');
for (var k = 0; k <= 5; k++) {
  console.log(k + '个重复: ' + repeatStats[k] + '次 (' + (repeatStats[k]/total*100).toFixed(1) + '%)');
}

console.log('\n=== 连续尾号分布（组合内）===');
for (var k = 1; k <= 5; k++) {
  console.log(k + '个连续: ' + consecStats[k] + '次 (' + (consecStats[k]/total*100).toFixed(1) + '%)');
}

console.log('\n=== 等差尾号分布（组合内）===');
for (var k = 0; k <= 5; k++) {
  console.log(k + '个等差: ' + apStats[k] + '次 (' + (apStats[k]/total*100).toFixed(1) + '%)');
}
