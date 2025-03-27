<p align="center">
  <a href="https://github.com/suitenumerique/docs">
    <img alt="Docs" src="/docs/assets/docs-logo.png" width="300" />
  </a>
</p>

<p align="center">
Welcome to Docs! The open source document editor where your notes can become knowledge through live collaboration
</p>

<p align="center">
  <a href="https://matrix.to/#/#docs-official:matrix.org">
    Chat on Matrix
  </a> - <a href="/docs/">
    Documentation
  </a> - <a href="#getting-started-">
    Getting started
  </a> - <a href="mailto:docs@numerique.gouv.fr">
    Reach out
  </a>
</p>

<img src="/docs/assets/docs_live_collaboration_light.gif" width="100%" align="center"/>

## Why use Docs ❓

⚠️ **Note that Docs provides docs/pdf exporters by loading [two BlockNote packages](https://github.com/suitenumerique/docs/blob/main/src/frontend/apps/impress/package.json#L22C7-L23C53), which we use under the AGPL-3.0 licence. Until we comply with the terms of this license, we recommend that you don't run Docs as a commercial product, unless you are willing to sponsor [BlockNote](https://github.com/TypeCellOS/BlockNote).**

Docs is a collaborative text editor designed to address common challenges in knowledge building and sharing.

### Write
*   😌 Simple collaborative editing without the formatting complexity of markdown
*   🔌 Offline? No problem, keep writing, your edits will get synced when back online
*   💅 Create clean documents with limited but beautiful formatting options and focus on content
*   🧱 Built for productivity (markdown support, many block types, slash commands, keyboard shortcuts).
*   ✨ Save time thanks to our AI actions (generate, sum up, correct, translate)

### Collaborate
*   🤝 Collaborate with your team in real time
*   🔒 Granular access control to ensure your information is secure and only shared with the right people
*   📑 Professional document exports in multiple formats (.odt, .doc, .pdf) with customizable templates
*   📚 Built-in wiki functionality to turn your team's collaborative work into organized knowledge `ETA 02/2025`

### Self-host
*   🚀 Easy to install, scalable and secure alternative to Notion, Outline or Confluence

## Getting started 🔧

### Test it

Test Docs on your browser by visiting this [demo document](https://impress-preprod.beta.numerique.gouv.fr/docs/6ee5aac4-4fb9-457d-95bf-bb56c2467713/)

### Run it locally

> ⚠️ Running Docs locally using the methods described below is for testing purposes only.  It is based on building Docs using Minio as the S3 storage solution but you can choose any S3 compatible object storage of your choice.

**Prerequisite**

Make sure you have a recent version of Docker and [Docker Compose](https://docs.docker.com/compose/install) installed on your laptop:

```shellscript
$ docker -v

Docker version 20.10.2, build 2291f61

$ docker compose version

Docker Compose version v2.32.4
```

> ⚠️ You may need to run the following commands with sudo but this can be avoided by adding your user to the `docker` group.

**Project bootstrap**

The easiest way to start working on the project is to use [GNU Make](https://www.gnu.org/software/make/):

```shellscript
$ make bootstrap FLUSH_ARGS='--no-input'
```

This command builds the `app` container, installs dependencies, performs database migrations and compile translations. It's a good idea to use this command each time you are pulling code from the project repository to avoid dependency-related or migration-related issues.

Your Docker services should now be up and running 🎉

You can access to the project by going to <http://localhost:3000>.

You will be prompted to log in, the default credentials are:

```
username: impress
password: impress
```

📝 Note that if you need to run them afterwards, you can use the eponym Make rule:

```shellscript
$ make run
```

⚠️ For the frontend developer, it is often better to run the frontend in development mode locally.

To do so, install the frontend dependencies with the following command:

```shellscript
$ make frontend-development-install
```

And run the frontend locally in development mode with the following command:

```shellscript
$ make run-frontend-development
```

To start all the services, except the frontend container, you can use the following command:

```shellscript
$ make run-backend
```

**Adding content**
You can create a basic demo site by running:

```shellscript
$ make demo
```

Finally, you can check all available Make rules using:

```shellscript
$ make help
```

**Django admin**

You can access the Django admin site at

<http://localhost:8071/admin>.

You first need to create a superuser account:

```shellscript
$ make superuser
```

## Feedback 🙋‍♂️🙋‍♀️

We'd love to hear your thoughts and hear about your experiments, so come and say hi on [Matrix](https://matrix.to/#/#docs-official:matrix.org).

## Roadmap

Want to know where the project is headed? [🗺️ Checkout our roadmap](https://github.com/orgs/numerique-gouv/projects/13/views/11)

## Licence 📝

This work is released under the MIT License (see [LICENSE](https://github.com/suitenumerique/docs/blob/main/LICENSE)).

While Docs is a public driven initiative our licence choice is an invitation for private sector actors to use, sell and contribute to the project. 

## Contributing 🙌

This project is intended to be community-driven, so please, do not hesitate to [get in touch](https://matrix.to/#/#docs-official:matrix.org) if you have any question related to our implementation or design decisions.

You can help us with translations on [Crowdin](https://crowdin.com/project/lasuite-docs).

If you intend to make pull requests see [CONTRIBUTING](https://github.com/suitenumerique/docs/blob/main/CONTRIBUTING.md) for guidelines.

Directory structure:

```markdown
docs
├── bin - executable scripts or binaries that are used for various tasks, such as setup scripts, utility scripts, or custom commands.
├── crowdin - for crowdin translations, a tool or service that helps manage translations for the project.
├── docker - Dockerfiles and related configuration files used to build Docker images for the project. These images can be used for development, testing, or production environments.
├── docs - documentation for the project, including user guides, API documentation, and other helpful resources.
├── env.d/development - environment-specific configuration files for the development environment. These files might include environment variables, configuration settings, or other setup files needed for development.
├── gitlint - configuration files for `gitlint`, a tool that enforces commit message guidelines to ensure consistency and quality in commit messages.
├── playground - experimental or temporary code, where developers can test new features or ideas without affecting the main codebase.
└── src - main source code directory, containing the core application code, libraries, and modules of the project.
```

## Credits ❤️

### Stack

Docs is built on top of [Django Rest Framework](https://www.django-rest-framework.org/), [Next.js](https://nextjs.org/), [BlockNote.js](https://www.blocknotejs.org/), [HocusPocus](https://tiptap.dev/docs/hocuspocus/introduction) and [Yjs](https://yjs.dev/).

### Gov ❤️ open source

Docs is the result of a joint effort led by the French 🇫🇷🥖 ([DINUM](https://www.numerique.gouv.fr/dinum/)) and German 🇩🇪🥨 governments ([ZenDiS](https://zendis.de/)). 

We are proud sponsors of [BlockNotejs](https://www.blocknotejs.org/) and [Yjs](https://yjs.dev/).

We are always looking for new public partners (we are currently onboarding the Netherlands 🇳🇱🧀), feel free to [reach out](mailto:docs@numerique.gouv.fr) if you are interested in using or contributing to Docs.

<p align="center">
  <img src="/docs/assets/europe_opensource.png" width="50%"/>
</p>
