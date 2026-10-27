# Downloads Tesseract traineddata into backend/.ocr-data.
# Language files are NOT committed to git.
# AI_OCR_TESSDATA=best (default) fetches tessdata_best for ara.
# AI_OCR_TESSDATA=fast fetches tessdata_fast for ara. eng stays tessdata_fast.
$ErrorActionPreference = 'Stop'
$dest = Join-Path $PSScriptRoot '..' '.ocr-data'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$variant = if ($env:AI_OCR_TESSDATA) { $env:AI_OCR_TESSDATA.ToLower() } else { 'best' }
if ($variant -ne 'best' -and $variant -ne 'fast') {
  throw 'AI_OCR_TESSDATA must be best or fast'
}
foreach ($lang in @('eng', 'ara')) {
  $out = Join-Path $dest "$lang.traineddata"
  if (Test-Path $out) {
    Write-Host "exists $out"
    continue
  }
  $base = if ($lang -eq 'ara') {
    "https://github.com/tesseract-ocr/tessdata_$variant/raw/main"
  } else {
    'https://github.com/tesseract-ocr/tessdata_fast/raw/main'
  }
  Write-Host "fetching $lang.traineddata ($variant)"
  Invoke-WebRequest -Uri "$base/$lang.traineddata" -OutFile $out
}
Write-Host "OCR language data ready in $dest"
