# Collaboration

By default with Docs, collaboration is enabled. To allow the collaboration between users, a connection to a websocket server is made (the y-provider service), you only have to configure the Django backend URL and the allowed origin in your y-provider service:

```yaml
COLLABORATION_BACKEND_BASE_URL: https://{yourdocsdomain.tld}
COLLABORATION_SERVER_ORIGIN: https://{yourdocsdomain.tld}
```

## What happens when connection to the websocket is not allowed?

When multiple users access a Docs and the connection to the websocket is not allowed, then they will be in a situation where they can lose data.
They will lose data because they will erase each other modifications. You can also have a scenario with a mix of users connected to the websocket and some other not.
