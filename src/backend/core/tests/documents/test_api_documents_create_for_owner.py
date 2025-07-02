"""
Tests for Documents API endpoint in impress's core app: create
"""

# pylint: disable=W0621

from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from django.core import mail
from django.test import override_settings

import pytest
from rest_framework.test import APIClient

from core import factories
from core.api.serializers import ServerCreateDocumentSerializer
from core.models import Document, Invitation, User
from core.services.converter_services import ConversionError, YdocConverter

pytestmark = pytest.mark.django_db


@pytest.fixture
def mock_convert_md():
    """Mock YdocConverter.convert to return a converted content."""
    with patch.object(
        YdocConverter,
        "convert",
        return_value="Converted document content",
    ) as mock:
        yield mock


def test_api_documents_create_for_owner_missing_token():
    """Requests with no token should not be allowed to create documents for owner."""
    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": "123",
        "email": "john.doe@example.com",
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/", data, format="json"
    )

    assert response.status_code == 401
    assert not Document.objects.exists()


@override_settings(SERVER_TO_SERVER_API_TOKENS=["DummyToken"])
def test_api_documents_create_for_owner_invalid_token():
    """Requests with an invalid token should not be allowed to create documents for owner."""
    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": "123",
        "email": "john.doe@example.com",
        "language": "fr",
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
        HTTP_AUTHORIZATION="Bearer InvalidToken",
    )

    assert response.status_code == 401
    assert not Document.objects.exists()


def test_api_documents_create_for_owner_authenticated_forbidden():
    """
    Authenticated users should not be allowed to call create documents on behalf of other users.
    This API endpoint is reserved for server-to-server calls.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": "123",
        "email": "john.doe@example.com",
    }

    response = client.post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
    )

    assert response.status_code == 401
    assert not Document.objects.exists()


@override_settings(SERVER_TO_SERVER_API_TOKENS=["DummyToken"])
def test_api_documents_create_for_owner_missing_sub():
    """Requests with no sub should not be allowed to create documents for owner."""
    data = {
        "title": "My Document",
        "content": "Document content",
        "email": "john.doe@example.com",
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
        HTTP_AUTHORIZATION="Bearer DummyToken",
    )

    assert response.status_code == 400
    assert not Document.objects.exists()

    assert response.json() == {"sub": ["This field is required."]}


@override_settings(SERVER_TO_SERVER_API_TOKENS=["DummyToken"])
def test_api_documents_create_for_owner_missing_email():
    """Requests with no email should not be allowed to create documents for owner."""
    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": "123",
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
        HTTP_AUTHORIZATION="Bearer DummyToken",
    )

    assert response.status_code == 400
    assert not Document.objects.exists()

    assert response.json() == {"email": ["This field is required."]}


@override_settings(SERVER_TO_SERVER_API_TOKENS=["DummyToken"])
def test_api_documents_create_for_owner_invalid_sub():
    """Requests with an invalid sub should not be allowed to create documents for owner."""
    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": "123!!",
        "email": "john.doe@example.com",
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
        HTTP_AUTHORIZATION="Bearer DummyToken",
    )

    assert response.status_code == 400
    assert not Document.objects.exists()

    assert response.json() == {
        "sub": [
            "Enter a valid sub. This value may contain only letters, "
            "numbers, and @/./+/-/_/: characters."
        ]
    }


@override_settings(SERVER_TO_SERVER_API_TOKENS=["DummyToken"])
def test_api_documents_create_for_owner_existing(mock_convert_md):
    """
    It should be possible to create a document on behalf of a pre-existing user
    by passing their sub and email.
    """
    user = factories.UserFactory(language="en-us")

    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": str(user.sub),
        "email": "irrelevant@example.com",  # Should be ignored since the user already exists
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
        HTTP_AUTHORIZATION="Bearer DummyToken",
    )

    assert response.status_code == 201

    mock_convert_md.assert_called_once_with("Document content")

    document = Document.objects.get()
    assert response.json() == {"id": str(document.id)}

    assert document.title == "My Document"
    assert document.content == "Converted document content"
    assert document.creator == user
    assert document.accesses.filter(user=user, role="owner").exists()

    assert Invitation.objects.exists() is False

    assert len(mail.outbox) == 1
    email = mail.outbox[0]
    assert email.to == [user.email]
    assert email.subject == "A new document was created on your behalf!"
    email_content = " ".join(email.body.split())
    assert "A new document was created on your behalf!" in email_content
    assert (
        "You have been granted ownership of a new document: My Document"
    ) in email_content


@override_settings(SERVER_TO_SERVER_API_TOKENS=["DummyToken"])
def test_api_documents_create_for_owner_new_user(mock_convert_md):
    """
    It should be possible to create a document on behalf of new users by
    passing their unknown sub and email address.
    """
    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": "123",
        "email": "john.doe@example.com",  # Should be used to create a new user
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
        HTTP_AUTHORIZATION="Bearer DummyToken",
    )

    assert response.status_code == 201

    mock_convert_md.assert_called_once_with("Document content")

    document = Document.objects.get()
    assert response.json() == {"id": str(document.id)}

    assert document.title == "My Document"
    assert document.content == "Converted document content"
    assert document.creator is None
    assert document.accesses.exists() is False

    invitation = Invitation.objects.get()
    assert invitation.email == "john.doe@example.com"
    assert invitation.role == "owner"

    assert len(mail.outbox) == 1
    email = mail.outbox[0]
    assert email.to == ["john.doe@example.com"]
    assert email.subject == "A new document was created on your behalf!"
    email_content = " ".join(email.body.split())
    assert "A new document was created on your behalf!" in email_content
    assert (
        "You have been granted ownership of a new document: My Document"
    ) in email_content

    # The creator field on the document should be set when the user is created
    user = User.objects.create(email="john.doe@example.com", password="!")
    document.refresh_from_db()
    assert document.creator == user


@override_settings(
    SERVER_TO_SERVER_API_TOKENS=["DummyToken"],
    OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION=True,
)
def test_api_documents_create_for_owner_existing_user_email_no_sub_with_fallback(
    mock_convert_md,
):
    """
    It should be possible to create a document on behalf of a pre-existing user for
    who the sub was not found if the settings allow it. This edge case should not
    happen in a healthy OIDC federation but can be useful if an OIDC provider modifies
    users sub on each login for example...
    """
    user = factories.UserFactory(language="en-us")

    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": "123",
        "email": user.email,
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
        HTTP_AUTHORIZATION="Bearer DummyToken",
    )

    assert response.status_code == 201

    mock_convert_md.assert_called_once_with("Document content")

    document = Document.objects.get()
    assert response.json() == {"id": str(document.id)}

    assert document.title == "My Document"
    assert document.content == "Converted document content"
    assert document.creator == user
    assert document.accesses.filter(user=user, role="owner").exists()

    assert Invitation.objects.exists() is False

    assert len(mail.outbox) == 1
    email = mail.outbox[0]
    assert email.to == [user.email]
    assert email.subject == "A new document was created on your behalf!"
    email_content = " ".join(email.body.split())
    assert "A new document was created on your behalf!" in email_content
    assert (
        "You have been granted ownership of a new document: My Document"
    ) in email_content


@override_settings(
    SERVER_TO_SERVER_API_TOKENS=["DummyToken"],
    OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION=False,
    OIDC_ALLOW_DUPLICATE_EMAILS=False,
)
def test_api_documents_create_for_owner_existing_user_email_no_sub_no_fallback(
    mock_convert_md,
):
    """
    When a user does not match an existing sub and fallback to matching on email is
    not allowed in settings, it should raise an error if the email is already used by
    a registered user and duplicate emails are not allowed.
    """
    user = factories.UserFactory()

    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": "123",
        "email": user.email,
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
        HTTP_AUTHORIZATION="Bearer DummyToken",
    )
    assert response.status_code == 400
    assert response.json() == {
        "email": [
            (
                "We couldn't find a user with this sub but the email is already "
                "associated with a registered user."
            )
        ]
    }
    assert mock_convert_md.called is False
    assert Document.objects.exists() is False
    assert Invitation.objects.exists() is False
    assert len(mail.outbox) == 0


@override_settings(
    SERVER_TO_SERVER_API_TOKENS=["DummyToken"],
    OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION=False,
    OIDC_ALLOW_DUPLICATE_EMAILS=True,
)
def test_api_documents_create_for_owner_new_user_no_sub_no_fallback_allow_duplicate(
    mock_convert_md,
):
    """
    When a user does not match an existing sub and fallback to matching on email is
    not allowed in settings, it should be possible to create a new user with the same
    email as an existing user if the settings allow it (identification is still done
    via the sub in this case).
    """
    user = factories.UserFactory()

    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": "123",
        "email": user.email,
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
        HTTP_AUTHORIZATION="Bearer DummyToken",
    )
    assert response.status_code == 201
    mock_convert_md.assert_called_once_with("Document content")

    document = Document.objects.get()
    assert response.json() == {"id": str(document.id)}

    assert document.title == "My Document"
    assert document.content == "Converted document content"
    assert document.creator is None
    assert document.accesses.exists() is False

    invitation = Invitation.objects.get()
    assert invitation.email == user.email
    assert invitation.role == "owner"

    assert len(mail.outbox) == 1
    email = mail.outbox[0]
    assert email.to == [user.email]
    assert email.subject == "A new document was created on your behalf!"
    email_content = " ".join(email.body.split())
    assert "A new document was created on your behalf!" in email_content
    assert (
        "You have been granted ownership of a new document: My Document"
    ) in email_content

    # The creator field on the document should be set when the user is created
    user = User.objects.create(email=user.email, password="!")
    document.refresh_from_db()
    assert document.creator == user


@pytest.mark.django_db(transaction=True)
def test_api_documents_create_document_race_condition():
    """
    It should be possible to create several documents at the same time
    without causing any race conditions or data integrity issues.
    """

    def create_document(title):
        user = factories.UserFactory()
        client = APIClient()
        client.force_login(user)
        return client.post(
            "/api/v1.0/documents/",
            {
                "title": title,
            },
            format="json",
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        future1 = executor.submit(create_document, "my document 1")
        future2 = executor.submit(create_document, "my document 2")

        response1 = future1.result()
        response2 = future2.result()

        assert response1.status_code == 201
        assert response2.status_code == 201


@patch.object(ServerCreateDocumentSerializer, "_send_email_notification")
@override_settings(SERVER_TO_SERVER_API_TOKENS=["DummyToken"], LANGUAGE_CODE="de-de")
def test_api_documents_create_for_owner_with_default_language(
    mock_send, mock_convert_md
):
    """The default language from settings should apply by default."""
    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": "123",
        "email": "john.doe@example.com",
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
        HTTP_AUTHORIZATION="Bearer DummyToken",
    )
    assert response.status_code == 201

    mock_convert_md.assert_called_once_with("Document content")
    assert mock_send.call_args[0][3] == "de-de"


@override_settings(SERVER_TO_SERVER_API_TOKENS=["DummyToken"])
def test_api_documents_create_for_owner_with_custom_language(mock_convert_md):
    """
    Test creating a document with a specific language.
    Useful if the remote server knows the user's language.
    """
    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": "123",
        "email": "john.doe@example.com",
        "language": "fr-fr",
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
        HTTP_AUTHORIZATION="Bearer DummyToken",
    )

    assert response.status_code == 201

    mock_convert_md.assert_called_once_with("Document content")

    assert len(mail.outbox) == 1
    email = mail.outbox[0]
    assert email.to == ["john.doe@example.com"]
    assert email.subject == "Un nouveau document a été créé pour vous !"
    email_content = " ".join(email.body.split())
    assert "Un nouveau document a été créé pour vous !" in email_content
    assert (
        "Vous avez été déclaré propriétaire d&#x27;un nouveau document : My Document"
    ) in email_content


@override_settings(SERVER_TO_SERVER_API_TOKENS=["DummyToken"])
def test_api_documents_create_for_owner_with_custom_subject_and_message(
    mock_convert_md,
):
    """It should be possible to customize the subject and message of the invitation email."""
    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": "123",
        "email": "john.doe@example.com",
        "message": "mon message spécial",
        "subject": "mon sujet spécial !",
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
        HTTP_AUTHORIZATION="Bearer DummyToken",
    )

    assert response.status_code == 201

    mock_convert_md.assert_called_once_with("Document content")

    assert len(mail.outbox) == 1
    email = mail.outbox[0]
    assert email.to == ["john.doe@example.com"]
    assert email.subject == "Mon sujet spécial !"
    email_content = " ".join(email.body.split())
    assert "Mon sujet spécial !" in email_content
    assert "Mon message spécial" in email_content


@override_settings(SERVER_TO_SERVER_API_TOKENS=["DummyToken"])
def test_api_documents_create_for_owner_with_converter_exception(
    mock_convert_md,
):
    """In case of converter error, a 400 error should be raised."""

    mock_convert_md.side_effect = ConversionError("Conversion failed")

    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": "123",
        "email": "john.doe@example.com",
        "message": "mon message spécial",
        "subject": "mon sujet spécial !",
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
        HTTP_AUTHORIZATION="Bearer DummyToken",
    )
    mock_convert_md.assert_called_once_with("Document content")

    assert response.status_code == 400
    assert response.json() == {"content": ["Could not convert content"]}


@override_settings(SERVER_TO_SERVER_API_TOKENS=["DummyToken"])
def test_api_documents_create_for_owner_with_empty_content():
    """The content should not be empty or a 400 error should be raised."""

    data = {
        "title": "My Document",
        "content": "  ",
        "sub": "123",
        "email": "john.doe@example.com",
    }

    response = APIClient().post(
        "/api/v1.0/documents/create-for-owner/",
        data,
        format="json",
        HTTP_AUTHORIZATION="Bearer DummyToken",
    )

    assert response.status_code == 400
    assert response.json() == {
        "content": [
            "This field may not be blank.",
        ],
    }
