"""Parse ZIP exports into a document tree."""

import zipfile
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import PurePosixPath


@dataclass
class DocumentNode:
    """A document node in the import tree."""

    title: str
    content: bytes | None = None
    children: list["DocumentNode"] = field(default_factory=list)


def parse_zip(zf: zipfile.ZipFile) -> list[DocumentNode]:
    """Return root DocumentNodes parsed from a ZIP export."""
    return _build_tree(_read_md_files(zf))


def _read_md_files(zf: zipfile.ZipFile) -> dict[str, bytes]:
    """Read .md files from the zip."""
    result = {}
    for info in zf.infolist():
        if not info.filename.lower().endswith(".md"):
            continue
        result[info.filename] = zf.read(info.filename)
    return result


def _build_tree(md_files: dict[str, bytes]) -> list[DocumentNode]:
    """
    Build a DocumentNode tree from a flat dict of path -> markdown content.

    A folder and a .md file with the same name at the same level merge into a
    single node: the .md provides content, the folder provides children.
    Folders without a matching .md become container nodes with no content.
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

    def build_children(parent: PurePosixPath) -> list[DocumentNode]:
        files = by_parent.get(parent, {})
        subdirs = dirs_by_parent.get(parent, set())
        nodes = []
        for name in sorted(set(files) | subdirs):
            node = DocumentNode(title=name, content=files.get(name))
            subdir = parent / name
            if subdir in all_dirs:
                node.children = build_children(subdir)
            nodes.append(node)
        return nodes

    return build_children(PurePosixPath("."))
