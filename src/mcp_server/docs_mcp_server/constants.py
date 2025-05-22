"""Project constants."""

import enum


class TransportLayerEnum(enum.Enum):
    """Enum for the MCP server transport layer types."""

    STDIO = "stdio"
    SSE = "sse"
    STREAMABLE_HTTP = "streamable-http"
