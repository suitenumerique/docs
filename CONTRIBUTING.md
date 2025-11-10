# Contributing to the Project

Thank you for taking the time to contribute! Please follow these guidelines to ensure a smooth and productive workflow. 🚀🚀🚀

To get started with the project, please refer to the [README.md](https://github.com/suitenumerique/docs/blob/main/README.md) for detailed instructions on how to run Docs locally.

Contributors are required to sign off their commits with `git commit --signoff`: this confirms that they have read and accepted the [Developer's Certificate of Origin 1.1](https://developercertificate.org/). For security reasons we also require [signing your commits with your SSH or GPG key](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification) with `git commit -S`.

Please also check out our [dev handbook](https://suitenumerique.gitbook.io/handbook) to learn our best practices.

## Help us with translations

You can help us with translations on [Crowdin](https://crowdin.com/project/lasuite-docs).
Your language is not there? Request it on our Crowdin page 😊 or ping us on [Matrix](https://matrix.to/#/#docs-official:matrix.org) and let us know if you can help with translations and/or proofreading.

## Creating an Issue

When creating an issue, please provide the following details:

1.  **Title**: A concise and descriptive title for the issue.
2.  **Description**: A detailed explanation of the issue, including relevant context or screenshots if applicable.
3.  **Steps to Reproduce**: If the issue is a bug, include the steps needed to reproduce the problem.
4.  **Expected vs. Actual Behavior**: Describe what you expected to happen and what actually happened.
5.  **Labels**: Add appropriate labels to categorize the issue (e.g., bug, feature request, documentation).

## Selecting an issue

We use a [GitHub Project](https://github.com/orgs/numerique-gouv/projects/13) in order to prioritize our workload. 

Please check in priority the issues that are in the **todo** column and have a higher priority (P0 -> P2). 

## Commit Message Format

All commit messages must adhere to the following format:

`<gitmoji>(type) title description`

*   <**gitmoji**>: Use a gitmoji to represent the purpose of the commit. For example, ✨ for adding a new feature or 🔥 for removing something, see the list [here](https://gitmoji.dev/).
*   **(type)**: Describe the type of change. Common types include `backend`, `frontend`, `CI`, `docker` etc...
*   **title**: A short, descriptive title for the change (*)
*   **blank line after the commit title
*   **description**: Include additional details on why you made the changes (**).
    
    (*) ⚠️ **Make sure you add no space between the emoji and the (type) but add a space after the closing parenthesis of the type and use no caps!**
    (**) ⚠️ **Commit description message is mandatory and shouldn't be too long**

### Example Commit Message

```
✨(frontend) add user authentication logic 

Implemented login and signup features, and integrated OAuth2 for social login.
```

## Changelog Update

Please add a line to the changelog describing your development. The changelog entry should include a brief summary of the changes, this helps in tracking changes effectively and keeping everyone informed. We usually include the title of the pull request, followed by the pull request ID to finish the log entry. The changelog line should be less than 80 characters in total.

### Example Changelog Message
```
## [Unreleased]

## Added

- ✨(frontend) add AI to the project #321
```

## Pull Requests

It is nice to add information about the purpose of the pull request to help reviewers understand the context and intent of the changes. If you can, add some pictures or a small video to show the changes.

### Don't forget to: 
- signoff your commits
- sign your commits with your key (SSH, GPG etc.)
- check your commits (see warnings above)
- check the linting: `make lint && make frontend-lint`
- check the tests: `make test`
- add a changelog entry

Once all the required tests have passed, you can request a review from the project maintainers.

## Code Style

Please maintain consistency in code style. Run any linting tools available to make sure the code is clean and follows the project's conventions.

## Tests

Make sure that all new features or fixes have corresponding tests. Run the test suite before pushing your changes to ensure that nothing is broken.

## Asking for Help

If you need any help while contributing, feel free to open a discussion or ask for guidance in the issue tracker. We are more than happy to assist!

Thank you for your contributions! 👍

## Contribute to BlockNote
We use [BlockNote](https://www.blocknotejs.org/) for the text editing features of Docs. 
If you find and issue with the editor you can [report it](https://github.com/TypeCellOS/BlockNote/issues) directly on their repository.

Please consider contributing to BlockNotejs, as a library, it's useful to many projects not just Docs.

The project is licended with Mozilla Public License Version 2.0 but be aware that [XL packages](https://github.com/TypeCellOS/BlockNote/blob/main/packages/xl-docx-exporter/LICENSE) are dual licenced with GNU AFFERO GENERAL PUBLIC LICENCE Version 3 and proprietary licence if you are [sponsor](https://www.blocknotejs.org/pricing).
