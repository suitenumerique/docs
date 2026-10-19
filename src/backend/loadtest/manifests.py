"""Where the manifest of a load test is written: a private file, or a private object.

The manifest holds live session keys. It is never printed, and never written
where the application serves files from: the media route only answers for
`{document id}/attachments/…` keys (`core.enums.MEDIA_STORAGE_URL_PATTERN`), so
nothing under `loadtest/` can be fetched through it.
"""

import json
import os
import re

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

STORAGE_PREFIX = "loadtest/"
STORAGE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def storage_key(name):
    """The object key of a manifest, always under the load-test prefix."""
    if not STORAGE_NAME.match(name):
        raise ValueError(
            "The name of a stored manifest may only hold letters, digits, dots, "
            "dashes and underscores."
        )
    return f"{STORAGE_PREFIX}{name}"


def write_file(path, manifest, overwrite=False):
    """Write the manifest to a file only its owner can read."""
    flags = os.O_WRONLY | os.O_CREAT | (os.O_TRUNC if overwrite else os.O_EXCL)
    # the mode only applies to a file that is created: tighten an existing one too
    descriptor = os.open(path, flags, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as manifest_file:
        os.fchmod(manifest_file.fileno(), 0o600)
        json.dump(manifest, manifest_file)


def write_storage(name, manifest, overwrite=False):
    """Write the manifest to the object storage, and return its key."""
    key = storage_key(name)
    if default_storage.exists(key):
        if not overwrite:
            raise FileExistsError(key)
        default_storage.delete(key)
    default_storage.save(key, ContentFile(json.dumps(manifest).encode("utf-8")))
    return key


def delete_storage(name):
    """Delete a stored manifest. Returns whether there was one."""
    key = storage_key(name)
    if not default_storage.exists(key):
        return False
    default_storage.delete(key)
    return True
