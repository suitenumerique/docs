# Installation with docker compose

We provide a sample configuration for running Docs using Docker Compose. Please note that this configuration is experimental, and the official way to deploy Docs in production is to use [k8s](../installation/kubernetes.md)

## Requirements

- A modern version of Docker and its Compose plugin.
- A domain name and DNS configured to your server.
- An Identity Provider that supports OpenID Connect protocol - we provide [an example to deploy Keycloak](../examples/compose/keycloak/README.md).
- An Object Storage that implements S3 API - we provide [an example to deploy Minio](../examples/compose/minio/README.md).
- A Postgresql database - we provide [an example in the compose file](../examples/compose/compose.yaml). Two databases are needed on it, one for the backend and one for the collaboration server.
- A Redis database - we provide [an example in the compose file](../examples/compose/compose.yaml).
- A Valkey (or Redis) instance for the collaboration server, separate from the one above - we provide [an example in the compose file](../examples/compose/compose.yaml).

## The services

Docs is made of four services, all of them in the example compose file beside
their stores:

| Service | What it does |
| ------- | ------------ |
| `frontend` | Serves the editor, and is the nginx proxy routing everything else |
| `backend` | The Django application: documents, users, accesses, search |
| `yhub` | The collaboration server. It holds the **content** of the documents, syncs the editors over the websocket, and the backend reads and writes documents through it |
| `y-provider` | The conversion service (markdown, html, pdf, docx). It served the collaboration in the previous releases, it does not anymore |
| `postgresql`, `redis`, `yhub-valkey` | The stores |

The content of a document is not in the object storage: it is in the
collaboration server, in its own PostgreSQL database. The object storage keeps
the attachments and the version history. This matters when you upgrade an
instance that ran before the collaboration server existed — see [the last
section of this page](#upgrading-from-a-release-without-the-collaboration-server).

## Software Requirements

Ensure you have Docker Compose(v2) installed on your host server. Follow the official guidelines for a reliable setup:

Docker Compose is included with Docker Engine:

- **Docker Engine:** We suggest adhering to the instructions provided by Docker
  for [installing Docker Engine](https://docs.docker.com/engine/install/).

For older versions of Docker Engine that do not include Docker Compose:

- **Docker Compose:** Install it as per the [official documentation](https://docs.docker.com/compose/install/).

> [!NOTE]
> `docker-compose` may not be supported. You are advised to use `docker compose` instead.

## Step 1: Prepare your working environment:

```bash
mkdir -p docs/env.d
cd docs
curl -o compose.yaml https://raw.githubusercontent.com/suitenumerique/docs/refs/heads/main/documentation/examples/compose/compose.yaml
curl -o env.d/common https://raw.githubusercontent.com/suitenumerique/docs/refs/heads/main/env.d/production.dist/common
curl -o env.d/backend https://raw.githubusercontent.com/suitenumerique/docs/refs/heads/main/env.d/production.dist/backend
curl -o env.d/yprovider https://raw.githubusercontent.com/suitenumerique/docs/refs/heads/main/env.d/production.dist/yprovider
curl -o env.d/yhub https://raw.githubusercontent.com/suitenumerique/docs/refs/heads/main/env.d/production.dist/yhub
curl -o env.d/postgresql https://raw.githubusercontent.com/suitenumerique/docs/refs/heads/main/env.d/production.dist/postgresql
```

If you are using the sample nginx-proxy configuration:
```bash
curl -o default.conf.template https://raw.githubusercontent.com/suitenumerique/docs/refs/heads/main/docker/files/production/etc/nginx/conf.d/default.conf.template
```

## Step 2: Configuration

Docs configuration is achieved through environment variables. We provide a [detailed description of all variables](../env.md).

In this example, we assume the following services:

- OIDC provider on https://id.yourdomain.tld
- Object Storage on https://storage.yourdomain.tld
- Docs on https://docs.yourdomain.tld
- Bucket name is docs-media-storage

**Set your own values in `env.d/common`**

### OIDC

Authentication in Docs is managed through Open ID Connect protocol. A functional Identity Provider implementing this protocol is required.

For guidance, refer to our [Keycloak deployment example](../examples/compose/keycloak/README.md).

If using Keycloak as your Identity Provider, set `OIDC_RP_CLIENT_ID` and `OIDC_RP_CLIENT_SECRET` variables with those of the OIDC client created for Docs. By default we have set `docs` as the realm name, if you have named your realm differently, update the value `REALM_NAME` in `env.d/common`

For others OIDC providers, update the variables in `env.d/backend`.

### Object Storage

Files and media are stored in an Object Store that supports the S3 API.

For guidance, refer to our [Minio deployment example](../examples/compose/minio/README.md).

Set `AWS_S3_ACCESS_KEY_ID` and `AWS_S3_SECRET_ACCESS_KEY` with the credentials of a user with `readwrite` access to the bucket created for Docs.

### Postgresql

Docs uses PostgreSQL as its database. Although an external PostgreSQL can be used, our example provides a deployment method.

If you are using the example provided, you need to generate a secure key for `DB_PASSWORD` and set it in `env.d/postgresql`. 

If you are using an external service or not using our default values, you should update the variables in `env.d/postgresql`

The collaboration server keeps its own database on the same server, `yhub`,
whose connection string is `POSTGRES` in `env.d/yhub` — set the same password
there. The `init-db` step below creates that database when the user is allowed
to; if yours is not, create an empty `yhub` database beforehand and grant it on
that one.

### Redis

Docs uses Redis for caching. While an external Redis can be used, our example provides a deployment method.

If you are using an external service, you need to set `REDIS_URL` environment variable in `env.d/backend`.

The collaboration server has a Valkey of its own, `yhub-valkey`, configured
with `REDIS` in `env.d/yhub`. Give it an instance apart rather than the one
above: it is not a cache, it holds the updates that no worker has written to
PostgreSQL yet, so it has to be durable and must never evict a key it was not
told to expire. Our example configures it accordingly (append-only file,
`volatile-lru`).

### Collaboration server

The collaboration server (`yhub`) synchronizes the editors over the websocket
and holds the content of the documents. It authenticates with the backend, and
the backend with it, using RS256 keys — each service signs with its own key and
verifies the other against the JWKS it publishes, so no secret is shared.
Generate the two keys next to your compose file:

```bash
mkdir -p keys
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out keys/private.pem
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out keys/yhub-private.pem
chmod 600 keys/*.pem
# readable by the uid the containers run as (DOCKER_USER, 1000 by default)
sudo chown 1000:1000 keys/*.pem
```

`keys/private.pem` is the backend's (`JWT_PRIVATE_KEY_FILE` in `env.d/backend`)
and `keys/yhub-private.pem` is the collaboration server's
(`YHUB_JWT_PRIVATE_KEY_FILE` in `env.d/yhub`). Never give the same key to both,
and treat them as secrets: either one signs calls the other trusts.

Then set in `env.d/yhub`:

- `POSTGRES` and `REDIS`, the two stores above,
- `Y_PROVIDER_API_KEY`, **the same value** as the one you generate in
  `env.d/yprovider` below. It is the header exempting the collaboration server
  from the API throttling of the backend, which it calls once per connection.

`COLLABORATION_SERVER_ORIGIN` lists the origins a browser may open a websocket
from, and `COLLABORATION_BACKEND_BASE_URL` is the backend it asks who a user is
and what they may do — both default to your `DOCS_HOST`.

### Y Provider

The Y provider service converts documents between formats (markdown, html, pdf,
docx). It no longer serves the collaboration.

Generates a secure key for `Y_PROVIDER_API_KEY` in ``env.d/yprovider``, and
repeat it in `env.d/yhub`.

### Docs

The Docs backend is built on the Django Framework.

Generates a secure key for `DJANGO_SECRET_KEY` in `env.d/backend`. 

### Logging

Update the following variables in `env.d/backend` if you want to change the logging levels:
```env
LOGGING_LEVEL_HANDLERS_CONSOLE=DEBUG
LOGGING_LEVEL_LOGGERS_ROOT=DEBUG
LOGGING_LEVEL_LOGGERS_APP=DEBUG
```

### Mail

The following environment variables are required in `env.d/backend` for the mail service to send invitations :

```env
DJANGO_EMAIL_HOST=<smtp host> 
DJANGO_EMAIL_HOST_USER=<smtp user> 
DJANGO_EMAIL_HOST_PASSWORD=<smtp password>
DJANGO_EMAIL_PORT=<smtp port> 
DJANGO_EMAIL_FROM=<your email address>

#DJANGO_EMAIL_USE_TLS=true # A flag to enable or disable TLS for email sending.
#DJANGO_EMAIL_USE_SSL=true # A flag to enable or disable SSL for email sending.


DJANGO_EMAIL_BRAND_NAME=<brand name used in email templates> # e.g. "La Suite Numérique"
DJANGO_EMAIL_LOGO_IMG=<logo image to use in email templates.> # e.g. "https://docs.yourdomain.tld/assets/logo-suite-numerique.png" 
DJANGO_EMAIL_URL_APP=<url used in email templates to go to the app> # e.g. "https://docs.yourdomain.tld"
```

### AI

Built-in AI actions let users generate, summarize, translate, and correct content.

AI is disabled by default. To enable it, the following environment variables must be set in `env.d/backend`:

```env
AI_FEATURE_ENABLED=true # is false by default
AI_FEATURE_BLOCKNOTE_ENABLED=true # is false by default
AI_FEATURE_LEGACY_ENABLED=true # is true by default, AI_FEATURE_ENABLED must be set to true to enable it 
AI_BASE_URL=https://openaiendpoint.com
AI_API_KEY=<API key>
AI_MODEL=<model used> e.g. llama
```

### Frontend theme

You can [customize your Docs instance](../theming.md) with your own theme and custom css.

The following environment variables must be set in `env.d/backend`:

```env
FRONTEND_THEME=default # name of your theme built with Cunningham
FRONTEND_CSS_URL=https://storage.yourdomain.tld/themes/custom.css # custom css
```

## Step 3: Reverse proxy and SSL/TLS

> [!WARNING]
> In a production environment, configure SSL/TLS termination to run your instance on https.

If you have your own certificates and proxy setup, you can skip this part.

You can follow our [nginx proxy example](../examples/compose/nginx-proxy/README.md) with automatic generation and renewal of certificate with Let's Encrypt. 

You will need to uncomment the environment and network sections in compose file and update it with your values.

```yaml
  frontend:
    ...
    # Uncomment and set your values if using our nginx proxy example
    #environment:
    # - VIRTUAL_HOST=${DOCS_HOST} # used by nginx proxy 
    # - VIRTUAL_PORT=8083 # used by nginx proxy
    # - LETSENCRYPT_HOST=${DOCS_HOST} # used by lets encrypt to generate TLS certificate
    ...
# Uncomment if using our nginx proxy example
#    networks:
#    - proxy-tier
#
#networks:
#  proxy-tier:
#    external: true
```

## Step 4: Create the schema of the collaboration server

The collaboration server never runs DDL itself, so its schema has to be created
before it starts:

```bash
docker compose run --rm yhub npm run init-db
```

It creates the `yhub` database when it is missing, and every table the version
you are installing needs. It is idempotent, so re-running it is always safe —
and it has to be re-run after every upgrade, see below. Until it has run, the
collaboration server answers every read with a `relation "..." does not exist`
error and stays unhealthy.

## Step 5: Start Docs

You are ready to start your Docs application !

```bash
docker compose up -d
```
> [!NOTE]
> Version of the images are set to latest, you should pin it to the desired version to avoid unwanted upgrades when pulling latest image.

## Step 6: Run the database migration and create Django admin user

```bash
docker compose run --rm backend python manage.py migrate
docker compose run --rm backend python manage.py createsuperuser --email <admin email> --password <admin password>
```

Replace `<admin email>` with the email of your admin user and generate a secure password. 

Your docs instance is now available on the domain you defined, https://docs.yourdomain.tld.

The admin interface is available on https://docs.yourdomain.tld/admin with the admin user you just created.

## How to upgrade your Docs application

Before running an upgrade you must check the [Upgrade document](../../UPGRADE.md) for specific procedures that might be needed.

You can also check the [Changelog](../../CHANGELOG.md) for brief summary of the changes.

### Step 1: Edit the images tag with the desired version

### Step 2: Pull the images

```bash
docker compose pull
```

### Step 3: Restart your containers

```bash
docker compose restart
```

### Step 4: Run the database migrations
Your database schemas may need to be updated. The backend's:
```bash
docker compose run --rm backend python manage.py migrate
```
and the collaboration server's, which is the same command as at install time:
```bash
docker compose run --rm yhub npm run init-db
```

## Upgrading from a release without the collaboration server

Documents created before the collaboration server existed have their content in
the object storage, one object per document at key `{document-id}/file`, and the
collaboration server starts out knowing none of them. It has to be handed the
corpus, otherwise those documents open **empty**.

1. Before letting anyone in, uncomment the `SOFT_MIGRATION` block of
   `env.d/yhub` and point it at your media bucket (`LEGACY_S3_ENDPOINT_URL`,
   `LEGACY_S3_ACCESS_KEY_ID`, `LEGACY_S3_SECRET_ACCESS_KEY`,
   `LEGACY_S3_BUCKET_NAME`). Read-only credentials scoped to that bucket are
   enough — this service terminates untrusted traffic, do not give it the
   backend's read-write keys. A document is then migrated from its legacy
   object the first time someone opens it.
2. Then migrate the whole corpus, which that lazy migration never finishes on
   its own — a document nobody opens stays in the bucket forever:

   ```bash
   docker compose run --rm backend python manage.py migrate_documents
   ```

   It hands every document to the collaboration server, which replays its full
   version history. The run is resumable and safe to repeat: what became of
   every document is recorded, and `--retry-failed` picks up the ones that
   failed. `--dry-run` counts what it would do, and `--concurrency`, `--rate`
   and `--limit` bound it.

Only once that run has covered the corpus may `SOFT_MIGRATION` be commented out
again. And keep the media bucket, its objects and its versioning either way:
the version history of a document is still served from there.

The full procedure, including what changes in the environment variables of an
existing instance, is in the [Upgrade document](../../UPGRADE.md).
