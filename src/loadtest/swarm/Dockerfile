# Built from the repository root, like every other image here:
#   docker build -f src/loadtest/swarm/Dockerfile -t docs-swarm .
FROM node:22-trixie AS base
WORKDIR /app
COPY ./src/loadtest/swarm/package.json ./src/loadtest/swarm/yarn.lock ./

FROM base AS builder
RUN yarn install --frozen-lockfile
COPY ./src/loadtest/swarm/tsconfig.json ./src/loadtest/swarm/tsconfig.build.json ./
COPY ./src/loadtest/swarm/src ./src
RUN yarn build

FROM base AS swarm
RUN yarn install --frozen-lockfile --production
COPY --from=builder /app/dist ./dist
# many sockets: the default limit of open files is what would stop the swarm first
ENV UV_THREADPOOL_SIZE=16
USER node
ENTRYPOINT ["node", "dist/index.js"]
