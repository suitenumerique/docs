# Collaboration

By default with Docs, collaboration is enabled. To allow the collaboration between users, a connection to a websocket server is made (the yhub service), you only have to configure the Django backend URL and the allowed origin in your yhub service:

```yaml
COLLABORATION_BACKEND_BASE_URL: https://{yourdocsdomain.tld}
COLLABORATION_SERVER_ORIGIN: https://{yourdocsdomain.tld}
```

The collaboration server keeps the live state of a document in Redis and persists it to a PostgreSQL database of its own, so it needs both:

```yaml
REDIS: redis://{redis-host}:6379/0
POSTGRES: postgres://{user}:{password}@{postgres-host}:5432/yhub
```

Nothing creates that schema at startup: the server never runs DDL. Run the script yhub ships (`npm run init-db`, which the helm chart runs as a job) once before starting it, and again after every upgrade that adds a table. It creates the database when it is missing, it is idempotent, and until it has run every document read fails with `relation "..." does not exist`.

The Django backend reads and writes document content there too, so point it at the service:

```yaml
YHUB_API_BASE_URL: http://{yhub-service}:443
```

Prefer the internal service url: the routes the backend calls are not meant to be reachable from the outside. Route `/collaboration/ws/` to the service publicly — that is the one the browsers open — plus the document routes (`/collaboration/ydoc/`, `rollback`, `prune`, `changeset`, `activity`) and `/collaboration/jwks/`, which carries public keys and nothing else. Keep `reset-connections`, `migrate`, `restore-ydoc`, `reset-ydoc` and `create-ydoc` in-cluster.

Both directions are authenticated with short-lived RS256 JWTs rather than a shared secret, and each side verifies the other against the JWKS it publishes — so both need a signing key of their own, and neither needs a copy of the other's:

```yaml
# Django
JWT_PRIVATE_KEY_FILE: /path/to/backend-private.pem
# yhub
YHUB_JWT_PRIVATE_KEY_FILE: /path/to/yhub-private.pem
```

They are ordinary PKCS#8 RSA keys (`openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048`), and rolling one needs no change on the other side. Without them the documents still open and edit, but the backend cannot create, delete or restore a document's content, and yhub cannot tell it that a document changed — its `updated_at` stops following the edits.

### Generating them on the cluster

The helm chart generates both for you, so that no key has to be created by hand, put in a values file or in a secret:

```yaml
jwtKeys:
  enabled: true
```

A job then writes the two keys, once, into a volume every service mounts read-only, and points the backend and yhub at them. It keeps the keys it finds, so it is safe to re-run — it runs on every sync — and rolling a key is deleting it from the volume and letting the next run write a new one. Both sides follow: they pick the verification key by its `kid` and fetch the set again when they meet one they do not know.

Every backend pod and the collaboration server mount that volume, which puts them on several nodes as soon as they have replicas, so the storage class behind it has to support `ReadWriteMany`. On a single node cluster, `jwtKeys.persistence.accessModes: [ReadWriteOnce]` does just as well. The volume outlives the release (`helm.sh/resource-policy: keep`), so uninstalling and installing again keeps the same identities; delete the claim to start over.

Setting `JWT_PRIVATE_KEY_FILE` or `YHUB_JWT_PRIVATE_KEY_FILE` yourself keeps priority over what the job provides, so a deployment holding its keys in a secret of its own can leave `jwtKeys` disabled and mount them where it wants.

Several replicas can serve the same document: they exchange updates through Redis, so no sticky routing is needed on the websocket ingress.

## What happens when connection to the websocket is not allowed?

When multiple users access a Docs and the connection to the websocket is not allowed, then they will be in a situation where they can lose data.
They will lose data because they will erase each other modifications. You can also have a scenario with a mix of users connected to the websocket and some other not.
