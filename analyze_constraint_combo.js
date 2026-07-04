// 分析多种约束条件的组合效果
const draws={17:[2,9,14,20,31],18:[2,6,14,22,24],19:[9,10,20,33,35],20:[6,7,18,21,30],27:[3,15,20,29,31],28:[3,13,15,17,21],29:[4,11,12,13,25],30:[10,13,19,21,30]};
const iv=[{min:1,max:12},{min:13,max:24},{min:25,max:35}];

function gi(n){return iv.findIndex(t=>n>=t.min&&n<=t.max)}
function grk(n){const c=[0,0,0];n.forEach(x=>{const d=gi(x);if(d>=0)c[d]++});return c.join(":")}
function ratio(n){const c=[0,0,0];n.forEach(x=>{const d=gi(x);if(d>=0)c[d]++});return c}

// 约束条件函数
function calcConstraints(combo, selNums){
  const comboIv=[0,0,0];
  combo.forEach(x=>{const d=gi(x);if(d>=0)comboIv[d]++});
  const selIv=ratio(selNums);
  
  // 1. 区间比匹配
  const comboRatio=grk(combo);
  const selRatio=grk(selNums);
  const ratioMatch=comboRatio===selRatio?1:0;
  
  // 2. 区间比约束评分
  let rcs=0;
  for(let x=0;x<3;x++){
    if(selIv[x]===0&&comboIv[x]>=1)rcs+=15;
    if(selIv[x]>=4&&comboIv[x]<=3)rcs+=10;
  }
  const maxDiff=Math.max(...comboIv)-Math.min(...comboIv);
  if(maxDiff<=2)rcs+=5;
  
  // 3. 尾号连续/等差
  const tails=[...new Set(combo.map(x=>x%10))].sort((a,b)=>a-b);
  let tailPattern=0;
  let lc=1,cc=1;
  for(let i=1;i<tails.length;i++){
    if(tails[i]===tails[i-1]+1){cc++;lc=Math.max(lc,cc)}else cc=1;
  }
  if(lc>=3)tailPattern+=40;else if(lc>=2)tailPattern+=20;
  let h3=false,h4=false;
  for(let d=2;d<=4;d++){
    for(let s=0;s<=9-d*2;s++){
      let cnt=0;
      for(let v=s;v<=9;v+=d){if(tails.includes(v))cnt++;else break}
      if(cnt>=4)h4=true;if(cnt>=3)h3=true;
    }
  }
  if(h4)tailPattern+=30;else if(h3)tailPattern+=15;
  
  // 4. 尾号重复
  const selTails=[...new Set(selNums.map(x=>x%10))];
  const tailOverlap=tails.filter(t=>selTails.includes(t)).length;
  const tailOverlapScore=tailOverlap>=4?50:tailOverlap===3?35:tailOverlap===2?20:tailOverlap===1?8:0;
  
  // 5. 极端分布惩罚
  const maxLoad=Math.max(...comboIv);
  const extremePenalty=maxLoad>=5?(maxLoad-4)*200:maxLoad>=4?(maxLoad-3)*100:0;
  
  // 6. 区间覆盖
  const covered=comboIv.filter(c=>c>0).length;
  const coverageBonus=covered>=3?30:covered>=2?10:0;
  
  return{
    ratioMatch,rcs,tailPattern,tailOverlap,tailOverlapScore,
    extremePenalty,coverageBonus,comboRatio,selRatio,
    total:rcs*3+tailPattern+tailOverlapScore-extremePenalty+coverageBonus+ratioMatch*80
  };
}

// 测试所有相邻行对
const pairs=[
  {sel:17,target:27},{sel:18,target:28},{sel:19,target:29},{sel:20,target:30}
];

console.log("=== 约束条件组合效果分析 ===\n");

// 生成组合
function cg(arr,pk){const s=[];function h(st,d,cur){if(d===pk){s.push([...cur]);return}for(let i=st;i<=arr.length-(pk-d);i++){cur[d]=arr[i];h(i+1,d+1,cur)}}h(0,0,new Array(pk));return s}

pairs.forEach(p=>{
  const selNums=draws[p.sel];
  const targetNums=draws[p.target];
  const targetSet=new Set(targetNums);
  
  // 生成选号池（简化版）
  const pool=new Set();
  selNums.forEach(n=>pool.add(n));
  for(let r=p.sel-1;r<=p.sel+1;r++){if(draws[r])draws[r].forEach(n=>pool.add(n))}
  if(draws[30])draws[30].forEach(n=>pool.add(n));
  const poolArr=[...pool].sort((a,b)=>a-b);
  
  // 生成所有组合
  const combos=cg(poolArr,5);
  
  // 统计各约束条件的效果
  const stats={
    total:0,
    byRatioMatch:{match:{count:0,hits:0},noMatch:{count:0,hits:0}},
    byRcs:{high:{count:0,hits:0},mid:{count:0,hits:0},low:{count:0,hits:0}},
    byTailPattern:{high:{count:0,hits:0},mid:{count:0,hits:0},low:{count:0,hits:0}},
    byTailOverlap:{o4:{count:0,hits:0},o3:{count:0,hits:0},o2:{count:0,hits:0},o1:{count:0,hits:0},o0:{count:0,hits:0}},
    byCombo:{
      // 组合约束：区间比匹配 + 尾号重复>=2 + 尾号模式
      strong:{count:0,hits:0,combos:[]},
      medium:{count:0,hits:0,combos:[]},
      weak:{count:0,hits:0,combos:[]}
    }
  };
  
  // 采样
  const step=Math.max(1,Math.floor(combos.length/2000));
  for(let i=0;i<combos.length;i+=step){
    const c=combos[i];
    const hits=c.filter(n=>targetSet.has(n)).length;
    const con=calcConstraints(c,selNums);
    
    stats.total++;
    
    // 区间比匹配
    if(con.ratioMatch){stats.byRatioMatch.match.count++;stats.byRatioMatch.match.hits+=hits}
    else{stats.byRatioMatch.noMatch.count++;stats.byRatioMatch.noMatch.hits+=hits}
    
    // 区间比约束
    if(con.rcs>=20){stats.byRcs.high.count++;stats.byRcs.high.hits+=hits}
    else if(con.rcs>=10){stats.byRcs.mid.count++;stats.byRcs.mid.hits+=hits}
    else{stats.byRcs.low.count++;stats.byRcs.low.hits+=hits}
    
    // 尾号模式
    if(con.tailPattern>=40){stats.byTailPattern.high.count++;stats.byTailPattern.high.hits+=hits}
    else if(con.tailPattern>=20){stats.byTailPattern.mid.count++;stats.byTailPattern.mid.hits+=hits}
    else{stats.byTailPattern.low.count++;stats.byTailPattern.low.hits+=hits}
    
    // 尾号重复
    if(con.tailOverlap>=4){stats.byTailOverlap.o4.count++;stats.byTailOverlap.o4.hits+=hits}
    else if(con.tailOverlap===3){stats.byTailOverlap.o3.count++;stats.byTailOverlap.o3.hits+=hits}
    else if(con.tailOverlap===2){stats.byTailOverlap.o2.count++;stats.byTailOverlap.o2.hits+=hits}
    else if(con.tailOverlap===1){stats.byTailOverlap.o1.count++;stats.byTailOverlap.o1.hits+=hits}
    else{stats.byTailOverlap.o0.count++;stats.byTailOverlap.o0.hits+=hits}
    
    // 组合约束
    const strongCombo=con.ratioMatch&&con.tailOverlap>=2&&con.tailPattern>=20;
    const mediumCombo=(con.tailOverlap>=2&&con.tailPattern>=20)||con.ratioMatch;
    if(strongCombo){stats.byCombo.strong.count++;stats.byCombo.strong.hits+=hits;stats.byCombo.strong.combos.push({combo:c,hits})}
    else if(mediumCombo){stats.byCombo.medium.count++;stats.byCombo.medium.hits+=hits}
    else{stats.byCombo.weak.count++;stats.byCombo.weak.hits+=hits}
  }
  
  console.log(`第${p.sel}→${p.target}期 (采样${stats.total}组):`);
  console.log(`  区间比匹配: 匹配=${(stats.byRatioMatch.match.hits/Math.max(1,stats.byRatioMatch.match.count)).toFixed(2)}球 vs 不匹配=${(stats.byRatioMatch.noMatch.hits/Math.max(1,stats.byRatioMatch.noMatch.count)).toFixed(2)}球`);
  console.log(`  区间比约束: 高(>=20)=${(stats.byRcs.high.hits/Math.max(1,stats.byRcs.high.count)).toFixed(2)}球, 中(10-19)=${(stats.byRcs.mid.hits/Math.max(1,stats.byRcs.mid.count)).toFixed(2)}球, 低(<10)=${(stats.byRcs.low.hits/Math.max(1,stats.byRcs.low.count)).toFixed(2)}球`);
  console.log(`  尾号模式: 高(>=40)=${(stats.byTailPattern.high.hits/Math.max(1,stats.byTailPattern.high.count)).toFixed(2)}球, 中(20-39)=${(stats.byTailPattern.mid.hits/Math.max(1,stats.byTailPattern.mid.count)).toFixed(2)}球, 低(<20)=${(stats.byTailPattern.low.hits/Math.max(1,stats.byTailPattern.low.count)).toFixed(2)}球`);
  console.log(`  尾号重复: 4个=${(stats.byTailOverlap.o4.hits/Math.max(1,stats.byTailOverlap.o4.count)).toFixed(2)}球, 3个=${(stats.byTailOverlap.o3.hits/Math.max(1,stats.byTailOverlap.o3.count)).toFixed(2)}球, 2个=${(stats.byTailOverlap.o2.hits/Math.max(1,stats.byTailOverlap.o2.count)).toFixed(2)}球, 1个=${(stats.byTailOverlap.o1.hits/Math.max(1,stats.byTailOverlap.o1.count)).toFixed(2)}球, 0个=${(stats.byTailOverlap.o0.hits/Math.max(1,stats.byTailOverlap.o0.count)).toFixed(2)}球`);
  console.log(`  组合约束:`);
  console.log(`    强(区间比匹配+尾号重复>=2+尾号模式>=20): ${(stats.byCombo.strong.hits/Math.max(1,stats.byCombo.strong.count)).toFixed(2)}球 (${stats.byCombo.strong.count}组)`);
  console.log(`    中(尾号重复>=2+尾号模式>=20 或 区间比匹配): ${(stats.byCombo.medium.hits/Math.max(1,stats.byCombo.medium.count)).toFixed(2)}球 (${stats.byCombo.medium.count}组)`);
  console.log(`    弱(其他): ${(stats.byCombo.weak.hits/Math.max(1,stats.byCombo.weak.count)).toFixed(2)}球 (${stats.byCombo.weak.count}组)`);
  
  // 显示强约束组合中命中最多的几个
  const topCombos=stats.byCombo.strong.combos.sort((a,b)=>b.hits-a.hits).slice(0,3);
  if(topCombos.length>0){
    console.log(`    强约束Top3: ${topCombos.map(c=>`[${c.combo.join(",")}]命中${c.hits}球`).join(", ")}`);
  }
  console.log();
});
