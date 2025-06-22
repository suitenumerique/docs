from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Discriminator, Field, ValidationError, model_validator

from .notion_color import NotionColor
from .notion_file import NotionFile
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


class NotionToDo(BaseModel):
    """https://developers.notion.com/reference/block#to-do"""

    block_type: Literal[NotionBlockType.TO_DO] = NotionBlockType.TO_DO
    rich_text: list[NotionRichText]
    checked: bool
    color: NotionColor
    children: list["NotionBlock"] = Field(default_factory=list)


class NotionCode(BaseModel):
    """https://developers.notion.com/reference/block#code"""

    block_type: Literal[NotionBlockType.CODE] = NotionBlockType.CODE
    caption: list[NotionRichText]
    rich_text: list[NotionRichText]
    language: str  # Actually an enum


class NotionCallout(BaseModel):
    """https://developers.notion.com/reference/block#callout"""

    block_type: Literal[NotionBlockType.CALLOUT] = NotionBlockType.CALLOUT
    rich_text: list[NotionRichText]
    # icon: Any # could be an emoji or an image
    color: NotionColor


class NotionDivider(BaseModel):
    """https://developers.notion.com/reference/block#divider"""

    block_type: Literal[NotionBlockType.DIVIDER] = NotionBlockType.DIVIDER


class NotionEmbed(BaseModel):
    """https://developers.notion.com/reference/block#embed"""

    block_type: Literal[NotionBlockType.EMBED] = NotionBlockType.EMBED
    url: str


class NotionBlockFile(BaseModel):
    # FIXME: this is actually another occurrence of type discriminating
    """https://developers.notion.com/reference/block#file"""

    block_type: Literal[NotionBlockType.FILE] = NotionBlockType.FILE
    # TODO: NotionFile


class NotionImage(BaseModel):
    """https://developers.notion.com/reference/block#image"""

    block_type: Literal[NotionBlockType.IMAGE] = NotionBlockType.IMAGE
    file: NotionFile

    @model_validator(mode="before")
    @classmethod
    def move_file_type_inward_and_rename(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        return {"block_type": "image", "file": data}


class NotionVideo(BaseModel):
    """https://developers.notion.com/reference/block#video"""

    block_type: Literal[NotionBlockType.VIDEO] = NotionBlockType.VIDEO
    # FIXME: this actually contains a file reference which will be defined for the above, but with the "video" attribute


class NotionLinkPreview(BaseModel):
    """https://developers.notion.com/reference/block#link-preview"""

    block_type: Literal[NotionBlockType.LINK_PREVIEW] = NotionBlockType.LINK_PREVIEW
    url: str


class NotionBookmark(BaseModel):
    """https://developers.notion.com/reference/block#bookmark"""

    block_type: Literal[NotionBlockType.BOOKMARK] = NotionBlockType.BOOKMARK
    url: str
    caption: list[NotionRichText] = Field(default_factory=list)


class NotionTable(BaseModel):
    """https://developers.notion.com/reference/block#table

    The children of this block are NotionTableRow blocks."""

    block_type: Literal[NotionBlockType.TABLE] = NotionBlockType.TABLE
    table_width: int
    has_column_header: bool
    has_row_header: bool


class NotionTableRow(BaseModel):
    """https://developers.notion.com/reference/block#table-row"""

    block_type: Literal[NotionBlockType.TABLE_ROW] = NotionBlockType.TABLE_ROW
    cells: list[list[NotionRichText]]  # Each cell is a list of rich text objects


class NotionColumnList(BaseModel):
    """https://developers.notion.com/reference/block#column-list-and-column"""

    block_type: Literal[NotionBlockType.COLUMN_LIST] = NotionBlockType.COLUMN_LIST


class NotionColumn(BaseModel):
    """https://developers.notion.com/reference/block#column-list-and-column"""

    block_type: Literal[NotionBlockType.COLUMN] = NotionBlockType.COLUMN


class NotionChildPage(BaseModel):
    """https://developers.notion.com/reference/block#child-page

    My guess is that the actual child page is a child of this block ? We don't have the id..."""

    block_type: Literal[NotionBlockType.CHILD_PAGE] = NotionBlockType.CHILD_PAGE
    title: str


class NotionUnsupported(BaseModel):
    block_type: str
    raw: dict[str, Any] | None = None

    @model_validator(mode="before")
    @classmethod
    def put_all_in_raw(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        if "raw" not in data:
            data["raw"] = data.copy()

        return data


NotionBlockSpecifics = Annotated[
    Annotated[
        NotionHeading1
        | NotionHeading2
        | NotionHeading3
        | NotionParagraph
        | NotionNumberedListItem
        | NotionBulletedListItem
        | NotionToDo
        | NotionCode
        | NotionColumn
        | NotionColumnList
        | NotionDivider
        | NotionEmbed
        | NotionBlockFile
        | NotionImage
        | NotionVideo
        | NotionLinkPreview
        | NotionTable
        | NotionTableRow
        | NotionChildPage
        | NotionCallout
        | NotionLinkPreview
        | NotionBookmark,
        Discriminator(discriminator="block_type"),
    ]
    | NotionUnsupported,
    Field(union_mode="left_to_right"),
]
