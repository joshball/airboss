---
title: 'Design: Reference CFR ingestion (bulk)'
product: cross-cutting
feature: reference-cfr-ingestion-bulk
type: design
status: unread
review_status: pending
---

# Design: Reference CFR ingestion (bulk)

## The corpus lives in `libs/sources/src/regs/`

**Question:** Where does the CFR resolver + ingestion code live? A new lib? `libs/aviation/`? Inside `@ab/sources`?

**Chosen:** Inside `@ab/sources`, under a new `regs/` subdirectory. The Phase 2 layout has `libs/sources/src/registry/` for cross-corpus substrate; Phase 3 adds `libs/sources/src/regs/` for the corpus's own implementation. Future corpora (Phase 6 handbooks, Phase 7 AIM, etc.) get their own subdirectories alongside (`libs/sources/src/handbooks/`, `libs/sources/src/aim/`).

**Why:**

- ADR 019 §2 names `@ab/sources` as the lib that owns "the registry" -- including per-corpus resolvers. New lib would split the contract across packages.
- Keeping each corpus in its own subdirectory keeps cross-corpus drift visible: the registry substrate (`registry/`) stays cross-corpus; the corpus subdirectory (`regs/`) stays narrow.
- `libs/aviation/` is for aviation domain logic (units, frequencies, runway math). Regulation ingestion is a content pipeline, not domain logic.
- The Phase 2 import surface (`@ab/sources` exports the registry namespace + `productionRegistry`) extends naturally: Phase 3 adds `import '@ab/sources/regs'` for resolver registration as a side-effect import; the resolver doesn't need to be re-exported because it's looked up via `getCorpusResolver('regs')`.

**Cost accepted:** Eight or so new files under `regs/`. Each has a focused responsibility and its own test file.

## Locator parser returns a richer shape than the Phase 2 default

**Question:** Phase 2's default `parseLocator` returns `{ kind: 'ok', segments: locator.split('/') }`. Phase 3 needs structured access to title/part/subpart/section/paragraph -- the resolver's `getLiveUrl` and the renderer's paragraph descent both consume the structure. Should we keep the segments-array shape and parse on demand, or extend the union?

**Chosen:** Extend the `ParsedLocator` discriminated union with a `regs` payload field. Both branches keep the `segments` array (so the validator's row-1 check is uniform); the second branch adds an optional `regs: { title, part, subpart?, section?, paragraph? }` record that the resolver can read.

```typescript
export type ParsedLocator =
  | { readonly kind: 'ok'; readonly segments: readonly string[] }
  | {
      readonly kind: 'ok';
      readonly segments: readonly string[];
      readonly regs: { /* ... */ };
    };
```

**Why:**

- Re-parsing on every resolver call is wasteful and brittle: every corpus would re-implement segment-counting in three places (resolver, renderer, fix-mode).
- The discriminated union pattern is exactly what Phase 1 set up for. Future corpora extend the union with their own typed payloads (`handbooks: {...}`, `aim: {...}`).
- The Phase 2 `validator.ts` reads `kind: 'ok'` and `segments`; the new branch is structurally compatible because `regs` is optional in TypeScript's structural typing. No Phase 2 test breaks.

**Cost accepted:** One change to `libs/sources/src/types.ts`. Phase 2 import paths unchanged.

## XML walker uses `fast-xml-parser`, streaming-friendly

**Question:** eCFR XML for Title 14 is ~13 MB. Should we use a DOM parser (load it all), a SAX parser (stream events), or something in between?

**Chosen:** `fast-xml-parser` in DOM mode. 13 MB is small relative to Bun's memory footprint; the parser produces a JS object tree we walk with a simple recursive function. SAX would give us streaming but at the cost of state-machine complexity; for one-off ingestion runs the DOM approach wins.

**Why:**

- DOM parsing 13 MB takes <100 ms; a section-level walk over the resulting tree is microseconds. Memory peak is ~50 MB. Acceptable for a CLI run that completes in seconds.
- `fast-xml-parser` is pure JS, Bun-compatible, no native deps. Other XML parsers either need Node-only modules or pull in the full xpath/xslt machinery we don't need.
- Streaming becomes interesting at gigabyte scale. We're a 13 MB ceiling per Title; the entire 50 CFR Titles concatenated wouldn't reach that.

**Cost accepted:** One new dependency in `libs/sources/package.json`. The parser's options surface is small; we set `ignoreAttributes: false`, `attributeNamePrefix: '@_'`, `parseTagValue: false`, and walk the tree.

## eCFR XML element structure

**Question:** What's the actual XML schema we walk?

**Chosen mapping:**

```text
<DIV1 TYPE="TITLE">                               # Title 14
  <HEAD>...title text...</HEAD>
  <DIV3 TYPE="CHAPTER">
    <DIV5 TYPE="PART" N="91">                     # Part 91
      <HEAD>PART 91 -- GENERAL OPERATING AND FLIGHT RULES</HEAD>
      <AUTH>...</AUTH>
      <SOURCE>...</SOURCE>
      <DIV6 TYPE="SUBPART" N="A">                 # Subpart A
        <HEAD>Subpart A -- General</HEAD>
        <DIV8 TYPE="SECTION" N="91.1">            # §91.1
          <HEAD>§ 91.1   Applicability.</HEAD>
          <P>...paragraph...</P>
          <P>(a) ...</P>
          <CITA>[Doc. No. ...; AMDT 91-XXX, 73 FR ..., Aug. 21, 2009]</CITA>
          ...
        </DIV8>
      </DIV6>
    </DIV5>
  </DIV3>
</DIV1>
```

The walker recurses Title -> Chapter -> Part -> Subpart -> Section. The `AMDDATE` we want is buried inside `<CITA>` text; we extract via regex (`/(\w+ \d+, \d{4})\]?\s*$/`) on the trailing date pattern. If extraction fails, default to publication date.

**Why:**

- This is the eCFR schema as published since at least 2010. Versioner XML is stable.
- `<DIV3 TYPE="CHAPTER">` is sometimes skipped (49 CFR Part 830 lives directly under a smaller subchapter); the walker iterates by `TYPE` attribute, not by depth, so it tolerates schema variation.

**Cost accepted:** One regex for `AMDDATE` extraction. Tests against fixture cover the common shapes; defensive fallback to publication date covers the rest.

## Derivative tree shape mirrors the per-edition cache

**Question:** Where do per-section markdown files live in the repo? Per-Title? Per-edition? Flat?

**Chosen:** `regulations/cfr-<title>/<YYYY-MM-DD>/<part>/<section>.md`. One per-edition directory holds every section for that Title at that date. Subpart overview pages live as `<part>/subpart-<letter>.md`.

**Why:**

- Mirrors the cache layout per ADR 018 (`$AIRBOSS_HANDBOOK_CACHE/regulations/cfr-14/<YYYY-MM-DD>/source.xml`). Cache shape and derivative shape match; no surprise.
- Per-edition directory groups files that share a fate: when Phase 5 advances `2026 -> 2027`, the new edition's directory is a fresh sibling of `2026-01-01/`. Diff-friendly.
- `<part>/<section>.md` (e.g. `91/91-103.md`) makes section files trivially greppable by Part. The renderer's path resolution is `regulations/cfr-14/2026-01-01/91/91-103.md`; the resolver builds this from the `SourceId`.

**Cost accepted:** Many small files. ~2,500 sections per Title 14 edition = ~2,500 markdown files. Git handles this fine; the alternative (one giant per-Part file) hurts diff quality more than it saves directory entries.

## Edition slug is the calendar year, not the snapshot date

**Question:** The eCFR Versioner indexes by date (`2026-01-01`, `2026-01-02`, etc.). Authors write `?at=2026`. What goes in the `Edition.id`?

**Chosen:** The calendar year (`'2026'`) is the `Edition.id` (and the slug authors write). The `Edition.published_date` field is the eCFR snapshot date (`new Date('2026-01-01')`).

**Why:**

- ADR 019 §1.3 lists `?at=2026` (year-only) as the CFR pin format. Annual cycle = annual slug.
- Authors don't think in eCFR-Versioner-snapshot dates; they think in years. The discipline of `?at=2026` is light. `?at=2026-01-01` is precise but pedantic.
- Within a calendar year, the eCFR may publish multiple snapshots (correctional patches, errata). The Edition record's `published_date` records the actual snapshot we ingested; `id` stays year-stable for `?at=` matching.
- If a year ever needs sub-year disambiguation (a major mid-year amendment), we'd add a second Edition for the same year with a different `id` (e.g. `2026-q3`). Not required for any historic precedent we know of.

**Cost accepted:** One year corresponds to many possible snapshots in the cache. We pick the latest snapshot for each year; the manifest records which date we ingested.

## Indexed-tier `sections.json` is JSON not Postgres

**Question:** ADR 019 §2.5 names Postgres for the indexed tier. Phase 3 doesn't have schema migrations or a Drizzle table for CFR sections. Postgres-now or JSON-now?

**Chosen:** JSON file per edition (`regulations/cfr-<title>/<YYYY-MM-DD>/sections.json`). The resolver's `getIndexedContent` reads from JSON. Future phase moves to Postgres without changing the resolver contract.

**Why:**

- Postgres-now would block Phase 3 on schema migrations + Drizzle wiring + a `study` BC contribution -- none of which are needed for the validator-facing contract that Phase 3 actually completes.
- The JSON file is the same data Postgres would hold. Renderer uses `getIndexedContent` either way; the read implementation flips when Postgres lands.
- `sections.json` is small (~500 KB per Title edition uncompressed; gzip-friendly via Git's pack format). Committing it is fine.
- Postgres adds value when the indexed tier needs cross-corpus joins, full-text search, or live multi-author reads. Phase 3 has none of those needs.

**Cost accepted:** When Postgres lands for the indexed tier, we run a one-time migration (read JSON, insert rows, drop JSON). Mechanical; no contract change.

## Atomic batch promotion uses placeholder reviewer

**Question:** ADR 019 §2.4 requires a reviewer ID for every promotion. Phase 3 runs unattended ingestion. Who is the reviewer?

**Chosen:** A string constant `PHASE_3_REVIEWER_ID = 'phase-3-bulk-ingestion'`. Every batch the ingestion records uses this. The PR body documents the placeholder; the user can re-promote under his own reviewer ID later via `recordDePromotion` + `recordPromotion`.

**Why:**

- ADR 019's reviewer-ID requirement exists for audit. The placeholder is itself an audit signal: every batch ingested by Phase 3 is identifiable, distinguishable from batches recorded by future hangar-driven curation.
- Hardcoding "Joshua" or "anthropic" would be wrong: this run was the agent acting on Joshua's behalf in a CI-shaped flow, not Joshua personally reviewing each entry.
- The placeholder becomes a real reviewer when `apps/hangar/` ships its registry curation surface (revisit.md R5). Until then, the audit trail is "phase-3-bulk-ingestion ran on date X for edition Y."

**Cost accepted:** The user has to consciously re-promote (or de-promote) any entry he disagrees with; the placeholder is not a personal sign-off.

## Resolver registration is a side-effect import

**Question:** How does the `regs` resolver get registered? An exported function the consumer calls? A side-effect import? An automatic discovery mechanism?

**Chosen:** Side-effect import. `libs/sources/src/regs/index.ts` ends with `registerCorpusResolver(REGS_RESOLVER)`. The Phase 2 lib's `libs/sources/src/index.ts` adds `import './regs/index.ts'` so any consumer that imports `@ab/sources` gets the resolver wired automatically.

**Why:**

- ADR 019 §2.2 explicitly says corpora register their resolver; it doesn't specify the mechanism. Side-effect import is the simplest pattern that doesn't require consumers to know about every corpus.
- Phase 2's test helper `resetRegistry()` calls `__corpus_resolver_internal__.resetToDefaults()` which clears the side-effect registration. Tests that need the real `regs` resolver call `await import('@ab/sources/regs')` (or just import the registration module directly) in their `beforeEach`.
- Tree-shaking concerns are zero for a CLI / Node consumer; if a future surface needs registry-only without the resolvers, it imports `@ab/sources/registry` directly (the registry namespace) and skips the top-level entry point.

**Cost accepted:** One `import './regs/index.ts'` line in `libs/sources/src/index.ts`. Per-corpus phases each add one line.

## Idempotence is the source of truth

**Question:** What's the contract for re-running ingestion on the same edition?

**Chosen:** Re-running with the same `--edition=` is a no-op. The pipeline reads cached XML, regenerates derivatives, hash-compares against on-disk versions, skips writes when content is unchanged, skips `recordPromotion` when entries are already `accepted`.

**Why:**

- Phase 5 (annual diff) re-runs ingestion as a step. Running it twice in a single annual rollover (e.g., once on the candidate snapshot, once after a corrective patch) must not corrupt anything.
- A failed mid-pipeline run (e.g. network glitch on partial fetch) must not leave the registry in an inconsistent state. Idempotence makes recovery trivial: re-run the script.
- The hash compare is real, not just an optimization: if a derivative file's content differs from what the pipeline regenerates, there's a reason -- either the source XML changed, or someone hand-edited the derivative. Either way the discrepancy is loud.

**Cost accepted:** Two SHA-256 computations per section (current content + on-disk content). Sub-millisecond; trivial.

## CLI surface is one bun script, multiple flags

**Question:** Should `cfr-ingest` be a single script or a family (`cfr-ingest`, `cfr-promote`, `cfr-validate`)?

**Chosen:** One script: `bun run sources register cfr`. Flags: `--edition=<YYYY-MM-DD>` (override default of "today"), `--fixture=<path>` (read XML from local file instead of network), `--out=<path>` (override default derivative root), `--help`. The script orchestrates fetch -> walk -> normalize -> write -> populate -> promote in one pass.

**Why:**

- The pipeline's stages are not independently useful. Fetching without walking gets you cached XML. Walking without writing gets you in-memory entries. The combined script is the natural unit.
- Splitting into multiple scripts adds CLI surface area without gain; ADR 019 phasing already gives us "ingestion vs renderer vs diff" separation.
- The script wraps a `runIngestCli(args)` exported from `libs/sources/src/regs/ingest.ts` so tests can call the orchestration directly without spawning a subprocess.

**Cost accepted:** One bun script, ~50 lines including flag parsing.

## CI guard parallels `--fix`'s posture

**Question:** Should ingestion be runnable in CI?

**Chosen:** `cfr-ingest` refuses to run when `process.env.CI === 'true'` AND `--fixture=` is not provided. With `--fixture=`, ingestion is fixture-driven and CI-safe (used by integration tests). Without `--fixture=`, ingestion would hit the live eCFR API; that's an operator action, not a CI action.

**Why:**

- Live ingestion is once-per-year. CI runs hundreds of times per week. Live ingestion has no place in the CI loop.
- Fixture-driven ingestion is what the integration tests actually exercise. They go through the full pipeline against the in-repo fixture XML, so CI reads exactly the path operators read.
- The pattern matches `--fix`'s CI guard from Phase 2: opt-in, local, the operator runs it consciously.

**Cost accepted:** One conditional at the top of `runIngestCli`. The error message names `--fixture=` so a CI run testing the integration path knows what flag to add.
