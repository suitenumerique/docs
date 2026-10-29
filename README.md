## Issue: Anchor link stops above the target block when the document contains images

## Problem to solve

In order to share a link that points to a precise section of a document, opening a URL with a block anchor (`/docs/<id>/#<blockId>`) must scroll to that block. This works when the document only contains text. When there are images or other media above the target, the scroll stops short and the target block is still lower down the page.

Example: https://docs.numerique.gouv.fr/

File (README.md):
<p align="center">
  <a href="https://github.com/suitenumerique/docs">
    <img alt="Docs" src="documentation/assets/banner-docs.png" width="100%" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/suitenumerique/docs/stargazers/">
    <img src="https://img.shields.io/github/stars/suitenumerique/docs" alt="">
  </a>
  <a href="https://github.com/suitenumerique/docs/blob/main/CONTRIBUTING.md">
    <img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"/>
  </a>
  <a href="https://github.com/suitenumerique/docs/blob/main/LICENSE">
    <img alt="MIT License" src
