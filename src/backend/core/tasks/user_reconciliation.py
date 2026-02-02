"""Processing tasks for user reconciliation CSV imports."""

import csv
import traceback
import uuid

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError

from botocore.exceptions import ClientError

from core.models import UserReconciliation, UserReconciliationCsvImport

from impress.celery_app import app


def _process_row(row, job, counters):
    """Process a single row from the CSV file."""

    source_unique_id = row["id"].strip()

    # Skip entries if they already exist with this source_unique_id
    if UserReconciliation.objects.filter(source_unique_id=source_unique_id).exists():
        counters["already_processed_source_ids"] += 1
        return counters

    active_email_checked = row.get("active_email_checked", "0") == "1"
    inactive_email_checked = row.get("inactive_email_checked", "0") == "1"

    active_email = row["active_email"]
    inactive_emails = row["inactive_email"].split("|")
    try:
        validate_email(active_email)
    except ValidationError:
        job.send_reconciliation_error_email(
            recipient_email=inactive_emails[0], other_email=active_email
        )
        job.logs += f"Invalid active email address on row {source_unique_id}."
        counters["rows_with_errors"] += 1
        return counters

    for inactive_email in inactive_emails:
        try:
            validate_email(inactive_email)
        except (ValidationError, ValueError):
            job.send_reconciliation_error_email(
                recipient_email=active_email, other_email=inactive_email
            )
            job.logs += f"Invalid inactive email address on row {source_unique_id}.\n"
            counters["rows_with_errors"] += 1
            continue

        if inactive_email == active_email:
            job.send_reconciliation_error_email(
                recipient_email=active_email, other_email=inactive_email
            )
            job.logs += (
                f"Error on row {source_unique_id}: "
                f"{active_email} set as both active and inactive email.\n"
            )
            counters["rows_with_errors"] += 1
            continue

        _rec_entry = UserReconciliation.objects.create(
            active_email=active_email,
            inactive_email=inactive_email,
            active_email_checked=active_email_checked,
            inactive_email_checked=inactive_email_checked,
            active_email_confirmation_id=uuid.uuid4(),
            inactive_email_confirmation_id=uuid.uuid4(),
            source_unique_id=source_unique_id,
            status="pending",
        )
        counters["rec_entries_created"] += 1

    return counters


@app.task
def user_reconciliation_csv_import_job(job_id):
    """Process a UserReconciliationCsvImport job.
    Creates UserReconciliation entries from the CSV file.

    Does some sanity checks on the data:
    - active_email and inactive_email must be valid email addresses
    - active_email and inactive_email cannot be the same

    Rows with errors are logged in the job logs and skipped, but do not cause
    the entire job to fail or prevent the next rows from being processed.
    """
    # Imports the CSV file, breaks it into UserReconciliation items
    job = UserReconciliationCsvImport.objects.get(id=job_id)
    job.status = "running"
    job.save()

    counters = {
        "rec_entries_created": 0,
        "rows_with_errors": 0,
        "already_processed_source_ids": 0,
    }

    try:
        with job.file.open(mode="r") as f:
            reader = csv.DictReader(f)

            if not {"active_email", "inactive_email", "id"}.issubset(reader.fieldnames):
                raise KeyError(
                    "CSV is missing mandatory columns: active_email, inactive_email, id"
                )

            for row in reader:
                counters = _process_row(row, job, counters)

        job.status = "done"
        job.logs += (
            f"Import completed successfully. {reader.line_num} rows processed."
            f" {counters['rec_entries_created']} reconciliation entries created."
            f" {counters['already_processed_source_ids']} rows were already processed."
            f" {counters['rows_with_errors']} rows had errors."
        )
    except (
        csv.Error,
        KeyError,
        ValidationError,
        ValueError,
        IntegrityError,
        OSError,
        ClientError,
    ) as e:
        # Catch expected I/O/CSV/model errors and record traceback in logs for debugging
        job.status = "error"
        job.logs += f"{e!s}\n{traceback.format_exc()}"
    finally:
        job.save()
