"""Service to import an Outline export (.zip) into Docs documents."""

from __future__ import annotations

import io
import mimetypes
import re
import uuid
import zipfile
from typing import Iterable

from django.conf import settings
from django.core.files.storage import default_storage

from lasuite.malware_detection import malware_detection

from core import enums, models
from core.services.converter_services import YdocConverter


def _ensure_dir_documents(user, dir_path: str, dir_docs: dict[str, models.Document]) -> models.Document | None:
    """Ensure each path segment in dir_path has a container document.

    Returns the deepest parent document or None when dir_path is empty.
    """
    if not dir_path:
        return None

    parts = [p for p in dir_path.split("/") if p]
    parent: models.Document | None = None
    current = ""
    for part in parts:
        current = f"{current}/{part}" if current else part
        if current in dir_docs:
            parent = dir_docs[current]
            continue

        if parent is None:
            doc = models.Document.add_root(
                depth=1,
                creator=user,
                title=part,
                link_reach=models.LinkReachChoices.RESTRICTED,
            )
        else:
            doc = parent.add_child(creator=user, title=part)

        models.DocumentAccess.objects.update_or_create(
            document=doc,
            user=user,
            defaults={"role": models.RoleChoices.OWNER},
        )
        dir_docs[current] = doc
        parent = doc

    return parent


def _upload_attachment(user, doc: models.Document, arcname: str, data: bytes) -> str:
    """Upload a binary asset into object storage and return its public media URL."""
    content_type, _ = mimetypes.guess_type(arcname)
    ext = (arcname.split(".")[-1] or "bin").lower()
    file_id = uuid.uuid4()
    key = f"{doc.key_base}/{enums.ATTACHMENTS_FOLDER:s}/{file_id!s}.{ext}"
    extra_args = {
        "Metadata": {
            "owner": str(user.id),
            "status": enums.DocumentAttachmentStatus.READY,
        },
    }
    if content_type:
        extra_args["ContentType"] = content_type

    default_storage.connection.meta.client.upload_fileobj(
        io.BytesIO(data), default_storage.bucket_name, key, ExtraArgs=extra_args
    )
    doc.attachments.append(key)
    doc.save(update_fields=["attachments", "updated_at"])
    malware_detection.analyse_file(key, document_id=doc.id)
    return f"{settings.MEDIA_BASE_URL}{settings.MEDIA_URL}{key}"


def process_outline_zip(user, zip_bytes: bytes) -> list[str]:
    """Process an Outline export zip and create Docs documents.

    Returns the list of created document IDs (stringified UUIDs) corresponding to
    markdown-backed documents. Container folders used to rebuild hierarchy are not listed.
    """
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))

    created_ids: list[str] = []
    dir_docs: dict[str, models.Document] = {}
    md_files: Iterable[str] = sorted(
        [n for n in archive.namelist() if n.lower().endswith(".md")]
    )

    img_pattern = re.compile(r"!\[[^\]]*\]\(([^)]+)\)")

    def read_bytes(path_in_zip: str) -> bytes | None:
        try:
            with archive.open(path_in_zip, "r") as f:
                return f.read()
        except KeyError:
            return None

    converter = YdocConverter()

    for md_path in md_files:
        dir_path, file_name = (
            (md_path.rsplit("/", 1) + [""])[:2] if "/" in md_path else ("", md_path)
        )
        parent_doc = _ensure_dir_documents(user, dir_path, dir_docs)

        try:
            raw_md = archive.read(md_path).decode("utf-8", errors="ignore")
        except Exception:  # noqa: BLE001
            raw_md = ""

        title_match = re.search(r"^#\s+(.+)$", raw_md, flags=re.MULTILINE)
        title = title_match.group(1).strip() if title_match else file_name.rsplit(".", 1)[0]

        if parent_doc is None:
            doc = models.Document.add_root(
                depth=1,
                creator=user,
                title=title,
                link_reach=models.LinkReachChoices.RESTRICTED,
            )
        else:
            doc = parent_doc.add_child(creator=user, title=title)

        models.DocumentAccess.objects.update_or_create(
            document=doc,
            user=user,
            defaults={"role": models.RoleChoices.OWNER},
        )

        def replace_img_link(match: re.Match[str]) -> str:
            url = match.group(1)
            if url.startswith("http://") or url.startswith("https://"):
                return match.group(0)
            asset_rel = f"{dir_path}/{url}" if dir_path else url
            asset_rel = re.sub(r"/+", "/", asset_rel)
            data = read_bytes(asset_rel)
            if data is None:
                return match.group(0)
            media_url = _upload_attachment(user, doc, arcname=url, data=data)
            return match.group(0).replace(url, media_url)

        rewritten_md = img_pattern.sub(replace_img_link, raw_md)

        try:
            ydoc_b64 = converter.convert(
                rewritten_md.encode("utf-8"),
                content_type="text/markdown",
                accept="application/vnd.yjs.doc",
            )
            doc.content = ydoc_b64
            doc.save(update_fields=["content", "updated_at"])
        except Exception:  # noqa: BLE001
            # Keep doc without content on conversion error but continue import
            pass

        created_ids.append(str(doc.id))

    return created_ids

