<p align="center">
  <a href="https://github.com/suitenumerique/docs">
    <img alt="Docs" src="/docs/assets/docs-logo.png" width="300" />
  </a>
</p>

<p align="center">
Welcome to Docs!<br> 
Docs is an open-source document editor, where your notes can become knowledge through live collaboration.<br>
It offers a scalable and secure alternative to tools such as Notion, Outline, or Confluence.
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

## Why use Docs?

Docs is a collaborative text editor designed to address common challenges in knowledge building and sharing.

### Write
*   😌 Get simple, accessible online editing for your team.
*   💅 Create clean documents with beautiful formatting options.
*   🖌️ Focus on your content using either the in-line editor, or [the Markdown syntax](https://www.markdownguide.org/basic-syntax/).
*   🧱 Quickly design your page thanks to the many block types, accessible from the `/` slash commands, as well as keyboard shortcuts.
*   🔌 Write offline! Your edits will be synced once you're back online.
*   ✨ Save time thanks to our AI actions, such as rephrasing, summarizing, fixing typos, translating, etc. You can even turn your selected text into a prompt!

### Work together
*   🤝 Enjoy live editing! See your team collaborate in real time.
*   🔒 Keep your information secure thanks to granular access control. Only share with the right people.
*   📑 Export your content in multiple formats (`.odt`, `.docx`, `.pdf`) with customizable templates.
*   📚 _Coming soon! Built-in wiki functionality to turn your team's collaborative work into organized knowledge._

> ⚠️ **Note: The docx/pdf exporters rely on [packages Blocknote project](https://github.com/suitenumerique/docs/blob/main/src/frontend/apps/impress/package.json#L22C7-L23C53), which are under the AGPL-3.0 licence. Because the Docs project uses the MIT license, we recommend that you do not run Docs as a commercial product -- unless you are willing to sponsor [BlockNote](https://github.com/TypeCellOS/BlockNote). We are working on complying with the terms of the Blocknote license.**

### Self-host
*   🚀 Docs relies on Docker and GNU Make to build a scalable and secure knowledge tool.


## Getting started 🔧

### Test Docs right now!

You can test Docs on your browser by logging in on this [environment](https://impress-preprod.beta.numerique.gouv.fr/) using the following credentials:

```
email: test.docs@yopmail.com
password: I'd<3ToTestDocs
```

### Run Docs locally

> ⚠️ The methods described below for running Docs locally is **for testing purposes only**. It is based on building Docs using [Minio](https://min.io/) as an S3-compatible storage solution. Of course you can choose any S3-compatible storage solution.

**Prerequisite**

Make sure you have a recent version of Docker and [Docker Compose](https://docs.docker.com/compose/install) installed on your laptop, then type:

```shellscript
$ docker -v

Docker version 20.10.2, build 2291f61

$ docker compose version

Docker Compose version v2.32.4
```

> ⚠️ You may need to run the following commands with `sudo`, but this can be avoided by adding your user to the local `docker` group.

**Project bootstrap**

The easiest way to start working on the project is to use [GNU Make](https://www.gnu.org/software/make/):

```shellscript
$ make bootstrap FLUSH_ARGS='--no-input'
```

This command builds the `app` container, installs dependencies, performs database migrations and compiles translations. It's a good idea to use this command each time you are pulling code from the project repository to avoid dependency-related or migration-related issues.

Your Docker services should now be up and running 🎉

You can access the project by going to <http://localhost:3000>.

You will be prompted to log in. The default credentials are:

```
username: impress
password: impress
```

> 📝 Note that if you need to run them afterwards, you can use the eponym Make rule:

```shellscript
$ make run
```

> ⚠️ For frontend developers, it is often better to run the frontend in development mode locally.

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
You can create a basic demo site by running this command:

```shellscript
$ make demo
```

Finally, you can check all available Make rules using this command:

```shellscript
$ make help
```

**Django admin**

You can access the Django admin site at:

<http://localhost:8071/admin>.

You first need to create a superuser account:

```shellscript
$ make superuser
```

## Feedback 🙋‍♂️🙋‍♀️

We'd love to hear your thoughts, and hear about your experiments, so come and say hi on [Matrix](https://matrix.to/#/#docs-official:matrix.org).

## Roadmap

Want to know where the project is headed? [🗺️ Checkout our roadmap](https://github.com/orgs/numerique-gouv/projects/13/views/11)

## Licence 📝

This work is released under the MIT License (see [LICENSE](https://github.com/suitenumerique/docs/blob/main/LICENSE)).

While Docs is a public-driven initiative, our licence choice is an invitation for private sector actors to use, sell, and contribute to the project. 

## Contributing 🙌

This project is intended to be community-driven, so please do not hesitate to [get in touch](https://matrix.to/#/#docs-official:matrix.org) if you have any question related to our implementation or design decisions.

You can help us with translations on [Crowdin](https://crowdin.com/project/lasuite-docs).

If you intend to make pull requests, see [CONTRIBUTING](https://github.com/suitenumerique/docs/blob/main/CONTRIBUTING.md) for guidelines.

## Directory structure:

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

Docs is built on top of [Django Rest Framework](https://www.django-rest-framework.org/), [Next.js](https://nextjs.org/), [BlockNote.js](https://www.blocknotejs.org/), [HocusPocus](https://tiptap.dev/docs/hocuspocus/introduction) and [Yjs](https://yjs.dev/). We thank the contributors of all these projects for their awesome work!

We are proud sponsors of [BlockNotejs](https://www.blocknotejs.org/) and [Yjs](https://yjs.dev/).

### Gov ❤️ open source

Docs is the result of a joint effort led by the French 🇫🇷🥖 ([DINUM](https://www.numerique.gouv.fr/dinum/)) and German 🇩🇪🥨 governments ([ZenDiS](https://zendis.de/)).

We are always looking for new public partners (we are currently onboarding the Netherlands 🇳🇱🧀), feel free to [reach out](mailto:docs@numerique.gouv.fr) if you are interested in using or contributing to Docs.

<p align="center">
  <img src="/docs/assets/europe_opensource.png" width="50%"/>
</p>
