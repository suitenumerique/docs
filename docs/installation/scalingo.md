# Deployment on Scalingo

This guide explains how to deploy Docs on [Scalingo](https://scalingo.com/) using a custom buildpack.

## Overview

Scalingo is a Platform-as-a-Service (PaaS) that simplifies application deployment. This setup uses a custom buildpack to handle both the frontend (Next.js static export) and backend (Django) builds, serving them through Nginx. The collaboration server (y-provider) runs alongside the Django backend.

## Prerequisites

- A Scalingo account
- Scalingo CLI installed (optional but recommended)
- A PostgreSQL database Scalingo addon
- A Redis Scalingo addon (for caching and sessions)
- An external Identity Provider that supports OpenID Connect protocol
- An external Object Storage that implements S3 API

## Step 1: Create Your App

Create a new app on Scalingo using `scalingo` CLI or using the [Scalingo dashboard](https://dashboard.scalingo.com/).

## Step 2: Provision Addons

Add the required PostgreSQL and Redis services.

This will set the following environment variables automatically:
- `SCALINGO_POSTGRESQL_URL` - Database connection string
- `SCALINGO_REDIS_URL` - Redis connection string

## Step 3: Configure Environment Variables

Set the following environment variables in your Scalingo app:

### Buildpack Configuration

```bash
scalingo env-set BUILDPACK_URL="https://github.com/suitenumerique/buildpack#main"
scalingo env-set LASUITE_APP_NAME="docs"
scalingo env-set LASUITE_BACKEND_DIR="src/backend/"
scalingo env-set LASUITE_FRONTEND_DIR="src/frontend/"
scalingo env-set LASUITE_NGINX_DIR="."
scalingo env-set LASUITE_SCRIPT_POSTCOMPILE="bin/buildpack_postcompile.sh"
scalingo env-set LASUITE_SCRIPT_POSTFRONTEND="bin/buildpack_postfrontend.sh"
```

### Database and Cache

```bash
scalingo env-set DATABASE_URL="\$SCALINGO_POSTGRESQL_URL"
scalingo env-set REDIS_URL="\$SCALINGO_REDIS_URL"
```

### Django Settings

```bash
scalingo env-set DJANGO_SETTINGS_MODULE="impress.settings"
scalingo env-set DJANGO_CONFIGURATION="Production"
scalingo env-set DJANGO_SECRET_KEY="<generate-a-secure-secret-key>"
scalingo env-set DJANGO_ALLOWED_HOSTS="my-docs-app.osc-fr1.scalingo.io"
```

### OIDC Authentication

Configure your OIDC provider (e.g., Keycloak, Authentik):

```bash
scalingo env-set OIDC_RP_CLIENT_ID="docs-client-id"
scalingo env-set OIDC_RP_CLIENT_SECRET="<your-client-secret>"
scalingo env-set OIDC_RP_SIGN_ALGO="RS256"
scalingo env-set OIDC_OP_BASE_URL="https://auth.yourdomain.com/realms/docs"
```

Or configure individual endpoints if your provider doesn't support discovery:

```bash
scalingo env-set OIDC_OP_AUTHORIZATION_ENDPOINT="https://auth.yourdomain.com/authorize"
scalingo env-set OIDC_OP_TOKEN_ENDPOINT="https://auth.yourdomain.com/token"
scalingo env-set OIDC_OP_USER_ENDPOINT="https://auth.yourdomain.com/userinfo"
scalingo env-set OIDC_OP_JWKS_ENDPOINT="https://auth.yourdomain.com/.well-known/jwks.json"
scalingo env-set OIDC_OP_LOGOUT_ENDPOINT="https://auth.yourdomain.com/logout"
```

### S3 Media Storage

To store uploaded media files in an S3-compatible object storage:

```bash
scalingo env-set AWS_S3_ENDPOINT_URL="https://s3.amazonaws.com"
scalingo env-set AWS_S3_ACCESS_KEY_ID="<your-access-key>"
scalingo env-set AWS_S3_SECRET_ACCESS_KEY="<your-secret-key>"
scalingo env-set AWS_STORAGE_BUCKET_NAME="docs-media"
scalingo env-set AWS_S3_REGION_NAME="eu-west-1"
```

### Email Configuration (Optional)

For email notifications see [https://doc.scalingo.com/platform/app/sending-emails](https://doc.scalingo.com/platform/app/sending-emails):

```bash
scalingo env-set DJANGO_EMAIL_HOST="smtp.example.org"
scalingo env-set DJANGO_EMAIL_PORT="587"
scalingo env-set DJANGO_EMAIL_HOST_USER="<smtp-user>"
scalingo env-set DJANGO_EMAIL_HOST_PASSWORD="<smtp-password>"
scalingo env-set DJANGO_EMAIL_USE_TLS="True"
scalingo env-set DJANGO_EMAIL_FROM="docs@yourdomain.com"
```

## Step 4: Deploy

Deploy your application:

```bash
git push scalingo main
```

The buildpack will automatically:
1. Build the frontend (Next.js static export)
2. Build the backend (Django)
3. Run the post-compile script (cleanup unused files to reduce slug size)
4. Run the post-frontend script (move assets, inject theme, prepare for deployment)
5. Start uvicorn, the y-provider collaboration server, and Nginx
6. Run Django migrations

## Step 5: Create superuser

After the first deployment, create an admin user:

```bash
scalingo run python manage.py createsuperuser
```

## Custom Domain (Optional)

To use a custom domain:

1. Add the domain in Scalingo dashboard
2. Update `DJANGO_ALLOWED_HOSTS` with your custom domain
3. Configure your DNS to point to Scalingo

```bash
scalingo domains-add docs.yourdomain.com
scalingo env-set DJANGO_ALLOWED_HOSTS="docs.yourdomain.com,my-docs-app.osc-fr1.scalingo.io"
```

## Theme Customization

Docs supports theme customization via environment variables. The theme controls the appearance of the header, footer, waffle (La Suite services widget), favicon, and more.

### Custom Logo (Optional)

To replace the default Docs logo with your own, set the `THEME_CUSTOMIZATION_LOGO_URL` environment variable with an HTTPS URL pointing to an SVG file (max 5MB):

```bash
scalingo env-set THEME_CUSTOMIZATION_LOGO_URL="https://cdn.yourdomain.com/logo.svg"
```

The logo is validated during build:
- Must use HTTPS
- Must be a valid SVG file
- Must not exceed 5MB
- SSRF protection is applied

### Custom Theme (Optional)

To customize the theme (footer links, waffle, translations, etc.), set the `THEME_CUSTOMIZATION_JSON` environment variable with a JSON object. The buildpack merges your custom JSON with the default theme, so you only need to specify the parts you want to override.

> **Important:** The `THEME_CUSTOMIZATION_JSON` value must be valid JSON. Ensure it is properly escaped when setting as an environment variable.

```bash
scalingo env-set THEME_CUSTOMIZATION_JSON='{"footer":{"default":{"externalLinks":[{"label":"GitHub","href":"https://github.com/your-org/"},{"label":"Your Org","href":"https://yourdomain.com"}],"legalLinks":[{"label":"Legal Notice","href":"https://docs.yourdomain.com/legal/"},{"label":"Privacy Policy","href":"https://docs.yourdomain.com/privacy/"}],"bottomInformation":{"label":"Unless otherwise stated, all content on this site is under","link":{"label":"licence etalab-2.0","href":"https://github.com/etalab/licence-ouverte/blob/master/LO.md"}}},"en":{"bottomInformation":{"label":"Unless otherwise stated, all content on this site is under","link":{"label":"licence MIT","href":"https://github.com/your-org/license"}}},"fr":{"bottomInformation":{"label":"Sauf mention contraire, tout le contenu de ce site est sous","link":{"label":"licence etalab-2.0","href":"https://github.com/etalab/licence-ouverte/blob/master/LO.md"}}}},"waffle":{"apiUrl":"https://your-api.example.com/api/v1.0/lagaufre/services/","widgetPath":"https://static.example.com/widgets/"},"header":{"logo":{},"icon":{"src":"/assets/icon-docs.svg","style":{"width":"32px","height":"auto"},"alt":"Your Org Logo","withTitle":true}},"home":{"with-proconnect":false,"icon-banner":{"src":"/assets/icon-docs.svg","style":{"width":"64px","height":"auto"},"alt":"Your Org Logo"}},"favicon":{"light":{"href":"/assets/favicon-light.png","type":"image/png"},"dark":{"href":"/assets/favicon-dark.png","type":"image/png"}}}'
```

#### Available Theme Sections and Configuration

For detailed information on all available theme sections, waffle configuration modes, and customization options, see the [Customization Guide](../customization.md).

#### Theme Cache

The theme is cached in Redis for 24 hours by default. If you update `THEME_CUSTOMIZATION_JSON` and don't see changes, clear the Redis cache:

```bash
scalingo run python -c "from django.core.cache import cache; cache.clear()"
```

Or set `THEME_CUSTOMIZATION_CACHE_TIMEOUT` to a shorter duration:

```bash
scalingo env-set THEME_CUSTOMIZATION_CACHE_TIMEOUT=60
```

> **Note:** Changing `THEME_CUSTOMIZATION_CACHE_TIMEOUT` does not clear existing cached values in Redis. After changing this setting, clear the cache manually: `scalingo run python -c "from django.core.cache import cache; cache.clear()"`

## Troubleshooting

### Check Logs

```bash
scalingo logs --tail
```

### Common Issues

1. **Build fails**: Check that all required environment variables are set
2. **Database connection error**: Verify `DATABASE_URL` is correctly set to `$SCALINGO_POSTGRESQL_URL`
3. **Static files not served**: Ensure the buildpack post-frontend script ran successfully
4. **OIDC errors**: Verify your OIDC provider configuration and callback URLs
5. **Theme not updating**: Clear Redis cache with `scalingo run python -c "from django.core.cache import cache; cache.clear()"`
6. **Collaboration not working**: Verify the y-provider server is running and the WebSocket URL is configured

### Useful Commands

```bash
# Open a console
scalingo run bash

# Restart the app
scalingo restart

# Scale containers
scalingo scale web:2

# One-off command
scalingo run python manage.py shell

# Check environment variables
scalingo env

# View app status
scalingo status
```

## Architecture

On Scalingo, the application runs as follows:

### Build Phase

1. The buildpack compiles the frontend (Next.js static export)
2. The buildpack compiles the backend (Python dependencies)
3. `bin/buildpack_postcompile.sh` runs to clean up unused files and reduce slug size
4. `bin/buildpack_postfrontend.sh` moves the frontend build to `build/frontend-out`, downloads custom logos, injects the custom theme, and prepares the deployment structure

### Runtime

The `bin/buildpack_start.sh` script starts three processes:

- **Nginx** serves static files and proxies requests to the backend
- **uvicorn** runs the Django ASGI application on port 8000
- **y-provider** runs the collaboration WebSocket server on port 4444

Nginx routes:
- `/api/` and `/admin/` → Django backend (port 8000)
- `/collaboration/api/` and `/collaboration/ws/` → y-provider (port 4444)
- `/media/` → S3 object storage (with auth proxy)
- `/` → Static frontend files

## Additional Resources

- [Scalingo Documentation](https://doc.scalingo.com/)
- [Docs Environment Variables](../env.md)
- [Theme Customization](../customization.md)
- [Django Configurations Documentation](https://django-configurations.readthedocs.io/)
