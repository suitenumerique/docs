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
    def get_select_options(cls, ancestors_links):
        """
        Determines the valid select options for link reach and link role depending on the
        list of ancestors' link reach/role.
        Args:
            ancestors_links: List of dictionaries, each with 'link_reach' and 'link_role' keys
                             representing the reach and role of ancestors links.
        Returns:
            Dictionary mapping possible reach levels to their corresponding possible roles.
        """
        # If no ancestors, return all options
        if not ancestors_links:
            return {
                reach: LinkRoleChoices.values if reach != cls.RESTRICTED else None
                for reach in cls.values
            }

        # Initialize result with all possible reaches and role options as sets
        result = {
            reach: set(LinkRoleChoices.values) if reach != cls.RESTRICTED else None
            for reach in cls.values
        }

        # Group roles by reach level
        reach_roles = defaultdict(set)
        for link in ancestors_links:
            reach_roles[link["link_reach"]].add(link["link_role"])

        # Rule 1: public/editor → override everything
        if LinkRoleChoices.EDITOR in reach_roles.get(cls.PUBLIC, set()):
            return {cls.PUBLIC: [LinkRoleChoices.EDITOR]}

        # Rule 2: authenticated/editor
        if LinkRoleChoices.EDITOR in reach_roles.get(cls.AUTHENTICATED, set()):
            result[cls.AUTHENTICATED].discard(LinkRoleChoices.READER)
            result.pop(cls.RESTRICTED, None)

        # Rule 3: public/reader
        if LinkRoleChoices.READER in reach_roles.get(cls.PUBLIC, set()):
            result.pop(cls.AUTHENTICATED, None)
            result.pop(cls.RESTRICTED, None)

        # Rule 4: authenticated/reader
        if LinkRoleChoices.READER in reach_roles.get(cls.AUTHENTICATED, set()):
            result.pop(cls.RESTRICTED, None)

        # Clean up: remove empty entries and convert sets to ordered lists
        cleaned = {}
        for reach in cls.values:
            if reach in result:
                if result[reach]:
                    cleaned[reach] = [
                        r for r in LinkRoleChoices.values if r in result[reach]
                    ]
                else:
                    # Could be [] or None (for RESTRICTED reach)
                    cleaned[reach] = result[reach]

        return cleaned
