"""Settings for the MCP server."""

import os

from dotenv import load_dotenv

from .constants import TransportLayerEnum

load_dotenv()


# Server settings
SERVER_TRANSPORT = TransportLayerEnum[os.getenv("SERVER_TRANSPORT", "STDIO")]
SERVER_HOST = str(os.getenv("SERVER_HOST", "localhost"))
SERVER_PORT = int(os.getenv("SERVER_PORT", "4200"))
SERVER_PATH = str(os.getenv("SERVER_PATH", "/mcp/docs"))


# Docs related settings
DOCS_API_URL = str(os.getenv("DOCS_API_URL", "http://localhost:8071"))
DOCS_API_TOKEN = str(os.getenv("DOCS_API_TOKEN", "")) or None
