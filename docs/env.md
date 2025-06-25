# Docs variables

Here we describe all environment variables that can be set for the docs application.

## impress-backend container

These are the environment variables you can set for the `impress-backend` container.

| Option                                          | Description                                                                                                                 | default                                                                 |
|-------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------|
| AI_ALLOW_REACH_FROM                             | Users that can use AI must be this level. options are "public", "authenticated", "restricted"                               | authenticated                                                           |
| AI_API_KEY                                      | AI key to be used for AI Base url                                                                                           |                                                                         |
| AI_BASE_URL                                     | OpenAI compatible AI base url                                                                                               |                                                                         |
| AI_FEATURE_ENABLED                              | Enable AI options                                                                                                           | false                                                                   |
| AI_MODEL                                        | AI Model to use                                                                                                             |                                                                         |
| ALLOW_LOGOUT_GET_METHOD                         | Allow get logout method                                                                                                     | true                                                                    |
| API_USERS_LIST_LIMIT                            | Limit on API users                                                                                                          | 5                                                                       |
| API_USERS_LIST_THROTTLE_RATE_BURST              | Throttle rate for api on burst                                                                                              | 30/minute                                                               |
| API_USERS_LIST_THROTTLE_RATE_SUSTAINED          | Throttle rate for api                                                                                                       | 180/hour                                                                |
| AWS_S3_ACCESS_KEY_ID                            | Access id for s3 endpoint                                                                                                   |                                                                         |
| AWS_S3_ENDPOINT_URL                             | S3 endpoint                                                                                                                 |                                                                         |
| AWS_S3_REGION_NAME                              | Region name for s3 endpoint                                                                                                 |                                                                         |
| AWS_S3_SECRET_ACCESS_KEY                        | Access key for s3 endpoint                                                                                                  |                                                                         |
| AWS_STORAGE_BUCKET_NAME                         | Bucket name for s3 endpoint                                                                                                 | impress-media-storage                                                   |
| CACHES_DEFAULT_TIMEOUT                          | Cache default timeout                                                                                                       | 30                                                                      |
| CACHES_KEY_PREFIX                               | The prefix used to every cache keys.                                                                                        | docs                                                                    |
| COLLABORATION_API_URL                           | Collaboration api host                                                                                                      |                                                                         |
| COLLABORATION_SERVER_SECRET                     | Collaboration api secret                                                                                                    |                                                                         |
| COLLABORATION_WS_NOT_CONNECTED_READY_ONLY       | Users not connected to the collaboration server cannot edit                                                                 | false                                                                   |
| COLLABORATION_WS_URL                            | Collaboration websocket url                                                                                                 |                                                                         |
| CONVERSION_API_CONTENT_FIELD                    | Conversion api content field                                                                                                | content                                                                 |
| CONVERSION_API_ENDPOINT                         | Conversion API endpoint                                                                                                     | convert                                                        |
| CONVERSION_API_SECURE                           | Require secure conversion api                                                                                               | false                                                                   |
| CONVERSION_API_TIMEOUT                          | Conversion api timeout                                                                                                      | 30                                                                      |
| CRISP_WEBSITE_ID                                | Crisp website id for support                                                                                                |                                                                         |
| DB_ENGINE                                       | Engine to use for database connections                                                                                      | django.db.backends.postgresql_psycopg2                                  |
| DB_HOST                                         | Host of the database                                                                                                        | localhost                                                               |
| DB_NAME                                         | Name of the database                                                                                                        | impress                                                                 |
| DB_PASSWORD                                     | Password to authenticate with                                                                                               | pass                                                                    |
| DB_PORT                                         | Port of the database                                                                                                        | 5432                                                                    |
| DB_USER                                         | User to authenticate with                                                                                                   | dinum                                                                   |
| DJANGO_ALLOWED_HOSTS                            | Allowed hosts                                                                                                               | []                                                                      |
| DJANGO_CELERY_BROKER_TRANSPORT_OPTIONS          | Celery broker transport options                                                                                             | {}                                                                      |
| DJANGO_CELERY_BROKER_URL                        | Celery broker url                                                                                                           | redis://redis:6379/0                                                    |
| DJANGO_CORS_ALLOW_ALL_ORIGINS                   | Allow all CORS origins                                                                                                      | false                                                                   |
| DJANGO_CORS_ALLOWED_ORIGIN_REGEXES              | List of origins allowed for CORS using regulair expressions                                                                 | []                                                                      |
| DJANGO_CORS_ALLOWED_ORIGINS                     | List of origins allowed for CORS                                                                                            | []                                                                      |
| DJANGO_CSRF_TRUSTED_ORIGINS                     | CSRF trusted origins                                                                                                        | []                                                                      |
| DJANGO_EMAIL_BACKEND                            | Email backend library                                                                                                       | django.core.mail.backends.smtp.EmailBackend                             |
| DJANGO_EMAIL_BRAND_NAME                         | Brand name for email                                                                                                        |                                                                         |
| DJANGO_EMAIL_FROM                               | Email address used as sender                                                                                                | from@example.com                                                        |
| DJANGO_EMAIL_HOST                               | Hostname of email                                                                                                           |                                                                         |
| DJANGO_EMAIL_HOST_PASSWORD                      | Password to authenticate with on the email host                                                                             |                                                                         |
| DJANGO_EMAIL_HOST_USER                          | User to authenticate with on the email host                                                                                 |                                                                         |
| DJANGO_EMAIL_LOGO_IMG                           | Logo for the email                                                                                                          |                                                                         |
| DJANGO_EMAIL_PORT                               | Port used to connect to email host                                                                                          |                                                                         |
| DJANGO_EMAIL_USE_SSL                            | Use ssl for email host connection                                                                                           | false                                                                   |
| DJANGO_EMAIL_USE_TLS                            | Use tls for email host connection                                                                                           | false                                                                   |
| DJANGO_SECRET_KEY                               | Secret key                                                                                                                  |                                                                         |
| DJANGO_SERVER_TO_SERVER_API_TOKENS              |                                                                                                                             | []                                                                      |
| DOCUMENT_IMAGE_MAX_SIZE                         | Maximum size of document in bytes                                                                                           | 10485760                                                                |
| FRONTEND_CSS_URL                                | To add a external css file to the app                                                                                       |                                                                         |
| FRONTEND_HOMEPAGE_FEATURE_ENABLED               | Frontend feature flag to display the homepage                                                                               | false                                                                   |
| FRONTEND_THEME                                  | Frontend theme to use                                                                                                       |                                                                         |
| LANGUAGE_CODE                                   | Default language                                                                                                            | en-us                                                                   |
| LOGGING_LEVEL_LOGGERS_APP                       | Application logging level. options are "DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"                                         | INFO                                                                    |
| LOGGING_LEVEL_LOGGERS_ROOT                      | Default logging level. options are "DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"                                             | INFO                                                                    |
| LOGIN_REDIRECT_URL                              | Login redirect url                                                                                                          |                                                                         |
| LOGIN_REDIRECT_URL_FAILURE                      | Login redirect url on failure                                                                                               |                                                                         |
| LOGOUT_REDIRECT_URL                             | Logout redirect url                                                                                                         |                                                                         |
| MALWARE_DETECTION_BACKEND                       | The malware detection backend use from the django-lasuite package                                                           | lasuite.malware_detection.backends.dummy.DummyBackend                   |
| MALWARE_DETECTION_PARAMETERS                    | A dict containing all the parameters to initiate the malware detection backend                                              | {"callback_path": "core.malware_detection.malware_detection_callback",} |
| MEDIA_BASE_URL                                  |                                                                                                                             |                                                                         |
| NO_WEBSOCKET_CACHE_TIMEOUT                      | Cache used to store current editor session key when only users without websocket are editing a document                     | 120                                                                     |
| OIDC_ALLOW_DUPLICATE_EMAILS                     | Allow duplicate emails                                                                                                      | false                                                                   |
| OIDC_AUTH_REQUEST_EXTRA_PARAMS                  | OIDC extra auth parameters                                                                                                  | {}                                                                      |
| OIDC_CREATE_USER                                | Create used on OIDC                                                                                                         | false                                                                   |
| OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION       | Fallback to email for identification                                                                                        | true                                                                    |
| OIDC_OP_AUTHORIZATION_ENDPOINT                  | Authorization endpoint for OIDC                                                                                             |                                                                         |
| OIDC_OP_JWKS_ENDPOINT                           | JWKS endpoint for OIDC                                                                                                      |                                                                         |
| OIDC_OP_LOGOUT_ENDPOINT                         | Logout endpoint for OIDC                                                                                                    |                                                                         |
| OIDC_OP_TOKEN_ENDPOINT                          | Token endpoint for OIDC                                                                                                     |                                                                         |
| OIDC_OP_USER_ENDPOINT                           | User endpoint for OIDC                                                                                                      |                                                                         |
| OIDC_REDIRECT_ALLOWED_HOSTS                     | Allowed hosts for OIDC redirect url                                                                                         | []                                                                      |
| OIDC_REDIRECT_REQUIRE_HTTPS                     | Require https for OIDC redirect url                                                                                         | false                                                                   |
| OIDC_RP_CLIENT_ID                               | Client id used for OIDC                                                                                                     | impress                                                                 |
| OIDC_RP_CLIENT_SECRET                           | Client secret used for OIDC                                                                                                 |                                                                         |
| OIDC_RP_SCOPES                                  | Scopes requested for OIDC                                                                                                   | openid email                                                            |
| OIDC_RP_SIGN_ALGO                               | verification algorithm used OIDC tokens                                                                                     | RS256                                                                   |
| OIDC_STORE_ID_TOKEN                             | Store OIDC token                                                                                                            | true                                                                    |
| OIDC_USE_NONCE                                  | Use nonce for OIDC                                                                                                          | true                                                                    |
| OIDC_USERINFO_FULLNAME_FIELDS                   | OIDC token claims to create full name                                                                                       | ["first_name", "last_name"]                                             |
| OIDC_USERINFO_SHORTNAME_FIELD                   | OIDC token claims to create shortname                                                                                       | first_name                                                              |
| POSTHOG_KEY                                     | Posthog key for analytics                                                                                                   |                                                                         |
| REDIS_URL                                       | Cache url                                                                                                                   | redis://redis:6379/1                                                    |
| SENTRY_DSN                                      | Sentry host                                                                                                                 |                                                                         |
| SESSION_COOKIE_AGE                              | duration of the cookie session                                                                                              | 60*60*12                                                                |
| SPECTACULAR_SETTINGS_ENABLE_DJANGO_DEPLOY_CHECK |                                                                                                                             | false                                                                   |
| STORAGES_STATICFILES_BACKEND                    |                                                                                                                             | whitenoise.storage.CompressedManifestStaticFilesStorage                 |
| THEME_CUSTOMIZATION_CACHE_TIMEOUT               | Cache duration for the customization settings                                                                               | 86400                                                                   |
| THEME_CUSTOMIZATION_FILE_PATH                   | Full path to the file customizing the theme. An example is provided in src/backend/impress/configuration/theme/default.json | BASE_DIR/impress/configuration/theme/default.json                       |
| TRASHBIN_CUTOFF_DAYS                            | Trashbin cutoff                                                                                                             | 30                                                                      |
| USER_OIDC_ESSENTIAL_CLAIMS                      | Essential claims in OIDC token                                                                                              | []                                                                      |
| Y_PROVIDER_API_BASE_URL                         | Y Provider url                                                                                                              |                                                                         |
| Y_PROVIDER_API_KEY                              | Y provider API key                                                                                                          |                                                                         |


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

