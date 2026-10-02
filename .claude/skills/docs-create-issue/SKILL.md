---
name: docs-create-issue
description: Create a GitHub issue on the La Suite Docs repository (suitenumerique/docs). Use when asked to open, file, create, write or report an issue, bug, feature request or task for Docs. Produces a short issue whose title says what it is about and whose body stays under 5 lines, points at the code with permalinks pinned on `main`, and suggests how to fix it.
---

# Create a Docs issue

The reader is a maintainer skimming a long issue list. The title alone must
tell them what the issue is about; the body must let them find the code and
start the fix without asking a question.

## 1. Understand and locate

1. Work out what is wrong or missing, where, and why. If the request is too vague
   to write a precise title, ask one question; otherwise do not ask.
2. Find the code involved: grep for the symbol, read only the range you need.
3. Look for a duplicate before writing anything:

   ```bash
   gh issue list -R suitenumerique/docs --state all --search "<keywords>" --limit 10
   ```

   If one exists, give its link to the user and stop, unless they still want a new one.

## 2. Build permalinks on `main`

Permalinks must point to the `main` of `suitenumerique/docs`, pinned on a full
commit SHA, so they keep pointing at the same lines after the file changes.
The local branch may differ from `main`: take the line numbers from `origin/main`,
never from the working tree.

```bash
git fetch -q origin main
SHA=$(git rev-parse origin/main)
git grep -n "<symbol>" origin/main -- <path>        # line numbers as on main
git show origin/main:<path> | sed -n '<from>,<to>p' # check the range
```

Link: `https://github.com/suitenumerique/docs/blob/$SHA/<path>#L<from>-L<to>`

- Keep ranges tight (the lines that matter, not the whole function).
- A permalink **alone on its line** renders as a code snippet in the issue: use
  it for the one place that shows the problem. Put the other links inline in the
  sentence (``[`useFoo`](<permalink>)``).
- If the code only exists on another branch, link that branch's commit if it is
  pushed and say so; otherwise name the path without a link.

## 3. Write the issue

**Title**: the template prefix, then what is wrong or wanted, specific enough to
be understood without opening the issue (component + behaviour), under ~80
characters.

| kind | title prefix | `type` |
|---|---|---|
| bug | `🐛(Bug) ` | `Bug` |
| feature / enhancement | `✨(feature) ` | `Feature` |
| refactoring, chore, tech debt | `♻️(refacto) ` | `Task` |

Good: `🐛(Bug) Doc tree toolbox menu does not open on first click`.
Bad: `🐛(Bug) Menu issue`, `Problem with the tree`.

**Body**: English, Markdown, **5 lines or fewer** (a guideline, not a hard rule;
go over it only when the issue truly needs it). No headings, no template
boilerplate, no filler. Cover, in this order:

1. **What** happens (or is missing) and **where**, with the permalink(s).
2. **Why / impact** or how to reproduce, in one line, when not obvious from line 1.
3. **Fix suggestion**: `Suggested fix:` followed by a concrete approach (which
   function to change, which guard to add, which existing helper to reuse). If
   several are possible, give the preferred one in a few words.

Example:

```markdown
Opening the toolbox menu of a doc tree item needs two clicks: the controlled `DropdownMenu` never fires `onOpenChange` on open, so `isOpen` stays `false`.
https://github.com/suitenumerique/docs/blob/<sha>/src/frontend/apps/impress/src/features/docs/doc-tree/components/DocTreeItemActions.tsx#L80-L92
Suggested fix: toggle `isOpen` in the trigger's `onPress` instead of relying on `onOpenChange`, as [`DocToolBox`](<permalink>) does.
```

Never put in an issue: secrets, tokens, local paths (`D:\...`, `/home/...`),
internal hostnames, personal data, or output from a private instance.

**Labels**: only existing ones (`gh label list -R suitenumerique/docs --limit 100`),
one to three area labels, e.g. `frontend`, `backend`, `collaboration`, `editor`,
`export`, `accessibility`, `helm`, `SW`, `security`. Add `AI generated` when
the issue comes from something an agent found on its own while working on an
unrelated task (see "Incidental findings" in `AGENTS.md`), rather than from a
problem the user asked to report.

## 4. Confirm, then create

Creating an issue is public. Show the user the title, body and labels, and create
it only once they agree, unless they already asked for it to be filed as is.

The installed `gh` may not support `--type`: create through the REST API, which
sets the issue type too. Write the body to a file in the scratchpad (not the repo):

```bash
gh api repos/suitenumerique/docs/issues \
  -f title='🐛(Bug) ...' \
  -F body=@<scratchpad>/issue-body.md \
  -f type=Bug \
  -f 'labels[]=frontend' \
  --jq .html_url
```

Give the user the returned URL.
