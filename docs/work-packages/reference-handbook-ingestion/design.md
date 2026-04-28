---
title: 'Design: Reference handbook ingestion'
product: cross-cutting
feature: reference-handbook-ingestion
type: design
status: unread
review_status: pending
---

# Design: Reference handbook ingestion

## The corpus lives in `libs/sources/src/handbooks/`

**Question:** Where does the handbook resolver + ingest code live? Same answer as Phase 3.

**Chosen:** Inside `@ab/sources`, under a new `handbooks/` subdirectory. Mirrors `libs/sources/src/regs/` from Phase 3.

**Why:**

- ADR 019 §2 names `@ab/sources` as the lib that owns the registry plus per-corpus resolvers. Putting the handbook resolver elsewhere would split the contract.
- Each corpus in its own subdirectory keeps cross-corpus drift visible. The substrate (`registry/`) stays cross-corpus; corpora (`regs/`, `handbooks/`) stay narrow.
- Phase 3 already proved the pattern. Phase 6 follows it; Phase 7 (AIM) and Phase 8 (AC) will, too.

**Cost accepted:** Eight or so new files under `handbooks/`, each with a focused responsibility and its own test file.

## We consume PR #242's derivatives -- we do not re-ingest

**Question:** ADR 016 phase 0 (PR #242) shipped a Python pipeline at `tools/handbook-ingest/` that fetches PDFs, extracts markdown / figures / tables, and writes per-handbook `manifest.json`. Should Phase 6 wrap that pipeline, run it, or read its output?

**Chosen:** Read its output. Phase 6's CLI walks the existing on-disk derivative tree. It does not run the Python pipeline; it does not re-fetch source bytes.

**Why:**

- The Python pipeline's job is "PDF -> derivatives". The TS resolver's job is "derivatives -> registry entries + render-time content". These are separate concerns.
- The Python pipeline is non-deterministic in places (PDF extraction quality varies by FAA's typesetting), so making the TS path depend on a re-run would conflate "did the registry update?" with "did extraction quality change?". Keeping them separate makes each side debuggable.
- The user-facing workflow is: (1) operator runs `bun run sources extract handbooks --doc=phak` to fetch + extract (Python), (2) operator runs `bun run sources register handbooks --doc=phak` to register (TS). Step 2 is what Phase 6 ships. Step 1 is unchanged from PR #242.

**Cost accepted:** Two CLIs, but with clear responsibility split. The naming `handbook-corpus-ingest` distinguishes from PR #242's `handbook-ingest`.

## Locator parser returns a richer shape with `handbooks` payload

**Question:** Phase 3 extended `ParsedLocator` with an optional `regs` payload. Phase 6 needs the same for `handbooks` (doc + edition + chapter + section + subsection + paragraph). Same approach?

**Chosen:** Yes. Extend the `ParsedLocator` discriminated union with an optional `handbooks` payload, parallel to `regs`.

```typescript
export type ParsedLocator = {
  readonly kind: 'ok';
  readonly segments: readonly string[];
  readonly regs?: ParsedRegsLocator;
  readonly handbooks?: ParsedHandbooksLocator;
};

export interface ParsedHandbooksLocator {
  readonly doc: string;        // 'phak', 'afh', 'avwx'
  readonly edition: string;    // '8083-25C', '8083-3C', '8083-28B'
  readonly chapter?: string;   // '12'
  readonly section?: string;   // '3' or 'intro'
  readonly subsection?: string; // '2' (when locator is .../12/3/2)
  readonly paragraph?: string; // 'para-2' (resolves to section)
  readonly figure?: string;    // 'fig-12-7' (no registry entry)
  readonly table?: string;     // 'tbl-12-3' (no registry entry)
}
```

**Why:**

- Re-parsing on every resolver call is wasteful and brittle. Phase 3 made the same call.
- The discriminated union pattern accepts arbitrary corpus payloads. Phase 7 (`aim`), Phase 8 (`ac`), Phase 10 (irregulars) will each add their own.
- The Phase 1 + 2 validator code reads only `kind: 'ok'` and `segments`. The new `handbooks` field is optional, so no Phase 1-5 test breaks.

**Cost accepted:** One change to `libs/sources/src/types.ts`. Phase 1-5 import paths unchanged.

## Edition slug strips the `FAA-H-` prefix

**Question:** ADR 016 phase 0 wrote derivatives under `handbooks/phak/FAA-H-8083-25C/`. ADR 019 §1.2 specifies the locator uses `8083-25C` (without prefix). How do we reconcile?

**Chosen:** The locator (and the registry edition slug) drop the `FAA-H-` prefix. The on-disk directory keeps the full FAA filename. The resolver maps short -> long with a per-doc constant.

**Why:**

- ADR 019 §1.2 explicitly shows `phak/8083-25C/12/3` (no prefix). That's the canonical form.
- The on-disk path is what the FAA shipped (the PDF was named `FAA-H-8083-25C.pdf`). Renaming would lose provenance.
- A small mapping table in the resolver bridges the two. The mapping is per-doc because some FAA handbooks (e.g. AC 00-6B) use different prefixes.

**Cost accepted:** A `DOC_EDITIONS` constant in `resolver.ts` keying short edition slug to on-disk dir name.

## `manifest.json` is the single source of truth for derivative metadata

**Question:** PR #242 wrote per-handbook `manifest.json` plus per-section markdown / per-figure PNG / per-table HTML. Should Phase 6 read the manifest, or walk the file tree directly?

**Chosen:** Read the manifest. It contains every section's level + code + parent_code + title + body_path + content_hash + has_figures + has_tables. Walking the file tree would re-derive that information and risk drift.

**Why:**

- The manifest is structured data. Walking the tree is unstructured (filename parsing). Whenever the ingestion pipeline changes its filename convention, the resolver would break.
- The manifest's `content_hash` is a real signal Phase 6 can use later for change detection (similar to Phase 3's hash compare on regeneration).
- The manifest's `source_url` + `fetched_at` are the only places that record provenance. Phase 6 needs both for `Edition.source_url` and `Edition.published_date`.

**Cost accepted:** None. Reading the manifest is two lines (`readFileSync` + `JSON.parse`).

## Figures and tables parse but do not get registry entries

**Question:** ADR 019 §1.2 lists `airboss-ref:handbooks/phak/8083-25C/fig-12-7` and `tbl-12-3` as valid identifiers. Should they be registry entries (so `hasEntry` returns true) or only addressable derivative files?

**Chosen:** Parse-only. `parseLocator` accepts the shapes; the resolver returns `null` from `getEntry` for figures and tables. The renderer (Phase 4) descends to the derivative file when a `@text` / `@quote` token binds.

**Why:**

- The manifest doesn't enumerate figures or tables as `sections[]` entries -- only `has_figures: true` flags. Adding registry entries for every figure would require a second pass over the figures directory.
- Figures and tables don't have titles in the same way sections do. The on-disk filename (`fig-12-7-the-coriolis-force-curves-each-air-particle-...png`) is descriptive but not curated.
- The publish gate is satisfied as long as `parseLocator` succeeds. The validator's row-2 check (entry not in registry) would fire if we added `hasEntry` enforcement, but the canonical form is to mark figures / tables as "no entry but locator valid". Same approach Phase 3 takes for paragraphs (`/103/b/1/i` parses but resolves to the `103` section's entry).
- If a figure / table needs richer metadata later, it can be added to a follow-up phase without breaking Phase 6.

**Cost accepted:** Authors who want to deep-link a figure type a slightly longer URL than they could if figures were registry entries. The resolver still produces a usable URL via `getLiveUrl`.

## Atomic batch promotion uses `phase-6-handbook-ingestion` reviewer

**Question:** Phase 3 used `phase-3-bulk-ingestion` as the reviewer ID. What does Phase 6 use?

**Chosen:** `phase-6-handbook-ingestion`. Per-doc, not per-phase: each handbook (`phak`, `afh`, `avwx`) gets its own batch, so a re-ingest of just one doc doesn't promote the others.

**Why:**

- Per-phase reviewer IDs are the established convention. Phase 3 had one because all of Title 14 + 49.830 + 49.1552 were ingested together.
- Per-doc batching is cleaner: re-running with `--doc=avwx` only promotes AvWX entries; PHAK + AFH stay untouched.
- The batch's `inputSource` field records the manifest path for traceability.

**Cost accepted:** None. The `recordPromotion` API already supports per-batch scope.

## CLI exposed as `handbook-corpus-ingest`

**Question:** PR #242 already named its CLI `handbook-ingest`. What does Phase 6's CLI name?

**Chosen:** `handbook-corpus-ingest`. The "corpus" qualifier signals "register into the @ab/sources corpus" rather than "fetch + extract from PDF".

**Why:**

- `handbook-ingest` is taken (PR #242). Reusing the name would force one or the other to rename.
- "corpus-ingest" matches the @ab/sources mental model: the corpus is the registry-side noun. Phase 7's CLI will follow this pattern (`aim-corpus-ingest`).
- Pairing the names in the operator workflow is intentional: `bun run sources extract handbooks --doc=phak` then `bun run sources register handbooks --doc=phak` -- two ergonomic commands that compose.

**Cost accepted:** Two CLI commands instead of one. The split mirrors the actual concern boundary.

## Idempotence by registry overlay, not file hash

**Question:** Phase 3 made re-ingest idempotent by hash-comparing regenerated derivatives against on-disk versions. Phase 6 doesn't regenerate anything. What's idempotent here?

**Chosen:** Lifecycle overlay. On re-run, walk the manifest, check each section's lifecycle via `getEntryLifecycle`. Skip the entry if already `accepted`. Skip the batch promotion entirely if every entry in scope is already `accepted`.

**Why:**

- Without regeneration there's nothing to hash-compare. The only side effect is registry mutation.
- The lifecycle overlay (Phase 2) already provides the data. No new state needed.
- Re-running a no-op CLI is a common operator pattern (smoke-test the pipeline). The CLI prints "0 entries ingested, N already accepted" so the operator sees what happened.

**Cost accepted:** None. The lifecycle check is one function call per entry.
