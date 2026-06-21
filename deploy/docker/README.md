# Docs — Docker Compose deployment

Prod-oriented Docker Compose layout for [Docs](https://github.com/suitenumerique/docs).

> The root `compose.yml` of the repository is the **development** stack. Use the files in this folder to deploy Docs in production.

## Layout

```
deploy/docker/
├── compose.yml              # Main production compose file
├── env.d/                   # (you provide) postgres / backend / yprovider / common env files
└── examples/
    ├── keycloak/            # Sample OIDC provider
    ├── minio/               # Sample S3-compatible object storage
    └── nginx-proxy/         # Sample reverse proxy with Let's Encrypt
```

## Getting started

See the [installation walkthrough](../../docs/installation/compose.md) — it covers env files, OIDC, S3, Postgres, Redis, mail and reverse-proxy setup end to end.

Quick setup:

```bash
mkdir -p docs/env.d && cd docs

# Fetch the compose file and example env files
curl -o compose.yml https://raw.githubusercontent.com/suitenumerique/docs/refs/heads/main/deploy/docker/compose.yml
curl -o env.d/common     https://raw.githubusercontent.com/suitenumerique/docs/refs/heads/main/env.d/production.dist/common
curl -o env.d/backend    https://raw.githubusercontent.com/suitenumerique/docs/refs/heads/main/env.d/production.dist/backend
curl -o env.d/yprovider  https://raw.githubusercontent.com/suitenumerique/docs/refs/heads/main/env.d/production.dist/yprovider
curl -o env.d/postgresql https://raw.githubusercontent.com/suitenumerique/docs/refs/heads/main/env.d/production.dist/postgresql

# Pin to a tagged release before going to production
docker compose up -d
docker compose run --rm backend python manage.py migrate
```

## Other deployments

* Kubernetes/Helm: see [`deploy/kubernetes/`](../kubernetes/).
* PaaS (Scalingo, Clever Cloud, …): see [`deploy/paas/`](../paas/).
