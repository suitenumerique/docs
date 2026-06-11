# uws (a @y/hub dependency) only ships glibc prebuilt binaries requiring
# glibc >= 2.38: this image must stay on a Debian >= 13 (trixie) Node image.
# Switching to alpine/musl or an older Debian would fail at RUNTIME (not
# build time) when loading uws_linux_*.node.
FROM node:22-trixie-slim AS base

# Upgrade system packages to install security updates.
# git is required by yarn to fetch the uws dependency (git+https).
RUN apt-get update && \
  apt-get upgrade -y && \
  apt-get install -y --no-install-recommends git ca-certificates && \
  rm -rf /var/lib/apt/lists/*

FROM base AS yhub-deps

WORKDIR /home/frontend/

COPY ./src/frontend/package.json ./package.json
COPY ./src/frontend/yarn.lock ./yarn.lock
COPY ./src/frontend/servers/yhub/package.json ./servers/yhub/package.json
COPY ./src/frontend/packages/eslint-plugin-docs/package.json ./packages/eslint-plugin-docs/package.json

# yarn v1 caches every package of the workspace lockfile (several GB);
# clean it in the same layer to keep the image small.
RUN yarn install && yarn cache clean

COPY ./src/frontend/packages/eslint-plugin-docs ./packages/eslint-plugin-docs
COPY ./src/frontend/servers/yhub ./servers/yhub

FROM yhub-deps AS yhub-development

WORKDIR /home/frontend/servers/yhub

EXPOSE 4444

CMD [ "yarn", "dev"]

FROM yhub-deps AS yhub-builder

WORKDIR /home/frontend/servers/yhub
RUN yarn build

FROM base AS yhub

WORKDIR /home/frontend/

COPY ./src/frontend/package.json ./package.json
COPY ./src/frontend/yarn.lock ./yarn.lock
COPY ./src/frontend/servers/yhub/package.json ./servers/yhub/package.json

WORKDIR /home/frontend/servers/yhub

COPY --from=yhub-builder \
    /home/frontend/servers/yhub/dist \
    ./dist

RUN NODE_ENV=production yarn install --frozen-lockfile && yarn cache clean

# Remove npm, contains CVE related to cross-spawn and we don't use it.
RUN rm -rf /usr/local/bin/npm /usr/local/lib/node_modules/npm

ENV NODE_OPTIONS="--max-old-space-size=2048"

# Un-privileged user running the application
ARG DOCKER_USER
USER ${DOCKER_USER}

# Copy entrypoint
COPY ./docker/files/usr/local/bin/entrypoint /usr/local/bin/entrypoint
ENTRYPOINT [ "/usr/local/bin/entrypoint" ]

CMD ["yarn", "start"]
