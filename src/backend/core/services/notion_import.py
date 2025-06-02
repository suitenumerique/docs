import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any

import requests
from pydantic import TypeAdapter
from requests import Session

from ..notion_schemas.notion_block import NotionBlock, NotionParagraph
from ..notion_schemas.notion_page import NotionPage

logger = logging.getLogger(__name__)


def build_notion_session(token: str) -> Session:
    session = Session()
    session.headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2022-06-28",
    }
    return session


def search_notion(session: Session, start_cursor: str) -> dict[str, Any]:
    req_data = {}
    if start_cursor:
        req_data = {
            "start_cursor": start_cursor,
            "value": "page",
        }

    response = session.post(
        "https://api.notion.com/v1/search",
        json=req_data,
    )

    if response.status_code != 200:
        print(response.json())

    response.raise_for_status()
    return response.json()


def fetch_root_pages(session: Session) -> list[NotionPage]:
    pages = []
    cursor = ""
    has_more = True

    while has_more:
        response = search_notion(session, start_cursor=cursor)

        for item in response["results"]:
            if item.get("parent", {}).get("type") != "workspace":
                continue

            assert item["object"] == "page"

            pages.append(NotionPage.model_validate(item))

        has_more = response.get("has_more", False)
        cursor = response.get("next_cursor", "")

    return pages


def fetch_blocks(session: Session, block_id: str, start_cursor: str) -> dict[str, Any]:
    response = session.get(
        f"https://api.notion.com/v1/blocks/{block_id}/children",
        params={
            "start_cursor": start_cursor if start_cursor else None,
        },
    )

    response.raise_for_status()
    return response.json()


def fetch_block_children(session: Session, block_id: str) -> list[NotionBlock]:
    blocks: list[NotionBlock] = []
    cursor = ""
    has_more = True

    while has_more:
        response = fetch_blocks(session, block_id, cursor)

        blocks.extend(
            TypeAdapter(list[NotionBlock]).validate_python(response["results"])
        )

        has_more = response.get("has_more", False)
        cursor = response.get("next_cursor", "")

    for block in blocks:
        if block.has_children:
            block.children = fetch_block_children(session, block.id)

    return blocks


def convert_block(block: NotionBlock) -> Any:
    if isinstance(block.specific, NotionParagraph):
        content = ""
        if len(block.specific.rich_text) > 0:
            # TODO: handle multiple of these
            content = block.specific.rich_text[0].plain_text
        return {
            "type": "paragraph",
            "content": content,
        }


def convert_block_list(blocks: list[NotionBlock]) -> Any:
    converted_blocks = []
    for block in blocks:
        converted_block = convert_block(block)
        if converted_block == None:
            continue
        converted_blocks.append(converted_block)
    return converted_blocks


def import_notion(token: str) -> list[(NotionPage, Any)]:
    """Recursively imports all Notion pages and blocks accessible using the given token."""
    session = build_notion_session(token)
    root_pages = fetch_root_pages(session)
    pages_and_blocks = []
    for page in root_pages:
        blocks = fetch_block_children(session, page.id)
        logger.info(f"Page {page.get_title()} (id {page.id})")
        logger.info(blocks)
        pages_and_blocks.append((page, convert_block_list(blocks)))
    return pages_and_blocks
