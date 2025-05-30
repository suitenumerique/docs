# mcp_server

`mcp_server` is a backend server application designed to manage and process MCP requests.

## Features

- Create a new Docs with a title and markdown content from a request to an agentic LLM.


## Configuration

Configuration options can be set via environment variables or a configuration file (`.env`). 

Common options include:

- `SERVER_TRANSPORT`: `STDIO`, `SSE` or `STREAMABLE_HTTP` (default: `STDIO` locally or `STREAMABLE_HTTP` in the docker image)
- `SERVER_PATH`: The base path of the server tools and resources (default: `/mcp/docs/`)

You will need to set the following options to allow the MCP server to query Docs API:

- `DOCS_API_URL`: The Docs base URL without the "/api/v1.0/" (default: `http://localhost:8071`)
- `DOCS_API_TOKEN`: The API user token you generate from the Docs frontend if you want 
  to use token based authentication (default: `None`). If not provided, the server will 
  use the authentication forwarder (pass the incoming authentication header to the Docs API call).

You may customize the following options for local development, while it's not recommended and may break the Docker image:

- `SERVER_HOST`: (default: `localhost` locally and `0.0.0.0` in the docker Image)
- `SERVER_PORT`: (default: `4200`)

Example when using the server from a Docker instance

```dotenv
SERVER_TRANSPORT=SSE

DOCS_API_URL=http://host.docker.internal:8071/
DOCS_API_TOKEN=<some_token>
```

## Run the MCP server

### Local
You may work on the MCP server project using local configuration with `uv`:

```shell
cd src/mcp_server

make install
make runserver
```

### Docker
If you don't have local installation of Python or `uv` you can work using the Docker image:

```shell
cd src/mcp_server

make runserver-docker
```

## Usage

1. Create a local configuration file `.env`
   
   ```dotenv
   SERVER_TRANSPORT=SSE

   DOCS_API_URL=http://host.docker.internal:8071/
   DOCS_API_TOKEN=your-token-here
   ```
   
2. Run the server

   ```shell
   make runserver-docker
   ```

### In Cursor IDE

In Cursor settings, in the MCP section, you can add a new MCP server with the following configuration:

```json
{
  "mcpServers": {
    "docs": {
      "url": "http://127.0.0.1:4200/mcp/docs/"
    }
  }
}
```

### In VSCode IDE

In VSCode settings, you can add a new MCP server with the following configuration:

```json
// .vscode/settings.json
{
  "chat.mcp.discovery.enabled": true,
  "chat.mcp.enabled": true
}
```

```json
// .vscode/mcp.json
{
  "servers": {
    "docs": {
      "url": "http://localhost:4200/mcp/docs"
    }
  }
}
```

### Locally with `mcphost` and `ollama`

1. Install [mcphost](https://github.com/mark3labs/mcphost)
2. Install [ollama](https://ollama.ai)
3. Start ollama: `ollama serve`
4. Pull an agentic model like Qwen2.5 `ollama pull qwen2.5:3b`
5. Create an MCP configuration file (e.g. `mcphost.json`)
   
   ```json
   {
     "mcpServers": {
       "docs": {
         "url": "http://127.0.0.1:4200/mcp/docs/"
       }
     }
   }
   ```
   
6. Start mcphost

   ```shell
   mcphost -m ollama:qwen2.5:3b --config "$PWD/mcphost.json"
   ```


## About the authentication forwarder

The authentication forwarder is a simple proxy that forwards the authentication header from 
the incoming request to the Docs API call. This allows to use "resource server" authentication.

For instance:

- Docs authentication is based on OIDC with Keycloak.
- The AI chat is using the same Keycloak instance for authentication.
- You can store the access token in the chat session and use it when calling the MCP server.
- The MCP server will forward the access token to the Docs API call 
  (actually, it forwards the whole authentication header).
- Docs will introspect the access token and authenticate the user.
- Conclusion: the user will be able to create a new Doc with the same access token 
  used in the chat session.
