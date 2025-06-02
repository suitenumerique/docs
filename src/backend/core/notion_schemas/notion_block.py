from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Discriminator, Field, model_validator

from .notion_color import NotionColor
from .notion_rich_text import NotionRichText

"""Usage: NotionBlock.model_validate(response.json())"""


class NotionBlock(BaseModel):
    created_time: datetime
    last_edited_time: datetime
    archived: bool
    specific: "NotionBlockSpecifics"

    @model_validator(mode="before")
    @classmethod
    def move_type_inward_and_rename(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        assert "type" in data, "Type must be specified"
        data_type = data.pop("type")
        data["specific"] = data.pop(data_type)
        data["specific"]["type"] = data_type

        return data


class NotionBlockType(StrEnum):
    """https://developers.notion.com/reference/block"""

    BOOKMARK = "bookmark"
    BREADCRUMB = "breadcrumb"
    BULLETED_LIST_ITEM = "bulleted_list_item"
    CALLOUT = "callout"
    CHILD_DATABASE = "child_database"
    CHILD_PAGE = "child_page"
    COLUMN = "column"
    COLUMN_LIST = "column_list"
    DIVIDER = "divider"
    EMBED = "embed"
    EQUATION = "equation"
    FILE = "file"
    HEADING_1 = "heading_1"
    HEADING_2 = "heading_2"
    HEADING_3 = "heading_3"
    IMAGE = "image"
    LINK_PREVIEW = "link_preview"
    LINK_TO_PAGE = "link_to_page"
    NUMBERED_LIST_ITEM = "numbered_list_item"
    PARAGRAPH = "paragraph"
    PDF = "pdf"
    QUOTE = "quote"
    SYNCED_BLOCK = "synced_block"
    TABLE = "table"
    TABLE_OF_CONTENTS = "table_of_contents"
    TABLE_ROW = "table_row"
    TEMPLATE = "template"
    TO_DO = "to_do"
    TOGGLE = "toggle"
    UNSUPPORTED = "unsupported"
    VIDEO = "video"


class NotionBlockHeadingBase(BaseModel):
    """https://developers.notion.com/reference/block#headings"""

    type: Literal[
        NotionBlockType.HEADING_1, NotionBlockType.HEADING_2, NotionBlockType.HEADING_3
    ]
    rich_text: list[NotionRichText]
    color: NotionColor
    is_toggleable: bool = False


class NotionBlockHeading1(NotionBlockHeadingBase):
    type: Literal[NotionBlockType.HEADING_1] = NotionBlockType.HEADING_1


class NotionBlockHeading2(NotionBlockHeadingBase):
    type: Literal[NotionBlockType.HEADING_2] = NotionBlockType.HEADING_2


class NotionBlockHeading3(NotionBlockHeadingBase):
    type: Literal[NotionBlockType.HEADING_3] = NotionBlockType.HEADING_3


class NotionParagraph(BaseModel):
    """https://developers.notion.com/reference/block#paragraph"""

    type: Literal[NotionBlockType.PARAGRAPH] = NotionBlockType.PARAGRAPH
    rich_text: list[NotionRichText]
    color: NotionColor
    children: list["NotionBlock"] = Field(default_factory=list)


NotionBlockSpecifics = Annotated[
    NotionBlockHeading1 | NotionBlockHeading2 | NotionBlockHeading3,
    Discriminator(discriminator="type"),
]
