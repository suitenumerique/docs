from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Discriminator


class NotionFileType(StrEnum):
    HOSTED = "file"
    UPLOAD = "file_upload"
    EXTERNAL = "external"


class NotionFileHosted(BaseModel):
    type: Literal[NotionFileType.HOSTED] = NotionFileType.HOSTED
    file: dict  # TODO


class NotionFileUpload(BaseModel):
    type: Literal[NotionFileType.UPLOAD] = NotionFileType.UPLOAD
    file_upload: dict  # TODO


class NotionFileExternal(BaseModel):
    type: Literal[NotionFileType.EXTERNAL] = NotionFileType.EXTERNAL
    external: dict  # TODO


NotionFile = Annotated[
    NotionFileHosted | NotionFileUpload | NotionFileExternal,
    Discriminator(discriminator="type"),
]
