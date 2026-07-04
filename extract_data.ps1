$bytes = [System.IO.File]::ReadAllBytes('backtest_cross_row_full.txt')
$text = [System.Text.Encoding]::Unicode.GetString($bytes)
$lines = $text -split "`n"

$results = @()
$currentPeriod = 0
$targetNums = @()

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    
    # Period header
    if ($line -match '绗\??(\d+)\s+鏈') {
        $currentPeriod = [int]$Matches[1]
    }
    
    # Target numbers
    if ($line -match '\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]' -and $line -match '鍙风爜') {
        $targetNums = @([int]$Matches[1], [int]$Matches[2], [int]$Matches[3], [int]$Matches[4], [int]$Matches[5])
    }
    
    # Top5 hit line (contains Top1 through Top5 and 补漏6)
    if ($line -match 'Top1' -and $line -match 'Top5' -and $line -match '鍛戒腑') {
        $hits = @()
        $regex = [regex]::Matches($line, '鍛戒腑\s*(\d+)')
        foreach ($m in $regex) {
            $hits += [int]$m.Groups[1].Value
        }
        
        if ($hits.Count -ge 6) {
            $obj = [PSCustomObject]@{
                Period = $currentPeriod
                Target = ($targetNums -join ' ')
                Top1 = $hits[0]
                Top2 = $hits[1]
                Top3 = $hits[2]
                Top4 = $hits[3]
                Top5 = $hits[4]
                Bulou = $hits[5]
                Top5Union = 0
                Top5BulouUnion = 0
                PoolCover = 0
            }
            $results += $obj
        }
    }
    
    # Top5 union coverage
    if ($line -match 'Top5\s+鑱斿悎瑕嗙洊:\s+(\d+)' -and $line -notmatch '琛ユ紡6') {
        if ($results.Count -gt 0) {
            $results[-1].Top5Union = [int]$Matches[1]
        }
    }
    
    # Top5+补漏6 union coverage
    if ($line -match 'Top5\+琛ユ紡6\s+鑱斿悎瑕嗙洊:\s+(\d+)') {
        if ($results.Count -gt 0) {
            $results[-1].Top5BulouUnion = [int]$Matches[1]
        }
    }
    
    # Pool coverage
    if ($line -match '瑕嗙洊:\s+(\d+)\s*/\s*5' -and $line -match '鍊欓€夋睜') {
        if ($results.Count -gt 0) {
            $results[-1].PoolCover = [int]$Matches[1]
        }
    }
}

Write-Host "Parsed $($results.Count) periods"

# Output CSV
$csv = "期数,目标号码,Top1命中,Top2命中,Top3命中,Top4命中,Top5命中,补漏6命中,Top5联合覆盖,Top5+补漏6联合覆盖,候选池覆盖"
foreach ($r in $results) {
    $csv += "`n$($r.Period),`"$($r.Target)`",$($r.Top1),$($r.Top2),$($r.Top3),$($r.Top4),$($r.Top5),$($r.Bulou),$($r.Top5Union),$($r.Top5BulouUnion),$($r.PoolCover)"
}
[System.IO.File]::WriteAllText('per_period_detail.csv', $csv, [System.Text.Encoding]::UTF8)
Write-Host "Saved to per_period_detail.csv"

# Summary
$n = $results.Count
if ($n -gt 0) {
    $top1Avg = ($results | Measure-Object -Property Top1 -Average).Average
    $top2Avg = ($results | Measure-Object -Property Top2 -Average).Average
    $top3Avg = ($results | Measure-Object -Property Top3 -Average).Average
    $top4Avg = ($results | Measure-Object -Property Top4 -Average).Average
    $top5Avg = ($results | Measure-Object -Property Top5 -Average).Average
    $bulouAvg = ($results | Measure-Object -Property Bulou -Average).Average
    
    Write-Host "`n========== 汇总统计 (${n}期) =========="
    Write-Host "Top1 平均命中: $([math]::Round($top1Avg, 2))"
    Write-Host "Top2 平均命中: $([math]::Round($top2Avg, 2))"
    Write-Host "Top3 平均命中: $([math]::Round($top3Avg, 2))"
    Write-Host "Top4 平均命中: $([math]::Round($top4Avg, 2))"
    Write-Host "Top5 平均命中: $([math]::Round($top5Avg, 2))"
    Write-Host "补漏6 平均命中: $([math]::Round($bulouAvg, 2))"
    
    # Best per period
    $bestPerPeriod = $results | ForEach-Object { [math]::Max([math]::Max([math]::Max([math]::Max($_.Top1, $_.Top2), $_.Top3), $_.Top4), $_.Top5) }
    $bestAvg = ($bestPerPeriod | Measure-Object -Average).Average
    Write-Host "`nTop5 每期最高命中平均: $([math]::Round($bestAvg, 2))"
    
    # Distribution
    Write-Host "`nTop5 最高命中分布:"
    for ($h = 0; $h -le 5; $h++) {
        $count = ($bestPerPeriod | Where-Object { $_ -eq $h }).Count
        $pct = [math]::Round($count / $n * 100, 1)
        Write-Host "  命中${h}个: ${count}次 (${pct}%)"
    }
    
    $top5UnionAvg = ($results | Measure-Object -Property Top5Union -Average).Average
    $top5BulouUnionAvg = ($results | Measure-Object -Property Top5BulouUnion -Average).Average
    $poolCoverAvg = ($results | Measure-Object -Property PoolCover -Average).Average
    
    Write-Host "`nTop5 联合覆盖平均: $([math]::Round($top5UnionAvg, 2))"
    Write-Host "Top5+补漏6 联合覆盖平均: $([math]::Round($top5BulouUnionAvg, 2))"
    Write-Host "候选池覆盖平均: $([math]::Round($poolCoverAvg, 2))"
    
    # Show all periods detail
    Write-Host "`n========== 全部期数详情 =========="
    Write-Host "期数  | 目标号码        | T1 T2 T3 T4 T5 | 漏6 | T5联 | T5+漏联 | 池覆盖"
    Write-Host ("-" * 80)
    foreach ($r in $results) {
        $t = ($r.Target + "              ").Substring(0, 14)
        Write-Host "$($r.Period.ToString().PadLeft(4))  | $t | $($r.Top1)  $($r.Top2)  $($r.Top3)  $($r.Top4)  $($r.Top5)  |  $($r.Bulou)  |   $($r.Top5Union)  |    $($r.Top5BulouUnion)    |   $($r.PoolCover)"
    }
}
