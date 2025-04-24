"""Declare and configure choices for Docs' core application."""

from django.db.models import TextChoices
from django.utils.translation import gettext_lazy as _


class PriorityTextChoices(TextChoices):
    """
    This class inherits from Django's TextChoices and provides a method to get the priority
    of a given value based on its position in the class.
    """

    @classmethod
    def get_priority(cls, value):
        """Returns the priority of the given value based on its order in the class."""
        members = list(cls.__members__.values())
        return members.index(value) + 1 if value in members else 0

    @classmethod
    def max(cls, *roles):
        """
        Return the highest-priority role among the given roles, using get_priority().
        If no valid roles are provided, returns None.
        """

        valid_roles = [role for role in roles if cls.get_priority(role) is not None]
        if not valid_roles:
            return None
        return max(valid_roles, key=cls.get_priority)


class LinkRoleChoices(PriorityTextChoices):
    """Defines the possible roles a link can offer on a document."""

    READER = "reader", _("Reader")  # Can read
    EDITOR = "editor", _("Editor")  # Can read and edit


class RoleChoices(PriorityTextChoices):
    """Defines the possible roles a user can have in a resource."""

    READER = "reader", _("Reader")  # Can read
    EDITOR = "editor", _("Editor")  # Can read and edit
    ADMIN = "administrator", _("Administrator")  # Can read, edit, delete and share
    OWNER = "owner", _("Owner")


PRIVILEGED_ROLES = [RoleChoices.ADMIN, RoleChoices.OWNER]


class LinkReachChoices(PriorityTextChoices):
    """Defines types of access for links"""

    RESTRICTED = (
        "restricted",
        _("Restricted"),
    )  # Only users with a specific access can read/edit the document
    AUTHENTICATED = (
        "authenticated",
        _("Authenticated"),
    )  # Any authenticated user can access the document
    PUBLIC = "public", _("Public")  # Even anonymous users can access the document


    @classmethod
    def get_select_options(cls, link_reach, link_role):
        """
        Determines the valid select options for link reach and link role depending on the
        list of ancestors' link reach/role definitions.
        Returns:
            Dictionary mapping possible reach levels to their corresponding possible roles.
        """
        # If no ancestors, return all options
        if not link_reach:
            return {
                reach: LinkRoleChoices.values if reach != cls.RESTRICTED else None
                for reach in cls.values
            }

        # Initialize the result for all reaches with possible roles
        result = {
            reach: set(LinkRoleChoices.values) if reach != cls.RESTRICTED else None
            for reach in cls.values
        }

        # Handle special rules directly with early returns for efficiency

        if link_role == LinkRoleChoices.EDITOR:
            # Rule 1: public/editor → override everything
            if link_reach == cls.PUBLIC:
                return {cls.PUBLIC: [LinkRoleChoices.EDITOR]}

            # Rule 2: authenticated/editor
            if link_reach == cls.AUTHENTICATED:
                result[cls.AUTHENTICATED].discard(LinkRoleChoices.READER)
                result.pop(cls.RESTRICTED, None)

        if link_role == LinkRoleChoices.READER:
            # Rule 3: public/reader
            if link_reach == cls.PUBLIC:
                result.pop(cls.AUTHENTICATED, None)
                result.pop(cls.RESTRICTED, None)

            # Rule 4: authenticated/reader
            if link_reach == cls.AUTHENTICATED:
                result.pop(cls.RESTRICTED, None)

        # Convert sets to ordered lists where applicable
        return {
            reach: sorted(roles, key=LinkRoleChoices.get_priority) if roles else roles
            for reach, roles in result.items()
        }
