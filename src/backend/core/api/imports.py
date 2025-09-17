"""Import endpoints for Outline (zip upload)."""

from __future__ import annotations

import io
import zipfile

import rest_framework as drf

from core.services.outline_import import OutlineImportError, process_outline_zip


# ---------- Outline (Zip Upload) ----------


class OutlineImportUploadView(drf.views.APIView):
    parser_classes = [drf.parsers.MultiPartParser]
    permission_classes = [drf.permissions.IsAuthenticated]

    def post(self, request):
        uploaded = request.FILES.get("file")
        if not uploaded:
            raise drf.exceptions.ValidationError({"file": "File is required"})

        name = getattr(uploaded, "name", "")
        if not name.endswith(".zip"):
            raise drf.exceptions.ValidationError({"file": "Must be a .zip file"})

        try:
            content = uploaded.read()
            # Fail fast if the upload is not a valid zip archive
            with zipfile.ZipFile(io.BytesIO(content)):
                pass
            created_ids = process_outline_zip(request.user, content)
        except zipfile.BadZipFile as exc:
            raise drf.exceptions.ValidationError({"file": "Invalid zip archive"}) from exc
        except OutlineImportError as exc:
            raise drf.exceptions.ValidationError({"file": str(exc)}) from exc

        return drf.response.Response(
            {"created_document_ids": created_ids}, status=drf.status.HTTP_201_CREATED
        )
