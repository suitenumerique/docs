from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Discriminator, Field, ValidationError, model_validator

from .notion_color import NotionColor
from .notion_rich_text import NotionRichText

"""Usage: NotionBlock.model_validate(response.json())"""


class NotionBlock(BaseModel):
    id: str
    created_time: datetime
    last_edited_time: datetime
    archived: bool
    specific: "NotionBlockSpecifics"
    has_children: bool
    children: list["NotionBlock"] = Field(init=False, default_factory=list)
    # This is not part of the API response, but is used to store children blocks

    @model_validator(mode="before")
    @classmethod
    def move_type_inward_and_rename(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        if "type" not in data:
            raise ValidationError("Type must be specified")

        data_type = data.pop("type")
        data["specific"] = data.pop(data_type)
        data["specific"]["block_type"] = data_type

        return data


class NotionBlockType(StrEnum):
    """https://developers.notion.com/reference/block"""

    BOOKMARK = "bookmark"
    BREADCRUMB = "breadcrumb"
    BULLETED_LIST_ITEM = "bulleted_list_item"
    CALLOUT = "callout"
    CHILD_DATABASE = "child_database"
    CHILD_PAGE = "child_page"
    CODE = "code"
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


class NotionHeadingBase(BaseModel):
    """https://developers.notion.com/reference/block#headings"""

    rich_text: list[NotionRichText]
    color: NotionColor
    is_toggleable: bool = False


class NotionHeading1(NotionHeadingBase):
    block_type: Literal[NotionBlockType.HEADING_1] = NotionBlockType.HEADING_1


class NotionHeading2(NotionHeadingBase):
    block_type: Literal[NotionBlockType.HEADING_2] = NotionBlockType.HEADING_2


class NotionHeading3(NotionHeadingBase):
    block_type: Literal[NotionBlockType.HEADING_3] = NotionBlockType.HEADING_3


class NotionParagraph(BaseModel):
    """https://developers.notion.com/reference/block#paragraph"""

    block_type: Literal[NotionBlockType.PARAGRAPH] = NotionBlockType.PARAGRAPH
    rich_text: list[NotionRichText]
    color: NotionColor
    children: list["NotionBlock"] = Field(default_factory=list)


class NotionBulletedListItem(BaseModel):
    """https://developers.notion.com/reference/block#bulleted-list-item"""

    block_type: Literal[NotionBlockType.BULLETED_LIST_ITEM] = (
        NotionBlockType.BULLETED_LIST_ITEM
    )
    rich_text: list[NotionRichText]
    color: NotionColor
    children: list["NotionBlock"] = Field(default_factory=list)


class NotionNumberedListItem(BaseModel):
    """https://developers.notion.com/reference/block#numbered-list-item"""

    block_type: Literal[NotionBlockType.NUMBERED_LIST_ITEM] = (
        NotionBlockType.NUMBERED_LIST_ITEM
    )
    rich_text: list[NotionRichText]
    color: NotionColor
    children: list["NotionBlock"] = Field(default_factory=list)


class NotionCode(BaseModel):
    """https://developers.notion.com/reference/block#code"""

    block_type: Literal[NotionBlockType.CODE] = NotionBlockType.CODE
    caption: list[NotionRichText]
    rich_text: list[NotionRichText]
    language: str  # Actually an enum


class NotionDivider(BaseModel):
    """https://developers.notion.com/reference/block#divider"""

    block_type: Literal[NotionBlockType.DIVIDER] = NotionBlockType.DIVIDER


class NotionEmbed(BaseModel):
    """https://developers.notion.com/reference/block#embed"""

    block_type: Literal[NotionBlockType.EMBED] = NotionBlockType.EMBED
    url: str


class NotionFileType(StrEnum):
    FILE = "file"
    EXTERNAL = "external"
    FILE_UPLOAD = "file_upload"


class NotionFile(BaseModel):
    # FIXME: this is actually another occurrence of type discriminating
    """https://developers.notion.com/reference/block#file"""

    block_type: Literal[NotionBlockType.FILE] = NotionBlockType.FILE
    caption: list[NotionRichText]
    type: NotionFileType
    ...


class NotionImage(BaseModel):
    """https://developers.notion.com/reference/block#image"""

    block_type: Literal[NotionBlockType.IMAGE] = NotionBlockType.IMAGE
    # FIXME: this actually contains a file reference which will be defined for the above, but with the "image" attribute


class NotionLinkPreview(BaseModel):
    """https://developers.notion.com/reference/block#link-preview"""

    block_type: Literal[NotionBlockType.LINK_PREVIEW] = NotionBlockType.LINK_PREVIEW
    url: str


class NotionBlockUnsupported(BaseModel):
    """FIXME: Maybe https://github.com/pydantic/pydantic/discussions/4928#discussioncomment-13079554 would be better"""

    block_type: Literal[
        NotionBlockType.BOOKMARK,
        NotionBlockType.BREADCRUMB,
        NotionBlockType.CALLOUT,
        NotionBlockType.CHILD_DATABASE,
        NotionBlockType.CHILD_PAGE,
        NotionBlockType.COLUMN,
        NotionBlockType.COLUMN_LIST,
        NotionBlockType.EQUATION,
        NotionBlockType.LINK_TO_PAGE,
        NotionBlockType.PDF,
        NotionBlockType.QUOTE,
        NotionBlockType.SYNCED_BLOCK,
        NotionBlockType.TABLE,
        NotionBlockType.TABLE_OF_CONTENTS,
        NotionBlockType.TABLE_ROW,
        NotionBlockType.TEMPLATE,
        NotionBlockType.TO_DO,
        NotionBlockType.TOGGLE,
        NotionBlockType.VIDEO,
        NotionBlockType.UNSUPPORTED,
    ]


NotionBlockSpecifics = Annotated[
    NotionHeading1
    | NotionHeading2
    | NotionHeading3
    | NotionParagraph
    | NotionNumberedListItem
    | NotionBulletedListItem
    | NotionCode
    | NotionDivider
    | NotionEmbed
    | NotionFile
    | NotionImage
    | NotionBlockUnsupported,
    Discriminator(discriminator="block_type"),
]
