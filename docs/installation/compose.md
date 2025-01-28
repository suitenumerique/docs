# Installation with docker compose

We provide a configuration for running Docs in production using docker compose. This configuration is experimental, the official way to deploy Docs in production is to use [k8s](docs/installation/k8s.md)

## Requirements

- A modern version of Docker and its Compose plugin.
- SSL certificates for Docs domain and Keycloak.
- Two domain name. One for the Docs application and an other one for Keycloak. Both can be a subdomain of a common domain. (example: docs.domain.tld and keycloak.domain.tld)

## Installation

- Clone this repository: `git clone https://github.com/suitenumerique/docs.git`
- Then in the clone directory you can run the following command: `make bootsrap-production`

## Configure your ssl certificates

You have to provide the ssl certificates. The easiest way is to use [certbot](https://certbot.eff.org/), generate the certificates with it (both for Docs and Keycloak) and then mount them in ingress and keycloak containers. Two environment variables can be used for that: 
- `DOCS_PROD_NGINX_CERT_FOLDER` path to the folder containing the certificates for Docs. This folder will be mounted in `/etc/nginx/ssl` in the container. You have to adapt the certificates name in the file `docker/files/production/etc/nginx/conf.d/default.conf` accordingly with the certificates name you have (see `ssl_certificate` and `ssl_certificate_key` directives).
- `DOCS_PROD_KEYCLOAK_CERT_FOLDER` path to the folder containing the certificates for Keycloak. This folder will be mounted in `/etc/ssl/certs` in the container. You have to adapt the certificates name in the configuration file in `env.d/production/keycloak` to add the correct path for environment variables `KC_HTTPS_CERTIFICATE_FILE` and `KC_HTTPS_CERTIFICATE_KEY_FILE`.

### Configuration

All the configuration files are in the directory `env.d/production`. You have to edit all the files to complete them. For the OIDC information you will have them once Keycloak will be running and you have configured your own realm on it.

#### env.d/production/minio

All the settings related to Minio. You have to set a username and a password to manage the minio cluster. You will need them later in the `env.d/production/backend` file.

#### env.d/production/postgresql

All the settings related to the Postgresql database used by the Django application.

#### env.d/production/yprovider

All the settings related to the collaboration server. All the secret and api key must be generated.

#### env.d/production/kc_postgresql

All the settings related to the Postgresql database used by keycloak.

#### env.d/production/keycloak

All the settings related to the Keycloak application.

#### env.d/production/backend

All the settings related to the Django application. Only the settings you don't have for now are all the one related to OIDC. You will have them once the compose started and you can access to Keycloak.

## Run the compose configuration

The compose configuration can be run with the following command: `make run-production`. The first start can be a little bit long, lots of things are created. Once started you can check that everything is running with the following command: `COMPOSE_FILE=compose.production.yaml ./bin/compose ps`

## Configure keycloak

You have to create a new realm in your Keycloak and once created you have to create a new OIDC client in it. You will use this client to configure the OIDC part in `env.d/production/backend`. This is the last missing part to complete the Django application configuration.
Once the client information set in `env.d/production/backend` you have to start the containers again by running the commande `make run-production`. The command will recreate the containers with the good configuration.

### Helpers

there is a helper script to control the `docker compose` command. You can export the variable `COMPOSE_FILE` with the compose filename (`export COMPOSE_FILE=compose.production.yaml`). After you can run `./bin/compose` to run the docker compose command line.

Makefile commands available:
- `make bootstrap-production`: create the configuration files in `env.d/production`, create the directories : `data/production`. Both directories must be backup, if you loose them you loose all the data related to the application.
- `make run-production`: up the ingress containers. Will start all the containers needed in cascade.
- `make stop-production`: stop all the containers.
