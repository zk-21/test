$bytes = [System.IO.File]::ReadAllBytes('backtest_cross_row_full.txt')
$text = [System.Text.Encoding]::Unicode.GetString($bytes)
$lines = $text -split "`n"

Write-Host "Total lines: $($lines.Count)"

# Show a few lines near 2022 to see the format
for ($i = 2020; $i -lt 2035; $i++) {
    if ($lines[$i]) {
        Write-Host "${i}: $($lines[$i])"
    }
}
