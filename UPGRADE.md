# Upgrade

All instructions to upgrade this project from one release to the next will be
documented in this file. Upgrades must be run sequentially, meaning you should
not skip minor/major releases while upgrading (fix releases can be skipped).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For most upgrades, you just need to run the django migrations with
the following command inside your docker container:

`python manage.py migrate`

(Note : in your development environment, you can `make migrate`.)

## [Unreleased]

## [3.0.0] - 2025-03-28

We are not using the nginx auth request anymore to access the collaboration server (`yProvider`)
The authentication is now managed directly from the yProvider server. 
You must remove the annotation `nginx.ingress.kubernetes.io/auth-url` from the `ingressCollaborationWS`.

This means as well that the yProvider server must be able to access the Django server.
To do so, you must set the `COLLABORATION_BACKEND_BASE_URL` environment variable to the `yProvider`
service.

## [2.2.0] - 2025-02-10

- AI features are now limited to users who are authenticated. Before this release, even anonymous
  users who gained editor access on a document with link reach used to get AI feature.
  IF you want anonymous users to keep access on AI features, you must now define the
  `AI_ALLOW_REACH_FROM` setting to "public".
