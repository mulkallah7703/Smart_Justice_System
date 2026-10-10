# NestJS API — production image
# Build from repository root:
#   docker build -f infra/docker/backend.Dockerfile -t sjs-api:local .
#
# Secrets are injected at runtime. Never bake OPENAI_*, AI_QDRANT_API_KEY, JWT, DB passwords.

FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ ./
RUN npx prisma generate && npm run build \
  && npm prune --omit=dev

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
    PORT=3000

RUN groupadd --system --gid 1001 sjs \
  && useradd --system --uid 1001 --gid sjs --home-dir /app --shell /usr/sbin/nologin sjs

COPY --from=build --chown=sjs:sjs /app/dist ./dist
COPY --from=build --chown=sjs:sjs /app/node_modules ./node_modules
COPY --from=build --chown=sjs:sjs /app/package.json ./package.json
COPY --from=build --chown=sjs:sjs /app/prisma ./prisma
COPY --from=build --chown=sjs:sjs /app/scripts/docker-api-entrypoint.sh ./scripts/docker-api-entrypoint.sh

RUN chmod +x ./scripts/docker-api-entrypoint.sh

USER sjs
EXPOSE 3000

# Runs prisma migrate deploy then starts the compiled API.
ENTRYPOINT ["./scripts/docker-api-entrypoint.sh"]
