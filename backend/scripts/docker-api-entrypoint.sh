#!/bin/sh
set -eu

echo "[sjs-api] Applying Prisma migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "[sjs-api] Starting Nest API..."
exec node dist/main.js
