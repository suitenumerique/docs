# Docs — PaaS deployment

Buildpack scripts and nginx template for deploying [Docs](https://github.com/suitenumerique/docs) on a PaaS (Scalingo, Clever Cloud, …).

## Layout

```
deploy/paas/
├── buildpack_postcompile.sh   # Build-time: cleanup unused files to reduce slug size
├── buildpack_postfrontend.sh  # Build-time: assemble frontend/backend/nginx into slug
├── buildpack_start.sh         # Runtime: starts uvicorn + y-provider + nginx
└── servers.conf.erb           # Nginx routing template (ERB → consumed by buildpack)
```

The root `Procfile` references `deploy/paas/buildpack_start.sh` for the `web` process.

## Getting started

See the [Scalingo walkthrough](../../docs/installation/scalingo.md) — it covers the full env-var setup (buildpack URL, OIDC, S3, theme customization, etc.).

The two build-time hooks are wired via the [La Suite buildpack](https://github.com/suitenumerique/buildpack) env vars:

```bash
scalingo env-set LASUITE_SCRIPT_POSTCOMPILE="deploy/paas/buildpack_postcompile.sh"
scalingo env-set LASUITE_SCRIPT_POSTFRONTEND="deploy/paas/buildpack_postfrontend.sh"
```

## Other deployments

* Docker Compose: see [`deploy/docker/`](../docker/).
* Kubernetes/Helm: see [`deploy/kubernetes/`](../kubernetes/).
