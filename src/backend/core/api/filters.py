"""API filters for Impress' core application."""

import unicodedata

from django.utils.translation import gettext_lazy as _

import django_filters

from core import models


def remove_accents(value):
    """Remove accents from a string (vélo -> velo)."""
    return "".join(
        c
        for c in unicodedata.normalize("NFD", value)
        if unicodedata.category(c) != "Mn"
    )


class AccentInsensitiveCharFilter(django_filters.CharFilter):
    """
    A custom CharFilter that filters on the accent-insensitive value searched.
    """

    def filter(self, qs, value):
        """
        Apply the filter to the queryset using the unaccented version of the field.

        Args:
            qs: The queryset to filter.
            value: The value to search for in the unaccented field.
        Returns:
            A filtered queryset.
        """
        if value:
            value = remove_accents(value)
        return super().filter(qs, value)


class DocumentFilter(django_filters.FilterSet):
    """
    Custom filter for filtering documents on title (accent and case insensitive).
    """

    title = AccentInsensitiveCharFilter(
        field_name="title", lookup_expr="unaccent__icontains", label=_("Title")
    )

    class Meta:
        model = models.Document
        fields = ["title"]


class ListDocumentFilter(DocumentFilter):
    """
    Custom filter for filtering documents.
    """

    is_creator_me = django_filters.BooleanFilter(
        method="filter_is_creator_me", label=_("Creator is me")
    )
    is_masked = django_filters.BooleanFilter(
        method="filter_is_masked", label=_("Masked")
    )
    is_favorite = django_filters.BooleanFilter(
        method="filter_is_favorite", label=_("Favorite")
    )

    class Meta:
        model = models.Document
        fields = ["is_creator_me", "is_favorite", "title"]

    # pylint: disable=unused-argument
    def filter_is_creator_me(self, queryset, name, value):
        """
        Filter documents based on the `creator` being the current user.

        Example:
            - /api/v1.0/documents/?is_creator_me=true
                → Filters documents created by the logged-in user
            - /api/v1.0/documents/?is_creator_me=false
                → Filters documents created by other users
        """
        user = self.request.user

        if not user.is_authenticated:
            return queryset

        if value:
            return queryset.filter(creator=user)

        return queryset.exclude(creator=user)

    # pylint: disable=unused-argument
    def filter_is_favorite(self, queryset, name, value):
        """
        Filter documents based on whether they are marked as favorite by the current user.

        Example:
            - /api/v1.0/documents/?is_favorite=true
                → Filters documents marked as favorite by the logged-in user
            - /api/v1.0/documents/?is_favorite=false
                → Filters documents not marked as favorite by the logged-in user
        """
        user = self.request.user

        if not user.is_authenticated:
            return queryset

        return queryset.filter(is_favorite=bool(value))

    # pylint: disable=unused-argument
    def filter_is_masked(self, queryset, name, value):
        """
        Filter documents based on whether they are masked by the current user.

        Example:
            - /api/v1.0/documents/?is_masked=true
                → Filters documents marked as masked by the logged-in user
            - /api/v1.0/documents/?is_masked=false
                → Filters documents not marked as masked by the logged-in user
        """
        user = self.request.user

        if not user.is_authenticated:
            return queryset

        queryset_method = queryset.filter if bool(value) else queryset.exclude
        return queryset_method(link_traces__user=user, link_traces__is_masked=True)
