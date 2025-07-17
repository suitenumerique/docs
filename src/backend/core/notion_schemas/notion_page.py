from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Discriminator


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
    NotionParentDatabase | NotionParentPage | NotionParentWorkspace | NotionParentBlock,
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

        # This could be parsed using NotionRichText
        rich_text = title_property["title"][0]
        return rich_text["plain_text"]

    def is_root(self):
        return isinstance(self.parent, NotionParentWorkspace)
