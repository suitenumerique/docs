"""Unit tests for the zip_import service."""

import io
import zipfile
from pathlib import Path

from core.services.zip_import import parse_zip

FIXTURES = Path(__file__).parent / "fixtures"


def test_parse_empty_zip():
    """An empty zip returns no nodes."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w"):
        pass
    buf.seek(0)
    with zipfile.ZipFile(buf) as zf:
        assert not parse_zip(zf)


def test_parse_zip_ignores_non_md_non_csv_files():
    """Non-.md and non-.csv files (images, binaries, etc.) produce no nodes."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("doc.md", b"# Hello")
        zf.writestr("image.png", b"\x89PNG")
    buf.seek(0)
    with zipfile.ZipFile(buf) as zf:
        nodes = parse_zip(zf)
    assert len(nodes) == 1
    assert nodes[0].title == "doc"


def test_parse_zip_root_collection():
    """A top-level folder with no matching .md becomes a container node."""
    with zipfile.ZipFile(FIXTURES / "outline-export.zip") as zf:
        roots = parse_zip(zf)

    assert len(roots) == 1
    assert roots[0].title == "Welcome"
    assert roots[0].content is None
    assert len(roots[0].children) == 4


def test_parse_zip_nested_children():
    """A subfolder alongside a .md of the same name yields children on that node."""
    with zipfile.ZipFile(FIXTURES / "outline-export.zip") as zf:
        roots = parse_zip(zf)

    by_title = {child.title: child for child in roots[0].children}
    getting_started = by_title["Getting Started"]
    assert len(getting_started.children) == 1
    assert getting_started.children[0].title == "rich nested doc"


def test_parse_zip_content_present():
    """Nodes built from .md files carry their raw bytes as content."""
    with zipfile.ZipFile(FIXTURES / "outline-export.zip") as zf:
        roots = parse_zip(zf)

    by_title = {child.title: child for child in roots[0].children}
    assert by_title["Our Editor"].content is not None
    assert b"editor" in by_title["Our Editor"].content.lower()


def test_parse_zip_media_attached():
    """Image files referenced in a .md are stored in node.media keyed by their relative ref."""
    with zipfile.ZipFile(FIXTURES / "outline-export.zip") as zf:
        roots = parse_zip(zf)

    by_title = {child.title: child for child in roots[0].children}
    getting_started = by_title["Getting Started"]
    rich = getting_started.children[0]
    assert rich.title == "rich nested doc"
    assert len(rich.media) == 1
    ref, media_bytes = next(iter(rich.media.items()))
    assert ref.endswith("harley-benton.jpeg")
    assert media_bytes[:3] == b"\xff\xd8\xff"  # JPEG magic bytes


def test_parse_zip_external_links_not_collected():
    """Absolute http(s) image URLs are not added to node.media."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("doc.md", b"![](https://example.com/image.png)")
    buf.seek(0)
    with zipfile.ZipFile(buf) as zf:
        nodes = parse_zip(zf)
    assert nodes[0].media == {}


def test_parse_csv_becomes_markdown_table():
    """A .csv file is turned into a DocumentNode whose content is a markdown table."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("Collection/data.csv", b"name,score\nAlice,10\nBob,20")
    buf.seek(0)
    with zipfile.ZipFile(buf) as zf:
        roots = parse_zip(zf)

    assert len(roots) == 1
    assert roots[0].title == "Collection"
    assert len(roots[0].children) == 1
    node = roots[0].children[0]
    assert node.title == "data"
    content = node.content.decode()
    assert "| name | score |" in content
    assert "| Alice | 10 |" in content
    assert "| Bob | 20 |" in content


def test_parse_csv_link_rewritten_to_doc_url():
    """URL-encoded CSV links are decoded then rewritten to /docs/{id}."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("Collection/page.md", b"[table](my%20data.csv)")
        zf.writestr("Collection/my data.csv", b"x\n1")
    buf.seek(0)
    with zipfile.ZipFile(buf) as zf:
        roots = parse_zip(zf)

    by_title = {child.title: child for child in roots[0].children}
    assert f"/docs/{by_title['my data'].id}" in by_title["page"].content.decode()


def test_parse_notion_csv_content():
    """Notion CSV (BOM-prefixed, empty cells) becomes a clean markdown table."""
    with zipfile.ZipFile(FIXTURES / "notion-export.zip") as zf:
        roots = parse_zip(zf)

    # The export root container wraps everything; drill into its children.
    children = {child.title: child for child in roots[0].children}

    # People database exported as a CSV alongside a same-name .md
    people_csv = children["People d3d17bcb381d82dfb0d8014512d331ec_all"]
    content = people_csv.content.decode()
    assert "| Name | About | Membership Type | Person |" in content
    assert "| John Smith |" in content


def test_parse_notion_csv_link_rewritten_same_level():
    """A URL-encoded CSV link at the same directory level is rewritten to /docs/{id}."""
    with zipfile.ZipFile(FIXTURES / "notion-export.zip") as zf:
        roots = parse_zip(zf)

    children = {child.title: child for child in roots[0].children}

    people_csv = children["People d3d17bcb381d82dfb0d8014512d331ec_all"]
    people_md = children["People d3d17bcb381d82dfb0d8014512d331ec"]
    assert f"/docs/{people_csv.id}" in people_md.content.decode()


def test_parse_notion_csv_link_rewritten_nested_path():
    """A URL-encoded CSV link whose path crosses a subdirectory is rewritten to /docs/{id}."""
    with zipfile.ZipFile(FIXTURES / "notion-export.zip") as zf:
        roots = parse_zip(zf)

    children = {child.title: child for child in roots[0].children}

    # Monthly Budget folder container holds the Expenses CSV as a child
    monthly_budget_folder = children["Monthly Budget"]
    budget_children = {child.title: child for child in monthly_budget_folder.children}
    expenses_csv = budget_children[
        "Expenses (Monthly) c8a17bcb381d82a2972601154a09516c_all"
    ]

    # Monthly Budget .md (title includes its Notion UUID) should have the link rewritten
    monthly_budget_md = children["Monthly Budget 34c17bcb381d8218a33c01896366c349"]
    assert f"/docs/{expenses_csv.id}" in monthly_budget_md.content.decode()


def test_parse_folder_alongside_md_merges():
    """A folder and a same-name .md at the same level merge into one node."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("Parent/Doc.md", b"# Doc content")
        zf.writestr("Parent/Doc/Child.md", b"# Child")
    buf.seek(0)
    with zipfile.ZipFile(buf) as zf:
        roots = parse_zip(zf)

    assert len(roots) == 1
    doc = roots[0].children[0]
    assert doc.title == "Doc"
    assert doc.content == b"# Doc content"
    assert len(doc.children) == 1
    assert doc.children[0].title == "Child"
