"""Permission handlers for the impress core app."""

from django.core import exceptions
from django.db.models import Q
from django.http import Http404

from rest_framework import permissions

from core import choices
from core.models import RoleChoices, get_trashbin_cutoff  # noqa: F401

ACTION_FOR_METHOD_TO_PERMISSION = {
    "versions_detail": {"DELETE": "versions_destroy", "GET": "versions_retrieve"},
    "children": {"GET": "children_list", "POST": "children_create"},
    "content": {"PATCH": "content_patch", "GET": "content_retrieve"},
}


class IsAuthenticated(permissions.BasePermission):
    """
    Allows access only to authenticated users. Alternative method checking the presence
    of the auth token to avoid hitting the database.
    """

    def has_permission(self, request, view):
        return bool(request.auth) or request.user.is_authenticated


class IsAuthenticatedOrSafe(IsAuthenticated):
    """Allows access to authenticated users (or anonymous users but only on safe methods)."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return super().has_permission(request, view)


class IsSelf(IsAuthenticated):
    """
    Allows access only to authenticated users. Alternative method checking the presence
    of the auth token to avoid hitting the database.
    """

    def has_object_permission(self, request, view, obj):
        """Write permissions are only allowed to the user itself."""
        return obj == request.user


class IsOwnedOrPublic(IsAuthenticated):
    """
    Allows access to authenticated users only for objects that are owned or not related
    to any user via the "owner" field.
    """

    def has_object_permission(self, request, view, obj):
        """Unsafe permissions are only allowed for the owner of the object."""
        if obj.owner == request.user:
            return True

        if request.method in permissions.SAFE_METHODS and obj.owner is None:
            return True

        try:
            return obj.user == request.user
        except exceptions.ObjectDoesNotExist:
            return False


# POC-DRIVE-SHARING: disabled until Drive implements AskForAccess — do not delete
# class CanCreateInvitationPermission(permissions.BasePermission):
#     """
#     Custom permission class to handle permission checks for managing invitations.
#     """
#
#     def has_permission(self, request, view):
#         user = request.user
#
#         # Ensure the user is authenticated
#         if not (bool(request.auth) or request.user.is_authenticated):
#             return False
#
#         # Apply permission checks only for creation (POST requests)
#         if view.action != "create":
#             return True
#
#         # Check if resource_id is passed in the context
#         try:
#             document_id = view.kwargs["resource_id"]
#         except KeyError as exc:
#             raise exceptions.ValidationError(
#                 "You must set a document ID in kwargs to manage document invitations."
#             ) from exc
#
#         # Check if the user has access to manage invitations (Owner/Admin roles)
#         return DocumentAccess.objects.filter(
#             Q(user=user) | Q(team__in=user.teams),
#             document=document_id,
#             role__in=[RoleChoices.OWNER, RoleChoices.ADMIN],
#         ).exists()
#
#
# POC-DRIVE-SHARING: disabled until Drive implements AskForAccess — do not delete
# class ResourceWithAccessPermission(permissions.BasePermission):
#     """A permission class for invitations."""
#
#     def has_permission(self, request, view):
#         """check create permission."""
#         return request.user.is_authenticated or view.action != "create"
#
#     def has_object_permission(self, request, view, obj):
#         """Check permission for a given object."""
#         abilities = obj.get_abilities(request.user)
#         action = view.action
#         return abilities.get(action, False)


class DriveDelegatedPermission(permissions.BasePermission):
    """
    Delegate document permissions to Drive: abilities are computed from the
    Drive item mirroring the document, fetched server-to-server on behalf of
    the current user.
    """

    def has_permission(self, request, view):
        """
        Let anonymous users through: link reach is owned by Drive, so the
        Drive-derived abilities (all False unless the item is public) are the
        actual gate, applied in has_object_permission. List-level actions are
        safe: DB-backed lists return nothing for anonymous users and Drive
        proxy calls fail closed with a 401/403 from Drive.
        """
        return True

    def has_object_permission(self, request, view, obj):
        """Check the action against Drive-derived abilities."""
        # Import here to avoid a circular import through core.api.serializers
        from core.services import drive_client  # pylint: disable=import-outside-toplevel

        try:
            item = drive_client.get_item(obj.id, request.user)
        except drive_client.DriveClientError as exc:
            if exc.status_code in (403, 404):
                return False
            drive_client.raise_as_drf(exc)

        # The document is a wrapper around the Drive item: hydrate it so
        # abilities and link data flow from the instance everywhere downstream.
        obj.drive_item = item
        abilities = drive_client.map_drive_abilities(item.get("abilities"))

        action = view.action
        try:
            action = ACTION_FOR_METHOD_TO_PERMISSION[view.action][request.method]
        except KeyError:
            pass

        return abilities.get(action, False)


# POC-DRIVE-SHARING: disabled until Drive implements AskForAccess — do not delete
# class ResourceAccessPermission(IsAuthenticated):
#     """Permission class for document access objects."""
#
#     def has_permission(self, request, view):
#         """check create permission for accesses in documents tree."""
#         if super().has_permission(request, view) is False:
#             return False
#
#         if view.action == "create":
#             role = getattr(view, view.resource_field_name).get_role(request.user)
#             if role not in choices.PRIVILEGED_ROLES:
#                 raise exceptions.PermissionDenied(
#                     "You are not allowed to manage accesses for this resource."
#                 )
#
#         return True
#
#     def has_object_permission(self, request, view, obj):
#         """Check permission for a given object."""
#         abilities = obj.get_abilities(request.user)
#
#         requested_role = request.data.get("role")
#         if requested_role and requested_role not in abilities.get("set_role_to", []):
#             return False
#
#         action = view.action
#         return abilities.get(action, False)


class CommentPermission(permissions.BasePermission):
    """
    Permission class for comments. Abilities are delegated to Drive, which
    owns document sharing.
    """

    def has_permission(self, request, view):
        """Check permission for a given object."""
        if view.action in ["create", "list"]:
            # Import here to avoid a circular import through core.api.serializers
            from core.services import (  # pylint: disable=import-outside-toplevel
                drive_client,
            )

            document = view.get_document_or_404()
            abilities, _role = drive_client.get_doc_context(document.id, request.user)
            return abilities["comment"]

        return True

    def has_object_permission(self, request, view, obj):
        """Check permission for a given object."""
        return obj.get_abilities(request.user).get(view.action, False)
