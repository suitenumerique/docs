# Installation on a k8s cluster

This document is a step-by-step guide that describes how to install Docs on a k8s cluster without AI features. It's a teaching document to learn how it works. It needs to be adapted for a production environment.

## Prerequisites

- k8s cluster with an nginx-ingress controller
- an OIDC provider (if you don't have one, we provide an example)
- a PostgreSQL server (if you don't have one, we provide an example)
- a Memcached server (if you don't have one, we provide an example)
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

## Preparation

### What do you use to authenticate your users?

Docs uses OIDC, so if you already have an OIDC provider, obtain the necessary information to use it. In the next step, we will see how to configure Django (and thus Docs) to use it. If you do not have a provider, we will show you how to deploy a local Keycloak instance (this is not a production deployment, just a demo).

```
$ kubectl create namespace impress
$ kubectl config set-context --current --namespace=impress
$ helm install keycloak oci://registry-1.docker.io/bitnamicharts/keycloak -f examples/keycloak.values.yaml
$ #wait until
$ kubectl get po
NAME                    READY   STATUS    RESTARTS   AGE
keycloak-0              1/1     Running   0          6m48s
keycloak-postgresql-0   1/1     Running   0          6m48s
```

From here the important information you will need are:

```yaml
OIDC_OP_JWKS_ENDPOINT: https://keycloak.127.0.0.1.nip.io/realms/impress/protocol/openid-connect/certs
OIDC_OP_AUTHORIZATION_ENDPOINT: https://keycloak.127.0.0.1.nip.io/realms/impress/protocol/openid-connect/auth
OIDC_OP_TOKEN_ENDPOINT: https://keycloak.127.0.0.1.nip.io/realms/impress/protocol/openid-connect/token
OIDC_OP_USER_ENDPOINT: https://keycloak.127.0.0.1.nip.io/realms/impress/protocol/openid-connect/userinfo
OIDC_OP_LOGOUT_ENDPOINT: https://keycloak.127.0.0.1.nip.io/realms/impress/protocol/openid-connect/session/end
OIDC_RP_CLIENT_ID: impress
OIDC_RP_CLIENT_SECRET: ThisIsAnExampleKeyForDevPurposeOnly
OIDC_RP_SIGN_ALGO: RS256
OIDC_RP_SCOPES: "openid email"
```

You can find these values in **examples/keycloak.values.yaml**

### Find redis server connection values

Docs needs a redis so we start by deploying one:

```
$ helm install redis oci://registry-1.docker.io/bitnamicharts/redis -f examples/redis.values.yaml
$ kubectl get po
NAME                    READY   STATUS    RESTARTS   AGE
keycloak-0              1/1     Running   0          26m
keycloak-postgresql-0   1/1     Running   0          26m
redis-master-0          1/1     Running   0          35s
```

### Find postgresql connection values

Docs uses a postgresql database as backend, so if you have a provider, obtain the necessary information to use it. If you don't, you can install a postgresql testing environment as follow:

```
$ helm install postgresql oci://registry-1.docker.io/bitnamicharts/postgresql -f examples/postgresql.values.yaml
$ kubectl get po
NAME                    READY   STATUS    RESTARTS   AGE
keycloak-0              1/1     Running   0          28m
keycloak-postgresql-0   1/1     Running   0          28m
postgresql-0            1/1     Running   0          14m
redis-master-0          1/1     Running   0          42s
```

From here the important information you will need are:

```yaml
DB_HOST: postgres-postgresql
DB_NAME: impress
DB_USER: dinum
DB_PASSWORD: pass
DB_PORT: 5432
POSTGRES_DB: impress
POSTGRES_USER: dinum
POSTGRES_PASSWORD: pass
```

### Find s3 bucket connection values

Docs uses an s3 bucket to store documents, so if you have a provider obtain the necessary information to use it. If you don't, you can install a local minio testing environment as follow:

```
$ helm install minio oci://registry-1.docker.io/bitnamicharts/minio -f examples/minio.values.yaml
$ kubectl get po
NAME                       READY   STATUS      RESTARTS   AGE
keycloak-0                 1/1     Running     0          38m
keycloak-postgresql-0      1/1     Running     0          38m
minio-84f5c66895-bbhsk     1/1     Running     0          42s
minio-provisioning-2b5sq   0/1     Completed   0          42s
postgresql-0               1/1     Running     0          24m
redis-master-0             1/1     Running     0          10m
```

## Deployment

Now you are ready to deploy Docs without AI. AI requires more dependencies (OpenAI API). To deploy Docs you need to provide all previous information to the helm chart.

```
$ helm repo add impress https://suitenumerique.github.io/docs/
$ helm repo update
$ helm install impress impress/docs -f examples/impress.values.yaml
$ kubectl get po
NAME                                         READY   STATUS      RESTARTS   AGE
impress-docs-backend-96558758d-xtkbp         0/1     Running     0          79s
impress-docs-backend-createsuperuser-r7ltc   0/1     Completed   0          79s
impress-docs-backend-migrate-c949s           0/1     Completed   0          79s
impress-docs-frontend-6749f644f7-p5s42       1/1     Running     0          79s
impress-docs-y-provider-6947fd8f54-78f2l     1/1     Running     0          79s
keycloak-0                                   1/1     Running     0          48m
keycloak-postgresql-0                        1/1     Running     0          48m
minio-84f5c66895-bbhsk                       1/1     Running     0          10m
minio-provisioning-2b5sq                     0/1     Completed   0          10m
postgresql-0                                 1/1     Running     0          34m
redis-master-0                               1/1     Running     0          20m
```

## Test your deployment

In order to test your deployment you have to log into your instance. If you exclusively use our examples you can do:

```
$ kubectl get ingress
NAME                             CLASS    HOSTS                       ADDRESS     PORTS     AGE
impress-docs                     <none>   impress.127.0.0.1.nip.io    localhost   80, 443   114s
impress-docs-admin               <none>   impress.127.0.0.1.nip.io    localhost   80, 443   114s
impress-docs-collaboration-api   <none>   impress.127.0.0.1.nip.io    localhost   80, 443   114s
impress-docs-media               <none>   impress.127.0.0.1.nip.io    localhost   80, 443   114s
impress-docs-ws                  <none>   impress.127.0.0.1.nip.io    localhost   80, 443   114s
keycloak                         <none>   keycloak.127.0.0.1.nip.io   localhost   80        49m
```

You can use Docs at https://impress.127.0.0.1.nip.io. The provisionning user in keycloak is impress/impress.
