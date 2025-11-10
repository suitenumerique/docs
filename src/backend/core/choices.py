"""Declare and configure choices for Docs' core application."""

from django.db.models import TextChoices
from django.utils.translation import gettext_lazy as _


class PriorityTextChoices(TextChoices):
    """
    This class inherits from Django's TextChoices and provides a method to get the priority
    of a given value based on its position in the class.
    """

    @classmethod
    def get_priority(cls, role):
        """Returns the priority of the given role based on its order in the class."""

        members = list(cls.__members__.values())
        return members.index(role) + 1 if role in members else 0

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
        ancestors' link reach/role given as arguments.
        Returns:
            Dictionary mapping possible reach levels to their corresponding possible roles.
        """
        return {
            reach: [
                role
                for role in LinkRoleChoices.values
                if LinkRoleChoices.get_priority(role)
                >= LinkRoleChoices.get_priority(link_role)
            ]
            if reach != cls.RESTRICTED
            else None
            for reach in cls.values
            if LinkReachChoices.get_priority(reach)
            >= LinkReachChoices.get_priority(link_reach)
        }


def get_equivalent_link_definition(ancestors_links):
    """
    Return the (reach, role) pair with:
    1. Highest reach
    2. Highest role among links having that reach
    """
    if not ancestors_links:
        return {"link_reach": None, "link_role": None}

    # 1) Find the highest reach
    max_reach = max(
        ancestors_links,
        key=lambda link: LinkReachChoices.get_priority(link["link_reach"]),
    )["link_reach"]

    # 2) Among those, find the highest role (ignore role if RESTRICTED)
    if max_reach == LinkReachChoices.RESTRICTED:
        max_role = None
    else:
        max_role = max(
            (
                link["link_role"]
                for link in ancestors_links
                if link["link_reach"] == max_reach
            ),
            key=LinkRoleChoices.get_priority,
        )

    return {"link_reach": max_reach, "link_role": max_role}
