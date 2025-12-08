from impress.celery_app import app

from core.models import UserReconciliation, UserReconciliationCsvImport

import csv


@app.task
def user_reconciliation_csv_import_job(job_id):
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
    except Exception as e:
        job.status = "error"
        job.logs = str(e)
    finally:
        job.save()
