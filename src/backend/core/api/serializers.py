"""Client serializers for the impress core app."""
# pylint: disable=too-many-lines

import binascii
import mimetypes
from base64 import b64decode
from os.path import splitext

from django.conf import settings
from django.db.models import Q
from django.utils.functional import lazy
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

import magic
from rest_framework import serializers

from core import choices, enums, models, utils, validators
from core.services import mime_types
from core.services.ai_services import AI_ACTIONS
from core.services.converter_services import (
    ConversionError,
    Converter,
)


class UserSerializer(serializers.ModelSerializer):
    """Serialize users."""

    full_name = serializers.SerializerMethodField(read_only=True)
    short_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.User
        fields = ["id", "email", "full_name", "short_name", "language"]
        read_only_fields = ["id", "email", "full_name", "short_name"]

    def get_full_name(self, instance):
        """Return the full name of the user."""
        if not instance.full_name:
            email = instance.email.split("@")[0]
            return slugify(email)

        return instance.full_name

    def get_short_name(self, instance):
        """Return the short name of the user."""
        if not instance.short_name:
            email = instance.email.split("@")[0]
            return slugify(email)

        return instance.short_name


class UserLightSerializer(UserSerializer):
    """Serialize users with limited fields."""

    class Meta:
        model = models.User
        fields = ["full_name", "short_name"]
        read_only_fields = ["full_name", "short_name"]


class ListDocumentSerializer(serializers.ModelSerializer):
    """Serialize documents with limited fields for display in lists."""

    is_favorite = serializers.BooleanField(read_only=True)
    nb_accesses_ancestors = serializers.IntegerField(read_only=True)
    nb_accesses_direct = serializers.IntegerField(read_only=True)
    user_role = serializers.SerializerMethodField(read_only=True)
    abilities = serializers.SerializerMethodField(read_only=True)
    deleted_at = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.Document
        fields = [
            "id",
            "abilities",
            "ancestors_link_reach",
            "ancestors_link_role",
            "computed_link_reach",
            "computed_link_role",
            "created_at",
            "creator",
            "deleted_at",
            "depth",
            "excerpt",
            "is_favorite",
            "link_role",
            "link_reach",
            "nb_accesses_ancestors",
            "nb_accesses_direct",
            "numchild",
            "path",
            "title",
            "updated_at",
            "user_role",
        ]
        read_only_fields = [
            "id",
            "abilities",
            "ancestors_link_reach",
            "ancestors_link_role",
            "computed_link_reach",
            "computed_link_role",
            "created_at",
            "creator",
            "deleted_at",
            "depth",
            "excerpt",
            "is_favorite",
            "link_role",
            "link_reach",
            "nb_accesses_ancestors",
            "nb_accesses_direct",
            "numchild",
            "path",
            "updated_at",
            "user_role",
        ]

    def to_representation(self, instance):
        """Precompute once per instance"""
        paths_links_mapping = self.context.get("paths_links_mapping")

        if paths_links_mapping is not None:
            links = paths_links_mapping.get(instance.path[: -instance.steplen], [])
            instance.ancestors_link_definition = choices.get_equivalent_link_definition(
                links
            )

        return super().to_representation(instance)

    def get_abilities(self, instance) -> dict:
        """Return abilities of the logged-in user on the instance."""
        request = self.context.get("request")
        if not request:
            return {}

        return instance.get_abilities(request.user)

    def get_user_role(self, instance):
        """
        Return roles of the logged-in user for the current document,
        taking into account ancestors.
        """
        request = self.context.get("request")
        return instance.get_role(request.user) if request else None

    def get_deleted_at(self, instance):
        """Return the deleted_at of the current document."""
        return instance.ancestors_deleted_at


class DocumentLightSerializer(serializers.ModelSerializer):
    """Minial document serializer for nesting in document accesses."""

    class Meta:
        model = models.Document
        fields = ["id", "path", "depth"]
        read_only_fields = ["id", "path", "depth"]


class DocumentSerializer(ListDocumentSerializer):
    """Serialize documents with all fields for display in detail views."""

    content = serializers.CharField(required=False)
    websocket = serializers.BooleanField(required=False, write_only=True)
    file = serializers.FileField(
        required=False, write_only=True, allow_null=True, max_length=255
    )

    class Meta:
        model = models.Document
        fields = [
            "id",
            "abilities",
            "ancestors_link_reach",
            "ancestors_link_role",
            "computed_link_reach",
            "computed_link_role",
            "content",
            "created_at",
            "creator",
            "deleted_at",
            "depth",
            "excerpt",
            "file",
            "is_favorite",
            "link_role",
            "link_reach",
            "nb_accesses_ancestors",
            "nb_accesses_direct",
            "numchild",
            "path",
            "title",
            "updated_at",
            "user_role",
            "websocket",
        ]
        read_only_fields = [
            "id",
            "abilities",
            "ancestors_link_reach",
            "ancestors_link_role",
            "computed_link_reach",
            "computed_link_role",
            "created_at",
            "creator",
            "deleted_at",
            "depth",
            "is_favorite",
            "link_role",
            "link_reach",
            "nb_accesses_ancestors",
            "nb_accesses_direct",
            "numchild",
            "path",
            "updated_at",
            "user_role",
        ]

    def get_fields(self):
        """Dynamically make `id` read-only on PUT requests but writable on POST requests."""
        fields = super().get_fields()

        request = self.context.get("request")
        if request:
            if request.method == "POST":
                fields["id"].read_only = False
            if (
                serializers.BooleanField().to_internal_value(
                    request.query_params.get("without_content", False)
                )
                is True
            ):
                del fields["content"]

        return fields

    def validate_id(self, value):
        """Ensure the provided ID does not already exist when creating a new document."""
        request = self.context.get("request")

        # Only check this on POST (creation)
        if request and request.method == "POST":
            if models.Document.objects.filter(id=value).exists():
                raise serializers.ValidationError(
                    "A document with this ID already exists. You cannot override it."
                )

        return value

    def validate_content(self, value):
        """Validate the content field."""
        if not value:
            return None

        try:
            b64decode(value, validate=True)
        except binascii.Error as err:
            raise serializers.ValidationError("Invalid base64 content.") from err

        return value

    def validate_file(self, file):
        """Add file size and type constraints as defined in settings."""
        if not file:
            return None

        # Validate file size
        if file.size > settings.CONVERSION_FILE_MAX_SIZE:
            max_size = settings.CONVERSION_FILE_MAX_SIZE // (1024 * 1024)
            raise serializers.ValidationError(
                f"File size exceeds the maximum limit of {max_size:d} MB."
            )

        _name, extension = splitext(file.name)

        if extension.lower() not in settings.CONVERSION_FILE_EXTENSIONS_ALLOWED:
            raise serializers.ValidationError(
                (
                    f"File extension {extension} is not allowed. Allowed extensions"
                    f" are: {settings.CONVERSION_FILE_EXTENSIONS_ALLOWED}."
                )
            )

        return file

    def save(self, **kwargs):
        """
        Process the content field to extract attachment keys and update the document's
        "attachments" field for access control.
        """
        content = self.validated_data.get("content", "")
        extracted_attachments = set(utils.extract_attachments(content))

        existing_attachments = (
            set(self.instance.attachments or []) if self.instance else set()
        )
        new_attachments = extracted_attachments - existing_attachments

        if new_attachments:
            attachments_documents = (
                models.Document.objects.filter(
                    attachments__overlap=list(new_attachments)
                )
                .only("path", "attachments")
                .order_by("path")
            )

            user = self.context["request"].user
            readable_per_se_paths = (
                models.Document.objects.readable_per_se(user)
                .order_by("path")
                .values_list("path", flat=True)
            )
            readable_attachments_paths = utils.filter_descendants(
                [doc.path for doc in attachments_documents],
                readable_per_se_paths,
                skip_sorting=True,
            )

            readable_attachments = set()
            for document in attachments_documents:
                if document.path not in readable_attachments_paths:
                    continue
                readable_attachments.update(set(document.attachments) & new_attachments)

            # Update attachments with readable keys
            self.validated_data["attachments"] = list(
                existing_attachments | readable_attachments
            )

        return super().save(**kwargs)


class DocumentAccessSerializer(serializers.ModelSerializer):
    """Serialize document accesses."""

    document = DocumentLightSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=models.User.objects.all(),
        write_only=True,
        source="user",
        required=False,
        allow_null=True,
    )
    user = UserSerializer(read_only=True)
    team = serializers.CharField(required=False, allow_blank=True)
    abilities = serializers.SerializerMethodField(read_only=True)
    max_ancestors_role = serializers.SerializerMethodField(read_only=True)
    max_role = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.DocumentAccess
        resource_field_name = "document"
        fields = [
            "id",
            "document",
            "user",
            "user_id",
            "team",
            "role",
            "abilities",
            "max_ancestors_role",
            "max_role",
        ]
        read_only_fields = [
            "id",
            "document",
            "abilities",
            "max_ancestors_role",
            "max_role",
        ]

    def get_abilities(self, instance) -> dict:
        """Return abilities of the logged-in user on the instance."""
        request = self.context.get("request")
        if request:
            return instance.get_abilities(request.user)
        return {}

    def get_max_ancestors_role(self, instance):
        """Return max_ancestors_role if annotated; else None."""
        return getattr(instance, "max_ancestors_role", None)

    def get_max_role(self, instance):
        """Return max_ancestors_role if annotated; else None."""
        return choices.RoleChoices.max(
            getattr(instance, "max_ancestors_role", None),
            instance.role,
        )

    def update(self, instance, validated_data):
        """Make "user" field readonly but only on update."""
        validated_data.pop("team", None)
        validated_data.pop("user", None)
        return super().update(instance, validated_data)


class DocumentAccessLightSerializer(DocumentAccessSerializer):
    """Serialize document accesses with limited fields."""

    user = UserLightSerializer(read_only=True)

    class Meta:
        model = models.DocumentAccess
        resource_field_name = "document"
        fields = [
            "id",
            "document",
            "user",
            "team",
            "role",
            "abilities",
            "max_ancestors_role",
            "max_role",
        ]
        read_only_fields = [
            "id",
            "document",
            "team",
            "role",
            "abilities",
            "max_ancestors_role",
            "max_role",
        ]


class ServerCreateDocumentSerializer(serializers.Serializer):
    """
    Serializer for creating a document from a server-to-server request.

    Expects 'content' as a markdown string, which is converted to our internal format
    via a Node.js microservice. The conversion is handled automatically, so third parties
    only need to provide markdown.

    Both "sub" and "email" are required because the external app calling doesn't know
    if the user will pre-exist in Docs database. If the user pre-exist, we will ignore the
    submitted "email" field and use the email address set on the user account in our database
    """

    # Document
    title = serializers.CharField(required=True)
    content = serializers.CharField(required=True)
    # User
    sub = serializers.CharField(
        required=True, validators=[validators.sub_validator], max_length=255
    )
    email = serializers.EmailField(required=True)
    language = serializers.ChoiceField(
        required=False, choices=lazy(lambda: settings.LANGUAGES, tuple)()
    )
    # Invitation
    message = serializers.CharField(required=False)
    subject = serializers.CharField(required=False)

    def create(self, validated_data):
        """Create the document and associate it with the user or send an invitation."""
        language = validated_data.get("language", settings.LANGUAGE_CODE)

        # Get the user on its sub (unique identifier). Default on email if allowed in settings
        email = validated_data["email"]

        try:
            user = models.User.objects.get_user_by_sub_or_email(
                validated_data["sub"], email
            )
        except models.DuplicateEmailError as err:
            raise serializers.ValidationError({"email": [err.message]}) from err

        if user:
            email = user.email
            language = user.language or language

        try:
            document_content = Converter().convert(
                validated_data["content"], mime_types.MARKDOWN, mime_types.YJS
            )
        except ConversionError as err:
            raise serializers.ValidationError(
                {"content": ["Could not convert content"]}
            ) from err

        document = models.Document.add_root(
            title=validated_data["title"],
            content=document_content,
            creator=user,
        )

        if user:
            # Associate the document with the pre-existing user
            models.DocumentAccess.objects.create(
                document=document,
                role=models.RoleChoices.OWNER,
                user=user,
            )
        else:
            # The user doesn't exist in our database: we need to invite him/her
            models.Invitation.objects.create(
                document=document,
                email=email,
                role=models.RoleChoices.OWNER,
            )

        self._send_email_notification(document, validated_data, email, language)
        return document

    def _send_email_notification(self, document, validated_data, email, language):
        """Notify the user about the newly created document."""
        subject = validated_data.get("subject") or _(
            "A new document was created on your behalf!"
        )
        context = {
            "message": validated_data.get("message")
            or _("You have been granted ownership of a new document:"),
            "title": subject,
        }
        document.send_email(subject, [email], context, language)

    def update(self, instance, validated_data):
        """
        This serializer does not support updates.
        """
        raise NotImplementedError("Update is not supported for this serializer.")


class LinkDocumentSerializer(serializers.ModelSerializer):
    """
    Serialize link configuration for documents.
    We expose it separately from document in order to simplify and secure access control.
    """

    link_reach = serializers.ChoiceField(
        choices=models.LinkReachChoices.choices, required=True
    )

    class Meta:
        model = models.Document
        fields = [
            "link_role",
            "link_reach",
        ]

    def validate(self, attrs):
        """Validate that link_role and link_reach are compatible using get_select_options."""
        link_reach = attrs.get("link_reach")
        link_role = attrs.get("link_role")

        if not link_reach:
            raise serializers.ValidationError(
                {"link_reach": _("This field is required.")}
            )

        # Get available options based on ancestors' link definition
        available_options = models.LinkReachChoices.get_select_options(
            **self.instance.ancestors_link_definition
        )

        # Validate link_reach is allowed
        if link_reach not in available_options:
            msg = _(
                "Link reach '%(link_reach)s' is not allowed based on parent document configuration."
            )
            raise serializers.ValidationError(
                {"link_reach": msg % {"link_reach": link_reach}}
            )

        # Validate link_role is compatible with link_reach
        allowed_roles = available_options[link_reach]

        # Restricted reach: link_role must be None
        if link_reach == models.LinkReachChoices.RESTRICTED:
            if link_role is not None:
                raise serializers.ValidationError(
                    {
                        "link_role": (
                            "Cannot set link_role when link_reach is 'restricted'. "
                            "Link role must be null for restricted reach."
                        )
                    }
                )
            return attrs
        # Non-restricted: link_role must be in allowed roles
        if link_role not in allowed_roles:
            allowed_roles_str = ", ".join(allowed_roles) if allowed_roles else "none"
            raise serializers.ValidationError(
                {
                    "link_role": (
                        f"Link role '{link_role}' is not allowed for link reach '{link_reach}'. "
                        f"Allowed roles: {allowed_roles_str}"
                    )
                }
            )
        return attrs


class DocumentDuplicationSerializer(serializers.Serializer):
    """
    Serializer for duplicating a document.
    Allows specifying whether to keep access permissions,
    and whether to duplicate descendant documents as well
    (deep copy) or not (shallow copy).
    """

    with_accesses = serializers.BooleanField(default=False)
    with_descendants = serializers.BooleanField(default=False)

    def create(self, validated_data):
        """
        This serializer is not intended to create objects.
        """
        raise NotImplementedError("This serializer does not support creation.")

    def update(self, instance, validated_data):
        """
        This serializer is not intended to update objects.
        """
        raise NotImplementedError("This serializer does not support updating.")


# Suppress the warning about not implementing `create` and `update` methods
# since we don't use a model and only rely on the serializer for validation
# pylint: disable=abstract-method
class FileUploadSerializer(serializers.Serializer):
    """Receive file upload requests."""

    file = serializers.FileField()

    def validate_file(self, file):
        """Add file size and type constraints as defined in settings."""
        # Validate file size
        if file.size > settings.DOCUMENT_IMAGE_MAX_SIZE:
            max_size = settings.DOCUMENT_IMAGE_MAX_SIZE // (1024 * 1024)
            raise serializers.ValidationError(
                f"File size exceeds the maximum limit of {max_size:d} MB."
            )

        extension = file.name.rpartition(".")[-1] if "." in file.name else None

        # Read the first few bytes to determine the MIME type accurately
        mime = magic.Magic(mime=True)
        magic_mime_type = mime.from_buffer(file.read(1024))
        file.seek(0)  # Reset file pointer to the beginning after reading
        self.context["is_unsafe"] = False
        if settings.DOCUMENT_ATTACHMENT_CHECK_UNSAFE_MIME_TYPES_ENABLED:
            self.context["is_unsafe"] = (
                magic_mime_type in settings.DOCUMENT_UNSAFE_MIME_TYPES
            )

            extension_mime_type, _ = mimetypes.guess_type(file.name)

            # Try guessing a coherent extension from the mimetype
            if extension_mime_type != magic_mime_type:
                self.context["is_unsafe"] = True

        guessed_ext = mimetypes.guess_extension(magic_mime_type)
        # Missing extensions or extensions longer than 5 characters (it's as long as an extension
        # can be) are replaced by the extension we eventually guessed from mimetype.
        if (extension is None or len(extension) > 5) and guessed_ext:
            extension = guessed_ext[1:]

        if extension is None:
            raise serializers.ValidationError("Could not determine file extension.")

        self.context["expected_extension"] = extension
        self.context["content_type"] = magic_mime_type
        self.context["file_name"] = file.name

        return file

    def validate(self, attrs):
        """Override validate to add the computed extension to validated_data."""
        attrs["expected_extension"] = self.context["expected_extension"]
        attrs["is_unsafe"] = self.context["is_unsafe"]
        attrs["content_type"] = self.context["content_type"]
        attrs["file_name"] = self.context["file_name"]
        return attrs


class InvitationSerializer(serializers.ModelSerializer):
    """Serialize invitations."""

    abilities = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.Invitation
        fields = [
            "id",
            "abilities",
            "created_at",
            "email",
            "document",
            "role",
            "issuer",
            "is_expired",
        ]
        read_only_fields = [
            "id",
            "abilities",
            "created_at",
            "document",
            "issuer",
            "is_expired",
        ]

    def get_abilities(self, invitation) -> dict:
        """Return abilities of the logged-in user on the instance."""
        request = self.context.get("request")
        if request:
            return invitation.get_abilities(request.user)
        return {}

    def validate(self, attrs):
        """Validate invitation data."""
        request = self.context.get("request")
        user = getattr(request, "user", None)

        attrs["document_id"] = self.context["resource_id"]

        # Only set the issuer if the instance is being created
        if self.instance is None:
            attrs["issuer"] = user

        if attrs.get("email"):
            attrs["email"] = attrs["email"].lower()

        return attrs

    def validate_role(self, role):
        """Custom validation for the role field."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        document_id = self.context["resource_id"]

        # If the role is OWNER, check if the user has OWNER access
        if role == models.RoleChoices.OWNER:
            if not models.DocumentAccess.objects.filter(
                Q(user=user) | Q(team__in=user.teams),
                document=document_id,
                role=models.RoleChoices.OWNER,
            ).exists():
                raise serializers.ValidationError(
                    "Only owners of a document can invite other users as owners."
                )

        return role


class RoleSerializer(serializers.Serializer):
    """Serializer validating role choices."""

    role = serializers.ChoiceField(
        choices=models.RoleChoices.choices, required=False, allow_null=True
    )


class DocumentAskForAccessCreateSerializer(serializers.Serializer):
    """Serializer for creating a document ask for access."""

    role = serializers.ChoiceField(
        choices=[
            role for role in choices.RoleChoices if role != models.RoleChoices.OWNER
        ],
        required=False,
        default=models.RoleChoices.READER,
    )


class DocumentAskForAccessSerializer(serializers.ModelSerializer):
    """Serializer for document ask for access model"""

    abilities = serializers.SerializerMethodField(read_only=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = models.DocumentAskForAccess
        fields = [
            "id",
            "document",
            "user",
            "role",
            "created_at",
            "abilities",
        ]
        read_only_fields = ["id", "document", "user", "role", "created_at", "abilities"]

    def get_abilities(self, instance) -> dict:
        """Return abilities of the logged-in user on the instance."""
        request = self.context.get("request")
        if request:
            return instance.get_abilities(request.user)
        return {}


class VersionFilterSerializer(serializers.Serializer):
    """Validate version filters applied to the list endpoint."""

    version_id = serializers.CharField(required=False, allow_blank=True)
    page_size = serializers.IntegerField(
        required=False, min_value=1, max_value=50, default=20
    )


class AITransformSerializer(serializers.Serializer):
    """Serializer for AI transform requests."""

    action = serializers.ChoiceField(choices=AI_ACTIONS, required=True)
    text = serializers.CharField(required=True)

    def validate_text(self, value):
        """Ensure the text field is not empty."""

        if len(value.strip()) == 0:
            raise serializers.ValidationError("Text field cannot be empty.")
        return value


class AITranslateSerializer(serializers.Serializer):
    """Serializer for AI translate requests."""

    language = serializers.ChoiceField(
        choices=tuple(enums.ALL_LANGUAGES.items()), required=True
    )
    text = serializers.CharField(required=True)

    def validate_text(self, value):
        """Ensure the text field is not empty."""

        if len(value.strip()) == 0:
            raise serializers.ValidationError("Text field cannot be empty.")
        return value


class AIProxySerializer(serializers.Serializer):
    """Serializer for AI proxy requests."""

    messages = serializers.ListField(
        required=True,
        child=serializers.DictField(
            child=serializers.CharField(required=True),
        ),
        allow_empty=False,
    )
    model = serializers.CharField(required=True)

    def validate_messages(self, messages):
        """Validate messages structure."""
        # Ensure each message has the required fields
        for message in messages:
            if (
                not isinstance(message, dict)
                or "role" not in message
                or "content" not in message
            ):
                raise serializers.ValidationError(
                    "Each message must have 'role' and 'content' fields"
                )

        return messages

    def validate_model(self, value):
        """Validate model value is the same than settings.AI_MODEL"""
        if value != settings.AI_MODEL:
            raise serializers.ValidationError(f"{value} is not a valid model")

        return value


class MoveDocumentSerializer(serializers.Serializer):
    """
    Serializer for validating input data to move a document within the tree structure.

    Fields:
        - target_document_id (UUIDField): The ID of the target parent document where the
            document should be moved. This field is required and must be a valid UUID.
        - position (ChoiceField): Specifies the position of the document in relation to
            the target parent's children.
          Choices:
            - "first-child": Place the document as the first child of the target parent.
            - "last-child": Place the document as the last child of the target parent (default).
            - "left": Place the document as the left sibling of the target parent.
            - "right": Place the document as the right sibling of the target parent.

    Example:
        Input payload for moving a document:
        {
            "target_document_id": "123e4567-e89b-12d3-a456-426614174000",
            "position": "first-child"
        }

    Notes:
        - The `target_document_id` is mandatory.
        - The `position` defaults to "last-child" if not provided.
    """

    target_document_id = serializers.UUIDField(required=True)
    position = serializers.ChoiceField(
        choices=enums.MoveNodePositionChoices.choices,
        default=enums.MoveNodePositionChoices.LAST_CHILD,
    )


class ReactionSerializer(serializers.ModelSerializer):
    """Serialize reactions."""

    users = UserLightSerializer(many=True, read_only=True)

    class Meta:
        model = models.Reaction
        fields = [
            "id",
            "emoji",
            "created_at",
            "users",
        ]
        read_only_fields = ["id", "created_at", "users"]


class CommentSerializer(serializers.ModelSerializer):
    """Serialize comments (nested under a thread) with reactions and abilities."""

    user = UserLightSerializer(read_only=True)
    abilities = serializers.SerializerMethodField()
    reactions = ReactionSerializer(many=True, read_only=True)

    class Meta:
        model = models.Comment
        fields = [
            "id",
            "user",
            "body",
            "created_at",
            "updated_at",
            "reactions",
            "abilities",
        ]
        read_only_fields = [
            "id",
            "user",
            "created_at",
            "updated_at",
            "reactions",
            "abilities",
        ]

    def validate(self, attrs):
        """Validate comment data."""

        request = self.context.get("request")
        user = getattr(request, "user", None)

        attrs["thread_id"] = self.context["thread_id"]
        attrs["user_id"] = user.id if user else None
        return attrs

    def get_abilities(self, obj):
        """Return comment's abilities."""
        request = self.context.get("request")
        if request:
            return obj.get_abilities(request.user)
        return {}


class ThreadSerializer(serializers.ModelSerializer):
    """Serialize threads in a backward compatible shape for current frontend.

    We expose a flatten representation where ``content`` maps to the first
    comment's body. Creating a thread requires a ``content`` field which is
    stored as the first comment.
    """

    creator = UserLightSerializer(read_only=True)
    abilities = serializers.SerializerMethodField(read_only=True)
    body = serializers.JSONField(write_only=True, required=True)
    comments = serializers.SerializerMethodField(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = models.Thread
        fields = [
            "id",
            "body",
            "created_at",
            "updated_at",
            "creator",
            "abilities",
            "comments",
            "resolved",
            "resolved_at",
            "resolved_by",
            "metadata",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "creator",
            "abilities",
            "comments",
            "resolved",
            "resolved_at",
            "resolved_by",
            "metadata",
        ]

    def validate(self, attrs):
        """Validate thread data."""
        request = self.context.get("request")
        user = getattr(request, "user", None)

        attrs["document_id"] = self.context["resource_id"]
        attrs["creator_id"] = user.id if user else None

        return attrs

    def get_abilities(self, thread):
        """Return thread's abilities."""
        request = self.context.get("request")
        if request:
            return thread.get_abilities(request.user)
        return {}


class SearchDocumentSerializer(serializers.Serializer):
    """Serializer for fulltext search requests through Find application"""

    q = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    page_size = serializers.IntegerField(
        required=False, min_value=1, max_value=50, default=20
    )
    page = serializers.IntegerField(required=False, min_value=1, default=1)
