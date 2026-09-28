# Collaboration

By default with Docs, collaboration is enabled. To allow the collaboration between users, a connection to a websocket server is made (the y-provider service), you only have to configure the Django backend URL in your y-provider service:

```yaml
COLLABORATION_BACKEND_BASE_URL: https://{yourdocsdomain.tld}
```

An advanced configuration can be used in some cases when your users are not allowed to use websocket on their network.

## What happens when connection to the websocket is not allowed?

When multiple users access a Docs and the connection to the websocket is not allowed, then they will be in a situation where they can lose data.
They will lose data because they will erase each other modifications. You can also have a scenario with a mix of users connected to the websocket and some other not.

## Safeguard configuration

We have imagined a safeguard scenario, not enabled by default.
The idea is to give the priority to users connected to the websocket. While there is at least one user connected to the websocket, all other users not connected to the websocket can access the Docs in **read-only** mode.

To enable this safeguard, the Django application will have to fetch the `y-provider` service to retrieve some information in it.

In the Django configuration, you have to set these environment variables:

```yaml
COLLABORATION_WS_NOT_CONNECTED_READ_ONLY: True
COLLABORATION_API_URL: https://{yourdocsdomain.tld}/collaboration/api/
COLLABORATION_SERVER_SECRET: A-shared-secret-with-y-provider-service
```

In the y-provider service, you have to set these environment variables:

```yaml
COLLABORATION_SERVER_SECRET: A-shared-secret-with-y-provider-service
COLLABORATION_SERVER_ORIGIN: https://{yourdocsdomain.tld}
```
