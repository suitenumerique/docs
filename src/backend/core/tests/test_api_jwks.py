"""
Tests for the JWKS endpoint publishing the public key of the tokens we issue.
"""

from django.urls import resolve

import jwt
import pytest
from rest_framework.test import APIClient

from core.services.jwt_services import JWTService
from core.tests.utils.jwt_helper import generate_key_pair
from core.tests.utils.urls import reload_urls

pytestmark = pytest.mark.django_db

# Private members of a RSA JWK, none of them may ever leak in the JWKS
PRIVATE_JWK_MEMBERS = {"d", "p", "q", "dp", "dq", "qi", "oth"}

# Generating RSA keys is expensive, do it once for the whole module
PRIVATE_KEY, _ = generate_key_pair()
OTHER_PRIVATE_KEY, _ = generate_key_pair()


@pytest.fixture(name="jwt_settings")
def jwt_settings_fixture(settings):
    """Setup valid settings for the JWT service."""
    settings.JWT_PRIVATE_KEY = PRIVATE_KEY
    settings.JWT_TOKEN_LIFETIME = 3600
    return settings


@pytest.mark.usefixtures("jwt_settings")
def test_api_jwks_is_public():
    """External services must reach the JWKS without authenticating."""
    response = APIClient().get("/api/v1.0/jwks")

    assert response.status_code == 200
    assert len(response.json()["keys"]) == 1


@pytest.mark.usefixtures("jwt_settings")
def test_api_jwks_publishes_a_signature_key():
    """The published key advertises what it is meant to be used for."""
    key = APIClient().get("/api/v1.0/jwks").json()["keys"][0]

    assert key["kty"] == "RSA"
    assert key["alg"] == "RS256"
    assert key["use"] == "sig"
    assert key["kid"]


@pytest.mark.usefixtures("jwt_settings")
def test_api_jwks_never_exposes_the_private_key():
    """🔒 The JWKS exposes the public components of the key, and nothing else."""
    key = APIClient().get("/api/v1.0/jwks").json()["keys"][0]

    assert PRIVATE_JWK_MEMBERS & set(key) == set()
    assert set(key) == {"kty", "alg", "use", "kid", "n", "e"}


@pytest.mark.usefixtures("jwt_settings")
def test_api_jwks_key_validates_the_tokens_we_issue():
    """
    The whole point of the endpoint: a service fetching the JWKS can validate
    a token we issued, the way an external service does.
    """
    token = JWTService().get_token({"sub": "user-id", "scope": "read"})

    jwks = APIClient().get("/api/v1.0/jwks").json()

    # This is what an external service does with the JWKS we serve
    key = jwt.PyJWKSet.from_dict(jwks).keys[0]
    payload = jwt.decode(token, key, algorithms=["RS256"])

    assert payload["sub"] == "user-id"
    assert payload["scope"] == "read"


@pytest.mark.usefixtures("jwt_settings")
def test_api_jwks_key_id_matches_the_token_header():
    """A consumer selects the right key by matching the "kid" of the token."""
    token = JWTService().get_token({"sub": "user-id"})

    jwks = APIClient().get("/api/v1.0/jwks").json()

    kid = jwt.get_unverified_header(token)["kid"]
    assert [key["kid"] for key in jwks["keys"]] == [kid]


def test_api_jwks_follows_the_key_rotation(jwt_settings):
    """After a rotation, the JWKS validates the tokens signed with the new key."""
    first_jwks = APIClient().get("/api/v1.0/jwks").json()

    jwt_settings.JWT_PRIVATE_KEY = OTHER_PRIVATE_KEY
    token = JWTService().get_token({"sub": "user-id"})
    second_jwks = APIClient().get("/api/v1.0/jwks").json()

    assert first_jwks != second_jwks

    key = jwt.PyJWKSet.from_dict(second_jwks).keys[0]
    assert jwt.decode(token, key, algorithms=["RS256"])["sub"] == "user-id"

    # The retired key can no longer validate the new tokens
    with pytest.raises(jwt.InvalidSignatureError):
        jwt.decode(
            token, jwt.PyJWKSet.from_dict(first_jwks).keys[0], algorithms=["RS256"]
        )


@pytest.mark.parametrize("private_key", [None, ""])
def test_api_jwks_without_private_key(jwt_settings, private_key):
    """Without a configured key there is nothing to publish."""
    jwt_settings.JWT_PRIVATE_KEY = private_key

    assert APIClient().get("/api/v1.0/jwks").status_code == 404


def test_api_jwks_with_an_invalid_private_key(jwt_settings):
    """An unusable key is reported as a missing JWKS, not as a server error."""
    jwt_settings.JWT_PRIVATE_KEY = "not-a-pem-key"

    assert APIClient().get("/api/v1.0/jwks").status_code == 404


@pytest.mark.usefixtures("jwt_settings", "resource_server_backend_conf")
def test_api_jwks_does_not_shadow_the_resource_server_jwks(settings):
    """
    The resource server publishes its own JWKS, holding its encryption key.
    Both must stay reachable, on their own path.
    """
    settings.OIDC_RS_PRIVATE_KEY_STR = PRIVATE_KEY
    reload_urls()

    assert resolve("/api/v1.0/jwks").url_name == "jwks"
    assert resolve("/external_api/v1.0/jwks").url_name == "resource_server_jwks"

    ours = APIClient().get("/api/v1.0/jwks").json()["keys"][0]
    theirs = APIClient().get("/external_api/v1.0/jwks").json()["keys"][0]

    assert ours["use"] == "sig"
    assert theirs["use"] == "enc"


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
@pytest.mark.usefixtures("jwt_settings")
def test_api_jwks_is_read_only(method):
    """The JWKS is only exposed for reading."""
    response = getattr(APIClient(), method)("/api/v1.0/jwks")

    assert response.status_code == 405
