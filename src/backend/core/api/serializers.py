"""Client serializers for the impress core app."""

import binascii
import mimetypes
from base64 import b64decode

from django.conf import settings
from django.utils.functional import lazy
from django.utils.translation import gettext_lazy as _

import magic
from rest_framework import serializers

from core import choices, enums, models, utils
from core.services.ai_services import AI_ACTIONS
from core.services.converter_services import (
    ConversionError,
    YdocConverter,
)


class UserSerializer(serializers.ModelSerializer):
    """Serialize users."""

    class Meta:
        model = models.User
        fields = ["id", "email", "full_name", "short_name", "language"]
        read_only_fields = ["id", "email", "full_name", "short_name"]


class UserLightSerializer(UserSerializer):
    """Serialize users with limited fields."""

    class Meta:
        model = models.User
        fields = ["full_name", "short_name"]
        read_only_fields = ["full_name", "short_name"]


class TemplateAccessSerializer(serializers.ModelSerializer):
    """Serialize template accesses."""

    abilities = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.TemplateAccess
        resource_field_name = "template"
        fields = ["id", "user", "team", "role", "abilities"]
        read_only_fields = ["id", "abilities"]

    def get_abilities(self, instance) -> dict:
        """Return abilities of the logged-in user on the instance."""
        request = self.context.get("request")
        if request:
            return instance.get_abilities(request.user)
        return {}

    def update(self, instance, validated_data):
        """Make "user" field is readonly but only on update."""
        validated_data.pop("user", None)
        return super().update(instance, validated_data)


class ListDocumentSerializer(serializers.ModelSerializer):
    """Serialize documents with limited fields for display in lists."""

    is_favorite = serializers.BooleanField(read_only=True)
    nb_accesses_ancestors = serializers.IntegerField(read_only=True)
    nb_accesses_direct = serializers.IntegerField(read_only=True)
    user_role = serializers.SerializerMethodField(read_only=True)
    abilities = serializers.SerializerMethodField(read_only=True)

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


class DocumentLightSerializer(serializers.ModelSerializer):
    """Minial document serializer for nesting in document accesses."""

    class Meta:
        model = models.Document
        fields = ["id", "path", "depth"]
        read_only_fields = ["id", "path", "depth"]


class DocumentSerializer(ListDocumentSerializer):
    """Serialize documents with all fields for display in detail views."""

    content = serializers.CharField(required=False)

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
        if request and request.method == "POST":
            fields["id"].read_only = False

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
        """Return max role."""
        return choices.RoleChoices.max(
            getattr(instance, "max_ancestors_role", None),
            instance.role,
        )

    def validate(self, attrs):
        """
        Ensure the selected role is greater than or equal to the maximum role
        found in any ancestor document for the same user/team.
        """

        if self.instance:
            document = self.instance.document
            user = self.instance.user
            team = self.instance.team
        else:
            document_id = self.context["resource_id"]
            document = models.Document.objects.get(id=document_id)
            team = attrs.get("team")
            user = attrs.get("user")

        ancestors = document.get_ancestors().filter(ancestors_deleted_at__isnull=True)
        access_qs = models.DocumentAccess.objects.filter(document__in=ancestors)

        if user:
            access_qs = access_qs.filter(user=user)
        if team:
            access_qs = access_qs.filter(team=team)

        ancestor_roles = access_qs.values_list("role", flat=True)
        inherited_role = choices.RoleChoices.max(*ancestor_roles)

        role = attrs.get("role")
        get_priority = choices.RoleChoices.get_priority
        if inherited_role and get_priority(inherited_role) >= get_priority(role):
            raise serializers.ValidationError(
                {
                    "role": (
                        "Role overrides must be greater than the inherited role: "
                        f"{inherited_role}/{role}"
                    )
                }
            )

        return super().validate(attrs)

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
        required=True, validators=[models.User.sub_validator], max_length=255
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
            document_content = YdocConverter().convert_markdown(
                validated_data["content"]
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

    class Meta:
        model = models.Document
        fields = [
            "link_role",
            "link_reach",
        ]


class DocumentDuplicationSerializer(serializers.Serializer):
    """
    Serializer for duplicating a document.
    Allows specifying whether to keep access permissions.
    """

    with_accesses = serializers.BooleanField(default=False)

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


class TemplateSerializer(serializers.ModelSerializer):
    """Serialize templates."""

    abilities = serializers.SerializerMethodField(read_only=True)
    accesses = TemplateAccessSerializer(many=True, read_only=True)

    class Meta:
        model = models.Template
        fields = [
            "id",
            "title",
            "accesses",
            "abilities",
            "css",
            "code",
            "is_public",
        ]
        read_only_fields = ["id", "accesses", "abilities"]

    def get_abilities(self, document) -> dict:
        """Return abilities of the logged-in user on the instance."""
        request = self.context.get("request")
        if request:
            return document.get_abilities(request.user)
        return {}


# pylint: disable=abstract-method
class DocumentGenerationSerializer(serializers.Serializer):
    """Serializer to receive a request to generate a document on a template."""

    body = serializers.CharField(label=_("Body"))
    body_type = serializers.ChoiceField(
        choices=["html", "markdown"],
        label=_("Body type"),
        required=False,
        default="html",
    )
    format = serializers.ChoiceField(
        choices=["pdf", "docx"],
        label=_("Format"),
        required=False,
        default="pdf",
    )


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

        return attrs

    def validate_role(self, role):
        """Custom validation for the role field."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        document_id = self.context["resource_id"]

        # If the role is OWNER, check if the user has OWNER access
        if role == models.RoleChoices.OWNER:
            user_role = models.Document.objects.get(id=document_id).get_role(user)
            if user_role != models.RoleChoices.OWNER:
                raise serializers.ValidationError(
                    "Only owners of a document can invite other users as owners."
                )

        return role


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
