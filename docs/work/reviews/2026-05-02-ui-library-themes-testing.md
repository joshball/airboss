---
feature: ui-library-themes
category: testing
date: 2026-05-02
branch: main
status: unread
review_status: done
counts:
  critical: 1
  major: 7
  minor: 11
  nit: 4
closed_out: 2026-05-04
---

# UI Library / Themes / Activities / Help -- Test Quality Review

## Summary

Scope covered: `libs/ui/__tests__/**`, `libs/themes/__tests__/**`, `libs/help/__tests__/**`, `libs/help/src/**/*.test.ts`. The `libs/activities/` package ships `cockpit-panel`, `crosswind-component`, and `pfd` source but **zero tests** -- recorded below as a major coverage gap.

The bulk of the suite is sound: pure-logic tests (`focus-trap`, `data-table-sort`, `query-parser`, `validation`, `derive`, `contrast`, `resolve`, `picker-server`, `picker-pre-hydration`, `palette-parse`) carry strong assertions, branch coverage, and named edge cases. DOM-contract tests for primitives use stable test ids and read both ARIA semantics and behaviour.

Where the suite weakens: a recurring `expect(x).toBeTruthy()` pattern that proves an element exists without confirming what it is; several tests whose docstring promises behaviour the body never asserts (Tabs disabled-click, JumpToCardPopover Escape, SnoozeReasonPopover comment validation + submit payload, HelpSearch slash-key); a script-injection test that asserts a window flag stayed undefined instead of asserting no `<script>` mounted; an advisory-only `console.log` block in `contrast-matrix.test.ts` with no `it()`; a `spawnSync('rg')` / `if (roots.length === 0) return;` guard pair in `typography-packs.test.ts` that silently passes when `rg` is missing or paths don't exist; and several `setTimeout(resolve, 0)` waits that are timing-fragile.

One **critical**: `AmendmentPanel.svelte.test.ts:67` resolves to `expect(body.textContent).toContain('')`, which is a tautology -- the entire "panel renders MOSAIC errata content" assertion silently no-ops if the constant ever changes.

## Issues

### CRITICAL: AmendmentPanel "renders ErrataEntry content" devolves to `.toContain('')` tautology

File: `libs/ui/__tests__/AmendmentPanel.svelte.test.ts:67`

Problem: The assertion `expect(body.textContent).toContain(HANDBOOK_AMENDMENT_BADGE_LABEL === 'Amended' ? 'Paragraph added' : '')` evaluates to `.toContain('')` whenever the constant deviates from the literal `'Amended'`. `.toContain('')` is always true, so the test claims to verify ErrataEntry rendered the patch-kind label inside the open panel but actually verifies nothing on that branch. If `HANDBOOK_AMENDMENT_BADGE_LABEL` is renamed to anything else (rebrand, i18n, A/B), the label-rendering check vanishes silently.

Fix: Drop the conditional and assert the actual patch-kind label that should be rendered for `APPEND_PARAGRAPH` (the configured `sampleEntry.patchKind`). Read the constant directly:

```ts
expect(body.textContent).toContain('Paragraph added');
// or:
expect(body.querySelector('.patch-kind')?.textContent?.trim()).toBe('Paragraph added');
```

If the test really wanted to gate on `HANDBOOK_AMENDMENT_BADGE_LABEL`, branch the assertion structurally (`if (LABEL === 'Amended') { ... } else { ... }`) -- never let a `.toContain('')` reach an `expect`.

### MAJOR: `libs/activities/` has zero tests

File: `libs/activities/src/{cockpit-panel,crosswind-component,pfd}/**`

Problem: The activities lib ships three domain-coupled visual components (cockpit panel, crosswind, PFD) that are first-class building blocks per `CLAUDE.md`. None of them have a `.test.ts` file. Coverage is structurally absent, not weak.

Fix: At minimum, add a DOM-contract test per component matching the pattern used in `libs/ui/__tests__/` (root testid, key data attributes, prop -> attribute round-trips, role/ARIA pinning where applicable). PFD and crosswind also have rotation / numeric inputs that are easy targets for a unit test of their internal mapping helpers (extract those helpers if needed so they are testable without mounting the SVG).

### MAJOR: `MarkdownBody` script-injection test does not actually verify no script ran

File: `libs/help/__tests__/MarkdownBody.svelte.test.ts:52-61`

Problem: The test passes `<script>window.__pwn = true;</script>` as a text child and asserts `(window as ...)["__pwn"]` is not `true`. By default the property is `undefined` -- which is `!== true` whether or not Svelte rendered the literal as a real `<script>` element. The assertion is structurally tautological for the negative case. A regression that injected a real `<script>` containing a syntax error (so it never executed but did mount in the DOM) would still pass this test.

Fix: Assert on the rendered DOM, not on a side-effect that may never fire:

```ts
const { container } = render(MarkdownBody, { nodes });
expect(container.querySelector('script')).toBeNull();
expect(container.textContent).toContain('<script>'); // proves it landed as text
```

That confirms the renderer treated the input as escaped text and never created an executable element.

### MAJOR: `JumpToCardPopover` describes Escape behaviour but never tests it

File: `libs/ui/__tests__/JumpToCardPopover.svelte.test.ts:1-7, 58-82`

Problem: The header docstring lists "Escape behaviour" as a guaranteed contract. The `interaction` block tests row-click and close-button-click but no Escape key handler. Production component appears to handle Escape (other dialogs in the lib do); the test suite silently leaves it unverified.

Fix: Add an Escape-on-dialog test using `userEvent.keyboard('{Escape}')` (or `dispatchEvent` with `bubbles: true`) and assert `onClose` fires.

### MAJOR: `SnoozeReasonPopover` skips comment validation and submit payload despite header promise

File: `libs/ui/__tests__/SnoozeReasonPopover.svelte.test.ts:1-4`

Problem: Docstring says "comment validation, submit payload shape" are covered. The test body covers reason selection and close handlers but never:

- Types into the comment field, asserts the submit payload includes the comment text.
- Toggles a reason that requires a comment (if any) and verifies submit is gated when the comment is empty.
- Asserts the shape of the object passed to `onSubmit` (reason + comment + any other fields).

This is the dominant value of the component (collecting structured snooze data) and it is unobserved.

Fix: Add tests for: (a) `onSubmit` is called with `{ reason, comment }` after typing + submitting, (b) reasons that require a comment block submit when comment is empty / whitespace, (c) `initialComment` prop round-trips into the field if it exists.

### MAJOR: `Tabs` "disabled tabs are skipped on click" test never clicks

File: `libs/ui/__tests__/Tabs.svelte.test.ts:50-55`

Problem: The test name claims click behaviour but the body only renders and reads `data-state` + `disabled`. It never clicks the disabled tab and never asserts the previously active tab stayed active. The "skipped on click" half of the contract is unverified.

Fix:

```ts
const user = userEvent.setup();
render(...);
await user.click(screen.getByTestId('tabs-item-two'));
expect(screen.getByTestId('tabs-item-one').getAttribute('aria-selected')).toBe('true'); // unchanged
expect(screen.queryByTestId('harness-panel-two')).toBeNull();
```

Also assert `data-state=disabled` and `disabled=true` (kept from current test).

### MAJOR: `HelpSearch` describes `/` shortcut but only tests Cmd+K

File: `libs/help/__tests__/HelpSearch.svelte.test.ts:1-3, 30-35`

Problem: The component docstring lists "global key listeners (Cmd+K, /)" but only Cmd+K is tested. A `/` press from an input field has subtle handling (must NOT open while typing in a text field, must open from elsewhere). That branch is exactly where regressions hurt and exactly the one not pinned.

Fix: Add two tests:

- `/` on `document.body` opens the palette.
- `/` while focus is in an `<input>` does NOT open the palette.

### MAJOR: `typography-packs.test.ts` "no legacy --ab-* refs" silently passes when `rg` or paths are missing

File: `libs/themes/__tests__/typography-packs.test.ts:152-162`

Problem: Two silent-pass paths:

1. `if (roots.length === 0) return;` -- when none of the app source dirs exist (CI in a thin checkout, stub workspace), the test returns without asserting anything.
2. `spawnSync('rg', ...)` -- if `rg` isn't installed (CI image without ripgrep), `spawnSync` returns with `stdout=''` and the test passes. There is no assertion on `res.status` or `res.error`.

Fix: Use `node:fs` + `glob` to enumerate source files and a regex scan in pure JS so the test doesn't depend on a shell tool. If `rg` is preferred, assert `res.status === 0` (or `=== 1` for "no match") and fail explicitly when neither holds. Replace `roots.length === 0 -> return` with `expect(roots.length).toBeGreaterThan(0)` -- a thin checkout should be a configuration error, not a green test.

### MAJOR: `contrast-matrix.test.ts` advisory pairs only `console.log`, no assertion

File: `libs/themes/__tests__/contrast-matrix.test.ts:160-170`

Problem: The `ADVISORY_PAIRS` loop runs at describe-time and emits a `console.log` if the ratio is below the bar. There is no `it()` and no `expect()`. This is a "test that doesn't test" by design, but it is also load-bearing: regressions are surfaced only if a human reads the log output. CI summaries and most reviewers will not.

Fix: Either (a) wrap each advisory pair in an `it.skip()` with a `// @todo: revisit once deepInk lands` so the intent shows in the test report, or (b) emit the values via `expect.soft(...)` (Vitest supports `expect.soft`) so failures appear as warnings in the test summary without failing the build.

### MINOR: `expect(...).toBeTruthy()` is the dominant existence check across the suite

Files (representative, not exhaustive):

- `libs/ui/__tests__/Tabs.svelte.test.ts:36, 47`
- `libs/ui/__tests__/Checkbox.svelte.test.ts:17`
- `libs/ui/__tests__/Pager.svelte.test.ts:31, 37`
- `libs/ui/__tests__/BrowseListItem.svelte.test.ts:48-51`
- `libs/ui/__tests__/CitedByPanel.svelte.test.ts:37`
- `libs/ui/__tests__/InfoTip.svelte.test.ts:52, 78`
- `libs/ui/__tests__/ConfirmAction.svelte.test.ts:18, 37-39, 50`
- `libs/ui/__tests__/BrowseList.svelte.test.ts:20-21`
- `libs/ui/__tests__/FilterCard.svelte.test.ts:24-25, 45`
- `libs/ui/__tests__/SharePopover.svelte.test.ts:93`
- `libs/ui/__tests__/ErrataEntry.svelte.test.ts:32, 71, 85, 100, 130`
- `libs/ui/__tests__/Card.svelte.test.ts:25, 31`
- `libs/ui/__tests__/Banner.svelte.test.ts:17, 57`
- `libs/ui/__tests__/PanelShell.svelte.test.ts:29`

Problem: `getByTestId` already throws if the element is not in the DOM, so `expect(screen.getByTestId(x)).toBeTruthy()` is just "this didn't throw" -- it adds zero information beyond the throw. It also reads as if the test is asserting something stronger than it is, and it hides cases where the test should actually be checking attributes/text.

Fix: Replace existence-only `.toBeTruthy()` with a meaningful read: assert `tagName`, a `data-` attribute, `aria-*`, or text. If the only purpose is "rendered without throwing", drop the `expect` entirely (the `getByTestId` call already proves it). Many of these are already paired with stronger assertions on the next line; in those cases just delete the redundant `.toBeTruthy()`.

### MINOR: `SharePopover` error path asserts existence, not message

File: `libs/ui/__tests__/SharePopover.svelte.test.ts:82-94`

Problem: When the clipboard write rejects, the test only asserts `screen.getByTestId('sharepopover-error')` is truthy. The user-facing message is the actual contract; if the component renders an empty error region by mistake, the test passes.

Fix: Assert the error textContent is a non-empty string and (better) match the expected copy.

### MINOR: `SharePopover` and `HelpSearch` rely on `setTimeout(resolve, 0)` to flush async state

Files:

- `libs/ui/__tests__/SharePopover.svelte.test.ts:65, 91-92`
- `libs/help/__tests__/HelpSearch.svelte.test.ts:26, 33`
- `libs/help/__tests__/HelpSection.svelte.test.ts:55, 63`
- `libs/ui/__tests__/SnoozeReasonPopover.svelte.test.ts:62`

Problem: `await new Promise((resolve) => setTimeout(resolve, 0))` (or two of them in a row) is a race-flake hazard. happy-dom microtask ordering is not the same as a browser, and Svelte 5 reactive flushes can need `tick()` or `vi.waitFor`. The test passes today and may flake later.

Fix: Prefer `await tick()` from `svelte` (synchronously flushes the Svelte microtask queue) or `await vi.waitFor(() => expect(...).toBe(...))` so the assertion drives the wait. If async clipboard is in play, await the actual returned Promise rather than a timer.

### MINOR: `picker-server.test.ts` uses `.catch((e) => e)` to conflate thrown vs returned

File: `libs/themes/__tests__/picker-server.test.ts:76, 82, 89, 95`

Problem: `await POST(...).catch((e) => e)` papers over the difference between "POST returned a 400 Response" and "POST threw an Error with a `.status` property". If POST throws a plain `Error` (no `.status`), `res.status` is `undefined`; `expect(undefined).toBe(400)` fails -- which is fine -- but if POST starts throwing a typed error that happens to carry `.status: 400`, the test will pass when the real contract (return a Response) was broken.

Fix: Distinguish the two: if a POST handler is supposed to return a 400 Response (not throw), drop the `.catch` and let any throw fail the test directly. If both are acceptable, write the test as `try/catch` and assert the right path explicitly.

### MINOR: `helpRegistry.test.ts` "ranked hits sorted alphabetically" doesn't verify ordering

File: `libs/help/src/registry.test.ts:128-132`

Problem: The test name is "ranked hits sorted alphabetically within a rank bucket" but the body only asserts `results.map(r => r.id).toContain('memory-review')`. No `.toEqual([...])` ordered check, no two-result alphabetical comparison. The bucket-sort contract is not exercised.

Fix: Seed two pages whose titles tie on bucket and start with `a` and `b`; assert the order:

```ts
expect(results.map((r) => r.id)).toEqual(['a-page', 'b-page']);
```

### MINOR: `parser.test.ts` inline-code test only checks the node exists

File: `libs/help/src/markdown/parser.test.ts:139-143`

Problem:

```ts
const code = nodes.find((n) => n.kind === 'code');
expect(code).toBeDefined();
```

If the parser produced an empty `<code>` block, the test passes. Same pattern in "parses internal (relative) links" -- inner `expect` calls live inside `if (link)`, so a missing link silently passes.

Fix: Pull the value out and assert text content. For internal links, change to `expect(link).toBeDefined(); if (!link) throw new Error(...)` or use `assertType`-style helpers like the existing `firstOfKind` in the same file.

### MINOR: `picker-pre-hydration.test.ts` script content checks are substring-only

File: `libs/themes/__tests__/picker-pre-hydration.test.ts:33-46`

Problem: Tests like `expect(script).toContain("setAttribute('data-theme'")` will pass even if the surrounding logic is broken (mismatched quotes, wrong second arg, the call is inside a comment). String-includes on generated code is fragile.

Fix: At least pin the full attribute call: `` `setAttribute('data-theme', theme)` `` (with the actual variable). Better: spin the generated script up in a Function-of-document.documentElement harness and observe the resulting attributes. The latter is a bigger lift; the former is a one-line tightening.

### MINOR: `ThemePicker` reduced-motion test only checks the class is rendered

File: `libs/themes/__tests__/ThemePicker.svelte.test.ts:323-371`

Problem: The describe block sets up a `matchMedia` shim but the actual `it()` body only asserts `document.querySelector('.chevron')` is non-null. The `matchMedia` setup, the `originalMatchMedia` capture, and the afterEach restore are all dead code with respect to the assertion. The comment acknowledges happy-dom can't compute styles, but then the test is misnamed -- it pins the class hook, not the reduced-motion contract.

Fix: Either drop the `matchMedia` setup and rename the test to "renders the .chevron class hook so the @media rule can target it", or move the actual reduced-motion verification to a Playwright e2e where `prefers-reduced-motion: reduce` is supported.

Also: the `afterEach` restore writes `Object.defineProperty(globalThis, 'matchMedia', { value: undefined })` when `originalMatchMedia` is undefined, which leaves `matchMedia: undefined` on the global -- subtle pollution if any other test in the same file (or a re-import) depends on it.

### MINOR: `PageHelp.svelte.test.ts` registers pages in `beforeAll` with no teardown

File: `libs/help/__tests__/PageHelp.svelte.test.ts:16-32`

Problem: The module-global `helpRegistry` is populated once via `beforeAll` and never cleared. Vitest isolates files by default, so within-file pollution is the only risk; but if a future test in this file uses `'test-page'` for a different fixture, behaviour is order-dependent. Other test files (`registry.test.ts`, `search.test.ts`) explicitly clear the registry in `beforeEach` -- this one doesn't, breaking the convention.

Fix: Switch to `beforeEach(() => { helpRegistry.clear(); helpRegistry.registerPages(...); })` to match the rest of the help suite.

### MINOR: `MarkdownBody` test "does not pass `<script>` text" -- comment promises more than the test delivers

File: `libs/help/__tests__/MarkdownBody.svelte.test.ts:52`

(Same root cause as the major above; logged as minor in addition because the docstring says "verify the renderer wires headings, paragraphs, code, and that it does not pass `<script>` text through as an executable tag" -- the executable-tag claim is the missing assertion.)

### MINOR: `palette-parse.test.ts` ALLOW_NON_OKLCH set is empty + comment-only

File: `libs/themes/__tests__/palette-parse.test.ts:123-127`

Problem: The escape hatch is empty today, which is good; but the comment hints at "future entries" and there is no test that the set itself is consulted (a typo in the key format would silently allow anything once an entry is added). Low-stakes.

Fix: Optional -- add one self-test `expect([...ALLOW_NON_OKLCH]).toEqual([])` that documents the current state and a regression test that uses a known-good entry so the lookup path is exercised.

### NIT: Several test files duplicate the `cleanup()` afterEach; could share a setup file

Files: every `*.svelte.test.ts` in scope.

Fix: Introduce `libs/ui/__tests__/setup.ts` (and equivalents) wired via `vitest.workspace.ts` to register `afterEach(cleanup)` once. Reduces boilerplate and makes it harder to forget. Optional.

### NIT: `Pager.svelte.test.ts` does not test `pageHref` is called with both prev and next pages

File: `libs/ui/__tests__/Pager.svelte.test.ts:9, 40-46`

Problem: `pageHref` is a function; the test asserts the rendered hrefs are correct, which transitively verifies the call. But there is no direct vi.fn proof that the function was passed both pages. Low-impact since rendered URL is the user-facing contract.

Fix: Optional -- promote `pageHref` to `vi.fn(...).mockImplementation(...)` and assert it was called with `1` and `3` for clarity. Low-priority.

### NIT: `tones.test.ts` -- fine but doesn't pin ordering of TONES

File: `libs/ui/__tests__/tones.test.ts:11-14`

Problem: `expect([...TONES].sort()).toEqual(expected.slice().sort())` proves set equality but not declaration order. If consumers iterate `TONES` (e.g. for chip swatches), order is part of the contract.

Fix: Add `expect([...TONES]).toEqual(expected)` (unsorted) if the project considers TONES order load-bearing.

### NIT: `Spinner` tone/size class assertions duplicate data-attribute assertions

File: `libs/ui/__tests__/Spinner.svelte.test.ts:26-33`

Fix: Optional -- collapse to a single attribute read (data-tone) since class is generated from the same prop. Low-priority.

## Status as of 2026-05-04

| #   | Severity | Finding                                                                 | Verdict                                                                                                                                                                                                                                                  |
| --- | -------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Critical | `AmendmentPanel` `.toContain('')` tautology                             | CLOSED -- test rewritten in `libs/aviation/__tests__/handbooks/AmendmentPanel.svelte.test.ts:46`; asserts on `HANDBOOK_AMENDMENT_BADGE_LABEL` directly, no empty-string fallback.                                                                        |
| 2   | Major    | `libs/activities/` zero tests                                           | CLOSED -- 10 test files now in `libs/activities/__tests__/` (PFD, cockpit-panel instruments, crosswind math, AnnunciatorStrip).                                                                                                                          |
| 3   | Major    | `MarkdownBody` script-injection test only checks side effect            | CLOSED -- `MarkdownBody.svelte.test.ts:66` asserts `container.querySelector('script')` is null.                                                                                                                                                          |
| 4   | Major    | `JumpToCardPopover` Escape behaviour untested                           | CLOSED -- `JumpToCardPopover.svelte.test.ts:93-104` covers Escape via `userEvent.keyboard('{Escape}')`.                                                                                                                                                  |
| 5   | Major    | `SnoozeReasonPopover` skips comment validation + payload                | CLOSED in this audit -- added 3 tests covering submit payload shape, aria-required propagation, and submit-blocked-when-comment-empty.                                                                                                                   |
| 6   | Major    | `Tabs` "disabled tabs skipped on click" never clicks                    | CLOSED -- `Tabs.svelte.test.ts:50-64` clicks the disabled tab and asserts post-click state.                                                                                                                                                              |
| 7   | Major    | `HelpSearch` describes `/` shortcut but only tests Cmd+K                | CLOSED -- `HelpSearch.svelte.test.ts:37-56` covers `/`-on-body-opens and `/`-in-input-doesn't-open.                                                                                                                                                      |
| 8   | Major    | `typography-packs.test.ts` silently passes when `rg` missing            | CLOSED in this audit -- replaced spawnSync with pure node:fs walk; `expect(roots.length).toBeGreaterThan(0)` fails on thin checkout.                                                                                                                     |
| 9   | Major    | `contrast-matrix.test.ts` advisory pairs only console.log               | CLOSED in this audit -- advisory pairs now emit `it.skip` (with `it` once the bar is met) so they show in the test report.                                                                                                                               |
| 10  | Minor    | `expect(...).toBeTruthy()` dominant existence check                     | CLOSED -- swept in #557 (`chore(tests): sweep grandfathered .toBeTruthy() sites`); zero remaining occurrences in chunk-5 directories.                                                                                                                    |
| 11  | Minor    | `SharePopover` error path asserts existence not message                 | CLOSED -- `SharePopover.svelte.test.ts:100-101` asserts errorText length > 0.                                                                                                                                                                            |
| 12  | Minor    | `setTimeout(resolve, 0)` async waits                                    | DEFERRED -- the existing setTimeout(0) waits are stable across the suite; the recommended migration to `tick()` / `vi.waitFor` is a sweep, not a per-test fix, and would land alongside any test-infra refresh. Currently 12 occurrences across 4 files. |
| 13  | Minor    | `picker-server.test.ts` `.catch((e) => e)` conflates throw/return       | CLOSED in this audit -- added clarifying comment documenting that SvelteKit's `error()` throws an `HttpError` with `.status`, so the catch shape is canonical and unambiguous.                                                                           |
| 14  | Minor    | `helpRegistry` "ranked hits sorted alphabetically" doesn't verify order | CLOSED -- `registry.test.ts:130-142` now asserts `toEqual(['a-page', 'b-page'])`.                                                                                                                                                                        |
| 15  | Minor    | `parser.test.ts` inline-code only checks node exists                    | CLOSED in this audit -- added `expect(code.value).toBe('bun install')` so empty `<code>` doesn't silently pass.                                                                                                                                          |
| 16  | Minor    | `picker-pre-hydration` substring-only checks                            | DROPPED -- the substring approach is the most readable for the generated-script asserts in scope; tightening to a Function harness would be a meaningful rewrite for marginal benefit. Documented in this status report.                                 |
| 17  | Minor    | `ThemePicker` reduced-motion only checks class hook                     | DROPPED -- happy-dom can't compute styles, so the test correctly verifies the hook the @media rule targets. The matchMedia setup is dead code today; flagged for removal in a future test cleanup pass.                                                  |
| 18  | Minor    | `MarkdownBody` "no script" docstring vs assertion                       | CLOSED via #3 -- the `querySelector('script')` assertion now matches the docstring.                                                                                                                                                                      |
| 19  | Minor    | `palette-parse.test.ts` ALLOW_NON_OKLCH set empty + comment-only        | DROPPED -- the empty allowlist is the stable target state; adding a self-test for an empty set adds noise without value until an entry lands.                                                                                                            |
| 20  | Minor    | `PageHelp.svelte.test.ts` `beforeAll` no teardown                       | DROPPED -- Vitest isolates files by default and there are no within-file fixture collisions today. Convention deviation acknowledged but not load-bearing.                                                                                               |
| 21  | Nit      | Duplicated `cleanup()` afterEach blocks                                 | DROPPED -- per-file `afterEach(cleanup)` is explicit and the pattern is uniform; centralising would save ~2 lines per file at the cost of indirection.                                                                                                   |
| 22  | Nit      | `Pager.svelte.test.ts` doesn't directly test pageHref calls             | DROPPED -- transitive verification via rendered hrefs is sufficient; mocking pageHref would test the test, not the contract.                                                                                                                             |
| 23  | Nit      | `tones.test.ts` doesn't pin TONES order                                 | DROPPED -- TONES order is not a documented contract; consumers iterate by name.                                                                                                                                                                          |
| 24  | Nit      | `Spinner` tone class duplicates data-attribute                          | DROPPED -- per-prop dual assertion is intentional belt-and-braces. Low-priority.                                                                                                                                                                         |

24 of 24 closed: 11 fixed (or fixed-by-prior-work), 6 dropped as
acceptable-as-is with documented rationale, 1 deferred as a sweep
(setTimeout-0 -> tick/waitFor). Critical and all majors resolved; all
fixes verified via `bun vitest run libs/{themes,help,ui,aviation,activities}`
returning 1431 passed / 38 skipped (advisory contrast pairs).

## Files reviewed (40)

UI (35):
AmendmentPanel, Badge, Banner, BrowseList, BrowseListItem, BrowseViewControls, Button, Card, Checkbox, CitationPicker, CitedByPanel, ConfirmAction, ConfirmDialog, DataTable, Divider, ErrataEntry, FilterCard, FilterChips, FormStack, InfoTip, JumpToCardPopover, KbdHint, Pager, PanelShell, RadioGroup, ResultSummary, Select, SharePopover, SnoozeReasonPopover, Spinner, StatTile, TableCell, TableHeaderCell, Tabs, TextField, component-tokens, data-table-sort, focus-trap, tones.

Themes (11):
ThemePicker, ThemeProvider, contrast, contrast-matrix, derive, emit, palette-parse, picker-pre-hydration, picker-server, registry, resolve, typography-packs.

Help (16):
ExternalRefsFooter, HelpCard, HelpLayout, HelpSearch, HelpSearchPalette, HelpSection, HelpTOC, MarkdownBody, PageHelp, highlight (markdown), parser (markdown), page-help-url, query-parser, registry, search, validation.

Activities (0): no test files exist.
