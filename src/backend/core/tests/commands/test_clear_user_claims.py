"""Tests for the clear_user_claims management command."""

from io import StringIO

from django.core.management import call_command

import pytest

from core.factories import UserFactory

pytestmark = pytest.mark.django_db


def run_command(*args):
    """Run the command and return what it printed."""
    out = StringIO()
    call_command("clear_user_claims", *args, stdout=out)
    return out.getvalue()


def test_clear_user_claims_clears_all_claims_by_default():
    """Without --claim, every stored claim is removed from every user."""
    user_a = UserFactory(
        claims={"picture": "https://example.com/a.png", "locale": "nl"}
    )
    user_b = UserFactory(claims={"locale": "fr"})
    untouched = UserFactory(claims={})

    output = run_command()

    assert "2 user(s)" in output
    user_a.refresh_from_db()
    user_b.refresh_from_db()
    untouched.refresh_from_db()
    assert user_a.claims == {}
    assert user_b.claims == {}
    assert untouched.claims == {}


def test_clear_user_claims_removes_only_the_given_claims():
    """With --claim, only these keys are removed and the others are kept."""
    user = UserFactory(claims={"picture": "https://example.com/a.png", "locale": "nl"})
    other = UserFactory(claims={"locale": "fr"})

    output = run_command("--claim", "picture")

    assert "1 user(s)" in output
    user.refresh_from_db()
    other.refresh_from_db()
    assert user.claims == {"locale": "nl"}
    assert other.claims == {"locale": "fr"}


def test_clear_user_claims_accepts_several_claims():
    """--claim can be repeated."""
    user = UserFactory(
        claims={"picture": "https://example.com/a.png", "locale": "nl", "x": 1}
    )

    run_command("--claim", "picture", "--claim", "locale")

    user.refresh_from_db()
    assert user.claims == {"x": 1}


def test_clear_user_claims_with_nothing_to_clear():
    """The command reports 0 users when no stored claim matches."""
    user = UserFactory(claims={"locale": "nl"})

    output = run_command("--claim", "picture")

    assert "0 user(s)" in output
    user.refresh_from_db()
    assert user.claims == {"locale": "nl"}


def test_clear_user_claims_updates_in_a_single_query(django_assert_num_queries):
    """
    The claims are removed from the current database value in one UPDATE, so a
    login happening meanwhile can't be overwritten with stale values.
    """
    UserFactory(claims={"picture": "https://example.com/a.png", "locale": "nl"})
    UserFactory(claims={"picture": "https://example.com/b.png", "locale": "fr"})

    with django_assert_num_queries(1):
        run_command("--claim", "picture")

    with django_assert_num_queries(1):
        run_command()
