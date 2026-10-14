"""Authentication Backends for the Impress core app."""

import logging
import os

from django.conf import settings
from django.core.exceptions import SuspiciousOperation

from lasuite.marketing.tasks import create_or_update_contact
from lasuite.oidc_login.backends import (
    OIDCAuthenticationBackend as LaSuiteOIDCAuthenticationBackend,
)
from rest_framework.authentication import (
    SessionAuthentication as BaseSessionAuthentication,
)

from core.models import DuplicateEmailError
from core.utils.analytics import PosthogEventName, posthog_capture

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

    def get_extra_claims(self, user_info):
        """
        Return extra claims from user_info.

        Args:
          user_info (dict): The user information dictionary.

        Returns:
          dict: A dictionary of extra claims.
        """
        # The stored claims mirror the latest userinfo response: a configured
        # claim that is absent from it is stored as None, and a claim that is no
        # longer configured disappears on the user's next login. They are kept
        # verbatim and never used to identify the user, so a claim that also has
        # a dedicated field (email, full name, ...) is simply stored twice.
        claims_to_store = {
            claim: user_info.get(claim) for claim in settings.OIDC_STORE_CLAIMS
        }
        return {
            "full_name": self.compute_full_name(user_info),
            "short_name": user_info.get(settings.OIDC_USERINFO_SHORTNAME_FIELD),
            "claims": claims_to_store,
        }

    def update_user_if_needed(self, user, claims):
        """
        Update the user from the claims, also when the stored claims were emptied.

        The base implementation skips falsy values, so an empty mapping (nothing
        configured in OIDC_STORE_CLAIMS anymore) would leave the
        previously stored claims behind.
        """
        super().update_user_if_needed(user, claims)

        if claims.get("claims") == {} and user.claims:
            user.claims = {}
            user.save(update_fields=["claims"])

    def get_existing_user(self, sub, email):
        """Fetch existing user by sub or email."""

        try:
            return self.UserModel.objects.get_user_by_sub_or_email(sub, email)
        except DuplicateEmailError as err:
            raise SuspiciousOperation(err.message) from err

    def post_get_or_create_user(self, user, claims, is_new_user):
        """
        Post-processing after user creation or retrieval.

        Args:
          user (User): The user instance.
          claims (dict): The claims dictionary.
          is_new_user (bool): Indicates if the user was newly created.

        Returns:
        - None

        """

        if is_new_user and settings.SIGNUP_NEW_USER_TO_MARKETING_EMAIL:
            create_or_update_contact.delay(
                email=user.email, attributes={"DOCS_SOURCE": ["SIGNIN"]}
            )

        if user:
            posthog_capture(PosthogEventName.USER_LOGIN, user)


class SessionAuthentication(BaseSessionAuthentication):
    """
    SessionAuthentication that yields a 401 (instead of 403) for unauthenticated requests.

    DRF chooses between 401 and 403 based on whether the first authentication class returns a
    truthy `authenticate_header`. The stock `SessionAuthentication` does not implement it
    (it inherits `BaseAuthentication.authenticate_header`, which returns `None`), so anonymous
    requests get a misleading 403. Returning a value restores the correct 401, signalling that the
    client may authenticate and retry.
    """

    def authenticate_header(self, request):
        """Return a non-empty challenge so DRF responds with 401 rather than 403."""
        return "Session"
