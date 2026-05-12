---
title: 'Out of Scope: Session Legibility and Help Expansion'
product: study
feature: session-legibility-and-help-expansion
type: out-of-scope
status: unread
---

# Out of Scope: Session Legibility and Help Expansion

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                   | Status       | Trigger to revisit                                                                              |
| ------------------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------------- |
| Per-page help pages beyond memory-review/session-start | Deferred     | User requests a new per-page page (one-by-one growth model)                                     |
| Drawer overlay for `PageHelp`                          | Deferred     | When inline help becomes more valuable than navigating to `/help/<id>`                          |
| Dark / TUI Shiki code-block theming                    | Deferred     | When app-wide theme switching grows beyond a single theme                                       |
| Full-text search within a help page                    | Rejected     | Never -- see detail below                                                                       |
| Authoring tool / preview for help pages                | Rejected     | Never -- see detail below                                                                       |
| Rep detail route `/reps/<id>` (initial spec position)  | Follow-on WP | Already triggered: Phase 4.4 shipped the detail route                                           |
| Engine / BC logic changes on `/session/start`          | Rejected     | Never -- see detail below                                                                       |
| Locked worktree audit (`worktree-agent-a55453e3`)      | Rejected     | Never -- see detail below                                                                       |
| `concept-*` naming convention enforcement              | Deferred     | When help-page additions diverge from `concept-*` naming and break index assumptions            |
| Image hosting / CDN for figures                        | Deferred     | When help authoring needs externally hosted images or shared CDN assets                         |
| Analytics on InfoTip opens / PageHelp clicks           | Deferred     | When help engagement becomes a tracked metric or growth signal                                  |
| `DESIGN_PRINCIPLES.md` addition                        | Rejected     | Re-open if a third round of help pages surfaces a durable pattern beyond the validator coverage |
| `docs/agents/help-authoring.md` short doc              | Deferred     | When another contributor starts authoring help pages and the spec + tasks are no longer enough  |

## Per-page help pages beyond memory-review and session-start

Status: Deferred

What was deferred:
Authoring per-page help pages for surfaces other than `/memory/review` and `/session/start`. Spec wires only those two routes with `<PageHelp>` and rebuilds only `memory-review`.

Why:
Per-page help has a long tail and most pages don't yet justify the authoring cost. The substrate (PageHelp, MarkdownBody, concept library, validator) makes adding a page a drop-in operation, so the right strategy is to add pages on demand rather than carpet-bomb the app.

Trigger to revisit:
When the user (or a future agent on the user's behalf) names a specific route that needs per-page help, add it as a small follow-up. Not blocked by anything in this WP.

Implementation pattern when triggered:
Mirror `apps/study/src/lib/help/content/memory-review.ts`. Register in `apps/study/src/lib/help/pages.ts`. Drop `<PageHelp pageId="..." />` in the route header. The `validate-help-ids` script catches typos.

References:

- `docs/work-packages/session-legibility-and-help-expansion/spec.md` "Out of Scope"

## Drawer overlay for PageHelp

Status: Deferred

What was deferred:
A drawer overlay for `<PageHelp>` that shows the help content inline without leaving the route. Phase 1 ships navigation to `/help/<id>` only.

Why:
A drawer is real surface area (state, focus management, scroll containment, mobile sheet behavior). Phase 1 of help expansion proves the content side first; the affordance can grow once the help library has enough density that users start invoking PageHelp frequently.

Trigger to revisit:
When inline help becomes more valuable than navigating away. Concrete signal: users repeatedly bounce between `/help/<id>` and a working surface (a session, a review screen) and the route navigation is judged friction.

Implementation pattern when triggered:
Mount help content inside a drawer primitive consistent with the existing `InfoTip` popover a11y rules (`createFocusTrap` from `libs/ui/src/lib/focus-trap.ts`, tokenized styles, viewport-edge flip for the trigger). `<MarkdownBody>` already renders standalone; the drawer wraps it.

References:

- `docs/work-packages/session-legibility-and-help-expansion/spec.md` Part B.3 + "Out of Scope"
- `libs/help/src/ui/PageHelp.svelte`

## Dark / TUI Shiki code-block theming

Status: Deferred

What was deferred:
Theme switching for code blocks rendered by Shiki in `MarkdownBody`. Shiki ships a single theme.

Why:
The app's theme story is centralized in `@ab/themes`; help is one consumer among many. Adding per-theme Shiki output is straightforward but only worth doing when the rest of the app exercises the dark / TUI surfaces.

Trigger to revisit:
When the app surfaces a theme switcher that affects more than one or two pages, or when a user reports unreadable code blocks under a non-default theme.

Implementation pattern when triggered:
Switch Shiki to dual-theme highlight (`themes: { light, dark }`) inside `libs/help/src/markdown/shiki.ts` and let CSS swap based on `--ab-color-scheme`. Token names in `@ab/themes` already exist for surface and ink colors.

References:

- `docs/work-packages/session-legibility-and-help-expansion/spec.md` "Out of Scope"
- `libs/help/src/markdown/shiki.ts`

## Full-text search within a help page

Status: Rejected

What was rejected:
A per-page full-text search affordance on `/help/<id>`.

Why:
The existing palette search (Cmd+K) covers cross-page search. Per-page search would duplicate the affordance without expanding it, and modern browser find-in-page already covers the within-page case adequately.

Trigger to revisit:
Never -- see detail above. A future help library with much longer per-page bodies (think reference docs, not concept pages) could re-decide, but that would be a different shape of feature.

References:

- `docs/work-packages/session-legibility-and-help-expansion/spec.md` "Out of Scope"

## Authoring tool / preview for help pages

Status: Rejected

What was rejected:
A separate authoring surface or live-preview tool for help pages.

Why:
Authors edit TS files directly with the validator and `bun run check` as the feedback loop. Building a preview tool would invent a second authoring surface that has to track the renderer's behavior, and the existing flow (`bun run dev`, route to `/help/<id>`, hot reload) already covers the preview need with no extra plumbing.

Trigger to revisit:
Never -- see detail above. A non-engineer author who can't run `bun` would change the calculation, but help authoring is currently a code-editing task.

References:

- `docs/work-packages/session-legibility-and-help-expansion/spec.md` "Out of Scope"

## Rep detail route `/reps/<id>` (initial spec position)

Status: Follow-on WP

What was deferred:
At spec time, the rep detail route was listed as out-of-scope with a fallback: link to `/reps/browse?scenarioId=<id>` and file a parking-lot item.

Why:
The spec called out the missing route as a parking-lot item rather than blocking session legibility on it. The session-start preview only needed a destination to link to, not a polished detail page.

Trigger to revisit:
Already triggered. Phase 4.4 of the tasks file built the route: `apps/study/src/routes/(app)/reps/[id]/+page.server.ts` and `+page.svelte` shipped along with the `ROUTES.REP_DETAIL(id)` constant. This item is recorded as a Follow-on WP that completed inside the same WP rather than spinning out.

Implementation pattern when triggered:
Already shipped. See `apps/study/src/routes/(app)/reps/[id]/+page.svelte` for the minimal-viable detail layout (title, prompt, last-attempt summary, Start attempt button, back-to-session link).

References:

- `docs/work-packages/session-legibility-and-help-expansion/spec.md` "Out of Scope" and Part A.2
- `docs/work-packages/session-legibility-and-help-expansion/tasks.md` Phase 4.4

## Engine / BC logic changes on `/session/start`

Status: Rejected

What was rejected:
Any engine or BC logic change wrapped into this WP. The spec is explicit: "This is presentation only."

Why:
Mixing presentation and engine work in one WP makes either piece harder to review and ship. Engine and BC behavior on `/session/start` (slice composition, reason-code derivation, ordering) is a separate concern with its own WP shape if it ever changes.

Trigger to revisit:
Never -- see detail above. A future engine change opens its own WP with explicit BC scope.

References:

- `docs/work-packages/session-legibility-and-help-expansion/spec.md` "Out of Scope"

## Locked worktree audit (`worktree-agent-a55453e3`)

Status: Rejected

What was rejected:
An audit of the locked worktree `worktree-agent-a55453e3` as part of this WP.

Why:
That worktree belongs to another agent and is outside the legibility / help scope. Touching it would violate the "mind your own business on other agents' work" rule and pull unrelated cleanup into a content-and-UI WP.

Trigger to revisit:
Never -- see detail above. Cleanup of stale agent worktrees is a separate housekeeping concern surfaced via `/audit-worktrees`, not via a feature WP.

References:

- `docs/work-packages/session-legibility-and-help-expansion/spec.md` "Out of Scope"

## `concept-*` naming convention enforcement

Status: Deferred

What was deferred:
A lint / validator check that all concept page ids start with `concept-`. The convention is documented but not enforced.

Why:
The convention is followed by all ten ships, and a soft rule is sufficient at one-author scale. Adding lint coverage now would be premature when there's no observed drift.

Trigger to revisit:
When a new concept page lands with a non-`concept-*` id, or when the `/help/concepts` index logic starts to rely on the prefix and a typo breaks grouping.

Implementation pattern when triggered:
Add an error in `libs/help/src/validation.ts` mirroring the existing "concept implies helpKind = concept" check: `if (page.concept === true && !page.id.startsWith('concept-')) ...`. Wire into the help-pages validation pass.

References:

- `docs/work-packages/session-legibility-and-help-expansion/spec.md` "Out of Scope"
- `libs/help/src/validation.ts`

## Image hosting / CDN for figures

Status: Deferred

What was deferred:
External image hosting for help-page figures. Figures use in-repo `static/` paths only.

Why:
In-repo figures cover every authored page so far and keep the help library reproducible offline. A CDN adds operational surface (auth, invalidation, regional latency) that isn't justified by current authoring needs.

Trigger to revisit:
When authoring requires images too large for the repo, or when figures need to be shared across apps and a CDN avoids duplication.

Implementation pattern when triggered:
Extend the `figure` AST node in `libs/help/src/markdown/ast.ts` and the validator in `libs/help/src/validation.ts` to accept absolute https URLs from a configured allowlist, mirroring the `externalRefs` URL safety rules.

References:

- `docs/work-packages/session-legibility-and-help-expansion/spec.md` "Out of Scope"

## Analytics on InfoTip opens / PageHelp clicks

Status: Deferred

What was deferred:
Tracking InfoTip opens and PageHelp clicks as engagement signals. The spec calls this out as a possible future signal.

Why:
No analytics surface exists in airboss yet, and adding the first analytics emission inside a help WP would force decisions about backend, privacy, and retention that belong in a dedicated analytics WP.

Trigger to revisit:
When the app adds a real analytics layer, or when help engagement becomes a tracked metric the user wants to optimize against.

Implementation pattern when triggered:
Emit events from `InfoTip` and `PageHelp` through a shared analytics helper (not yet built). Names: `help.infotip.opened`, `help.pagehelp.clicked`, with `helpId` and route as properties.

References:

- `docs/work-packages/session-legibility-and-help-expansion/spec.md` "Out of Scope"
- `libs/ui/src/components/InfoTip.svelte`
- `libs/help/src/ui/PageHelp.svelte`

## `DESIGN_PRINCIPLES.md` addition

Status: Rejected

What was rejected:
Adding a "cross-link to >= 1 concept page" principle (or similar help-authoring principle) to `docs/platform/DESIGN_PRINCIPLES.md` during Phase 5.4.

Why:
The intent is already enforced by the validator (concept pages warn without `externalRefs`). Promoting it to a prose principle would duplicate the rule without adding teeth, and `DESIGN_PRINCIPLES.md` is reserved for principles that aren't already lint-enforced.

Trigger to revisit:
Re-open if a third round of help pages surfaces a durable pattern beyond what the validator covers.

References:

- `docs/work-packages/session-legibility-and-help-expansion/tasks.md` Phase 5.4
- `libs/help/src/validation.ts`

## `docs/agents/help-authoring.md` short doc

Status: Deferred

What was deferred:
A short agent-facing doc at `docs/agents/help-authoring.md` covering callout syntax, externalRefs, and `MarkdownBody`.

Why:
The spec + tasks already document callout syntax, externalRefs, and `MarkdownBody`. Duplicating into an agent doc before a second author exists is speculative.

Trigger to revisit:
When another contributor starts authoring help pages and the spec + tasks are no longer enough.

Implementation pattern when triggered:
Mirror `docs/agents/best-practices.md` shape: short index, code examples, links to the validator output. Reference `libs/help/src/markdown/index.ts` for the supported feature set.

References:

- `docs/work-packages/session-legibility-and-help-expansion/tasks.md` Phase 5.4
