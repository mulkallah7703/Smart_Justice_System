# NestJS AI Worker — production image
# Build from repository root:
#   docker build -f infra/docker/worker.Dockerfile -t sjs-worker:local .
#
# OCR uses tesseract.js WASM (no apt tesseract). Language data is baked at build
# time and never fetched at runtime for citizen documents.
# Secrets are runtime-only: OPENAI_API_KEY, AI_QDRANT_*, DATABASE_URL, REDIS_URL, S3_*

FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ ./
RUN npx prisma generate && npm run build \
  && npm prune --omit=dev

FROM node:20-bookworm-slim AS langdata
WORKDIR /opt/ocr
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY backend/scripts/fetch-ocr-lang-data.sh ./scripts/fetch-ocr-lang-data.sh
# Same Linux fetcher as `npm run ocr:langdata`: ara.traineddata + eng.traineddata.
RUN bash ./scripts/fetch-ocr-lang-data.sh \
  && test -s .ocr-data/ara.traineddata \
  && test -s .ocr-data/eng.traineddata

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NAFATH_MODE=inactive \
    PAYMENT_PROVIDER=deferred \
    AI_PROVIDER_MODE=openai \
    AI_LLM_MODE=openai \
    AI_EMBEDDING_MODE=openai \
    AI_VECTOR_STORE_MODE=qdrant \
    AI_TEXT_EXTRACTOR_MODE=pdf \
    AI_OCR_MODE=local \
    AI_OCR_LANG_PATH=/app/.ocr-data \
    AI_OCR_LANGUAGES=ara+eng

RUN groupadd --system --gid 1001 sjs \
  && useradd --system --uid 1001 --gid sjs --home-dir /app --shell /usr/sbin/nologin sjs

COPY --from=build --chown=sjs:sjs /app/dist ./dist
COPY --from=build --chown=sjs:sjs /app/node_modules ./node_modules
COPY --from=build --chown=sjs:sjs /app/package.json ./package.json
COPY --from=build --chown=sjs:sjs /app/prisma ./prisma
COPY --from=langdata --chown=sjs:sjs /opt/ocr/.ocr-data /app/.ocr-data

USER sjs

# Worker only — no HTTP listen; no watch mode.
CMD ["node", "dist/worker.js"]
