# WP-RMH -- tasks

## Phase 0: spec

- [x] `spec.md`
- [x] `tasks.md`
- [x] `test-plan.md`

## Phase 1: Python pipeline -- `bookmark_chapter_filter` + `primary_cert`

- [ ] Add `bookmark_chapter_filter: str | None` to `HandbookConfig` in
      `tools/handbook-ingest/ingest/config_loader.py`
- [ ] Validate the regex compiles when present
- [ ] Wire it through `_override_edition` carry-forward
- [ ] Apply in `tools/handbook-ingest/ingest/outline.py::parse_outline`:
      when set, drop L1 entries whose title doesn't match plus all of
      their L2/L3 descendants. Counters re-tick across kept L1s.
- [ ] Add `primary_cert: str | None` field to `HandbookConfig`
- [ ] Validate against `CERT_APPLICABILITY_VALUES` (or accept `null`)
- [ ] Write it to `manifest.json` in `normalize.py` next to `subjects`
- [ ] Carry through `_override_edition`

## Phase 2: YAML config

- [ ] Author `scripts/sources/config/handbooks/risk-management.yaml`
- [ ] `document_slug: risk-management`, `edition: FAA-H-8083-2A`
- [ ] `subjects: [human-factors]`, `primary_cert: private`
- [ ] `kind: handbook`, `outline_strategy: bookmark`
- [ ] `bookmark_chapter_filter: '^(Chapter \d+|Appendix [A-Z])\b'`
- [ ] `whole_doc.url` + `source_url` per the FAA URL
- [ ] `excluded_assets: []`, `errata: []`, `dismissed_errata: []`
- [ ] `expected_pages: 80`, `page_offset: 0`
- [ ] No `chapter_pdfs:` block (Class C, no per-chapter PDFs)

## Phase 3: Run extraction

- [ ] `bun run sources download` -- ensures the cache PDF lands at
      `<cache>/handbooks/risk-management/FAA-H-8083-2A/FAA-H-8083-2A.pdf`
      (slug-keyed, not doc_id-keyed)
- [ ] `bun run sources extract handbooks risk-management`
- [ ] Inspect produced manifest -- verify chapter codes 1-12 (8
      chapters + 4 appendices) and `sections[]` populated
- [ ] `bun run sources register handbooks --doc=risk-management
      --edition=8083-2A`

## Phase 4: Remove from handbooks-extras

- [ ] Delete `risk-management` entry from
      `scripts/sources/config/handbooks-extras.yaml`
- [ ] Delete `'faa-h-8083-2'` from `DOC_ID_TO_FRIENDLY` in
      `libs/sources/src/handbooks-extras/ingest.ts`
- [ ] Delete `'risk-management'` from `FRIENDLY_DISPLAY` in same file
- [ ] Delete old whole-doc body:
      `handbooks/risk-management/FAA-H-8083-2A/risk-management-FAA-H-8083-2A.md`

## Phase 5: Update tests + docs

- [ ] `libs/sources/src/handbooks-extras/ingest.test.ts`:
      drop `faa-h-8083-2` from expected `DOC_ID_TO_FRIENDLY` list,
      change `expected count 5 -> 4` everywhere, drop
      `risk-management` slug from existence checks
- [ ] `docs/platform/REFERENCES.md`: RMH row whole-doc -> section-tree

## Phase 6: Verify

- [ ] `bun run check` clean
- [ ] `bun test libs/sources/src/handbooks-extras/`
- [ ] `bun test libs/sources/src/handbooks/`
- [ ] `bun test libs/bc/study/src/seeders/`
- [ ] `bun run db reset --force && bun run db seed` succeeds
- [ ] Spot-check `/library` RMH card has chapter drill-down (manual)

## Phase 7: Ship

- [ ] Push branch + open PR
- [ ] Merge with `gh pr merge --squash`
