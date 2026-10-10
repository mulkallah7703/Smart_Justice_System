# Downloads Tesseract traineddata into backend/.ocr-data.
# Language files are NOT committed to git.
$ErrorActionPreference = 'Stop'
$dest = Join-Path $PSScriptRoot '..' '.ocr-data'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$base = 'https://github.com/tesseract-ocr/tessdata_fast/raw/main'
foreach ($lang in @('eng', 'ara')) {
  $out = Join-Path $dest "$lang.traineddata"
  if (Test-Path $out) {
    Write-Host "exists $out"
    continue
  }
  Write-Host "fetching $lang.traineddata"
  Invoke-WebRequest -Uri "$base/$lang.traineddata" -OutFile $out
}
Write-Host "OCR language data ready in $dest"
