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


@app.task
def user_reconciliation_csv_import_job(job_id):
    """Process a UserReconciliationCsvImport job.
    Creates UserReconciliation entries from the CSV file.

    Does some sanity checks on the data:
    - active_email and inactive_email must be valid email addresses
    - active_email and inactive_email cannot be the same
    """
    # Imports the CSV file, breaks it into UserReconciliation items
    job = UserReconciliationCsvImport.objects.get(id=job_id)
    job.status = "running"
    job.save()

    try:
        with job.file.open(mode="r") as f:
            reader = csv.DictReader(f)
            rec_entries_created = 0
            for row in reader:
                status = row["status"]

                if status == "pending":
                    active_email_checked = row.get("active_email_checked", "0") == "1"
                    inactive_email_checked = (
                        row.get("inactive_email_checked", "0") == "1"
                    )

                    active_email = row["active_email"]
                    inactive_emails = row["inactive_email"].split("|")
                    try:
                        validate_email(active_email)
                    except ValidationError as e:
                        job.send_reconciliation_error_email(
                            active_email, inactive_emails[0]
                        )
                        job.status = "error"
                        job.logs = f"{e!s}\n{traceback.format_exc()}"

                    for inactive_email in inactive_emails:
                        try:
                            validate_email(inactive_email)
                        except ValidationError as e:
                            job.send_reconciliation_error_email(
                                active_email, inactive_email
                            )
                            job.status = "error"
                            job.logs = f"{e!s}\n{traceback.format_exc()}"
                        if inactive_email == active_email:
                            raise ValueError(
                                "Active and inactive emails cannot be the same."
                            )

                        rec_entry = UserReconciliation.objects.create(
                            active_email=active_email,
                            inactive_email=inactive_email,
                            active_email_checked=active_email_checked,
                            inactive_email_checked=inactive_email_checked,
                            active_confirmation_id=uuid.uuid4(),
                            inactive_confirmation_id=uuid.uuid4(),
                            status="pending",
                        )
                        rec_entry.save()
                        rec_entries_created += 1

        job.status = "done"
        job.logs = f"""Import completed successfully. {reader.line_num} rows processed.
        {rec_entries_created} reconciliation entries created."""
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
