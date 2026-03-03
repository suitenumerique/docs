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

## [4.6.0] - 2026-02-27

- ⚠️ Some setup have changed to offer a bigger flexibility and consistency, overriding the favicon and logo are now from the theme configuration.
https://github.com/suitenumerique/docs/blob/f24b047a7cc146411412bf759b5b5248a45c3d99/src/backend/impress/configuration/theme/default.json#L129-L161


## [4.0.0] - 2025-11-26

- ⚠️ We updated `@gouvfr-lasuite/ui-kit` to `0.18.0`, so if you are customizing Docs with a css layer or with a custom template, you need to update your customization to follow the new design system structure.  
More information about the changes in the design system can be found here:
  - https://suitenumerique.github.io/cunningham/storybook/?path=/docs/migrating-from-v3-to-v4--docs
  - https://github.com/suitenumerique/docs/pull/1605
  - https://github.com/suitenumerique/docs/blob/main/docs/theming.md

- If you were using the `THEME_CUSTOMIZATION_FILE_PATH` and have overridden the header logo, you need to update your customization file to follow the new structure of the header, it is now: 
  ```json
  {
    ...,
    "header": {
      "icon": {
        "src": "your_logo_src",
        "width": "your_logo_width",
        "height": "your_logo_height"
      }
    }
  }
  ```


## [3.3.0] - 2025-05-22

⚠️ For some advanced features (ex: Export as PDF) Docs relies on XL packages from BlockNote. These are licenced under AGPL-3.0 and are not MIT compatible. You can perfectly use Docs without these packages by setting the environment variable `PUBLISH_AS_MIT` to true. That way you'll build an image of the application without the features that are not MIT compatible. Read the [environment variables documentation](/docs/env.md) for more information.

The footer is now configurable from a customization file. To override the default one, you can
use the `THEME_CUSTOMIZATION_FILE_PATH` environment variable to point to your customization file.
The customization file must be a JSON file and must follow the rules described in the
[theming documentation](docs/theming.md).

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
