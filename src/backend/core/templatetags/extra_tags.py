"""Custom template tags for the core application of Docs."""

import base64

from django import template
from django.contrib.staticfiles import finders

from PIL import ImageFile as PillowImageFile

register = template.Library()


def image_to_base64(file_or_path, close=False):
    """
    Return the src string of the base64 encoding of an image represented by its path
    or file opened or not.

    Inspired by Django's "get_image_dimensions"
    """
    pil_parser = PillowImageFile.Parser()
    if hasattr(file_or_path, "read"):
        file = file_or_path
        if file.closed and hasattr(file, "open"):
            file_or_path.open()
        file_pos = file.tell()
        file.seek(0)
    else:
        try:
            # pylint: disable=consider-using-with
            file = open(file_or_path, "rb")
        except OSError:
            return ""
        close = True

    try:
        image_data = file.read()
        if not image_data:
            return ""
        pil_parser.feed(image_data)
        if pil_parser.image:
            mime_type = pil_parser.image.get_format_mimetype()
            encoded_string = base64.b64encode(image_data)
            return f"data:{mime_type:s};base64, {encoded_string.decode('utf-8'):s}"
        return ""
    finally:
        if close:
            file.close()
        else:
            file.seek(file_pos)


@register.simple_tag
def base64_static(path):
    """Return a static file into a base64."""
    full_path = finders.find(path)
    if full_path:
        return image_to_base64(full_path, True)
    return ""
