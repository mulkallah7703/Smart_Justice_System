#!/bin/sh
set -eu

# Prisma Migrate needs the direct Neon host. Copy the pooled URL when the
# dashboard left DIRECT_URL empty so local and single-URL deploys still migrate.
if [ -z "${DIRECT_URL:-}" ]; then
  echo "[sjs-api] DIRECT_URL unset; using DATABASE_URL for migrations"
  export DIRECT_URL="${DATABASE_URL}"
fi

echo "[sjs-api] Applying Prisma migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "[sjs-api] Starting Nest API..."
exec node dist/main.js
