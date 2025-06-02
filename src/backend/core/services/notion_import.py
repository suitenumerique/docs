from enum import Enum
import requests


class PageType(Enum):
    PAGE = "page"
    DATABASE = "database"


class Page:
    def __init__(self, type, id, name):
        self.type = type
        self.id = id
        self.name = name

    def __repr__(self):
        return f"\n  Page(type={self.type}, id='{self.id}', name='{self.name}')"


def search_notion(token: str, start_cursor: str):
    response = requests.post(
        "https://api.notion.com/v1/search",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
            "start_cursor": start_cursor if start_cursor else None,
            "value": "page",
        },
    )

    if response.status_code == 200:
        print("✅ Requête réussie !")
        return response.json()
    else:
        print(f"❌ Erreur lors de la requête : {response.status_code}")
        print(response.text)


def fetch_root_pages(token: str):
    pages = []
    cursor = None
    has_more = True

    while has_more:
        response = search_notion(token, start_cursor=cursor)

        for item in response["results"]:
            if item.get("parent", {}).get("type") == "workspace":
                obj_type = item["object"]
                if obj_type == "page":
                    page_type = PageType.PAGE
                    rich_texts = next(
                        (
                            prop["title"]
                            for prop in item["properties"].values()
                            if prop["type"] == "title"
                        ),
                        [],
                    )
                else:
                    page_type = PageType.DATABASE
                    rich_texts = item.title

                pages.append(
                    Page(
                        type=page_type,
                        id=item["id"],
                        name="".join(
                            rich_text["plain_text"] for rich_text in rich_texts
                        ),
                    )
                )

        has_more = response.get("has_more", False)
        cursor = response.get("next_cursor")

    return pages


def fetch_blocks(token: str, block_id: str):
    response = requests.get(
        f"https://api.notion.com/v1/blocks/{block_id}/children",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        },
    )

    if response.status_code == 200:
        return response.json()
    else:
        print(f"❌ Erreur lors de la requête : {response.status_code}")
        print(response.text)


def fetch_block_children(token: str, block_id: str):
    blocks = []
    cursor = None
    has_more = True

    while has_more:
        response = fetch_blocks(token, block_id)

        blocks.extend(response["results"])

        has_more = response.get("has_more", False)
        cursor = response.get("next_cursor")

    children = []
    for block in blocks:
        if block["has_children"]:
            response = fetch_block_children(token, block["id"])
            children.extend(response)

    blocks.extend(children)
    return blocks


def import_notion(token: str):
    """Recursively imports all Notion pages and blocks accessible using the given token."""
    root_pages = fetch_root_pages(token)
    for root_page in root_pages:
        page_content = fetch_block_children(token, root_page.id)
        print(f"Page {root_page.id}")
        print(page_content)
        print()
