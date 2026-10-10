# HTTPS for PJSR production

**Do not create fake or self-signed certificates for production.**  
**Do not commit private keys or full certificate chains into git.**

This document describes how to install and renew real TLS certificates for the
Nginx edge defined in `infra/nginx/nginx.production.conf`.

---

## Architecture

```
Internet
   |
   v
Nginx (:80 / :443)     ← TLS termination
   |
   +--> frontend (:80 internal)
   +--> api (:3000 internal)   /api/*, /health, /health/ready, /readyz
```

Internal services (Postgres, Redis, MinIO) are **not** TLS-terminated at the edge
and must **not** be published on public interfaces.

---

## Certificate location (compose)

`infra/docker/docker-compose.production.yml` mounts:

| Host path (env) | Container path | Purpose |
|-----------------|----------------|---------|
| `TLS_CERTS_HOST_PATH` (default `./certs`) | `/etc/nginx/certs` | `fullchain.pem`, `privkey.pem` |
| `CERTBOT_WWW_PATH` (default `./certbot-www`) | `/var/www/certbot` | ACME HTTP-01 challenge files |

Nginx expects:

- `/etc/nginx/certs/fullchain.pem`
- `/etc/nginx/certs/privkey.pem`

Create the host directories on the server (permissions: readable by the nginx
container user; private key not world-readable):

```bash
mkdir -p infra/docker/certs infra/docker/certbot-www
chmod 700 infra/docker/certs
```

---

## Option A — Let's Encrypt (Certbot) with HTTP-01

Prerequisites:

- Public DNS A/AAAA record pointing at the server
- Ports 80 and 443 reachable from the internet
- Docker Compose stack able to serve `/.well-known/acme-challenge/` (already in
  `nginx.production.conf`)

Example (run on the **host**, adjust domain and email):

```bash
# 1) Start stack so Nginx answers :80 (certificates may be temporarily absent —
#    for first bootstrap you can temporarily use a bootstrap HTTP-only config,
#    or obtain certs before enabling the 443 server block).
sudo certbot certonly --webroot \
  -w "$(pwd)/infra/docker/certbot-www" \
  -d app.example.com \
  --email ops@example.com \
  --agree-tos \
  --non-interactive

# 2) Copy/link issued files into the compose certs mount
sudo cp /etc/letsencrypt/live/app.example.com/fullchain.pem infra/docker/certs/fullchain.pem
sudo cp /etc/letsencrypt/live/app.example.com/privkey.pem infra/docker/certs/privkey.pem
sudo chmod 640 infra/docker/certs/privkey.pem

# 3) Reload Nginx
docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  exec nginx nginx -s reload
```

### Renewal strategy

Certbot renews via cron/systemd timer on most installs:

```bash
sudo certbot renew --dry-run
```

After successful renew, copy updated files into `infra/docker/certs/` and reload
Nginx (or automate with a deploy hook). Certificates are typically valid ~90 days;
renewal should run at least twice monthly.

**This repository does not automate Certbot.** Automation on the server is an
operations responsibility.

---

## Option B — Existing commercial / organizational certificates

1. Obtain `fullchain.pem` (leaf + intermediates) and `privkey.pem` from your CA.
2. Place them under `TLS_CERTS_HOST_PATH`.
3. Ensure file modes protect the private key.
4. Start/reload Nginx.

---

## HTTP → HTTPS behavior

`infra/nginx/nginx.production.conf`:

- Port **80**: serves ACME challenges; all other requests `301` redirect to HTTPS.
- Port **443**: TLS 1.2/1.3; HSTS enabled.

---

## Frontend build URL

Production frontend must be built with an HTTPS API base:

```text
VITE_API_MODE=real
VITE_API_BASE_URL=https://app.example.com/api/v1
```

Never bake `http://localhost` into a production frontend image.

---

## Verification checklist

1. `curl -I http://app.example.com` → `301` to HTTPS.  
2. `curl -I https://app.example.com/health` → `200`.  
3. Certificate chain valid in browser / `openssl s_client`.  
4. Private key **not** present in git (`git status` clean of `*.pem`).  

---

## Status note for Phase U

| Item | Classification |
|------|----------------|
| Nginx TLS config in repo | Present |
| Real certificate issuance on a production host | **NOT VERIFIED** in this environment (requires your domain + DNS) |
| Self-signed “prod” certs | **Forbidden** |
