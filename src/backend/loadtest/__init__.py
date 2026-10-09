"""Load-test tooling for Docs.

Never part of a regular deployment: this application is only installed by the
`LoadTest` configuration (`impress/settings.py`), and refuses to load anywhere
LOAD_TEST_TOOLS_ENABLED is not set — see `apps.py`.
"""
