# Django impress

# ---- base image to inherit from ----
FROM python:3.12.6-alpine3.20 AS base

# Upgrade pip to its latest release to speed up dependencies installation
RUN python -m pip install --upgrade pip setuptools

# Upgrade system packages to install security updates
RUN apk update && \
  apk upgrade

# ---- Back-end builder image ----
FROM base AS back-builder

WORKDIR /builder

# Copy required python dependencies
COPY ./src/backend /builder

RUN mkdir /install && \
  pip install --prefix=/install .


# ---- mails ----
FROM node:20 AS mail-builder

COPY ./src/mail /mail/app

WORKDIR /mail/app

RUN yarn install --frozen-lockfile && \
    yarn build


# ---- static link collector ----
FROM base AS link-collector
ARG IMPRESS_STATIC_ROOT=/data/static

# Install pango & rdfind
RUN apk add \
  pango \
  rdfind

# Copy installed python dependencies
COPY --from=back-builder /install /usr/local

# Copy impress application (see .dockerignore)
COPY ./src/backend /app/

WORKDIR /app

# collectstatic
RUN DJANGO_CONFIGURATION=Build DJANGO_JWT_PRIVATE_SIGNING_KEY=Dummy \
    python manage.py collectstatic --noinput

# Replace duplicated file by a symlink to decrease the overall size of the
# final image
RUN rdfind -makesymlinks true -followsymlinks true -makeresultsfile false ${IMPRESS_STATIC_ROOT}

# ---- Core application image ----
FROM base AS core

ENV PYTHONUNBUFFERED=1

# Install required system libs
RUN apk add \
  cairo \
  file \
  font-noto \
  font-noto-emoji \
  gettext \
  gdk-pixbuf \
  libffi-dev \
  pango \
  shared-mime-info

# Copy entrypoint
COPY ./docker/files/usr/local/bin/entrypoint /usr/local/bin/entrypoint

# Give the "root" group the same permissions as the "root" user on /etc/passwd
# to allow a user belonging to the root group to add new users; typically the
# docker user (see entrypoint).
RUN chmod g=u /etc/passwd

# Copy installed python dependencies
COPY --from=back-builder /install /usr/local

# Copy impress application (see .dockerignore)
COPY ./src/backend /app/

WORKDIR /app

# We wrap commands run in this container by the following entrypoint that
# creates a user on-the-fly with the container user ID (see USER) and root group
# ID.
ENTRYPOINT [ "/usr/local/bin/entrypoint" ]

# ---- Development image ----
FROM core AS backend-development

# Switch back to the root user to install development dependencies
USER root:root

# Install psql
RUN apk add postgresql-client

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

ARG IMPRESS_STATIC_ROOT=/data/static

# Gunicorn
RUN mkdir -p /usr/local/etc/gunicorn
COPY docker/files/usr/local/etc/gunicorn/impress.py /usr/local/etc/gunicorn/impress.py

# Un-privileged user running the application
ARG DOCKER_USER
USER ${DOCKER_USER}

# Copy statics
COPY --from=link-collector ${IMPRESS_STATIC_ROOT} ${IMPRESS_STATIC_ROOT}

# Copy impress mails
COPY --from=mail-builder /mail/backend/core/templates/mail /app/core/templates/mail

# The default command runs gunicorn WSGI server in impress's main module
CMD ["gunicorn", "-c", "/usr/local/etc/gunicorn/impress.py", "impress.wsgi:application"]
