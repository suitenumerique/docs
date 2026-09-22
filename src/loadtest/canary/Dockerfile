# Built from the repository root, like every other image here:
#   docker build -f src/loadtest/canary/Dockerfile -t docs-canary .
# The base image carries the browsers Playwright needs, at the same version as
# the `playwright` package in package.json: bump both together.
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS base
WORKDIR /app
COPY ./src/loadtest/canary/package.json ./src/loadtest/canary/yarn.lock ./

FROM base AS builder
RUN yarn install --frozen-lockfile
COPY ./src/loadtest/canary/tsconfig.json ./src/loadtest/canary/tsconfig.build.json ./
COPY ./src/loadtest/canary/src ./src
RUN yarn build

FROM base AS canary
RUN yarn install --frozen-lockfile --production
COPY --from=builder /app/dist ./dist
USER pwuser
ENTRYPOINT ["node", "dist/index.js"]
