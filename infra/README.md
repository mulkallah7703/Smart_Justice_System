# Infrastructure

## Local development

Docker Compose for **local** data plane only:

| Service | Port |
|---------|------|
| PostgreSQL 16 | `127.0.0.1:5432` |
| Redis 7.2 | `127.0.0.1:6379` |
| MinIO-compatible object storage (Silo image; `minio/minio` was removed from Docker Hub) | `127.0.0.1:9000` (console `9001`) |
| Qdrant 1.12.5 | `127.0.0.1:6333` (local only; production uses **Qdrant Cloud**) |

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

Credentials in the **dev** Compose file are development defaults — never reuse in production.

## Production (Phase U)

| Artifact | Path |
|----------|------|
| Compose | `infra/docker/docker-compose.production.yml` |
| Env example | `infra/docker/.env.production.example` |
| API image | `infra/docker/backend.Dockerfile` |
| Worker image | `infra/docker/worker.Dockerfile` |
| Frontend image | `infra/docker/frontend.Dockerfile` |
| Nginx edge | `infra/nginx/nginx.production.conf` |
| Deploy guide | `docs/PRODUCTION-DEPLOYMENT.md` |
| HTTPS | `docs/HTTPS.md` |

```bash
cp infra/docker/.env.production.example infra/docker/.env.production
# fill secrets
docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  config
docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  up -d --build
```

- Postgres / Redis / MinIO: **internal network only** (not published).  
- Qdrant Cloud + OpenAI: external; keys on API/worker only.  
- Nafath / Payment: **DEFERRED** (`inactive` / `deferred`).

Kubernetes, Helm, and the old monitoring manifests under `infra/` were empty `# TODO` placeholders. They are not part of the launch path and have been removed so they cannot be mistaken for a deploy.

## CI

Root workflow: `.github/workflows/ci.yml` (unit, typecheck, builds, Docker image builds).  
Live AI tests stay opt-in and are **not** run in ordinary CI.
