import json
import logging
from typing import Any

from pydantic import BaseModel, TypeAdapter
from requests import Session

from ..notion_schemas.notion_block import (
    NotionBlock,
    NotionBulletedListItem,
    NotionChildPage,
    NotionColumn,
    NotionColumnList,
    NotionDivider,
    NotionHeading1,
    NotionHeading2,
    NotionHeading3,
    NotionImage,
    NotionNumberedListItem,
    NotionParagraph,
    NotionTable,
    NotionTableRow,
    NotionToDo,
    NotionUnsupported,
)
from ..notion_schemas.notion_file import NotionFileExternal, NotionFileHosted
from ..notion_schemas.notion_page import (
    NotionPage,
    NotionParentBlock,
    NotionParentPage,
    NotionParentWorkspace,
)
from ..notion_schemas.notion_rich_text import NotionRichText, NotionRichTextAnnotation

logger = logging.getLogger(__name__)


def build_notion_session(token: str) -> Session:
    session = Session()
    session.headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2022-06-28",
    }
    return session


def search_notion(session: Session, start_cursor: str) -> dict[str, Any]:
    req_data = {
        "filter": {
            "value": "page",
            "property": "object",
        },
    }
    if start_cursor:
        req_data = {
            "start_cursor": start_cursor,
            "filter": {
                "value": "page",
                "property": "object",
            },
        }

    response = session.post(
        "https://api.notion.com/v1/search",
        json=req_data,
    )

    if response.status_code != 200:
        print(response.json())

    response.raise_for_status()
    return response.json()


def fetch_all_pages(session: Session) -> list[NotionPage]:
    pages = []
    cursor = ""
    has_more = True

    while has_more:
        response = search_notion(session, start_cursor=cursor)

        for item in response["results"]:
            if item["object"] != "page":
                logger.warning(f"Skipping non-page object: {item['object']}")
                continue

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


def convert_rich_texts(rich_texts: list[NotionRichText]) -> list[dict[str, Any]]:
    content = []
    for rich_text in rich_texts:
        stylestab = convert_annotations(rich_text.annotations)
        content.append(
            {
                "type": "text",
                "text": rich_text.plain_text,
                "styles": stylestab,
            }
        )
    return content


class ImportedAttachment(BaseModel):
    block: Any
    file: NotionFileHosted


def convert_image(
    image: NotionImage, attachments: list[ImportedAttachment]
) -> list[dict[str, Any]]:
    # TODO: NotionFileUpload
    match image.file:
        case NotionFileExternal():
            return [
                {
                    "type": "image",
                    "props": {
                        "url": image.file.external["url"],
                    },
                }
            ]
        case NotionFileHosted():
            block = {
                "type": "image",
                "props": {
                    "url": "about:blank",  # populated later on
                },
            }
            attachments.append(ImportedAttachment(block=block, file=image.file))

            return [block]
        case _:
            return [{"paragraph": {"content": "Unsupported image type"}}]


def convert_block(
    block: NotionBlock, attachments: list[ImportedAttachment]
) -> list[dict[str, Any]]:
    match block.specific:
        case NotionColumnList():
            columns_content = []
            for column in block.children:
                columns_content.extend(convert_block(column, attachments))
            return columns_content
        case NotionColumn():
            return [
                convert_block(child_content, attachments)[0]
                for child_content in block.children
            ]

        case NotionParagraph():
            content = convert_rich_texts(block.specific.rich_text)
            return [
                {
                    "type": "paragraph",
                    "content": content,
                }
            ]
        case NotionImage():
            return convert_image(block.specific, attachments)
        case NotionHeading1() | NotionHeading2() | NotionHeading3():
            return [
                {
                    "type": "heading",
                    "content": convert_rich_texts(block.specific.rich_text),
                    "level": block.specific.block_type.value.split("_")[
                        -1
                    ],  # e.g., "1", "2", or "3"
                }
            ]
        # case NotionDivider():
        #     return {"type": "divider", "properties": {}}
        case NotionTable():
            rows: list[NotionTableRow] = [child.specific for child in block.children]  # type: ignore # I don't know how to assert properly
            if len(rows) == 0:
                return [
                    {
                        "type": "paragraph",
                        "content": "Empty table ?!",
                    }
                ]

            n_columns = len(
                rows[0].cells
            )  # I'll assume all rows have the same number of cells
            if n_columns == 0:
                return [{"type": "paragraph", "content": "Empty row ?!"}]
            if not all(len(row.cells) == n_columns for row in rows):
                return [
                    {
                        "type": "paragraph",
                        "content": "Rows have different number of cells ?!",
                    }
                ]
            return [
                {
                    "type": "table",
                    "content": {
                        "type": "tableContent",
                        "columnWidths": [
                            1000 / n_columns for _ in range(n_columns)
                        ],  # TODO
                        "headerRows": int(block.specific.has_column_header),
                        "headerColumns": int(block.specific.has_row_header),
                        "props": {
                            "textColor": "default",  # TODO
                        },
                        "rows": [
                            {
                                "cells": [
                                    {
                                        "type": "tableCell",
                                        "content": convert_rich_texts(cell),
                                    }
                                    for cell in row.cells
                                ]
                            }
                            for row in rows
                        ],
                    },
                }
            ]
        case NotionBulletedListItem():
            return [
                {
                    "type": "bulletListItem",
                    "content": convert_rich_texts(block.specific.rich_text),
                    "children": convert_block_list(block.children),
                }
            ]
        case NotionNumberedListItem():
            return [
                {
                    "type": "numberedListItem",
                    "content": convert_rich_texts(block.specific.rich_text),
                    "children": convert_block_list(block.children),
                }
            ]
        case NotionToDo():
            return [
                {
                    "type": "checkListItem",
                    "content": convert_rich_texts(block.specific.rich_text),
                    "checked": block.specific.checked,
                    "children": convert_block_list(block.children),
                }
            ]
        case NotionUnsupported():
            return [
                {
                    "type": "paragraph",
                    "content": f"This should be a {block.specific.block_type}, not yet supported in docs",
                },
                # {
                #     "type": "quote",
                #     "content": json.dumps(block.specific.raw, indent=2),
                # },
            ]
        case _:
            return [
                {
                    "type": "paragraph",
                    "content": f"This should be a {block.specific.block_type}, not yet handled by the importer",
                }
            ]


def convert_annotations(annotations: NotionRichTextAnnotation) -> dict[str, str]:
    res = {}
    if annotations.bold:
        res["bold"] = "true"
    if annotations.italic:
        res["italic"] = "true"
    if annotations.underline:
        res["underline"] = "true"
    if annotations.strikethrough:
        res["strike"] = "true"

    if "_" in annotations.color:
        res["backgroundColor"] = annotations.color.split("_")[0].lower()
    else:
        res["textColor"] = annotations.color.lower()
    return res


def convert_block_list(
    blocks: list[NotionBlock], attachments: list[ImportedAttachment]
) -> list[dict[str, Any]]:
    converted_blocks = []
    for block in blocks:
        converted_blocks.extend(convert_block(block, attachments))
    return converted_blocks


class ImportedDocument(BaseModel):
    page: NotionPage
    blocks: list[dict[str, Any]] = []
    children: list["ImportedDocument"] = []
    attachments: list[ImportedAttachment] = []


def find_block_child_page(block_id: str, all_pages: list[NotionPage]):
    for page in all_pages:
        if (
            isinstance(page.parent, NotionParentBlock)
            and page.parent.block_id == block_id
        ):
            return page
    return None


def convert_child_pages(
    session: Session,
    parent: NotionPage,
    blocks: list[NotionBlock],
    all_pages: list[NotionPage],
) -> list[ImportedDocument]:
    children = []

    for page in all_pages:
        if (
            isinstance(page.parent, NotionParentPage)
            and page.parent.page_id == parent.id
        ):
            children.append(import_page(session, page, all_pages))

    for block in blocks:
        if not isinstance(block.specific, NotionChildPage):
            continue

        # TODO
        # parent_page = find_block_child_page(block.id, all_pages)
        # if parent_page == None:
        #    logger.warning(f"Cannot find parent of block {block.id}")
        #    continue
        # children.append(import_page(session, parent_page, all_pages))

    return children


def import_page(
    session: Session, page: NotionPage, all_pages: list[NotionPage]
) -> ImportedDocument:
    blocks = fetch_block_children(session, page.id)
    logger.info(f"Page {page.get_title()} (id {page.id})")
    logger.info(blocks)
    attachments = []
    converted_blocks = convert_block_list(blocks, attachments)
    return ImportedDocument(
        page=page,
        blocks=converted_blocks,
        children=convert_child_pages(session, page, blocks, all_pages),
        attachments=attachments,
    )


def import_notion(token: str) -> list[ImportedDocument]:
    """Recursively imports all Notion pages and blocks accessible using the given token."""
    session = build_notion_session(token)
    all_pages = fetch_all_pages(session)
    docs = []
    for page in all_pages:
        if isinstance(page.parent, NotionParentWorkspace):
            docs.append(import_page(session, page, all_pages))
    return docs
