"""Authentication Backends for the Impress core app."""

import logging

from django.conf import settings

from lasuite.oidc.backends import (
    OIDCAuthenticationBackend as LaSuiteOIDCAuthenticationBackend,
)

logger = logging.getLogger(__name__)


class OIDCAuthenticationBackend(LaSuiteOIDCAuthenticationBackend):
    """Custom OpenID Connect (OIDC) Authentication Backend.

    This class overrides the default OIDC Authentication Backend to accommodate differences
    in the User and Identity models, and handles signed and/or encrypted UserInfo response.
    """

    def get_extra_claims(self, user_info):
        """
        Return extra claims from user_info.

        Args:
          user_info (dict): The user information dictionary.

        Returns:
          dict: A dictionary of extra claims.
        """
        return {
            "full_name": self.compute_full_name(user_info),
            "short_name": user_info.get(settings.USER_OIDC_FIELD_TO_SHORTNAME),
        }

    def compute_full_name(self, user_info):
        """
        Compute user's full name based on OIDC fields in settings.
        """
        name_fields = settings.USER_OIDC_FIELDS_TO_FULLNAME
        full_name = " ".join(
            user_info[field] for field in name_fields if user_info.get(field)
        )
        return full_name or None
