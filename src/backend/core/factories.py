"""
Core application factories
"""

from django.conf import settings
from django.contrib.auth.hashers import make_password

import factory.fuzzy
from faker import Faker

from core import models

fake = Faker()

YDOC_HELLO_WORLD_BASE64 = (
    "AR717vLVDgAHAQ5kb2N1bWVudC1zdG9yZQMKYmxvY2tHcm91cAcA9e7y1Q4AAw5ibG9ja0NvbnRh"
    "aW5lcgcA9e7y1Q4BAwdoZWFkaW5nBwD17vLVDgIGBgD17vLVDgMGaXRhbGljAnt9hPXu8tUOBAVI"
    "ZWxsb4b17vLVDgkGaXRhbGljBG51bGwoAPXu8tUOAg10ZXh0QWxpZ25tZW50AXcEbGVmdCgA9e7y"
    "1Q4CBWxldmVsAX0BKAD17vLVDgECaWQBdyQwNGQ2MjM0MS04MzI2LTQyMzYtYTA4My00ODdlMjZm"
    "YWQyMzAoAPXu8tUOAQl0ZXh0Q29sb3IBdwdkZWZhdWx0KAD17vLVDgEPYmFja2dyb3VuZENvbG9y"
    "AXcHZGVmYXVsdIf17vLVDgEDDmJsb2NrQ29udGFpbmVyBwD17vLVDhADDmJ1bGxldExpc3RJdGVt"
    "BwD17vLVDhEGBAD17vLVDhIBd4b17vLVDhMEYm9sZAJ7fYT17vLVDhQCb3KG9e7y1Q4WBGJvbGQE"
    "bnVsbIT17vLVDhcCbGQoAPXu8tUOEQ10ZXh0QWxpZ25tZW50AXcEbGVmdCgA9e7y1Q4QAmlkAXck"
    "ZDM1MWUwNjgtM2U1NS00MjI2LThlYTUtYWJiMjYzMTk4ZTJhKAD17vLVDhAJdGV4dENvbG9yAXcH"
    "ZGVmYXVsdCgA9e7y1Q4QD2JhY2tncm91bmRDb2xvcgF3B2RlZmF1bHSH9e7y1Q4QAw5ibG9ja0Nv"
    "bnRhaW5lcgcA9e7y1Q4eAwlwYXJhZ3JhcGgoAPXu8tUOHw10ZXh0QWxpZ25tZW50AXcEbGVmdCgA"
    "9e7y1Q4eAmlkAXckODk3MDBjMDctZTBlMS00ZmUwLWFjYTItODQ5MzIwOWE3ZTQyKAD17vLVDh4J"
    "dGV4dENvbG9yAXcHZGVmYXVsdCgA9e7y1Q4eD2JhY2tncm91bmRDb2xvcgF3B2RlZmF1bHQA"
)


class UserFactory(factory.django.DjangoModelFactory):
    """A factory to random users for testing purposes."""

    class Meta:
        model = models.User
        # Skip postgeneration save, no save is made in the postgeneration methods.
        skip_postgeneration_save = True

    sub = factory.Sequence(lambda n: f"user{n!s}")
    email = factory.Faker("email")
    full_name = factory.Faker("name")
    short_name = factory.Faker("first_name")
    language = factory.fuzzy.FuzzyChoice([lang[0] for lang in settings.LANGUAGES])
    password = make_password("password")

class ParentNodeFactory(factory.declarations.ParameteredAttribute):
    """Custom factory attribute for setting the parent node."""

    def generate(self, step, params):
        """
        Generate a parent node for the factory.

        This method is invoked during the factory's build process to determine the parent
        node of the current object being created. If `params` is provided, it uses the factory's
        metadata to recursively create or fetch the parent node. Otherwise, it returns `None`.
        """
        if not params:
            return None
        subfactory = step.builder.factory_meta.factory
        return step.recurse(subfactory, params)


class DocumentFactory(factory.django.DjangoModelFactory):
    """A factory to create documents"""

    class Meta:
        model = models.Document
        django_get_or_create = ("title",)
        skip_postgeneration_save = True

    parent = ParentNodeFactory()

    title = factory.Sequence(lambda n: f"document{n}")
    content = YDOC_HELLO_WORLD_BASE64
    creator = factory.SubFactory(UserFactory)
    deleted_at = None

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        """The hierarchy is owned by Drive: documents are plain rows."""
        kwargs.pop("parent", None)
        return model_class.objects.create(**kwargs)

    @factory.post_generation
    def link_traces(self, create, extracted, **kwargs):
        """Add link traces to document from a given list of users."""
        if create and extracted:
            for item in extracted:
                models.LinkTrace.objects.update_or_create(document=self, user=item)

    @factory.post_generation
    def favorited_by(self, create, extracted, **kwargs):
        """Mark document as favorited by a list of users."""
        if create and extracted:
            for item in extracted:
                models.DocumentFavorite.objects.create(document=self, user=item)


class DocumentAskForAccessFactory(factory.django.DjangoModelFactory):
    """Create fake document ask for access for testing."""

    class Meta:
        model = models.DocumentAskForAccess

    document = factory.SubFactory(DocumentFactory)
    user = factory.SubFactory(UserFactory)
    role = factory.fuzzy.FuzzyChoice([r[0] for r in models.RoleChoices.choices])


class ThreadFactory(factory.django.DjangoModelFactory):
    """A factory to create threads for a document"""

    class Meta:
        model = models.Thread

    document = factory.SubFactory(DocumentFactory)
    creator = factory.SubFactory(UserFactory)


class CommentFactory(factory.django.DjangoModelFactory):
    """A factory to create comments for a thread"""

    class Meta:
        model = models.Comment

    thread = factory.SubFactory(ThreadFactory)
    user = factory.SubFactory(UserFactory)
    body = factory.Faker("text")


class ReactionFactory(factory.django.DjangoModelFactory):
    """A factory to create reactions for a comment"""

    class Meta:
        model = models.Reaction
        skip_postgeneration_save = True

    comment = factory.SubFactory(CommentFactory)
    emoji = factory.Faker("emoji")

    @classmethod
    def generate_emojis(cls, n=10):
        """Generate a list of n unique emojis."""
        return [fake.unique.emoji() for _ in range(n)]

    @factory.post_generation
    def users(self, create, extracted, **kwargs):
        """Add users to reaction from a given list of users or create one if not provided."""
        if not create:
            return

        if not extracted:
            # the factory is being created, but no users were provided
            user = UserFactory()
            self.users.add(user)
            return

        # Add the iterable of groups using bulk addition
        self.users.add(*extracted)
