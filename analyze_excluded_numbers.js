const fs = require('fs');
const allDraws = JSON.parse(fs.readFileSync('all_draws.json', 'utf8'));
const N = allDraws.length;
console.log(`总期数: ${N}, 范围: ${allDraws[0].issue} - ${allDraws[N-1].issue}`);

// 核心工具函数
const tails = (nums) => [...new Set(nums.map(n => n % 10))].sort((a, b) => a - b);

// 尾号关联性分析函数
function analyzeTailCorrelation(allBalls, sourceRow, lookback = 100) {
  const tailPairFreq = new Map();
  const tailTripletFreq = new Map();
  const consecutiveTripletFreq = new Map();
  const arithmeticTripletFreq = new Map();
  const arithmeticQuadFreq = new Map();
  
  const start = Math.max(1, sourceRow - lookback);
  for (let r = start; r < sourceRow; r++) {
    const nums = allBalls[r - 1].front;
    if (nums.length !== 5) continue;
    const drawTails = tails(nums);
    
    for (let i = 0; i < drawTails.length; i++) {
      for (let j = i + 1; j < drawTails.length; j++) {
        const pair = `${drawTails[i]},${drawTails[j]}`;
        tailPairFreq.set(pair, (tailPairFreq.get(pair) || 0) + 1);
      }
    }
    
    for (let i = 0; i < drawTails.length; i++) {
      for (let j = i + 1; j < drawTails.length; j++) {
        for (let k = j + 1; k < drawTails.length; k++) {
          const triplet = `${drawTails[i]},${drawTails[j]},${drawTails[k]}`;
          tailTripletFreq.set(triplet, (tailTripletFreq.get(triplet) || 0) + 1);
        }
      }
    }
    
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
  }
  
  return { tailPairFreq, tailTripletFreq, consecutiveTripletFreq, arithmeticTripletFreq, arithmeticQuadFreq };
}

// 尾号关联性评分函数
function getTailCorrelationScore(number, srcTails, correlationData) {
  if (!correlationData) return 0;
  
  const { tailPairFreq, tailTripletFreq, consecutiveTripletFreq, arithmeticTripletFreq, arithmeticQuadFreq } = correlationData;
  const nTail = number % 10;
  let score = 0;
  
  srcTails.forEach((srcTail) => {
    const pair = srcTail < nTail ? `${srcTail},${nTail}` : `${nTail},${srcTail}`;
    const pairFreq = tailPairFreq.get(pair) || 0;
    if (pairFreq > 5) {
      score += pairFreq * 0.5;
    }
  });
  
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
  
  srcTails.forEach((srcTail) => {
    for (let step = 1; step <= 4; step++) {
      const diff = Math.abs(srcTail - nTail);
      if (diff === step || diff === 10 - step) {
        const key = `${Math.min(srcTail,nTail)},${Math.max(srcTail,nTail)}`;
        const freq = arithmeticTripletFreq.get(key) || 0;
        if (freq > 5) {
          score += freq * 0.3;
        }
      }
    }
  });
  
  return score;
}

// 基础评分函数
function calculateBaseScore(n, srcNums, hot) {
  const V4_OFFSET_SCORE = {0:20,1:15,2:13,3:12,4:10,5:8,6:6,7:5,8:4,9:3,10:2};
  let minOffset = Infinity;
  srcNums.forEach(a => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
  let score = V4_OFFSET_SCORE[Math.min(minOffset, 10)] || 0;
  
  const h = hot.get(n) || 0;
  if (h >= 4) score += 6;
  else if (h >= 3) score += 4;
  else if (h >= 2) score += 2;
  else if (h === 0) score -= 1;
  
  return score;
}

// 分析单期被排除的号码
function analyzeExcludedNumbers(srcRow) {
  const srcNums = allDraws[srcRow - 1].front;
  const actualNext = allDraws[srcRow] ? allDraws[srcRow].front : null;
  if (!actualNext || srcNums.length !== 5 || actualNext.length !== 5) return null;
  
  const hot = new Map();
  for (let r = Math.max(1, srcRow - 10); r < srcRow; r++) allDraws[r - 1].front.forEach(n => hot.set(n, (hot.get(n) || 0) + 1));
  
  const srcTails = tails(srcNums);
  const correlationData = analyzeTailCorrelation(allDraws, srcRow, 100);
  
  const candidates = [];
  for (let n = 1; n <= 35; n++) {
    let score = calculateBaseScore(n, srcNums, hot);
    const tailBonus = getTailCorrelationScore(n, srcTails, correlationData);
    if (tailBonus > 0) score += Math.round(tailBonus * 0.9);
    candidates.push({ number: n, score });
  }
  
  candidates.sort((a, b) => b.score - a.score);
  const pool = candidates.slice(0, 24).map(c => c.number);
  const excluded = candidates.slice(24).map(c => c.number);
  
  // 分析每个被排除号码的原因
  const excludedAnalysis = excluded.map(n => {
    const h = hot.get(n) || 0;
    const nTail = n % 10;
    const tailBonus = getTailCorrelationScore(n, srcTails, correlationData);
    
    // 计算与上期号码的最小偏移
    let minOffset = Infinity;
    srcNums.forEach(a => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
    
    // 分析排除原因
    const reasons = [];
    if (h === 0) reasons.push('冷号（近10期未出现）');
    if (minOffset >= 5) reasons.push(`距离上期号码较远（最小偏移${minOffset}）`);
    if (tailBonus === 0) reasons.push('尾号关联性低');
    
    // 检查是否是实际开奖号码
    const isActual = actualNext.includes(n);
    
    return {
      number: n,
      score: candidates.find(c => c.number === n).score,
      hotness: h,
      minOffset,
      tailBonus,
      reasons,
      isActual,
      tail: nTail
    };
  });
  
  // 统计被排除号码的特征
  const excludedTails = excluded.map(n => n % 10);
  const tailCounts = {};
  for (let t = 0; t <= 9; t++) {
    tailCounts[t] = excludedTails.filter(tail => tail === t).length;
  }
  
  return {
    issue: allDraws[srcRow - 1].issue,
    srcNums,
    actualNext,
    pool,
    excluded,
    excludedAnalysis,
    tailCounts,
    actualExcluded: excluded.filter(n => actualNext.includes(n)) // 被排除但实际是开奖号码
  };
}

// 执行分析
console.log('\n=== 被排除号码分析 ===\n');

const startRow = 20;
const endRow = N;

let allExcluded = [];
let totalExcludedActual = 0; // 被排除但实际是开奖号码的数量
let totalExcluded = 0;
let reasonStats = {};
let tailExcludedStats = {};
let hotnessExcludedStats = {};

for (let srcRow = startRow; srcRow <= endRow; srcRow++) {
  const result = analyzeExcludedNumbers(srcRow);
  if (!result) continue;
  
  allExcluded.push(result);
  totalExcluded += result.excluded.length;
  totalExcludedActual += result.actualExcluded.length;
  
  // 统计排除原因
  result.excludedAnalysis.forEach(item => {
    item.reasons.forEach(reason => {
      reasonStats[reason] = (reasonStats[reason] || 0) + 1;
    });
    
    // 统计热度分布
    const hotnessKey = `热度${item.hotness}`;
    hotnessExcludedStats[hotnessKey] = (hotnessExcludedStats[hotnessKey] || 0) + 1;
  });
  
  // 统计尾号分布
  Object.entries(result.tailCounts).forEach(([tail, count]) => {
    tailExcludedStats[tail] = (tailExcludedStats[tail] || 0) + count;
  });
}

console.log(`分析期数: ${allExcluded.length}`);
console.log(`总被排除号码数: ${totalExcluded}`);
console.log(`被排除但实际是开奖号码: ${totalExcludedActual}`);
console.log(`误排除率: ${(totalExcludedActual / totalExcluded * 100).toFixed(2)}%`);

console.log('\n=== 排除原因统计 ===\n');
const sortedReasons = Object.entries(reasonStats).sort((a, b) => b[1] - a[1]);
sortedReasons.forEach(([reason, count]) => {
  console.log(`${reason}: ${count}次 (${(count / totalExcluded * 100).toFixed(2)}%)`);
});

console.log('\n=== 被排除号码尾号分布 ===\n');
for (let t = 0; t <= 9; t++) {
  const count = tailExcludedStats[t] || 0;
  console.log(`尾号${t}: ${count}次 (${(count / totalExcluded * 100).toFixed(2)}%)`);
}

console.log('\n=== 被排除号码热度分布 ===\n');
const sortedHotness = Object.entries(hotnessExcludedStats).sort((a, b) => b[1] - a[1]);
sortedHotness.forEach(([key, count]) => {
  console.log(`${key}: ${count}次 (${(count / totalExcluded * 100).toFixed(2)}%)`);
});

// 分析被排除但实际是开奖号码的特征
console.log('\n=== 被排除但实际是开奖号码的特征 ===\n');
let actualExcludedFeatures = {
  hotness: {},
  offsets: {},
  tailBonus: { zero: 0, low: 0, medium: 0, high: 0 }
};

allExcluded.forEach(result => {
  result.actualExcluded.forEach(n => {
    const analysis = result.excludedAnalysis.find(a => a.number === n);
    if (!analysis) return;
    
    // 热度分布
    const hotnessKey = `热度${analysis.hotness}`;
    actualExcludedFeatures.hotness[hotnessKey] = (actualExcludedFeatures.hotness[hotnessKey] || 0) + 1;
    
    // 偏移分布
    const offsetKey = analysis.minOffset <= 3 ? '近距离' : analysis.minOffset <= 6 ? '中距离' : '远距离';
    actualExcludedFeatures.offsets[offsetKey] = (actualExcludedFeatures.offsets[offsetKey] || 0) + 1;
    
    // 尾号关联性分布
    if (analysis.tailBonus === 0) actualExcludedFeatures.tailBonus.zero++;
    else if (analysis.tailBonus < 10) actualExcludedFeatures.tailBonus.low++;
    else if (analysis.tailBonus < 30) actualExcludedFeatures.tailBonus.medium++;
    else actualExcludedFeatures.tailBonus.high++;
  });
});

console.log('被排除但实际开奖号码的热度分布:');
Object.entries(actualExcludedFeatures.hotness).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
  console.log(`  ${key}: ${count}次`);
});

console.log('\n被排除但实际开奖号码的偏移分布:');
Object.entries(actualExcludedFeatures.offsets).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
  console.log(`  ${key}: ${count}次`);
});

console.log('\n被排除但实际开奖号码的尾号关联性分布:');
console.log(`  尾号关联性为0: ${actualExcludedFeatures.tailBonus.zero}次`);
console.log(`  尾号关联性低(<10): ${actualExcludedFeatures.tailBonus.low}次`);
console.log(`  尾号关联性中(10-30): ${actualExcludedFeatures.tailBonus.medium}次`);
console.log(`  尾号关联性高(>30): ${actualExcludedFeatures.tailBonus.high}次`);

// 保存详细结果
const output = {
  testDate: new Date().toISOString(),
  totalPeriods: allExcluded.length,
  totalExcluded,
  totalExcludedActual,
  errorRate: (totalExcludedActual / totalExcluded * 100).toFixed(2),
  reasonStats,
  tailExcludedStats,
  hotnessExcludedStats,
  actualExcludedFeatures,
  detailedResults: allExcluded.slice(0, 10) // 只保存前10期详细结果
};

fs.writeFileSync('analysis_output/excluded_numbers_analysis.json', JSON.stringify(output, null, 2));
console.log('\n详细分析结果已保存到: analysis_output/excluded_numbers_analysis.json');

// 显示几期具体例子
console.log('\n=== 具体例子（前3期）===\n');
for (let i = 0; i < Math.min(3, allExcluded.length); i++) {
  const result = allExcluded[i];
  console.log(`期号: ${result.issue}`);
  console.log(`上期开奖: ${result.srcNums.join(', ')}`);
  console.log(`当期开奖: ${result.actualNext.join(', ')}`);
  console.log(`候选池: ${result.pool.join(', ')}`);
  console.log(`被排除: ${result.excluded.join(', ')}`);
  
  if (result.actualExcluded.length > 0) {
    console.log(`⚠️ 被排除但实际开奖: ${result.actualExcluded.join(', ')}`);
    result.actualExcluded.forEach(n => {
      const analysis = result.excludedAnalysis.find(a => a.number === n);
      if (analysis) {
        console.log(`  号码${n}: 得分=${analysis.score}, 热度=${analysis.hotness}, 偏移=${analysis.minOffset}, 尾号关联=${analysis.tailBonus}`);
        console.log(`    排除原因: ${analysis.reasons.join(', ')}`);
      }
    });
  } else {
    console.log('✅ 所有开奖号码都在候选池中');
  }
  console.log('');
}