from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Discriminator, Field, ValidationError, model_validator

from .notion_color import NotionColor


class NotionRichTextAnnotation(BaseModel):
    """https://developers.notion.com/reference/rich-text#the-annotation-object"""

    bold: bool = False
    italic: bool = False
    strikethrough: bool = False
    underline: bool = False
    code: bool = False
    color: NotionColor = NotionColor.DEFAULT


class NotionRichText(BaseModel):
    """https://developers.notion.com/reference/rich-text, not a block"""

    annotations: NotionRichTextAnnotation
    plain_text: str
    href: str | None = None
    specific: "NotionRichTextSpecifics"

    @model_validator(mode="before")
    @classmethod
    def move_type_inward_and_rename(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        if "type" not in data:
            raise ValidationError("Type must be specified")
        data_type = data.pop("type")
        data["specific"] = data.pop(data_type)
        data["specific"]["type"] = data_type

        return data


class NotionRichTextType(StrEnum):
    TEXT = "text"
    MENTION = "mention"
    EQUATION = "equation"


class NotionLink(BaseModel):
    url: str


class NotionRichTextText(BaseModel):
    type: Literal[NotionRichTextType.TEXT] = NotionRichTextType.TEXT
    content: str
    link: NotionLink | None


class NotionRichTextMention(BaseModel):
    type: Literal[NotionRichTextType.MENTION] = NotionRichTextType.MENTION
    # Mention


class NotionRichTextEquation(BaseModel):
    type: Literal[NotionRichTextType.EQUATION] = NotionRichTextType.EQUATION
    expression: str  # LaTeX expression


NotionRichTextSpecifics = Annotated[
    NotionRichTextText | NotionRichTextMention | NotionRichTextEquation,
    Discriminator(discriminator="type"),
]
