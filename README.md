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

For detailed guides on setup, development, and deployment, check out the documentation available on our [GitHub Pages site](https://suitenumerique.github.io/docs/).

Quick links:

- 📚 [Documentation Overview](https://suitenumerique.github.io/docs/)
- 🧑‍💻 [Development Guide](https://suitenumerique.github.io/docs/development)
- 🚀 [Deployment Options](https://suitenumerique.github.io/docs/deployment)


### Test it

Test Docs on your browser by logging in on this [environment](https://impress-preprod.beta.numerique.gouv.fr/)

```
email: test.docs@yopmail.com
password: I'd<3ToTestDocs
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
