#!/usr/bin/env bash
# Downloads Tesseract traineddata into backend/.ocr-data.
# Language files are NOT committed to git.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${ROOT}/.ocr-data"
BASE_URL="https://github.com/tesseract-ocr/tessdata_fast/raw/main"
mkdir -p "${DEST}"
for lang in eng ara; do
  out="${DEST}/${lang}.traineddata"
  if [[ -f "${out}" ]]; then
    echo "exists ${out}"
    continue
  fi
  echo "fetching ${lang}.traineddata"
  tmp="${out}.partial"
  curl -fsSL --retry 5 --retry-delay 2 "${BASE_URL}/${lang}.traineddata" -o "${tmp}"
  mv "${tmp}" "${out}"
done
echo "OCR language data ready in ${DEST}"
