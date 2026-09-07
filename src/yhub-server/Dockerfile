# trixie for glibc >= 2.38 — uws prebuilt binaries reject bookworm's 2.36
FROM node:22-trixie AS base

WORKDIR /app

# built from the repository root, like every other image here — the entrypoint
# below lives outside this directory
COPY ./src/yhub-server/package.json ./src/yhub-server/yarn.lock ./


# ---- Dependencies + sources ----
# Dev dependencies included (typescript, nodemon, eslint): this stage is the
# base of both the development image and the build stage. `make migrate-yhub`
# also runs its one-off `yarn init-db` here.
FROM base AS yhub-deps

RUN yarn install --frozen-lockfile

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


# ---- Production image ----
FROM base AS yhub

RUN yarn install --frozen-lockfile --production

COPY --from=yhub-builder /app/dist ./dist

EXPOSE 3002

# Same entrypoint as the other services: it gives the container user an entry in
# /etc/passwd, which an arbitrary uid (kubernetes runAsUser) does not have. The
# group needs the same rights as the owner on /etc/passwd for it to write there.
COPY ./docker/files/usr/local/bin/entrypoint /usr/local/bin/entrypoint
RUN chmod g=u /etc/passwd

# Un-privileged user running the application. The server writes nothing outside
# stdout, so it needs no home and no writable path. Defaulted, unlike the other
# images of this repository: the helm chart runs the pod with runAsNonRoot, and
# a build that forgot the argument would produce an image kubernetes refuses to
# start.
ARG DOCKER_USER=1000
USER ${DOCKER_USER}

ENTRYPOINT [ "/usr/local/bin/entrypoint" ]

CMD ["node", "dist/server.js"]
