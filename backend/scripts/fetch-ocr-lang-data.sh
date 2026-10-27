#!/usr/bin/env bash
# Downloads Tesseract traineddata into backend/.ocr-data.
# Language files are NOT committed to git.
# AI_OCR_TESSDATA=fast (default) fetches tessdata_fast for ara.
# AI_OCR_TESSDATA=best fetches tessdata_best for ara. eng stays tessdata_fast.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${ROOT}/.ocr-data"
VARIANT="${AI_OCR_TESSDATA:-fast}"
case "${VARIANT}" in
  best|fast) ;;
  *)
    echo "AI_OCR_TESSDATA must be best or fast" >&2
    exit 1
    ;;
esac
mkdir -p "${DEST}"
for lang in eng ara; do
  out="${DEST}/${lang}.traineddata"
  if [[ -f "${out}" ]]; then
    echo "exists ${out}"
    continue
  fi
  if [[ "${lang}" == "ara" ]]; then
    base="https://github.com/tesseract-ocr/tessdata_${VARIANT}/raw/main"
  else
    base="https://github.com/tesseract-ocr/tessdata_fast/raw/main"
  fi
  echo "fetching ${lang}.traineddata (${VARIANT})"
  tmp="${out}.partial"
  curl -fsSL --retry 5 --retry-delay 2 "${base}/${lang}.traineddata" -o "${tmp}"
  mv "${tmp}" "${out}"
done
echo "OCR language data ready in ${DEST}"
