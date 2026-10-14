"""Clear the OIDC claims stored on users."""

from logging import getLogger

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.core.management.base import BaseCommand
from django.db.models import F, Func, JSONField, TextField, Value
from django.db.models.functions import Cast
from django.utils import timezone

from core.models import User

logger = getLogger(__name__)


class Command(BaseCommand):
    """
    Remove the OIDC claims stored on users, either all of them or only the given ones.

    Claims that are removed from OIDC_STORE_CLAIMS are only dropped on
    each user's next login, so inactive users keep them until this command runs.
    A claim that is still listed in the setting is stored again on the next
    login, so remove it from the setting first for a lasting purge.

    The claims are removed from the current database value in a single UPDATE,
    so a login happening meanwhile is never overwritten with stale values.
    updated_at is set explicitly because update() bypasses auto_now.
    """

    help = "Clear the OIDC claims stored on users"

    def add_arguments(self, parser):
        parser.add_argument(
            "--claim",
            action="append",
            dest="claims",
            help="Claim to remove (repeatable). Without it, all stored claims are cleared.",
        )

    def handle(self, *args, **options):
        claims = options["claims"]

        # A claim that is still configured is stored again on the next login.
        still_configured = sorted(
            set(settings.OIDC_STORE_CLAIMS).intersection(
                claims or settings.OIDC_STORE_CLAIMS
            )
        )
        if still_configured:
            warning = (
                f"{', '.join(still_configured)} still listed in OIDC_STORE_CLAIMS: "
                "it will be stored again on the next login"
            )
            logger.warning(warning)
            self.stderr.write(self.style.WARNING(warning))

        if claims:
            updated = User.objects.filter(claims__has_any_keys=claims).update(
                updated_at=timezone.now(),
                claims=Func(
                    F("claims"),
                    Cast(Value(claims), ArrayField(TextField())),
                    template="%(expressions)s",
                    arg_joiner=" - ",
                    output_field=JSONField(),
                ),
            )
        else:
            updated = User.objects.exclude(claims={}).update(
                claims={}, updated_at=timezone.now()
            )

        message = f"Cleared stored claims for {updated} user(s)"
        logger.info(message)
        self.stdout.write(message)
