# Docs variables

Here we describe all environment variables that can be set for the docs application.

## impress-backend container

These are the environment variables you can set for the `impress-backend` container.

| Option                                          | Description                                                                                   | default                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| AI_ALLOW_REACH_FROM                             | Users that can use AI must be this level. options are "public", "authenticated", "restricted" | authenticated                                           |
| AI_API_KEY                                      | AI key to be used for AI Base url                                                             |                                                         |
| AI_BASE_URL                                     | OpenAI compatible AI base url                                                                 |                                                         |
| AI_FEATURE_ENABLED                              | Enable AI options                                                                             | false                                                   |
| AI_MODEL                                        | AI Model to use                                                                               |                                                         |
| ALLOW_LOGOUT_GET_METHOD                         | Allow get logout method                                                                       | true                                                    |
| API_USERS_LIST_LIMIT                            | Limit on API users                                                                            | 5                                                       |
| API_USERS_LIST_THROTTLE_RATE_BURST              | throttle rate for api on burst                                                                | 30/minute                                               |
| API_USERS_LIST_THROTTLE_RATE_SUSTAINED          | throttle rate for api                                                                         | 180/hour                                                |
| AWS_S3_ACCESS_KEY_ID                            | access id for s3 endpoint                                                                     |                                                         |
| AWS_S3_ENDPOINT_URL                             | S3 endpoint                                                                                   |                                                         |
| AWS_S3_REGION_NAME                              | region name for s3 endpoint                                                                   |                                                         |
| AWS_S3_SECRET_ACCESS_KEY                        | access key for s3 endpoint                                                                    |                                                         |
| AWS_STORAGE_BUCKET_NAME                         | bucket name for s3 endpoint                                                                   | impress-media-storage                                   |
| CACHES_DEFAULT_TIMEOUT                          | cache default timeout                                                                         | 30                                                      |
| CACHES_KEY_PREFIX                               | The prefix used to every cache keys.                                                          | docs                                                    |
| COLLABORATION_API_URL                           | collaboration api host                                                                        |                                                         |
| COLLABORATION_SERVER_SECRET                     | collaboration api secret                                                                      |                                                         |
| COLLABORATION_WS_NOT_CONNECTED_READY_ONLY           | Users not connected to the collaboration server cannot edit                                   | false                                                   |
| COLLABORATION_WS_URL                            | collaboration websocket url                                                                   |                                                         |
| CONVERSION_API_CONTENT_FIELD                    | Conversion api content field                                                                  | content                                                 |
| CONVERSION_API_ENDPOINT                         | Conversion API endpoint                                                                       | convert-markdown                                        |
| CONVERSION_API_SECURE                           | Require secure conversion api                                                                 | false                                                   |
| CONVERSION_API_TIMEOUT                          | Conversion api timeout                                                                        | 30                                                      |
| CONTENT_SECURITY_POLICY_DIRECTIVES              | A dict of directives set in the Content-Security-Policy header                                | All directives are set to 'none'                        |
| CONTENT_SECURITY_POLICY_EXCLUDE_URL_PREFIXES    | Url with this prefix will not have the header Content-Security-Policy included                |                                                         |
| CRISP_WEBSITE_ID                                | crisp website id for support                                                                  |                                                         |
| DB_ENGINE                                       | engine to use for database connections                                                        | django.db.backends.postgresql_psycopg2                  |
| DB_HOST                                         | host of the database                                                                          | localhost                                               |
| DB_NAME                                         | name of the database                                                                          | impress                                                 |
| DB_PASSWORD                                     | password to authenticate with                                                                 | pass                                                    |
| DB_PORT                                         | port of the database                                                                          | 5432                                                    |
| DB_USER                                         | user to authenticate with                                                                     | dinum                                                   |
| DJANGO_ALLOWED_HOSTS                            | allowed hosts                                                                                 | []                                                      |
| DJANGO_CELERY_BROKER_TRANSPORT_OPTIONS          | celery broker transport options                                                               | {}                                                      |
| DJANGO_CELERY_BROKER_URL                        | celery broker url                                                                             | redis://redis:6379/0                                    |
| DJANGO_CORS_ALLOW_ALL_ORIGINS                   | allow all CORS origins                                                                        | false                                                    |
| DJANGO_CORS_ALLOWED_ORIGIN_REGEXES              | list of origins allowed for CORS using regulair expressions                                   | []                                                      |
| DJANGO_CORS_ALLOWED_ORIGINS                     | list of origins allowed for CORS                                                              | []                                                      |
| DJANGO_CSRF_TRUSTED_ORIGINS                     | CSRF trusted origins                                                                          | []                                                      |
| DJANGO_EMAIL_BACKEND                            | email backend library                                                                         | django.core.mail.backends.smtp.EmailBackend             |
| DJANGO_EMAIL_BRAND_NAME                         | brand name for email                                                                          |                                                         |
| DJANGO_EMAIL_FROM                               | email address used as sender                                                                  | from@example.com                                        |
| DJANGO_EMAIL_HOST                               | host name of email                                                                            |                                                         |
| DJANGO_EMAIL_HOST_PASSWORD                      | password to authenticate with on the email host                                               |                                                         |
| DJANGO_EMAIL_HOST_USER                          | user to authenticate with on the email host                                                   |                                                         |
| DJANGO_EMAIL_LOGO_IMG                           | logo for the email                                                                            |                                                         |
| DJANGO_EMAIL_PORT                               | port used to connect to email host                                                            |                                                         |
| DJANGO_EMAIL_USE_SSL                            | use sstl for email host connection                                                            | false                                                   |
| DJANGO_EMAIL_USE_TLS                            | use tls for email host connection                                                             | false                                                   |
| DJANGO_SECRET_KEY                               | secret key                                                                                    |                                                         |
| DJANGO_SERVER_TO_SERVER_API_TOKENS              |                                                                                               | []                                                      |
| DOCUMENT_IMAGE_MAX_SIZE                         | maximum size of document in bytes                                                             | 10485760                                                |
| FRONTEND_CSS_URL                                | To add a external css file to the app                                                         |                                                         |
| FRONTEND_HOMEPAGE_FEATURE_ENABLED               | frontend feature flag to display the homepage                                                 | false                                                   |
| FRONTEND_THEME                                  | frontend theme to use                                                                         |                                                         |
| LANGUAGE_CODE                                   | default language                                                                              | en-us                                                   |
| LOGGING_LEVEL_LOGGERS_APP                       | application logging level. options are "DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"           | INFO                                                    |
| LOGGING_LEVEL_LOGGERS_ROOT                      | default logging level. options are "DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"               | INFO                                                    |
| LOGIN_REDIRECT_URL                              | login redirect url                                                                            |                                                         |
| LOGIN_REDIRECT_URL_FAILURE                      | login redirect url on failure                                                                 |                                                         |
| LOGOUT_REDIRECT_URL                             | logout redirect url                                                                           |                                                         |
| MALWARE_DETECTION_BACKEND                       | The malware detection backend use from the django-lasuite package                             | lasuite.malware_detection.backends.dummy.DummyBackend           |
| MALWARE_DETECTION_PARAMETERS                    | A dict containing all the parameters to initiate the malware detection backend                | {"callback_path": "core.malware_detection.malware_detection_callback",} |
| MEDIA_BASE_URL                                  |                                                                                               |                                                         |
| OIDC_ALLOW_DUPLICATE_EMAILS                     | Allow duplicate emails                                                                        | false                                                   |
| OIDC_AUTH_REQUEST_EXTRA_PARAMS                  | OIDC extra auth parameters                                                                    | {}                                                      |
| OIDC_CREATE_USER                                | create used on OIDC                                                                           | false                                                   |
| OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION       | faillback to email for identification                                                         | true                                                    |
| OIDC_OP_AUTHORIZATION_ENDPOINT                  | Authorization endpoint for OIDC                                                               |                                                         |
| OIDC_OP_JWKS_ENDPOINT                           | JWKS endpoint for OIDC                                                                        |                                                         |
| OIDC_OP_LOGOUT_ENDPOINT                         | Logout endpoint for OIDC                                                                      |                                                         |
| OIDC_OP_TOKEN_ENDPOINT                          | Token endpoint for OIDC                                                                       |                                                         |
| OIDC_OP_USER_ENDPOINT                           | User endpoint for OIDC                                                                        |                                                         |
| OIDC_REDIRECT_ALLOWED_HOSTS                     | Allowed hosts for OIDC redirect url                                                           | []                                                      |
| OIDC_REDIRECT_REQUIRE_HTTPS                     | Require https for OIDC redirect url                                                           | false                                                   |
| OIDC_RP_CLIENT_ID                               | client id used for OIDC                                                                       | impress                                                 |
| OIDC_RP_CLIENT_SECRET                           | client secret used for OIDC                                                                   |                                                         |
| OIDC_RP_SCOPES                                  | scopes requested for OIDC                                                                     | openid email                                            |
| OIDC_RP_SIGN_ALGO                               | verification algorithm used OIDC tokens                                                       | RS256                                                   |
| OIDC_STORE_ID_TOKEN                             | Store OIDC token                                                                              | true                                                    |
| OIDC_USE_NONCE                                  | use nonce for OIDC                                                                            | true                                                    |
| OIDC_USERINFO_FULLNAME_FIELDS                   | OIDC token claims to create full name                                                         | ["first_name", "last_name"]                             |
| OIDC_USERINFO_SHORTNAME_FIELD                   | OIDC token claims to create shortname                                                         | first_name                                              |
| POSTHOG_KEY                                     | posthog key for analytics                                                                     |                                                         |
| REDIS_URL                                       | cache url                                                                                     | redis://redis:6379/1                                    |
| SENTRY_DSN                                      | sentry host                                                                                   |                                                         |
| SESSION_COOKIE_AGE                              | duration of the cookie session                                                                | 60*60*12                                                |
| SPECTACULAR_SETTINGS_ENABLE_DJANGO_DEPLOY_CHECK |                                                                                               | false                                                   |
| STORAGES_STATICFILES_BACKEND                    |                                                                                               | whitenoise.storage.CompressedManifestStaticFilesStorage |
| THEME_CUSTOMIZATION_CACHE_TIMEOUT               | Cache duration for the customization settings                                                  | 86400                                                   |
| THEME_CUSTOMIZATION_FILE_PATH                   | full path to the file customizing the theme. An example is provided in src/backend/impress/configuration/theme/default.json | BASE_DIR/impress/configuration/theme/default.json       |
| TRASHBIN_CUTOFF_DAYS                            | trashbin cutoff                                                                               | 30                                                      |
| USER_OIDC_ESSENTIAL_CLAIMS                      | essential claims in OIDC token                                                                | []                                                      |
| Y_PROVIDER_API_BASE_URL                         | Y Provider url                                                                                |                                                         |
| Y_PROVIDER_API_KEY                              | Y provider API key                                                                            |                                                         |

## impress-frontend image

These are the environment variables you can set to build the `impress-frontend` image.

Depending on how you are building the front-end application, this variable is used in different ways.

If you want to build the Docker image, this variable is used as an argument in the build command.

Example:

```
docker build -f src/frontend/Dockerfile --target frontend-production --build-arg PUBLISH_AS_MIT=false docs-frontend:latest
``` 

If you want to build the front-end application using the yarn build command, you can edit the file `src/frontend/apps/impress/.env` with the `NODE_ENV=production` environment variable and modify it. Alternatively, you can use the listed environment variables with the prefix `NEXT_PUBLIC_` (for example, `NEXT_PUBLIC_PUBLISH_AS_MIT=false`).

Example:

```
cd src/frontend/apps/impress
NODE_ENV=production NEXT_PUBLIC_PUBLISH_AS_MIT=false yarn build
```

| Option                                          | Description                                                                                   | default                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| API_ORIGIN                                      | backend domain - it uses the current domain if not initialized                                |                                                         |
| SW_DEACTIVATED                                  | To not install the service worker                                                             |                                                         |
| PUBLISH_AS_MIT                                  | Removes packages whose licences are incompatible with the MIT licence (see  below)                                               | true                                                    |

Packages with licences incompatible with the MIT licence:
* `xl-docx-exporter`: [AGPL-3.0](https://github.com/TypeCellOS/BlockNote/blob/main/packages/xl-docx-exporter/LICENSE), 
* `xl-pdf-exporter`: [AGPL-3.0](https://github.com/TypeCellOS/BlockNote/blob/main/packages/xl-pdf-exporter/LICENSE) 

In `.env.development`, `PUBLISH_AS_MIT` is set to `false`, allowing developers to test Docs with all its features.

⚠️ If you run Docs in production with `PUBLISH_AS_MIT` set to `false` make sure you fulfill your [BlockNote licensing](https://github.com/TypeCellOS/BlockNote/blob/main/packages/xl-pdf-exporter/LICENSE) or [subscription](https://www.blocknotejs.org/about#partner-with-us) obligations.

