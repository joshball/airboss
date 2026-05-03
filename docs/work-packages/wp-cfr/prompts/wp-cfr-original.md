You are implementing WP-CFR end-to-end. Ship a PR that wires 14 CFR + 49 CFR
through the post-WP-SUB seeder so they land in /library as readable cards
with a part / section drill-down. The repo is shared with many concurrent
agents — you MUST work in your own git worktree, never on the parent main.

## Repo
/Users/joshua/src/_me/aviation/airboss

## Setup (do this first)

```bash
cd /Users/joshua/src/_me/aviation/airboss
git fetch origin
WT_ID="wp-cfr-build-$(date +%s)"
git worktree add -b feat/wp-cfr ".claude/worktrees/$WT_ID" origin/feat/rename-generic-content-files
cd ".claude/worktrees/$WT_ID"
cp /Users/joshua/src/_me/aviation/airboss/.env .env
bun install
```

**Branch base note**: this branches from `feat/rename-generic-content-files`,
not `main`, because the rename WP is in flight and renames every `index.md`
and `document.md` in the inline derivative tree. CFR section bodies (e.g.
`91/91-103.md`) are already self-describing and are NOT touched by the
rename, so this WP's outputs are unchanged. When the rename merges to
main, this branch rebases cleanly.

After setup, verify with `pwd` (must contain `.claude/worktrees/`) and
`git rev-parse --abbrev-ref HEAD` (must be `feat/wp-cfr`). Every subsequent
git/bun command must start with
`cd /Users/joshua/src/_me/aviation/airboss/.claude/worktrees/$WT_ID && ...`.

## Ground truth

Inline derivatives already exist in:

- `regulations/cfr-14/2026-04-22/manifest.json` (Title 14, ~6,328 sections
  across 226 parts, 664 subparts)
- `regulations/cfr-49/2026-04-24/manifest.json` (Title 49, ~30 sections
  across 2 parts -- only 49 CFR Part 1552 + Part 830 are extracted)

Top-level manifest.json shape:

```json
{
  "schemaVersion": 1,
  "title": "14",                         // CFR title number
  "editionSlug": "2026",
  "editionDate": "2026-04-22",
  "sourceUrl": "...",
  "sourceSha256": "...",
  "fetchedAt": "...",
  "partCount": 226,
  "subpartCount": 664,
  "sectionCount": 6328
}
```

Per-section data lives in a sibling `sections.json` keyed by part number:

```json
{
  "schemaVersion": 1,
  "edition": "2026",
  "sectionsByPart": {
    "1": [
      { "id": "airboss-ref:regs/cfr-14/1/3",
        "canonical_short": "§1.3",
        "canonical_title": "Rules of construction",
        "last_amended_date": "2024-11-21",
        "body_path": "1/1-3.md",
        "body_sha256": "..."
      },
      ...
    ],
    "3": [...],
    ...
  }
}
```

Section bodies live at `<corpusDir>/<edition-date>/<part>/<section>.md`,
e.g. `regulations/cfr-14/2026-04-22/91/91-103.md`.

The DB already holds 11 `study.reference` rows with `kind='cfr'`:
14cfr14, 14cfr23, 14cfr61, 14cfr68, 14cfr71, 14cfr73, 14cfr91, 14cfr135,
14cfr141, 49cfr1552, 49cfr830. Each is a card per part (per the
library-completeness §3.A ratification: "Part-level for CFR-14, title-level
for CFR-49"). All 11 are link-only today.

## Decisions to take at WP-author time

This is the heaviest seed of the bunch. **6,328 sections in CFR-14 alone**.
Read carefully:

- **Manifest shape**: `kind: 'cfr'` is a NEW discriminator member. The
  on-disk top-level manifest.json doesn't have `kind` today; you'll need
  to add `"kind": "cfr"` to both manifests AND update the CFR ingest
  writer (under `libs/sources/src/regs/`) so re-runs include the field.
  Same migration pattern as WP-AC and WP-AIM.

- **Granularity (§3.A ratification)**: one DB `reference` per Part for
  CFR-14, one per Title for CFR-49. The 11 existing DB rows already
  encode this; respect them. Each reference's content is a flat list of
  sections under that part (CFR-14) or all sections in the title
  (CFR-49).

- **section_schema**: `{ levels: ['part', 'subpart', 'section', 'paragraph',
  'subparagraph', 'clause'], strict_sequence: false }`. Asymmetric: some
  parts have subparts, some are flat. Loose form per the
  library-completeness spec §1 ("CFR uses the loose form because their
  hierarchies are asymmetric").

- **What lands as `reference_section` rows**: per Part (CFR-14) or per
  Title (CFR-49):
  - Optional: skip subpart rows for now (subpart is a grouping construct,
    not a separately-citable unit); just lay down the section rows
    directly under the reference.
  - Section rows: depth 0, level `'section'`, code = canonical_short
    (e.g. `'§91.103'`), title = canonical_title, content_md = the body
    file, content_hash = body_sha256.
  - Skip paragraph/subparagraph/clause rows for the first cut. Section is
    the citable unit; paragraphs are addressed inline within the section
    body. (Future WP can expand if needed.)

- **Seed adapter**: NEW `libs/bc/study/src/seeders/cfr.ts`. Pattern is
  unique enough that it's its own adapter, not a section-tree reuse.
  - Top-level manifest tells you which title (14 or 49) and edition.
  - sections.json tells you the parts and their sections.
  - For each Part with a matching DB row (look up by document_slug like
    `14cfr91`), produce N section rows (one per section in
    `sectionsByPart[part]`).
  - Idempotent on body_sha256.

- **No search UI** in this WP. Library-completeness §3.B ratified
  "search-first inside CFR drill-down", but UI is a separate concern.
  This WP just gets the rows into the DB. Search wires up in a follow-up.

- **DB-side mapping**: the 11 existing CFR DB rows have document_slug
  like `14cfr91`. The manifest tells you `title='14'` and the
  sections.json tells you the part numbers. Build a deterministic
  mapping: `(title, part) -> document_slug`:
  - CFR-14: `14cfr<part>` (e.g. `14cfr91`).
  - CFR-49: NOT per-part. CFR-49 is title-level: all extracted sections
    (Part 1552 + Part 830) land under a SINGLE reference. But the DB
    has TWO rows: `49cfr1552` and `49cfr830`. So 49 is per-part too,
    just only 2 parts are extracted. **Treat CFR-49 the same as CFR-14**:
    one reference per part, parts seeded only when sections.json has
    them. The library-completeness §3.A ratification said "title-level
    for CFR-49" but the DB and on-disk reality is per-part for the
    extracted parts. Resolve in favor of the existing DB shape — don't
    refactor it in this WP.

- **What about the 200+ unextracted CFR-14 parts?** The 11 DB rows cover
  the major pilot-facing parts (1, 23, 61, 68, 71, 73, 91, 135, 141)
  plus the random ones (14). The other ~217 parts in sections.json have
  no DB row. **Do NOT auto-create reference rows for them in this WP.**
  Stick to seeding sections under the 11 existing rows. Surface in the
  spec that the long-tail parts are out of scope (they're regulator-
  facing rules pilots almost never cite — Part 33 engine certification,
  Part 27 helicopter certification, etc.).

## Authoring the WP

Before writing code, author the spec at `docs/work-packages/wp-cfr/`:

- `spec.md` — decisions above, ground-truth counts, in-scope vs out-of-scope
- `tasks.md` — phased implementation
- `test-plan.md` — what to verify

Commit the spec docs first.

## Implementation order

### Phase 1: manifest schema

Add `cfrManifestSchema` to `libs/bc/study/src/manifest-validation.ts`.
Discriminator `kind: 'cfr'`. The schema covers the TOP-LEVEL manifest.json
(title, editionSlug, editionDate, fetchedAt, partCount, etc.) NOT the
sections.json. The sections.json is data the seed adapter loads
separately, not part of the manifest discriminator.

Add to `manifestSchema = z.discriminatedUnion('kind', [...])`. Export
`CfrManifest` type.

Also add a `cfrSectionsFileSchema` (separate, not part of the discriminator)
that validates sections.json shape:
`{ schemaVersion, edition, sectionsByPart: Record<string, Section[]> }`.

### Phase 2: seed adapter

Create `libs/bc/study/src/seeders/cfr.ts` exporting
`seedCfrManifest(manifest, context, summary): Promise<string[]>`. Returns
multiple reference IDs (one per part), unlike whole-doc/aim which return
one.

Reasoning for plural return: the dispatcher in
`scripts/db/seed-references-from-manifest.ts` collects ref IDs into
`seededReferenceIds` per document slug for supersede chains. CFR is one
manifest producing N references (one per Part). Look at how the dispatcher
handles handbooks-extras (one manifest per friendly slug per edition) and
extend the contract: section-tree/whole-doc/aim adapters return a single
string; CFR returns an array. Update the dispatcher's expected shape.

Logic:

1. Load `<corpusDir>/<edition>/sections.json`.
2. For each `part` key in `sectionsByPart`:
   - Compute `document_slug = '<title>cfr<part>'` (e.g. `14cfr91`).
   - Check if a DB row exists for that slug. If not, skip with a log
     line (out of scope per spec).
   - If yes, upsert `reference` (preserves YAML-authored metadata) with
     section_schema set; then insert one `reference_section` per
     section in the array. Body comes from
     `<corpusDir>/<edition>/<body_path>`. Idempotent on body_sha256.
3. Return the list of reference IDs.

### Phase 3: dispatcher wiring

Add `case 'cfr':` to the dispatch in
`scripts/db/seed-references-from-manifest.ts`. Note the seed adapter
returns `string[]` not `string`; the dispatch loop needs to handle both
shapes. Either:

- Wrap `seedAimManifest` etc. to return single-element arrays,
  uniformizing the contract.
- Add a separate code path for multi-result adapters.

Pick the cleaner option (probably option 1 — uniform contract).

Add `'regulations'` to `CORPUS_DIRS`. The CFR corpus uses
`regulations/cfr-14/<edition>/manifest.json` — note the `cfr-14` segment
between the corpus dir and the edition. That's a multi-doc layout where
the "doc" is the title (`cfr-14` / `cfr-49`). Verify the dispatcher's
walker handles this; extend if needed.

### Phase 4: backfill manifests

Add `"kind": "cfr"` to:

- `regulations/cfr-14/2026-04-22/manifest.json`
- `regulations/cfr-49/2026-04-24/manifest.json`

Update the CFR ingest writer at `libs/sources/src/regs/` (find the
manifest-write site) so re-runs always author the field.

**Do NOT modify `libs/sources/src/regs/derivative-writer.ts` lines that
write `<part>/index.md`** (the part-overview body-path logic, around
line 137). Those paths are known-generic and are flagged for a separate
`regs-derivative-cleanup` WP. This WP touches only the manifest-write
function (where the `kind: 'cfr'` field is added). Leave the
body-path-writing logic alone — if you can't tell which is which, ask;
don't refactor adjacent code.

The 11 existing DB rows already have `subjects` and `primary_cert` from
`course/references/*.yaml`. The seed adapter does NOT overwrite — it
just produces sections under each existing reference.

### Phase 5: verify

```bash
bun run check                                # 0 errors, 0 warnings
bun test libs/bc/study/src/                  # all green
bun run db reset --force
bun run db seed
```

DB-side acceptance:

- The 11 `study.reference WHERE kind='cfr'` rows now have section_schema
  populated and section counts matching `sectionsByPart`:
  - 14cfr1, 14cfr23, 14cfr61, 14cfr68, 14cfr71, 14cfr73, 14cfr91,
    14cfr135, 14cfr141 (each has its own section count from the JSON)
  - 14cfr14 — verify if Part 14 is in sectionsByPart; if not, this row
    stays at 0 sections (might be a mismatched stub)
  - 49cfr1552, 49cfr830 — should each have their sections seeded
- `getReadableReferenceIds()` returns IDs for parts with seeded sections.
- Spot-check: 14 CFR §91.103 ("Preflight action") body renders.
- Total sections seeded: probably in the 1,500-2,500 range (the 11 parts
  combined, not all 6,328 sections in the title).

`/library`: the 11 CFR cards now show "Read in-app" and clicking opens the
section list for that part.

### Phase 6: tests

- `manifest-validation.test.ts`: parse the on-disk CFR-14 + CFR-49
  manifests through `manifestSchema`. Validate sections.json against
  `cfrSectionsFileSchema`.
- `seed-references-from-manifest.test.ts`: synthetic CFR manifest +
  sections.json with 1 part + 2 sections → 1 reference + 2 sections.
  Idempotency: re-run produces 0 changes.

### Phase 7: ship

- Commit cadence: one per phase. Stage explicitly.
- `bun run check` clean.
- Push, open PR titled
  `feat(study): WP-CFR -- 11 CFR parts seeded with section drill-down`.
- Body: spec link, per-part section count table, total seeded count,
  test-plan checklist, explicit note that search UI + long-tail parts
  are out of scope.
- Merge with `gh pr merge <num> --squash`. Do NOT pass `--delete-branch`.

After merge, leave worktree in place. Return path + branch + PR URL.
Do NOT pull main.

## Constraints

- No `any`. No magic strings. All literals from `libs/constants/`.
- Cross-lib imports use `@ab/*` aliases.
- Drizzle ORM only.
- Biome formatting.
- Stage individual files; never `git add .`.
- This is a HEAVY seed (1,500-2,500 sections). The seed adapter should
  batch inserts where possible. Look at how `section-tree.ts` handles
  PHAK's 850 sections — mirror that pattern.

## Final report (under 400 words)

- PR URL + commit hashes
- Per-part section count table
- Total CFR sections seeded
- Worktree path + branch name
- Any deviations from this prompt
- Any 14cfr_xx parts that didn't seed (and why — likely no matching
  sectionsByPart key)
- Any surprises in the manifest or sections.json shape
- Whether the CFR-49 title-level vs per-part thing is fully resolved
  (confirm 49cfr1552 and 49cfr830 each seed their own sections)

If you hit a blocker, STOP and report — don't push broken code.
