# WP-IPH -- test plan

Manual test plan. The user runs every step; nothing ships until they pass.

## Setup

```bash
cd ~/src/_me/aviation/airboss
git switch feat/wp-iph-section-tree
bun install
```

## 1 -- TS lint + typecheck

```bash
bun run check
```

Pass = 0 errors, 0 warnings.

## 2 -- handbook URL verification

```bash
bun run sources verify-urls
```

Pass = no IPH-related errors. The 7 chapter PDFs, 4 ancillaries, and
whole-doc PDF all resolve to 200 / HEAD success.

## 3 -- chapter-PDF download

```bash
bun run sources download --only handbooks
```

Pass: cache populates `~/Documents/airboss-handbook-cache/handbooks/iph/FAA-H-8083-16B/`
with `FAA-H-8083-16B.pdf`, `FAA-H-8083-16B-ch01..07.pdf`, and the four
ancillary PDFs (`FAA-H-8083-16B-front.pdf`,
`FAA-H-8083-16B-toc.pdf`, `FAA-H-8083-16B-glossary.pdf`,
`FAA-H-8083-16B-appendix-A.pdf`,
`FAA-H-8083-16B-appendix-B.pdf`).

## 4 -- handbook extract

```bash
bun run sources extract handbooks iph --edition FAA-H-8083-16B
```

Pass:

- Outputs `handbooks/iph/FAA-H-8083-16B/manifest.json` with
  non-empty `sections[]`.
- 7 chapter directories under `handbooks/iph/FAA-H-8083-16B/`.
- One `00-<slug>.md` chapter overview per chapter.
- Per-section markdown files under each chapter directory.
- No fatal errors. Section-warning count is reported but not fatal.

## 5 -- vitest

```bash
bunx vitest run libs/sources
```

Pass:

- The smoke test in `libs/sources/src/handbooks-extras/ingest.test.ts`
  reports `report.ingested === 4` (was 5).
- The new manifest-validation test in
  `libs/sources/src/handbooks/iph-manifest.test.ts` (or co-located in
  `derivative-reader.test.ts`) passes.
- All other handbook tests continue to pass.

## 6 -- DB reset + seed

```bash
bun run db reset
bun run db seed
```

Pass: seed completes without IPH-related errors. Spot-check:

```bash
psql -p 5435 airboss -c "SELECT id, canonical_short FROM source_entries WHERE id LIKE 'airboss-ref:handbooks/iph/%' ORDER BY id LIMIT 10;"
```

Expected: rows like `airboss-ref:handbooks/iph/8083-16B/1`,
`.../1/1`, `.../1/2`, ... with `canonical_short = 'IPH Ch.1'`,
`'IPH Ch.1.1'`, etc.

## 7 -- /library card + drill-down

```bash
bun run dev:study
```

Open <http://localhost:5173/library>. Find the IPH card. Click into it.

Pass:

- Card renders "Instrument Procedures Handbook" title with the
  section-tree drill-down (chapters 1..7 listed; expand each to see
  sections and subsections).
- Clicking into a chapter opens its overview body with section
  navigation, not the old whole-doc dump.

## 8 -- citation reseeding

Manual sanity check that lessons referencing IPH continue to resolve:

```bash
grep -rn "airboss-ref:handbooks/iph/" course/ acs/ ac/ 2>/dev/null | head -10
```

For each unique locator, hit it via the dev server and verify the
section body renders.

## 9 -- regression spot-check on sibling handbooks

```bash
bunx vitest run libs/sources/src/handbooks
```

Pass: PHAK / AFH / AVWX behavior unchanged (no DOC_DISPLAY/locator
collisions introduced by the migration).
