"""Admin classes and registrations for core app."""

from django.contrib import admin
from django.contrib.auth import admin as auth_admin
from django.utils.translation import gettext_lazy as _

from treebeard.admin import TreeAdmin

from . import models


@admin.register(models.User)
class UserAdmin(auth_admin.UserAdmin):
    """Admin class for the User model"""

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "admin_email",
                    "password",
                )
            },
        ),
        (
            _("Personal info"),
            {
                "fields": (
                    "sub",
                    "email",
                    "full_name",
                    "short_name",
                    "language",
                    "timezone",
                )
            },
        ),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_device",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (_("Important dates"), {"fields": ("created_at", "updated_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2"),
            },
        ),
    )
    list_display = (
        "id",
        "sub",
        "full_name",
        "admin_email",
        "email",
        "is_active",
        "is_staff",
        "is_superuser",
        "is_device",
        "created_at",
        "updated_at",
    )
    list_filter = ("is_staff", "is_superuser", "is_device", "is_active")
    ordering = (
        "is_active",
        "-is_superuser",
        "-is_staff",
        "-is_device",
        "-updated_at",
        "full_name",
    )
    readonly_fields = (
        "id",
        "sub",
        "email",
        "full_name",
        "short_name",
        "created_at",
        "updated_at",
    )
    search_fields = ("id", "sub", "admin_email", "email", "full_name")


class DocumentAccessInline(admin.TabularInline):
    """Inline admin class for document accesses."""

    autocomplete_fields = ["user"]
    model = models.DocumentAccess
    extra = 0


@admin.register(models.Document)
class DocumentAdmin(TreeAdmin):
    """Document admin interface declaration."""

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "title",
                )
            },
        ),
        (
            _("Permissions"),
            {
                "fields": (
                    "creator",
                    "link_reach",
                    "link_role",
                )
            },
        ),
        (
            _("Tree structure"),
            {
                "fields": (
                    "path",
                    "depth",
                    "numchild",
                    "duplicated_from",
                    "attachments",
                )
            },
        ),
    )
    inlines = (DocumentAccessInline,)
    list_display = (
        "id",
        "title",
        "link_reach",
        "link_role",
        "created_at",
        "updated_at",
    )
    readonly_fields = (
        "attachments",
        "creator",
        "depth",
        "duplicated_from",
        "id",
        "numchild",
        "path",
    )
    search_fields = ("id", "title")


@admin.register(models.Invitation)
class InvitationAdmin(admin.ModelAdmin):
    """Admin interface to handle invitations."""

    fields = (
        "email",
        "document",
        "role",
        "created_at",
        "issuer",
    )
    readonly_fields = (
        "created_at",
        "is_expired",
        "issuer",
    )
    list_display = (
        "email",
        "document",
        "created_at",
        "is_expired",
    )

    def save_model(self, request, obj, form, change):
        obj.issuer = request.user
        obj.save()
