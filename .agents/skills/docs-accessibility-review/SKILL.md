---
name: docs-accessibility-review
description: Review the accessibility of added or modified frontend code in La Suite Docs (PRs, diffs, React components, styles, editor features). Covers HTML semantics, accessible names, ARIA, keyboard navigation, focus entry and restoration (Cancel, Escape, submit, removed trigger), screen-reader announcements, forms, dialogs, menus, the document tree, BlockNote and collaboration. Verifies in a real browser by default (loads the browser tools and starts the stack when needed) and keeps static, browser, axe and screen-reader evidence apart.
---

# Docs accessibility review

Review the changed experience end to end. Report evidenced regressions, not a generic checklist. Stay in review mode unless the user asked for fixes.

## 1. Scope

- Read the diff the user asked for. For a branch, compare against the merge base with the real target branch (`git merge-base`), not only the last commit. Include uncommitted changes when asked. Never reset, stash or stage user work.
- Map changed files to the rendered components, routes and shared primitives, and to their other consumers: a change in `src/components/` affects every caller. Include styles, portals, event handlers and async state. Backend-only changes are in scope only if they change what the UI renders (permissions, error responses).
- Before reviewing, write a small matrix: **flow/state | expected focus | expected accessible information or announcement | how it was verified**. Cover the states that apply: idle, open, loading, success, empty, error, cancel, trigger removed.
- Target WCAG 2.2 A/AA. APG is pattern guidance, not a normative requirement: do not report an APG deviation as a WCAG failure. Do not claim RGAA or legal conformance.

## 2. Docs landmarks

App: `src/frontend/apps/impress/src` (`@/` alias). Read the implementation of a primitive before reporting that it lacks semantics or focus handling: wrappers often delegate them. Conversely, using an accessible primitive does not make its usage accessible.

- **UI primitives:** `@gouvfr-lasuite/ui-components` (Modal, DropdownMenu, …) built on `react-aria-components`; local wrappers in `components/` (`components/modal/`, `components/dropdown-menu/`, `DropButton.tsx`). Floating UI (`@floating-ui/react`) for some popovers.
- **Focus restoration:** `stores/useFocusStore.tsx` holds a **single** `lastFocusedElement`; `restoreFocus()` focuses it on the next frame and clears it. Check that nested overlays do not overwrite each other's element, and that the element is still connected when restored (focusing a detached node fails silently and focus drops to `body`).
- **Route changes:** `hooks/useRouteChangeCompleteFocus.tsx` moves focus to the start of the main content (`layouts/utils.ts`) only after a keyboard-initiated navigation.
- **Controlled DropdownMenu:** when `isOpen` is controlled, `onOpenChange` does not fire on open, only on react-aria-initiated changes (Escape, outside click, item chosen). Anything that observes the open state must be updated by the trigger handler itself.
- **Announcements:** `announce(t('…'), 'polite' | 'assertive')` from `@react-aria/live-announcer` (see `useCreateFavoriteDoc.tsx`, `DocShareModal.tsx`, `FindReplace.tsx`). Reuse it; do not add another live region. A visible toast is not automatically announced.
- **Editor:** `features/docs/doc-editor/` (BlockNote over ProseMirror, version in `package.json`). Check the installed BlockNote API before proposing selection or focus changes.
- **i18n:** accessible names and announcements go through `t()`. Never edit `translations.json`: it is generated from Crowdin.

Search with the Grep tool (`rg` may not be installed in the shell), then narrow the search to the affected feature: `aria-|tabIndex|autoFocus|announce\(|restoreFocus|addLastFocus|initialFocus`.

## 3. Review the changed flows

Check only the dimensions the change touches:

1. **Semantics and names:** native elements over `div` plus ARIA, meaningful accessible names and labels, heading order and landmarks, valid ARIA relationships (`aria-controls`, `aria-describedby` targets exist), current state (`aria-expanded`, `aria-selected`, `aria-current`, `aria-pressed`). Icon-only buttons need a name. Do not duplicate the visible text in `aria-label` with different wording.
2. **Keyboard:** every action reachable and operable with the keyboard, the expected keys for the widget (arrows in menus, trees and listboxes; Escape closes), no trap, focus indicator visible (WCAG 2.4.7) and focused elements not entirely hidden by a sticky header or overlay (WCAG 2.4.11).
3. **Focus lifecycle:** where focus lands on open, then after each exit path separately: Cancel, Escape, close button, outside click, success, failure, deletion, navigation, unmount. Focus returns to the trigger when appropriate, or to a logical, visible, enabled successor when the trigger is gone or the context has changed (deleted item, closed sub-page). Check nested overlays and make sure delayed focus restoration doesn't override another intentional focus move.
4. **Announcements:** state changes the user cannot see without moving focus (save, delete, copy link, search results count, errors) must be communicated to screen readers, either through existing accessible information or an announcement when needed. Avoid duplicate announcements and races against focus moves.
5. **Editor continuity:** after a toolbar action, a dialog, or a cancelled AI action, the caret and selection come back where they were, not only focus on the `contenteditable`. Collaborators' edits must never move the local user's focus or selection.
6. **Visual and pointer:** contrast of new colours (use Cunningham tokens), zoom to 200 % and reflow at 320 px, content shown on hover also shown on focus and dismissible, target size (2.5.8), an alternative to dragging (2.5.7, e.g. moving documents in the tree), `prefers-reduced-motion`.

Describe the expected behaviour before choosing a fix. Do not add ARIA, a focus trap or a live region by reflex.

## 4. Verify in a real browser (default, not optional)

Source reading alone misses most accessibility regressions (focus that lands nowhere, a name that differs from the code, a sticky header hiding the focus). Run the changed flows in a browser unless it is truly impossible, and make the attempt before saying it is.

1. **Get a browser tool.** Tools may be deferred: search for them (`ToolSearch` with `playwright`, `chrome-devtools`, `chrome`, `browser`) and load their schemas before concluding there is none. Playwright MCP and Chrome DevTools MCP are the usual ones; Claude in Chrome and the built-in browser also work (load their skill first). Discover the real tool names; never invent them. No browser MCP is configured in the repository itself.
2. **Get the stack running.** Check `http://localhost:3000` and the backend on :8071. A failed request is not a reason to stop: load the `docs-start` Skill and start what is missing (it runs only the needed Makefile targets, and copes with a local `yarn dev`). Check that the served build contains the reviewed change (branch checked out, `yarn dev` or the rebuilt image).
3. **Log in and prepare data.** Seeded accounts of `docker/auth/realm.json`: `user-e2e-chromium` / `password-e2e-chromium`, or `impress` / `impress`; do not guess others. Work in a disposable document and delete it afterwards.
4. **Drive each row of the matrix with real key presses** (`Tab`, `Shift+Tab`, `Enter`, `Space`, arrows, `Escape`), not clicks or `.focus()`. After every transition read the accessibility snapshot and `document.activeElement` (and the selection in the editor), and take a screenshot for focus visibility and for a focus hidden under the sticky header. Check each exit path of an overlay separately. Repeat with a pointer when behaviour should differ between keyboard and pointer.
5. **Also exercise** 200 % zoom and a 320 px viewport (resize), `prefers-reduced-motion` (emulate it), and dark / high contrast if colours changed.
6. **axe** is **not** a dependency of the E2E suite. Use it only through the available tooling (an MCP, or injecting it through DevTools); do not add the package without asking. Scan every rendered state, portals included.
7. **Only if it is really impossible** (no browser tool after searching, the stack cannot start after trying), finish the source review, say which step failed and why, and list the exact remaining manual steps. Never report a blocked check as passing, never skip the browser because a first request failed, and never install tools or change MCP configuration silently.
8. An accessibility tree, a DOM mutation of the announcer or a clean axe run is not speech. Only an actual screen-reader session (NVDA, VoiceOver, …) verifies what is spoken and when.

A finding raised from the source and not reproduced in the browser stays **static** and is reported as a risk, not as a confirmed issue. A browser run that contradicts the source reading wins.

Label every piece of evidence: **static**, **browser/DOM**, **axe**, **screen reader**, or **not verified**.

## 5. Tests

- Do not write E2E tests unless the user explicitly asks; when they do, follow the `docs-e2e-test` skill (Chromium only, focused spec, existing `utils-*.ts` helpers). In review mode, describe the smallest meaningful test instead.
- For a component-level regression (names, roles, focus return of a wrapper), a Vitest + Testing Library test next to the component is often cheaper than E2E (see `components/dropdown-menu/__tests__/`).
- In focus assertions, do not let the test fix the focus: `getEditor()` calls `.focus()` and `tryFocusEditorContent()` clicks, so never call them between the action under test and `toBeFocused()`. Use `page.keyboard` (Tab, Shift+Tab, Enter, Escape) for the measured interaction: a click or `.focus()` does not prove keyboard reachability.
- Prefer `getByRole` / `getByLabel`; a test ID may locate a container but does not check the accessible name. No arbitrary waits, no `force: true` clicks.

## 6. Report

Lead with confirmed findings in order of impact. For each:

- **Severity / confidence**, `file:line`, flow and state.
- **User impact**: the concrete key sequence that fails.
- **Observed vs expected**, evidence label, WCAG criterion when the mapping is clear.
- **Smallest fix**, reusing a local primitive, and the regression check.

Severity by user impact: **critical** — an essential flow cannot be completed and there is no alternative; **high** — a major navigation or operation barrier; **medium** — confusing or recoverable; **low** — minor friction.

Keep apart new regressions (checked against the base when possible, otherwise say it is unknown), pre-existing issues nearby, and unverified risks. Merge findings caused by the same shared primitive.

End with a compact coverage table (flow/state × static / browser / axe / screen reader) stating which browser tool and stack were used, or the step that failed, and the manual checks still needed. Say "No confirmed issue found in the reviewed scope" when that is the case, never "fully accessible" or a conformance percentage. Name the dimensions and tools that were skipped or failed.
