FROM node:20-alpine AS frontend-deps

ARG AUTO_INSTALL_EXTRA_DEPS=false

WORKDIR /home/frontend/

COPY ./src/frontend/package.json ./package.json
COPY ./src/frontend/bin/conditional-install.js ./bin/conditional-install.js
COPY ./src/frontend/yarn.lock ./yarn.lock
COPY ./src/frontend/apps/impress/package.json ./apps/impress/package.json
COPY ./src/frontend/packages/eslint-config-impress/package.json ./packages/eslint-config-impress/package.json

RUN AUTO_INSTALL_EXTRA_DEPS=${AUTO_INSTALL_EXTRA_DEPS} yarn install --frozen-lockfile

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

RUN yarn build

# ---- Front-end image ----
FROM nginxinc/nginx-unprivileged:1.26-alpine AS frontend-production

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
