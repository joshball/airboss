---
title: 'Section 3 review -- Reference + Sources'
date: 2026-05-17
branch: worktree-agent-ab305d750087a2533
scope: 'libs/sources, apps/flightbag, libs/library, libs/aviation, libs/autocomplete'
status: unread
review_status: done
---

# Section 3 review -- Reference + Sources

A 10x-style review of the FAA reference reading surface and the
source-render/citation pipeline (~73k LOC). Reviewed for correctness,
type safety, security, browser-safety, Svelte 5 pattern compliance,
performance, accessibility, UX states, DX, and test quality.

## Summary

The section is in strong shape. The browser-safety discipline that cost
PRs #857/#921 is now well-internalised: `@ab/sources` keeps a pure runtime
barrel with every `node:fs`-reaching module quarantined in
`@ab/sources/server`, `check-browser-globals` passes, and the barrel
comments document the rationale at each re-export. No `node:fs` leak, no
Svelte 4 patterns, no `.toBeTruthy()`, no skipped/no-op tests, no `any` in
production code without a `biome-ignore` rationale.

Findings are all minor or nit. All fixed.

## Findings

### M1 -- source-pdf path-traversal guard misses the trailing separator

`libs/sources/src/source-pdf.ts` -- `cachedSourcePdfExists` and
`resolveCachedSourcePdfPath` both guard with `abs.startsWith(root)`.
Without a trailing path separator this admits a sibling-directory escape:
a cache root of `/x/cache` accepts a resolved path of `/x/cache-evil/f`.
The `..` rejection blocks the realistic path-segment escape, but the
guard should still match `handbook-asset/[...path]/+server.ts`, which
correctly checks `startsWith(${HANDBOOKS_DIR}/)`. Defense-in-depth +
consistency.

Fix: compare against `root + sep` (and allow the exact-root case).

### M2 -- RichReaderHost leaks the toast timer on destroy

`apps/flightbag/src/lib/RichReaderHost.svelte` -- `toastTimer` is armed
via `setTimeout` in `showToast` but never cleared when the component
unmounts. A toast fired just before navigation leaves a pending timer
writing `$state` on a destroyed component. `<HeartbeatTicker>` in the
same lib does this correctly with `onDestroy`. Fix: clear `toastTimer`
in an `onDestroy`.

### M3 -- computeSiblingNav has no cycle guard

`apps/flightbag/src/lib/section-nav.ts` -- the `visit()` depth-first walk
recurses on `childrenByParent` with no visited-set. A corrupt
`reference_section` row whose `parentId` points at itself or forms a
cycle would recurse until the stack overflows and crash the reader
page-server load. Fix: track visited ids and skip re-entry.

### N4 -- redundant boolean in the registry word-boundary check

`libs/aviation/src/registry.ts` -- `scoreReference` writes
`if (wb === 0 || wb > 0)`, which is just `wb !== -1`. Simplify.

### N5 -- (withdrawn) casts in cards/+server.ts are load-bearing

Initially flagged the `as (typeof DOMAIN_VALUES)[number]` casts in
`apps/flightbag/src/routes/api/cards/+server.ts` as redundant. They are
not: `newCardSchema`'s `cardEnum` defines each field as
`z.enum(DOMAIN_VALUES as [string, ...string[]])`, so `parsed.data.domain`
infers as plain `string`, and the cast is required to satisfy
`CreateCardInput`. The proper fix is to tighten `cardEnum` in
`libs/bc/study/src/validation.ts`, which is outside this section's scope
(bc-study). No change made here.

### N6 -- import.meta probe typed as `any`

`libs/aviation/src/ui/cards/validation.ts` -- `defaultShouldThrow` casts
`import.meta as any` and `process as any` (both with `biome-ignore`).
The shapes are knowable; narrow to a structural type instead of `any` so
the probe stays type-checked.

## Verified clean

- `@ab/sources` / `@ab/aviation` runtime barrels: no value re-export
  reaches `node:fs` / `@ab/db/connection`; `check-browser-globals` green.
- `urlForReference` / `parseIdentifier`: forgiving-by-design, never
  throws, every corpus branch falls back to `FLIGHTBAG_HOME`. No URL
  injection surface -- output is always a `ROUTES.*` value.
- API endpoints (`/api/annotations`, `/api/notes`, `/api/cards`,
  `/api/card-drafts`): all `requireAuth`-gated, Zod-validated, owner-scoped
  mutations, typed-error mapping.
- `handbook-asset` / `source-pdf` streamers: path-traversal guarded (see
  M1 for the one hardening gap), `Readable.toWeb` lifecycle correct.
- `RenderedSection`: the `@html` content flows through `renderMarkdown`'s
  sanitizer; metadata panel escapes via text bindings.
- Autocomplete: APG combobox semantics correct, browser-safe by
  construction.
