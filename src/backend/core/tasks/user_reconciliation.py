"""Processing tasks for user reconciliation CSV imports."""

import csv
import traceback

from django.core.exceptions import ValidationError
from django.db import IntegrityError

from botocore.exceptions import ClientError

from core.models import UserReconciliation, UserReconciliationCsvImport

from impress.celery_app import app


@app.task
def user_reconciliation_csv_import_job(job_id):
    """Process a UserReconciliationCsvImport job.
    Creates UserReconciliation entries from the CSV file.
    """
    # Imports the CSV file, breaks it into UserReconciliation items
    job = UserReconciliationCsvImport.objects.get(id=job_id)
    job.status = "running"
    job.save()

    try:
        with job.file.open(mode="r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                active_email_checked = row["active_email_checked"] == "1"
                inactive_email_checked = row["inactive_email_checked"] == "1"

                rec_entry = UserReconciliation.objects.create(
                    active_email=row["active_email"],
                    inactive_email=row["inactive_email"],
                    active_email_checked=active_email_checked,
                    inactive_email_checked=inactive_email_checked,
                    status="pending",
                )
                rec_entry.save()

        job.status = "done"
        job.logs = f"Import completed successfully. {reader.line_num} rows processed."
    except (
        csv.Error,
        KeyError,
        ValueError,
        ValidationError,
        IntegrityError,
        OSError,
        ClientError,
    ) as e:
        # Catch expected I/O/CSV/model errors and record traceback in logs for debugging
        job.status = "error"
        job.logs = f"{e!s}\n{traceback.format_exc()}"
    finally:
        job.save()
