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


def test_parse_zip_ignores_non_md_files():
    """Only .md files produce nodes; images, CSVs etc. are silently skipped."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("doc.md", b"# Hello")
        zf.writestr("image.png", b"\x89PNG")
        zf.writestr("data.csv", b"a,b,c")
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
