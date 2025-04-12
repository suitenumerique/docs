# Deploy and Configure Minio for Docs

## Installation

> \[!CAUTION\]
> We provide those instructions as an example, it should not be run in production. For production environments, deploy MinIO [in a Multi-Node Multi-Drive (Distributed)](https://min.io/docs/minio/linux/operations/install-deploy-manage/deploy-minio-multi-node-multi-drive.html#minio-mnmd) topology

### Step 1: Prepare your working environment:

```bash
mkdir minio
curl -o compose.yaml https://raw.githubusercontent.com/suitenumerique/docs/refs/heads/main/docs/examples/compose/minio/compose.yaml 
```

### Step 2:. Update compose file with your own values

```yaml
version: '3'
services:
  minio:
   ...
    environment:
    - MINIO_ROOT_USER=<Set minio root username>
    - MINIO_ROOT_PASSWORD=<Set minio root password>
```

### Step 3: Expose MinIO instance

#### Option 1: Internal network

You may not need to expose your MinIO instance to the public if only services hosted on the same private network need to access to your MinIO instance.

You should create a docker network that will be shared between those services

```bash
docker network create storage-tier
```

#### Option 2: Public network

If you want to expose your MinIO instance to the public, it needs to be exposed on a domain with SSL termination. You can use our [example](../nginx-proxy/README.md) with an nginx proxy and Let's Encrypt companion for automated creation/renewal of Let's Encrypt certificates using [acme.sh](http://acme.sh).

If following our example, uncomment the environment and network sections in compose file and update it with your values.

```yaml
version: '3'
services:
   docs:
   ...
  minio:
   ...
    environment:
   ...
    # - VIRTUAL_HOST=storage.yourdomain.tld # used by nginx proxy 
    # - VIRTUAL_PORT=9000 # used by nginx proxy
    # - LETSENCRYPT_HOST=storage.yourdomain.tld # used by lets encrypt to generate TLS certificate
   ...
# Uncomment if using our nginx proxy example
#    networks:
#    - proxy-tier
#    - default

# Uncomment if using our nginx proxy example
#networks:
#  proxy-tier:
#    external: true
```

In this example we are only exposing MinIO API service. Follow the official documentation to configure Minio WebUI.

### Step 4: Start the service

```bash
`docker compose up -d`
```

Your minio instance is now available on https://storage.yourdomain.tld

## Creating a user and bucket for your Docs instance

### Installing mc

Follow the [official documentation](https://min.io/docs/minio/linux/reference/minio-mc.html#install-mc) to install mc

### Step 1: Configure `mc` to connect to your MinIO Server with your root user

```shellscript
mc alias set minio <MINIO_SERVER_URL> <MINIO_ROOT_USER> <MINIO_ROOT_PASSWORD>
```

Replace the values with those you have set in the previous steps

### Step 2: Create a new bucket with versioning enabled

```shellscript
mc mb --with-versioning minio/<your-bucket-name>
```

Replace `your-bucket-name` with the desired name for your bucket e.g. `docs-media-storage`

### Additional notes:

For increased security you should create a dedicated user with `readwrite` access to the Bucket. In the following example we will use MinIO root user.
