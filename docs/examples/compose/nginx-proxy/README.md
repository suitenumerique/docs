# Nginx proxy with automatic SSL certificates

> \[!CAUTION\]
> We provide those instructions as an example, for extended development or production environments, you should follow the [official documentation](https://github.com/nginx-proxy/acme-companion/tree/main/docs).

Nginx-proxy sets up a container running nginx and docker-gen. docker-gen generates reverse proxy configs for nginx and reloads nginx when containers are started and stopped.

Acme-companion is a lightweight companion container for nginx-proxy. It handles the automated creation, renewal and use of SSL certificates for proxied Docker containers through the ACME protocol.

## Installation

### Step 1: Prepare your working environment:

```bash
mkdir nginx-proxy
curl -o compose.yaml https://raw.githubusercontent.com/suitenumerique/docs/refs/heads/main/docs/examples/compose/nginx-proxy/compose.yaml
```

### Step 2: Edit `DEFAULT_EMAIL` in the compose file.

Albeit optional, it is recommended to provide a valid default email address through the `DEFAULT_EMAIL` environment variable, so that Let's Encrypt can warn you about expiring certificates and allow you to recover your account.

### Step 3: Create docker network

Containers need share the same network for auto-discovery.

```bash
docker network create proxy-tier
```

### Step 4: Start service

```bash
docker compose up -d
```

## Usage

Once both nginx-proxy and acme-companion containers are up and running, start any container you want proxied with environment variables `VIRTUAL_HOST` and `LETSENCRYPT_HOST` both set to the domain(s) your proxied container is going to use.
