// 新尾号规律函数 - 待添加到 script回测.js

// ═══ 尾号聚类规律分析 ═══
// 基于发现：高频尾号对（3-5、1-3、2-3等）出现频率24-27%
function analyzeTailClustering(sourceRow, allBalls) {
  const tailScores = new Map();
  for (let t = 0; t <= 9; t++) tailScores.set(t, 0);
  
  // 高频尾号对（基于分析结果）
  const highFreqPairs = [
    [3, 5, 0.27], // 27.0%
    [1, 3, 0.26], // 26.2%
    [2, 3, 0.25], // 24.6%
    [3, 8, 0.24], // 23.8%
    [1, 5, 0.23], // 23.0%
    [2, 4, 0.22], // 22.1%
    [3, 4, 0.22], // 22.1%
    [5, 8, 0.22], // 22.1%
    [2, 6, 0.21], // 21.3%
    [2, 8, 0.21], // 21.3%
  ];
  
  // 获取前一期的尾号
  if (sourceRow > 0) {
    const ballsByRow = new Map();
    allBalls.filter(b => b.zone === "front").forEach(b => {
      if (!ballsByRow.has(b.row)) ballsByRow.set(b.row, []);
      ballsByRow.get(b.row).push(b.number);
    });
    
    const prevRow = sourceRow - 1;
    const prevNums = [...new Set(ballsByRow.get(prevRow) || [])];
    
    if (prevNums.length === 5) {
      const prevTails = new Set(prevNums.map(n => n % 10));
      
      // 检查前一期尾号是否在高频对中
      highFreqPairs.forEach(([t1, t2, freq]) => {
        if (prevTails.has(t1)) {
          tailScores.set(t2, tailScores.get(t2) + freq * 10);
        }
        if (prevTails.has(t2)) {
          tailScores.set(t1, tailScores.get(t1) + freq * 10);
        }
      });
    }
  }
  
  // 历史聚类频率分析
  const lookback = 70;
  const start = Math.max(1, sourceRow - lookback);
  const clusterFreq = new Map();
  for (let t = 0; t <= 9; t++) clusterFreq.set(t, 0);
  
  const ballsByRow = new Map();
  allBalls.filter(b => b.zone === "front").forEach(b => {
    if (!ballsByRow.has(b.row)) ballsByRow.set(b.row, []);
    ballsByRow.get(b.row).push(b.number);
  });
  
  for (let r = start; r < sourceRow; r++) {
    const nums = [...new Set(ballsByRow.get(r) || [])];
    if (nums.length !== 5) continue;
    
    const tails = new Set(nums.map(n => n % 10));
    
    // 统计高频对在历史中的出现
    highFreqPairs.forEach(([t1, t2]) => {
      if (tails.has(t1) && tails.has(t2)) {
        clusterFreq.set(t1, clusterFreq.get(t1) + 1);
        clusterFreq.set(t2, clusterFreq.get(t2) + 1);
      }
    });
  }
  
  // 标准化并合并分数
  const maxCluster = Math.max(1, ...clusterFreq.values());
  clusterFreq.forEach((count, tail) => {
    const score = (count / maxCluster) * 5;
    tailScores.set(tail, tailScores.get(tail) + score);
  });
  
  return [...tailScores.entries()];
}

// ═══ 尾号转换规律分析 ═══
// 基于发现：尾号6→3转换概率最高（0.17）
function analyzeTailTransitions(sourceRow, allBalls) {
  const tailScores = new Map();
  for (let t = 0; t <= 9; t++) tailScores.set(t, 0);
  
  // 预先按行分组
  const ballsByRow = new Map();
  allBalls.filter(b => b.zone === "front").forEach(b => {
    if (!ballsByRow.has(b.row)) ballsByRow.set(b.row, []);
    ballsByRow.get(b.row).push(b.number);
  });
  
  // 获取前一期的尾号
  if (sourceRow > 0) {
    const prevRow = sourceRow - 1;
    const prevNums = [...new Set(ballsByRow.get(prevRow) || [])];
    
    if (prevNums.length === 5) {
      const prevTails = new Set(prevNums.map(n => n % 10));
      
      // 基于转换概率矩阵（从分析结果）
      const transitionMatrix = {
        0: { 1: 0.13, 5: 0.13, 4: 0.12, 2: 0.10, 3: 0.10, 6: 0.10, 9: 0.10, 7: 0.09, 8: 0.09, 0: 0.07 },
        1: { 3: 0.13, 2: 0.11, 5: 0.12, 0: 0.06, 4: 0.10, 6: 0.09, 8: 0.09, 9: 0.10, 7: 0.08, 1: 0.12 },
        2: { 3: 0.14, 4: 0.10, 1: 0.11, 5: 0.11, 6: 0.11, 8: 0.09, 9: 0.10, 0: 0.08, 7: 0.05, 2: 0.11 },
        3: { 2: 0.12, 5: 0.09, 1: 0.12, 4: 0.10, 8: 0.11, 9: 0.09, 0: 0.08, 6: 0.08, 7: 0.08, 3: 0.12 },
        4: { 3: 0.14, 9: 0.13, 2: 0.12, 5: 0.10, 6: 0.10, 8: 0.09, 1: 0.08, 0: 0.07, 7: 0.06, 4: 0.11 },
        5: { 3: 0.14, 1: 0.12, 2: 0.12, 6: 0.11, 9: 0.10, 0: 0.08, 4: 0.08, 7: 0.08, 8: 0.08, 5: 0.10 },
        6: { 3: 0.17, 5: 0.12, 1: 0.11, 4: 0.11, 8: 0.11, 2: 0.09, 9: 0.09, 0: 0.07, 7: 0.06, 6: 0.07 },
        7: { 3: 0.14, 1: 0.11, 2: 0.11, 4: 0.11, 8: 0.12, 5: 0.09, 0: 0.07, 6: 0.07, 9: 0.09, 7: 0.07 },
        8: { 3: 0.12, 1: 0.11, 2: 0.11, 6: 0.12, 9: 0.11, 5: 0.10, 4: 0.08, 0: 0.09, 7: 0.07, 8: 0.09 },
        9: { 1: 0.12, 5: 0.12, 2: 0.11, 3: 0.12, 4: 0.10, 0: 0.07, 6: 0.08, 8: 0.10, 7: 0.07, 9: 0.09 }
      };
      
      // 应用转换概率
      prevTails.forEach(srcTail => {
        const transitions = transitionMatrix[srcTail];
        if (transitions) {
          Object.entries(transitions).forEach(([targetTail, prob]) => {
            const t = parseInt(targetTail);
            tailScores.set(t, tailScores.get(t) + prob * 10);
          });
        }
      });
    }
  }
  
  // 历史转换频率分析
  const lookback = 70;
  const start = Math.max(1, sourceRow - lookback);
  const transFreq = new Map();
  
  for (let r = start; r < sourceRow - 1; r++) {
    const srcNums = [...new Set(ballsByRow.get(r) || [])];
    const tgtNums = [...new Set(ballsByRow.get(r + 1) || [])];
    
    if (srcNums.length !== 5 || tgtNums.length !== 5) continue;
    
    const srcTails = new Set(srcNums.map(n => n % 10));
    const tgtTails = new Set(tgtNums.map(n => n % 10));
    
    // 统计转换
    srcTails.forEach(src => {
      tgtTails.forEach(tgt => {
        const key = `${src}→${tgt}`;
        transFreq.set(key, (transFreq.get(key) || 0) + 1);
      });
    });
  }
  
  // 标准化并合并分数
  const maxTrans = Math.max(1, ...transFreq.values());
  transFreq.forEach((count, key) => {
    const [src, tgt] = key.split('→').map(Number);
    const score = (count / maxTrans) * 5;
    tailScores.set(tgt, tailScores.get(tgt) + score);
  });
  
  return [...tailScores.entries()];
}

// ═══ 尾号周期性规律分析 ═══
// 基于发现：尾号3周期性最强（0.49），每1.74期出现一次
function analyzeTailPeriodicity(sourceRow, allBalls) {
  const tailScores = new Map();
  for (let t = 0; t <= 9; t++) tailScores.set(t, 0);
  
  // 周期性强度（从分析结果）
  const periodicityStrength = {
    0: 0.31,  // 平均3.08期
    1: 0.40,  // 平均1.97期
    2: 0.39,  // 平均2.03期
    3: 0.49,  // 平均1.74期（最强）
    4: 0.39,  // 平均2.21期
    5: 0.46,  // 平均2.11期
    6: 0.43,  // 平均2.42期
    7: 0.29,  // 平均3.14期（最弱）
    8: 0.42,  // 平均2.19期
    9: 0.36   // 平均2.35期
  };
  
  // 平均出现间隔
  const avgInterval = {
    0: 3.08, 1: 1.97, 2: 2.03, 3: 1.74, 4: 2.21,
    5: 2.11, 6: 2.42, 7: 3.14, 8: 2.19, 9: 2.35
  };
  
  // 预先按行分组
  const ballsByRow = new Map();
  allBalls.filter(b => b.zone === "front").forEach(b => {
    if (!ballsByRow.has(b.row)) ballsByRow.set(b.row, []);
    ballsByRow.get(b.row).push(b.number);
  });
  
  // 计算每个尾号上次出现的距离
  const lastSeen = new Map();
  for (let t = 0; t <= 9; t++) lastSeen.set(t, -1);
  
  for (let r = Math.max(1, sourceRow - 20); r < sourceRow; r++) {
    const nums = [...new Set(ballsByRow.get(r) || [])];
    if (nums.length === 5) {
      const tails = new Set(nums.map(n => n % 10));
      tails.forEach(t => lastSeen.set(t, r));
    }
  }
  
  // 计算周期性分数
  for (let t = 0; t <= 9; t++) {
    const last = lastSeen.get(t);
    if (last < 0) continue;
    
    const distance = sourceRow - last;
    const avg = avgInterval[t];
    const strength = periodicityStrength[t];
    
    // 如果距离接近平均间隔，给予更高分数
    const ratio = distance / avg;
    if (ratio >= 0.8 && ratio <= 1.2) {
      // 在平均间隔附近，高概率出现
      tailScores.set(t, tailScores.get(t) + strength * 10);
    } else if (ratio > 1.2) {
      // 超过平均间隔，出现概率增加
      tailScores.set(t, tailScores.get(t) + strength * 8 * Math.min(ratio, 2));
    }
  }
  
  return [...tailScores.entries()];
}

// ═══ 尾号间隔规律分析 ═══
// 基于发现：尾号1间隔2期后出现概率0.77，尾号8间隔5期后概率1.00
function analyzeTailIntervals(sourceRow, allBalls) {
  const tailScores = new Map();
  for (let t = 0; t <= 9; t++) tailScores.set(t, 0);
  
  // 间隔-概率映射（从分析结果）
  const intervalProbMap = {
    0: { 1: 0.25, 2: 0.44, 3: 0.17, 4: 0.25, 7: 0.33, 8: 0.67 },
    1: { 1: 0.47, 2: 0.77, 3: 0.50, 4: 0.50 },
    2: { 1: 0.43, 2: 0.60, 3: 0.57, 4: 0.00 },
    3: { 1: 0.53, 2: 0.52, 3: 0.67, 5: 0.33 },
    4: { 1: 0.40, 2: 0.20, 3: 0.60, 4: 0.50 },
    5: { 1: 0.42, 2: 0.23, 3: 0.54, 4: 0.60 },
    6: { 1: 0.13, 2: 0.21, 3: 0.62, 4: 0.50, 5: 0.33 },
    7: { 1: 0.33, 2: 0.50, 3: 0.25, 4: 0.33, 6: 0.00, 7: 0.33 },
    8: { 1: 0.38, 2: 0.24, 3: 0.60, 4: 0.50, 5: 1.00 },
    9: { 1: 0.43, 2: 0.36, 3: 0.50, 4: 0.33 }
  };
  
  // 预先按行分组
  const ballsByRow = new Map();
  allBalls.filter(b => b.zone === "front").forEach(b => {
    if (!ballsByRow.has(b.row)) ballsByRow.set(b.row, []);
    ballsByRow.get(b.row).push(b.number);
  });
  
  // 计算每个尾号上次出现的距离
  const lastSeen = new Map();
  for (let t = 0; t <= 9; t++) lastSeen.set(t, -1);
  
  for (let r = Math.max(1, sourceRow - 20); r < sourceRow; r++) {
    const nums = [...new Set(ballsByRow.get(r) || [])];
    if (nums.length === 5) {
      const tails = new Set(nums.map(n => n % 10));
      tails.forEach(t => lastSeen.set(t, r));
    }
  }
  
  // 应用间隔-概率映射
  for (let t = 0; t <= 9; t++) {
    const last = lastSeen.get(t);
    if (last < 0) continue;
    
    const distance = sourceRow - last;
    const probMap = intervalProbMap[t];
    
    if (probMap && probMap[distance]) {
      const prob = probMap[distance];
      tailScores.set(t, tailScores.get(t) + prob * 10);
    }
  }
  
  return [...tailScores.entries()];
}

// ═══ 尾号奇偶大小组合规律分析 ═══
// 基于发现：3奇2偶（20.5%）、2小2大（23.0%）最常见
function analyzeTailOddEvenSizePatterns(sourceRow, allBalls) {
  const tailScores = new Map();
  for (let t = 0; t <= 9; t++) tailScores.set(t, 0);
  
  // 奇偶组合权重
  const oddEvenWeights = {
    '3奇2偶': 0.205,
    '2奇2偶': 0.197,
    '2奇3偶': 0.156,
    '3奇1偶': 0.115,
    '1奇3偶': 0.098,
    '4奇1偶': 0.074,
    '1奇4偶': 0.049,
    '1奇2偶': 0.041,
    '2奇1偶': 0.033
  };
  
  // 大小组合权重
  const sizeWeights = {
    '2小2大': 0.230,
    '2小3大': 0.213,
    '3小2大': 0.148,
    '3小1大': 0.123,
    '4小1大': 0.082,
    '1小3大': 0.057,
    '1小4大': 0.033,
    '1小2大': 0.033,
    '2小1大': 0.033
  };
  
  // 预先按行分组
  const ballsByRow = new Map();
  allBalls.filter(b => b.zone === "front").forEach(b => {
    if (!ballsByRow.has(b.row)) ballsByRow.set(b.row, []);
    ballsByRow.get(b.row).push(b.number);
  });
  
  // 获取前一期的尾号
  if (sourceRow > 0) {
    const prevRow = sourceRow - 1;
    const prevNums = [...new Set(ballsByRow.get(prevRow) || [])];
    
    if (prevNums.length === 5) {
      const prevTails = prevNums.map(n => n % 10);
      const uniqueTails = [...new Set(prevTails)];
      
      // 计算当前奇偶比例
      const oddCount = uniqueTails.filter(t => t % 2 === 1).length;
      const evenCount = uniqueTails.length - oddCount;
      const currentOddEven = `${oddCount}奇${evenCount}偶`;
      
      // 计算当前大小比例
      const smallCount = uniqueTails.filter(t => t <= 4).length;
      const largeCount = uniqueTails.length - smallCount;
      const currentSize = `${smallCount}小${largeCount}大`;
      
      // 根据历史模式预测下期可能出现的尾号
      const lookback = 70;
      const start = Math.max(1, sourceRow - lookback);
      
      const oddEvenTransition = new Map();
      const sizeTransition = new Map();
      
      for (let r = start; r < sourceRow - 1; r++) {
        const srcNums = [...new Set(ballsByRow.get(r) || [])];
        const tgtNums = [...new Set(ballsByRow.get(r + 1) || [])];
        
        if (srcNums.length !== 5 || tgtNums.length !== 5) continue;
        
        const srcTails = [...new Set(srcNums.map(n => n % 10))];
        const tgtTails = [...new Set(tgtNums.map(n => n % 10))];
        
        // 源奇偶比例
        const srcOdd = srcTails.filter(t => t % 2 === 1).length;
        const srcEven = srcTails.length - srcOdd;
        const srcOddEven = `${srcOdd}奇${srcEven}偶`;
        
        // 目标奇偶比例
        const tgtOdd = tgtTails.filter(t => t % 2 === 1).length;
        const tgtEven = tgtTails.length - tgtOdd;
        const tgtOddEven = `${tgtOdd}奇${tgtEven}偶`;
        
        // 记录转换
        const oeKey = `${srcOddEven}→${tgtOddEven}`;
        oddEvenTransition.set(oeKey, (oddEvenTransition.get(oeKey) || 0) + 1);
        
        // 源大小比例
        const srcSmall = srcTails.filter(t => t <= 4).length;
        const srcLarge = srcTails.length - srcSmall;
        const srcSize = `${srcSmall}小${srcLarge}大`;
        
        // 目标大小比例
        const tgtSmall = tgtTails.filter(t => t <= 4).length;
        const tgtLarge = tgtTails.length - tgtSmall;
        const tgtSize = `${tgtSmall}小${tgtLarge}大`;
        
        // 记录转换
        const sizeKey = `${srcSize}→${tgtSize}`;
        sizeTransition.set(sizeKey, (sizeTransition.get(sizeKey) || 0) + 1);
      }
      
      // 预测下期奇偶比例
      const oeKey = `${currentOddEven}→`;
      const possibleOddEven = [];
      oddEvenTransition.forEach((count, key) => {
        if (key.startsWith(oeKey)) {
          const target = key.split('→')[1];
          possibleOddEven.push([target, count]);
        }
      });
      
      // 预测下期大小比例
      const sizeKey = `${currentSize}→`;
      const possibleSizes = [];
      sizeTransition.forEach((count, key) => {
        if (key.startsWith(sizeKey)) {
          const target = key.split('→')[1];
          possibleSizes.push([target, count]);
        }
      });
      
      // 根据预测的奇偶比例调整尾号分数
      if (possibleOddEven.length > 0) {
        const totalOE = possibleOddEven.reduce((sum, [_, c]) => sum + c, 0);
        possibleOddEven.forEach(([pattern, count]) => {
          const prob = count / totalOE;
          const [oddStr, evenStr] = pattern.match(/(\d+)奇(\d+)偶/).slice(1);
          const targetOdd = parseInt(oddStr);
          const targetEven = parseInt(evenStr);
          
          // 为奇数尾号和偶数尾号分配分数
          for (let t = 0; t <= 9; t++) {
            const isOdd = t % 2 === 1;
            if (isOdd && targetOdd > oddCount) {
              tailScores.set(t, tailScores.get(t) + prob * 5);
            } else if (!isOdd && targetEven > evenCount) {
              tailScores.set(t, tailScores.get(t) + prob * 5);
            }
          }
        });
      }
      
      // 根据预测的大小比例调整尾号分数
      if (possibleSizes.length > 0) {
        const totalSize = possibleSizes.reduce((sum, [_, c]) => sum + c, 0);
        possibleSizes.forEach(([pattern, count]) => {
          const prob = count / totalSize;
          const [smallStr, largeStr] = pattern.match(/(\d+)小(\d+)大/).slice(1);
          const targetSmall = parseInt(smallStr);
          const targetLarge = parseInt(largeStr);
          
          // 为小尾号和大尾号分配分数
          for (let t = 0; t <= 9; t++) {
            const isSmall = t <= 4;
            if (isSmall && targetSmall > smallCount) {
              tailScores.set(t, tailScores.get(t) + prob * 5);
            } else if (!isSmall && targetLarge > largeCount) {
              tailScores.set(t, tailScores.get(t) + prob * 5);
            }
          }
        });
      }
    }
  }
  
  return [...tailScores.entries()];
}

module.exports = {
  analyzeTailClustering,
  analyzeTailTransitions,
  analyzeTailPeriodicity,
  analyzeTailIntervals,
  analyzeTailOddEvenSizePatterns
};