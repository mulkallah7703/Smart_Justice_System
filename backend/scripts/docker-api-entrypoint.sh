#!/bin/sh
set -eu

# Demo seed is intentionally not invoked here.
# prisma/seed.ts also refuses NODE_ENV other than development or test.
echo "[sjs-api] Applying Prisma migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "[sjs-api] Starting Nest API..."
exec node dist/main.js
