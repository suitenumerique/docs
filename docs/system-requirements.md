# La Suite Docs – System & Requirements (2025-06)

## 1. Quick-Reference Matrix (single VM / laptop)

| Scenario                  | RAM   | vCPU | SSD     | Notes                     |
| ------------------------- | ----- | ---- | ------- | ------------------------- |
| **Solo dev**              | 8 GB  | 4    | 15 GB   | Hot-reload + one IDE      |
| **Team QA**               | 16 GB | 6    | 30 GB   | Runs integration tests    |
| **Prod ≤ 100 live users** | 32 GB | 8 +  | 50 GB + | Scale linearly above this |

Memory is the first bottleneck; CPU matters only when Celery or the Next.js build is saturated.

> **Note:** Memory consumption varies by operating system. Windows tends to be more memory-hungry than Linux, so consider adding 10-20% extra RAM when running on Windows compared to Linux-based systems.

## 2. Development Environment Memory Requirements

| Service                  | Typical use                   | Rationale / source                                                                      |
| ------------------------ | ----------------------------- | --------------------------------------------------------------------------------------- |
| PostgreSQL               | **1 – 2 GB**                 | `shared_buffers` starting point ≈ 25% RAM ([postgresql.org][1])                       |
| Keycloak                 | **≈ 1.3 GB**                 | 70% of limit for heap + ~300 MB non-heap ([keycloak.org][2])                         |
| Redis                    | **≤ 256 MB**                 | Empty instance ≈ 3 MB; budget 256 MB to allow small datasets ([stackoverflow.com][3]) |
| MinIO                    | **2 GB (dev) / 32 GB (prod)**| Pre-allocates 1–2 GiB; docs recommend 32 GB per host for ≤ 100 Ti storage ([min.io][4]) |
| Django API (+ Celery)    | **0.8 – 1.5 GB**              | Empirical in-house metrics                                                              |
| Next.js frontend         | **0.5 – 1 GB**                | Dev build chain                                                                         |
| Y-Provider (y-websocket) | **< 200 MB**                  | Large 40 MB YDoc called “big” in community thread ([discuss.yjs.dev][5])                |
| Nginx                    | **< 100 MB**                  | Static reverse-proxy footprint                                                          |

[1]: https://www.postgresql.org/docs/9.1/runtime-config-resource.html "PostgreSQL: Documentation: 9.1: Resource Consumption"
[2]: https://www.keycloak.org/high-availability/concepts-memory-and-cpu-sizing "Concepts for sizing CPU and memory resources - Keycloak"
[3]: https://stackoverflow.com/questions/45233052/memory-footprint-for-redis-empty-instance "Memory footprint for Redis empty instance - Stack Overflow"
[4]: https://min.io/docs/minio/kubernetes/upstream/operations/checklists/hardware.html "Hardware Checklist — MinIO Object Storage for Kubernetes"
[5]: https://discuss.yjs.dev/t/understanding-memory-requirements-for-production-usage/198 "Understanding memory requirements for production usage - Yjs Community"

> **Rule of thumb:** add 2 GB for OS/overhead, then sum only the rows you actually run.

## 3. Production Environment Memory Requirements

Production deployments differ significantly from development environments. The table below shows typical memory usage for production services:

| Service                  | Typical use                   | Rationale / notes                                                                       |
| ------------------------ | ----------------------------- | --------------------------------------------------------------------------------------- |
| PostgreSQL               | **2 – 8 GB**                 | Higher `shared_buffers` and connection pooling for concurrent users                    |
| OIDC Provider (optional) | **Variable**                  | Any OIDC-compatible provider (Keycloak, Auth0, Azure AD, etc.) - external or self-hosted |
| Redis                    | **256 MB – 2 GB**             | Session storage and caching; scales with active user sessions                          |
| Object Storage (optional)| **External or self-hosted**   | Can use AWS S3, Azure Blob, Google Cloud Storage, or self-hosted MinIO               |
| Django API (+ Celery)    | **1 – 3 GB**                 | Production workloads with background tasks and higher concurrency                      |
| Static Files (Nginx)     | **< 200 MB**                 | Serves Next.js build output and static assets; no development overhead                |
| Y-Provider (y-websocket) | **200 MB – 1 GB**             | Scales with concurrent document editing sessions                                        |
| Nginx (Load Balancer)    | **< 200 MB**                  | Reverse proxy, SSL termination, static file serving                                    |

### Production Architecture Notes

- **Frontend**: Uses pre-built Next.js static assets served by Nginx (no Node.js runtime needed)
- **Authentication**: Any OIDC-compatible provider can be used instead of self-hosted Keycloak
- **Object Storage**: External services (S3, Azure Blob) or self-hosted solutions (MinIO) are both viable
- **Database**: Consider PostgreSQL clustering or managed database services for high availability
- **Scaling**: Horizontal scaling is recommended for Django API and Y-Provider services

### Minimal Production Setup (Core Services Only)

| Service                  | Memory    | Notes                                   |
| ------------------------ | --------- | --------------------------------------- |
| PostgreSQL               | **2 GB**  | Core database                           |
| Django API (+ Celery)    | **1.5 GB**| Backend services                        |
| Y-Provider               | **200 MB**| Real-time collaboration                 |
| Nginx                    | **100 MB**| Static files + reverse proxy           |
| Redis                    | **256 MB**| Session storage                         |
| **Total (without auth/storage)** | **≈ 4 GB** | External OIDC + object storage assumed |

## 4. Recommended Software Versions

| Tool                    | Minimum |
| ----------------------- | ------- |
| Docker Engine / Desktop | 24.0    |
| Docker Compose          | v2      |
| Git                     | 2.40    |
| **Node.js**             | 22+     |
| **Python**              | 3.13+   |
| GNU Make                | 4.4     |
| Kind                    | 0.22    |
| Helm                    | 3.14    |
| kubectl                 | 1.29    |
| mkcert                  | 1.4     |


## 5. Ports (dev defaults)

| Port      | Service               |
| --------- | --------------------- |
| 3000      | Next.js               |
| 8071      | Django                |
| 4444      | Y-Provider            |
| 8080      | Keycloak              |
| 8083      | Nginx proxy           |
| 9000/9001 | MinIO                 |
| 15432     | PostgreSQL (main)     |
| 5433      | PostgreSQL (Keycloak) |
| 1081      | MailCatcher           |

## 6. Sizing Guidelines

**RAM** – start at 8 GB dev / 16 GB staging / 32 GB prod. Postgres and Keycloak are the first to OOM; scale them first.

> **OS considerations:** Windows systems typically require 10-20% more RAM than Linux due to higher OS overhead. Docker Desktop on Windows also uses additional memory compared to native Linux Docker.

**CPU** – budget one vCPU per busy container until Celery or Next.js builds saturate.

**Disk** – SSD; add 10 GB extra for the Docker layer cache.

**MinIO** – for demos, mount a local folder instead of running MinIO to save 2 GB+ of RAM.