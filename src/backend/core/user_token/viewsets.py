"""API endpoints for user token management"""

from knox.models import get_token_model
from rest_framework import permissions, viewsets, mixins
from rest_framework.authentication import SessionAuthentication

from . import serializers


class UserTokenViewset(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """API ViewSet for user invitations to document.

    This view access is restricted to the session ie from frontend.

    GET /api/v1.0/user-token/
        Return list of existing tokens.

    POST /api/v1.0/user-token/
        Return newly created token.

    DELETE  /api/v1.0/user-token/<token_id>/
        Delete targeted token.
    """

    authentication_classes = [SessionAuthentication]
    pagination_class = None
    permission_classes = [permissions.IsAuthenticated]
    queryset = get_token_model().objects.all()
    serializer_class = serializers.TokenReadSerializer

    def get_queryset(self):
        """Return the queryset restricted to the logged-in user."""
        queryset = super().get_queryset()
        queryset = queryset.filter(user_id=self.request.user.pk)
        return queryset

    def get_serializer_class(self):
        if self.action == "create":
            return serializers.TokenCreateSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        """Enforce request data to use current user."""
        request.data["user"] = self.request.user.pk
        return super().create(request, *args, **kwargs)
