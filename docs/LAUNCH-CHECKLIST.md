# Launch checklist — 11 October 2026

Single Linux VPS. One public hostname. Docker Compose production stack plus Nginx and a real Let's Encrypt certificate.

This is the operator runbook. It matches the repository as of the launch branch. Do not follow older notes that say the AI stack is mock, that `minio/minio` still pulls from Docker Hub, or that Kubernetes manifests under `infra/k8s` are a deploy path.

**Deferred and must stay deferred:** Nafath (`NAFATH_MODE=inactive`) and Payment (`PAYMENT_PROVIDER=deferred`). The UI tells people payment and paid card upgrades are coming later. It does not pretend a charge succeeded.

**Do not seed demo users in production.** `npx prisma db seed` refuses to run unless `NODE_ENV` is `development` or `test`. The API container entrypoint only runs `prisma migrate deploy`.

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
