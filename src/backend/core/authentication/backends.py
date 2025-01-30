"""Authentication Backends for the Impress core app."""

import logging
from functools import lru_cache

from django.conf import settings
from django.core.exceptions import SuspiciousOperation
from django.utils.translation import gettext_lazy as _

import requests
from cryptography.fernet import Fernet
from mozilla_django_oidc.auth import (
    OIDCAuthenticationBackend as MozillaOIDCAuthenticationBackend,
)
from mozilla_django_oidc.utils import import_from_settings

from core.models import DuplicateEmailError, User

logger = logging.getLogger(__name__)


@lru_cache(maxsize=0)
def get_cipher_suite():
    """Return a Fernet cipher suite."""
    key = import_from_settings("OIDC_STORE_REFRESH_TOKEN_KEY", None)
    if not key:
        raise ValueError("OIDC_STORE_REFRESH_TOKEN_KEY setting is required.")
    return Fernet(key)


def store_oidc_refresh_token(session, refresh_token):
    """Store the encrypted OIDC refresh token in the session if enabled in settings."""
    if import_from_settings("OIDC_STORE_REFRESH_TOKEN", False):
        encrypted_token = get_cipher_suite().encrypt(refresh_token.encode())
        session["oidc_refresh_token"] = encrypted_token.decode()


def get_oidc_refresh_token(session):
    """Retrieve and decrypt the OIDC refresh token from the session."""
    encrypted_token = session.get("oidc_refresh_token")
    if encrypted_token:
        return get_cipher_suite().decrypt(encrypted_token.encode()).decode()
    return None


def store_tokens(session, access_token, id_token, refresh_token):
    """Store tokens in the session if enabled in settings."""
    if import_from_settings("OIDC_STORE_ACCESS_TOKEN", False):
        session["oidc_access_token"] = access_token

    if import_from_settings("OIDC_STORE_ID_TOKEN", False):
        session["oidc_id_token"] = id_token

    store_oidc_refresh_token(session, refresh_token)


class OIDCAuthenticationBackend(MozillaOIDCAuthenticationBackend):
    """Custom OpenID Connect (OIDC) Authentication Backend.

    This class overrides the default OIDC Authentication Backend to accommodate differences
    in the User and Identity models, and handles signed and/or encrypted UserInfo response.
    """

    def __init__(self, *args, **kwargs):
        """
        Initialize the OIDC Authentication Backend.

        Adds an internal attribute to store the token_info dictionary.
        The purpose of `self._token_info` is to not duplicate code from
        the original `authenticate` method.
        This won't be needed after https://github.com/mozilla/mozilla-django-oidc/pull/377
        is merged.
        """
        super().__init__(*args, **kwargs)
        self._token_info = None

    def get_token(self, payload):
        """
        Return token object as a dictionary.

        Store the value to extract the refresh token in the `authenticate` method.
        """
        self._token_info = super().get_token(payload)
        return self._token_info

    def authenticate(self, request, **kwargs):
        """Authenticates a user based on the OIDC code flow."""
        user = super().authenticate(request, **kwargs)

        if user is not None:
            # Then the user successfully authenticated
            store_oidc_refresh_token(
                request.session, self._token_info.get("refresh_token")
            )

        return user

    def get_userinfo(self, access_token, id_token, payload):
        """Return user details dictionary.

        Parameters:
        - access_token (str): The access token.
        - id_token (str): The id token (unused).
        - payload (dict): The token payload (unused).

        Note: The id_token and payload parameters are unused in this implementation,
        but were kept to preserve base method signature.

        Note: It handles signed and/or encrypted UserInfo Response. It is required by
        Agent Connect, which follows the OIDC standard. It forces us to override the
        base method, which deal with 'application/json' response.

        Returns:
        - dict: User details dictionary obtained from the OpenID Connect user endpoint.
        """

        user_response = requests.get(
            self.OIDC_OP_USER_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
            verify=self.get_settings("OIDC_VERIFY_SSL", True),
            timeout=self.get_settings("OIDC_TIMEOUT", None),
            proxies=self.get_settings("OIDC_PROXY", None),
        )
        user_response.raise_for_status()

        try:
            userinfo = user_response.json()
        except ValueError:
            try:
                userinfo = self.verify_token(user_response.text)
            except Exception as e:
                raise SuspiciousOperation(
                    _("Invalid response format or token verification failed")
                ) from e

        return userinfo

    def verify_claims(self, claims):
        """
        Verify the presence of essential claims and the "sub" (which is mandatory as defined
        by the OIDC specification) to decide if authentication should be allowed.
        """
        essential_claims = settings.USER_OIDC_ESSENTIAL_CLAIMS
        missing_claims = [claim for claim in essential_claims if claim not in claims]

        if missing_claims:
            logger.error("Missing essential claims: %s", missing_claims)
            return False

        return True

    def get_or_create_user(self, access_token, id_token, payload):
        """Return a User based on userinfo. Create a new user if no match is found."""

        user_info = self.get_userinfo(access_token, id_token, payload)

        if not self.verify_claims(user_info):
            raise SuspiciousOperation("Claims verification failed.")

        sub = user_info["sub"]
        email = user_info.get("email")

        # Get user's full name from OIDC fields defined in settings
        full_name = self.compute_full_name(user_info)
        short_name = user_info.get(settings.USER_OIDC_FIELD_TO_SHORTNAME)

        claims = {
            "email": email,
            "full_name": full_name,
            "short_name": short_name,
        }

        try:
            user = User.objects.get_user_by_sub_or_email(sub, email)
        except DuplicateEmailError as err:
            raise SuspiciousOperation(err.message) from err

        if user:
            if not user.is_active:
                raise SuspiciousOperation(_("User account is disabled"))
            self.update_user_if_needed(user, claims)
        elif self.get_settings("OIDC_CREATE_USER", True):
            user = User.objects.create(sub=sub, password="!", **claims)  # noqa: S106

        return user

    def compute_full_name(self, user_info):
        """Compute user's full name based on OIDC fields in settings."""
        name_fields = settings.USER_OIDC_FIELDS_TO_FULLNAME
        full_name = " ".join(
            user_info[field] for field in name_fields if user_info.get(field)
        )
        return full_name or None

    def update_user_if_needed(self, user, claims):
        """Update user claims if they have changed."""
        has_changed = any(
            value and value != getattr(user, key) for key, value in claims.items()
        )
        if has_changed:
            updated_claims = {key: value for key, value in claims.items() if value}
            self.UserModel.objects.filter(id=user.id).update(**updated_claims)
