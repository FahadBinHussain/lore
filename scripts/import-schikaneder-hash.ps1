# dHash helper for scripts/import-schikaneder-commons.ts (mode: hash).
# TS downloads the images into C:\tmp\schikaneder-hash-cache (PowerShell's WebClient trips
# Wikimedia's bot-traffic 429 on thumb.wikimedia.org while the identical URL succeeds from
# node fetch, verified 2026-10-08) and writes C:\tmp\schikaneder-hash-jobs.json ({key,path});
# this script only reads those local files, computes a 9x8 grayscale dHash (64 binary chars)
# per image, and writes { key: bits|null } to C:\tmp\schikaneder-hash-jobs-out.json.
# null = unreadable image (the caller holds that item). No network access here.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$jobsPath = 'C:\tmp\schikaneder-hash-jobs.json'
$outPath = 'C:\tmp\schikaneder-hash-jobs-out.json'

$jobs = (Get-Content -LiteralPath $jobsPath -Raw -Encoding UTF8 | ConvertFrom-Json)
$out = [ordered]@{}
$n = 0
$fail = 0
$total = @($jobs).Count
foreach ($j in $jobs) {
    $hex = $null
    try {
        $bytes = [System.IO.File]::ReadAllBytes($j.path)
        $ms = New-Object System.IO.MemoryStream(, $bytes)
        $img = [System.Drawing.Image]::FromStream($ms)
        $bmp = New-Object System.Drawing.Bitmap(9, 8)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($img, 0, 0, 9, 8)
        $g.Dispose()
        $img.Dispose()
        $ms.Dispose()
        $gray = New-Object 'double[]' 72
        for ($y = 0; $y -lt 8; $y++) {
            for ($x = 0; $x -lt 9; $x++) {
                $c = $bmp.GetPixel($x, $y)
                $gray[$y * 9 + $x] = 0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B
            }
        }
        $bmp.Dispose()
        $bits = New-Object char[] 64
        $bi = 0
        for ($y = 0; $y -lt 8; $y++) {
            for ($x = 0; $x -lt 8; $x++) {
                $bits[$bi++] = if ($gray[$y * 9 + $x] -gt $gray[$y * 9 + $x + 1]) { '1' } else { '0' }
            }
        }
        $hex = -join $bits
    } catch {
        $hex = $null
        $fail++
        Write-Host "HASH-FAILED $($j.key) $($_.Exception.Message)"
    }
    $out[[string]$j.key] = $hex
    $n++
    if (($n % 50) -eq 0) { Write-Host "hashed $n/$total fail=$fail" }
}
$out | ConvertTo-Json | Set-Content -LiteralPath $outPath -Encoding UTF8
Write-Host "hash done n=$n fail=$fail -> $outPath"
