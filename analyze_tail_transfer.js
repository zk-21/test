// 分析选中行尾号到目标行尾号的转移规律
const draws={17:[2,9,14,20,31],18:[2,6,14,22,24],19:[9,10,20,33,35],20:[6,7,18,21,30],27:[3,15,20,29,31],28:[3,13,15,17,21],29:[4,11,12,13,25],30:[10,13,19,21,30]};

// 收集所有相邻行对
const pairs=[];
for(let r=1;r<=29;r++){
  if(draws[r]&&draws[r+1]&&draws[r].length===5&&draws[r+1].length===5){
    pairs.push({from:r,to:r+1,fromNums:draws[r],toNums:draws[r+1]});
  }
}

console.log("=== 相邻行尾号转移统计 ===\n");

// 1. 尾号延续率（选中行尾号在目标行出现的概率）
console.log("1. 尾号延续率");
let totalTails=0,continuedTails=0;
const tailTransferFreq=new Map(); // 每个尾号的延续次数
const tailTotalFreq=new Map(); // 每个尾号的总出现次数

pairs.forEach(p=>{
  const fromTails=new Set(p.fromNums.map(x=>x%10));
  const toTails=new Set(p.toNums.map(x=>x%10));
  
  fromTails.forEach(t=>{
    tailTotalFreq.set(t,(tailTotalFreq.get(t)||0)+1);
    if(toTails.has(t)){
      continuedTails++;
      tailTransferFreq.set(t,(tailTransferFreq.get(t)||0)+1);
    }
    totalTails++;
  });
});

console.log(`  总尾号数:${totalTails}, 延续数:${continuedTails}, 延续率:${(continuedTails/totalTails*100).toFixed(0)}%`);
console.log(`  各尾号延续率:`);
for(let t=0;t<=9;t++){
  const total=tailTotalFreq.get(t)||0;
  const continued=tailTransferFreq.get(t)||0;
  if(total>0)console.log(`    尾号${t}: ${continued}/${total} (${(continued/total*100).toFixed(0)}%)`);
}

// 2. 重复尾号的转移（选中行有重复尾号，目标行是否也有）
console.log("\n2. 重复尾号转移");
let repFrom=0,repTo=0,repBoth=0;
pairs.forEach(p=>{
  const fromTc=new Map();
  p.fromNums.forEach(x=>{const t=x%10;fromTc.set(t,(fromTc.get(t)||0)+1)});
  const toTc=new Map();
  p.toNums.forEach(x=>{const t=x%10;toTc.set(t,(toTc.get(t)||0)+1)});
  
  const fromHasRep=[...fromTc.values()].some(c=>c>=2);
  const toHasRep=[...toTc.values()].some(c=>c>=2);
  
  if(fromHasRep)repFrom++;
  if(toHasRep)repTo++;
  if(fromHasRep&&toHasRep)repBoth++;
});
console.log(`  选中行有重复:${repFrom}/${pairs.length}, 目标行有重复:${repTo}/${pairs.length}`);
console.log(`  两行都有重复:${repBoth}/${pairs.length} (${(repBoth/pairs.length*100).toFixed(0)}%)`);

// 3. 等差尾号的转移
console.log("\n3. 等差尾号转移");
let apFrom=0,apTo=0,apBoth=0;
pairs.forEach(p=>{
  const fromTs=[...new Set(p.fromNums.map(x=>x%10))].sort((a,b)=>a-b);
  const toTs=[...new Set(p.toNums.map(x=>x%10))].sort((a,b)=>a-b);
  
  const hasAP=(ts)=>{
    for(let d=1;d<=3;d++){
      for(let start=0;start<=9;start++){
        const matched=[];
        for(let v=start;v<=9;v+=d)if(ts.includes(v))matched.push(v);
        if(matched.length>=3)return true;
      }
    }
    return false;
  };
  
  const fromAP=hasAP(fromTs);
  const toAP=hasAP(toTs);
  
  if(fromAP)apFrom++;
  if(toAP)apTo++;
  if(fromAP&&toAP)apBoth++;
});
console.log(`  选中行有等差:${apFrom}/${pairs.length}, 目标行有等差:${apTo}/${pairs.length}`);
console.log(`  两行都有等差:${apBoth}/${pairs.length} (${(apBoth/pairs.length*100).toFixed(0)}%)`);

// 4. 关键发现：选中行尾号特征 → 目标行尾号特征
console.log("\n4. 选中行尾号特征 vs 目标行尾号特征");
pairs.forEach(p=>{
  const fromTails=p.fromNums.map(x=>x%10).sort((a,b)=>a-b);
  const toTails=p.toNums.map(x=>x%10).sort((a,b)=>a-b);
  const fromUnique=[...new Set(fromTails)];
  const toUnique=[...new Set(toTails)];
  
  // 共同尾号
  const common=fromUnique.filter(t=>toUnique.includes(t));
  
  // 选中行重复尾号
  const fromTc=new Map();
  fromTails.forEach(t=>fromTc.set(t,(fromTc.get(t)||0)+1));
  const fromRepeats=[...fromTc.entries()].filter(([t,c])=>c>=2).map(([t])=>t);
  
  // 目标行重复尾号
  const toTc=new Map();
  toTails.forEach(t=>toTc.set(t,(toTc.get(t)||0)+1));
  const toRepeats=[...toTc.entries()].filter(([t,c])=>c>=2).map(([t])=>t);
  
  console.log(`  第${p.from}→${p.to}期:`);
  console.log(`    选中行尾[${fromTails.join(",")}] 重复:${fromRepeats.length>0?fromRepeats.join(","):"无"}`);
  console.log(`    目标行尾[${toTails.join(",")}] 重复:${toRepeats.length>0?toRepeats.join(","):"无"}`);
  console.log(`    共同尾号:${common.length>0?common.join(","):"无"} (${common.length}个)`);
});

// 5. 尾号转移的强信号
console.log("\n5. 尾号转移强信号统计");
const signalStats={
  common1:0,common2:0,common3plus:0,
  repContinue:0,repNew:0,
  apContinue:0
};

pairs.forEach(p=>{
  const fromUnique=[...new Set(p.fromNums.map(x=>x%10))];
  const toUnique=[...new Set(p.toNums.map(x=>x%10))];
  const common=fromUnique.filter(t=>toUnique.includes(t));
  
  if(common.length===1)signalStats.common1++;
  else if(common.length===2)signalStats.common2++;
  else if(common.length>=3)signalStats.common3plus++;
  
  // 重复尾号延续
  const fromTc=new Map();
  p.fromNums.forEach(x=>{const t=x%10;fromTc.set(t,(fromTc.get(t)||0)+1)});
  const toTc=new Map();
  p.toNums.forEach(x=>{const t=x%10;toTc.set(t,(toTc.get(t)||0)+1)});
  const fromRepTails=[...fromTc.entries()].filter(([t,c])=>c>=2).map(([t])=>t);
  const toRepTails=[...toTc.entries()].filter(([t,c])=>c>=2).map(([t])=>t);
  
  if(fromRepTails.length>0&&toRepTails.length>0){
    const continued=fromRepTails.filter(t=>toRepTails.includes(t));
    if(continued.length>0)signalStats.repContinue++;
    else signalStats.repNew++;
  }
});

console.log(`  共同尾号1个: ${signalStats.common1}次`);
console.log(`  共同尾号2个: ${signalStats.common2}次`);
console.log(`  共同尾号3+个: ${signalStats.common3plus}次`);
console.log(`  重复尾号延续: ${signalStats.repContinue}次`);
console.log(`  重复尾号换新: ${signalStats.repNew}次`);
