# Format conversion

Docs allows manipulating a document in multiple formats. You can export in HTML, copy as markdown, import markdown files, etc.

To make it work, some configuration should be made and another service enabled if you want to import files in docx format.

## Conversion configuration

The first configuration to make is related to converting a docs in multiple format. This will be used by the `formatted-content` endpoint (`/api/v1.0/documents/{document_id}/formatted-content/?content_format=(json|html|markdown)`).
This service is also used by the `create-for-owner` endpoint and in the import of markdown file.
To configure it, use this environment variable in the Django service:

```yaml
Y_PROVIDER_API_BASE_URL: http://{y-provider-service}:443/api/
```

For the `Y_PROVIDER_API_BASE_URL`, it can be the FQDN of your docs instance if you have configured a reverse proxy in front of the y-provider service and created a route to the `/api` for this service. It can also be the internal `y-provider` service url if Django can access it directly. In the case you deploy in a Kubernetes cluster, you can use the `y-provider` service url. We prefer the usage of internal url.

Requests to the y-provider service are authenticated with a short-lived admin JWT that Django signs itself (see `core.services.jwt_services.JWTService`), instead of a shared secret. The y-provider service verifies the signature against the public key Django publishes on its JWKS endpoint (`/api/v1.0/jwks`), so there is nothing to configure on the Django side beyond `JWT_PRIVATE_KEY` (see the JWT section of [env.md](env.md)).

On the `y-provider` side, point it at the Django backend so it can fetch the JWKS:

```yaml
COLLABORATION_BACKEND_BASE_URL: http://{django-service}:8000
```

The JWKS url defaults to `{COLLABORATION_BACKEND_BASE_URL}/api/v1.0/jwks`; override it with `JWKS_URL` if Django is not reachable at that base url from the y-provider service.

### Splitting conversion service

The conversion service is present in the `y-provider` server. The same server used to manage websockets. You can split in one side the websocket server and in an other side the converter service.
This feature is only available in our helm chart, if you are deploying an other way you can take example of what is made to implement it.
The idea is to deploy twice the `y-provider` server, one dedicated for websockets and one dedicated to the conversion.

In the helm chart, you can use this value that will do the job for you:

```yaml
yProvider:
  converter:
    enabled: true
```

Every parameter in the `yProvider` key can be overridden in the `yProvider.converter` key.

Once enabled, you have to enable the `Y_PROVIDER_API_BASE_URL` with the url of the newly created service, it is the same as before with `-converter` at the end.
If before it was

```yaml
Y_PROVIDER_API_BASE_URL: http://impress-docs-y-provider:443/api/
```

now it is

```yaml
Y_PROVIDER_API_BASE_URL: http://impress-docs-y-provider-converter:443/api/
```

## Docspec configuration

[Docspec](https://github.com/docspec) is an external service made to transform legacy document formats into accessible, reusable content for modern editors. We are using it to import `.docx` file and convert them to be used with docs, enabling all the power of Docs without the caveats of this legacy format.

You are responsible to deploy your own version of docspec, if you are using our helm chart, deploying docspec is really easy, you just have to enable it in your `values` configuration:

```yaml
docSpec:
  enabled: true
```

If you deploy it your own way, be aware that this service exposes a public API, everybody knowing its url can use it. We highly suggest to deploy it in a private network, usable by docs.

Once docspec is deployed, you have to enable its usage in Django by using these environment variables:

```yaml
CONVERSION_UPLOAD_ENABLED: True
DOCSPEC_API_URL: http://impress-docs-docspec:4000/conversion
```
