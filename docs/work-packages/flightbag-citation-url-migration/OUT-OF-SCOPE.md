---
title: 'Out of Scope: Flightbag citation URL migration'
product: study
feature: flightbag-citation-url-migration
type: out-of-scope
status: unread
---

# Out of Scope: Flightbag citation URL migration

Deferred items, why they're deferred, and the trigger that should make us
revisit each. Future agents and humans: do not build these without the
documented trigger. If you think the trigger is hit, surface it for a
decision rather than building silently.

The source is the "Out" subsection of [spec.md](./spec.md) Scope plus the
design-time decisions captured in [design.md](./design.md) "Open questions
resolved during spec authoring."

## Summary

| Item                                                          | Status       | Trigger to revisit                                                                                                |
| ------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Flightbag per-aircraft (POH/AFM) reader surface               | Follow-on WP | When product decides to ship a per-aircraft surface in flightbag, OR when POH usage telemetry shows demand        |
| URL telemetry to measure 301 reduction                        | Deferred     | Post-migration, when we want to quantify the latency win OR confirm no leftover 301 traffic                       |
| Biome rule banning `LIBRARY_*` imports in new code            | Deferred     | Only if a future regression reintroduces a similar pattern -- the Phase E deletion makes the rule redundant today |
| Migration of the 12 already-dead `LIBRARY_*` constants        | Rejected     | Never -- already shipped as PR #976 in parallel                                                                   |
| The 3 incoming-URL pattern-match sites (study redirect hooks) | Rejected     | Never -- those match incoming URLs, not outgoing; literal strings are correct per CLAUDE.md guidance              |
| Retirement of the `/library/*` 301 redirect layer             | Deferred     | When all legacy bookmarks + content-authored links are confirmed migrated, AND a user-impact decision is made     |
| Sweep of remaining `@deprecated LIBRARY_*` constants          | Follow-on WP | After this WP closes, when an agent audits the cert/topic/testing/advisories deprecated names for live callers    |

## Flightbag per-aircraft (POH/AFM) reader surface

Status: Follow-on WP

What was deferred:
Building a `/aircraft/<slug>` reader surface in the flightbag app so POH /
AFM cards can navigate to in-app content. Today the POH card in
`library-card-projection.ts` points at `LIBRARY_AIRCRAFT(slug)` which
resolves to a 410 Gone on study; this WP makes the POH card chrome-only
(`href: null`) until the per-aircraft surface ships.

Why:
The per-aircraft surface is its own product-shape decision (content
sourcing, manufacturer licensing, edition pinning, scoped permissions).
Coupling that surface decision to this URL-migration WP would block both
indefinitely. The chrome-only shape is the minimal honest affordance and
matches the existing `AimCorpusCard` / `AcsCard` / `PtsCard` pattern of
cards that render without a primary in-app `href` until their reader
ships.

Trigger that fires the follow-on:
When product decides to build a flightbag per-aircraft reader, OR when
POH card click-attempt telemetry shows enough demand to justify the
surface. Either signal opens a new WP (likely `flightbag-poh-surface`).

Implementation pattern when triggered:
The new WP authors the flightbag `/aircraft/<slug>` reader. Two changes
land in this WP's territory:

- `urlForReference()` gains an `aircraft` corpus branch returning
  `ROUTES.FLIGHTBAG_AIRCRAFT(slug)` instead of the current
  `ROUTES.FLIGHTBAG_HOME` fallback.
- `library-card-projection.ts` flips the POH variant's `href` from
  `null` back to `urlForReferenceRow(ref)`. One-line projection-shape
  edit; the renderer's `href: string | null` shape stays.

References:

- [spec.md](./spec.md) Decision 2 -- POH chrome-only
- [design.md](./design.md) "Why POH cards go chrome-only"
- [tasks.md](./tasks.md) Phase B.1 / B.2

## URL telemetry to measure 301 reduction

Status: Deferred

What was deferred:
Instrumentation that counts 301 responses on `/library/*` paths over
time so we can quantify the latency reduction from this WP (and confirm
no residual traffic is still hitting the redirect layer from a missed
call site).

Why:
The migration's success criterion is directly observable: open the
network tab on a migrated surface and confirm zero 301 status codes.
Adding telemetry would build a measurement system around a one-time
migration whose answer is "is the redirect gone, yes/no" -- not a
metric we'd graph over time. Telemetry has its own ongoing maintenance
cost; for a one-shot migration that cost outweighs the value.

Trigger to revisit:
Post-migration, IF we want to quantify the cumulative latency win
(e.g., for a product brief or a write-up), OR if we suspect a missed
call site is still emitting `/library/*` URLs and want to confirm at
scale rather than by manual walk.

Implementation pattern when triggered:
Add a request-counter to `apps/study/src/hooks.server.ts` (or wherever
the redirect layer lives) that increments a per-day counter on every
`/library/*` 301. Surface the counter on a `/dev/metrics` page or via
the existing audit log. Burn down to zero, then retire the counter.

References:

- [design.md](./design.md) "Open questions resolved during spec authoring"
- [spec.md](./spec.md) Success criteria

## Biome rule banning `LIBRARY_*` imports in new code

Status: Deferred

What was deferred:
A biome rule (or a `scripts/check-*` lint) that fails the build if any
new code imports a `LIBRARY_*` constant from `@ab/constants`.

Why:
Phase E of this WP deletes the six live-callered `LIBRARY_*` constants
outright. After deletion, the names are no longer importable -- the
TypeScript compiler is the enforcer, and `bun run check` fails any
reintroduction. A biome rule on top of that is redundant.

Trigger to revisit:
If a future regression reintroduces a `LIBRARY_*` constant for any
reason (e.g., a partial revert, a new corpus that needs a transitional
name). The rule becomes worth authoring at that point because the
"constants don't exist" enforcement no longer holds.

Implementation pattern when triggered:
Add a `no-restricted-imports` rule in `biome.json` targeting the
specific constant names. Mirror the existing pattern for other banned
imports (the `scripts/check-browser-globals.ts` walker is the
heaviest-weight precedent; biome's built-in rule is the lighter form).

References:

- [spec.md](./spec.md) "Open questions resolved during spec authoring"
- [tasks.md](./tasks.md) Phase E -- the deletion as enforcement

## Migration of the 12 already-dead `LIBRARY_*` constants

Status: Rejected

What was rejected:
Sweeping the 12 `@deprecated LIBRARY_*` constants in
`libs/constants/src/routes.ts` that have zero live callers as part of
this WP's Phase E.

Why:
Already shipped as PR #976 (`chore(routes): drop 12 dead LIBRARY_*
constants`) in parallel with this WP's authoring. Bundling the dead-code
sweep into this WP would have delayed Phase E close-out behind the
sweep's own grep audit, and the sweep was a pure dead-code removal with
no behaviour change -- it didn't earn a WP.

Trigger to revisit:
Never -- PR #976 closed this work.

References:

- PR #976: <https://github.com/joshball/airboss/pull/976>
- [spec.md](./spec.md) "The six constants in scope" (this WP scopes the
  remaining six with live callers)

## The 3 incoming-URL pattern-match sites (study redirect hooks)

Status: Rejected

What was rejected:
Migrating the three string-literal `/library/*` URL patterns in
`apps/study/src/hooks.server.ts` (and the related redirect handlers
under `apps/study/src/routes/(app)/library/`) to use route constants.

Why:
Those sites match _incoming_ request URLs to decide whether to emit a
301 -- they are not constructing outgoing URLs. CLAUDE.md guidance on
the `ROUTES` constants explicitly covers outgoing URL construction;
incoming-URL pattern matching is a different concern (the literal is
the API contract with the browser, not an internal route reference).
Forcing them through `ROUTES.LIBRARY_*` would re-introduce the
constants this WP is deleting, and the literals are correct as-is.

Trigger to revisit:
Never -- these sites are correctly using literals per CLAUDE.md.

References:

- [spec.md](./spec.md) "The six constants in scope" -- this WP scopes
  outgoing-URL emit sites only
- [CLAUDE.md](../../../CLAUDE.md) Critical Rules -- "All routes go
  through `ROUTES`" (governs outgoing URL construction)

## Retirement of the `/library/*` 301 redirect layer

Status: Deferred

What was deferred:
Removing the 301-redirect handlers in `apps/study/src/hooks.server.ts`
(and any related route handlers under
`apps/study/src/routes/(app)/library/`) entirely, so a `/library/*`
URL returns a 404 instead of a redirect.

Why:
Legacy bookmarks and content authored before WP-FLIGHTBAG-READER-UX
still point at `/library/*` URLs. Retiring the redirect breaks those
bookmarks and any external link the platform has shipped. The user-
facing impact (broken external links) is a separate decision from this
WP's emit-site cleanup, and the right place to make it is its own WP
with deliberate communication / lookback.

Trigger to revisit:
When (a) all legacy bookmark / external-link sources are confirmed
migrated (audit of any shipped content, blog posts, social media,
emails), AND (b) a product decision is made about acceptable bookmark
breakage. Either signal alone is insufficient.

Implementation pattern when triggered:
Delete the redirect logic in `hooks.server.ts`. Delete the
`apps/study/src/routes/(app)/library/` redirect routes if they exist.
Add a 404-with-helpful-message route at `/library/*` so the failure
mode for residual traffic is informative (point at flightbag).

References:

- [spec.md](./spec.md) "Open questions resolved during spec authoring"
  -- "Why not retire the /library/\* redirect entirely after this WP?"
- [design.md](./design.md) -- redirect retirement explicitly out of
  scope

## Sweep of remaining `@deprecated LIBRARY_*` constants

Status: Follow-on WP

What was deferred:
Auditing and retiring the remaining `@deprecated LIBRARY_*` constants
in `libs/constants/src/routes.ts` that aren't covered by this WP's six
or by PR #976's twelve. The remainder span cert / topic / testing /
advisories namespaces.

Why:
This WP names the six constants with live callers in the
citation / library-card emit path. PR #976 cleared 12 dead names. The
remaining `@deprecated LIBRARY_*` names are a mixed group -- some may
have live callers not yet audited; others may be dead code from an
even earlier era. Sweeping them inside this WP would expand scope
without a shared design (their replacement paths aren't all
`urlForReference()`).

Trigger that fires the follow-on:
After this WP closes (Phase E merged). An agent audits the remaining
`@deprecated LIBRARY_*` names: for each, grep for live callers, decide
whether it joins the `urlForReference()` migration or is a pure
dead-code drop. The audit informs whether the follow-on is one PR (all
dead) or another phased WP (callers still exist).

Implementation pattern when triggered:
For each remaining `LIBRARY_*` constant:

- `grep -rn "ROUTES.LIBRARY_<name>" libs/ apps/` -- zero hits = dead
  code, drop as part of PR #976's successor.
- Non-zero hits -- migrate the callers per this WP's Phase B / C / D
  pattern (route through `urlForReference()` or its sibling), then
  drop the constant in a closing PR.

References:

- [tasks.md](./tasks.md) Phase E.2 -- this WP's scope is limited to
  the six named constants
- PR #976 -- the dead-code precedent
