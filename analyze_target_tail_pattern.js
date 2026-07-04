// 分析目标行尾号的连续、等差模式
const draws={17:[2,9,14,20,31],18:[2,6,14,22,24],19:[9,10,20,33,35],20:[6,7,18,21,30],27:[3,15,20,29,31],28:[3,13,15,17,21],29:[4,11,12,13,25],30:[10,13,19,21,30]};

console.log("=== 目标行尾号连续/等差分析 ===\n");

// 1. 每行尾号详情
console.log("1. 各行尾号排序及连续/等差特征");
for(let r=17;r<=30;r++){
  if(!draws[r])continue;
  const nums=draws[r];
  const tails=nums.map(x=>x%10).sort((a,b)=>a-b);
  const uniqueTails=[...new Set(tails)].sort((a,b)=>a-b);
  
  // 找连续尾号（差=1）
  const consec=[];
  for(let i=0;i<uniqueTails.length;i++){
    let seq=[uniqueTails[i]];
    for(let j=i+1;j<uniqueTails.length;j++){
      if(uniqueTails[j]===uniqueTails[j-1]+1)seq.push(uniqueTails[j]);
      else break;
    }
    if(seq.length>=2)consec.push(seq);
  }
  
  // 找等差尾号（差>=2）
  const aps=[];
  for(let d=2;d<=4;d++){
    for(let start=0;start<=9-d*2;start++){
      const seq=[];
      for(let v=start;v<=9;v+=d){
        if(uniqueTails.includes(v))seq.push(v);
        else break;
      }
      if(seq.length>=3)aps.push({d,seq});
    }
  }
  
  // 找所有等差（含差=1的连续）
  const allAPs=[];
  for(let d=1;d<=4;d++){
    for(let start=0;start<=9-d;start++){
      const seq=[];
      for(let v=start;v<=9;v+=d){
        if(uniqueTails.includes(v))seq.push(v);
        else break;
      }
      if(seq.length>=3)allAPs.push({d,seq});
    }
  }
  
  console.log(`  第${r}期: [${nums.join(",")}]`);
  console.log(`    尾号: [${tails.join(",")}] 去重: [${uniqueTails.join(",")}]`);
  if(consec.length>0)console.log(`    连续尾号: ${consec.map(s=>`[${s.join(",")}]`).join(", ")}`);
  if(aps.length>0)console.log(`    等差尾号(d>=2): ${aps.map(a=>`d=${a.d}:[${a.seq.join(",")}]`).join(", ")}`);
  if(allAPs.length>0)console.log(`    所有等差(含连续): ${allAPs.map(a=>`d=${a.d}:[${a.seq.join(",")}]`).join(", ")}`);
  if(consec.length===0&&aps.length===0)console.log(`    无连续/等差`);
}

// 2. 统计：每行有多少个号码的尾号在连续/等差序列中
console.log("\n2. 尾号连续/等差覆盖率统计");
let totalConsec=0,totalAP=0,totalAll=0;
const rows=Object.keys(draws).map(Number).sort((a,b)=>a-b);

rows.forEach(r=>{
  const nums=draws[r];
  const tails=nums.map(x=>x%10);
  const uniqueTails=[...new Set(tails)].sort((a,b)=>a-b);
  
  // 在连续序列中的尾号
  const inConsec=new Set();
  for(let i=0;i<uniqueTails.length;i++){
    let seq=[uniqueTails[i]];
    for(let j=i+1;j<uniqueTails.length;j++){
      if(uniqueTails[j]===uniqueTails[j-1]+1)seq.push(uniqueTails[j]);
      else break;
    }
    if(seq.length>=2)seq.forEach(t=>inConsec.add(t));
  }
  
  // 在等差序列中的尾号（含连续）
  const inAP=new Set();
  for(let d=1;d<=4;d++){
    for(let start=0;start<=9-d;start++){
      const seq=[];
      for(let v=start;v<=9;v+=d){
        if(uniqueTails.includes(v))seq.push(v);
        else break;
      }
      if(seq.length>=3)seq.forEach(t=>inAP.add(t));
    }
  }
  
  const consecCount=tails.filter(t=>inConsec.has(t)).length;
  const apCount=tails.filter(t=>inAP.has(t)).length;
  
  totalConsec+=consecCount;
  totalAll+=apCount;
  
  console.log(`  第${r}期: 连续覆盖${consecCount}/5, 等差覆盖${apCount}/5`);
});

console.log(`\n  平均连续覆盖: ${(totalConsec/rows.length).toFixed(1)}/5`);
console.log(`  平均等差覆盖: ${(totalAll/rows.length).toFixed(1)}/5`);

// 3. 关键问题：组合的尾号是否满足连续/等差模式，与命中率的关系
console.log("\n3. 尾号连续/等差模式 vs 命中率");

// 对每个目标行，用前一行的锚点池生成组合，检查尾号模式
const pool=new Set();
for(let r=17;r<=30;r++){
  if(draws[r])draws[r].forEach(n=>pool.add(n));
}
const allNums=[...pool].sort((a,b)=>a-b);

// 生成所有C(35,5)太多，用采样方式
// 对每行，检查该行尾号是否包含连续或等差
console.log("\n  各行尾号模式命中率:");
let hasAPCount=0,noAPCount=0,hasAPHits=0,noAPHits=0;
let hasConsecCount=0,noConsecCount=0,hasConsecHits=0,noConsecHits=0;

rows.forEach(r=>{
  const nums=draws[r];
  const tails=nums.map(x=>x%10).sort((a,b)=>a-b);
  const uniqueTails=[...new Set(tails)].sort((a,b)=>a-b);
  
  // 检查是否有连续尾号
  let hasConsec=false;
  for(let i=0;i<uniqueTails.length-1;i++){
    if(uniqueTails[i+1]-uniqueTails[i]===1){hasConsec=true;break;}
  }
  
  // 检查是否有等差尾号(d>=1, len>=3)
  let hasAP=false;
  for(let d=1;d<=4;d++){
    for(let start=0;start<=9-d*2;start++){
      let cnt=0;
      for(let v=start;v<=9;v+=d){
        if(uniqueTails.includes(v))cnt++;
      }
      if(cnt>=3){hasAP=true;break;}
    }
    if(hasAP)break;
  }
  
  // 命中率用与其他行的重叠来衡量
  let maxOverlap=0;
  rows.forEach(r2=>{
    if(r2===r)return;
    const overlap=nums.filter(n=>draws[r2].includes(n)).length;
    if(overlap>maxOverlap)maxOverlap=overlap;
  });
  
  if(hasAP){hasAPCount++;hasAPHits+=nums.length;}
  else{noAPCount++;noAPHits+=nums.length;}
  
  if(hasConsec){hasConsecCount++;hasConsecHits+=nums.length;}
  else{noConsecCount++;noConsecHits+=nums.length;}
  
  console.log(`  第${r}期: 连续=${hasConsec?"有":"无"}, 等差=${hasAP?"有":"无"}, 号码=[${nums.join(",")}]`);
});

console.log(`\n  有连续: ${hasConsecCount}/${rows.length}, 无连续: ${noConsecCount}/${rows.length}`);
console.log(`  有等差: ${hasAPCount}/${rows.length}, 无等差: ${noAPCount}/${rows.length}`);

// 4. 更深入：尾号连续/等差的具体模式频率
console.log("\n4. 尾号连续/等差模式详细频率");
const patternFreq=new Map();
rows.forEach(r=>{
  const tails=[...new Set(draws[r].map(x=>x%10))].sort((a,b)=>a-b);
  
  // 找所有连续段
  const segments=[];
  let i=0;
  while(i<tails.length){
    let seg=[tails[i]];
    while(i+1<tails.length&&tails[i+1]===tails[i]+1){
      i++;seg.push(tails[i]);
    }
    if(seg.length>=2)segments.push(seg);
    i++;
  }
  
  // 找所有等差段
  for(let d=1;d<=4;d++){
    for(let start=0;start<=9-d;start++){
      const seq=[];
      for(let v=start;v<=9;v+=d){
        if(tails.includes(v))seq.push(v);
        else break;
      }
      if(seq.length>=3){
        const key=`d=${d}:${seq.join(",")}`;
        patternFreq.set(key,(patternFreq.get(key)||0)+1);
      }
    }
  }
});

console.log("  等差模式频率:");
[...patternFreq.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
  console.log(`    ${k}: ${v}/${rows.length}次 (${(v/rows.length*100).toFixed(0)}%)`);
});

// 5. 尾号差值分析
console.log("\n5. 尾号相邻差值分布");
const diffFreq=new Map();
rows.forEach(r=>{
  const tails=[...new Set(draws[r].map(x=>x%10))].sort((a,b)=>a-b);
  for(let i=0;i<tails.length-1;i++){
    const d=tails[i+1]-tails[i];
    diffFreq.set(d,(diffFreq.get(d)||0)+1);
  }
});
const totalDiffs=[...diffFreq.values()].reduce((a,b)=>a+b,0);
console.log("  差值分布:");
[...diffFreq.entries()].sort((a,b)=>a[0]-b[0]).forEach(([d,c])=>{
  console.log(`    差${d}: ${c}次 (${(c/totalDiffs*100).toFixed(0)}%)`);
});

// 6. 组合评分：尾号连续/等差得分高的组合是否命中更多
console.log("\n6. 组合尾号连续/等差评分 vs 命中（模拟）");
// 用第27-30行做测试，前一行做锚点
const testRows=[28,29,30];
testRows.forEach(target=>{
  const prev=target-1;
  if(!draws[prev]||!draws[target])return;
  
  const targetNums=draws[target];
  const targetTails=[...new Set(targetNums.map(x=>x%10))].sort((a,b)=>a-b);
  
  // 目标行的尾号等差评分
  let targetScore=0;
  for(let d=1;d<=4;d++){
    for(let start=0;start<=9-d;start++){
      let cnt=0;
      for(let v=start;v<=9;v+=d){
        if(targetTails.includes(v))cnt++;
      }
      if(cnt>=3)targetScore+=cnt*10;
    }
  }
  // 连续评分
  for(let i=0;i<targetTails.length-1;i++){
    if(targetTails[i+1]-targetTails[i]===1)targetScore+=15;
  }
  
  console.log(`  第${target}期目标: [${targetNums.join(",")}] 尾号=[${targetTails.join(",")}] 等差连续分=${targetScore}`);
});
