# ruff: noqa: S311
"""
Core application factories
"""

from django.conf import settings
from django.contrib.auth.hashers import make_password

import factory.fuzzy
from faker import Faker

from core import models

fake = Faker()


class UserFactory(factory.django.DjangoModelFactory):
    """A factory to random users for testing purposes."""

    class Meta:
        model = models.User

    sub = factory.Sequence(lambda n: f"user{n!s}")
    email = factory.Faker("email")
    full_name = factory.Faker("name")
    short_name = factory.Faker("first_name")
    language = factory.fuzzy.FuzzyChoice([lang[0] for lang in settings.LANGUAGES])
    password = make_password("password")

    @factory.post_generation
    def with_owned_document(self, create, extracted, **kwargs):
        """
        Create a document for which the user is owner to check
        that there is no interference
        """
        if create and (extracted is True):
            UserDocumentAccessFactory(user=self, role="owner")

    @factory.post_generation
    def with_owned_template(self, create, extracted, **kwargs):
        """
        Create a template for which the user is owner to check
        that there is no interference
        """
        if create and (extracted is True):
            UserTemplateAccessFactory(user=self, role="owner")


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
    excerpt = factory.Sequence(lambda n: f"excerpt{n}")
    content = factory.Sequence(lambda n: f"content{n}")
    creator = factory.SubFactory(UserFactory)
    link_reach = factory.fuzzy.FuzzyChoice(
        [a[0] for a in models.LinkReachChoices.choices]
    )
    link_role = factory.fuzzy.FuzzyChoice(
        [r[0] for r in models.LinkRoleChoices.choices]
    )

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        """
        Custom creation logic for the factory: creates a document as a child node if
        a parent is provided; otherwise, creates it as a root node.
        """
        parent = kwargs.pop("parent", None)

        if parent:
            # Add as a child node
            return parent.add_child(instance=model_class(**kwargs))

        # Add as a root node
        return model_class.add_root(instance=model_class(**kwargs))

    @factory.post_generation
    def users(self, create, extracted, **kwargs):
        """Add users to document from a given list of users with or without roles."""
        if create and extracted:
            for item in extracted:
                if isinstance(item, models.User):
                    UserDocumentAccessFactory(document=self, user=item)
                else:
                    UserDocumentAccessFactory(document=self, user=item[0], role=item[1])

    @factory.post_generation
    def link_traces(self, create, extracted, **kwargs):
        """Add link traces to document from a given list of users."""
        if create and extracted:
            for item in extracted:
                models.LinkTrace.objects.create(document=self, user=item)

    @factory.post_generation
    def favorited_by(self, create, extracted, **kwargs):
        """Mark document as favorited by a list of users."""
        if create and extracted:
            for item in extracted:
                models.DocumentFavorite.objects.create(document=self, user=item)


class UserDocumentAccessFactory(factory.django.DjangoModelFactory):
    """Create fake document user accesses for testing."""

    class Meta:
        model = models.DocumentAccess

    document = factory.SubFactory(DocumentFactory)
    user = factory.SubFactory(UserFactory)
    role = factory.fuzzy.FuzzyChoice([r[0] for r in models.RoleChoices.choices])


class TeamDocumentAccessFactory(factory.django.DjangoModelFactory):
    """Create fake document team accesses for testing."""

    class Meta:
        model = models.DocumentAccess

    document = factory.SubFactory(DocumentFactory)
    team = factory.Sequence(lambda n: f"team{n}")
    role = factory.fuzzy.FuzzyChoice([r[0] for r in models.RoleChoices.choices])


class TemplateFactory(factory.django.DjangoModelFactory):
    """A factory to create templates"""

    class Meta:
        model = models.Template
        django_get_or_create = ("title",)
        skip_postgeneration_save = True

    title = factory.Sequence(lambda n: f"template{n}")
    is_public = factory.Faker("boolean")

    @factory.post_generation
    def users(self, create, extracted, **kwargs):
        """Add users to template from a given list of users with or without roles."""
        if create and extracted:
            for item in extracted:
                if isinstance(item, models.User):
                    UserTemplateAccessFactory(template=self, user=item)
                else:
                    UserTemplateAccessFactory(template=self, user=item[0], role=item[1])


class UserTemplateAccessFactory(factory.django.DjangoModelFactory):
    """Create fake template user accesses for testing."""

    class Meta:
        model = models.TemplateAccess

    template = factory.SubFactory(TemplateFactory)
    user = factory.SubFactory(UserFactory)
    role = factory.fuzzy.FuzzyChoice([r[0] for r in models.RoleChoices.choices])


class TeamTemplateAccessFactory(factory.django.DjangoModelFactory):
    """Create fake template team accesses for testing."""

    class Meta:
        model = models.TemplateAccess

    template = factory.SubFactory(TemplateFactory)
    team = factory.Sequence(lambda n: f"team{n}")
    role = factory.fuzzy.FuzzyChoice([r[0] for r in models.RoleChoices.choices])


class InvitationFactory(factory.django.DjangoModelFactory):
    """A factory to create invitations for a user"""

    class Meta:
        model = models.Invitation

    email = factory.Faker("email")
    document = factory.SubFactory(DocumentFactory)
    role = factory.fuzzy.FuzzyChoice([role[0] for role in models.RoleChoices.choices])
    issuer = factory.SubFactory(UserFactory)
