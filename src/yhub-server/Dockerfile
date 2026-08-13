# trixie for glibc >= 2.38 — uws prebuilt binaries reject bookworm's 2.36
FROM node:22-trixie AS base

WORKDIR /app

# built from the repository root, like every other image here — the entrypoint
# below lives outside this directory
COPY ./src/yhub-server/package.json ./src/yhub-server/package-lock.json ./


# ---- Development image ----
FROM base AS yhub-development

# dev dependencies included: nodemon, plus this is where one-off scripts run
# (`make migrate-yhub` runs `npm run init-db` in it)
RUN npm ci

# server.js, migration.js, env.js — glob so a new module cannot be forgotten.
# compose bind-mounts the sources over /app on top of this copy, so an edit on
# the host is seen immediately; the copy keeps the image usable on its own.
COPY ./src/yhub-server/*.js ./

EXPOSE 3002

# `npm run dev` restarts the server on every source change, no rebuild needed.
# nodemon rather than node's own --watch: the latter watches inodes, so it goes
# deaf as soon as a file is replaced by a rename — which is what `git checkout`
# and most editors do when saving.
CMD ["npm", "run", "dev"]


# ---- Production image ----
FROM base AS yhub

RUN npm ci --omit=dev

COPY ./src/yhub-server/*.js ./

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

CMD ["node", "server.js"]
