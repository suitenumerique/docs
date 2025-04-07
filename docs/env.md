# Docs variables

Here we describe all environment variables that can be set for the docs application.

## impress-backend container

These are the environmental variables you can set for the impress-backend container.

| Option                                          | Description                                                                                   | default                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| DJANGO_ALLOWED_HOSTS                            | A comma-separated list of allowed hosts for the Django application.                           | []                                                      |
| DJANGO_SECRET_KEY                               | The secret key for the Django application.                                                    |                                                         |
| DJANGO_SERVER_TO_SERVER_API_TOKENS              | A list of server-to-server API tokens for the Django application.                             | []                                                      |
| DB_ENGINE                                       | The database backend to use, only `django.db.backends.postgresql` is supported.               | django.db.backends.postgresql_psycopg2                  |
| DB_NAME                                         | The name of the database to use.                                                              | impress                                                 |
| DB_USER                                         | The username to use when connecting to the database.                                          | dinum                                                   |
| DB_PASSWORD                                     | The password to use when connecting to the database.                                          | pass                                                    |
| DB_HOST                                         | Which host to use when connecting to the database.                                            | localhost                                               |
| DB_PORT                                         | The port to use when connecting to the database.                                              | 5432                                                    |
| MEDIA_BASE_URL                                  | The base url for themedia files.                                                              |                                                         |
| STORAGES_STATICFILES_BACKEND                    | The name of the staticfiles storage backend.                                                  | whitenoise.storage.CompressedManifestStaticFilesStorage |
| AWS_S3_ENDPOINT_URL                             | The custom S3 URL to use when connecting to S3, including scheme.                             |                                                         |
| AWS_S3_ACCESS_KEY_ID                            | The access key id to use when connecting to S3.                                               |                                                         |
| AWS_S3_SECRET_ACCESS_KEY                        | The secret access key id to use when connecting to S3.                                        |                                                         |
| AWS_S3_REGION_NAME                              | Name of the AWS S3 region to use.                                                             |                                                         |
| AWS_STORAGE_BUCKET_NAME                         | The name of the S3 bucket that will host the files.                                           | impress-media-storage                                   |
| DOCUMENT_IMAGE_MAX_SIZE                         | The maximum size of document in bytes                                                         | 10485760 (10Mb)                                         |
| LANGUAGE_CODE                                   | The default language code for the application.                                                | en-us                                                   |
| API_USERS_LIST_THROTTLE_RATE_SUSTAINED          | API_USERS_LIST_THROTTLE_RATE_SUSTAINED                                                        | 180/hour                                                |
| API_USERS_LIST_THROTTLE_RATE_BURST              | The burst rate limit for the API users list endpoint.                                         | 30/minute                                               |
| SPECTACULAR_SETTINGS_ENABLE_DJANGO_DEPLOY_CHECK | Runs exemplary schema generation and emits warnings as part of "./manage.py check --deploy"   | false                                                   |
| TRASHBIN_CUTOFF_DAYS                            | The number of days after which data in the trashbin is permanently deleted.                   | 30                                                      |
| DJANGO_EMAIL_BACKEND                            | The email backend to use for sending emails.                                                  | django.core.mail.backends.smtp.EmailBackend             |
| DJANGO_EMAIL_BRAND_NAME                         | The brand name to use in email templates.                                                     |                                                         |
| DJANGO_EMAIL_HOST                               | The email host to use for sending emails.                                                     |                                                         |
| DJANGO_EMAIL_HOST_USER                          | The email host user to use when connecting to email host.                                     |                                                         |
| DJANGO_EMAIL_HOST_PASSWORD                      | The email host password to use when connecting to email host.                                 |                                                         |
| DJANGO_EMAIL_LOGO_IMG                           | The logo image to use in email templates.                                                     |                                                         |
| DJANGO_EMAIL_PORT                               | The email port to use for sending emails.                                                     |                                                         |
| DJANGO_EMAIL_USE_TLS                            | A flag to enable or disable TLS for email sending.                                            | false                                                   |
| DJANGO_EMAIL_USE_SSL                            | A flag to enable or disable SSL for email sending.                                            | false                                                   |
| DJANGO_EMAIL_FROM                               | The default from email address to use for sending emails.                                     | from@example.com                                        |
| DJANGO_CORS_ALLOW_ALL_ORIGINS                   | A flag to allow all origins for CORS.                                                         | true                                                    |
| DJANGO_CORS_ALLOWED_ORIGINS                     | A list of allowed origins for CORS.                                                           | []                                                      |
| DJANGO_CORS_ALLOWED_ORIGIN_REGEXES              | A list of allowed origin regexes for CORS.                                                    | []                                                      |
| SENTRY_DSN                                      | The Sentry DSN for error tracking.                                                            |                                                         |
| COLLABORATION_API_URL                           | The API URL for collaboration.                                                                |                                                         |
| COLLABORATION_SERVER_SECRET                     | The server api secret for collaboration.                                                      |                                                         |
| COLLABORATION_WS_URL                            | The WebSocket URL for collaboration.                                                          |                                                         |
| FRONTEND_THEME                                  | The frontend theme to use.                                                                    |                                                         |
| FRONTEND_THEME                                  | The name of the theme used.                                                                   |                                                         |
| FRONTEND_FOOTER_FEATURE_ENABLED                 | A flag to enable the footer.                                                                  | false                                                   |
| FRONTEND_URL_JSON_FOOTER                        | The URL with a json file to compose your own footer.                                          |                                                         |
| POSTHOG_KEY                                     | The PostHog API key for analytics.                                                            |                                                         |
| CRISP_WEBSITE_ID                                | The Crisp website ID for support.                                                             |                                                         |
| DJANGO_CELERY_BROKER_URL                        | The Celery broker URL for task queue.                                                         | redis://redis:6379/0                                    |
| DJANGO_CELERY_BROKER_TRANSPORT_OPTIONS          | The Celery broker transport options for task queue.                                           | {}                                                      |
| OIDC_CREATE_USER                                | Enables or disables automatic user creation during authentication                             | true                                                    |
| OIDC_RP_SIGN_ALGO                               | Sets the algorithm the IdP uses to sign ID tokens                                             | RS256                                                   |
| OIDC_RP_CLIENT_ID                               | OpenID Connect client ID provided by your OP                                                  | impress                                                 |
| OIDC_RP_CLIENT_SECRET                           | OpenID Connect client secret provided by your OP                                              |                                                         |
| OIDC_OP_JWKS_ENDPOINT                           | URL of your OpenID Connect provider JWKS (JSON Web Key Sets) endpoint                         |                                                         |
| OIDC_OP_AUTHORIZATION_ENDPOINT                  | URL of your OpenID Connect provider authorization endpoint                                    |                                                         |
| OIDC_OP_TOKEN_ENDPOINT                          | URL of your OpenID Connect provider token endpoint                                            |                                                         |
| OIDC_OP_USER_ENDPOINT                           | URL of your OpenID Connect provider userinfo endpoint                                         |                                                         |
| OIDC_OP_LOGOUT_ENDPOINT                         | Logout endpoint for OIDC   // TODO                                                            |                                                         |
| OIDC_AUTH_REQUEST_EXTRA_PARAMS                  | Additional parameters to include in the initial authorization request                         | {}                                                      |
| OIDC_RP_SCOPES                                  | The OpenID Connect scopes to request during login                                             | openid email                                            |
| LOGIN_REDIRECT_URL                              | Path to redirect to on successful login.                                                      |                                                         |
| LOGIN_REDIRECT_URL_FAILURE                      | Path to redirect to on an unsuccessful login attempt.                                         |                                                         |
| LOGOUT_REDIRECT_URL                             | After the logout view has logged the user out, it redirects to this url path.                 |                                                         |
| OIDC_USE_NONCE                                  | Controls whether the OpenID Connect client uses nonce verification                            | true                                                    |
| OIDC_REDIRECT_REQUIRE_HTTPS                     | Require https for OIDC redirect url         TODO                                              | false                                                   |
| OIDC_REDIRECT_ALLOWED_HOSTS                     | Allowed hosts for OIDC redirect url         TODO                                              | []                                                      |
| OIDC_STORE_ID_TOKEN                             | Controls whether the OpenID Connect client stores the OIDC id_token in the user session.      | true                                                    |
| OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION       | A flag to enable the system to match users by email - false if duplicate emails are allowed   | true                                                    |
| OIDC_ALLOW_DUPLICATE_EMAILS                     | A flag to allows multiple user accounts to share the same email address                       | false                                                   |
| USER_OIDC_ESSENTIAL_CLAIMS                      | Claim specified by the Client as being necessary                                              | []                                                      |
| USER_OIDC_FIELDS_TO_FULLNAME                    | Fields in OIDC Token used to compute user's full name                                         | ["first_name", "last_name"]                             |
| USER_OIDC_FIELD_TO_SHORTNAME                    | Field in OIDC Token used to compute user's shortname                                          | first_name                                              |
| ALLOW_LOGOUT_GET_METHOD                         | Allow using GET method to logout user                                                         | true                                                    |
| AI_API_KEY                                      | The API key for AI services.                                                                  |                                                         |
| AI_BASE_URL                                     | The base URL for OpenAI compatible services.                                                  |                                                         |
| AI_MODEL                                        | The AI model to use.|                                                                         |                                                         |
| AI_ALLOW_REACH_FROM                             | Users that can use AI must be this level. options are "public", "authenticated", "restricted" | authenticated                                           |
| Y_PROVIDER_API_KEY                              | The API key for Y provider services.                                                          |                                                         |
| Y_PROVIDER_API_BASE_URL                         | The base URL for Y provider services.                                                         |                                                         |
| CONVERSION_API_ENDPOINT                         | The endpoint for conversion API.                                                              | convert-markdown                                        |
| CONVERSION_API_CONTENT_FIELD                    | The content field for conversion API.                                                         |                                                         |
| CONVERSION_API_TIMEOUT                          | The timeout for conversion API.                                                               | 30                                                      |
| CONVERSION_API_SECURE                           | A flag to enable or disable secure conversion API.                                            | false                                                   |
| LOGGING_LEVEL_LOGGERS_ROOT                      | The default logging level. options are "DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"           | INFO                                                    |
| LOGGING_LEVEL_LOGGERS_APP                       | The application logging level. options are "DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"       | INFO                                                    |
| API_USERS_LIST_LIMIT                            | The limit for the number of users returned in the API users list endpoint.                    | 5                                                       |
| DJANGO_CSRF_TRUSTED_ORIGINS                     | A list of trusted origins for CSRF protection.                                                | []                                                      |
| REDIS_URL                                       | The URL for Redis storage.                                                                    | redis://redis:6379/1                                    |
| CACHES_DEFAULT_TIMEOUT                          | The default timeout for caching.                                                              | 30                                                      |
