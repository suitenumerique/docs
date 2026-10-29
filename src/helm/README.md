# Helm deployment

The Helmfile and the Helm chart of Docs. The chart parameters are documented
in [`impress/README.md`](impress/README.md).

## Structure

- `helmfile.yaml.gotmpl`: the Helmfile defining the releases and environments
- `impress/`: the Helm chart, its templates and default values
- `env.d/{env}/`: the values of each environment (`dev` = local, `feature` = CI)

## Local cluster

```bash
make build-k8s-cluster   # create the local Kind cluster
make start-tilt          # start Tilt for hot-reload
# from src/helm/:
helmfile -n impress -e dev apply   # or destroy, diff
```

- Kind cluster with mkcert HTTPS and a local registry (`localhost:5001`)
- CoreDNS for the `nip.io` domains, and the dev backend dependencies
  (Keycloak, PostgreSQL, MinIO)

## Services

- Backend (Django + Celery), frontend (Next.js), yhub (the collaboration
  server, plus an optional separate worker with `yhub.worker.enabled`),
  y-provider (conversion only)
- Two standalone Valkey instances from the official `valkey/valkey` chart:
  `valkey-docs` (backend cache, sessions, Celery) and `valkey-yhub`
- The websocket ingress on `/collaboration/ws/` has no `upstream-hash-by`: any
  yhub replica serves any document
- Optional: DocSpec (conversion), Posthog (analytics)
- `dev` only (`monitoring: true` in the helmfile environment): a trimmed
  `kube-prometheus-stack` release (`env.d/dev/values.prometheus.yaml.gotmpl`:
  operator, CRDs and one Prometheus at https://docs-prometheus.127.0.0.1.nip.io)
  scraping the backend and yhub through the `serviceMonitor` of the chart, with
  the token in the `docs-metrics` Secret it creates, and a Grafana at
  https://docs-grafana.127.0.0.1.nip.io (admin/admin) whose sidecar loads the
  dashboards of `src/loadtest/dashboards/` from ConfigMaps (the legend `{{` is
  escaped for helm's `tpl`, as the values file explains). See
  [`documentation/metrics.md`](../../documentation/metrics.md).

## Guidelines

- Never commit secrets; use Go templating such as `{{ now | unixEpoch }}`.
- Follow semantic versioning for the chart.
- Document every value with an `@param` annotation in `impress/values.yaml`,
  then regenerate `impress/README.md` by running `./generate-readme.sh` from
  `impress/` (it mounts the current directory).
