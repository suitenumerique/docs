# Installation on a k8s cluster

This document is a step-by-step guide that describes how to install Docs on a k8s cluster without AI features. It's a teaching document to learn how it works. It needs to be adapted for a production environment.

## Prerequisites

- k8s cluster with an nginx-ingress controller
- an OIDC provider (if you don't have one, we provide an example)
- a PostgreSQL server (if you don't have one, we provide an example)
- a Redis server (if you don't have one, we provide an example)
- a S3 bucket (if you don't have one, we provide an example)

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
$ helm install --repo https://suitenumerique.github.io/helm-dev-backend -f docs/examples/helm/keycloak.values.yaml keycloak dev-backend
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

You can find these values in **examples/helm/keycloak.values.yaml**

### Find redis server connection values

Docs needs a redis so we start by deploying one:

```
$ helm install --repo https://suitenumerique.github.io/helm-dev-backend -f docs/examples/helm/redis.values.yaml redis dev-backend
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

### Find postgresql connection values

Docs uses a postgresql database as backend, so if you have a provider, obtain the necessary information to use it. If you don't, you can install a postgresql testing environment as follow:

```
$ helm install --repo https://suitenumerique.github.io/helm-dev-backend -f docs/examples/helm/postgresql.values.yaml postgresql dev-backend
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

### Find s3 bucket connection values

Docs uses an s3 bucket to store documents, so if you have a provider obtain the necessary information to use it. If you don't, you can install a local minio testing environment as follow:

```
$ helm install --repo https://suitenumerique.github.io/helm-dev-backend -f docs/examples/helm/minio.values.yaml minio dev-backend
$ kubectl get pods
NAME                                       READY   STATUS    RESTARTS   AGE
keycloak-dev-backend-keycloak-0            1/1     Running   0          6m12s
keycloak-dev-backend-keycloak-pg-0         1/1     Running   0          6m12s
minio-dev-backend-minio-0                  1/1     Running   0          10s
postgresql-dev-backend-postgres-0          1/1     Running   0          2m43s
redis-dev-backend-redis-68c9f66786-4dgxj   1/1     Running   0          4m21s

```

## Deployment

Now you are ready to deploy Docs without AI. AI requires more dependencies (OpenAI API). To deploy Docs you need to provide all previous information to the helm chart.

```
$ helm repo add impress https://suitenumerique.github.io/docs/
$ helm repo update
$ helm install impress impress/docs -f docs/examples/helm/impress.values.yaml
$ kubectl get po
NAME                                          READY   STATUS    RESTARTS   AGE
impress-docs-backend-8494fb797d-8k8wt         1/1     Running   0          6m45s
impress-docs-celery-worker-764b5dd98f-9qd6v   1/1     Running   0          6m45s
impress-docs-frontend-5b69b65cc4-s8pps        1/1     Running   0          6m45s
impress-docs-y-provider-5fc7ccd8cc-6ttrf      1/1     Running   0          6m45s
keycloak-dev-backend-keycloak-0               1/1     Running   0          24m
keycloak-dev-backend-keycloak-pg-0            1/1     Running   0          24m
minio-dev-backend-minio-0                     1/1     Running   0          8m24s
postgresql-dev-backend-postgres-0             1/1     Running   0          20m
redis-dev-backend-redis-68c9f66786-4dgxj      1/1     Running   0          22m
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

You can use Docs at https://docs.127.0.0.1.nip.io. The provisionning user in keycloak is docs/docs.
