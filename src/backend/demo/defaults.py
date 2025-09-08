"""Parameters that define how the demo site will be built."""

NB_OBJECTS = {
    "users": 50,
    "docs": 50,
    "max_users_per_document": 50,
}

DEV_USERS = [
    {"username": "impress", "email": "impress@impress.world", "language": "en-us"},
    {
        "username": "user-e2e-webkit",
        "email": "user.test@webkit.test",
        "language": "en-us",
    },
    {
        "username": "user-e2e-firefox",
        "email": "user.test@firefox.test",
        "language": "en-us",
    },
    {
        "username": "user-e2e-chromium",
        "email": "user.test@chromium.test",
        "language": "en-us",
    },
]
