"""The core of the MCP server for the Docs API."""

import asyncio
import logging
import logging.config

import httpx
from fastmcp import FastMCP

from . import settings, utils
from .auth.forwarder import HeaderForwarderAuthentication
from .auth.token import UserTokenAuthentication

logging_config = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "[%(asctime)s] %(levelname)s - %(name)s - %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
        },
    },
    "root": {"handlers": ["default"], "level": "DEBUG"},
    "loggers": {
        "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
        "uvicorn.error": {"handlers": ["default"], "level": "INFO", "propagate": False},
        "uvicorn.access": {"handlers": ["default"], "level": "INFO", "propagate": False},
        "FastMCP": {"handlers": ["default"], "level": "INFO", "propagate": False},
    },
}
logging.config.dictConfig(logging_config)
logger = logging.getLogger("docs_mcp_server")


class ToolsProvider:
    """Provides tools for the MCP server to interact with the Docs API."""

    def __init__(self, mcp_instance):
        """Register all the available tools here."""
        mcp_instance.add_tool(self.create_document_tool)

    @property
    def api_client(self):
        """Create and return an HTTP client for the Docs API."""
        if settings.DOCS_API_TOKEN:
            auth_backend = UserTokenAuthentication(token=settings.DOCS_API_TOKEN)
        else:
            auth_backend = HeaderForwarderAuthentication()

        return httpx.AsyncClient(
            base_url=settings.DOCS_API_URL,
            auth=auth_backend,
        )

    async def create_document_tool(self, document_title: str, document_content: str) -> None:
        """
        Create a new document with the provided title and content.

        Args:
            document_title: The title of the document (required)
            document_content: The content of the document (required)

        """
        _api_client = self.api_client

        # Get current user information
        user_response = await _api_client.get("/api/v1.0/users/me/")
        user_response.raise_for_status()
        user_data = user_response.json()

        # Prepare document data
        data = {
            "title": document_title,
            "content": document_content,
            "sub": user_data["id"],
            "email": user_data["email"],
        }

        # Create the document
        create_response = await _api_client.post(
            "/api/v1.0/documents/create-for-owner/",
            json=data,
        )
        create_response.raise_for_status()

        await _api_client.aclose()


# Create a server instance from the OpenAPI spec
mcp_server = FastMCP(name="Docs MCP Server")
ToolsProvider(mcp_server)


if __name__ == "__main__":
    asyncio.run(utils.check_mcp(mcp_server))
    logger.info("Starting Docs MCP Server...")
    mcp_server.run(
        transport=settings.SERVER_TRANSPORT.value,
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        path=settings.SERVER_PATH,
    )
