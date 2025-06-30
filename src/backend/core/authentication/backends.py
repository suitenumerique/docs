"""Authentication Backends for the Impress core app."""

import logging
import os
import time

from django.conf import settings
from django.core.exceptions import SuspiciousOperation

from lasuite.oidc_login.backends import (
    OIDCAuthenticationBackend as LaSuiteOIDCAuthenticationBackend,
)

from core.models import DuplicateEmailError

logger = logging.getLogger(__name__)

# Settings renamed warnings
if os.environ.get("USER_OIDC_FIELDS_TO_FULLNAME"):
    logger.warning(
        "USER_OIDC_FIELDS_TO_FULLNAME has been renamed to "
        "OIDC_USERINFO_FULLNAME_FIELDS please update your settings."
    )

if os.environ.get("USER_OIDC_FIELD_TO_SHORTNAME"):
    logger.warning(
        "USER_OIDC_FIELD_TO_SHORTNAME has been renamed to "
        "OIDC_USERINFO_SHORTNAME_FIELD please update your settings."
    )


class OIDCAuthenticationBackend(LaSuiteOIDCAuthenticationBackend):
    """Custom OpenID Connect (OIDC) Authentication Backend.

    This class overrides the default OIDC Authentication Backend to accommodate differences
    in the User and Identity models, and handles signed and/or encrypted UserInfo response.
    """

    def store_tokens(self, access_token, id_token):
        """
        Extends base method to stores a oidc_token_expiration field in the session
        which is used with OIDCRefreshSessionMiddleware, which performs a refresh
        token request if oidc_token_expiration expires.
        """
        session = self.request.session
        token_expiration_delay = self.get_settings("OIDC_TOKEN_EXPIRATION", 60 * 15)
        session["oidc_token_expiration"] = time.time() + token_expiration_delay

        super().store_tokens(access_token, id_token)

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
            "short_name": user_info.get(settings.OIDC_USERINFO_SHORTNAME_FIELD),
        }

    def get_existing_user(self, sub, email):
        """Fetch existing user by sub or email."""

        try:
            return self.UserModel.objects.get_user_by_sub_or_email(sub, email)
        except DuplicateEmailError as err:
            raise SuspiciousOperation(err.message) from err
