"""Utils for the core app."""

from bs4 import BeautifulSoup

FORBIDDEN_TAGS = ["script", "iframe", "foreignObject"]


def sanitize_markup(markup: str, forbidden_tags=None) -> str:
    """Remove forbidden tags and their contents from the given markup."""
    if forbidden_tags is None:
        forbidden_tags = FORBIDDEN_TAGS

    soup = BeautifulSoup(markup, "xml")

    forbidden_lower = {tag.lower() for tag in forbidden_tags}
    for tag in soup.find_all():
        if tag.name.lower() in forbidden_lower:
            tag.decompose()
    return str(soup)
