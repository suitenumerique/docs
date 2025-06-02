from datetime import datetime

from pydantic import BaseModel


class NotionFile(BaseModel): ...


class NotionPage(BaseModel):
    id: str
    created_time: datetime
    last_edited_time: datetime
    archived: bool
    icon: NotionFile
    cover: NotionFile
