# script回测.js — 生成示例详细流程与策略

> 大乐透前区号码预测系统（1-35选5）
> 最后更新：2026-07-04

---

## 一、系统总览

### 1.1 核心目标
从历史开奖数据中，预测下一期大乐透前区5个号码（1-35），输出：
- **Top5组合**：5注各5个号码
- **补漏6**：1注补充号码
- **候选号码池**：约25-30个候选号码

### 1.2 关键指标
| 指标 | 含义 | 当前水平 |
|------|------|----------|
| Top5命中 | 每注命中个数 | 平均~1.0/注 |
| Top5联合覆盖 | 5注联合覆盖目标号码数 | 2.77/5 (55.4%) |
| 补漏6命中 | 补漏6注命中个数 | 平均~0.8/注 |
| 候选池覆盖 | 池中包含目标号码数 | 4.37/5 (87.4%) |

### 1.3 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    回测主循环                              │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 数据源   │→│ 候选池   │→│ 组合生成  │→│ 组合选择  │  │
│  │ (3源融合)│  │ (V4评分) │  │ (V5 6维) │  │ (覆盖优先)│  │
│  └─────────┘  └──────────┘  └──────────┘  └──────────┘  │
│       ↓            ↓             ↓             ↓        │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 尾号预测 │→│ 号码评分 │→│ 组合评分  │→│ Top5+补漏│  │
│  │ (14+信号)│  │ (8维度)  │  │ (全约束) │  │ (6注方案)│  │
│  └─────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 二、数据源与源行选择

### 2.1 历史数据
- 内置开奖数据（`getBuiltInDrawData()`），包含多期大乐透开奖记录
- 每期数据结构：`{ issue, front: [5个号码], back: [2个号码] }`

### 2.2 三源融合配置
预测目标：N+10期，使用3个历史源期的号码：

| 源 | 间隔 | 权重 | 作用 |
|----|------|------|------|
| 主源 | N+9期 (sourceRow) | 0.5 | 最近一期，主要信号来源 |
| 辅源1 | N期 (+0期) | 0.3 | 中期参考，补充信号 |
| 辅源2 | N-1期 (-1期) | 0.2 | 远期参考，多样性 |

### 2.3 源行选择逻辑
```
sourceRow = sourceIdx + SECOND_INTERVAL  // N+9期
secondSourceRow = sourceIdx + THIRD_INTERVAL  // N期
thirdSourceRow = sourceIdx + FOURTH_INTERVAL  // N-1期
```

---

## 三、候选池构建（buildSampleNumbersV4）

### 3.1 入口
`buildSampleNumbersV4(selectedRow, zone, ratios, _preCollected)` — line 7220

### 3.2 前置预测模块

#### 3.2.1 尾号预测（predictLikelyTailsV4Enhanced）
输入：源行号码尾号集合 + 转移概率数据
输出：10个尾号按得分排序的预测列表

**14+信号权重体系**：

| 信号 | 权重 | 含义 |
|------|------|------|
| sameOrNeighbor | 35 | 核心：85.6%号码尾号与上期相同或相邻 |
| crossRowArithmetic | 24 | 跨行等差：上期与当前期号码的等差延伸 |
| globalFreq | 20 | 全局尾号频率（70期lookback） |
| intraGroupPattern | 18 | 组内尾号规则：历史尾号组合模式 |
| crossRowTail | 15 | 跨行尾号：与前2-3期尾号重复 |
| bridgeTails | 12 | 桥接尾号：两个尾号之间的中间尾号 |
| partialMatch | 10 | 部分匹配：组合转移模式的部分匹配 |
| arithmeticNumber | 10 | 完整号码等差：1-35的等差延伸 |
| arith1 | 8 | 等差延伸（近1期） |
| highFreqMiss | 8 | 高频尾号遗漏补偿 |
| overlap1 | 6 | 重叠尾号（近1期） |
| comboTransfer | 2 | 尾号组合转移模式 |
| overlap10 | 2 | 重叠尾号（近10期） |
| overlapBonus | 2 | 双重保留奖励 |

#### 3.2.2 区间比预测（predictTargetIntervalRatio）
基于历史转移+时效加权，预测目标期的三区分布比

#### 3.2.3 首位球综合预测（predictFirstBallComprehensive）
融合5种回测规律：±3范围、±1相邻、+9期、等差延伸、尾号转移

#### 3.2.4 分区间独立方向预测（predictZoneDirections）
拆分一区/二区/三区独立分析方向

### 3.3 号码评分体系（1-35逐一评分）

对每个号码n（1-35），计算综合得分：

#### 维度1：偏移评分（V4_OFFSET_SCORE）
与源行号码的最小距离：

| 距离 | 得分 | 含义 |
|------|------|------|
| 0 | 20 | 锚点直接命中（最强信号） |
| 1 | 15 | 紧邻号码 |
| 2 | 13 | 近距离 |
| 3 | 12 | 较近距离 |
| 4 | 10 | 中距离 |
| 5 | 8 | 中距离 |
| 6 | 6 | 较远距离 |
| 7 | 5 | 远距离 |
| 8 | 4 | 远距离 |
| 9 | 3 | 极远距离 |
| 10 | 2 | 边缘距离 |

#### 维度2：尾号关联
优先级：predictedTails匹配 > 邻号 > sourceTails

| 匹配类型 | 得分 |
|----------|------|
| 预测尾号Top5直接匹配 | 35 (V4_TAIL_SAME) |
| 预测尾号邻号(±1) | 20 (V4_TAIL_NEIGHBOR) |
| 预测尾号次邻号(±2) | 10 (V4_TAIL_NEIGHBOR2) |
| 源行尾号匹配 | 8 (V4_TAIL_WITHIN) |

**区间稳定加成**：当近5期区间比稳定(≥40%相同)时，尾号匹配额外+10分

#### 维度3：尾号关联性加分
基于历史尾号对和三元组的关联频率

#### 维度4：+10期趋势（S1）
与源行间隔10期的号码出现规律，最大30分

#### 维度5：桥梁评分（S2）
- 桥梁间隔：两个源号码之间的中间号码，最大15分
- 桥梁端点：等差延伸的端点号码，最大8分

#### 维度6：等距评分（S3）
等差数列延伸的端点号码，最大10分

#### 维度7：热号评分
近5期出现频率：
| 出现次数 | 得分 |
|----------|------|
| ≥4次 | +10 |
| 3次 | +7 |
| 2次 | +4 |
| 0次 | -2 |

#### 维度8：极端期加成
- 窄区间(跨度≤12)：远距离号码+4
- 和值突变(差>30)：远距离号码+5
- 奇偶翻转(变化≥4)：异奇偶号码+3

#### 维度9：连号附近奖励
靠近源行连号区域的号码+7

#### 维度10：区间平衡奖励
如果该区间低于预测比例，+3分

#### 维度11：奇偶平衡奖励
如果需要调整奇偶比，相应奇偶+2分

#### 维度12：和值贡献奖励
根据目标和值差异选择大/小号码+2分

#### 维度13：历史频率评分
- 历史频率>1.2倍均值：最高+2.25分
- 近期频率>1.3倍均值：最高+1.5分
- 重复率>1.2倍均值：最高+0.6分

#### 维度14：首位球预测加分
在1-15范围内，根据首位球综合预测排名加分

### 3.4 候选池构建策略

**当前模式**：`USE_TAIL_ONLY_POOL = true`（尾号驱动模式）

构建步骤：

```
步骤1: 尾号预测驱动入池
  - 取预测Top5尾号 + 各±1邻号 → 约8个尾号
  - 所有匹配这些尾号的号码(1-35中)入池

步骤2: 源号码保底入池
  - 源行的5个号码本身入池（确保不遗漏）

步骤3: 区间保底补齐
  - 按分数排序，补齐缺失区间至minIv[z]个

步骤4: 按分数补齐到25个
  - 按评分从高到低，补齐池至25个号码
```

### 3.5 输出结构
```javascript
{
  startRow, endRow,              // 源窗口范围
  selectedNumbers,               // 源行号码(5个)
  predictedTails,                // 预测尾号(10个)
  ivPrediction,                  // 区间比预测
  zoneDirections,                // 分区间方向预测
  extremeFlags,                  // 极端期标志
  candidates: [25个号码],         // 候选池
  candidateEntries: [25个对象],   // 候选池详细信息(含分数)
  numbers: [Top5号码],            // 候选池前5个
  referenceRows: [参考行号],      // S5增强参考行
}
```

---

## 四、组合生成（buildSampleFrontCombosV5）

### 4.1 入口
`buildSampleFrontCombosV5(entries, refs, anchorNumbers, selectedNumbers, predictTails, ivPrediction, firstBallPredictions, extremeFlags, manualRatio, sourceRow, _preCollected)` — line 8780

### 4.2 六维度独立评分

对1-35每个号码在6个维度独立评分并归一化到0-100：

| 维度 | 生成数(count) | 候选池(maxPool) | 评分依据 |
|------|--------------|-----------------|----------|
| 尾号(dimTail) | 4 | 10 | 预测尾号匹配(+35)、邻号(+15)、源尾号(+8) |
| 偏移(dimOff) | 2 | 10 | V4_OFFSET_SCORE距离表 |
| 热号(dimHot) | 2 | 10 | 近5期出现频率 |
| 频率+邻号(dimFreq) | 3 | 10 | 历史频率、近期频率、邻号奖励 |
| 桥接(dimBr) | 2 | 10 | 桥梁间隔+端点评分 |
| 等差(dimAr) | 3 | 10 | 等差数列延伸评分 |

**总生成目标**：4+2+2+3+2+3 = **16注**

### 4.3 加权随机抽取（v5GenCombosRandom）

每个维度独立生成组合：

```
输入：dimPool(评分排序的号码), count(目标数量), maxPool(候选池大小)
流程：
  1. 取前maxPool个高分号码作为候选
  2. 循环count*100次尝试：
     a. 加权随机抽取5个号码（weightPower=0.5）
     b. 过滤条件：
        - 5个号码互不相同
        - 奇偶比不全奇/全偶
        - 跨度14-32
        - 单区间最多3个
        - 最长连续段≤3
        - 密集度检查（间距≤2的对≤2，间距≤1的对≤1）
     c. 组合级完整评分（13个子评分）
  3. 多样性选择：已选组合重叠<4个号码
  4. 返回最多count个组合
```

### 4.4 组合级完整评分（v5GenCombosRandom内）

每个生成的组合计算综合得分：

| 子评分 | 权重 | 含义 |
|--------|------|------|
| tailMatches | sampleRuleWeight+2 | 尾号匹配（含邻号） |
| tailArithmetic | sampleRuleWeight | 尾号等差模式 |
| tailSupport | sampleRuleWeight | 尾号支持度 |
| bridgeGapHits | sampleRuleWeight | 桥梁间隔命中 |
| bridgeEndpointHits | sampleRuleWeight | 桥梁端点命中 |
| arithmeticEndpointHits | sampleRuleWeight | 等差端点命中 |
| selectedOverlap | sampleRuleWeight | 与源行重叠 |
| selectedNeighborHits | sampleRuleWeight | 与源行相邻 |
| consecutivePairs | sampleRuleWeight | 连续对 |
| longestRun | sampleRuleWeight | 最长连续段 |
| consecutiveSegments(2) | sampleRuleWeight | 2连续段数 |
| lastRowOverlap | sampleRuleWeight | 与上期重叠 |
| lastRowNeighborHits | sampleRuleWeight | 与上期相邻 |
| repeatSupport | sampleRuleWeight | 重复支持 |
| crossAP | 10 | 跨期等差关系 |

其中 `sampleSignalLevel(value, cap) = min(cap, max(0, value))`，`sampleRuleWeight = 8`

### 4.5 补充生成
如果allCombos不足8注，从综合池中补充生成至8注

### 4.6 组合级智能重评分（v5RescoreCombos）
对所有组合进行更精细的评分，考虑：
- 区间比偏差
- 和值范围
- 奇偶比
- 跨度
- 尾号模式
- 首位球
- 锚点保留
- 扩散约束

### 4.7 跨维度去重
重叠≥3个号码的组合被过滤，最终保留最多**20注**

---

## 五、组合选择（selectCoverageOptimalCombos）

### 5.1 入口
`selectCoverageOptimalCombos(allCombos, poolNumbers, n, tailRelationData)` — line 9157

### 5.2 选择策略：覆盖优先

```
输入：allCombos(所有候选组合), poolNumbers(候选池号码), n=5(选5注)
流程：
  1. Top1 = 最高分组合
  2. 循环选择第2-5注：
     a. 计算当前已覆盖的池号码
     b. 对每个候选组合计算：
        - newCoverage = 该组合新增覆盖的池号码个数
        - tailRelationBonus = 尾号关系加分
        - combined = newCoverage × 50 + score + tailRelationBonus
     c. 选择combined最高的组合
  3. 返回5注组合
```

### 5.3 尾号关系加分（tailRelationBonus）

| 子项 | 加分规则 |
|------|----------|
| 预测尾号匹配 | 匹配+10，邻号+5 |
| 源尾号匹配 | +8/尾号 |
| 前一期尾号 | 相同+6，相邻+3 |
| 组合内连续尾号 | 2连+2，3连+4，4连+6 |
| 组合内等差尾号 | +4 |
| 跨期连续关系 | ≥4相同+5，≥2相同+3 |
| 跨期等差关系 | ≥3+4，≥2+2 |
| 区间分布相似度 | ≥0.7+4，≥0.5+2 |
| 奇偶分布相似度 | ≥0.8+3，≥0.6+1 |
| 时序变化模式 | 根据历史频率+1~5 |

---

## 六、补漏6生成

### 6.1 策略
从候选池中选择Top5未覆盖的号码，评分依据：
- 候选池原始分数
- 预测尾号匹配(+5)
- 区间平衡(+6，补齐最少区间)
- Top5频率(出现≥3次+30)

取前5个最高分号码组成补漏6

---

## 七、后区生成

### 7.1 策略
- 使用 `buildSampleNumbers` 生成后区候选
- `buildSampleFreeCombos` 生成自由组合
- `generateBackBridgeCombos` 生成桥接组合
- 桥接组合优先，自由组合补充

---

## 八、回测主循环

### 8.1 循环结构
```javascript
for (sourceIdx = 1; sourceIdx <= totalDraws - PREDICT_INTERVAL - 1; sourceIdx++) {
  targetIdx = sourceIdx + PREDICT_INTERVAL;  // N+10期
  // ... 生成管线
}
```

### 8.2 每期执行流程

```
1. 获取3个源行数据
2. 3个源各自独立生成候选池 (buildSampleNumbersV4)
3. 计算区间比预测 (使用主源)
4. 3个源各自独立生成组合 (buildSampleFrontCombosV5)
5. 组合阶段融合：合并所有组合，按加权分数排序
6. 候选池融合：加权合并Top30
7. 尾号融合：加权合并尾号预测
8. 覆盖优先策略选择Top5 (selectCoverageOptimalCombos)
9. 生成完整方案（Top5前区+后区）
10. 生成补漏6
11. 计算命中指标
```

### 8.3 指标计算
- **Top5命中**：每注与目标号码的交集个数
- **Top5联合覆盖**：5注号码集合并集与目标号码的交集个数
- **补漏6命中**：补漏6注与目标号码的交集个数
- **候选池覆盖**：候选池与目标号码的交集个数

---

## 九、关键常量配置

| 常量 | 值 | 含义 |
|------|-----|------|
| sampleRuleWeight | 8 | 规则权重 |
| sampleWeakRuleWeight | 4 | 弱规则权重 |
| V4_POOL_SIZE | 30 | 候选池大小上限 |
| MIN_POOL_SIZE | 25 | 候选池最小大小 |
| samplePickCount | 5 | 前区选号数 |
| sampleBackPickCount | 2 | 后区选号数 |
| PREDICT_INTERVAL | 10 | 预测间隔 |
| SECOND_INTERVAL | 9 | 第二间隔 |
| weights | [0.5, 0.3, 0.2] | 3源融合权重 |

---

## 十、数据流图

```
历史开奖数据
    │
    ├──→ 源行N+9 ──→ buildSampleNumbersV4 ──→ 候选池1(25个) ──→ buildSampleFrontCombosV5 ──→ 组合1(~16注)
    │                                              │
    ├──→ 源行N   ──→ buildSampleNumbersV4 ──→ 候选池2(25个) ──→ buildSampleFrontCombosV5 ──→ 组合2(~16注)
    │                                              │
    └──→ 源行N-1 ──→ buildSampleNumbersV4 ──→ 候选池3(25个) ──→ buildSampleFrontCombosV5 ──→ 组合3(~16注)
                                                          │
                                                    ┌─────┴─────┐
                                                    │ 加权融合    │
                                                    │ (0.5/0.3/0.2)│
                                                    └─────┬─────┘
                                                          │
                                                    ┌─────┴─────┐
                                                    │ allCombos   │
                                                    │ (~48注)     │
                                                    └─────┬─────┘
                                                          │
                                                    ┌─────┴─────┐
                                                    │ selectCoverage│
                                                    │ OptimalCombos │
                                                    └─────┬─────┘
                                                          │
                                                    ┌─────┴─────┐
                                                    │ Top5组合    │
                                                    │ + 补漏6     │
                                                    └───────────┘
```

---

## 十一、当前已知问题

### 11.1 Top5联合覆盖偏低 (55.4%)
- 候选池覆盖率87.4%，但Top5组合只覆盖55.4%
- 根因：组合选择算法只优化池覆盖率，不优化尾号多样性
- 候选池25个号码可能只覆盖5-6个尾号

### 11.2 组合过多且相似
- 每个源生成~16注，3源融合后~48注
- 最终只选5注，大量计算浪费
- 6个维度都从同一25号码池中抽，组合高度相似

### 11.3 尾号预测过度集中
- sameOrNeighbor权重(35)过高
- 约14.4%的"far"尾号在候选池中被低估
