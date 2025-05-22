"""Helpers for the project, not named `tools` to avoid confusion."""

import logging

from fastmcp import FastMCP

logger = logging.getLogger("docs_mcp_server")


async def check_mcp(mcp: FastMCP):
    """List the MCP server components (tools, resources and templates)."""
    tools = await mcp.get_tools()
    resources = await mcp.get_resources()
    templates = await mcp.get_resource_templates()

    logger.info("%d Tool(s): %s", len(tools), ", ".join([t.name for t in tools.values()]))
    logger.info("%d Resource(s): %s", len(resources), ", ".join([r.name for r in resources.values()]))
    logger.info("%d Resource Template(s): %s", len(templates), ", ".join([t.name for t in templates.values()]))
