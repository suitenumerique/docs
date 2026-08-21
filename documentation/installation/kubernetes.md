# Installation on a k8s cluster

This document is a step-by-step guide that describes how to install Docs on a k8s cluster without AI features. It's a teaching document to learn how it works. It needs to be adapted for a production environment.

## Prerequisites

- k8s cluster with an nginx-ingress controller
- an OIDC provider (if you don't have one, we provide an example)
- a PostgreSQL server (if you don't have one, we provide an example). Two databases are created on it, one for the backend and one for the collaboration server
- a Redis server (if you don't have one, we provide an example)
- a S3 bucket (if you don't have one, we provide an example)

## What gets deployed

The chart deploys four services:

| Deployment | What it does |
| ---------- | ------------ |
| `frontend` | Serves the editor |
| `backend` (and `celery-worker`) | The Django application: documents, users, accesses, search |
| `yhub` | The collaboration server. It holds the **content** of the documents, syncs the editors over the websocket, and the backend reads and writes documents through it |
| `y-provider` | The conversion service (markdown, html, pdf, docx). It served the collaboration in the previous releases, it does not anymore |

plus two jobs that run before them: the Django `migrate` job, and the `yhub`
`init-db` job creating the schema of the collaboration server — it never runs
DDL itself. Both wait for the PostgreSQL server, which nothing in this chart
creates.

The content of a document is not in the S3 bucket: it is in the collaboration
server, in a PostgreSQL database of its own. The bucket keeps the attachments
and the version history.

### Test cluster

If you do not have a test cluster, you can install everything on a local Kind cluster. In this case, the simplest way is to use our script **bin/start-kind.sh**.

To be able to use the script, you need to install:

- Docker (https://docs.docker.com/desktop/)
- Kind (https://kind.sigs.k8s.io/docs/user/quick-start/#installation)
- Mkcert (https://github.com/FiloSottile/mkcert#installation)
- Helm (https://helm.sh/docs/intro/quickstart/#install-helm)

```
./bin/start-kind.sh
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100  4700  100  4700    0     0  92867      0 --:--:-- --:--:-- --:--:-- 94000
0. Create ca
The local CA is already installed in the system trust store! 👍
The local CA is already installed in the Firefox and/or Chrome/Chromium trust store! 👍


Created a new certificate valid for the following names 📜
 - "127.0.0.1.nip.io"
 - "*.127.0.0.1.nip.io"

Reminder: X.509 wildcards only go one level deep, so this won't match a.b.127.0.0.1.nip.io ℹ️

The certificate is at "./127.0.0.1.nip.io+1.pem" and the key at "./127.0.0.1.nip.io+1-key.pem" ✅

It will expire on 24 March 2027 🗓

1. Create registry container unless it already exists
2. Create kind cluster with containerd registry config dir enabled
Creating cluster "suite" ...
 ✓ Ensuring node image (kindest/node:v1.27.3) 🖼
 ✓ Preparing nodes 📦
 ✓ Writing configuration 📜
 ✓ Starting control-plane 🕹️
 ✓ Installing CNI 🔌
 ✓ Installing StorageClass 💾
Set kubectl context to "kind-suite"
You can now use your cluster with:

kubectl cluster-info --context kind-suite

Thanks for using kind! 😊
3. Add the registry config to the nodes
4. Connect the registry to the cluster network if not already connected
5. Document the local registry
configmap/local-registry-hosting created
Warning: resource configmaps/coredns is missing the kubectl.kubernetes.io/last-applied-configuration annotation which is required by kubectl apply. kubectl apply should only be used on resources created declaratively by either kubectl create --save-config or kubectl apply. The missing annotation will be patched automatically.
configmap/coredns configured
deployment.apps/coredns restarted
6. Install ingress-nginx
namespace/ingress-nginx created
serviceaccount/ingress-nginx created
serviceaccount/ingress-nginx-admission created
role.rbac.authorization.k8s.io/ingress-nginx created
role.rbac.authorization.k8s.io/ingress-nginx-admission created
clusterrole.rbac.authorization.k8s.io/ingress-nginx created
clusterrole.rbac.authorization.k8s.io/ingress-nginx-admission created
rolebinding.rbac.authorization.k8s.io/ingress-nginx created
rolebinding.rbac.authorization.k8s.io/ingress-nginx-admission created
clusterrolebinding.rbac.authorization.k8s.io/ingress-nginx created
clusterrolebinding.rbac.authorization.k8s.io/ingress-nginx-admission created
configmap/ingress-nginx-controller created
service/ingress-nginx-controller created
service/ingress-nginx-controller-admission created
deployment.apps/ingress-nginx-controller created
job.batch/ingress-nginx-admission-create created
job.batch/ingress-nginx-admission-patch created
ingressclass.networking.k8s.io/nginx created
validatingwebhookconfiguration.admissionregistration.k8s.io/ingress-nginx-admission created
secret/mkcert created
deployment.apps/ingress-nginx-controller patched
7. Setup namespace
namespace/impress created
Context "kind-suite" modified.
secret/mkcert created
$ kubectl -n ingress-nginx get po
NAME                                        READY   STATUS      RESTARTS   AGE
ingress-nginx-admission-create-t55ph        0/1     Completed   0          2m56s
ingress-nginx-admission-patch-94dvt         0/1     Completed   1          2m56s
ingress-nginx-controller-57c548c4cd-2rx47   1/1     Running     0          2m56s
```

When your k8s cluster is ready (the ingress nginx controller is up), you can start the deployment. This cluster is special because it uses the `*.127.0.0.1.nip.io` domain and mkcert certificates to have full HTTPS support and easy domain name management.

Please remember that `*.127.0.0.1.nip.io` will always resolve to `127.0.0.1`, except in the k8s cluster where we configure CoreDNS to answer with the ingress-nginx service IP.

The namespace `impress` is already created, you can work in it and configure your kubectl cli to use it by default.

```
$ kubectl config set-context --current --namespace=impress
```

## Preparation

We provide our own helm chart for all development dependencies, it is available here https://github.com/suitenumerique/helm-dev-backend
This provided chart is for development purpose only and is not ready to use in production.

You can install it on your cluster to deploy keycloak, minio, postgresql and redis.

### What do you use to authenticate your users?

Docs uses OIDC, so if you already have an OIDC provider, obtain the necessary information to use it. In the next step, we will see how to configure Django (and thus Docs) to use it. If you do not have a provider, we will show you how to deploy a local Keycloak instance (this is not a production deployment, just a demo).

```
$ helm install --repo https://suitenumerique.github.io/helm-dev-backend -f documentation/examples/helm/keycloak.values.yaml keycloak dev-backend
$ #wait until
$ kubectl get pods
NAME                                 READY   STATUS    RESTARTS   AGE
keycloak-dev-backend-keycloak-0      1/1     Running   0          20s
keycloak-dev-backend-keycloak-pg-0   1/1     Running   0          20s
```

From here the important information you will need are:

```yaml
OIDC_OP_JWKS_ENDPOINT: https://docs-keycloak.127.0.0.1.nip.io/realms/impress/protocol/openid-connect/certs
OIDC_OP_AUTHORIZATION_ENDPOINT: https://docs-keycloak.127.0.0.1.nip.io/realms/impress/protocol/openid-connect/auth
OIDC_OP_TOKEN_ENDPOINT: https://docs-keycloak.127.0.0.1.nip.io/realms/impress/protocol/openid-connect/token
OIDC_OP_USER_ENDPOINT: https://docs-keycloak.127.0.0.1.nip.io/realms/impress/protocol/openid-connect/userinfo
OIDC_OP_LOGOUT_ENDPOINT: https://docs-keycloak.127.0.0.1.nip.io/realms/impress/protocol/openid-connect/logout
OIDC_RP_CLIENT_ID: impress
OIDC_RP_CLIENT_SECRET: ThisIsAnExampleKeyForDevPurposeOnly
OIDC_RP_SIGN_ALGO: RS256
OIDC_RP_SCOPES: "openid email"
```

You can find these values in **documentation/examples/helm/keycloak.values.yaml**

### Find redis server connection values

Docs needs a redis so we start by deploying one:

```
$ helm install --repo https://suitenumerique.github.io/helm-dev-backend -f documentation/examples/helm/redis.values.yaml redis dev-backend
$ kubectl get pods
NAME                                       READY   STATUS    RESTARTS   AGE
keycloak-dev-backend-keycloak-0            1/1     Running   0          113s
keycloak-dev-backend-keycloak-pg-0         1/1     Running   0          113s
redis-dev-backend-redis-68c9f66786-4dgxj   1/1     Running   0          2s
```

From here the important information you will need are:

```yaml
REDIS_URL: redis://user:pass@redis-dev-backend-redis:6379/1
DJANGO_CELERY_BROKER_URL: redis://user:pass@redis-dev-backend-redis:6379/1
```

The collaboration server needs one too, under `yhub.envVars.REDIS`. This example
puts it in another database of the same server:

```yaml
REDIS: redis://user:pass@redis-dev-backend-redis:6379/2
REDIS_PREFIX: yhub
```

> [!NOTE]
> In production, give it an instance of its own. It is not a cache: it holds the
> updates that no worker has written to PostgreSQL yet, so it has to be durable
> and must never evict a key it was not told to expire.

### Find postgresql connection values

Docs uses a postgresql database as backend, so if you have a provider, obtain the necessary information to use it. If you don't, you can install a postgresql testing environment as follow:

```
$ helm install --repo https://suitenumerique.github.io/helm-dev-backend -f documentation/examples/helm/postgresql.values.yaml postgresql dev-backend
$ kubectl get pods
NAME                                       READY   STATUS    RESTARTS   AGE
keycloak-dev-backend-keycloak-0            1/1     Running   0          3m42s
keycloak-dev-backend-keycloak-pg-0         1/1     Running   0          3m42s
postgresql-dev-backend-postgres-0          1/1     Running   0          13s
redis-dev-backend-redis-68c9f66786-4dgxj   1/1     Running   0          111s

```

From here the important information you will need are:

```yaml
DB_HOST: postgresql-dev-backend-postgres
DB_NAME:
    secretKeyRef:
        name: postgresql-dev-backend-postgres
        key: database
DB_USER:
    secretKeyRef:
        name: postgresql-dev-backend-postgres
        key: username
DB_PASSWORD:
    secretKeyRef:
        name: postgresql-dev-backend-postgres
        key: password
DB_PORT: 5432
```

The collaboration server keeps its own database on that same server, configured
as a single url under `yhub.envVars.POSTGRES`:

```yaml
POSTGRES: postgres://dinum:pass@postgresql-dev-backend-postgres:5432/yhub
```

Being one url, the credentials are in it — put the whole url in a secret and
reference it with `secretKeyRef` if you would rather not have it in your values
file. The `init-db` job creates that database when the user is allowed to;
otherwise create an empty `yhub` database beforehand and grant it on that one.

### Find s3 bucket connection values

Docs uses an s3 bucket to store documents, so if you have a provider obtain the necessary information to use it. If you don't, you can install a local minio testing environment as follow:

```
$ helm install --repo https://suitenumerique.github.io/helm-dev-backend -f documentation/examples/helm/minio.values.yaml minio dev-backend
$ kubectl get pods
NAME                                       READY   STATUS    RESTARTS   AGE
keycloak-dev-backend-keycloak-0            1/1     Running   0          6m12s
keycloak-dev-backend-keycloak-pg-0         1/1     Running   0          6m12s
minio-dev-backend-minio-0                  1/1     Running   0          10s
postgresql-dev-backend-postgres-0          1/1     Running   0          2m43s
redis-dev-backend-redis-68c9f66786-4dgxj   1/1     Running   0          4m21s

```

### Signing keys of the services

The backend and the collaboration server call each other, and sign those calls:
each has an RSA key of its own and verifies the other against the JWKS it
publishes, so neither holds a copy of the other's key and no shared secret is
involved. The chart generates both for you:

```yaml
jwtKeys:
  enabled: true
```

A job creates them once, with `openssl`, in a secret that the backend and the
collaboration server mount read-only — no key is written in a values file or
templated into a manifest. It leaves an existing secret alone, so it is safe on
every sync, and rolling the keys is deleting the secret and letting the next run
create it again. If you already hold your keys in a secret,
`jwtKeys.existingSecret` points at it instead and the job is not created at all.

This is in **documentation/examples/helm/impress.values.yaml**, and the
[collaboration documentation](../collaboration.md) covers it in more detail.

## Deployment

Now you are ready to deploy Docs without AI. AI requires more dependencies (OpenAI API). To deploy Docs you need to provide all previous information to the helm chart.

```
$ helm repo add impress https://suitenumerique.github.io/docs/
$ helm repo update
$ helm install impress impress/docs -f documentation/examples/helm/impress.values.yaml
$ kubectl get po
NAME                                          READY   STATUS    RESTARTS   AGE
impress-docs-backend-8494fb797d-8k8wt         1/1     Running   0          6m45s
impress-docs-celery-worker-764b5dd98f-9qd6v   1/1     Running   0          6m45s
impress-docs-frontend-5b69b65cc4-s8pps        1/1     Running   0          6m45s
impress-docs-y-provider-5fc7ccd8cc-6ttrf      1/1     Running   0          6m45s
impress-docs-yhub-6d84f9b7c5-2xqzp            1/1     Running   0          6m45s
keycloak-dev-backend-keycloak-0               1/1     Running   0          24m
keycloak-dev-backend-keycloak-pg-0            1/1     Running   0          24m
minio-dev-backend-minio-0                     1/1     Running   0          8m24s
postgresql-dev-backend-postgres-0             1/1     Running   0          20m
redis-dev-backend-redis-68c9f66786-4dgxj      1/1     Running   0          22m
```

The jobs are not in that list anymore: the `migrate` one, the `jwt-keys` one and
the `yhub` `init-db` one ran and were removed, 30 seconds after they finished.
If the collaboration server never becomes ready, that is where to look first —
raise `yhub.jobs.ttlSecondsAfterFinished` to keep the job around long enough to
read it:

```
$ kubectl get jobs
$ kubectl logs job/impress-docs-yhub-init-db
```

## Test your deployment

In order to test your deployment you have to log into your instance. If you exclusively use our examples you can do:

```
$ kubectl get ingress
NAME                              CLASS    HOSTS                                 ADDRESS     PORTS     AGE
impress-docs                      <none>   docs.127.0.0.1.nip.io                 localhost   80, 443   7m9s
impress-docs-admin                <none>   docs.127.0.0.1.nip.io                 localhost   80, 443   7m9s
impress-docs-collaboration-api    <none>   docs.127.0.0.1.nip.io                 localhost   80, 443   7m9s
impress-docs-media                <none>   docs.127.0.0.1.nip.io                 localhost   80, 443   7m9s
impress-docs-ws                   <none>   docs.127.0.0.1.nip.io                 localhost   80, 443   7m9s
keycloak-dev-backend-keycloak     <none>   docs-keycloak.127.0.0.1.nip.io        localhost   80, 443   24m
minio-dev-backend-minio-api       <none>   docs-minio.127.0.0.1.nip.io           localhost   80, 443   8m48s
minio-dev-backend-minio-console   <none>   docs-minio-console.127.0.0.1.nip.io   localhost   80, 443   8m48s
```

You can use Docs at https://docs.127.0.0.1.nip.io. The provisioning user in keycloak is docs/docs.
