#!/bin/sh
set -eu

# Demo seed is intentionally not invoked here.
# prisma/seed.ts also refuses NODE_ENV other than development or test.
if [ -z "${DIRECT_URL:-}" ]; then
  echo "[sjs-api] DIRECT_URL unset; using DATABASE_URL for migrations"
  export DIRECT_URL="${DATABASE_URL}"
fi
echo "[sjs-api] Applying Prisma migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "[sjs-api] Starting Nest API..."
exec node dist/main.js
