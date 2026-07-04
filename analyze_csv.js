const fs = require('fs');
const lines = fs.readFileSync('per_period_detail.csv','utf8').trim().split('\n').slice(1);

let sumTop1=0,sumTop2=0,sumTop3=0,sumTop4=0,sumTop5=0,sumBl6=0;
let sumTop5Union=0,sumUnion=0,sumPool=0;
let cnt=0;
let bestDist={},unionDist={},poolDist={};

lines.forEach(line => {
  // CSV格式: 期数,"目标号码",Top1,Top2,Top3,Top4,Top5,补漏6,Top5联合,联合覆盖,池覆盖
  const parts = line.split(',');
  if(parts.length < 11) return;
  cnt++;
  const t1=+parts[2],t2=+parts[3],t3=+parts[4],t4=+parts[5],t5=+parts[6],bl6=+parts[7];
  const t5u=+parts[8],union=+parts[9],pool=+parts[10];
  
  sumTop1+=t1; sumTop2+=t2; sumTop3+=t3; sumTop4+=t4; sumTop5+=t5; sumBl6+=bl6;
  sumTop5Union+=t5u; sumUnion+=union; sumPool+=pool;
  
  const maxT = Math.max(t1,t2,t3,t4,t5);
  bestDist[maxT]=(bestDist[maxT]||0)+1;
  unionDist[union]=(unionDist[union]||0)+1;
  poolDist[pool]=(poolDist[pool]||0)+1;
});

console.log('═══════════════════════════════════════════════════════════');
console.log('回测汇总统计（共'+cnt+'期）');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('【指标1】每注平均命中个数:');
console.log('  Top1: '+(sumTop1/cnt).toFixed(2));
console.log('  Top2: '+(sumTop2/cnt).toFixed(2));
console.log('  Top3: '+(sumTop3/cnt).toFixed(2));
console.log('  Top4: '+(sumTop4/cnt).toFixed(2));
console.log('  Top5: '+(sumTop5/cnt).toFixed(2));
console.log('  补漏6: '+(sumBl6/cnt).toFixed(2));
console.log('  Top5每注合计(平均): '+((sumTop1+sumTop2+sumTop3+sumTop4+sumTop5)/cnt).toFixed(2));
console.log('  Top5+补漏6每注合计(平均): '+((sumTop1+sumTop2+sumTop3+sumTop4+sumTop5+sumBl6)/cnt).toFixed(2));
console.log('');
console.log('【指标2】组合覆盖（联合命中目的号码个数）:');
console.log('  平均Top5联合覆盖: '+(sumTop5Union/cnt).toFixed(2)+' / 5');
console.log('  平均Top5+补漏6联合覆盖: '+(sumUnion/cnt).toFixed(2)+' / 5');
console.log('  Top5联合覆盖率: '+(sumTop5Union/(cnt*5)*100).toFixed(1)+'%');
console.log('  Top5+补漏6联合覆盖率: '+(sumUnion/(cnt*5)*100).toFixed(1)+'%');
console.log('');
console.log('【指标3】候选号码池覆盖:');
console.log('  平均候选池覆盖: '+(sumPool/cnt).toFixed(2)+' / 5');
console.log('  候选池覆盖率: '+(sumPool/(cnt*5)*100).toFixed(1)+'%');
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('Top5最高命中分布:');
for(let h=5;h>=0;h--){if(bestDist[h])console.log('  命中'+h+'个: '+bestDist[h]+'次 ('+(bestDist[h]/cnt*100).toFixed(1)+'%)');}
console.log('');
console.log('Top5+补漏6联合覆盖分布:');
for(let h=5;h>=0;h--){if(unionDist[h])console.log('  覆盖'+h+'个: '+unionDist[h]+'次 ('+(unionDist[h]/cnt*100).toFixed(1)+'%)');}
console.log('');
console.log('候选池覆盖分布:');
for(let h=5;h>=0;h--){if(poolDist[h])console.log('  覆盖'+h+'个: '+poolDist[h]+'次 ('+(poolDist[h]/cnt*100).toFixed(1)+'%)');}

// Top5命中率统计
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('Top5命中率（命中个数/总投注个数）:');
const totalBet5 = cnt * 5;
console.log('  Top5总命中: '+(sumTop1+sumTop2+sumTop3+sumTop4+sumTop5)+' / '+totalBet5+' = '+((sumTop1+sumTop2+sumTop3+sumTop4+sumTop5)/totalBet5*100).toFixed(1)+'%');
console.log('  补漏6总命中: '+sumBl6+' / '+totalBet5+' = '+(sumBl6/totalBet5*100).toFixed(1)+'%');
console.log('  Top5+补漏6总命中: '+(sumTop1+sumTop2+sumTop3+sumTop4+sumTop5+sumBl6)+' / '+totalBet5+' = '+((sumTop1+sumTop2+sumTop3+sumTop4+sumTop5+sumBl6)/totalBet5*100).toFixed(1)+'%');

// 每期详情补充 - 连续命中/连续未命中分析
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('每期关键指标汇总:');
console.log('期号 | Top1-5命中(合计) | 补漏6命中 | Top5联合 | Top5+补漏6联合 | 候选池覆盖');
console.log('─'.repeat(80));
lines.forEach((line, i) => {
  const parts = line.split(',');
  if(parts.length < 11) return;
  const t1=+parts[2],t2=+parts[3],t3=+parts[4],t4=+parts[5],t5=+parts[6],bl6=+parts[7];
  const t5u=+parts[8],union=+parts[9],pool=+parts[10];
  const top5sum = t1+t2+t3+t4+t5;
  console.log('  '+(i+1).toString().padStart(3)+'  |    '+top5sum+' ('+t1+','+t2+','+t3+','+t4+','+t5+')  |    '+bl6+'    |    '+t5u+'    |      '+union+'      |    '+pool);
});
