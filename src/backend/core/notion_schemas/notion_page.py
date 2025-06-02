from datetime import datetime

from pydantic import BaseModel

from .notion_rich_text import NotionRichText


class NotionFile(BaseModel): ...


class NotionPage(BaseModel):
    id: str
    archived: bool

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
