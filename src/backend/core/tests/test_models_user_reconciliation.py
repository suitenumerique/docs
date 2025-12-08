"""
Unit tests for the UserReconciliationCsvImport model
"""

from pathlib import Path

from django.core.files.base import ContentFile

import pytest

from core import factories, models
from core.tasks.user_reconciliation import user_reconciliation_csv_import_job

pytestmark = pytest.mark.django_db


@pytest.fixture
def import_example_csv():
    # Create users referenced in the CSV
    factories.UserFactory(email="user.test40@example.com")
    factories.UserFactory(email="user.test41@example.com")
    factories.UserFactory(email="user.test42@example.com")
    factories.UserFactory(email="user.test43@example.com")
    factories.UserFactory(email="user.test44@example.com")
    factories.UserFactory(email="user.test45@example.com")
    factories.UserFactory(email="user.test46@example.com")
    factories.UserFactory(email="user.test47@example.com")
    factories.UserFactory(email="user.test48@example.com")
    factories.UserFactory(email="user.test49@example.com")

    example_csv_path = Path(__file__).parent / "data/example_reconciliation.csv"
    with open(example_csv_path, "rb") as f:
        csv_file = ContentFile(f.read(), name="example_reconciliation.csv")
    csv_import = models.UserReconciliationCsvImport(file=csv_file)
    csv_import.save()

    return csv_import


def test_user_reconciliation_csv_import_entry_is_created(import_example_csv):
    assert import_example_csv.status == "pending"
    assert import_example_csv.file.name.endswith("example_reconciliation.csv")


def test_incorrect_csv_format_handling():
    example_csv_path = Path(__file__).parent / "data/example_reconciliation_error.csv"
    with open(example_csv_path, "rb") as f:
        csv_file = ContentFile(f.read(), name="example_reconciliation_error.csv")
    csv_import = models.UserReconciliationCsvImport(file=csv_file)
    csv_import.save()

    assert csv_import.status == "pending"

    user_reconciliation_csv_import_job(csv_import.id)
    csv_import.refresh_from_db()

    assert "This field cannot be blank." in csv_import.logs
    assert csv_import.status == "error"


def test_job_creates_reconciliation_entries(import_example_csv):
    assert import_example_csv.status == "pending"
    user_reconciliation_csv_import_job(import_example_csv.id)

    # Verify the job status changed
    import_example_csv.refresh_from_db()
    assert import_example_csv.status == "done"
    assert "Import completed successfully" in import_example_csv.logs

    # Verify reconciliation entries were created
    reconciliations = models.UserReconciliation.objects.all()
    assert reconciliations.count() == 5


def test_csv_import_reconciliation_data_is_correct(import_example_csv):
    user_reconciliation_csv_import_job(import_example_csv.id)

    reconciliations = models.UserReconciliation.objects.order_by("created_at")
    first_entry = reconciliations.first()

    assert first_entry.active_email == "user.test40@example.com"
    assert first_entry.inactive_email == "user.test41@example.com"
    assert first_entry.active_email_checked is False
    assert first_entry.inactive_email_checked is False

    for rec in reconciliations:
        assert rec.status == "ready"


@pytest.fixture
def user_reconciliation_users_and_docs():
    user_1 = factories.UserFactory(email="user.test1@example.com")
    user_2 = factories.UserFactory(email="user.test2@example.com")

    for _ in range(10):
        userdocs_u1 = factories.UserDocumentAccessFactory(user=user_1)
        userdocs_u2 = factories.UserDocumentAccessFactory(user=user_2)

        for ud in userdocs_u1[0:3]:
            factories.UserDocumentAccessFactory(user=user_2, document=ud.document)

        for ud in userdocs_u2[0:3]:
            factories.UserDocumentAccessFactory(user=user_1, document=ud.document)

    return (user_1, user_2)


def user_reconciliation_is_created(user_reconciliation_users_and_docs):
    user_1, user_2 = user_reconciliation_users_and_docs

    rec = models.UserReconciliation.objects.create(
        active_email=user_1.email,
        inactive_email=user_2.email,
        active_email_checked=True,
        inactive_email_checked=True,
        status="pending",
    )

    rec.save()
    assert rec.status == "ready"
