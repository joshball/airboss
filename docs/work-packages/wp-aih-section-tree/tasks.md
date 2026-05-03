---
title: 'WP-AIH -- tasks'
product: study
feature: wp-aih-section-tree
type: tasks
status: unread
review_status: pending
created: 2026-05-02
---

# WP-AIH -- tasks

One commit per phase per the parent work package brief.

## Phase 0 -- spec docs

- [x] Author `spec.md`, `tasks.md`, `test-plan.md` under `docs/work-packages/wp-aih-section-tree/`.

## Phase 1 -- handbook YAML + plugin

- [x] Author `scripts/sources/config/handbooks/aviation-instructor.yaml` (Class A2; chapter PDFs + ancillaries; `outline_strategy: bookmark`; `section_strategy: toc`).
- [x] Author `tools/handbook-ingest/ingest/handbooks/aviation_instructor.py` (discovery URL + addendum/errata patterns).
- [x] Register the plugin in `tools/handbook-ingest/ingest/handbooks/__init__.py`.
- [x] `bun run sources verify-urls` passes for the new YAML rows.

## Phase 2 -- download + extract

- [x] `bun run sources download --corpus=handbooks` fetches all chapter PDFs + ancillaries to the cache.
- [x] `bun run sources extract handbooks aviation-instructor --edition FAA-H-8083-9` produces per-chapter section bodies + a `sections[]` manifest.
- [x] Spot-checked chapter 1 (Use of Resources / Internal / External Resources / Workload Management) and chapter 9 -- L4/L5 content rolled into parent subsection bodies; no critical content loss.

## Phase 3 -- remove from handbooks-extras

- [x] Delete the `faa-h-8083-9` row from `scripts/sources/config/handbooks-extras.yaml`.
- [x] Delete `'faa-h-8083-9'` mapping from `DOC_ID_TO_FRIENDLY` in `libs/sources/src/handbooks-extras/ingest.ts`.
- [x] Delete `'aviation-instructor'` from `FRIENDLY_DISPLAY` in the same file.
- [x] Delete the old whole-doc body file at `handbooks/aviation-instructor/FAA-H-8083-9/aviation-instructor-FAA-H-8083-9.md`.
- [x] Update `libs/sources/src/handbooks-extras/ingest.test.ts` (count + id list + slug-presence loop).
- [x] Update `scripts/sources/config/loader.test.ts` (extras count + id list).
- [x] Drive-by fix: `tools/handbook-ingest/ingest/cli.py` `_override_edition` rebuilt the dataclass field-by-field and was silently dropping `subjects` (and 4 other fields) on every `--edition` run. Replaced with `dataclasses.replace`.

## Phase 4 -- verify

- [x] `bun run check` clean.
- [x] `bun test libs/sources/src/` green (1252 pass, 1 skip).
- [x] `bun test libs/bc/study/src/` green (554 pass).
- [x] `bun run db reset --force && bun run db seed` -- handbooks step seeds 419 AIH sections (CFR-49 §830 unrelated environmental failure on this machine, not from this WP).
- [ ] Manual: `/library` AIH card drills into chapters and sections (user smoke).

## Phase 5 -- tests + docs

- [x] Flip the `aviation-instructor` fixture in `libs/bc/study/src/manifest-validation.test.ts` from `whole-doc` to `handbook`.
- [x] Update `docs/platform/REFERENCES.md` AIH row to "readable, section-tree" with section counts; flip roadmap row 5 to shipped.
- [x] Set this WP's status to "shipped".
