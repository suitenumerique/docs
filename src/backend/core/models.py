"""
Declare and configure the models for the impress core application
"""

# pylint: disable=too-many-lines

import hashlib
import smtplib
import uuid
from datetime import timedelta
from logging import getLogger

from django.conf import settings
from django.contrib.auth import models as auth_models
from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.postgres.fields import ArrayField
from django.contrib.sites.models import Site
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.mail import send_mail
from django.db import models, transaction
from django.db.models import Count
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.functional import cached_property
from django.utils.translation import get_language, override
from django.utils.translation import gettext_lazy as _

from botocore.exceptions import ClientError
from rest_framework.exceptions import ValidationError
from timezone_field import TimeZoneField

from core.choices import (
    PRIVILEGED_ROLES,
    LinkReachChoices,
    LinkRoleChoices,  # noqa: F401  (re-exported, e.g. models.LinkRoleChoices)
    RoleChoices,
)
from core.validators import sub_validator

logger = getLogger(__name__)


def get_trashbin_cutoff():
    """
    Calculate the cutoff datetime for soft-deleted items based on the retention policy.

    The function returns the current datetime minus the number of days specified in
    the TRASHBIN_CUTOFF_DAYS setting, indicating the oldest date for items that can
    remain in the trash bin.

    Returns:
        datetime: The cutoff datetime for soft-deleted items.
    """
    return timezone.now() - timedelta(days=settings.TRASHBIN_CUTOFF_DAYS)


class DuplicateEmailError(Exception):
    """Raised when an email is already associated with a pre-existing user."""

    def __init__(self, message=None, email=None):
        """Set message and email to describe the exception."""
        self.message = message
        self.email = email
        super().__init__(self.message)


class BaseModel(models.Model):
    """
    Serves as an abstract base model for other models, ensuring that records are validated
    before saving as Django doesn't do it by default.

    Includes fields common to all models: a UUID primary key and creation/update timestamps.
    """

    id = models.UUIDField(
        verbose_name=_("id"),
        help_text=_("primary key for the record as UUID"),
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    created_at = models.DateTimeField(
        verbose_name=_("created on"),
        help_text=_("date and time at which a record was created"),
        auto_now_add=True,
        editable=False,
    )
    updated_at = models.DateTimeField(
        verbose_name=_("updated on"),
        help_text=_("date and time at which a record was last updated"),
        auto_now=True,
        editable=False,
    )

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        """Call `full_clean` before saving."""
        self.full_clean()
        super().save(*args, **kwargs)


class UserManager(auth_models.UserManager):
    """Custom manager for User model with additional methods."""

    def get_user_by_sub_or_email(self, sub, email):
        """Fetch existing user by sub or email."""
        try:
            return self.get(sub=sub)
        except self.model.DoesNotExist as err:
            if not email:
                return None

            if settings.OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION:
                try:
                    return self.get(email__iexact=email)
                except self.model.DoesNotExist:
                    pass
            elif (
                self.filter(email__iexact=email).exists()
                and not settings.OIDC_ALLOW_DUPLICATE_EMAILS
            ):
                raise DuplicateEmailError(
                    _(
                        "We couldn't find a user with this sub but the email is already "
                        "associated with a registered user."
                    )
                ) from err
        return None


class User(AbstractBaseUser, BaseModel, auth_models.PermissionsMixin):
    """User model to work with OIDC only authentication."""

    sub = models.CharField(
        _("sub"),
        help_text=_("Required. 255 characters or fewer. ASCII characters only."),
        max_length=255,
        validators=[sub_validator],
        unique=True,
        blank=True,
        null=True,
    )

    full_name = models.CharField(_("full name"), max_length=100, null=True, blank=True)
    short_name = models.CharField(
        _("short name"), max_length=100, null=True, blank=True
    )

    email = models.EmailField(_("identity email address"), blank=True, null=True)

    # Unlike the "email" field which stores the email coming from the OIDC token, this field
    # stores the email used by staff users to login to the admin site
    admin_email = models.EmailField(
        _("admin email address"), unique=True, blank=True, null=True
    )

    language = models.CharField(
        max_length=10,
        choices=settings.LANGUAGES,
        default=None,
        verbose_name=_("language"),
        help_text=_("The language in which the user wants to see the interface."),
        null=True,
        blank=True,
    )
    timezone = TimeZoneField(
        choices_display="WITH_GMT_OFFSET",
        use_pytz=False,
        default=settings.TIME_ZONE,
        help_text=_("The timezone in which the user wants to see times."),
    )
    is_device = models.BooleanField(
        _("device"),
        default=False,
        help_text=_("Whether the user is a device or a real user."),
    )
    is_staff = models.BooleanField(
        _("staff status"),
        default=False,
        help_text=_("Whether the user can log into this admin site."),
    )
    is_active = models.BooleanField(
        _("active"),
        default=True,
        help_text=_(
            "Whether this user should be treated as active. "
            "Unselect this instead of deleting accounts."
        ),
    )
    is_first_connection = models.BooleanField(
        _("first connection status"),
        default=True,
        help_text=_("Whether the user has completed the first connection process."),
    )

    objects = UserManager()

    USERNAME_FIELD = "admin_email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "impress_user"
        verbose_name = _("user")
        verbose_name_plural = _("users")

    def __str__(self):
        return self.email or self.admin_email or str(self.id)

    def save(self, *args, **kwargs):
        """
        If it's a new user, give its user access to the documents they were invited to.
        """
        is_adding = self._state.adding
        super().save(*args, **kwargs)

        if is_adding:
            self._handle_onboarding_documents_access()
            self._duplicate_onboarding_sandbox_document()

    def delete(self, using=None, keep_parents=False):
        """Completely delete a user and its relations."""
        with transaction.atomic():
            self._delete_created_documents()

            return super().delete(using=using, keep_parents=keep_parents)

    def _delete_created_documents(self):
        """
        Delete the documents created by the user. Sharing is owned by Drive:
        local ownership is materialized by the creator field only.
        """
        Document.objects.filter(creator=self).delete()
        logger.info(
            "user_delete: documents created by user %s deleted",
            self.id,
        )

    def _clear_user_created_documents(self):
        """Set creator to Null for documents where the user is the creator."""
        Document.objects.filter(creator=self).update(creator=None)
        logger.info(
            "user_delete: documents created by user %s have been cleared",
            self.id,
        )

    def _handle_onboarding_documents_access(self):
        """
        If the user is new and there are documents configured to be given to new users,
        create link traces to these documents and pin them as favorites for the user.
        """
        if settings.USER_ONBOARDING_DOCUMENTS:
            onboarding_document_ids = set(settings.USER_ONBOARDING_DOCUMENTS)
            onboarding_link_traces = []
            favorite_documents = []
            for document_id in onboarding_document_ids:
                try:
                    document = Document.objects.get(id=document_id)
                except Document.DoesNotExist:
                    logger.warning(
                        "Onboarding document with id %s does not exist. Skipping.",
                        document_id,
                    )
                    continue

                if document.computed_link_reach == LinkReachChoices.RESTRICTED:
                    logger.warning(
                        "Onboarding on a restricted document is not allowed. Must be public or "
                        "connected. Restricted document: %s",
                        document_id,
                    )
                    continue

                onboarding_link_traces.append(LinkTrace(user=self, document=document))
                favorite_documents.append(
                    DocumentFavorite(user=self, document_id=document_id)
                )

            LinkTrace.objects.bulk_create(onboarding_link_traces)
            DocumentFavorite.objects.bulk_create(favorite_documents)

    def _duplicate_onboarding_sandbox_document(self):
        """
        If the user is new and there is a sandbox document configured,
        duplicate the sandbox document for the user
        """
        if settings.USER_ONBOARDING_SANDBOX_DOCUMENT:
            sandbox_id = settings.USER_ONBOARDING_SANDBOX_DOCUMENT
            try:
                template_document = Document.objects.get(id=sandbox_id)
            except Document.DoesNotExist:
                logger.warning(
                    "Onboarding sandbox document with id %s does not exist. Skipping.",
                    sandbox_id,
                )
                return
            # Import here to avoid a circular import through core.api.serializers
            from core.services import (  # pylint: disable=import-outside-toplevel
                drive_client,
            )

            try:
                drive_item = drive_client.create_doc_item(
                    self, template_document.title
                )
            except drive_client.DriveClientError as exc:
                logger.warning("Could not create sandbox document in Drive: %s", exc)
                return

            with transaction.atomic():
                sandbox_document = Document.objects.create(
                    id=drive_item["id"],
                    title=template_document.title,
                    content=template_document.content,
                    attachments=template_document.attachments,
                    creator=self,
                )


    def send_email(self, subject, context=None, language=None):
        """Generate and send email to the user from a template."""
        emails = [self.email]
        context = context or {}
        domain = settings.EMAIL_URL_APP or Site.objects.get_current().domain

        language = language or get_language()
        context.update(
            {
                "brandname": settings.EMAIL_BRAND_NAME,
                "domain": domain,
                "logo_img": settings.EMAIL_LOGO_IMG,
            }
        )

        with override(language):
            msg_html = render_to_string("mail/html/template.html", context)
            msg_plain = render_to_string("mail/text/template.txt", context)
            subject = str(subject)  # Force translation

            try:
                send_mail(
                    subject.capitalize(),
                    msg_plain,
                    settings.EMAIL_FROM,
                    emails,
                    html_message=msg_html,
                    fail_silently=False,
                )
            except smtplib.SMTPException as exception:
                logger.error("invitation to %s was not sent: %s", emails, exception)

    @cached_property
    def teams(self):
        """
        Get list of teams in which the user is, as a list of strings.
        Must be cached if retrieved remotely.
        """
        return []


class UserReconciliation(BaseModel):
    """Model to run batch jobs to replace an active user by another one"""

    active_email = models.EmailField(_("Active email address"))
    inactive_email = models.EmailField(_("Email address to deactivate"))
    active_email_checked = models.BooleanField(default=False)
    inactive_email_checked = models.BooleanField(default=False)
    active_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="active_user",
    )
    inactive_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="inactive_user",
    )
    active_email_confirmation_id = models.UUIDField(
        default=uuid.uuid4, unique=True, editable=False, null=True
    )
    inactive_email_confirmation_id = models.UUIDField(
        default=uuid.uuid4, unique=True, editable=False, null=True
    )
    source_unique_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name=_("Unique ID in the source file"),
    )

    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", _("Pending")),
            ("ready", _("Ready")),
            ("done", _("Done")),
            ("error", _("Error")),
        ],
        default="pending",
    )
    logs = models.TextField(blank=True)

    class Meta:
        db_table = "impress_user_reconciliation"
        verbose_name = _("user reconciliation")
        verbose_name_plural = _("user reconciliations")
        ordering = ["-created_at"]

    def __str__(self):
        return f"Reconciliation from {self.inactive_email} to {self.active_email}"

    def save(self, *args, **kwargs):
        """
        For pending queries, identify the actual users and send validation emails
        """
        if self.status == "pending":
            self.active_user = User.objects.filter(email=self.active_email).first()
            self.inactive_user = User.objects.filter(email=self.inactive_email).first()

            if self.active_user and self.inactive_user:
                if not self.active_email_checked:
                    self.send_reconciliation_confirm_email(
                        self.active_user, "active", self.active_email_confirmation_id
                    )
                if not self.inactive_email_checked:
                    self.send_reconciliation_confirm_email(
                        self.inactive_user,
                        "inactive",
                        self.inactive_email_confirmation_id,
                    )
                self.status = "ready"
            else:
                self.status = "error"
                self.logs = "Error: Both active and inactive users need to exist."

        super().save(*args, **kwargs)

    @transaction.atomic
    def process_reconciliation_request(self):
        """
        Process the reconciliation request as a transaction.

        - Transfer document accesses from inactive to active user, updating roles as needed.
        - Transfer document favorites from inactive to active user.
        - Transfer link traces from inactive to active user.
        - Transfer comment-related content from inactive to active user
          (threads, comments and reactions)
        - Activate the active user and deactivate the inactive user.
        - Update the reconciliation entry itself.
        """

        # Prepare the data to perform the reconciliation on. Document accesses
        # are owned by Drive and are not reconciled here anymore.
        updated_linktraces, removed_linktraces = self.prepare_linktrace_reconciliation()
        update_favorites, removed_favorites = (
            self.prepare_document_favorite_reconciliation()
        )
        updated_threads = self.prepare_thread_reconciliation()
        updated_comments = self.prepare_comment_reconciliation()
        updated_reactions, removed_reactions = self.prepare_reaction_reconciliation()

        self.active_user.is_active = True
        self.inactive_user.is_active = False

        # Actually perform the bulk operations
        DocumentFavorite.objects.bulk_update(update_favorites, ["user"])
        if removed_favorites:
            ids_to_delete = [entry.id for entry in removed_favorites]
            DocumentFavorite.objects.filter(id__in=ids_to_delete).delete()

        LinkTrace.objects.bulk_update(updated_linktraces, ["user"])
        if removed_linktraces:
            ids_to_delete = [entry.id for entry in removed_linktraces]
            LinkTrace.objects.filter(id__in=ids_to_delete).delete()

        Thread.objects.bulk_update(updated_threads, ["creator"])
        Comment.objects.bulk_update(updated_comments, ["user"])

        # pylint: disable=C0103
        ReactionThroughModel = Reaction.users.through
        reactions_to_create = []
        for updated_reaction in updated_reactions:
            reactions_to_create.append(
                ReactionThroughModel(
                    user_id=self.active_user.pk, reaction_id=updated_reaction.pk
                )
            )

        if reactions_to_create:
            ReactionThroughModel.objects.bulk_create(reactions_to_create)

        if removed_reactions:
            ids_to_delete = [entry.id for entry in removed_reactions]
            ReactionThroughModel.objects.filter(
                reaction_id__in=ids_to_delete, user_id=self.inactive_user.pk
            ).delete()

        User.objects.bulk_update([self.active_user, self.inactive_user], ["is_active"])

        # Wrap up the reconciliation entry
        self.logs += f"""Requested update for {len(updated_linktraces)} LinkTrace items
            and deletion for {len(removed_linktraces)} LinkTrace items.\n"""
        self.status = "done"
        self.save()

        self.send_reconciliation_done_email()

    def prepare_document_favorite_reconciliation(self):
        """
        Prepare the reconciliation by transferring document favorites from the inactive user
        to the active user.
        """
        updated_favorites = []
        removed_favorites = []

        existing_favorites = DocumentFavorite.objects.filter(user=self.active_user)
        existing_favorite_doc_ids = set(
            existing_favorites.values_list("document_id", flat=True)
        )

        inactive_favorites = DocumentFavorite.objects.filter(user=self.inactive_user)

        for entry in inactive_favorites:
            if entry.document_id in existing_favorite_doc_ids:
                removed_favorites.append(entry)
            else:
                entry.user = self.active_user
                updated_favorites.append(entry)

        return updated_favorites, removed_favorites

    def prepare_linktrace_reconciliation(self):
        """
        Prepare the reconciliation by transferring link traces from the inactive user
        to the active user.
        """
        updated_linktraces = []
        removed_linktraces = []

        existing_linktraces = LinkTrace.objects.filter(user=self.active_user)
        inactive_linktraces = LinkTrace.objects.filter(user=self.inactive_user)

        for entry in inactive_linktraces:
            if existing_linktraces.filter(document=entry.document).exists():
                removed_linktraces.append(entry)
            else:
                entry.user = self.active_user
                updated_linktraces.append(entry)

        return updated_linktraces, removed_linktraces

    def prepare_thread_reconciliation(self):
        """
        Prepare the reconciliation by transferring threads from the inactive user
        to the active user.
        """
        updated_threads = []

        inactive_threads = Thread.objects.filter(creator=self.inactive_user)

        for entry in inactive_threads:
            entry.creator = self.active_user
            updated_threads.append(entry)

        return updated_threads

    def prepare_comment_reconciliation(self):
        """
        Prepare the reconciliation by transferring comments from the inactive user
        to the active user.
        """
        updated_comments = []

        inactive_comments = Comment.objects.filter(user=self.inactive_user)

        for entry in inactive_comments:
            entry.user = self.active_user
            updated_comments.append(entry)

        return updated_comments

    def prepare_reaction_reconciliation(self):
        """
        Prepare the reconciliation by creating missing reactions for the active user
        (ie, the ones that exist for the inactive user but not the active user)
        and then deleting all reactions of the inactive user.
        """

        inactive_reactions = Reaction.objects.filter(users=self.inactive_user)
        updated_reactions = inactive_reactions.exclude(users=self.active_user)

        return updated_reactions, inactive_reactions

    def send_reconciliation_confirm_email(
        self, user, user_type, confirmation_id, language=None
    ):
        """Method allowing to send confirmation email for reconciliation requests."""
        language = language or get_language()
        domain = settings.EMAIL_URL_APP or Site.objects.get_current().domain

        message = _(
            """You have requested a reconciliation of your user accounts on Docs.
            To confirm that you are the one who initiated the request
            and that this email belongs to you:"""
        )

        with override(language):
            subject = _("Confirm by clicking the link to start the reconciliation")
            context = {
                "title": subject,
                "message": message,
                "link": f"{domain}/user-reconciliations/{user_type}/{confirmation_id}/",
                "link_label": str(_("Click here")),
                "button_label": str(_("Confirm")),
            }

        user.send_email(subject, context, language)

    def send_reconciliation_done_email(self, language=None):
        """Method allowing to send done email for reconciliation requests."""
        language = language or get_language()
        domain = settings.EMAIL_URL_APP or Site.objects.get_current().domain

        message = _(
            """Your reconciliation request has been processed.
            New documents are likely associated with your account:"""
        )

        with override(language):
            subject = _("Your accounts have been merged")
            context = {
                "title": subject,
                "message": message,
                "link": f"{domain}/",
                "link_label": str(_("Click here to see")),
                "button_label": str(_("See my documents")),
            }

        self.active_user.send_email(subject, context, language)


class UserReconciliationCsvImport(BaseModel):
    """Model to import reconciliations requests from an external source
    (eg, )"""

    file = models.FileField(upload_to="imports/", verbose_name=_("CSV file"))
    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", _("Pending")),
            ("running", _("Running")),
            ("done", _("Done")),
            ("error", _("Error")),
        ],
        default="pending",
    )
    logs = models.TextField(blank=True)

    class Meta:
        db_table = "impress_user_reconciliation_csv_import"
        verbose_name = _("user reconciliation CSV import")
        verbose_name_plural = _("user reconciliation CSV imports")

    def __str__(self):
        return f"User reconciliation CSV import {self.id}"

    def send_email(self, subject, emails, context=None, language=None):
        """Generate and send email to the user from a template."""
        context = context or {}
        domain = settings.EMAIL_URL_APP or Site.objects.get_current().domain
        language = language or get_language()
        context.update(
            {
                "brandname": settings.EMAIL_BRAND_NAME,
                "domain": domain,
                "logo_img": settings.EMAIL_LOGO_IMG,
            }
        )

        with override(language):
            msg_html = render_to_string("mail/html/template.html", context)
            msg_plain = render_to_string("mail/text/template.txt", context)
            subject = str(subject)  # Force translation

            try:
                send_mail(
                    subject.capitalize(),
                    msg_plain,
                    settings.EMAIL_FROM,
                    emails,
                    html_message=msg_html,
                    fail_silently=False,
                )
            except smtplib.SMTPException as exception:
                logger.error("invitation to %s was not sent: %s", emails, exception)

    def send_reconciliation_error_email(
        self, recipient_email, other_email, language=None
    ):
        """Method allowing to send email for reconciliation requests with errors."""
        language = language or get_language()

        emails = [recipient_email]

        message = _(
            """Your request for reconciliation was unsuccessful.
            Reconciliation failed for the following email addresses:
            {recipient_email}, {other_email}.
            Please check for typos.
            You can submit another request with the valid email addresses."""
        ).format(recipient_email=recipient_email, other_email=other_email)

        with override(language):
            subject = _("Reconciliation of your Docs accounts not completed")
            context = {
                "title": subject,
                "message": message,
                "link": settings.USER_RECONCILIATION_FORM_URL,
                "link_label": str(_("Click here")),
                "button_label": str(_("Make a new request")),
            }

        self.send_email(subject, emails, context, language)


class DocumentQuerySet(models.QuerySet):
    """
    Custom queryset for the Document model, providing additional methods
    to filter documents based on user permissions.
    """

    def readable_per_se(self, user):
        """
        Filters the queryset to return documents locally known to the given
        user: the ones they created or already visited (a LinkTrace is written
        on first retrieve). Sharing itself is managed by Drive.
        """
        if user.is_authenticated:
            return self.filter(
                models.Q(creator=user)
                | models.Q(
                    id__in=LinkTrace.objects.filter(user=user).values_list(
                        "document_id", flat=True
                    )
                )
            )

        return self.none()

    def annotate_is_favorite(self, user):
        """
        Annotate document queryset with the favorite status for the current user.
        """
        if user.is_authenticated:
            favorite_exists_subquery = DocumentFavorite.objects.filter(
                document_id=models.OuterRef("pk"), user=user
            )
            return self.annotate(is_favorite=models.Exists(favorite_exists_subquery))

        return self.annotate(is_favorite=models.Value(False))

    def annotate_user_has_link_trace(self, user):
        """
        Annotate document queryset with a boolean to know if the current user
        has a link_trace on the current document.
        """

        if user.is_authenticated:
            link_trace_exists_subquery = LinkTrace.objects.filter(
                document_id=models.OuterRef("pk"), user=user
            )
            return self.annotate(
                user_has_link_trace=models.Exists(link_trace_exists_subquery)
            )

        return self.annotate(user_has_link_trace=models.Value(False))


class DocumentManager(models.Manager.from_queryset(DocumentQuerySet)):
    """
    Custom manager for the Document model, enabling the use of the custom
    queryset methods directly from the model manager.
    """


# pylint: disable=too-many-public-methods
class Document(BaseModel):
    """
    Pad document carrying the content.

    The document hierarchy and sharing are owned by Drive: this model is a
    thin wrapper around the Drive item bearing the same id, only holding what
    Drive cannot (the collaborative content and its attachments).
    """

    title = models.CharField(_("title"), max_length=255, null=True, blank=True)
    creator = models.ForeignKey(
        User,
        on_delete=models.RESTRICT,
        related_name="documents_created",
        blank=True,
        null=True,
    )
    deleted_at = models.DateTimeField(null=True, blank=True)
    attachments = ArrayField(
        models.CharField(max_length=255),
        default=list,
        editable=False,
        blank=True,
        null=True,
    )

    _content = None

    objects = DocumentManager()

    class Meta:
        db_table = "impress_document"
        ordering = ("-created_at",)
        verbose_name = _("Document")
        verbose_name_plural = _("Documents")

    def __str__(self):
        return str(self.title) if self.title else str(_("Untitled Document"))

    def save(self, *args, **kwargs):
        """Write content to object storage only if _content has changed."""
        super().save(*args, **kwargs)
        if self._content:
            self.save_content(self._content)

    def save_content(self, content):
        """Save content to object storage."""

        file_key = self.file_key
        bytes_content = content.encode("utf-8")

        # Attempt to directly check if the object exists using the storage client.
        try:
            response = default_storage.connection.meta.client.head_object(
                Bucket=default_storage.bucket_name, Key=file_key
            )
        except ClientError as excpt:
            # If the error is a 404, the object doesn't exist, so we should create it.
            if excpt.response["Error"]["Code"] == "404":
                has_changed = True
            else:
                raise
        else:
            # Compare the existing ETag with the MD5 hash of the new content.
            has_changed = (
                response["ETag"].strip('"') != hashlib.md5(bytes_content).hexdigest()  # noqa: S324
            )

        if has_changed:
            content_file = ContentFile(bytes_content)
            default_storage.save(file_key, content_file)

    @property
    def key_base(self):
        """Key base of the location where the document is stored in object storage."""
        if not self.pk:
            raise RuntimeError(
                "The document instance must be saved before requesting a storage key."
            )
        return str(self.pk)

    @property
    def file_key(self):
        """Key of the object storage file to which the document content is stored"""
        return f"{self.key_base}/file"

    @property
    def content(self):
        """Return the json content from object storage if available"""
        if self._content is None and self.id:
            try:
                response = self.get_content_response()
            except (FileNotFoundError, ClientError):
                pass
            else:
                self._content = response["Body"].read().decode("utf-8")
        return self._content

    @content.setter
    def content(self, content):
        """Cache the content, don't write to object storage yet"""
        if not isinstance(content, str):
            raise ValueError("content should be a string.")

        self._content = content

    def get_content_response(self, version_id=""):
        """Get the content in a specific version of the document"""
        params = {
            "Bucket": default_storage.bucket_name,
            "Key": self.file_key,
        }
        if version_id:
            params["VersionId"] = version_id
        return default_storage.connection.meta.client.get_object(**params)

    def get_versions_slice(self, from_version_id="", min_datetime=None, page_size=None):
        """Get document versions from object storage with pagination and starting conditions"""
        # /!\ Trick here /!\
        # The "KeyMarker" and "VersionIdMarker" fields must either be both set or both not set.
        # The error we get otherwise is not helpful at all.
        markers = {}
        if from_version_id:
            markers.update(
                {"KeyMarker": self.file_key, "VersionIdMarker": from_version_id}
            )

        real_page_size = (
            min(page_size, settings.DOCUMENT_VERSIONS_PAGE_SIZE)
            if page_size
            else settings.DOCUMENT_VERSIONS_PAGE_SIZE
        )

        response = default_storage.connection.meta.client.list_object_versions(
            Bucket=default_storage.bucket_name,
            Prefix=self.file_key,
            # compensate the latest version that we exclude below and get one more to
            # know if there are more pages
            MaxKeys=real_page_size + 2,
            **markers,
        )

        min_last_modified = min_datetime or self.created_at
        versions = [
            {
                key_snake: version[key_camel]
                for key_snake, key_camel in [
                    ("etag", "ETag"),
                    ("is_latest", "IsLatest"),
                    ("last_modified", "LastModified"),
                    ("version_id", "VersionId"),
                ]
            }
            for version in response.get("Versions", [])
            if version["LastModified"] >= min_last_modified
            and version["IsLatest"] is False
        ]
        results = versions[:real_page_size]

        count = len(results)
        if count == len(versions):
            is_truncated = False
            next_version_id_marker = ""
        else:
            is_truncated = True
            next_version_id_marker = versions[count - 1]["version_id"]

        return {
            "next_version_id_marker": next_version_id_marker,
            "is_truncated": is_truncated,
            "versions": results,
            "count": count,
        }

    def delete_version(self, version_id):
        """Delete a version from object storage given its version id"""
        return default_storage.connection.meta.client.delete_object(
            Bucket=default_storage.bucket_name, Key=self.file_key, VersionId=version_id
        )

    def has_link_trace(self, user):
        """Return if the user has a link trace on this document."""

        if not user.is_authenticated:
            return False

        try:
            return self.user_has_link_trace
        except AttributeError:
            return LinkTrace.objects.filter(document=self, user=user).exists()

    # The document is a thin wrapper around the Drive item bearing the same
    # id. `drive_item` is a non-DB attribute holding the Drive payload for the
    # current user, set by the permission layer or lazily fetched.
    drive_item = None

    def get_drive_item(self, user):
        """
        Return the Drive item mirroring this document (abilities, link
        definition, hierarchy data), fetched on behalf of the given user.
        Memoized on the instance; drive_client has a short per-user cache.
        """
        if self.drive_item is None:
            # Import here to avoid a circular import through core.api.serializers
            from core.services import (  # pylint: disable=import-outside-toplevel
                drive_client,
            )

            self.drive_item = drive_client.get_item(str(self.pk), user)

        return self.drive_item

    def get_abilities(self, user):
        """
        Return abilities for a given user on the document, as delegated to
        Drive which owns the document tree and sharing. Fails closed (all
        False) when the user has no access or Drive cannot be reached.
        """
        # Import here to avoid a circular import through core.api.serializers
        from core.services import drive_client  # pylint: disable=import-outside-toplevel

        try:
            item = self.get_drive_item(user)
        except drive_client.DriveClientError:
            return drive_client.no_abilities()

        return drive_client.map_drive_abilities(item.get("abilities"))

    # Link reach/role are owned by Drive and exposed read-only through the
    # drive_item payload when it has been loaded.

    @property
    def link_reach(self):
        """Link reach is managed in Drive."""
        if self.drive_item:
            return self.drive_item.get("link_reach") or LinkReachChoices.RESTRICTED
        return LinkReachChoices.RESTRICTED

    @property
    def link_role(self):
        """Link role is managed in Drive."""
        return self.drive_item.get("link_role") if self.drive_item else None

    @property
    def ancestors_link_reach(self):
        """Link reach equivalent to all document's ancestors."""
        if self.drive_item:
            return (
                self.drive_item.get("ancestors_link_reach")
                or LinkReachChoices.RESTRICTED
            )
        return LinkReachChoices.RESTRICTED

    @property
    def ancestors_link_role(self):
        """Link role equivalent to all document's ancestors."""
        return self.drive_item.get("ancestors_link_role") if self.drive_item else None

    @property
    def computed_link_reach(self):
        """Actual link reach on the document."""
        if self.drive_item:
            return (
                self.drive_item.get("computed_link_reach")
                or LinkReachChoices.RESTRICTED
            )
        return LinkReachChoices.RESTRICTED

    @property
    def computed_link_role(self):
        """Actual link role on the document."""
        return self.drive_item.get("computed_link_role") if self.drive_item else None

    def send_email(self, subject, emails, context=None, language=None):
        """Generate and send email from a template."""
        context = context or {}
        domain = settings.EMAIL_URL_APP or Site.objects.get_current().domain
        language = language or get_language()
        context.update(
            {
                "brandname": settings.EMAIL_BRAND_NAME,
                "document": self,
                "domain": domain,
                "link": f"{domain}/docs/{self.id}/?utm_source=docssharelink&utm_campaign={self.id}",
                "link_label": self.title or str(_("Untitled Document")),
                "button_label": _("Open"),
                "logo_img": settings.EMAIL_LOGO_IMG,
            }
        )

        with override(language):
            msg_html = render_to_string("mail/html/template.html", context)
            msg_plain = render_to_string("mail/text/template.txt", context)
            subject = str(subject)  # Force translation

            try:
                send_mail(
                    subject.capitalize(),
                    msg_plain,
                    settings.EMAIL_FROM,
                    emails,
                    html_message=msg_html,
                    fail_silently=False,
                )
            except smtplib.SMTPException as exception:
                logger.error("invitation to %s was not sent: %s", emails, exception)

    def send_invitation_email(self, email, role, sender, language=None):
        """Method allowing a user to send an email invitation to another user for a document."""
        language = language or get_language()
        role = RoleChoices(role).label
        sender_name = sender.full_name or sender.email
        sender_name_email = (
            f"{sender.full_name:s} ({sender.email})"
            if sender.full_name
            else sender.email
        )

        with override(language):
            context = {
                "title": _("{name} shared a document with you!").format(
                    name=sender_name
                ),
                "message": _(
                    '{name} invited you with the role "{role}" on the following document:'
                ).format(name=sender_name_email, role=role.lower()),
            }
            subject = (
                context["title"]
                if not self.title
                else _("{name} shared a document with you: {title}").format(
                    name=sender_name, title=self.title
                )
            )

        self.send_email(subject, [email], context, language)

    def soft_delete(self):
        """
        Soft delete the document. The hierarchy is owned by Drive so there is
        no descendant propagation: this only hides the local row.
        """
        if self.deleted_at is not None:
            raise RuntimeError("This document is already deleted.")

        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])

    def restore(self):
        """Cancelling a soft delete with checks."""
        if self.deleted_at is None:
            raise RuntimeError("This document is not deleted.")

        if self.deleted_at < get_trashbin_cutoff():
            raise RuntimeError(
                "This document was permanently deleted and cannot be restored."
            )

        self.deleted_at = None
        self.save(update_fields=["deleted_at", "updated_at"])


class LinkTrace(BaseModel):
    """
    Relation model to trace accesses to a document via a link by a logged-in user.
    This is necessary to show the document in the user's list of documents even
    though the user does not have a role on the document.
    """

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="link_traces",
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="link_traces")

    class Meta:
        db_table = "impress_link_trace"
        verbose_name = _("Document/user link trace")
        verbose_name_plural = _("Document/user link traces")
        constraints = [
            models.UniqueConstraint(
                fields=["user", "document"],
                name="unique_link_trace_document_user",
                violation_error_message=_(
                    "A link trace already exists for this document/user."
                ),
            ),
        ]

    def __str__(self):
        return f"{self.user!s} trace on document {self.document!s}"


class DocumentFavorite(BaseModel):
    """Relation model to store a user's favorite documents."""

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="favorited_by_users",
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="favorite_documents"
    )

    class Meta:
        db_table = "impress_document_favorite"
        verbose_name = _("Document favorite")
        verbose_name_plural = _("Document favorites")
        constraints = [
            models.UniqueConstraint(
                fields=["user", "document"],
                name="unique_document_favorite_user",
                violation_error_message=_(
                    "This document is already targeted by a favorite relation instance "
                    "for the same user."
                ),
            ),
        ]

    def __str__(self):
        return f"{self.user!s} favorite on document {self.document!s}"


class DocumentAskForAccess(BaseModel):
    """Relation model to ask for access to a document."""

    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="ask_for_accesses"
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="ask_for_accesses"
    )

    role = models.CharField(
        max_length=20, choices=RoleChoices.choices, default=RoleChoices.READER
    )

    class Meta:
        db_table = "impress_document_ask_for_access"
        verbose_name = _("Document ask for access")
        verbose_name_plural = _("Document ask for accesses")
        constraints = [
            models.UniqueConstraint(
                fields=["user", "document"],
                name="unique_document_ask_for_access_user",
                violation_error_message=_(
                    "This user has already asked for access to this document."
                ),
            ),
        ]

    def __str__(self):
        return f"{self.user!s} asked for access to document {self.document!s}"

    def get_abilities(self, user):
        """Compute and return abilities for a given user."""
        user_role = self.document.get_role(user)
        is_admin_or_owner = user_role in PRIVILEGED_ROLES

        set_role_to = [
            role
            for role in RoleChoices.values
            if RoleChoices.get_priority(role) <= RoleChoices.get_priority(user_role)
        ]

        return {
            "destroy": is_admin_or_owner,
            "update": is_admin_or_owner,
            "partial_update": is_admin_or_owner,
            "retrieve": is_admin_or_owner,
            "accept": is_admin_or_owner,
            "set_role_to": set_role_to,
        }

    def accept(self, role=None):
        """Accept a document ask for access resource."""
        # POC-DRIVE-SHARING: disabled until Drive implements AskForAccess — do not delete
        # if role is None:
        #     role = self.role
        #
        # DocumentAccess.objects.update_or_create(
        #     document=self.document,
        #     user=self.user,
        #     defaults={"role": role},
        #     create_defaults={"role": role},
        # )
        # self.delete()
        raise NotImplementedError("Sharing is managed in Drive.")

    def send_ask_for_access_email(self, email, language=None):
        """
        Method allowing a user to send an email notification when asking for access to a document.
        """

        language = language or get_language()
        sender = self.user
        sender_name = sender.full_name or sender.email
        sender_name_email = (
            f"{sender.full_name:s} ({sender.email})"
            if sender.full_name
            else sender.email
        )

        with override(language):
            context = {
                "title": _("{name} would like access to a document!").format(
                    name=sender_name
                ),
                "message": _(
                    "{name} would like access to the following document:"
                ).format(name=sender_name_email),
            }
            subject = (
                context["title"]
                if not self.document.title
                else _("{name} is asking for access to the document: {title}").format(
                    name=sender_name, title=self.document.title
                )
            )

        self.document.send_email(subject, [email], context, language)


class Thread(BaseModel):
    """Discussion thread attached to a document.

    A thread groups one or many comments. For backward compatibility with the
    existing frontend (useComments hook) we still expose a flattened serializer
    that returns a "content" field representing the first comment's body.
    """

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="threads",
    )
    creator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="threads",
        null=True,
        blank=True,
    )
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="resolved_threads",
        null=True,
        blank=True,
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "impress_thread"
        ordering = ("-created_at",)
        verbose_name = _("Thread")
        verbose_name_plural = _("Threads")

    def __str__(self):
        author = self.creator or _("Anonymous")
        return f"Thread by {author!s} on {self.document!s}"

    def get_abilities(self, user):
        """
        Compute and return abilities for a given user (mirrors comment logic).
        Sharing is owned by Drive, so abilities and roles come from there.
        """
        # Import here to avoid a circular import through core.api.serializers
        from core.services import drive_client  # pylint: disable=import-outside-toplevel

        doc_abilities, drive_role = drive_client.get_doc_context(self.document_id, user)
        read_access = doc_abilities.get("comment", False)
        write_access = (user.is_authenticated and self.creator == user) or drive_role in [
            RoleChoices.OWNER,
            RoleChoices.ADMIN,
        ]
        return {
            "destroy": write_access,
            "update": write_access,
            "partial_update": write_access,
            "resolve": write_access,
            "unresolve": write_access,
            "retrieve": read_access,
        }

    @property
    def first_comment(self):
        """Return the first createdcomment of the thread."""
        return self.comments.order_by("created_at").first()


class Comment(BaseModel):
    """A comment belonging to a thread."""

    thread = models.ForeignKey(
        Thread,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="thread_comment",
        null=True,
        blank=True,
    )
    body = models.JSONField()
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "impress_comment"
        ordering = ("created_at",)
        verbose_name = _("Comment")
        verbose_name_plural = _("Comments")

    def __str__(self):
        """Return the string representation of the comment."""
        author = self.user or _("Anonymous")
        return f"Comment by {author!s} on thread {self.thread_id}"

    def get_abilities(self, user):
        """
        Return the abilities of the comment. Sharing is owned by Drive, so
        abilities and roles come from there.
        """
        # Import here to avoid a circular import through core.api.serializers
        from core.services import drive_client  # pylint: disable=import-outside-toplevel

        doc_abilities, drive_role = drive_client.get_doc_context(
            self.thread.document_id, user
        )
        read_access = doc_abilities.get("comment", False)
        can_react = read_access and user.is_authenticated
        is_author = user.is_authenticated and self.user == user
        can_moderate = is_author or drive_role in [
            RoleChoices.OWNER,
            RoleChoices.ADMIN,
        ]
        return {
            "destroy": can_moderate,
            "update": is_author,
            "partial_update": is_author,
            "reactions": can_react,
            "retrieve": read_access,
        }


class Reaction(BaseModel):
    """Aggregated reactions for a given emoji on a comment.

    We store one row per (comment, emoji) and maintain the list of user IDs who
    reacted with that emoji. This matches the frontend interface where a
    reaction exposes: emoji, createdAt (first reaction date) and userIds.
    """

    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    emoji = models.CharField(max_length=32)
    users = models.ManyToManyField(User, related_name="reactions")

    class Meta:
        db_table = "impress_comment_reaction"
        constraints = [
            models.UniqueConstraint(
                fields=["comment", "emoji"],
                name="unique_comment_emoji",
                violation_error_message=_(
                    "This emoji has already been reacted to this comment."
                ),
            ),
        ]
        verbose_name = _("Reaction")
        verbose_name_plural = _("Reactions")

    def __str__(self):
        """Return the string representation of the reaction."""
        return f"Reaction {self.emoji} on comment {self.comment.id}"
