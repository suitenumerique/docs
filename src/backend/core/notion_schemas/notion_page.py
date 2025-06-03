from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Discriminator, Field, ValidationError, model_validator

from .notion_rich_text import NotionRichText


class NotionFile(BaseModel): ...


class NotionParentType(StrEnum):
    DATABASE = "database_id"
    PAGE = "page_id"
    WORKSPACE = "workspace"
    BLOCK = "block_id"


class NotionParentDatabase(BaseModel):
    type: Literal[NotionParentType.DATABASE] = NotionParentType.DATABASE
    database_id: str


class NotionParentPage(BaseModel):
    type: Literal[NotionParentType.PAGE] = NotionParentType.PAGE
    page_id: str


class NotionParentWorkspace(BaseModel):
    type: Literal[NotionParentType.WORKSPACE] = NotionParentType.WORKSPACE


class NotionParentBlock(BaseModel):
    type: Literal[NotionParentType.BLOCK] = NotionParentType.BLOCK
    block_id: str


NotionParent = Annotated[
    NotionParentDatabase
    | NotionParentPage
    | NotionParentWorkspace
    | NotionParentBlock,
    Discriminator(discriminator="type"),
]


class NotionPage(BaseModel):
    id: str
    archived: bool
    parent: NotionParent

    # created_time: datetime
    # last_edited_time: datetime
    # icon: NotionFile
    # cover: NotionFile

    properties: dict  # This is a very messy dict, with some RichText somewhere

    def get_title(self) -> str | None:
        title_property: dict | None = self.properties.get("title")
        if title_property is None:
            return None

        rich_text = title_property["title"][0]  # This could be parsed using NotionRichText
        return rich_text["plain_text"]
