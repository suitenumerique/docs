# Django impress

# ---- base image to inherit from ----
FROM python:3.13.3-alpine AS base

# Upgrade pip to its latest release to speed up dependencies installation
RUN python -m pip install --upgrade pip

# Upgrade system packages to install security updates
RUN apk update && apk upgrade --no-cache

# ---- Back-end builder image ----
FROM base AS back-builder

WORKDIR /builder

# Install Rust and Cargo using Alpine's package manager
RUN apk add --no-cache \
  build-base \
  libffi-dev \
  rust \
  cargo

# Copy required python dependencies
COPY ./src/backend /builder

RUN mkdir /install && \
  pip install --prefix=/install .


# ---- mails ----
FROM node:24 AS mail-builder

COPY ./src/mail /mail/app

WORKDIR /mail/app

RUN yarn install --frozen-lockfile && \
  yarn build


# ---- static link collector ----
FROM base AS link-collector
ARG IMPRESS_STATIC_ROOT=/data/static

# Install pango & rdfind
RUN apk add --no-cache \
  pango \
  rdfind

# Copy installed python dependencies
COPY --from=back-builder /install /usr/local

# Copy impress application (see .dockerignore)
COPY ./src/backend /app/

WORKDIR /app

# collectstatic
RUN DJANGO_CONFIGURATION=Build \
  python manage.py collectstatic --noinput

# Replace duplicated file by a symlink to decrease the overall size of the
# final image
RUN rdfind -makesymlinks true -followsymlinks true -makeresultsfile false ${IMPRESS_STATIC_ROOT}

# ---- Core application image ----
FROM base AS core

ENV PYTHONUNBUFFERED=1

# Install required system libs
RUN apk add --no-cache \
  cairo \
  file \
  font-noto \
  font-noto-emoji \
  gettext \
  gdk-pixbuf \
  libffi-dev \
  pango \
  shared-mime-info

RUN wget https://raw.githubusercontent.com/suitenumerique/django-lasuite/refs/heads/main/assets/conf/mime.types -O /etc/mime.types

# Copy entrypoint
COPY ./docker/files/usr/local/bin/entrypoint /usr/local/bin/entrypoint

# Give the "root" group the same permissions as the "root" user on /etc/passwd
# to allow a user belonging to the root group to add new users; typically the
# docker user (see entrypoint).
RUN chmod g=u /etc/passwd

# Copy installed python dependencies
COPY --from=back-builder /install /usr/local

# Link certifi certificate from a static path /cert/cacert.pem to avoid issues
# when python is upgraded and the path to the certificate changes.
# The space between print and the ( is intended otherwise the git lint is failing
RUN mkdir /cert && \
  path=`python -c 'import certifi;print (certifi.where())'` && \
  mv $path /cert/ && \
  ln -s /cert/cacert.pem $path

# Copy impress application (see .dockerignore)
COPY ./src/backend /app/

WORKDIR /app

# Generate compiled translation messages
RUN DJANGO_CONFIGURATION=Build \
  python manage.py compilemessages


# We wrap commands run in this container by the following entrypoint that
# creates a user on-the-fly with the container user ID (see USER) and root group
# ID.
ENTRYPOINT [ "/usr/local/bin/entrypoint" ]

# ---- Development image ----
FROM core AS backend-development

# Switch back to the root user to install development dependencies
USER root:root

# Install psql
RUN apk add --no-cache postgresql-client

# Uninstall impress and re-install it in editable mode along with development
# dependencies
RUN pip uninstall -y impress
RUN pip install -e .[dev]

# Restore the un-privileged user running the application
ARG DOCKER_USER
USER ${DOCKER_USER}

# Target database host (e.g. database engine following docker compose services
# name) & port
ENV DB_HOST=postgresql \
  DB_PORT=5432

# Run django development server
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# ---- Production image ----
FROM core AS backend-production

# Remove apk cache, we don't need it anymore
RUN rm -rf /var/cache/apk/*

ARG IMPRESS_STATIC_ROOT=/data/static

# Gunicorn - not used by default but configuration file is provided
RUN mkdir -p /usr/local/etc/gunicorn
COPY docker/files/usr/local/etc/gunicorn/impress.py /usr/local/etc/gunicorn/impress.py

# Un-privileged user running the application
ARG DOCKER_USER
USER ${DOCKER_USER}

# Copy statics
COPY --from=link-collector ${IMPRESS_STATIC_ROOT} ${IMPRESS_STATIC_ROOT}

# Copy impress mails
COPY --from=mail-builder /mail/backend/core/templates/mail /app/core/templates/mail

# The default command runs uvicorn ASGI server in dics's main module
# WEB_CONCURRENCY: number of workers to run <=> --workers=4
ENV WEB_CONCURRENCY=4
CMD [\
  "uvicorn",\
  "--app-dir=/app",\
  "--host=0.0.0.0",\
  "--timeout-graceful-shutdown=300",\
  "--limit-max-requests=20000",\
  "--lifespan=off",\
  "impress.asgi:application"\
  ]

# To run using gunicorn WSGI server use this instead:
#CMD ["gunicorn", "-c", "/usr/local/etc/gunicorn/conversations.py", "impress.wsgi:application"]
