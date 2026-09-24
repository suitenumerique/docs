"""Parse ZIP exports into a document tree."""

import re
import zipfile
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import PurePosixPath

# Captures the URL portion of a markdown image reference: ![alt text](URL "optional title")
_IMAGE_REF_RE = re.compile(
    r"""
    !\[        # image marker: exclamation mark + opening bracket
    [^\]]*     # alt text: any characters except closing bracket
    \]\(       # closing bracket + opening parenthesis
    (          # start capture group: the URL
    [^) "]+    # URL: any characters except closing paren, space, or quote
    )          # end capture group
    """,
    re.VERBOSE,
)


@dataclass
class DocumentNode:
    """A document node in the import tree."""

    title: str
    content: bytes | None = None
    # Media files referenced in content: {relative ref as written in markdown -> raw bytes}
    media: dict[str, bytes] = field(default_factory=dict)
    children: list["DocumentNode"] = field(default_factory=list)


def parse_zip(zf: zipfile.ZipFile) -> list[DocumentNode]:
    """Return root DocumentNodes parsed from a ZIP export."""
    return _build_tree(_read_md_files(zf), zf)


def _read_md_files(zf: zipfile.ZipFile) -> dict[str, bytes]:
    """Read .md files from the zip."""
    result = {}
    for info in zf.infolist():
        if not info.filename.lower().endswith(".md"):
            continue
        result[info.filename] = zf.read(info.filename)
    return result


def _build_tree(md_files: dict[str, bytes], zf: zipfile.ZipFile) -> list[DocumentNode]:
    """
    Build a DocumentNode tree from a flat dict of path -> markdown content.

    A folder and a .md file with the same name at the same level merge into a
    single node: the .md provides content, the folder provides children.
    Folders without a matching .md become container nodes with no content.

    Media files referenced in each node's content are read from the zip and
    stored in node.media keyed by the relative reference as written in the markdown.
    """
    paths = {PurePosixPath(k): v for k, v in md_files.items()}

    all_dirs: set[PurePosixPath] = set()
    for path in paths:
        for ancestor in path.parents:
            if str(ancestor) != ".":
                all_dirs.add(ancestor)

    by_parent: dict[PurePosixPath, dict[str, bytes]] = defaultdict(dict)
    for path, content in paths.items():
        by_parent[path.parent][path.stem] = content

    dirs_by_parent: dict[PurePosixPath, set[str]] = defaultdict(set)
    for d in all_dirs:
        dirs_by_parent[d.parent].add(d.name)

    zip_names = set(zf.namelist())

    def build_children(parent: PurePosixPath) -> list[DocumentNode]:
        files = by_parent.get(parent, {})
        subdirs = dirs_by_parent.get(parent, set())
        nodes = []
        # Union of .md stems and subdir names: a name present in both means the
        # .md file and the folder represent the same document (content + children).
        for name in sorted(set(files) | subdirs):
            content = files.get(name)
            node = DocumentNode(title=name, content=content)
            if content is not None:
                for ref in _IMAGE_REF_RE.findall(
                    content.decode("utf-8", errors="replace")
                ):
                    if ref.startswith(("http://", "https://")):
                        continue
                    zip_path = str(parent / ref)
                    if zip_path in zip_names:
                        # Store the raw bytes under the original relative reference so
                        # the caller can upload the file and substitute the URL.
                        node.media[ref] = zf.read(zip_path)
            subdir = parent / name
            if subdir in all_dirs:
                node.children = build_children(subdir)
            nodes.append(node)
        return nodes

    return build_children(PurePosixPath("."))
