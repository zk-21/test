# 尾号模式 vs 普通模式详细对比

## 1. 触发条件

### 尾号模式
```javascript
const tailPool = getTailFilteredPool();
if (tailPool.length >= 5) {
  // 进入尾号模式
}
```
- **条件**：用户选择了尾号，且候选池号码数 ≥ 5
- **候选池**：`getTailFilteredPool()` 从1-35中筛选尾号符合的号码
- **示例**：选择尾号1,3,5 → 候选池包含1,3,5,11,13,15,21,23,25,31,33,35（12个号码）

### 普通模式
```javascript
// 未选尾号或尾号池 < 5
const frontSample = version === "v4"
  ? buildSampleNumbersV4(sourceStartRow, "front", ratioPlan)
  : buildSampleNumbers(sourceStartRow, "front", ratioPlan);
```
- **条件**：未选择尾号，或尾号候选池 < 5
- **候选池**：基于历史数据评分生成（v3或v4算法）
- **候选池大小**：v4固定24个号码（V4_POOL_SIZE）

---

## 2. 候选池构建

### 尾号模式候选池
```javascript
function getTailFilteredPool() {
  if (selectedTails.size === 0) return [];
  const pool = [];
  for (let n = 1; n <= 35; n++) {
    if (selectedTails.has(n % 10)) pool.push(n);
  }
  return pool;
}
```
- **筛选逻辑**：简单尾号匹配
- **候选池大小**：10-35个（取决于选择的尾号数量）
- **评分**：无评分（score=0）
- **特点**：精准但可能遗漏高频号码

### 普通模式候选池（v3）
```javascript
function buildSampleNumbers(selectedRow, zone = "front", ratios = []) {
  // 1. 收集历史数据中的球
  // 2. 计算各种评分指标
  // 3. 生成候选号码及其分数
}
```
- **筛选逻辑**：基于历史数据的多维度评分
- **候选池大小**：不确定（取决于评分结果）
- **评分维度**：
  1. 重复次数（repeatCount）
  2. 尾号命中（tailCount）
  3. 参考行匹配（selectedRowHits, supportHits, lastRowHits）
  4. 尾号模式（tailPatternScore）
  5. 桥梁端点（bridgeEndpointHits）
  6. 等距端点（arithmeticEndpointHits）
  7. 上色区域（upperColorHits）
- **特点**：基于历史数据，覆盖更广

### 普通模式候选池（v4）
```javascript
function buildSampleNumbersV4(selectedRow, zone, ratios) {
  // 1. 收集历史数据
  // 2. 预测尾号、区间比、奇偶比、和值
  // 3. 计算多维度评分
  // 4. 生成候选池（固定24个）
}
```
- **筛选逻辑**：预测+历史数据的多维度评分
- **候选池大小**：固定24个（V4_POOL_SIZE）
- **评分维度**（在v3基础上增加）：
  1. 尾号预测（predictedTails）
  2. 区间比预测（ivPrediction）
  3. 奇偶预测（targetOdd）
  4. 和值预测（targetSum）
  5. +10期趋势（plusTenTrend）
  6. 桥梁结构（bridgeMap）
  7. 等距结构（arithMap）
  8. 热号分析（hotness）
  9. 极端期检测（extremeFlags）
  10. 历史频率（historyMetrics）
  11. 区间平衡奖励
  12. 奇偶平衡奖励
  13. 和值贡献奖励
- **特点**：预测+历史数据，最精准

---

## 3. 前区组合生成

### 尾号模式
```javascript
const tailEntries = tailPool.map(number => ({ number, score: 0 }));
let tailCombos = [];
if (ratioPlan.length > 0 && ratioPlan[0] && ratioPlan[0].length === 3) {
  tailCombos = buildSampleFrontCombos(tailEntries, ratioPlan, ...);
} else {
  tailCombos = buildSampleFrontCombos(tailEntries, [], ...);
}
```
- **输入**：尾号候选池（score=0）
- **评分系统**：`buildSampleFrontCombos` 标准评分
- **区间比支持**：严格按选择的区间比生成
- **组合数量**：生成多个组合，按评分排序
- **选择方式**：循环使用（`i % tailCombos.length`）

### 普通模式（v3）
```javascript
const frontCombos = buildSampleFrontCombos(
  frontSample.candidateEntries, 
  ratioPlan, 
  samplePickCount, 
  sampleIntervals, 
  frontSample.ratioSupportMap, 
  frontSample.referenceRows, 
  frontRepeatTarget, 
  frontSample.selectedNumbers, 
  frontSample.selectedNumbers
);
```
- **输入**：带评分的历史候选池
- **评分系统**：`buildSampleFrontCombos` 标准评分
- **区间比支持**：严格按选择的区间比生成
- **组合数量**：生成多个组合，按评分排序
- **选择方式**：根据显示模式（单组/变体）

### 普通模式（v4）
```javascript
const frontCombos = buildSampleFrontCombosV4(
  frontSample.candidateEntries, 
  v4Refs, 
  frontSample.selectedNumbers, 
  frontSample.selectedNumbers, 
  frontSample.predictedTails, 
  frontSample.ivPrediction
);
```
- **输入**：带评分的历史候选池（包含预测信息）
- **评分系统**：`buildSampleFrontCombosV4` 增强评分
- **区间比支持**：严格按选择的区间比生成
- **组合数量**：生成多个组合，按评分排序
- **选择方式**：覆盖优先策略

---

## 4. 后区组合生成

### 尾号模式
```javascript
const backSample = buildSampleNumbers(requestedRow, "back");
const backCombos = buildSampleFreeCombos(
  backSample.candidateEntries, 
  sampleBackPickCount, 
  backRepeatTarget, 
  backSample.selectedNumbers
);
```
- **候选池**：基于历史蓝球数据（1-12）
- **评分系统**：与v3前区相同
- **选择方式**：随机选择一个后区组合
- **特点**：不受尾号限制，使用原始逻辑

### 普通模式（v3/v4）
```javascript
const backSample = buildSampleNumbers(sourceStartRow, "back");
const backCombos = buildSampleFreeCombos(
  backSample.candidateEntries, 
  sampleBackPickCount, 
  backRepeatTarget, 
  backSample.selectedNumbers
);
```
- **候选池**：基于历史蓝球数据（1-12）
- **评分系统**：与v3前区相同
- **选择方式**：根据显示模式选择
- **特点**：与尾号模式相同

---

## 5. 组合选择策略

### 尾号模式
```javascript
for (let i = 0; i < 5; i++) {
  if (tailCombos.length > 0) {
    const comboIndex = i % tailCombos.length;
    const selectedCombo = tailCombos[comboIndex];
    combo = selectedCombo.numbers.slice(0, 5).sort((a, b) => a - b);
  } else {
    // 回退到随机选择
    const shuffled = [...tailPool].sort(() => Math.random() - 0.5);
    combo = shuffled.slice(0, 5).sort((a, b) => a - b);
  }
}
```
- **策略**：循环使用评分最高的组合
- **多样性**：通过循环增加多样性
- **回退机制**：如果没有组合，随机选择

### 普通模式（v3单组）
```javascript
const variantPlan = buildSingleSamplePlan(
  frontCombos, 
  backCombos, 
  ratioPlan, 
  sampleRotationCursor
);
```
- **策略**：从评分最高的组合中循环选择5行
- **多样性**：通过`rotationCursor`增加多样性
- **输出**：5行相同的"第1行"到"第5行"

### 普通模式（v3变体）
```javascript
const variantPlan = buildSampleVariantPlan(
  frontCombos, 
  backCombos, 
  sampleRotationCursor
);
```
- **策略**：5种不同策略选择
  1. **最优**：最高分组合
  2. **次优**：次高分组合
  3. **备选**：第三高分组合
  4. **轮换**：最高分中轮换选择
  5. **随机**：前5名中随机选择
- **多样性**：不同策略增加多样性
- **输出**：5行不同策略的组合

### 普通模式（v4单组）
```javascript
const variantPlan = buildV4SingleSamplePlan(
  frontCombos, 
  backCombos, 
  poolNumbers, 
  frontSample.candidateEntries, 
  frontSample.predictedTails
);
```
- **策略**：覆盖优先策略
  1. Top1：选择最高分组合
  2. Top2-5：贪心选择覆盖最多未覆盖候选池号码的组合
- **多样性**：通过覆盖优化增加多样性
- **输出**：5行主组合 + 1行补漏6

---

## 6. 补漏机制

### 尾号模式补漏6
```javascript
const c6Scored = tailPool
  .filter(n => !top5Covered.has(n) || (top5Freq.get(n) || 0) >= 1)
  .map(n => {
    let s6 = 0;
    if (!top5Covered.has(n)) s6 += 30; // 未覆盖加分
    if (freq >= 3) s6 += 25; // 频率加分
    // 邻近加分...
    return { number: n, score6: s6 };
  });
```
- **评分维度**：
  1. 未覆盖加分（+30）
  2. 频率加分（+10/+15/+25）
  3. 邻近加分（+3/+6/+12）
- **候选池**：尾号候选池
- **目标**：补充未覆盖的高频号码

### 普通模式补漏6（v4）
```javascript
const c6Scored = candidateEntries
  .filter(e => !top5Covered.has(e.number) || (top5Freq.get(e.number) || 0) >= 1)
  .map(e => {
    let s6 = e.score || 0;
    if (predTails6.has(n % 10)) s6 += 10; // 尾号匹配
    if (zone === top5IvMinIdx) s6 += 6; // 区间平衡
    if (freq >= 3) s6 += 30; // 频率加分
    // 邻近加分...
    return { number: n, score6: s6 };
  });
```
- **评分维度**：
  1. 候选号码基础分数
  2. 尾号匹配（+10）
  3. 区间平衡（+6）
  4. 频率加分（+15/+25/+30）
  5. 邻近加分（+3/+6/+12）
- **候选池**：v4候选池（24个）
- **目标**：补充未覆盖的高频号码，优化结构

### 普通模式补漏6（v3）
- **无补漏机制**

---

## 7. 显示输出

### 尾号模式输出
```
行1: 尾号组合1 (5个前区号码 + 2个后区号码)
行2: 尾号组合2 (5个前区号码 + 2个后区号码)
行3: 尾号组合3 (5个前区号码 + 2个后区号码)
行4: 尾号组合4 (5个前区号码 + 2个后区号码)
行5: 尾号组合5 (5个前区号码 + 2个后区号码)
行6: 补漏6 (5个前区号码)
行7: 候选池 (所有尾号候选号码)
```
- **总行数**：7行
- **标签**：尾号组合1-5, 补漏6, 候选池
- **候选池显示**：显示完整尾号候选池

### 普通模式输出（v3单组）
```
行1: 第1行 (5个前区号码 + 2个后区号码)
行2: 第2行 (5个前区号码 + 2个后区号码)
行3: 第3行 (5个前区号码 + 2个后区号码)
行4: 第4行 (5个前区号码 + 2个后区号码)
行5: 第5行 (5个前区号码 + 2个后区号码)
```
- **总行数**：5行
- **标签**：第1行-第5行
- **候选池显示**：无

### 普通模式输出（v3变体）
```
行1: 最优候选 (5个前区号码 + 2个后区号码)
行2: 次优候选 (5个前区号码 + 2个后区号码)
行3: 备选候选 (5个前区号码 + 2个后区号码)
行4: 轮换候选 (5个前区号码 + 2个后区号码)
行5: 随机候选 (5个前区号码 + 2个后区号码)
```
- **总行数**：5行
- **标签**：最优/次优/备选/轮换/随机候选
- **候选池显示**：无

### 普通模式输出（v4单组）
```
行1: 第1行 (5个前区号码 + 2个后区号码)
行2: 第2行 (5个前区号码 + 2个后区号码)
行3: 第3行 (5个前区号码 + 2个后区号码)
行4: 第4行 (5个前区号码 + 2个后区号码)
行5: 第5行 (5个前区号码 + 2个后区号码)
行6: 补漏6 (5个前区号码)
行31: 候选池 (v4候选池24个号码)
```
- **总行数**：6行 + 候选池显示
- **标签**：第1行-第5行, 补漏6, 候选池
- **候选池显示**：在第31行显示v4候选池

---

## 8. 关键差异总结

| 方面 | 尾号模式 | 普通模式（v3） | 普通模式（v4） |
|------|----------|----------------|----------------|
| **触发条件** | 选择尾号且池≥5 | 未选尾号或池<5 | 未选尾号或池<5 |
| **候选池来源** | 尾号筛选 | 历史数据评分 | 预测+历史数据评分 |
| **候选池大小** | 10-35个 | 不确定 | 固定24个 |
| **候选池评分** | 无（score=0） | 多维度评分 | 多维度评分+预测 |
| **前区组合生成** | buildSampleFrontCombos | buildSampleFrontCombos | buildSampleFrontCombosV4 |
| **后区组合生成** | 原始逻辑 | 原始逻辑 | 原始逻辑 |
| **组合选择策略** | 循环使用 | 循环使用/变体策略 | 覆盖优先策略 |
| **补漏机制** | 补漏6（简单） | 无 | 补漏6（复杂） |
| **输出行数** | 7行 | 5行 | 6行+候选池 |
| **候选池显示** | 第7行 | 无 | 第31行 |
| **区间比支持** | 支持 | 支持 | 支持 |
| **尾号限制** | 前区受限制 | 不受限制 | 不受限制 |
| **后区限制** | 不受限制 | 不受限制 | 不受限制 |

---

## 9. 优缺点分析

### 尾号模式
**优点**：
1. **精准筛选**：基于尾号筛选，候选池更精准
2. **覆盖率高**：候选池小，更容易覆盖
3. **用户控制**：用户可以选择特定尾号
4. **补漏优化**：有补漏6机制

**缺点**：
1. **无评分基础**：候选池score=0，依赖组合评分
2. **可能遗漏**：可能遗漏非尾号的高频号码
3. **候选池不稳定**：候选池大小取决于尾号数量

### 普通模式（v3）
**优点**：
1. **基于历史数据**：评分基于历史数据，更可靠
2. **覆盖更广**：候选池可能包含更多高频号码
3. **变体模式**：支持多种策略选择

**缺点**：
1. **无补漏机制**：v3无补漏6
2. **无预测**：无预测尾号、区间比等
3. **候选池不确定**：候选池大小不固定

### 普通模式（v4）
**优点**：
1. **预测+历史**：结合预测和历史数据，最精准
2. **覆盖优先**：覆盖优先策略，覆盖率高
3. **补漏优化**：有复杂的补漏6机制
4. **候选池固定**：候选池固定24个，稳定

**缺点**：
1. **算法复杂**：算法复杂，可能过拟合
2. **无尾号筛选**：无法基于尾号筛选
3. **计算量大**：计算量较大

---

## 10. 使用场景建议

### 选择尾号模式的场景：
1. **有明确尾号偏好**：用户对特定尾号有信心
2. **追求精准**：希望候选池更精准
3. **追求覆盖率**：希望候选池更小，覆盖率更高
4. **快速生成**：希望快速生成组合

### 选择普通模式（v3）的场景：
1. **无尾号偏好**：用户对尾号无特殊偏好
2. **追求稳定**：希望基于历史数据的稳定算法
3. **需要变体**：需要多种策略选择

### 选择普通模式（v4）的场景：
1. **追求最高命中率**：希望结合预测和历史数据
2. **追求覆盖率**：希望覆盖优先策略
3. **接受复杂算法**：接受算法复杂度

---

## 11. 命中率与覆盖率对比

### 命中率（理论）：
1. **尾号模式**：中等（基于尾号筛选，但无评分基础）
2. **普通模式（v3）**：中等（基于历史数据评分）
3. **普通模式（v4）**：**最高**（预测+历史数据，最精准）

### 覆盖率（理论）：
1. **尾号模式**：**最高**（候选池小，容易覆盖）
2. **普通模式（v3）**：中等（候选池不确定）
3. **普通模式（v4）**：高（固定24个候选池，覆盖优先策略）

### 稳定性：
1. **尾号模式**：中等（候选池大小不稳定）
2. **普通模式（v3）**：**最高**（算法简单，稳定）
3. **普通模式（v4）**：中等（算法复杂，可能过拟合）

---

**文档生成时间**：2026年6月28日 21:54
**基于代码版本**：script.js 行6694-6912及相关函数