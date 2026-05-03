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

- [ ] Author `scripts/sources/config/handbooks/aviation-instructor.yaml` (Class A2; chapter PDFs + ancillaries; `outline_strategy: bookmark`; `section_strategy: toc`).
- [ ] Author `tools/handbook-ingest/ingest/handbooks/aviation_instructor.py` (discovery URL + addendum/errata patterns).
- [ ] Register the plugin in `tools/handbook-ingest/ingest/handbooks/__init__.py`.
- [ ] `bun run sources verify-urls` passes for the new YAML rows.

## Phase 2 -- download + extract

- [ ] `bun run sources download --only handbooks` fetches all chapter PDFs + ancillaries to the cache.
- [ ] `bun run sources extract handbooks aviation-instructor --edition FAA-H-8083-9` produces per-chapter section bodies + a `sections[]` manifest.
- [ ] Spot-check chapter 1 and chapter 9 for L4/L5 -> L3 flatten loss; flag if critical.

## Phase 3 -- remove from handbooks-extras

- [ ] Delete the `faa-h-8083-9` row from `scripts/sources/config/handbooks-extras.yaml`.
- [ ] Delete `'faa-h-8083-9'` mapping from `DOC_ID_TO_FRIENDLY` in `libs/sources/src/handbooks-extras/ingest.ts`.
- [ ] Delete `'aviation-instructor'` from `FRIENDLY_DISPLAY` in the same file.
- [ ] Delete the old whole-doc body file at `handbooks/aviation-instructor/FAA-H-8083-9/aviation-instructor-FAA-H-8083-9.md`.
- [ ] Update `libs/sources/src/handbooks-extras/ingest.test.ts` (count + id list + slug-presence loop).
- [ ] Update `scripts/sources/config/loader.test.ts` (extras count + id list).

## Phase 4 -- verify

- [ ] `bun run check` clean.
- [ ] `bun test libs/sources/src/` green.
- [ ] `bun test libs/bc/study/src/` green.
- [ ] `bun run db reset --force && bun run db seed` clean.
- [ ] `/library` AIH card drills into chapters and sections.

## Phase 5 -- tests + docs

- [ ] Flip the `aviation-instructor` fixture in `libs/bc/study/src/manifest-validation.test.ts` from `whole-doc` to `handbook`.
- [ ] Update `docs/platform/REFERENCES.md` AIH row to "readable, section-tree" with chapter + section counts.
- [ ] Set this WP's status to "shipped" once merged.
