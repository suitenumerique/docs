FROM python:3.12-slim

USER root

# Install uv.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Change the working directory to the `app` directory
WORKDIR /app

# Install dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project

# Copy the application into the image
COPY docs_mcp_server/ /app/docs_mcp_server/

# Sync the project
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked

# Attach ports
EXPOSE 4200
ENV SERVER_HOST=0.0.0.0

# Un-privileged user running the application
ARG DOCKER_USER
USER ${DOCKER_USER}

# Run the MCP server.
CMD ["uv", "--no-cache", "run", "python", "-m" ,"docs_mcp_server.mcp_server"]
