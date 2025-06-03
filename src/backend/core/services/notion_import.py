import json
import logging
from typing import Any

from pydantic import BaseModel, Field, TypeAdapter
from requests import Session

from ..notion_schemas.notion_block import (
    NotionBlock,
    NotionBookmark,
    NotionBulletedListItem,
    NotionCallout,
    NotionChildPage,
    NotionCode,
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
        if rich_text.href:
            content.append(
                {
                    "type": "link",
                    "content": [convert_rich_text(rich_text)],
                    "href": rich_text.href,  # FIXME: if it was a notion link, we should convert it to a link to the document
                }
            )
        else:
            content.append(convert_rich_text(rich_text))
    return content


def convert_rich_text(rich_text: NotionRichText) -> dict[str, Any]:
    return {
        "type": "text",
        "text": rich_text.plain_text,
        "styles": convert_annotations(rich_text.annotations),
    }


class ImportedAttachment(BaseModel):
    block: Any
    file: NotionFileHosted


class ImportedChildPage(BaseModel):
    child_page_block: NotionBlock
    block_to_update: Any


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
    block: NotionBlock,
    attachments: list[ImportedAttachment],
    child_page_blocks: list[ImportedChildPage],
) -> list[dict[str, Any]]:
    match block.specific:
        case NotionColumnList():
            columns_content = []
            for column in block.children:
                columns_content.extend(
                    convert_block(column, attachments, child_page_blocks)
                )
            return columns_content
        case NotionColumn():
            return [
                convert_block(child_content, attachments, child_page_blocks)[0]
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
                    "props": {
                        "level": block.specific.block_type.value.split("_")[
                            -1
                        ],  # e.g., "1", "2", or "3"
                    },
                }
            ]
        # case NotionDivider():
        #     return [{"type": "divider"}]
        case NotionCallout():
            return [
                {
                    "type": "quote",
                    "content": convert_rich_texts(block.specific.rich_text),
                    "props": {
                        "backgroundColor": "yellow",  # TODO: use the callout color
                    },
                }
            ]
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
            SEEMINGLY_DEFAULT_WIDTH = 128
            return [
                {
                    "type": "table",
                    "content": {
                        "type": "tableContent",
                        "columnWidths": [
                            SEEMINGLY_DEFAULT_WIDTH for _ in range(n_columns)
                        ],
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
                    "children": convert_block_list(
                        block.children,
                        attachments,
                        child_page_blocks,
                    ),
                }
            ]
        case NotionNumberedListItem():
            return [
                {
                    "type": "numberedListItem",
                    "content": convert_rich_texts(block.specific.rich_text),
                    "children": convert_block_list(
                        block.children,
                        attachments,
                        child_page_blocks,
                    ),
                }
            ]
        case NotionToDo():
            return [
                {
                    "type": "checkListItem",
                    "content": convert_rich_texts(block.specific.rich_text),
                    "checked": block.specific.checked,
                    "children": convert_block_list(
                        block.children,
                        attachments,
                        child_page_blocks,
                    ),
                }
            ]
        case NotionCode():
            return [
                {
                    "type": "codeBlock",
                    "content": "".join(
                        rich_text.plain_text for rich_text in block.specific.rich_text
                    ),
                    "props": {"language": block.specific.language},
                }
            ]
        case NotionBookmark():
            caption = convert_rich_texts(block.specific.caption) or block.specific.url
            return [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "link",
                            "content": caption,
                            "href": block.specific.url,
                        },
                    ],
                }
            ]
        case NotionChildPage():
            # TODO: convert to a link
            res = {
                "type": "paragraph",
                "content": [
                    {
                        "type": "link",
                        "content": f"Child page: {block.specific.title}",
                        "href": "about:blank",  # populated later on
                    },
                ],
            }
            child_page_blocks.append(
                ImportedChildPage(child_page_block=block, block_to_update=res)
            )
            return [res]
        case NotionUnsupported():
            return [
                {
                    "type": "paragraph",
                    "content": f"This should be a {block.specific.block_type}, not yet supported in docs",
                },
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
    blocks: list[NotionBlock],
    attachments: list[ImportedAttachment],
    child_page_blocks: list[ImportedChildPage],
) -> list[dict[str, Any]]:
    converted_blocks = []
    for block in blocks:
        converted_blocks.extend(convert_block(block, attachments, child_page_blocks))
    return converted_blocks


class ImportedDocument(BaseModel):
    page: NotionPage
    blocks: list[dict[str, Any]] = Field(default_factory=list)
    children: list["ImportedDocument"] = Field(default_factory=list)
    attachments: list[ImportedAttachment] = Field(default_factory=list)
    child_page_blocks: list[ImportedChildPage] = Field(default_factory=list)


def find_block_child_page(block_id: str, all_pages: list[NotionPage]):
    for page in all_pages:
        if (
            isinstance(page.parent, NotionParentBlock)
            and page.parent.block_id == block_id
        ):
            return page
    return None


def import_page(
    session: Session,
    page: NotionPage,
    child_page_blocs_ids_to_parent_page_ids: dict[str, str],
) -> ImportedDocument:
    blocks = fetch_block_children(session, page.id)
    logger.info(f"Page {page.get_title()} (id {page.id})")
    logger.info(blocks)
    attachments: list[ImportedAttachment] = []

    child_page_blocks: list[ImportedChildPage] = []

    converted_blocks = convert_block_list(blocks, attachments, child_page_blocks)

    for child_page_block in child_page_blocks:
        child_page_blocs_ids_to_parent_page_ids[
            child_page_block.child_page_block.id
        ] = page.id

    return ImportedDocument(
        page=page,
        blocks=converted_blocks,
        attachments=attachments,
        child_page_blocks=child_page_blocks,
    )


def import_notion(token: str) -> list[ImportedDocument]:
    """Recursively imports all Notion pages and blocks accessible using the given token."""
    session = build_notion_session(token)
    all_pages = fetch_all_pages(session)
    docs_by_page_id: dict[str, ImportedDocument] = {}
    child_page_blocs_ids_to_parent_page_ids: dict[str, str] = {}
    for page in all_pages:
        docs_by_page_id[page.id] = import_page(
            session, page, child_page_blocs_ids_to_parent_page_ids
        )

    root_pages = []
    for page in all_pages:
        if isinstance(page.parent, NotionParentPage):
            docs_by_page_id[page.parent.page_id].children.append(
                docs_by_page_id[page.id]
            )
        elif isinstance(page.parent, NotionParentBlock):
            parent_page_id = child_page_blocs_ids_to_parent_page_ids.get(page.id)
            if parent_page_id:
                docs_by_page_id[parent_page_id].children.append(
                    docs_by_page_id[page.id]
                )
            else:
                logger.warning(
                    f"Page {page.id} has a parent block, but no parent page found."
                )
        elif isinstance(page.parent, NotionParentWorkspace):
            # This is a root page, not a child of another page
            root_pages.append(docs_by_page_id[page.id])

    return root_pages
