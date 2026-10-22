"""Admin classes and registrations for core app."""

from functools import partial

from django import forms
from django.conf import settings
from django.contrib import admin, messages
from django.contrib.admin import helpers
from django.contrib.admin.widgets import AutocompleteSelect
from django.contrib.auth import admin as auth_admin
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.db.models.functions import Coalesce, Lower
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.utils.text import format_lazy
from django.utils.translation import gettext_lazy as _

from treebeard.admin import TreeAdmin

from core import models
from core.tasks.user_reconciliation import user_reconciliation_csv_import_job

admin.site.site_header = format_lazy("{} {}", admin.site.site_header, settings.RELEASE)


class DuplicateEmailFilter(admin.SimpleListFilter):
    """Filter the users whose email is shared with another user, case ignored."""

    title = _("duplicate email")
    parameter_name = "duplicate_email"

    def lookups(self, request, model_admin):
        """Return the filter options."""
        return [("yes", _("Yes"))]

    def queryset(self, request, queryset):
        """Keep the users sharing their email with another user."""
        if self.value() != "yes":
            return queryset
        others = models.User.objects.filter(email__iexact=OuterRef("email")).exclude(
            pk=OuterRef("pk")
        )
        return queryset.filter(Exists(others))


class MergeUsersForm(forms.Form):
    """Form choosing the user the selected users are merged into."""

    user = forms.ModelChoiceField(
        label=_("merge into"),
        queryset=models.User.objects.filter(is_active=True),
        widget=AutocompleteSelect(
            models.UserReconciliation._meta.get_field("active_user"),  # noqa: SLF001
            admin.site,
        ),
    )


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
        (
            _("Important dates"),
            {"fields": ("created_at", "updated_at", "last_login")},
        ),
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
        "last_login",
        "updated_at",
    )
    list_filter = (
        "is_staff",
        "is_superuser",
        "is_device",
        "is_active",
        DuplicateEmailFilter,
    )
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
        "last_login",
    )
    search_fields = ("id", "sub", "admin_email", "email", "full_name")
    actions = ["permanently_delete_users", "merge_users", "deactivate_duplicates"]

    def __init__(self, model, admin_site):
        """
        Disable delete_selected action.
        Only the `permanently_delete_users` should be used to delete a user.
        """
        super().__init__(model, admin_site)

        self.admin_site.disable_action("delete_selected")

    def get_ordering(self, request):
        """Group the users sharing an email when filtering on duplicates."""
        if DuplicateEmailFilter.parameter_name in request.GET:
            return (Lower("email"), "created_at")
        return super().get_ordering(request)

    def has_delete_permission(self, request, obj=None):
        """
        Force delete permission to False to remove the delete button.
        Only the `permanently_delete_users` should be used to delete a user.
        """
        return False

    @admin.action(description=_("Permanently delete selected users"))
    def permanently_delete_users(self, request, queryset):
        """Permanently delete users present in the queryset."""
        self.log_deletions(request, queryset)
        for user in queryset:
            user.delete()

    @admin.action(description=_("Merge into another user"))
    def merge_users(self, request, queryset):
        """Merge the selected users into the chosen user, then deactivate them."""
        form = MergeUsersForm(request.POST if "apply" in request.POST else None)
        if not form.is_valid():
            return TemplateResponse(
                request,
                "core/admin/merge_users.html",
                {
                    **self.admin_site.each_context(request),
                    "title": _("Merge users"),
                    "form": form,
                    "users": queryset,
                    "action_checkbox_name": helpers.ACTION_CHECKBOX_NAME,
                },
            )

        target = form.cleaned_data["user"]
        merged = queryset.exclude(pk=target.pk)
        if not target.email or any(not user.email for user in merged):
            self.message_user(
                request, _("Users without email cannot be merged."), messages.ERROR
            )
            return None
        with transaction.atomic():
            for user in merged:
                # Created ready with both users set, so its save does not look them
                # up by email
                models.UserReconciliation.objects.create(
                    active_email=target.email,
                    inactive_email=user.email,
                    active_user=target,
                    inactive_user=user,
                    active_email_checked=True,
                    inactive_email_checked=True,
                    status="ready",
                ).process_reconciliation_request()
        self.message_user(request, f"{len(merged)} users merged into {target}.")
        return None

    @admin.action(description=_("Deactivate the least recently used duplicates"))
    def deactivate_duplicates(self, request, queryset):
        """Keep the most recently used user of each shared email, deactivate the others."""
        kept = {}
        deactivated = []
        # An active user first: keeping an inactive one would leave nobody to log in
        for user in queryset.order_by(
            "-is_active", Coalesce("last_login", "created_at").desc()
        ):
            if not user.email:
                continue
            if kept.setdefault(user.email.lower(), user) is not user:
                deactivated.append(user.pk)
        models.User.objects.filter(pk__in=deactivated).update(is_active=False)
        self.message_user(request, f"{len(deactivated)} users deactivated.")


@admin.register(models.UserReconciliationCsvImport)
class UserReconciliationCsvImportAdmin(admin.ModelAdmin):
    """Admin class for UserReconciliationCsvImport model."""

    list_display = ("id", "__str__", "created_at", "status")

    def save_model(self, request, obj, form, change):
        """Override save_model to trigger the import task on creation."""
        super().save_model(request, obj, form, change)

        if not change:
            transaction.on_commit(
                partial(user_reconciliation_csv_import_job.delay, obj.pk)
            )
            messages.success(request, _("Import job created and queued."))
        return redirect("..")


@admin.action(description=_("Process selected user reconciliations"))
def process_reconciliation(_modeladmin, _request, queryset):
    """
    Admin action to process selected user reconciliations.
    The action will process only entries that are ready and have both emails checked.
    """
    processable_entries = queryset.filter(
        status="ready", active_email_checked=True, inactive_email_checked=True
    )

    for entry in processable_entries:
        entry.process_reconciliation_request()


@admin.register(models.UserReconciliation)
class UserReconciliationAdmin(admin.ModelAdmin):
    """Admin class for UserReconciliation model."""

    list_display = ["id", "__str__", "created_at", "status"]
    actions = [process_reconciliation]


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
