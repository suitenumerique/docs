FROM node:24-alpine AS frontend-deps

# Upgrade system packages to install security updates
RUN apk update && \
  apk upgrade && \
  rm -rf /var/cache/apk/*

WORKDIR /home/frontend/

COPY ./src/frontend/package.json ./package.json
COPY ./src/frontend/yarn.lock ./yarn.lock
COPY ./src/frontend/apps/impress/package.json ./apps/impress/package.json
COPY ./src/frontend/packages/eslint-config-impress/package.json ./packages/eslint-config-impress/package.json

RUN yarn install --frozen-lockfile

COPY .dockerignore ./.dockerignore
COPY ./src/frontend/.prettierrc.js ./.prettierrc.js
COPY ./src/frontend/packages/eslint-config-impress ./packages/eslint-config-impress
COPY ./src/frontend/apps/impress ./apps/impress

### ---- Front-end builder image ----
FROM frontend-deps AS impress

WORKDIR /home/frontend/apps/impress

FROM frontend-deps AS impress-dev

WORKDIR /home/frontend/apps/impress

EXPOSE 3000

CMD [ "yarn", "dev"]

# Tilt will rebuild impress target so, we dissociate impress and impress-builder 
# to avoid rebuilding the app at every changes.
FROM impress AS impress-builder

WORKDIR /home/frontend/apps/impress

ARG API_ORIGIN
ENV NEXT_PUBLIC_API_ORIGIN=${API_ORIGIN}

ARG SW_DEACTIVATED
ENV NEXT_PUBLIC_SW_DEACTIVATED=${SW_DEACTIVATED}

ARG PUBLISH_AS_MIT
ENV NEXT_PUBLIC_PUBLISH_AS_MIT=${PUBLISH_AS_MIT}

RUN yarn build

# ---- Front-end image ----
FROM nginxinc/nginx-unprivileged:1.27-alpine AS frontend-production

# Remove the upgrade part once nginx has published
# a new image that fixes the CVE related to libxml2
ARG UID=101
USER root

# Upgrade system packages to install security updates
RUN apk update && \
  apk upgrade && \
  rm -rf /var/cache/apk/*

USER $UID

# Un-privileged user running the application
ARG DOCKER_USER
USER ${DOCKER_USER}

COPY --from=impress-builder \
    /home/frontend/apps/impress/out \
    /usr/share/nginx/html

COPY ./src/frontend/apps/impress/conf/default.conf /etc/nginx/conf.d
COPY ./docker/files/usr/local/bin/entrypoint /usr/local/bin/entrypoint

ENTRYPOINT [ "/usr/local/bin/entrypoint" ]

CMD ["nginx", "-g", "daemon off;"]
