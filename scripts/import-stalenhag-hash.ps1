# dHash helper for scripts/import-simonstalenhag-official.ts (mode: hash).
# Downloads each URL transiently, computes a 9x8 grayscale dHash (64 hex chars),
# writes { key: hex|null } to C:\tmp\stal-hashes.json. null = download failed (caller holds that item).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$inPath = 'C:\tmp\stal-hash-input.json'
$outPath = 'C:\tmp\stal-hashes.json'
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

$entries = (Get-Content -LiteralPath $inPath -Raw -Encoding UTF8 | ConvertFrom-Json)
$out = [ordered]@{}
$n = 0
$fail = 0
$total = @($entries).Count
foreach ($e in $entries) {
    $hex = $null
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers['User-Agent'] = $ua
        $bytes = $wc.DownloadData($e.url)
        $wc.Dispose()
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
        Write-Host "HASH-FAILED $($e.key) $($_.Exception.Message)"
    }
    $out[[string]$e.key] = $hex
    $n++
    if (($n % 50) -eq 0) { Write-Host "hashed $n/$total fail=$fail" }
    Start-Sleep -Milliseconds 120
}
$out | ConvertTo-Json | Set-Content -LiteralPath $outPath -Encoding UTF8
Write-Host "hash done n=$n fail=$fail -> $outPath"
