"""Admin classes and registrations for core app."""

from django.contrib import admin, messages
from django.contrib.auth import admin as auth_admin
from django.shortcuts import redirect
from django.utils.translation import gettext_lazy as _

from treebeard.admin import TreeAdmin

from core import models
from core.tasks.user_reconciliation import user_reconciliation_csv_import_job


class TemplateAccessInline(admin.TabularInline):
    """Inline admin class for template accesses."""

    autocomplete_fields = ["user"]
    model = models.TemplateAccess
    extra = 0


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
    inlines = (TemplateAccessInline,)
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


@admin.register(models.UserReconciliationCsvImport)
class UserReconciliationCsvImportAdmin(admin.ModelAdmin):
    """Admin class for UserReconciliationCsvImport model."""

    list_display = ("id", "created_at", "status")

    def save_model(self, request, obj, form, change):
        """Override save_model to trigger the import task on creation."""
        super().save_model(request, obj, form, change)

        if not change:
            user_reconciliation_csv_import_job.delay(obj.pk)
            messages.success(request, _("Import job created and queued."))
        return redirect("..")


@admin.action(description=_("Process selected user reconciliations"))
def process_reconciliation(_modeladmin, _request, queryset):
    """
    Admin action to process selected user reconciliations.
    The action will process only entries that are ready and have both emails checked.

    Its action is threefold:
    - Transfer document accesses from inactive to active user, updating roles as needed.
    - Activate the active user and deactivate the inactive user.
    """
    processable_entries = queryset.filter(
        status="ready", active_email_checked=True, inactive_email_checked=True
    )

    # Prepare the bulk operations
    updated_documentaccess = []
    removed_documentaccess = []
    update_users_active_status = []

    for entry in processable_entries:
        new_updated_documentaccess, new_removed_documentaccess = (
            entry.process_documentaccess_reconciliation()
        )
        updated_documentaccess += new_updated_documentaccess
        removed_documentaccess += new_removed_documentaccess

        entry.active_user.is_active = True
        entry.inactive_user.is_active = False
        update_users_active_status.append(entry.active_user)
        update_users_active_status.append(entry.inactive_user)

    # Actually perform the bulk operations
    models.DocumentAccess.objects.bulk_update(updated_documentaccess, ["user", "role"])

    if removed_documentaccess:
        ids_to_delete = [rd.id for rd in removed_documentaccess]
        models.DocumentAccess.objects.filter(id__in=ids_to_delete).delete()

    models.User.objects.bulk_update(update_users_active_status, ["is_active"])


@admin.register(models.UserReconciliation)
class UserReconciliationAdmin(admin.ModelAdmin):
    """Admin class for UserReconciliation model."""

    list_display = ["id", "created_at", "status"]
    actions = [process_reconciliation]


@admin.register(models.Template)
class TemplateAdmin(admin.ModelAdmin):
    """Template admin interface declaration."""

    inlines = (TemplateAccessInline,)


class DocumentAccessInline(admin.TabularInline):
    """Inline admin class for template accesses."""

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
