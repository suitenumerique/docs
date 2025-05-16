"""Permission handlers for the impress core app."""

from django.core import exceptions
from django.db.models import Q
from django.http import Http404

from rest_framework import permissions

from core.models import DocumentAccess, RoleChoices, get_trashbin_cutoff

ACTION_FOR_METHOD_TO_PERMISSION = {
    "versions_detail": {"DELETE": "versions_destroy", "GET": "versions_retrieve"},
    "children": {"GET": "children_list", "POST": "children_create"},
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


class CanCreateInvitationPermission(permissions.BasePermission):
    """
    Custom permission class to handle permission checks for managing invitations.
    """

    def has_permission(self, request, view):
        user = request.user

        # Ensure the user is authenticated
        if not (bool(request.auth) or request.user.is_authenticated):
            return False

        # Apply permission checks only for creation (POST requests)
        if view.action != "create":
            return True

        # Check if resource_id is passed in the context
        try:
            document_id = view.kwargs["resource_id"]
        except KeyError as exc:
            raise exceptions.ValidationError(
                "You must set a document ID in kwargs to manage document invitations."
            ) from exc

        # Check if the user has access to manage invitations (Owner/Admin roles)
        return DocumentAccess.objects.filter(
            Q(user=user) | Q(team__in=user.teams),
            document=document_id,
            role__in=[RoleChoices.OWNER, RoleChoices.ADMIN],
        ).exists()


class AccessPermission(permissions.BasePermission):
    """Permission class for access objects."""

    def has_permission(self, request, view):
        return request.user.is_authenticated or view.action != "create"

    def has_object_permission(self, request, view, obj):
        """Check permission for a given object."""
        abilities = obj.get_abilities(request.user)
        action = view.action
        try:
            action = ACTION_FOR_METHOD_TO_PERMISSION[view.action][request.method]
        except KeyError:
            pass
        return abilities.get(action, False)


class DocumentAccessPermission(AccessPermission):
    """Subclass to handle soft deletion specificities."""

    def has_object_permission(self, request, view, obj):
        """
        Return a 404 on deleted documents
        - for which the trashbin cutoff is past
        - for which the current user is not owner of the document or one of its ancestors
        """
        if (
            deleted_at := obj.ancestors_deleted_at
        ) and deleted_at < get_trashbin_cutoff():
            raise Http404

        # Compute permission first to ensure the "user_roles" attribute is set
        has_permission = super().has_object_permission(request, view, obj)

        if obj.ancestors_deleted_at and not RoleChoices.OWNER in obj.user_roles:
            raise Http404

        return has_permission


class CanManageAccessPermission(permissions.BasePermission):
    """
    Permission class to check access rights specific to writing (create/update)
    """

    def has_permission(self, request, view):
        user = request.user

        if not (bool(request.auth) or user.is_authenticated):
            return False

        if view.action == "create":
            try:
                resource_id = view.kwargs["resource_id"]
            except KeyError as exc:
                raise exceptions.ValidationError(
                    f"You must set a resource ID in kwargs to create a new access."
                ) from exc

            if not view.queryset.model.objects.filter(  # pylint: disable=no-member
                Q(user=user) | Q(team__in=user.teams),
                role__in=[RoleChoices.OWNER, RoleChoices.ADMIN],  # pylint: disable=no-member
                **{view.resource_field_name: resource_id},
            ).exists():
                raise exceptions.PermissionDenied(
                    "You are not allowed to manage accesses for this resource."
                )

            role = request.data.get("role")
            if (
                role == RoleChoices.OWNER
                and not view.queryset.model.objects.filter(
                    Q(user=user) | Q(team__in=user.teams),
                    **{view.resource_field_name: resource_id},
                    role=RoleChoices.OWNER,
                ).exists()
            ):
                raise exceptions.PermissionDenied(
                    "Only owners of a resource can assign other users as owners."
                )
        return True

    def has_object_permission(self, request, view, obj):
        if view.action in ["update", "partial_update"]:
            role = request.data.get("role")
            can_set_role_to = obj.get_abilities(request.user).get("set_role_to", [])
            if role and role not in can_set_role_to:
                message = (
                    f"You are only allowed to set role to {', '.join(can_set_role_to)}"
                    if can_set_role_to
                    else f"You are not allowed to set this role for this {getattr(view, 'resource_field_name', 'resource')}."
                )
                raise exceptions.PermissionDenied(message)
        return True
