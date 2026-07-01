# Format conversion

Docs allow to manipulate a document in multiple format. You can export in HTLM, copy as markdown, import markdown file, etc.

To make it works, some configuration should be made and an other service enable if you want to import file in docx format.

## Conversion configuration

The fiest configuration to make is related to converting a docs in multiple format. This will be used by the `formatted-content` endpoint (`/api/v1.0/documents/{document_id}/formatted-content/?content_format=(json|hlm|markdown)`).
This service is also used by the `create-for-owner` endpoint and in the import of markdown file.
To configure it, use this environment variables in the Django service:

```
Y_PROVIDER_API_BASE_URL: http://{y-provider-service}:443/api/
Y_PROVIDER_API_KEY: a-shared-private-key-with-y-provider
```

For the `Y_PROVIDER_API_BASE_URL`, it can be the FQDN of your docs instance if you have configured a reverse proxy in front of the y-provider service and crated a route to the `/api` for this service. It can also be the internal `y-provider` service url if Django can access it directly. In the case you deploy in a Kubernetes cluster, you can use the `y-provider` service url. We prefer the usage of internal url.

You also have to add an environment variable in your `y-provider` configuration, to share the same `Y_PROVIDER_API_KEY`:

```
Y_PROVIDER_API_KEY: a-shared-private-key-with-y-provider
```

## Docspec configuration

[Docspec](https://github.com/docspec) is an external service made to transform legacy document formats into accessible, reusable content for modern editors. We are using it to import `.docx` file and convert them to be used with docs, enabling all the power of Docs without the caveats of this legacy format.

You are responsible to deploy your own version of docspec, if you are using our helm chart, deploying docspec is really easy, you just have to enable it in your `values` configuration:

```
docSpec:
  enabled: true
```

If you deploy it your own way, be aware that this service exposes a public API, everybody knowing its url can use it. We highly suggest to deploy it in a private network, usable by docs.

Once docspec deploy, you have to enable its usage in Django by using these environment variables:

```
CONVERSION_UPLOAD_ENABLED: True
DOCSPEC_API_URL: http://impress-docs-docspec:4000/conversion
```
