from knox.models import get_token_model
from rest_framework import serializers


class TokenReadSerializer(serializers.ModelSerializer):
    """Serialize token for list purpose."""

    class Meta:
        model = get_token_model()
        fields = ["digest", "created", "expiry"]
        read_only_fields = ["digest", "created", "expiry"]


class TokenCreateSerializer(serializers.ModelSerializer):
    """Serialize token for creation purpose."""

    class Meta:
        model = get_token_model()
        fields = ["user", "digest", "token_key", "created", "expiry"]
        read_only_fields = ["digest", "token_key", "created", "expiry"]
        extra_kwargs = {"user": {"write_only": True}}

    def create(self, validated_data):
        """The default knox token create manager returns a tuple."""
        instance, token = super().create(validated_data)
        instance.token_key = token  # warning do not save this
        return instance
