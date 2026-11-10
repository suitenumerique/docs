# trixie for glibc >= 2.38 — uws prebuilt binaries reject bookworm's 2.36, and
# there is no musl build of them, so no alpine. This image builds; the production
# one is distroless (see the last stage).
FROM node:22-trixie-slim AS base

# Upgrade system packages to install security updates
RUN apt-get update && \
  apt-get upgrade -y && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app

# built from the repository root, like every other image here
COPY ./src/yhub-server/package.json ./src/yhub-server/yarn.lock ./


# ---- Dependencies + sources ----
# Dev dependencies included (typescript, nodemon, eslint): this stage is the
# base of both the development image and the build stage. `make migrate-yhub`
# also runs its one-off `yarn init-db` here.
FROM base AS yhub-deps

RUN --mount=type=cache,target=/usr/local/share/.cache/yarn,sharing=locked \
  yarn install --frozen-lockfile

# whole directories rather than a glob, so a new module or tsconfig cannot be
# forgotten
COPY ./src/yhub-server/tsconfig.json ./src/yhub-server/tsconfig.build.json ./
COPY ./src/yhub-server/src ./src


# ---- Development image ----
FROM yhub-deps AS yhub-development

# compose bind-mounts the sources over /app on top of this copy, so a host edit
# is seen immediately; these keep the image usable on its own.
COPY ./src/yhub-server/nodemon.json ./src/yhub-server/eslint.config.mjs ./src/yhub-server/vitest.config.mts ./
COPY ./src/yhub-server/__tests__ ./__tests__

EXPOSE 3002

# `yarn dev` recompiles (tsc) and restarts the server on every change under
# src/. nodemon rather than node's own --watch: the latter watches inodes, so
# it goes deaf as soon as a file is replaced by a rename — which is what `git
# checkout` and most editors do when saving.
CMD ["yarn", "dev"]


# ---- Build stage ----
FROM yhub-deps AS yhub-builder

RUN yarn build


# ---- Production dependencies ----
# installed here because the production image has no yarn
FROM base AS yhub-production-deps

RUN --mount=type=cache,target=/usr/local/share/.cache/yarn,sharing=locked \
  yarn install --frozen-lockfile --production


# ---- Production image ----
# Distroless: Debian 13 (same glibc as above) with Node and only the libraries
# it needs — no shell, no package manager, none of the packages whose CVEs the
# scan of the CI kept reporting. The tag follows Debian security updates, so a
# rebuild picks them up. No entrypoint script either: it needs a shell, and
# node does not need an /etc/passwd entry for the arbitrary uid kubernetes may
# run it with.
FROM gcr.io/distroless/nodejs22-debian13 AS yhub

# `node` on the PATH, for the commands of the helm chart and their overrides
ENV PATH=/nodejs/bin:${PATH}

WORKDIR /app

# package.json for its `"type": "module"`, which dist/ needs
COPY --from=yhub-production-deps /app/package.json ./
COPY --from=yhub-production-deps /app/node_modules ./node_modules
COPY --from=yhub-builder /app/dist ./dist

EXPOSE 3002

# Un-privileged user running the application. The server writes nothing outside
# stdout, so it needs no home and no writable path. Defaulted, unlike the other
# images of this repository: the helm chart runs the pod with runAsNonRoot, and
# a build that forgot the argument would produce an image kubernetes refuses to
# start. The group is named too: the distroless image has no passwd entry
# for 1000, which would leave it in group 0.
ARG DOCKER_USER=1000:1000
USER ${DOCKER_USER}

# the base image's entrypoint is node: reset it, so that the command below and
# a `command` set in kubernetes are each the whole command
ENTRYPOINT []

# sentry.js is preloaded so that error reporting is in place before anything else
# is imported; it does nothing without a SENTRY_DSN
CMD ["node", "--import", "./dist/sentry.js", "dist/server.js"]
