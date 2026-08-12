# trixie for glibc >= 2.38 — uws prebuilt binaries reject bookworm's 2.36
FROM node:22-trixie AS base

WORKDIR /app

COPY package.json package-lock.json ./


# ---- Development image ----
FROM base AS yhub-development

# dev dependencies included: nodemon, plus this is where one-off scripts run
# (`make migrate-yhub` runs `npm run init-db` in it)
RUN npm ci

# server.js, migration.js, env.js — glob so a new module cannot be forgotten.
# compose bind-mounts the sources over /app on top of this copy, so an edit on
# the host is seen immediately; the copy keeps the image usable on its own.
COPY *.js ./

EXPOSE 3002

# `npm run dev` restarts the server on every source change, no rebuild needed.
# nodemon rather than node's own --watch: the latter watches inodes, so it goes
# deaf as soon as a file is replaced by a rename — which is what `git checkout`
# and most editors do when saving.
CMD ["npm", "run", "dev"]


# ---- Production image ----
FROM base AS yhub

RUN npm ci --omit=dev

COPY *.js ./

EXPOSE 3002

CMD ["node", "server.js"]
