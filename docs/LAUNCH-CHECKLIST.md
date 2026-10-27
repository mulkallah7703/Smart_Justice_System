# Launch checklist — 11 October 2026

Single Linux VPS. One public hostname. Docker Compose production stack plus Nginx and a real Let's Encrypt certificate.

This is the operator runbook. It matches the repository as of the launch branch. Do not follow older notes that say the AI stack is mock, that `minio/minio` still pulls from Docker Hub, or that Kubernetes manifests under `infra/k8s` are a deploy path.

**Deferred and must stay deferred:** Nafath (`NAFATH_MODE=inactive`) and Payment (`PAYMENT_PROVIDER=deferred`). The UI tells people payment and paid card upgrades are coming later. It does not pretend a charge succeeded. The document advisor launches as experimental (`AI_ADVISOR_EXPERIMENTAL=true` and `VITE_AI_ADVISOR_EXPERIMENTAL=true`): the Q&A screens show تجريبي and say answers may be wrong, are not legal advice, and must be checked against the original document or a lawyer.

**Do not seed demo users in production.** `npx prisma db seed` refuses to run unless `NODE_ENV` is `development` or `test`. The API container entrypoint only runs `prisma migrate deploy`.

The sections below are the single-VPS Docker path. A separate free-tier test path (Vercel, Neon, Render, Upstash, Qdrant Cloud, Cloudflare R2) is in [Free-tier test deployment](#free-tier-test-deployment).

---

## 0. What you must bring

The application cannot invent these. Without them the public site cannot boot in production mode.

| Item | Where to get it | Used as |
|------|-----------------|---------|
| Linux VPS | Any provider. Ubuntu 22.04 or 24.04, x86_64, **4 vCPU, 8 GB RAM, 40 GB SSD** | Host |
| DNS name | Your DNS host. One `A` (and `AAAA` if you have IPv6) record | `app.example.com` below |
| OpenAI API key | [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Billing must be active | `OPENAI_API_KEY` |
| Qdrant Cloud | [cloud.qdrant.io](https://cloud.qdrant.io) → create a cluster → copy the HTTPS URL and API key. Collection name `legal_chunks_v1` (the API creates it) | `AI_QDRANT_URL`, `AI_QDRANT_API_KEY` |
| Email for Let's Encrypt | An inbox you read | Certbot `--email` |

SMTP is **not** required. This build does not send email. Registration is email + password only; there is no verification mail.

Nafath credentials and a payment gateway are **not** required.

---

## 1. Server packages

SSH in as a user that can use `sudo`.

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
# log out and back in so the docker group applies
```

Open **only** TCP 22, 80, and 443 to the world. Do not publish 5432, 6379, 9000, or 9001.

---

## 2. Get the code

```bash
sudo mkdir -p /opt/pjsr
sudo chown "$USER:$USER" /opt/pjsr
cd /opt/pjsr
git clone <YOUR_GIT_REMOTE> .
git checkout <launch-branch-or-tag>
```

All commands below assume the shell is at `/opt/pjsr` (the repository root).

---

## 3. DNS

Create the record before requesting a certificate.

| Type | Name | Value |
|------|------|--------|
| A | `app` (or `@` if the hostname is the apex) | The VPS public IPv4 |

Wait until this succeeds from your laptop:

```bash
dig +short app.example.com
```

Replace `app.example.com` with the real hostname everywhere below. The hostname in `CORS_ORIGINS`, `VITE_API_BASE_URL`, and the certificate must be the same.

---

## 4. Environment file

```bash
cp infra/docker/.env.production.example infra/docker/.env.production
chmod 600 infra/docker/.env.production
```

Edit `infra/docker/.env.production`. Generate secrets on the server. Do not reuse the examples, and do not commit the file.

```bash
openssl rand -base64 32   # run once per secret
```

### Required variables

| Variable | Rule |
|----------|------|
| `VITE_API_BASE_URL` | `https://app.example.com/api/v1` — baked into the frontend image at **build** time. Change it and you must rebuild the frontend image. |
| `CORS_ORIGINS` | `https://app.example.com` (no trailing slash, no `*`) |
| `POSTGRES_USER` | `sjs` is fine |
| `POSTGRES_PASSWORD` | Long random password |
| `POSTGRES_DB` | `sjs_prod` |
| `REDIS_PASSWORD` | Long random password |
| `MINIO_ROOT_USER` | Root user for the object-storage console and the one-shot bucket init job. Example: `sjs_minio_root` |
| `MINIO_ROOT_PASSWORD` | At least 8 characters; use a long random value |
| `S3_ACCESS_KEY` | Separate application key, not the root user. Example: `sjs_app` |
| `S3_SECRET` | Long random secret for that key |
| `S3_BUCKET` | `sjs-documents` |
| `JWT_ACCESS_SECRET` | At least 32 characters. `openssl rand -base64 48` |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `LOG_LEVEL` | `info` |
| `AI_PROVIDER_MODE` | `openai` |
| `AI_LLM_MODE` | `openai` |
| `AI_EMBEDDING_MODE` | `openai` |
| `AI_VECTOR_STORE_MODE` | `qdrant` |
| `AI_TEXT_EXTRACTOR_MODE` | `pdf` |
| `AI_OCR_MODE` | `local` |
| `AI_OCR_TESSDATA` | `fast` (default). `best` remains selectable and was slower with no accuracy gain on the real-document retest |
| `AI_ADVISOR_EXPERIMENTAL` | `true` (default). Document answers stay marked experimental |
| `VITE_AI_ADVISOR_EXPERIMENTAL` | `true`. Baked into the frontend image with `VITE_API_BASE_URL`. Shows the تجريبي badge and the short Arabic disclaimer |
| `OPENAI_API_KEY` | Secret key from OpenAI. Starts with `sk-` |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` |
| `AI_QDRANT_URL` | Cluster URL from Qdrant Cloud, including `https://` |
| `AI_QDRANT_API_KEY` | API key from the same cluster |
| `AI_QDRANT_COLLECTION` | `legal_chunks_v1` |
| `NAFATH_MODE` | `inactive` |
| `PAYMENT_PROVIDER` | `deferred` |
| `PAYMENT_WEBHOOK_SECRET` | Any long random string. Unused while payment is deferred. The process still accepts the variable. |
| `HTTP_PORT` / `HTTPS_PORT` | `80` and `443` |
| `TLS_CERTS_HOST_PATH` | `./certs` (relative to `infra/docker`) |
| `CERTBOT_WWW_PATH` | `./certbot-www` |

Compose injects `NODE_ENV=production`, `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT=http://minio:9000`, and `TRUST_PROXY_HOPS=1` itself. You do not put the database URL in the file unless you are running the API outside Compose.

Production boot **refuses** mock AI, mock Nafath, mock payment, a missing OpenAI key, a missing Qdrant URL, and `CORS_ORIGINS=*`.

---

## 5. TLS certificate (before the stack)

Nginx will not start without `fullchain.pem` and `privkey.pem`. Get the certificate with Certbot standalone while port 80 is still free.

```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone \
  -d app.example.com \
  --email you@example.com \
  --agree-tos \
  --non-interactive

mkdir -p infra/docker/certs infra/docker/certbot-www
sudo cp /etc/letsencrypt/live/app.example.com/fullchain.pem infra/docker/certs/fullchain.pem
sudo cp /etc/letsencrypt/live/app.example.com/privkey.pem infra/docker/certs/privkey.pem
sudo chown "$USER:$USER" infra/docker/certs/fullchain.pem infra/docker/certs/privkey.pem
chmod 644 infra/docker/certs/fullchain.pem
chmod 600 infra/docker/certs/privkey.pem
```

Renewal (after the stack is up, HTTP-01 via the Nginx webroot):

```bash
sudo certbot renew --webroot -w /opt/pjsr/infra/docker/certbot-www
sudo cp /etc/letsencrypt/live/app.example.com/fullchain.pem /opt/pjsr/infra/docker/certs/fullchain.pem
sudo cp /etc/letsencrypt/live/app.example.com/privkey.pem /opt/pjsr/infra/docker/certs/privkey.pem
docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  exec nginx nginx -s reload
```

Put that renew-and-reload sequence in `/etc/cron.d` or a systemd timer. Certificates last 90 days.

---

## 6. Validate, build, start

Object storage image: **`pgsty/silo`** (and client **`pgsty/mc`**). `minio/minio` and `minio/mc` were removed from Docker Hub in September 2026. Silo speaks the same S3 API and still honors `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` and `server /data`.

```bash
docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  config

docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  up -d --build
```

What starts, in order:

1. Postgres, Redis, Silo (internal only)
2. `minio-init` creates the bucket and the least-privilege application user, then exits
3. API container runs `npx prisma migrate deploy`, then `node dist/main.js`
4. AI worker (`node dist/worker.js`) after the API is healthy
5. Frontend static files
6. Nginx on 80 and 443

Watch the API until it is healthy (the entrypoint migrates before listen, so the first health checks can take a minute):

```bash
docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  ps

docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  logs -f api worker
```

Do **not** run `npx prisma db seed` on this server.

---

## 7. Smoke test

```bash
curl -fsS https://app.example.com/health
curl -fsS https://app.example.com/health/ready
curl -fsS https://app.example.com/readyz
```

`/health/ready` must report Postgres, Redis, object storage, Qdrant, and AI config as up. It must not print secrets.

Then in a browser:

1. Open `https://app.example.com`. Arabic RTL shell loads. No certificate warning.
2. Register a real account (not `dev.citizen@localhost.local`).
3. Log in. Home shows your name and judicial card, not a sample person or a fake deadline.
4. Legal file → add a case → open it → upload a small PDF or PNG (max 10 MB).
5. Lawyers → pick a slot → book. The next screen says payment is not available and that nothing was charged.
6. Alerts and judicial card open. Wallet and paid tier upgrade say they are coming later.
7. Legal guide and advisor: with a real OpenAI key these call the worker. A text-layer PDF can be analyzed; scanned Arabic pages stay fail-closed (`REVIEW_REQUIRED`) until OCR is trusted.

Full AI path (optional, needs the key and Qdrant): `docs/PRODUCTION-SMOKE-TEST.md`.

---

## 8. Backups (do this the same day)

Nothing in Compose ships backups off the machine. The disk is the only copy until you copy these files elsewhere.

Postgres (custom format, from the repo root, with the env file loaded):

```bash
set -a
. infra/docker/.env.production
set +a
docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  > "/var/backups/sjs-pg-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Object storage: the bytes live in the Docker volume `sjs_prod_minio_data`. Copy that volume, or mirror the bucket with `mc` on the compose network, to storage that is not this VPS. Details: `docs/PRODUCTION-BACKUP-RESTORE.md`.

Qdrant vectors can be rebuilt from Postgres chunk rows plus OpenAI. Redis is a queue, not the system of record.

Schedule the Postgres dump at least daily (cron) and copy it off the VPS.

---

## 9. Rollback

1. Keep the previous `IMAGE_TAG` (set it in `.env.production` before each release, for example `IMAGE_TAG=2026-10-11`).
2. Check out the previous git revision and start that tag:

```bash
IMAGE_TAG=<previous> docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  up -d
```

3. If a migration must be undone, restore the Postgres dump from section 8. Stop `api` and `worker` first. Do not run `prisma migrate reset` on production.
4. Nginx and certificates stay. Rebuilding the frontend is required only when `VITE_API_BASE_URL` changes.

---

## Free-tier test deployment

Use this when the public test site is a Vercel static app, a Render free web service, and managed data stores. The VPS Compose path above stays valid. Do not mix the two: Compose runs its own Postgres, Redis, and MinIO and a separate worker container.

Topology:

```
Browser (*.vercel.app)
  → HTTPS Nest API (*.onrender.com) on 0.0.0.0:$PORT
       → Neon Postgres (pooled runtime URL, direct URL for migrations)
       → Upstash Redis (rediss://)
       → Qdrant Cloud
       → Cloudflare R2
       → OpenAI
```

One Render service runs the API and, with `RUN_WORKER_IN_PROCESS=true`, the BullMQ AI worker in that same process. `node dist/worker.js` remains available for Compose and for any host that runs the worker separately. Do not run both at once: two consumers would share the queue.

Prisma stays on **5.22.0**. Apply schema changes with `npx prisma migrate deploy`. Do not use `prisma db push`. Do not seed production.

### Accounts and URLs

1. **Neon.** Create a Postgres project. Copy the **pooled** connection string into `DATABASE_URL`. The host contains `-pooler`, and the query string includes `sslmode=require` (Neon often also adds `pgbouncer=true`; keep that on the pooled URL only). Copy the **direct** connection string into `DIRECT_URL`. That host has no `-pooler`. Prisma Client uses `DATABASE_URL`. Prisma Migrate uses `DIRECT_URL` (`directUrl` in `backend/prisma/schema.prisma`). Example shape:

   ```
   DATABASE_URL=postgresql://USER:PASSWORD@ep-name-pooler.region.aws.neon.tech/neondb?sslmode=require
   DIRECT_URL=postgresql://USER:PASSWORD@ep-name.region.aws.neon.tech/neondb?sslmode=require
   ```

2. **Upstash.** Create a Redis database and copy the TLS URL. It must start with `rediss://`. BullMQ gets its own client with `maxRetriesPerRequest: null`, TLS, and `enableReadyCheck: false`. The rate-limit client stays separate and keeps a small retry count. Example:

   ```
   REDIS_URL=rediss://default:TOKEN@HOST.upstash.io:6379
   ```

3. **Qdrant Cloud.** Create a free cluster. Copy the HTTPS URL and the API key. Collection name is `legal_chunks_v1`.

   ```
   AI_QDRANT_URL=https://CLUSTER.region.cloud.qdrant.io:6333
   AI_QDRANT_API_KEY=the-cluster-key
   AI_QDRANT_COLLECTION=legal_chunks_v1
   ```

4. **Cloudflare R2.** Create a bucket (for example `sjs-documents`) and an API token with object read/write on that bucket. The S3 client always sends path-style requests. Set the region to `auto` and the endpoint to the account S3 URL:

   ```
   S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_ACCESS_KEY=the-r2-access-key-id
   S3_SECRET=the-r2-secret
   S3_BUCKET=sjs-documents
   ```

5. **OpenAI.** A real API key. Production boot refuses mock AI.

6. **JWT.** `openssl rand -base64 48` for `JWT_ACCESS_SECRET` (at least 32 characters).

### Render (API)

`render.yaml` at the repo root describes one free Node web service named `sjs-api` (`rootDir: backend`, region `oregon`, health check `/health`). It does not create Render Postgres or Render Key Value.

1. Push this branch (or `main` after merge). In the Render dashboard: New → Blueprint, select the repository, and apply `render.yaml`. Connect auto-deploy to the branch you intend to run. The file sets `autoDeployTrigger: commit`, so Render deploys that connected branch.
2. Fill every `sync: false` variable in the dashboard before the first successful deploy. Render injects them at build and at runtime. Do not commit the values. Do not set `PORT`; Render sets it (often `10000`). The process already listens on `0.0.0.0`.
3. Build command (already in the Blueprint): `NPM_CONFIG_PRODUCTION=false npm ci && … prisma generate && npm run build && npm run ocr:langdata`. `NPM_CONFIG_PRODUCTION=false` keeps the Prisma CLI, which is a devDependency, in the slug even though `NODE_ENV=production`. `ocr:langdata` downloads **fast** `eng` and `ara` tessdata into `backend/.ocr-data` and skips files that are already there. The Render disk is ephemeral; the next build fetches the files again.
4. Start command: `sh scripts/render-start.sh`. The script copies `DATABASE_URL` into `DIRECT_URL` when `DIRECT_URL` is empty, runs `npx prisma migrate deploy`, then `exec node dist/main.js`. Migrations run on start, in the web service. There is no separate migrate job and no seed.
5. Health check path is `/health` (liveness, stays 2xx when the process is up). `/health/ready` and `/readyz` can return 503 while a dependency is down, so they are not the platform probe.
6. Leave `RUN_WORKER_IN_PROCESS=true` (the Blueprint value). The API logs `BullMQ AI worker is running inside the API process` after listen. To use a separate worker later, set the flag to `false` and run `node dist/worker.js` somewhere else. Do not do both.

Free web service limits that matter: the instance sleeps after about 15 minutes without traffic, and the next request wakes it (cold start, including the worker). Free web services do not attach a custom domain. Memory is 512 MB; local OCR and the canvas renderer can be tight. If the process is killed during OCR, the job retries until attempts are exhausted. The filesystem does not survive a new deploy.

### Vercel (frontend)

Two configs exist so either project root works. Vercel serves real files before the SPA rewrite, so assets stay assets and unknown paths return `index.html`.

| Project setting | Root Directory = `frontend` | Root Directory = repository root |
|-----------------|-----------------------------|----------------------------------|
| Config file | `frontend/vercel.json` (`framework: vite`, rewrite `/(.*)` → `/index.html`) | `vercel.json` (`framework: null`) |
| Install | Vercel default `npm ci` inside `frontend` | `npm ci --prefix frontend` |
| Build | `npm run build` (`tsc --noEmit && vite build`) | `npm run build --prefix frontend` |
| Output | `dist` | `frontend/dist` |

Build-time environment (set for Production, and for Preview if you use preview URLs). Changing them requires a new deployment; Vite inlines them.

| Variable | Value |
|----------|--------|
| `VITE_API_MODE` | `real` |
| `VITE_API_URL` | `https://<service-name>.onrender.com/api/v1` |
| `VITE_API_BASE_URL` | Same URL. Optional when `VITE_API_URL` is set. A non-empty `VITE_API_BASE_URL` wins. |
| `VITE_AI_ADVISOR_EXPERIMENTAL` | `true` |

The browser turns that API base into the alert socket by replacing `http` with `ws` (`https` becomes `wss`) and appending `/alerts/ws?access_token=`. Example: `https://sjs-api.onrender.com/api/v1` → `wss://sjs-api.onrender.com/api/v1/alerts/ws`. Render terminates TLS; the Node process speaks HTTP on `PORT`.

### CORS, cookies, and the socket

Set `CORS_ORIGINS` to the exact Vercel origin, no trailing slash. A host wildcard is allowed for preview deployments. A bare `*` is rejected at boot.

```
CORS_ORIGINS=https://your-project.vercel.app
```

Previews as well:

```
CORS_ORIGINS=https://your-project.vercel.app,https://*.vercel.app
```

`https://*.vercel.app` matches `https://sjs-git-branch-team.vercel.app` and does not match a path. The API reflects the request origin when it matches, with `credentials: true`. Requests with no `Origin` (the Render health check, curl) are allowed. Helmet uses `Cross-Origin-Resource-Policy: cross-origin` so the Vercel page can read the API. `TRUST_PROXY_HOPS=1` matches Render's single proxy hop.

The SPA keeps the access token in `localStorage` and sends `Authorization: Bearer`. That already works from `vercel.app` to `onrender.com`. `fetch` also uses `credentials: 'include'`. In production only, any `Set-Cookie` the API emits is rewritten to `SameSite=None; Secure` (not `Partitioned`) so a browser will store it across those two sites. Development does not rewrite cookies, because `Secure` cookies are dropped on `http://localhost`.

The WebSocket upgrade checks `Origin` against the same `CORS_ORIGINS` list. A missing `Origin` is still accepted. A browser origin that is not on the list is closed with HTTP 403.

### Every variable on the Render service

Non-secret values are already in `render.yaml`. Secrets are `sync: false`; type them in the dashboard.

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `RUN_WORKER_IN_PROCESS` | `true` |
| `TRUST_PROXY_HOPS` | `1` |
| `NAFATH_MODE` | `inactive` |
| `PAYMENT_PROVIDER` | `deferred` |
| `AI_PROVIDER_MODE` | `openai` |
| `AI_LLM_MODE` | `openai` |
| `AI_EMBEDDING_MODE` | `openai` |
| `AI_VECTOR_STORE_MODE` | `qdrant` |
| `AI_TEXT_EXTRACTOR_MODE` | `pdf` |
| `AI_OCR_MODE` | `local` |
| `AI_OCR_TESSDATA` | `fast` |
| `AI_OCR_LANG_PATH` | `.ocr-data` |
| `AI_OCR_LANGUAGES` | `ara+eng` |
| `AI_ADVISOR_EXPERIMENTAL` | `true` |
| `AI_QDRANT_COLLECTION` | `legal_chunks_v1` |
| `S3_REGION` | `auto` |
| `LOG_LEVEL` | `info` |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `DATABASE_URL` | Neon pooled URL (`-pooler`, `sslmode=require`) |
| `DIRECT_URL` | Neon direct URL (no `-pooler`, `sslmode=require`) |
| `REDIS_URL` | Upstash `rediss://` URL |
| `CORS_ORIGINS` | Exact `https://….vercel.app`, optional `https://*.vercel.app`. Never `*` |
| `JWT_ACCESS_SECRET` | Long random secret |
| `OPENAI_API_KEY` | OpenAI secret |
| `AI_QDRANT_URL` | Qdrant Cloud HTTPS URL |
| `AI_QDRANT_API_KEY` | Qdrant Cloud API key |
| `S3_ENDPOINT` | `https://<accountid>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY` | R2 access key id |
| `S3_SECRET` | R2 secret |
| `S3_BUCKET` | R2 bucket name |

`PAYMENT_WEBHOOK_SECRET` is not required while `PAYMENT_PROVIDER=deferred`. Do not set `PORT`.

### Every variable on Vercel

| Variable | Value |
|----------|--------|
| `VITE_API_MODE` | `real` |
| `VITE_API_URL` | `https://<service>.onrender.com/api/v1` |
| `VITE_API_BASE_URL` | Same URL, or leave empty and set `VITE_API_URL` |
| `VITE_AI_ADVISOR_EXPERIMENTAL` | `true` |

### Check the test site

1. Render logs show `Applying Prisma migrations` and then the Nest listen line, plus the in-process worker line.
2. `curl -fsS https://<service>.onrender.com/health` returns 2xx. The first call after sleep can take a minute while the free instance starts.
3. Open the Vercel URL, sign in, and confirm the browser calls `https://<service>.onrender.com/api/v1` (no CORS error). Alert updates use `wss://<service>.onrender.com/api/v1/alerts/ws`.
4. Nafath stays inactive and payments stay deferred. The advisor badge stays تجريبي.

---

## 10. After launch, still not done by this repository

- A real hostname, DNS, and the VPS itself
- OpenAI billing and the API key
- Qdrant Cloud cluster
- Off-site backup automation and restore drills
- HttpOnly cookie sessions (JWT stays in `localStorage`; XSS can steal it)
- Nafath and card payments
- Government-signed judicial card (the QR is an application token)
- Physical kiosk hardware
- `pdfjs-dist` major upgrade (known advisory, deferred)
- `react-router` 7 (known advisory, deferred; this SPA does not do server rendering)
