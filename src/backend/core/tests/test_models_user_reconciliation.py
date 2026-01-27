"""
Unit tests for the UserReconciliationCsvImport model
"""

import uuid
from pathlib import Path

from django.core import mail
from django.core.files.base import ContentFile

import pytest

from core import factories, models
from core.admin import process_reconciliation
from core.tasks.user_reconciliation import user_reconciliation_csv_import_job

pytestmark = pytest.mark.django_db


@pytest.fixture(name="import_example_csv_basic")
def fixture_import_example_csv_basic():
    """
    Import an example CSV file for user reconciliation
    and return the created import object.
    """
    # Create users referenced in the CSV
    for i in range(40, 50):
        factories.UserFactory(email=f"user.test{i}@example.com")

    example_csv_path = Path(__file__).parent / "data/example_reconciliation_basic.csv"
    with open(example_csv_path, "rb") as f:
        csv_file = ContentFile(f.read(), name="example_reconciliation_basic.csv")
    csv_import = models.UserReconciliationCsvImport(file=csv_file)
    csv_import.save()

    return csv_import


@pytest.fixture(name="import_example_csv_grist_form")
def fixture_import_example_csv_grist_form():
    """
    Import an example CSV file for user reconciliation
    and return the created import object.
    """
    # Create users referenced in the CSV
    for i in range(10, 40):
        factories.UserFactory(email=f"user.test{i}@example.com")

    example_csv_path = (
        Path(__file__).parent / "data/example_reconciliation_grist_form.csv"
    )
    with open(example_csv_path, "rb") as f:
        csv_file = ContentFile(f.read(), name="example_reconciliation_grist_form.csv")
    csv_import = models.UserReconciliationCsvImport(file=csv_file)
    csv_import.save()

    return csv_import


def test_user_reconciliation_csv_import_entry_is_created(import_example_csv_basic):
    """Test that a UserReconciliationCsvImport entry is created correctly."""
    assert import_example_csv_basic.status == "pending"
    assert import_example_csv_basic.file.name.endswith(
        "example_reconciliation_basic.csv"
    )


def test_user_reconciliation_csv_import_entry_is_created_grist_form(
    import_example_csv_grist_form,
):
    """Test that a UserReconciliationCsvImport entry is created correctly."""
    assert import_example_csv_grist_form.status == "pending"
    assert import_example_csv_grist_form.file.name.endswith(
        "example_reconciliation_grist_form.csv"
    )


def test_incorrect_csv_format_handling():
    """Test that an incorrectly formatted CSV file is handled gracefully."""
    example_csv_path = (
        Path(__file__).parent / "data/example_reconciliation_missing_column.csv"
    )
    with open(example_csv_path, "rb") as f:
        csv_file = ContentFile(
            f.read(), name="example_reconciliation_missing_column.csv"
        )
    csv_import = models.UserReconciliationCsvImport(file=csv_file)
    csv_import.save()

    assert csv_import.status == "pending"

    user_reconciliation_csv_import_job(csv_import.id)
    csv_import.refresh_from_db()

    assert (
        "CSV is missing mandatory columns: active_email, inactive_email, id"
        in csv_import.logs
    )
    assert csv_import.status == "error"


def test_incorrect_email_format_handling():
    """Test that an incorrectly formatted CSV file is handled gracefully."""
    example_csv_path = Path(__file__).parent / "data/example_reconciliation_error.csv"
    with open(example_csv_path, "rb") as f:
        csv_file = ContentFile(f.read(), name="example_reconciliation_error.csv")
    csv_import = models.UserReconciliationCsvImport(file=csv_file)
    csv_import.save()

    assert csv_import.status == "pending"

    user_reconciliation_csv_import_job(csv_import.id)
    csv_import.refresh_from_db()

    assert "Invalid inactive email address on row 40" in csv_import.logs
    assert csv_import.status == "done"

    # pylint: disable-next=no-member
    assert len(mail.outbox) == 1

    # pylint: disable-next=no-member
    email = mail.outbox[0]

    assert email.to == ["user.test40@example.com"]
    email_content = " ".join(email.body.split())

    assert "Reconciliation of your Docs accounts not completed" in email_content


def test_incorrect_csv_data_handling_grist_form():
    """Test that a CSV file with incorrect data is handled gracefully."""
    example_csv_path = (
        Path(__file__).parent / "data/example_reconciliation_grist_form_error.csv"
    )
    with open(example_csv_path, "rb") as f:
        csv_file = ContentFile(
            f.read(), name="example_reconciliation_grist_form_error.csv"
        )
    csv_import = models.UserReconciliationCsvImport(file=csv_file)
    csv_import.save()

    assert csv_import.status == "pending"

    user_reconciliation_csv_import_job(csv_import.id)
    csv_import.refresh_from_db()

    assert (
        "user.test20@example.com set as both active and inactive email"
        in csv_import.logs
    )
    assert csv_import.status == "done"


def test_job_creates_reconciliation_entries(import_example_csv_basic):
    """Test that the CSV import job creates UserReconciliation entries."""
    assert import_example_csv_basic.status == "pending"
    user_reconciliation_csv_import_job(import_example_csv_basic.id)

    # Verify the job status changed
    import_example_csv_basic.refresh_from_db()
    assert import_example_csv_basic.status == "done"
    assert "Import completed successfully." in import_example_csv_basic.logs
    assert "6 rows processed." in import_example_csv_basic.logs
    assert "5 reconciliation entries created." in import_example_csv_basic.logs

    # Verify reconciliation entries were created
    reconciliations = models.UserReconciliation.objects.all()
    assert reconciliations.count() == 5


def test_job_does_not_create_duplicated_reconciliation_entries(
    import_example_csv_basic,
):
    """Test that the CSV import job doesn't create UserReconciliation entries
    for source unique IDs that have already been processed."""

    _already_created_entry = models.UserReconciliation.objects.create(
        active_email="user.test40@example.com",
        inactive_email="user.test41@example.com",
        active_email_checked=0,
        inactive_email_checked=0,
        status="pending",
        source_unique_id=1,
    )

    assert import_example_csv_basic.status == "pending"
    user_reconciliation_csv_import_job(import_example_csv_basic.id)

    # Verify the job status changed
    import_example_csv_basic.refresh_from_db()
    assert import_example_csv_basic.status == "done"
    assert "Import completed successfully." in import_example_csv_basic.logs
    assert "6 rows processed." in import_example_csv_basic.logs
    assert "4 reconciliation entries created." in import_example_csv_basic.logs
    assert "1 rows were already processed." in import_example_csv_basic.logs

    # Verify the correct number of reconciliation entries were created
    reconciliations = models.UserReconciliation.objects.all()
    assert reconciliations.count() == 5


def test_job_creates_reconciliation_entries_grist_form(import_example_csv_grist_form):
    """Test that the CSV import job creates UserReconciliation entries."""
    assert import_example_csv_grist_form.status == "pending"
    user_reconciliation_csv_import_job(import_example_csv_grist_form.id)

    # Verify the job status changed
    import_example_csv_grist_form.refresh_from_db()
    assert "Import completed successfully" in import_example_csv_grist_form.logs
    assert import_example_csv_grist_form.status == "done"

    # Verify reconciliation entries were created
    reconciliations = models.UserReconciliation.objects.all()
    assert reconciliations.count() == 9


def test_csv_import_reconciliation_data_is_correct(import_example_csv_basic):
    """Test that the data in created UserReconciliation entries matches the CSV."""
    user_reconciliation_csv_import_job(import_example_csv_basic.id)

    reconciliations = models.UserReconciliation.objects.order_by("created_at")
    first_entry = reconciliations.first()

    assert first_entry.active_email == "user.test40@example.com"
    assert first_entry.inactive_email == "user.test41@example.com"
    assert first_entry.active_email_checked is False
    assert first_entry.inactive_email_checked is False

    for rec in reconciliations:
        assert rec.status == "ready"


@pytest.fixture(name="user_reconciliation_users_and_docs")
def fixture_user_reconciliation_users_and_docs():
    """Fixture to create two users with overlapping document accesses
    for reconciliation tests."""
    user_1 = factories.UserFactory(email="user.test1@example.com")
    user_2 = factories.UserFactory(email="user.test2@example.com")

    # Create 10 distinct document accesses for each user
    userdocs_u1 = [
        factories.UserDocumentAccessFactory(user=user_1, role="editor")
        for _ in range(10)
    ]
    userdocs_u2 = [
        factories.UserDocumentAccessFactory(user=user_2, role="editor")
        for _ in range(10)
    ]

    # Make the first 3 documents of each list shared with the other user
    # with a lower role
    for ud in userdocs_u1[0:3]:
        factories.UserDocumentAccessFactory(
            user=user_2, document=ud.document, role="reader"
        )

    for ud in userdocs_u2[0:3]:
        factories.UserDocumentAccessFactory(
            user=user_1, document=ud.document, role="reader"
        )

    # Make the next 3 documents of each list shared with the other user
    # with a higher role
    for ud in userdocs_u1[3:6]:
        factories.UserDocumentAccessFactory(
            user=user_2, document=ud.document, role="owner"
        )

    for ud in userdocs_u2[3:6]:
        factories.UserDocumentAccessFactory(
            user=user_1, document=ud.document, role="owner"
        )

    return (user_1, user_2, userdocs_u1, userdocs_u2)


def test_user_reconciliation_is_created(user_reconciliation_users_and_docs):
    """Test that a UserReconciliation entry can be created and saved."""
    user_1, user_2, _userdocs_u1, _userdocs_u2 = user_reconciliation_users_and_docs
    rec = models.UserReconciliation.objects.create(
        active_email=user_1.email,
        inactive_email=user_2.email,
        active_email_checked=False,
        inactive_email_checked=True,
        active_email_confirmation_id=uuid.uuid4(),
        inactive_email_confirmation_id=uuid.uuid4(),
        status="pending",
    )

    rec.save()
    assert rec.status == "ready"


def test_user_reconciliation_verification_emails_are_sent(
    user_reconciliation_users_and_docs,
):
    """Test that both UserReconciliation verification emails are sent."""
    user_1, user_2, _userdocs_u1, _userdocs_u2 = user_reconciliation_users_and_docs
    rec = models.UserReconciliation.objects.create(
        active_email=user_1.email,
        inactive_email=user_2.email,
        active_email_checked=False,
        inactive_email_checked=False,
        active_email_confirmation_id=uuid.uuid4(),
        inactive_email_confirmation_id=uuid.uuid4(),
        status="pending",
    )

    rec.save()

    # pylint: disable-next=no-member
    assert len(mail.outbox) == 2

    # pylint: disable-next=no-member
    email_1 = mail.outbox[0]

    assert email_1.to == [user_1.email]
    email_1_content = " ".join(email_1.body.split())

    assert (
        "You have requested a reconciliation of your user accounts on Docs."
        in email_1_content
    )
    active_email_confirmation_id = rec.active_email_confirmation_id
    inactive_email_confirmation_id = rec.inactive_email_confirmation_id
    assert (
        f"user_reconciliations/active/{active_email_confirmation_id}/"
        in email_1_content
    )

    # pylint: disable-next=no-member
    email_2 = mail.outbox[1]

    assert email_2.to == [user_2.email]
    email_2_content = " ".join(email_2.body.split())

    assert (
        "You have requested a reconciliation of your user accounts on Docs."
        in email_2_content
    )

    assert (
        f"user_reconciliations/inactive/{inactive_email_confirmation_id}/"
        in email_2_content
    )


def test_user_reconciliation_only_starts_if_checks_are_made(
    user_reconciliation_users_and_docs,
):
    """Test that the admin action does not process entries
    unless both email checks are confirmed.
    """
    user_1, user_2, _userdocs_u1, _userdocs_u2 = user_reconciliation_users_and_docs

    # Create a reconciliation entry where only one email has been checked
    rec = models.UserReconciliation.objects.create(
        active_email=user_1.email,
        inactive_email=user_2.email,
        active_email_checked=True,
        inactive_email_checked=False,
        status="pending",
    )
    rec.save()

    # Capture counts before running admin action
    accesses_before_active = models.DocumentAccess.objects.filter(user=user_1).count()
    accesses_before_inactive = models.DocumentAccess.objects.filter(user=user_2).count()
    users_active_before = (user_1.is_active, user_2.is_active)

    # Call the admin action with the queryset containing our single rec
    qs = models.UserReconciliation.objects.filter(id=rec.id)
    process_reconciliation(None, None, qs)

    # Reload from DB and assert nothing was processed (checks prevent processing)
    rec.refresh_from_db()
    user_1.refresh_from_db()
    user_2.refresh_from_db()

    assert rec.status == "ready"
    assert (
        models.DocumentAccess.objects.filter(user=user_1).count()
        == accesses_before_active
    )
    assert (
        models.DocumentAccess.objects.filter(user=user_2).count()
        == accesses_before_inactive
    )
    assert (user_1.is_active, user_2.is_active) == users_active_before


def test_process_documentaccess_reconciliation(
    user_reconciliation_users_and_docs,
):
    """Use the fixture to verify accesses are consolidated on the active user."""
    user_1, user_2, userdocs_u1, userdocs_u2 = user_reconciliation_users_and_docs

    u1_2 = userdocs_u1[2]
    u1_5 = userdocs_u1[5]
    u2doc1 = userdocs_u2[1].document
    u2doc5 = userdocs_u2[5].document

    rec = models.UserReconciliation.objects.create(
        active_email=user_1.email,
        inactive_email=user_2.email,
        active_user=user_1,
        inactive_user=user_2,
        active_email_checked=True,
        inactive_email_checked=True,
        status="ready",
    )

    qs = models.UserReconciliation.objects.filter(id=rec.id)
    process_reconciliation(None, None, qs)

    rec.refresh_from_db()
    user_1.refresh_from_db()
    user_2.refresh_from_db()
    u1_2.refresh_from_db(
        from_queryset=models.DocumentAccess.objects.select_for_update()
    )
    u1_5.refresh_from_db(
        from_queryset=models.DocumentAccess.objects.select_for_update()
    )

    # After processing, inactive user should have no accesses
    # and active user should have one access per union document
    # with the highest role
    assert rec.status == "done"
    assert "Requested update for 10 DocumentAccess items" in rec.logs
    assert "and deletion for 12 DocumentAccess items" in rec.logs
    assert models.DocumentAccess.objects.filter(user=user_2).count() == 0
    assert models.DocumentAccess.objects.filter(user=user_1).count() == 20
    assert u1_2.role == "editor"
    assert u1_5.role == "owner"

    assert (
        models.DocumentAccess.objects.filter(user=user_1, document=u2doc1).first().role
        == "editor"
    )
    assert (
        models.DocumentAccess.objects.filter(user=user_1, document=u2doc5).first().role
        == "owner"
    )

    assert user_1.is_active is True
    assert user_2.is_active is False

    # pylint: disable-next=no-member
    assert len(mail.outbox) == 1

    # pylint: disable-next=no-member
    email = mail.outbox[0]

    assert email.to == [user_1.email]
    email_content = " ".join(email.body.split())

    assert "Your accounts have been merged" in email_content
