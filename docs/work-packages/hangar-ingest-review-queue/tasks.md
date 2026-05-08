---
title: 'Tasks: Hangar Ingest-Review Queue'
product: hangar
feature: hangar-ingest-review-queue
type: tasks
status: unread
review_status: pending
---

# Tasks: Hangar Ingest-Review Queue

Sequenced build plan. Each phase is independently shippable. Diff-size estimates are in **lines of code** (added + removed); they describe scope, not duration.

## Phase 1: schema + BC scaffold

Land the data shape and the BC's runtime + server entry points so plugins have a contract to compile against.

| File                                                  | Action | Approx LOC |
| ----------------------------------------------------- | ------ | ---------- |
| `libs/bc/ingest-review/package.json`                  | new    | 20         |
| `libs/bc/ingest-review/src/schema.ts`                 | new    | 140        |
| `libs/bc/ingest-review/src/schema.test.ts`            | new    | 60         |
| `libs/bc/ingest-review/src/index.ts` (runtime barrel) | new    | 40         |
| `libs/bc/ingest-review/src/server.ts` (server barrel) | new    | 30         |
| `libs/bc/ingest-review/src/types.ts`                  | new    | 80         |
| `libs/bc/ingest-review/src/queries.ts`                | new    | 180        |
| `libs/bc/ingest-review/src/queries.test.ts`           | new    | 180        |
| `libs/constants/src/ingest-review.ts`                 | new    | 60         |
| `libs/constants/src/index.ts`                         | edit   | 5          |
| `tsconfig.base.json`                                  | edit   | 3          |
| `drizzle/<NNN>_ingest_review.sql`                     | new    | 60         |

Definition of done:

- [ ] `hangar.ingest_issue` and `hangar.ingest_override` tables defined in `libs/bc/ingest-review/src/schema.ts` with the indexes called out in [design.md](./design.md).
- [ ] Drizzle migration generated and committed.
- [ ] BC ships two barrels: `@ab/bc-ingest-review` (browser-safe, type re-exports + Drizzle table objects) and `@ab/bc-ingest-review/server` (DB-touching helpers). Verified via `scripts/check-browser-globals.ts`.
- [ ] `INGEST_REVIEW` constants added: `KINDS`, `ACTIONS`, `STATUS_VALUES`, `CORPUS_VALUES`. No magic strings in subsequent phases.
- [ ] `bun run check` passes.

## Phase 2: plugin registry + producer pipeline

Build the kind-dispatched plugin runtime and a CLI to run producers against a corpus.

| File                                                                       | Action | Approx LOC |
| -------------------------------------------------------------------------- | ------ | ---------- |
| `libs/bc/ingest-review/src/plugin.ts` (registry + types)                   | new    | 160        |
| `libs/bc/ingest-review/src/plugin.test.ts`                                 | new    | 140        |
| `libs/bc/ingest-review/src/producer.ts` (run-producers helper)             | new    | 100        |
| `libs/bc/ingest-review/src/producer.test.ts`                               | new    | 120        |
| `scripts/ingest-review/run-producers.ts`                                   | new    | 80         |
| `scripts/ingest-review/import-overrides.ts`                                | new    | 120        |
| `scripts/ingest-review/export-overrides.ts`                                | new    | 140        |
| `scripts/ingest-review/yaml-sidecar.ts` (shared serialise / parse helpers) | new    | 110        |
| `scripts/ingest-review/yaml-sidecar.test.ts`                               | new    | 180        |

Definition of done:

- [ ] Plugin registry exports `registerPlugin`, `getPlugin(kind)`, `listPlugins()`. Registry is a module-level constant; import side-effects register each plugin once.
- [ ] `runProducers({ corpus, sourceId? })` walks the registry, calls `produceIssues` for each plugin scoped to the corpus, and upserts via `queries.upsertIssues`.
- [ ] `import-overrides.ts` parses every `<slug>-overrides.yaml` under `scripts/sources/config/handbooks/` and writes `ingest_issue` + `ingest_override` rows. Idempotent: running twice is a no-op on second pass.
- [ ] `export-overrides.ts` reads overrides for one corpus, groups by source, and emits per-handbook YAML. Output is byte-stable (sorted keys + canonical formatting).
- [ ] Both scripts wired into `package.json` dispatchers under `scripts/ingest-review/`.

## Phase 3: caption-orphan plugin

The first concrete plugin. Produces issues for the 21 live `caption-without-figure` residuals.

| File                                                                          | Action | Approx LOC |
| ----------------------------------------------------------------------------- | ------ | ---------- |
| `libs/bc/ingest-review/src/plugins/handbook-caption-orphan.ts`                | new    | 220        |
| `libs/bc/ingest-review/src/plugins/handbook-caption-orphan.test.ts`           | new    | 260        |
| `libs/bc/ingest-review/src/plugins/handbook-shared.ts` (warnings.json reader) | new    | 90         |
| `libs/bc/ingest-review/src/plugins/handbook-shared.test.ts`                   | new    | 100        |
| `libs/bc/ingest-review/src/plugins/index.ts` (registers all plugins)          | new    | 30         |
| `tools/handbook-ingest/ingest/figures.py`                                     | edit   | 60         |
| `tools/handbook-ingest/ingest/figures.test.py` (or new file)                  | edit   | 40         |

Definition of done:

- [ ] `produceIssues` reads `handbooks/<slug>/<edition>/warnings.json` and yields one issue per `caption-without-figure` entry, with `external_id` set to the warnings.json `id` field.
- [ ] `findCandidates` scans `manifest.json` for unpaired figure entries on `page_num +- 2` and returns them in encounter order with thumbnail asset paths resolved against the in-tree `figures/` directory (extracted PNGs already on disk per existing pipeline output).
- [ ] `applyAction` validates the action shape, writes the override row, and (for `pair`) records `image_page` + `image_xref` in the override payload.
- [ ] `serializeForYaml` converts an override into the sidecar shape defined in [design.md](./design.md).
- [ ] `tools/handbook-ingest/ingest/figures.py` consumes the sidecar at the start of `extract_figures`, applying overrides as a fourth tier after the existing geometric tiers.
- [ ] Unit tests cover: empty warnings.json, all-paired warnings.json, mixed, malformed, and a real-world fixture sampled from IFH.

## Phase 4: image-orphan plugin

Symmetric counterpart. Forces the abstraction to handle "needs a caption" alongside "needs an image."

| File                                                              | Action | Approx LOC |
| ----------------------------------------------------------------- | ------ | ---------- |
| `libs/bc/ingest-review/src/plugins/handbook-image-orphan.ts`      | new    | 180        |
| `libs/bc/ingest-review/src/plugins/handbook-image-orphan.test.ts` | new    | 220        |
| `libs/bc/ingest-review/src/plugins/index.ts`                      | edit   | 3          |
| `tools/handbook-ingest/ingest/figures.py`                         | edit   | 30         |

Definition of done:

- [ ] `produceIssues` reads `figure-without-caption` warnings; today this yields zero rows but the test fixture seeds a synthetic one.
- [ ] `findCandidates` returns unpaired captions on `page_num +- 2`.
- [ ] `applyAction` supports `pair`, `mark-extraneous`, `mark-decorative`.
- [ ] `figures.py` consumes the image-orphan side of the sidecar (image-to-caption pairings).
- [ ] Integration test: synthetic warnings.json containing one `figure-without-caption` -> producer creates issue -> applyAction(`pair`) writes override -> export-overrides writes YAML -> figures.py with sidecar applies the pairing -> re-running producer finds zero residuals.

## Phase 5: hangar UI

The route layout, queue page, detail page, and orphan-card component. Layout sketch in [design.md](./design.md).

| File                                                                   | Action | Approx LOC |
| ---------------------------------------------------------------------- | ------ | ---------- |
| `apps/hangar/src/routes/(app)/ingest-review/+layout.server.ts`         | new    | 60         |
| `apps/hangar/src/routes/(app)/ingest-review/+layout.svelte`            | new    | 80         |
| `apps/hangar/src/routes/(app)/ingest-review/+page.server.ts`           | new    | 140        |
| `apps/hangar/src/routes/(app)/ingest-review/+page.svelte`              | new    | 160        |
| `apps/hangar/src/routes/(app)/ingest-review/[issueId]/+page.server.ts` | new    | 180        |
| `apps/hangar/src/routes/(app)/ingest-review/[issueId]/+page.svelte`    | new    | 220        |
| `apps/hangar/src/lib/ingest-review/OrphanCard.svelte`                  | new    | 180        |
| `apps/hangar/src/lib/ingest-review/CandidateStrip.svelte`              | new    | 140        |
| `apps/hangar/src/lib/ingest-review/ActionBar.svelte`                   | new    | 80         |
| `apps/hangar/src/lib/ingest-review/pdf-link.ts` (file:// URL builder)  | new    | 50         |
| `tests/e2e/hangar/ingest-review.spec.ts`                               | new    | 220        |
| `libs/constants/src/routes.ts`                                         | edit   | 15         |

Definition of done:

- [ ] `/ingest-review` lists every issue, grouped by corpus -> source, with status (`unresolved`, `resolved`, `stale`) and a link to the detail page.
- [ ] Filter chips on corpus / kind / status. Search box (text-only) over caption / candidate text.
- [ ] `/ingest-review/<issueId>` renders the orphan card: caption, candidate strip with thumbnails, action bar, "View page N in PDF" link.
- [ ] Action submit -> form action (`?/pair`, `?/markNoFigure`, `?/markFalseCaption`, etc.) -> dispatches through plugin's `applyAction` -> writes override.
- [ ] Authorisation: `requireRole(AUTHOR, OPERATOR, ADMIN)` on every action, mirroring `/review`.
- [ ] All routes via `ROUTES.HANGAR_INGEST_REVIEW*`. No inline path strings.
- [ ] e2e covers: open queue -> click first orphan -> pair with first candidate -> issue moves to resolved -> override row exists.

## Phase 6: YAML round-trip + integration

Wire the export script into the figure-pairing pipeline so a clean re-extract reproduces overrides. Validate the full loop end-to-end.

| File                                                                     | Action | Approx LOC |
| ------------------------------------------------------------------------ | ------ | ---------- |
| `tools/handbook-ingest/ingest/figures.py`                                | edit   | 40         |
| `tools/handbook-ingest/ingest/overrides_loader.py` (new module)          | new    | 120        |
| `tools/handbook-ingest/tests/test_overrides_loader.py`                   | new    | 160        |
| `scripts/sources/config/handbooks/ifh-overrides.yaml` (committed sample) | new    | 1          |
| `docs/products/hangar/PRD.md`                                            | edit   | 20         |
| `docs/products/hangar/TASKS.md`                                          | edit   | 15         |
| `docs/work/NOW.md`                                                       | edit   | 6          |

Definition of done:

- [ ] Manual test plan from [test-plan.md](./test-plan.md) walked end to end against IFH residuals.
- [ ] One real handbook (`ifh`) has its 21 caption-orphans resolved through the UI; export-overrides produces a sidecar; re-extract consumes it; `warnings.json` shows zero residuals for those entries.
- [ ] PRD + TASKS updated to reflect the new surface.
- [ ] Status flipped to `done` per project rules.

## Cross-phase guardrails

- No `any`. No magic strings. Every kind / action / status routed through `INGEST_REVIEW` constants.
- All routes via `ROUTES.HANGAR_INGEST_REVIEW*` (added in Phase 5).
- `@ab/bc-ingest-review` is browser-safe; `@ab/bc-ingest-review/server` holds every DB-touching helper. Verified by `scripts/check-browser-globals.ts` after each phase.
- Drizzle ORM only. No raw SQL except in the migration file (Phase 1).
- IDs minted via `@ab/utils` `createId('issue' | 'override')`. Never `nanoid()` / `ulid()` direct.
- Co-update [docs/products/hangar/PRD.md](../../products/hangar/PRD.md) + [TASKS.md](../../products/hangar/TASKS.md) in Phase 6.
