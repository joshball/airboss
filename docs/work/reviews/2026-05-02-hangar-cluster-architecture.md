---
title: 'Architecture Review: hangar cluster (chunk 6)'
date: 2026-05-02
feature: hangar-cluster
category: architecture
branch: main
reviewer: architecture
scope: apps/hangar/src, libs/hangar-jobs, libs/hangar-sync, libs/bc/hangar/src
review_status: done
status: unread
counts:
  critical: 1
  major: 4
  minor: 4
  nit: 3
---

# Architecture Review -- hangar cluster

## Summary

The hangar cluster is three packages that nominally form a clean stack:
`apps/hangar` (thin SvelteKit shell) -> `@ab/bc-hangar` (BC writes/reads,
schema, registry, users) -> `@ab/hangar-jobs` (generic queue) plus
`@ab/hangar-sync` (TOML mirror sync, registered as one job handler). Most of
this works. Routes are mostly load-then-render with action handlers that call
BC functions, the BC owns every Drizzle query that touches `hangar.*`,
`hangar-sync` is genuinely surface-agnostic and pure-of-IO at the core
(`executeSync`), and the schema namespace is correct everywhere.

The picture breaks down at three edges:

1. **Three-way package cycle.** `bc-hangar -> hangar-jobs -> bc-hangar`,
   `bc-hangar -> hangar-sync -> bc-hangar`, and
   `hangar-sync -> hangar-jobs -> bc-hangar -> hangar-sync` are all declared
   in `package.json`. Workspace path aliases hide the cycle from the
   TypeScript resolver but the dependency graph is unambiguously circular.
   This is the load-bearing architectural problem.

2. **`@ab/hangar-jobs` is not generic.** The `index.ts` header says "generic
   job queue + streamed log for hangar workloads" but the package imports
   `@ab/bc-hangar/schema` (`hangarJob`, `hangarJobLog`), depends on
   `JOB_KINDS` / `JobKind` (a hangar-specific union in `@ab/constants`),
   writes audit rows tagged `AUDIT_TARGETS.HANGAR_JOB`, and uses
   `generateHangarJobId`. Two of those couplings are unavoidable; the
   schema-import couples a "generic" worker to a specific BC's table layer
   and is the cause of the package cycle above.

3. **A handful of business-logic seams sit in the wrong layer.** The blob
   filesystem walker in `/sources/[id]/files/+page.server.ts`, the
   `aviation.ts` regex parser in `/sources/+page.server.ts`, and the
   reference row-to-form-initial mapper in `/glossary/[id]/+page.server.ts`
   all encode rules that belong in the BC.

`hangar-sync` is the cleanest of the three packages: pure core state
machine, IO funneled through injected writers, no app concerns leaking in.

## Issues

### CRITICAL: package-level circular dependency between bc-hangar, hangar-jobs, and hangar-sync

**File:**

- `libs/bc/hangar/package.json` (depends on `@ab/hangar-jobs`, `@ab/hangar-sync`)
- `libs/hangar-jobs/package.json` (depends on `@ab/bc-hangar`)
- `libs/hangar-sync/package.json` (depends on `@ab/bc-hangar`, `@ab/hangar-jobs`)

**Problem:** All three lib `package.json` declarations form a directed cycle
when read as a graph:

```text
bc-hangar     ->  hangar-jobs  ->  bc-hangar
bc-hangar     ->  hangar-sync  ->  bc-hangar
hangar-sync   ->  hangar-jobs  ->  bc-hangar -> hangar-sync
```

At the source level the cycle is real: `libs/hangar-jobs/src/worker.ts`
imports `hangarJob, hangarJobLog` from `@ab/bc-hangar/schema`,
`libs/hangar-jobs/src/enqueue.ts` imports the same plus row types,
`libs/hangar-jobs/src/types.ts` imports the row types, and
`libs/bc/hangar/src/jobs.ts` re-imports `runSyncJob` from `@ab/hangar-sync`
plus `JobHandlers` from `@ab/hangar-jobs` to assemble the handler map.
Workspace `@ab/*` path aliases let TypeScript resolve everything via files,
which is why nothing breaks today, but the package graph is still
structurally cyclic. Symptoms this hides until something snaps:

- `bun install` resolution order is stable only by accident; any tooling
  that walks the dependency graph (turbo, nx, custom scripts) can deadlock
  or pick a non-deterministic build order.
- Publishing any one of the three (even internally) is impossible without
  pulling the cycle apart first.
- A future contributor who tries to extract `hangar-jobs` to its own
  monorepo position (the comment header explicitly contemplates this --
  "generic job queue infra") cannot do so without the BC schema following
  along.
- IDE "go to definition" works, but circular type instantiation can produce
  inscrutable errors when the row types acquire generics later.

**Rule:** No package may depend on a package that transitively depends on
it. Lib graphs are DAGs.

**Fix:** Break the cycle by making `hangar-jobs` own its own schema (it
already owns the table contract by virtue of the worker being the only
writer for `status`, `progress`, `result`, `error`, `startedAt`, `finishedAt`):

1. Move `hangarJob`, `hangarJobLog`, `HangarJobRow`, `HangarJobLogRow`,
   `NewHangarJobRow`, `NewHangarJobLogRow` from
   `libs/bc/hangar/src/schema.ts` into a new
   `libs/hangar-jobs/src/schema.ts` (using the same `hangarSchema =
   pgSchema(SCHEMAS.HANGAR)` namespace -- the schema namespace is shared,
   the table ownership is not).
2. `bc-hangar` re-exports the job row types from `@ab/hangar-jobs` if
   anything still wants them by their old import path.
3. Drop `@ab/bc-hangar` from `libs/hangar-jobs/package.json`.
4. Move `runSyncJob` registration out of `libs/bc/hangar/src/jobs.ts`. Two
   options:
   - **Preferred:** Have the hangar app assemble the handler map directly
     in `apps/hangar/src/lib/server/jobs.ts` (referenced by the comment in
     `bc/hangar/src/jobs.ts` as the boot site) and pass it to
     `startWorker`. The map is configuration; configuration belongs to the
     surface that consumes it.
   - Alternative: keep the map in `bc-hangar` and move the
     `bc-hangar -> hangar-sync` edge to `app -> hangar-sync` only. Less
     ideal because then bc-hangar still needs `hangar-sync`'s `runSyncJob`
     somewhere.
5. Drop `@ab/hangar-sync` from `libs/bc/hangar/package.json`.

Result: `bc-hangar` depends on `hangar-jobs` (for the row types it queries
in `jobs-queries.ts`); `hangar-sync` depends on `hangar-jobs` (for
`JobContext`); the app depends on all three and assembles the handler map.
DAG, no cycles.

### MAJOR: `@ab/hangar-jobs` claims to be generic infra but couples to bc-hangar's schema

**File:**

- `libs/hangar-jobs/src/index.ts` (comment header)
- `libs/hangar-jobs/src/worker.ts:20`
- `libs/hangar-jobs/src/enqueue.ts:10`
- `libs/hangar-jobs/src/types.ts:6`

**Problem:** The package header reads "generic job queue + streamed log for
hangar workloads" and CLAUDE.md describes it as "generic job queue infra
used by the hangar app". In practice it imports row types from
`@ab/bc-hangar/schema`, which means: the BC owns the worker's storage shape;
the worker can never be reused by a different BC without first lifting the
schema; and the cycle in the issue above exists. Either it is generic (in
which case it owns its tables), or it is hangar-specific (in which case the
"generic" framing is misleading and the file lives in `libs/bc/hangar/`).

**Rule:** A lib's name and header docstring should match its actual coupling.
"Generic infra" means the coupling is to constants + db + utils, not to a
sibling BC's schema.

**Fix:** Pick one. The right choice is "make it actually generic" -- own
the schema (see Critical fix above), keep `JobKind` opaque (a `string`
parameterised by the consumer's union, or a generic on `EnqueueInput<K
extends string>`), and let the BC re-export the typed wrapper.
Alternatively, rename the package to `@ab/hangar-job-runtime` and move it
under `libs/bc/hangar-jobs/` to drop the pretense.

### MAJOR: filesystem traversal + preview building lives in a route, not the BC

**File:** `apps/hangar/src/routes/(app)/sources/[id]/files/+page.server.ts:53-174`

**Problem:** This route encodes substantial domain rules:

- The two layouts of source binaries (text sources at
  `<blob-root>/<type>/<id>.<ext>` vs binary-visual at
  `<blob-root>/<type>/<id>/<edition>/...`).
- Archive identification (`@archived-` substring, `id@` filename prefix).
- Preview-kind dispatch via `EXTENSION_TO_PREVIEW_KIND`.
- Symlink-escape guards (`isInsideRoot`).
- 256 KB preview cap.
- Markdown pre-parse via `@ab/help`'s `parseMarkdown`.

This is not load-shape glue; it is "what files belong to a source on disk
and how do we render them". The BC already owns `resolveHangarBlobRoot()`,
`HANGAR_BLOB_DIR`, the `media`/`edition` JSON shapes, and
`SOURCE_KIND_BY_TYPE`. The walker should live next to them.

**Rule:** Logic in libs, apps as thin shells. Routes call BC functions and
shape the response; they do not own filesystem layout knowledge.

**Fix:** Extract `listSourceFiles(sourceId, { previewBytes? }):
Promise<FileEntry[]>` into `libs/bc/hangar/src/source-files.ts`, including
the layout dispatch, archive flags, and the symlink guard. Keep
`buildEntry`/preview-payload assembly in the BC. The route becomes:

```typescript
const files = await listSourceFiles(event.params.id);
return { source, user, isAdmin: user.role === ROLES.ADMIN, dir: ..., entries: files };
```

The Markdown pre-parse stays in the route or moves to a small helper that
takes raw entries and enriches them; either is fine because it is genuinely
SSR-shaping (not BC) work.

### MAJOR: aviation.ts artifact parsed by regex inside a route loader

**File:** `apps/hangar/src/routes/(app)/sources/+page.server.ts:54-70`

**Problem:** `loadAviationCounts` resolves `libs/aviation/src/references/
aviation.ts` (a generated TypeScript file produced by `hangar-sync`'s
`emitAviationTs`) and runs two regexes against it to count references and
verbatim blocks. The route depends on the generator's output format
indirectly. If `emitAviationTs` ever changes the indentation or the comment
shape (it could -- it is generated and the format is private to the sync
service), the count silently goes wrong with no test catching it.

The same file (aviation.ts) is owned and produced by `hangar-sync`. The
"how many references / verbatims live in the generated artifact" question
either belongs to `hangar-sync` (it produced the file and knows the shape)
or to `@ab/aviation` (the consumer that imports the generated registry and
already knows the count from its own data). The route is the worst layer
to put it in.

**Rule:** Logic in libs, apps as thin shells. Routes do not parse files
authored by a sibling lib.

**Fix:** Two acceptable shapes:

- **Preferred:** Add `countAviationReferences()` /
  `countVerbatimReferences()` to `@ab/aviation` -- it already loads the
  registry at module init via `registerReferences`, so the count is just
  the length of its internal map and the verbatim count is one filter pass.
  The route imports both and the regex parser disappears.
- Alternative: have `hangar-sync` write a `manifest.json` sidecar next to
  `aviation.ts` (similar to the `data/references/manifest.json` already
  consumed) that records the counts at emit time.

### MAJOR: REPO_ROOT computed twice with different ascent counts; both exported

**File:**

- `libs/bc/hangar/src/source-jobs.ts:30-32`
- `libs/hangar-sync/src/paths.ts:21-22`

**Problem:** Both files compute `REPO_ROOT` from `import.meta.url` but ascend
a different number of `..` (4 in source-jobs, 3 in paths). The values
happen to resolve to the same absolute path because the two source files
sit at different depths (`libs/bc/hangar/src/` vs `libs/hangar-sync/src/`),
but the duplication is fragile: any move of either file silently breaks the
constant. `bc-hangar/index.ts:150` re-exports its `REPO_ROOT` and the
hangar app imports it from there to resolve `data/references/manifest.json`
and `libs/aviation/src/references/aviation.ts`, both of which are paths
the BC has no business knowing about. `hangar-sync/index.ts:39` does the
same for sync's own use of `REPO_ROOT`, but those uses are local to sync.

**Rule:** Cross-cutting filesystem constants live in one place. Apps that
need to resolve repo-relative paths use a shared `@ab/utils` or
`@ab/constants` helper, not BC re-exports.

**Fix:**

1. Move `REPO_ROOT` resolution into `@ab/utils` as
   `repoRoot()` (or a constant) using a single computation and a single
   ascent count rooted at the utils file location. `paths.ts` and
   `source-jobs.ts` both consume it.
2. Drop the `REPO_ROOT` re-export from `bc-hangar/index.ts`. The hangar app
   routes that need it import from `@ab/utils`.
3. Remove the two routes' need for `REPO_ROOT` entirely if the related
   "MAJOR: aviation.ts artifact parsed by regex" and the manifest summary
   reads can move into `@ab/aviation` (then nothing in the route needs
   `REPO_ROOT`).

### MINOR: reference row-to-form-initial mapper duplicated in route

**File:** `apps/hangar/src/routes/(app)/glossary/[id]/+page.server.ts:19-56`

**Problem:** `rowToInitial` rebuilds the same `ReferenceFormInitial` shape
the BC already knows about (`EMPTY_REFERENCE_INITIAL`,
`formDataToInitial`). The mapping rules (which keys come from `tags`, how
arrays become comma lists, citation JSON pretty-print) are domain rules
that will need to stay in sync with `validateReferenceForm`'s reverse
mapping. Living in the route invites drift.

**Rule:** Mapping a domain row to its form-initial shape is BC work, not
route work. The BC already owns `formDataToInitial`; its `rowToInitial`
inverse belongs next to it.

**Fix:** Add `referenceRowToInitial(row: HangarReferenceRow):
ReferenceFormInitial` to `libs/bc/hangar/src/reference-form.ts`, export
from the index, replace the route's local function with the import.

### MINOR: `JobKind` defined in `@ab/constants` but represents a hangar-only enum

**File:** `libs/constants/src/jobs.ts:9-27`

**Problem:** `JOB_KINDS` is documented as "Hangar job queue taxonomy" and
its values (`sync-to-disk`, `fetch-source`, `validate-references`, etc.)
are entirely hangar-specific. It sits in `@ab/constants`, the cross-cutting
shared lib, alongside truly cross-cutting things (routes, roles, audit
ops). If/when another app grows a job queue (study? sim?), the union will
have to fork or expand awkwardly.

**Rule:** Constants in `@ab/constants` are cross-cutting. Domain-specific
unions live in the BC that owns them.

**Fix:** Move `JOB_KINDS`, `JobKind`, `JOB_KIND_VALUES` to
`libs/bc/hangar/src/jobs-constants.ts` (or wherever the schema lives after
the Critical fix). `@ab/constants` keeps `JOB_STATUSES` and
`JOB_LOG_STREAMS` (truly cross-cutting; any job queue would have these).
`HANGAR_SYNC_MODES` and `SYNC_OUTCOMES` similarly belong in the BC.

### MINOR: `hangar-sync`'s `jobs.ts` registration in bc-hangar reaches into both the bc and a sibling lib

**File:** `libs/bc/hangar/src/jobs.ts:14-46`

**Problem:** `hangarJobHandlers` is a configuration object that wires
`JOB_KINDS.*` values to handler factories from two libs (`@ab/hangar-sync`
and the BC's own source-jobs/upload-handler). The "configuration is
co-located with the consumers" rule says this map belongs in the surface
that boots the worker, not in a sibling BC. Today the map has to be in
bc-hangar because moving it to `apps/hangar` would force the app to import
`@ab/hangar-sync` directly (fine) and import the source-jobs / upload
handler factories (also fine -- they are already exported from
`@ab/bc-hangar`'s index).

**Rule:** App-shaped configuration belongs to the app, not a BC.

**Fix:** Folded into the Critical fix above; relocating
`hangarJobHandlers` to `apps/hangar/src/lib/server/jobs.ts` is one of the
two ways to break the cycle.

### MINOR: hangar app re-implements job-enqueue error handling at every form action

**File:**

- `apps/hangar/src/routes/(app)/sources/+page.server.ts:161-184`
- `apps/hangar/src/routes/(app)/sources/[id]/+page.server.ts:96-127`
- `apps/hangar/src/routes/(app)/sources/[id]/diff/+page.server.ts:46-89`
- `apps/hangar/src/routes/(app)/sources/[id]/upload/+page.server.ts:88-122`
- `apps/hangar/src/routes/(app)/glossary/+page.server.ts:84-107`

**Problem:** Every "enqueue a job and redirect to its detail page" form
action repeats the same try/catch/log/fail/isRedirect dance. Five copies of
near-identical code. Each one differs slightly (logger name, error message)
which makes drift inevitable.

**Rule:** Repeated route boilerplate is a refactor candidate, not a
pattern. Pull common shapes into helpers.

**Fix:** Introduce a small route helper, either in
`apps/hangar/src/lib/server/jobs.ts` (already named in `bc/hangar/src/
jobs.ts`'s comment but does not exist yet) or as a `enqueueAndRedirect()`
in `@ab/bc-hangar`:

```typescript
async function enqueueAndRedirect(event, input: EnqueueInput): Promise<never> {
  const job = await enqueueJob(input);
  redirect(303, ROUTES.HANGAR_JOB_DETAIL(job.id));
}
```

The route layer collapses to one line per action, with a single shared
catch shape.

### NIT: `hangar-jobs/index.ts` header references "wp-hangar-registry" + "wp-hangar-sources-v1" by codename

**File:** `libs/hangar-jobs/src/index.ts:1-7`

**Problem:** The package header refers to internal work-package codenames.
Future readers who do not have that history will not know what
"wp-hangar-registry" is. The information is true and useful (handlers were
added incrementally), but it should reference the persistent ADR or the
schema, not a transient WP id.

**Fix:** Replace the WP names with a one-line reference to ADR or schema
file: "Handlers are added incrementally; see `libs/bc/hangar/src/jobs.ts`
for the live registry."

### NIT: `hangar-sync/run-sync-job.ts` block comment line "(matches spec + design.md)"

**File:** `libs/hangar-sync/src/run-sync-job.ts:3`

**Problem:** Same as above -- "spec + design.md" without a path. Future
readers will not know which spec.

**Fix:** Replace with the actual link
(`docs/work-packages/hangar-registry/{spec,design}.md` or wherever it
lives).

### NIT: `commitAndMaybePr` uses kebab-case in the type name `CommitAndMaybePrInput` -- the lowercase `Pr` reads ambiguous

**File:** `libs/hangar-sync/src/index.ts:14-16`

**Problem:** `Pr` could be `pr` (pull request), `PR` (acronym), or part of
another word. The function name has clear context but the exported type
name does not. Trivial.

**Fix:** Rename to `CommitAndMaybePRInput` (matching `prUrl` field's
acronym treatment) or to `CommitInput` since "MaybePr" is implicit in the
return shape.

## Status as of 2026-05-04

| Finding                                                               | Verdict         | Closure                                                                                                                                                                                                                      |
| --------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL: 3-way package cycle (bc-hangar / hangar-jobs / hangar-sync) | CLOSED          | PR #435 -- job tables relocated to `libs/hangar-jobs/src/schema.ts`; handler-map assembled in `apps/hangar/src/lib/server/`; `bc-hangar` no longer depends on `hangar-sync`                                                  |
| MAJOR: `@ab/hangar-jobs` not actually generic                         | CLOSED          | PR #435 -- owns its own schema + JobKind opaque to the lib                                                                                                                                                                   |
| MAJOR: filesystem traversal in `/sources/[id]/files` route            | CLOSED          | PR #467 wave -- `listSourceFiles` extracted to BC; route renders the resolved entries                                                                                                                                        |
| MAJOR: aviation.ts artifact parsed by regex                           | CLOSED          | PR #453 -- replaced with `countLiveReferences` / `countVerbatimReferences` (closes both perf and architecture findings together)                                                                                             |
| MAJOR: REPO_ROOT computed twice                                       | OPEN (deferred) | Two ascent-count copies still present (`source-jobs.ts:43` + `paths.ts:22`); tracked as architecture follow-up but path resolves identically and no behavioral risk. Marked done by reviewer at original sweep -- preserved. |
| MINOR: reference row-to-form-initial mapper duplicated in route       | CLOSED          | PR #467 -- `referenceRowToInitial` in `reference-form.ts`                                                                                                                                                                    |
| MINOR: `JobKind` defined in `@ab/constants`                           | CLOSED          | PR #435 -- relocated alongside the schema                                                                                                                                                                                    |
| MINOR: `hangar-sync`'s registration reaches into bc-hangar + sibling  | CLOSED          | PR #435 -- handler map in `apps/hangar/src/lib/server/jobs.ts`                                                                                                                                                               |
| MINOR: enqueue-and-redirect boilerplate duplicated                    | CLOSED          | PR #464 -- `$lib/server/enqueue-and-redirect.ts` shared helper                                                                                                                                                               |
| NIT: `hangar-jobs/index.ts` references WP codenames                   | CLOSED          | PR #467 wave -- replaced with persistent reference to `bc/hangar/src/jobs.ts` registry                                                                                                                                       |
| NIT: `run-sync-job.ts` "spec + design.md" reference                   | CLOSED          | PR #467 wave -- linked to the actual work-package path                                                                                                                                                                       |
| NIT: `CommitAndMaybePrInput` casing                                   | CLOSED          | PR #467 wave -- renamed to `CommitAndMaybePRInput`                                                                                                                                                                           |

Total: 11 closed / 1 deferred-and-marked-done. `review_status` was already `done` at the original sweep -- preserved.
