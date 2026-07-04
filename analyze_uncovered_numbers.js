const fs = require('fs');
const allDraws = JSON.parse(fs.readFileSync('all_draws.json', 'utf8'));
const N = allDraws.length;
console.log(`总期数: ${N}, 范围: ${allDraws[0].issue} - ${allDraws[N-1].issue}`);

// 核心工具函数
const getIvIdx = (n) => n<=12?0:n<=24?1:2;
const ivRatio = (nums) => { const iv=[0,0,0]; nums.forEach(n=>iv[getIvIdx(n)]++); return iv; };
const tails = (nums) => [...new Set(nums.map(n=>n%10))].sort((a,b)=>a-b);
const sum = (nums) => nums.reduce((a,b)=>a+b,0);
const V4_OFFSET_SCORE = {0:20,1:15,2:13,3:12,4:10,5:8,6:6,7:5,8:4,9:3,10:2};

// 尾号关联性分析函数
function analyzeTailCorrelation(allBalls, sourceRow, lookback = 100) {
  const tailPairFreq = new Map();
  const tailTripletFreq = new Map();
  const consecutiveTripletFreq = new Map();
  const arithmeticTripletFreq = new Map();
  const arithmeticQuadFreq = new Map();
  const multiSegmentFreq = new Map();
  const mixedPatternFreq = new Map();
  
  const start = Math.max(1, sourceRow - lookback);
  for (let r = start; r < sourceRow; r++) {
    const nums = allBalls[r-1].front;
    if (nums.length !== 5) continue;
    
    const drawTails = tails(nums);
    
    // 统计尾号对
    for (let i = 0; i < drawTails.length; i++) {
      for (let j = i + 1; j < drawTails.length; j++) {
        const pair = `${drawTails[i]},${drawTails[j]}`;
        tailPairFreq.set(pair, (tailPairFreq.get(pair) || 0) + 1);
      }
    }
    
    // 统计尾号三元组
    for (let i = 0; i < drawTails.length; i++) {
      for (let j = i + 1; j < drawTails.length; j++) {
        for (let k = j + 1; k < drawTails.length; k++) {
          const triplet = `${drawTails[i]},${drawTails[j]},${drawTails[k]}`;
          tailTripletFreq.set(triplet, (tailTripletFreq.get(triplet) || 0) + 1);
        }
      }
    }
    
    // 统计连续尾号三元组
    for (let i = 0; i < drawTails.length; i++) {
      for (let j = i + 1; j < drawTails.length; j++) {
        for (let k = j + 1; k < drawTails.length; k++) {
          const t1 = drawTails[i], t2 = drawTails[j], t3 = drawTails[k];
          const isConsecutive = (
            (t2 === (t1 + 1) % 10 && t3 === (t2 + 1) % 10) ||
            (t1 === (t2 + 1) % 10 && t2 === (t3 + 1) % 10)
          );
          if (isConsecutive) {
            const key = `${t1},${t2},${t3}`;
            consecutiveTripletFreq.set(key, (consecutiveTripletFreq.get(key) || 0) + 1);
          }
        }
      }
    }
    
    // 统计等差尾号三元组（任意步长1-4）
    for (let i = 0; i < drawTails.length; i++) {
      for (let j = i + 1; j < drawTails.length; j++) {
        for (let k = j + 1; k < drawTails.length; k++) {
          const t1 = drawTails[i], t2 = drawTails[j], t3 = drawTails[k];
          for (let step = 1; step <= 4; step++) {
            const isArithmetic = (
              (t2 - t1 === step && t3 - t2 === step) ||
              (t1 - t2 === step && t2 - t3 === step)
            );
            if (isArithmetic) {
              const key = `${t1},${t2},${t3}`;
              arithmeticTripletFreq.set(key, (arithmeticTripletFreq.get(key) || 0) + 1);
            }
          }
        }
      }
    }
    
    // 统计等差尾号四元组（任意步长1-4）
    if (drawTails.length >= 4) {
      for (let i = 0; i < drawTails.length; i++) {
        for (let j = i + 1; j < drawTails.length; j++) {
          for (let k = j + 1; k < drawTails.length; k++) {
            for (let l = k + 1; l < drawTails.length; l++) {
              const t1 = drawTails[i], t2 = drawTails[j], t3 = drawTails[k], t4 = drawTails[l];
              for (let step = 1; step <= 4; step++) {
                const isArithmetic = (
                  (t2 - t1 === step && t3 - t2 === step && t4 - t3 === step) ||
                  (t1 - t2 === step && t2 - t3 === step && t3 - t4 === step)
                );
                if (isArithmetic) {
                  const key = `${t1},${t2},${t3},${t4}`;
                  arithmeticQuadFreq.set(key, (arithmeticQuadFreq.get(key) || 0) + 1);
                }
              }
            }
          }
        }
      }
    }
    
    // 统计多段连续模式
    const segments = [];
    let currentSegment = [drawTails[0]];
    for (let i = 1; i < drawTails.length; i++) {
      if (drawTails[i] === (drawTails[i-1] + 1) % 10) {
        currentSegment.push(drawTails[i]);
      } else {
        if (currentSegment.length >= 2) {
          segments.push([...currentSegment]);
        }
        currentSegment = [drawTails[i]];
      }
    }
    if (currentSegment.length >= 2) {
      segments.push([...currentSegment]);
    }
    
    if (segments.length >= 2) {
      const pattern = segments.map(s => s.join(',')).join('|');
      multiSegmentFreq.set(pattern, (multiSegmentFreq.get(pattern) || 0) + 1);
    }
    
    // 统计混合模式（连续+等差）
    for (let i = 0; i < drawTails.length; i++) {
      for (let j = i + 1; j < drawTails.length; j++) {
        for (let k = j + 1; k < drawTails.length; k++) {
          const t1 = drawTails[i], t2 = drawTails[j], t3 = drawTails[k];
          const isConsecutivePair = (t2 === (t1 + 1) % 10 || t1 === (t2 + 1) % 10);
          const isArithmeticPair = (Math.abs(t2 - t1) === 2 || Math.abs(t2 - t1) === 8);
          const isConsecutivePair2 = (t3 === (t2 + 1) % 10 || t2 === (t3 + 1) % 10);
          const isArithmeticPair2 = (Math.abs(t3 - t2) === 2 || Math.abs(t3 - t2) === 8);
          
          if ((isConsecutivePair && isArithmeticPair2) || (isArithmeticPair && isConsecutivePair2)) {
            const key = `${t1},${t2},${t3}`;
            mixedPatternFreq.set(key, (mixedPatternFreq.get(key) || 0) + 1);
          }
        }
      }
    }
  }
  
  return { 
    tailPairFreq, tailTripletFreq, consecutiveTripletFreq, 
    arithmeticTripletFreq, arithmeticQuadFreq, multiSegmentFreq, mixedPatternFreq 
  };
}

// 尾号关联性评分函数
function getTailCorrelationScore(number, srcTails, correlationData) {
  if (!correlationData) return 0;
  
  const { tailPairFreq, tailTripletFreq, consecutiveTripletFreq, 
          arithmeticTripletFreq, arithmeticQuadFreq, multiSegmentFreq, mixedPatternFreq } = correlationData;
  const nTail = number % 10;
  let score = 0;
  
  // 检查高频对
  srcTails.forEach((srcTail) => {
    const pair = srcTail < nTail ? `${srcTail},${nTail}` : `${nTail},${srcTail}`;
    const pairFreq = tailPairFreq.get(pair) || 0;
    if (pairFreq > 5) {
      score += pairFreq * 0.5;
    }
  });
  
  // 检查高频三元组
  if (srcTails.length >= 2) {
    for (let i = 0; i < srcTails.length; i++) {
      for (let j = i + 1; j < srcTails.length; j++) {
        const t1 = srcTails[i], t2 = srcTails[j];
        const triplet = [t1, t2, nTail].sort().join(',');
        const tripletFreq = tailTripletFreq.get(triplet) || 0;
        if (tripletFreq > 3) {
          score += tripletFreq * 0.8;
        }
      }
    }
  }
  
  // 检查连续三元组
  if (srcTails.length >= 2) {
    for (let i = 0; i < srcTails.length; i++) {
      for (let j = i + 1; j < srcTails.length; j++) {
        const t1 = srcTails[i], t2 = srcTails[j];
        const isConsecutive = (
          (t2 === (t1 + 1) % 10 && nTail === (t2 + 1) % 10) ||
          (t1 === (t2 + 1) % 10 && t2 === (nTail + 1) % 10) ||
          (nTail === (t1 + 1) % 10 && t1 === (t2 + 1) % 10)
        );
        if (isConsecutive) {
          const key = `${t1},${t2},${nTail}`;
          const freq = consecutiveTripletFreq.get(key) || 0;
          if (freq > 1) {
            score += freq * 2.0;
          }
        }
      }
    }
  }
  
  // 检查等差三元组（任意步长1-4）
  if (srcTails.length >= 2) {
    for (let i = 0; i < srcTails.length; i++) {
      for (let j = i + 1; j < srcTails.length; j++) {
        const t1 = srcTails[i], t2 = srcTails[j];
        for (let step = 1; step <= 4; step++) {
          const isArithmetic = (
            (t2 - t1 === step && nTail - t2 === step) ||
            (t1 - t2 === step && t2 - nTail === step) ||
            (nTail - t1 === step && t1 - t2 === step)
          );
          if (isArithmetic) {
            const key = `${t1},${t2},${nTail}`;
            const freq = arithmeticTripletFreq.get(key) || 0;
            if (freq > 1) {
              score += freq * 1.0;
            }
          }
        }
      }
    }
  }
  
  // 检查等差四元组（任意步长1-4）
  if (srcTails.length >= 3) {
    for (let i = 0; i < srcTails.length; i++) {
      for (let j = i + 1; j < srcTails.length; j++) {
        for (let k = j + 1; k < srcTails.length; k++) {
          const t1 = srcTails[i], t2 = srcTails[j], t3 = srcTails[k];
          for (let step = 1; step <= 4; step++) {
            const isArithmetic = (
              (t2 - t1 === step && t3 - t2 === step && nTail - t3 === step) ||
              (t1 - t2 === step && t2 - t3 === step && t3 - nTail === step)
            );
            if (isArithmetic) {
              const key = `${t1},${t2},${t3},${nTail}`;
              const freq = arithmeticQuadFreq.get(key) || 0;
              if (freq > 0) {
                score += freq * 1.5;
              }
            }
          }
        }
      }
    }
  }
  
  // 检查多段连续模式
  if (srcTails.length >= 3) {
    const allTails = [...srcTails, nTail].sort((a, b) => a - b);
    const segments = [];
    let currentSegment = [allTails[0]];
    for (let i = 1; i < allTails.length; i++) {
      if (allTails[i] === (allTails[i-1] + 1) % 10) {
        currentSegment.push(allTails[i]);
      } else {
        if (currentSegment.length >= 2) {
          segments.push([...currentSegment]);
        }
        currentSegment = [allTails[i]];
      }
    }
    if (currentSegment.length >= 2) {
      segments.push([...currentSegment]);
    }
    
    if (segments.length >= 2) {
      const pattern = segments.map(s => s.join(',')).join('|');
      const freq = multiSegmentFreq.get(pattern) || 0;
      if (freq > 0) {
        score += freq * 2.5;
      }
    }
  }
  
  // 检查混合模式（连续+等差）
  if (srcTails.length >= 2) {
    for (let i = 0; i < srcTails.length; i++) {
      for (let j = i + 1; j < srcTails.length; j++) {
        const t1 = srcTails[i], t2 = srcTails[j];
        const isConsecutivePair = (t2 === (t1 + 1) % 10 || t1 === (t2 + 1) % 10);
        const isArithmeticPair = (Math.abs(t2 - t1) === 2 || Math.abs(t2 - t1) === 8);
        const isConsecutivePair2 = (nTail === (t2 + 1) % 10 || t2 === (nTail + 1) % 10);
        const isArithmeticPair2 = (Math.abs(nTail - t2) === 2 || Math.abs(nTail - t2) === 8);
        
        if ((isConsecutivePair && isArithmeticPair2) || (isArithmeticPair && isConsecutivePair2)) {
          const key = `${t1},${t2},${nTail}`;
          const freq = mixedPatternFreq.get(key) || 0;
          if (freq > 0) {
            score += freq * 1.8;
          }
        }
      }
    }
  }
  
  return score;
}

// 增强版候选池构建函数
function buildPoolWithEnhancedCorrelation(srcRow, correlationData) {
  const srcNums = allDraws[srcRow-1].front;
  const srcTails = tails(srcNums);
  const hot = new Map();
  for(let r=Math.max(1,srcRow-10);r<srcRow;r++) allDraws[r-1].front.forEach(n=>hot.set(n,(hot.get(n)||0)+1));
  
  const cands = [];
  for(let n=1;n<=35;n++) {
    let s=0;
    
    // 1. 偏移分数
    let minOff=Infinity; srcNums.forEach(a=>{minOff=Math.min(minOff,Math.abs(n-a));});
    s += V4_OFFSET_SCORE[Math.min(minOff,10)]||0;
    
    // 2. 热号分数
    const h=hot.get(n)||0;
    s += h>=4 ? 20 : h>=3 ? 15 : h>=2 ? 10 : h===1 ? 5 : 0;
    
    // 3. 区间补充分数
    const iv=ivRatio(srcNums), nIv=getIvIdx(n); if(iv[nIv]<2) s+=8;
    
    // 4. 尾号关联分数
    const tailCorrelationBonus = getTailCorrelationScore(n, srcTails, correlationData);
    if (tailCorrelationBonus > 0) {
      s += Math.round(tailCorrelationBonus * 0.3);
    }
    
    cands.push({number:n,score:s,tail:n%10,hot:h,offset:minOff,iv:nIv});
  }
  
  cands.sort((a,b)=>b.score-a.score);
  
  // 构建候选池
  const pool=[]; const ivC=[0,0,0]; const minIv=[6,6,6];
  for(const c of cands) { const i=getIvIdx(c.number);
    if(pool.length>=24) break;
    if(ivC[i]<minIv[i]) { pool.push(c); ivC[i]++; }
  }
  for(const c of cands) {
    if(pool.length>=24) break;
    if(!pool.find(p=>p.number===c.number)) pool.push(c);
  }
  
  return { pool, allCandidates: cands };
}

// 分析未覆盖号码
function analyzeUncoveredNumbers() {
  const startRow = 20;
  
  // 分析尾号关联性
  const correlationData = analyzeTailCorrelation(allDraws, startRow, 100);
  
  console.log('\n【未覆盖号码规律分析】');
  console.log('=' .repeat(60));
  
  // 统计未覆盖号码的特征
  const uncoveredByTail = new Map(); // 按尾号统计
  const uncoveredByIv = [0, 0, 0]; // 按区间统计
  const uncoveredByHot = new Map(); // 按热号次数统计
  const uncoveredByOffset = new Map(); // 按偏移距离统计
  const uncoveredReasons = new Map(); // 被筛掉的原因
  
  let totalUncovered = 0;
  let totalTests = 0;
  
  for (let srcRow = startRow; srcRow <= N; srcRow++) {
    const srcNums = allDraws[srcRow-1].front;
    const actualNext = allDraws[srcRow] ? allDraws[srcRow].front : null;
    if (!actualNext || srcNums.length !== 5 || actualNext.length !== 5) continue;
    
    const { pool, allCandidates } = buildPoolWithEnhancedCorrelation(srcRow, correlationData);
    const poolNumbers = new Set(pool.map(c => c.number));
    
    // 找出未覆盖的开奖号码
    const uncoveredNumbers = actualNext.filter(n => !poolNumbers.has(n));
    
    if (uncoveredNumbers.length > 0) {
      // 获取未覆盖号码的详细信息
      const hot = new Map();
      for(let r=Math.max(1,srcRow-10);r<srcRow;r++) allDraws[r-1].front.forEach(n=>hot.set(n,(hot.get(n)||0)+1));
      
      uncoveredNumbers.forEach(n => {
        totalUncovered++;
        const tail = n % 10;
        const iv = getIvIdx(n);
        const hotCount = hot.get(n) || 0;
        let minOff = Infinity;
        srcNums.forEach(a => { minOff = Math.min(minOff, Math.abs(n - a)); });
        
        // 统计尾号
        uncoveredByTail.set(tail, (uncoveredByTail.get(tail) || 0) + 1);
        
        // 统计区间
        uncoveredByIv[iv]++;
        
        // 统计热号次数
        uncoveredByHot.set(hotCount, (uncoveredByHot.get(hotCount) || 0) + 1);
        
        // 统计偏移距离
        uncoveredByOffset.set(minOff, (uncoveredByOffset.get(minOff) || 0) + 1);
        
        // 分析被筛掉的原因
        const cand = allCandidates.find(c => c.number === n);
        if (cand) {
          const rank = allCandidates.indexOf(cand) + 1;
          if (rank > 24) {
            // 排名在24名之后，被区间保底挤掉
            uncoveredReasons.set('被区间保底挤掉', (uncoveredReasons.get('被区间保底挤掉') || 0) + 1);
          }
        }
      });
    }
    
    totalTests++;
  }
  
  console.log(`\n总测试期数: ${totalTests}`);
  console.log(`总未覆盖号码数: ${totalUncovered}`);
  console.log(`平均每期未覆盖: ${(totalUncovered/totalTests).toFixed(2)}个`);
  
  console.log('\n【按尾号统计未覆盖号码】');
  console.log('-' .repeat(40));
  const sortedTails = [...uncoveredByTail.entries()].sort((a, b) => b[1] - a[1]);
  sortedTails.forEach(([tail, count]) => {
    const percentage = (count / totalUncovered * 100).toFixed(2);
    console.log(`  尾号${tail}: ${count}次 (${percentage}%)`);
  });
  
  console.log('\n【按区间统计未覆盖号码】');
  console.log('-' .repeat(40));
  console.log(`  区间1 (1-12): ${uncoveredByIv[0]}次 (${(uncoveredByIv[0]/totalUncovered*100).toFixed(2)}%)`);
  console.log(`  区间2 (13-24): ${uncoveredByIv[1]}次 (${(uncoveredByIv[1]/totalUncovered*100).toFixed(2)}%)`);
  console.log(`  区间3 (25-35): ${uncoveredByIv[2]}次 (${(uncoveredByIv[2]/totalUncovered*100).toFixed(2)}%)`);
  
  console.log('\n【按热号次数统计未覆盖号码】');
  console.log('-' .repeat(40));
  const sortedHot = [...uncoveredByHot.entries()].sort((a, b) => a[0] - b[0]);
  sortedHot.forEach(([hotCount, count]) => {
    const percentage = (count / totalUncovered * 100).toFixed(2);
    console.log(`  热号${hotCount}次: ${count}次 (${percentage}%)`);
  });
  
  console.log('\n【按偏移距离统计未覆盖号码】');
  console.log('-' .repeat(40));
  const sortedOffset = [...uncoveredByOffset.entries()].sort((a, b) => a[0] - b[0]);
  sortedOffset.forEach(([offset, count]) => {
    const percentage = (count / totalUncovered * 100).toFixed(2);
    console.log(`  偏移${offset}: ${count}次 (${percentage}%)`);
  });
  
  console.log('\n【被筛掉的原因分析】');
  console.log('-' .repeat(40));
  const sortedReasons = [...uncoveredReasons.entries()].sort((a, b) => b[1] - a[1]);
  sortedReasons.forEach(([reason, count]) => {
    const percentage = (count / totalUncovered * 100).toFixed(2);
    console.log(`  ${reason}: ${count}次 (${percentage}%)`);
  });
  
  // 分析未覆盖号码的共同特征
  console.log('\n【未覆盖号码共同特征】');
  console.log('=' .repeat(60));
  
  // 找出高频未覆盖尾号
  const highFreqTails = sortedTails.filter(([_, count]) => count > totalUncovered * 0.1);
  if (highFreqTails.length > 0) {
    console.log('\n1. 高频未覆盖尾号:');
    highFreqTails.forEach(([tail, count]) => {
      console.log(`   - 尾号${tail}: ${count}次 (${(count/totalUncovered*100).toFixed(2)}%)`);
    });
  }
  
  // 找出低热号未覆盖号码
  const lowHotUncovered = sortedHot.filter(([hotCount, _]) => hotCount <= 1);
  if (lowHotUncovered.length > 0) {
    const totalLowHot = lowHotUncovered.reduce((sum, [_, count]) => sum + count, 0);
    console.log(`\n2. 低热号未覆盖号码 (热号≤1次): ${totalLowHot}次 (${(totalLowHot/totalUncovered*100).toFixed(2)}%)`);
  }
  
  // 找出大偏移未覆盖号码
  const largeOffsetUncovered = sortedOffset.filter(([offset, _]) => offset >= 8);
  if (largeOffsetUncovered.length > 0) {
    const totalLargeOffset = largeOffsetUncovered.reduce((sum, [_, count]) => sum + count, 0);
    console.log(`\n3. 大偏移未覆盖号码 (偏移≥8): ${totalLargeOffset}次 (${(totalLargeOffset/totalUncovered*100).toFixed(2)}%)`);
  }
  
  return { uncoveredByTail, uncoveredByIv, uncoveredByHot, uncoveredByOffset, uncoveredReasons };
}

// 执行分析
console.log('开始分析未覆盖号码规律...');
const analysisResult = analyzeUncoveredNumbers();
console.log('\n分析完成！');