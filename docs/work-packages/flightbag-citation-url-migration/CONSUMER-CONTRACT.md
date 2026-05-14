---
title: 'flightbag-citation-url-migration -- consumer contract for citation URL emission'
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-14
owner: agent
---

# Consumer contract: citation URL emission post-migration

This WP changes the URL-emission shape every citation chip, library
card, help-search result, and handbook tree node uses. The change is
internal (no DB schema; no UI text), but consumers that previously
imported `ROUTES.LIBRARY_*` or called the help loaders by their old
return shape must adapt. This doc spells out the post-migration
contracts callers can rely on.

## Scope

When any surface needs a flightbag URL for a reference -- a citation
chip resolving a structured citation, a library card emitting its
primary href, a help-search result item linking to its source, a
handbook tree node linking to a chapter / section -- the surface calls
exactly one helper: `urlForReference(uri)` (or `urlForReferenceRow(row)`
when it has a `ReferenceRow` instead of a URI string).

The helper is pure (no DB, no fs, no `node:*`), safe to call at
hydration time inside a `.svelte` component. The output is always a
path; the call site applies the cross-origin wrap when rendering
from a non-flightbag app.

## Imports

```typescript
// Browser-safe (the consumer's .svelte component or pure helper):
import { urlForReference, urlForReferenceRow } from '@ab/sources';
import { siblingOrigin, HOST_PREFIXES } from '@ab/constants';

// Type-only (anywhere):
import type { ReferenceRow } from '@ab/bc-study';
```

`urlForReference()` was already shipped at
`libs/sources/src/url-for-reference.ts`. This WP adds the
`urlForReferenceRow()` sibling and adopts both as the single URL
helpers for citation surfaces. Both are pure helpers re-exported
from the runtime barrel `@ab/sources`.

## Data shapes

### `airboss-ref:` URI (input to `urlForReference`)

The canonical structured-citation URI scheme. Stored on every
`reference_section.airbossRef` column and on every citation row's
`canonical_uri`. Shape varies by corpus:

| Corpus      | URI shape                                   | Example                                   |
| ----------- | ------------------------------------------- | ----------------------------------------- |
| Handbook    | `airboss-ref:handbooks/<slug>/<edition>`    | `airboss-ref:handbooks/afh/FAA-H-8083-3B` |
| CFR section | `airboss-ref:regs/<title>/<part>/<section>` | `airboss-ref:regs/14/91/103`              |
| AIM section | `airboss-ref:aim/<chapter>/<section>`       | `airboss-ref:aim/4/1`                     |
| AC          | `airboss-ref:ac/<doc>/<revision>`           | `airboss-ref:ac/00-6/B`                   |
| ACS         | `airboss-ref:acs/<slug>`                    | `airboss-ref:acs/private-pilot-airplane`  |

Additional segments (chapter, section, paragraph) are appended for
deeper locators. The full grammar lives in
`libs/sources/src/airboss-ref.ts`.

### `ReferenceRow` (input to `urlForReferenceRow`)

The Drizzle `$inferSelect` of `study.reference`. Re-exported as a type
from `@ab/bc-study`. Consumers usually only read `kind`,
`documentSlug`, `edition`; the helper handles the kind-switch
internally.

### Helper output

```typescript
type CitationUrl = string;
```

A path-only URL. Always starts with `/` (e.g., `/handbook/afh/FAA-H-8083-3B`,
`/cfr/14/91/103`). No origin. No protocol. The caller prepends the
flightbag origin when rendering from a non-flightbag app via
`siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG)`.

For inputs the helper cannot route (POH / AFM rows today, malformed
URIs, missing edition on a handbook), the helper falls back to
`ROUTES.FLIGHTBAG_HOME`. Consumers must NOT special-case "fallback"
URLs -- a fallback is a valid flightbag URL.

### POH card `href: null` contract

The one consumer shape change that propagates beyond the helper: the
`PohCard` variant of `LibraryCardPayload` (from
`libs/bc/study/src/library-card-projection.ts`) now emits
`href: string | null`. When `href === null`, the card renderer MUST
render the card body as chrome (a `<div>` or non-`<a>` element);
the manufacturer-labelled `external` link on the card is preserved
verbatim.

No other card variant gains a nullable `href`. Handbook / CFR / AIM /
AC / ACS card variants continue to emit a non-null `href` string.

## The two functions

### `urlForReference(uri)` (browser-safe)

```typescript
function urlForReference(uri: string): string;
```

Parses an `airboss-ref:` URI, dispatches per-corpus to the right
`ROUTES.FLIGHTBAG_*` route function, returns the resulting path.
Falls back to `ROUTES.FLIGHTBAG_HOME` on:

- Malformed URI (missing scheme, invalid corpus segment).
- Missing edition on a handbook URI (the locator parser flags it).
- Corpus not yet routable on flightbag (POH today).

Same input -> same output. No mutation. Pure.

Recommended consumer pattern -- citation chip in a `.svelte` file:

```svelte
<script lang="ts">
  import { urlForReference } from '@ab/sources';
  import { siblingOrigin, HOST_PREFIXES } from '@ab/constants';
  import { page } from '$app/state';

  let { citation }: { citation: { canonicalUri: string; label: string } } = $props();

  const path = $derived(urlForReference(citation.canonicalUri));
  const href = $derived(`${siblingOrigin(page.url, HOST_PREFIXES.FLIGHTBAG)}${path}`);
</script>

<a {href}>{citation.label}</a>
```

### `urlForReferenceRow(row)` (browser-safe)

```typescript
function urlForReferenceRow(row: ReferenceRow): string;
```

Thin shim over `urlForReference()` for callers that have a
`ReferenceRow` instead of a URI. Builds the URI internally from
`row.kind` + `row.documentSlug` + `row.edition`, then delegates.

The shim is the right entry point when the caller already loaded
the row from `study.reference` (library-card-projection,
HandbookCard, HandbookChapterListItem, HandbookSectionListItem,
build-handbook-tree). Callers that have only a citation URI (the
citation-chip resolver in `references.ts`, the help loaders'
`reference_section.airboss_ref` join) use `urlForReference()`
directly.

Same falls-back-to-`FLIGHTBAG_HOME` behaviour as the underlying
helper for POH / SAFO / INFO / NTSB rows that don't have a flightbag
route today.

Recommended consumer pattern -- library card in a `.svelte` file
(study app rendering cross-origin to flightbag):

```svelte
<script lang="ts">
  import { urlForReferenceRow } from '@ab/sources';
  import { siblingOrigin, HOST_PREFIXES } from '@ab/constants';
  import { page } from '$app/state';
  import type { ReferenceRow } from '@ab/bc-study';

  let { reference }: { reference: ReferenceRow } = $props();

  const path = $derived(urlForReferenceRow(reference));
  const href = $derived(`${siblingOrigin(page.url, HOST_PREFIXES.FLIGHTBAG)}${path}`);
</script>

<a {href}>{reference.title}</a>
```

## Cross-origin wrap

The helpers return paths, not full URLs. The reason: the helpers are
pure and have no `url` access. The call site holds the request `url`
and applies the cross-origin prefix.

Rule:

- **Rendering inside the study / hangar / sim apps:** prefix the path
  with `siblingOrigin(page.url, HOST_PREFIXES.FLIGHTBAG)`. The result
  is a fully-qualified URL on the flightbag origin.
- **Rendering inside the flightbag app:** use the path verbatim
  (same-origin). No prefix.

The `siblingOrigin()` helper handles dev (different ports), preview
(different sub-domains), and prod (different hosts) consistently
from the request `url`. It is in `@ab/constants` and documented at
`libs/constants/src/routes.ts` line 389.

Never prefix manually with a hardcoded origin string. Never call
`urlForReference()` on the server and embed the result in a string
template that includes the origin -- the wrap must happen at the
render site so it sees the request `url`.

## Constants no longer importable

After Phase E ships, the following constants are deleted from
`libs/constants/src/routes.ts`:

- `LIBRARY`
- `LIBRARY_REGULATIONS_SECTION`
- `LIBRARY_HANDBOOK`
- `LIBRARY_HANDBOOK_CHAPTER`
- `LIBRARY_HANDBOOK_SECTION`
- `LIBRARY_AIRCRAFT`

No consumer should import these names. `LIBRARY_STATE` (a non-route
enum constant at line 86) is unaffected and remains importable.

## Help-loader projection shape

The four help loaders (`cfr-sections.ts`, `aim-sections.ts`,
`handbook-sections.ts`, `fts-passages.ts` in `libs/help/src/loaders/`)
emit `SearchResult` items with an `href: string` field. After this WP:

- `href` is always a path-only flightbag URL (or `FLIGHTBAG_HOME`
  fallback) produced by `urlForReference()`.
- The loader does NOT apply the cross-origin prefix. Loaders run
  server-side without a stable request `url`; the rendering surface
  (help drawer, search palette) applies `siblingOrigin()` at the
  consumer's render site.
- Loader signatures gain a `request.url` argument only if the loader
  needs to apply the prefix itself (none today; the consumer-side
  pattern is the default).

## Guarantees

1. **The helpers are pure.** Same inputs -> same outputs. No DB / fs
  / node:\* dependency. Safe to call inline in a `.svelte` component
  on every render.
2. **The helpers are browser-safe.** `check-browser-globals.ts` walks
  `@ab/sources` runtime barrel and validates the transitive import
  chain. Future agents adding to the helpers must keep them clean.
3. **Path-only output.** Consumers control origin prefixing. The
  helpers never embed a hardcoded host.
4. **Fallback is a valid URL.** When the helper can't route an input,
  it returns `ROUTES.FLIGHTBAG_HOME`. Consumers do not need to guard
  for the helper returning `null` or throwing -- it never does.
5. **Stable shapes.** The `airboss-ref:` URI grammar is governed by
  `libs/sources/src/airboss-ref.ts`. Additions (new corpora, new
  locators) are additive. The `ReferenceRow` shape is governed by
  the Drizzle schema; field additions are additive.
6. **POH `href: null` is the only nullable card href.** Other card
  variants continue to emit a non-null string. The renderer's
  affordance for "card without primary link" already exists in the
  shipped pattern (`AimCorpusCard`, `AcsCard`, `PtsCard`).

## Lifecycle notes

- `bun run check` enforces the import discipline. Any reintroduction
  of `LIBRARY_*` after Phase E lands fails the TypeScript compile
  (the names no longer exist).
- The 301-redirect layer in `apps/study/src/hooks.server.ts` remains
  in place during and after this WP. Legacy bookmarks continue to
  redirect to flightbag. Retiring the redirect is captured in
  [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md) with its own trigger.
- New corpora landing in flightbag (per-aircraft surface, SAFO live
  route, NTSB-ALJ) add one branch in `urlForReference()` and
  `urlForReferenceRow()`. Every existing consumer picks up the new
  URL automatically -- no consumer-side changes required.

## Example: end-to-end binding for a hypothetical new surface

A future consumer building a "recent citations" page on the study
app that lists each citation as a clickable link:

```svelte
<!-- apps/study/src/routes/(app)/recent-citations/+page.svelte -->
<script lang="ts">
  import { urlForReference } from '@ab/sources';
  import { siblingOrigin, HOST_PREFIXES } from '@ab/constants';
  import { page } from '$app/state';

  let { data }: { data: { citations: { canonicalUri: string; label: string }[] } } = $props();
</script>

<ul>
  {#each data.citations as citation}
    {@const path = urlForReference(citation.canonicalUri)}
    {@const href = `${siblingOrigin(page.url, HOST_PREFIXES.FLIGHTBAG)}${path}`}
    <li><a {href}>{citation.label}</a></li>
  {/each}
</ul>
```

The surface touches the helper once per citation. The page server
file does not need to import anything URL-related -- the URL
construction is entirely client-side and entirely pure. The
flightbag origin resolves from `page.url`, so the same code works in
dev, preview, and prod without environment-specific config.
