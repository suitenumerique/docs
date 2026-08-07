"""Utils for testing JWT-signed tokens."""

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from joserfc.jwk import KeySet, RSAKey


def generate_key_pair():
    """Generate a PEM encoded RSA key pair to sign and verify test tokens."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_pem = (
        private_key.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode("utf-8")
    )
    return private_pem, public_pem


def key_id(public_pem):
    """
    Return the "kid" naming a key, the way every service here names its own.

    It is the RFC 7638 thumbprint of the key, computed from its public
    components: the signer stamps it in the header of its tokens and publishes
    it in its JWKS, which is how the two are matched.
    """
    return RSAKey.import_key(public_pem).thumbprint()


def build_jwks(public_pem):
    """Build the JWKS a service publishes for a PEM encoded RSA public key."""
    key = RSAKey.import_key(
        public_pem,
        parameters={"alg": "RS256", "use": "sig", "kid": key_id(public_pem)},
    )

    return KeySet([key]).as_dict(private=False)
