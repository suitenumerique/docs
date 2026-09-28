"""Parse ZIP exports into a document tree."""

import csv
import io
import re
import uuid
import zipfile
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import PurePosixPath
from urllib.parse import unquote

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

# Captures a markdown link whose target is a .csv file: [text](path/to/file.csv)
_CSV_LINK_RE = re.compile(
    r"""
    \[         # opening bracket
    ([^\]]*)   # link text: anything except closing bracket
    \]\(       # closing bracket + opening parenthesis
    (          # start capture group: the path
    .*?        # non-greedy: allows literal () in path segments (e.g. "Income (Monthly)")
    \.csv      # must end with .csv extension
    )          # end capture group
    \)         # closing parenthesis
    """,
    re.VERBOSE | re.IGNORECASE,
)


@dataclass
class DocumentNode:
    """A document node in the import tree."""

    title: str
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    content: bytes | None = None
    # Media files referenced in content: {relative ref as written in markdown -> raw bytes}
    media: dict[str, bytes] = field(default_factory=dict)
    children: list["DocumentNode"] = field(default_factory=list)


def parse_zip(zf: zipfile.ZipFile) -> list[DocumentNode]:
    """Return root DocumentNodes parsed from a ZIP export."""
    return _build_tree(_read_md_files(zf), _read_csv_files(zf), zf)


def _read_md_files(zf: zipfile.ZipFile) -> dict[str, bytes]:
    """Read .md files from the zip."""
    result = {}
    for info in zf.infolist():
        if not info.filename.lower().endswith(".md"):
            continue
        result[info.filename] = zf.read(info.filename)
    return result


def _read_csv_files(zf: zipfile.ZipFile) -> dict[str, bytes]:
    """Read .csv files from the zip."""
    result = {}
    for info in zf.infolist():
        if not info.filename.lower().endswith(".csv"):
            continue
        result[info.filename] = zf.read(info.filename)
    return result


def _csv_to_markdown(data: bytes) -> bytes:
    """Convert CSV bytes to a markdown table."""
    # "utf-8-sig" is a UTF-8 variant that automatically strips the BOM
    # (\xef\xbb\xbf) that Excel and other Windows tools prepend to CSV files.
    # errors="replace" substitutes any undecodable byte with the Unicode
    # replacement character (U+FFFD) rather than raising an exception.
    text = data.decode("utf-8-sig", errors="replace")
    rows = [
        row
        for row in csv.reader(io.StringIO(text))
        if any(cell.strip() for cell in row)
    ]
    if not rows:
        return b""

    def escape(cell: str) -> str:
        # Pipe characters break markdown table syntax; newlines collapse to a space.
        return cell.replace("|", "\\|").replace("\n", " ")

    header, *body = rows
    col_count = len(header)
    lines = [
        "| " + " | ".join(escape(heading) for heading in header) + " |",
        "| " + " | ".join("---" for _ in header) + " |",
    ]
    for row in body:
        padded = row[:col_count] + [""] * max(0, col_count - len(row))
        lines.append("| " + " | ".join(escape(cell) for cell in padded) + " |")
    return "\n".join(lines).encode("utf-8")


def _build_tree(
    md_files: dict[str, bytes],
    csv_files: dict[str, bytes],
    zf: zipfile.ZipFile,
) -> list[DocumentNode]:
    """
    Build a DocumentNode tree from .md and .csv files found in the zip.

    .md files become content nodes; .csv files become markdown-table nodes.
    A folder and a same-name .md (or .csv) at the same level merge into one
    node: the file provides content, the folder provides children.
    Folders with no matching file become container nodes with no content.

    Media files referenced in each node's content are read from the zip and
    stored in node.media keyed by the relative reference as written in the markdown.
    CSV links ([text](file.csv)) are rewritten to /docs/{node.id} of the target node.
    """
    md_paths = {PurePosixPath(k): v for k, v in md_files.items()}
    csv_paths = [PurePosixPath(k) for k in csv_files]

    all_dirs: set[PurePosixPath] = set()
    for path in [*md_paths, *csv_paths]:
        for ancestor in path.parents:
            if str(ancestor) != ".":
                all_dirs.add(ancestor)

    by_parent: dict[PurePosixPath, dict[str, bytes]] = defaultdict(dict)
    for path, content in md_paths.items():
        by_parent[path.parent][path.stem] = content

    dirs_by_parent: dict[PurePosixPath, set[str]] = defaultdict(set)
    for d in all_dirs:
        dirs_by_parent[d.parent].add(d.name)

    zip_names = set(zf.namelist())

    # Pre-create all CSV nodes so their IDs are stable before any link rewriting.
    csv_nodes: dict[str, DocumentNode] = {
        zip_path: DocumentNode(
            title=PurePosixPath(zip_path).stem,
            content=_csv_to_markdown(csv_bytes),
        )
        for zip_path, csv_bytes in csv_files.items()
    }
    # Index by parent dir for tree placement, and by full zip path for link rewriting.
    csv_by_parent: dict[PurePosixPath, dict[str, DocumentNode]] = defaultdict(dict)
    for zip_path, node in csv_nodes.items():
        p = PurePosixPath(zip_path)
        csv_by_parent[p.parent][p.stem] = node

    def build_children(parent: PurePosixPath) -> list[DocumentNode]:
        md_here = by_parent.get(parent, {})
        subdirs = dirs_by_parent.get(parent, set())
        csv_here = csv_by_parent.get(parent, {})

        # Union of .md stems, subdir names, and .csv stems: a name present in
        # multiple sources merges into one node (.md takes priority over .csv
        # for content; the folder adds children).
        nodes = []
        for name in sorted(set(md_here) | subdirs | set(csv_here)):
            if name in md_here:
                content = md_here[name]
            elif name in csv_here:
                # Reuse the pre-created CSV node directly (keeps the stable ID).
                node = csv_here[name]
                subdir = parent / name
                if subdir in all_dirs:
                    node.children = build_children(subdir)
                nodes.append(node)
                continue
            else:
                content = None

            node = DocumentNode(title=name, content=content)
            if content is not None:
                text = content.decode("utf-8", errors="replace")

                # Rewrite local CSV links to point at the imported document.
                def _replace_csv_link(m, _parent=parent):
                    link_text, raw_ref = m.group(1), m.group(2)
                    zip_path = str(_parent / unquote(raw_ref))
                    target = csv_nodes.get(zip_path)
                    if target is None:
                        return m.group(0)
                    return f"[{link_text}](/docs/{target.id})"

                text = _CSV_LINK_RE.sub(_replace_csv_link, text)
                node.content = text.encode("utf-8")

                # Collect local media files referenced in the (possibly rewritten) content.
                for ref in _IMAGE_REF_RE.findall(text):
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
