---
feature: sources-content-pipeline
category: architecture
date: 2026-05-01
branch: feat/library-substrate-rename
issues_found: 11
critical: 0
major: 4
minor: 5
nit: 2
---

## Summary

The post-ADR-022 pipeline (`scripts/sources/` + `tools/handbook-ingest/` + `libs/sources/`) is mostly clean: TS owns network I/O, Python owns extraction, YAML config in one place is the single source of truth, the `chapter_plaintext.py` boundary is a structural early-return (not a flag), and the `@ab/sources/render` contract (`extractIdentifiers` + `batchResolve` + `substituteTokens`) is consumed by every render surface. ADR 021's one-shot migration script `migrate-cache-flat.ts` is gone as required, the lifecycle state machine is centralized in one module, and the `unknown:` magic prefix is correctly handled in the validator's row-0 carve-out without a `CorpusResolver`.

The dominant findings are: (1) a parallel pre-ADR-018 source-registry pipeline still lives in `libs/aviation/src/sources/` + `scripts/references/` + `data/sources/` with hardcoded in-repo paths that contradict ADR 018; (2) `ENUMERATED_CORPORA` is a hard-coded array that adding a corpus must edit, undermining ADR 019 §2.1's "corpus is a string, not a closed enum" promise; (3) `defaultCacheRoot()` is re-implemented in five places across the corpus pipelines; and (4) `.gitattributes` / `.gitignore` only carry dormant plumbing for `handbooks/**/*.pdf` and `regulations/cfr-*/**/*.xml`, not for the post-ADR-021 corpora (`ac/`, `acs/`, `aim/`).

## Issues

### MAJOR: Parallel source registry pipeline contradicts ADR 018 storage policy

- **File**: `/Users/joshua/src/_me/aviation/airboss/libs/aviation/src/sources/registry.ts:33-194`, `/Users/joshua/src/_me/aviation/airboss/data/sources/README.md`, `/Users/joshua/src/_me/aviation/airboss/scripts/references/{download,extract,size-report,validate}.ts`
- **Problem**: A pre-ADR-018 pipeline still lives alongside the post-ADR-018/019/022 pipeline. `libs/aviation/src/sources/registry.ts` carries 15 hardcoded `Source` entries with `path: 'data/sources/cfr/cfr-14.xml'`, `path: 'data/sources/aim/aim-current.pdf'`, etc. -- explicitly in-repo paths that ADR 018 forbids ("Source documents... live in a developer-local cache directory **outside the repo**"). `data/sources/README.md` still tells contributors to download FAA PDFs there. `scripts/references/size-report.ts`'s entire purpose is to inventory `data/sources/` against an LFS / external-storage threshold that ADR 018 explicitly rejected. The hangar BC (`libs/bc/hangar/src/source-fetch.ts`) currently writes binary-visual chart fetches to `data/sources/<type>/<id>/<edition>/chart.zip` via the `@ab/aviation/sources` machinery, so the parallel path is not dead code -- it is the active sectional-chart pipeline.
- **Rule**: ADR 018 §1 ("Source documents... in `$AIRBOSS_HANDBOOK_CACHE/` outside repo"); ADR 022's "TS owns network I/O; Python owns extraction" is supposed to be the only download path.
- **Fix**: Decide and act in one of two directions. Either: (a) treat `libs/aviation/src/sources/` as the legacy and write a follow-on WP that migrates `libs/bc/hangar/source-fetch.ts` (sectionals + binary-visual fetch) onto `scripts/sources/download/` + `libs/sources/src/sectionals/`, then delete `libs/aviation/src/sources/` + `scripts/references/extract.ts` + `scripts/references/size-report.ts` + the `data/sources/` tree; or (b) author an ADR that explicitly carves out `data/sources/` as the binary-visual / sectional / hangar-fetched-binaries tier (different from the textual ADR-018 corpora) and amend ADR 018 §1 to acknowledge it. Picking (b) without an ADR amendment leaves us with two contradictory storage policies that future agents will mistake for each other.

### MAJOR: `ENUMERATED_CORPORA` is a closed enum; new corpus requires multi-file edit

- **File**: `/Users/joshua/src/_me/aviation/airboss/libs/sources/src/registry/corpus-resolver.ts:57-75`, `/Users/joshua/src/_me/aviation/airboss/libs/sources/src/index.ts:14-40`, `/Users/joshua/src/_me/aviation/airboss/libs/sources/src/types.ts:183-222`
- **Problem**: ADR 019 §2.1 says "`corpus` is a string, not a closed enum. New corpus = new resolver registration; no constants change." The implementation contradicts this. (1) `ENUMERATED_CORPORA: readonly string[]` is hardcoded in `corpus-resolver.ts`; the validator's row-1 check uses `isEnumeratedCorpus` which only returns true for entries in this list. The "default no-op resolver" loop seeds only this list. Adding a new corpus requires editing this constant. (2) `libs/sources/src/index.ts` carries a hardcoded set of `import './<corpus>/index.ts'` side-effect imports; new corpus = new import. (3) `ParsedLocator` in `types.ts` carries an open key per corpus (`regs?: ParsedRegsLocator`, `aim?: ParsedAimLocator`, ...); a new corpus must either add a key here or accept that its richer locator payload is invisible to type-aware callers. So adding a corpus requires three coordinated edits, not "just a new resolver registration." That violates the seam ADR 019 §2 promised.
- **Rule**: ADR 019 §2.1, §2.2 -- corpus is a string; new corpus = new resolver registration only.
- **Fix**: Make `isCorpusKnown` query the resolver map (`RESOLVERS.has(corpus)`) directly without the parallel `ENUMERATED_CORPORA` array. Replace the eager seeding loop with lazy default-resolver creation in `getCorpusResolver`. Move the side-effect imports to a generated barrel (e.g. `index.gen.ts` regenerated by a script that walks `libs/sources/src/<corpus>/index.ts`), or accept that a new corpus adds one import line and document that explicitly. The `ParsedLocator` discriminated-union shape is the harder one -- making it open without losing type safety needs either a per-corpus module-augmentation pattern (`declare module` extension) or accepting that the type-narrow path is a per-corpus opt-in.

### MAJOR: `.gitattributes` / `.gitignore` lines missing for post-ADR-021 corpora

- **File**: `/Users/joshua/src/_me/aviation/airboss/.gitattributes:11-12`, `/Users/joshua/src/_me/aviation/airboss/.gitignore:41-42`
- **Problem**: ADR 018 says "Adding a new content corpus = one `.gitattributes` line + one `.gitignore` line + cache subdirectory." Only `handbooks/**/*.pdf` and `regulations/cfr-*/**/*.xml` are listed. Since ADR 021 (Apr 29) the cache layout names `ac/<doc-id>.pdf`, `acs/<doc-id>.pdf`, `aim/<edition>.pdf` -- and the in-repo derivative trees `ac/`, `acs/`, `aim/` exist (they hold derivatives, not source PDFs). If a developer accidentally drops a PDF at `<repo>/ac/61-65.pdf` or `<repo>/aim/aim.pdf`, gitignore won't block it. The dormant LFS plumbing also won't activate when the policy flips. ADR 022 also added `<repo>/handbooks/<slug>/<edition>/<edition>-ch<NN>.pdf` (chapter PDFs) and `aim/chap<CC>_section_<SS>.html` (AIM HTML) -- the existing `handbooks/**/*.pdf` line covers the chapter PDFs, but the AIM HTML is unblocked.
- **Rule**: ADR 018 acceptance criteria + ADR 022 "Adding a new content corpus is still one `.gitattributes` line + one `.gitignore` line + cache subdirectory."
- **Fix**: Add per-corpus lines: `ac/**/*.pdf`, `acs/**/*.pdf`, `aim/**/*.pdf`, `aim/**/*.html` to both `.gitignore` and `.gitattributes` (LFS filter dormant plumbing) at repo root. Verify with the migration playbook in ADR 018 ("What flips Flavor D to actual LFS") that future activation is still a one-line `.gitignore` removal per corpus.

### MAJOR: `data/sources/` parallel registry uses `nanoid`-style hardcoded path strings (no constants, no aliases)

- **File**: `/Users/joshua/src/_me/aviation/airboss/libs/aviation/src/sources/registry.ts:33,44,55,66,77,88,103,113,123,135,146,157,168,179,190`
- **Problem**: Each `Source` row carries a literal string path like `'data/sources/cfr/cfr-14.xml'`. Project rules ("All literal values in `libs/constants/`. Enums, routes, ports, config" + "All routes go through `ROUTES`...") say this kind of string-as-path doesn't get inlined. Even for the legacy pipeline, the path should be a constant or computed via a helper (`buildLegacySourcePath('cfr', 'cfr-14.xml')`). Today's shape ships 15 separate string literals; a path-format change touches 15 places.
- **Rule**: CLAUDE.md "No magic strings. No magic numbers. Use `libs/constants/`." plus ADR 018 (the path string itself is a deprecated tier marker, not just a magic string).
- **Fix**: This converges with the major finding above; the right fix is to retire `libs/aviation/src/sources/registry.ts` once the hangar BC migrates. If retirement is not in scope this WP, the interim fix is to introduce a `LEGACY_SOURCES_ROOT = 'data/sources'` constant in `libs/constants/` and route every entry through `buildLegacyPath(LEGACY_SOURCES_ROOT, 'cfr', 'cfr-14.xml')` to localize the format.

### MINOR: `defaultCacheRoot()` reimplemented in five places

- **File**: `/Users/joshua/src/_me/aviation/airboss/libs/sources/src/regs/cache.ts:47-57`, `/Users/joshua/src/_me/aviation/airboss/libs/sources/src/ac/ingest.ts:445-447`, `/Users/joshua/src/_me/aviation/airboss/libs/sources/src/acs/ingest.ts:935-937`, `/Users/joshua/src/_me/aviation/airboss/libs/sources/src/handbooks-extras/ingest.ts:397-399`, `/Users/joshua/src/_me/aviation/airboss/libs/sources/src/aim/source-ingest.ts:39-41`
- **Problem**: Every per-corpus ingest module re-implements the same logic: read `process.env.AIRBOSS_HANDBOOK_CACHE`, fall back to `~/Documents/airboss-handbook-cache/`. `regs/cache.ts` adds `mkdirSync`; the other four don't. None reuses any of the others. The Python side (`tools/handbook-ingest/ingest/paths.py:cache_root()`) already lives in one helper. The TS side should mirror that.
- **Rule**: DRY; common util. ADR 018 / 021 describe the cache as one tier with one root.
- **Fix**: Add `getCacheRoot()` (and `getCorpusCacheDir(corpus)`) to a shared util in `libs/sources/src/` or `libs/utils/`. Replace the five duplicates. Co-locate `expandHome` (currently only in `regs/cache.ts`) so future callers consistently expand `~/` from env-var values.

### MINOR: AIM source-ingest re-declares manifest types instead of importing from downloader

- **File**: `/Users/joshua/src/_me/aviation/airboss/libs/sources/src/aim/source-ingest.ts:43-89`
- **Problem**: `aim/source-ingest.ts` defines its own local `DownloaderManifest`, `CorpusManifestFile`, `readCorpusManifest`, and `validateEntry` instead of importing the matching shapes from `scripts/sources/download/manifest.ts` (the writer of the manifest). The two files describe the same on-disk JSON shape independently. If the downloader changes a field, this consumer drifts silently.
- **Rule**: Single source of truth per logical entity (ADR 022 §"YAML config consolidation" rationale generalizes to manifests).
- **Fix**: Lift the `CorpusManifestFile` / `ManifestEntry` types to a shared module that both `scripts/sources/download/manifest.ts` and `libs/sources/src/aim/source-ingest.ts` import. Likely candidate: a `manifest.ts` under `libs/sources/src/` that both sides depend on; the writer and reader pick up the same type.

### MINOR: `regs/cache.ts` duplicates URL-build / fetch logic with `scripts/sources/download/`

- **File**: `/Users/joshua/src/_me/aviation/airboss/libs/sources/src/regs/cache.ts:21,79-130`, `/Users/joshua/src/_me/aviation/airboss/scripts/sources/download/{ecfr,plans,execute}.ts`
- **Problem**: `libs/sources/src/regs/cache.ts` carries its own `ECFR_BASE` constant, its own `buildEcfrUrl`, its own fetch invocation, and its own write-to-cache logic. `scripts/sources/download/` does the same against the same eCFR Versioner endpoint, with retry, freshness, manifest, etag, last-modified. The cache module's path serves operator-side ad-hoc runs; the downloader serves the bulk path. Two implementations of "fetch a CFR title" with different policies (one has retry/freshness/etag, one doesn't) is a maintenance hazard.
- **Rule**: ADR 022 "TS owns network I/O" should be exactly one TS path. Today there are two.
- **Fix**: Have `regs/cache.ts:loadEcfrXml` route through `scripts/sources/download/` (or a shared fetch helper) so the network-I/O policy lives in one place. The cache module then becomes a read-through wrapper plus a fixture loader. Downstream tests that need to control the fetch impl pass a mock at the shared layer.

### MINOR: `apps/hangar` form actions read `PENDING_DOWNLOAD` from the legacy registry

- **File**: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/+page.server.ts:17,96,123`, `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/+page.server.ts:15`
- **Problem**: The hangar app's `/sources` route imports `PENDING_DOWNLOAD` from `@ab/aviation`. That sentinel only matters if the legacy `Source.checksum / downloadedAt` columns are still authoritative; the hangar BC stores these in `hangar.source` rows, not in the static `SOURCES` array. The route is effectively reading a deprecated sentinel from `libs/aviation/src/sources/registry.ts` to decide UI presentation against rows whose state is in `hangar.source`. The two state machines are no longer aligned.
- **Rule**: BC owns its own state machine; apps consume the BC, not a parallel registry constant.
- **Fix**: Move `PENDING_DOWNLOAD` (or its replacement) to `libs/bc/hangar/src/` next to the `hangar.source` schema. Update the hangar app routes to import from `@ab/bc-hangar`. Then the legacy `libs/aviation/src/sources/registry.ts` becomes free-standing and can be retired alongside `data/sources/`.

### MINOR: `scripts/migrate-lessons.ts` is a one-shot migrator without an explicit deletion plan

- **File**: `/Users/joshua/src/_me/aviation/airboss/scripts/migrate-lessons.ts`
- **Problem**: ADR 019 §9 specifies a one-pass lesson migration. The script is in the tree and imports `@ab/sources` to rewrite `course/regulations/**`. ADR 021's `migrate-cache-flat.ts` was deleted in the same PR per its policy ("one-shot TS script lands in this PR and is deleted in the same PR"). `migrate-lessons.ts` has no equivalent end-of-life criterion -- ADR 019 §8 only describes the WP scope, not retirement. Per project rules ("No legacy in airboss -- retire on sight"), this either needs a documented trigger (e.g. "deleted when course/regulations/* is fully migrated") or it should be deleted now if migration is complete.
- **Rule**: CLAUDE.md "No `TODO(retire)`, no scheduled-cleanup cron jobs. If it's dead today, drop it today." ADR 021 set the precedent for one-shot scripts.
- **Fix**: Either delete the script (if course/regulations/** has been mechanically migrated) or add a top-of-file comment naming the deletion trigger and the remaining lessons it must process. If the trigger is "every lesson now uses `airboss-ref:` syntax," verify that today and delete; if not, surface the open lessons in a follow-on WP.

### NIT: `scripts/sources/extract/` directory holds one file dispatching to Python

- **File**: `/Users/joshua/src/_me/aviation/airboss/scripts/sources/extract.ts`, `/Users/joshua/src/_me/aviation/airboss/scripts/sources/extract/handbooks.ts`
- **Problem**: `scripts/sources/extract/` exists as a directory with one file, `handbooks.ts`, that does `Bun.spawn` of `python -m ingest`. The dispatcher pattern (`EXTRACT_SUBCOMMANDS`) hints at future siblings but only `handbooks` is wired. Until a second extraction sub-pipeline lands, the directory adds a layer of indirection without yet paying off.
- **Rule**: project pattern -- create directories when they hold > 1 sibling.
- **Fix**: Optional. Either keep the dispatcher in place as the seam for a future `extract regs` / `extract aim` (defensible) or inline the python-spawn into `scripts/sources/extract.ts` and re-introduce the dispatcher pattern when the second sub-pipeline lands. Lean toward inlining unless a concrete second sub-pipeline is queued.

### NIT: `course/firc/L01-FAA/references/AC_61-83K.pdf` is a tracked PDF

- **File**: `/Users/joshua/src/_me/aviation/airboss/course/firc/L01-FAA/references/AC_61-83K.pdf`
- **Problem**: A 1.7-MB AC PDF is committed to git history. It predates ADR 018 and lives in the dormant FIRC corpus (per `course/firc/README.md` and the project rule "FIRC compliance surface dormant in hangar"). ADR 018 §"Migration" says the policy is forward-looking, but the file is a known deviation: ADR 018 doesn't grandfather pre-existing PDFs.
- **Rule**: ADR 018 storage policy (no PDFs in repo).
- **Fix**: Optional and dormant-corpus-bound. If the FIRC corpus reawakens (per `project_firc_compliance_dormant.md`), the reawakening WP retires this PDF to `$AIRBOSS_HANDBOOK_CACHE/ac/61-83k.pdf` and adds the manifest pointer. Today: leave it; document in the FIRC awakening trigger.

---

```yaml
review:
  feature: sources-content-pipeline
  category: architecture
  date: 2026-05-01
  branch: feat/library-substrate-rename
  issues_found: 11
  by_severity:
    critical: 0
    major: 4
    minor: 5
    nit: 2
  spec_conformance:
    adr_018_storage_policy: partial      # parallel data/sources/ pipeline contradicts; per-corpus .gitattributes/.gitignore lines missing
    adr_019_identifier_system: partial   # ENUMERATED_CORPORA closed enum violates §2.1 "open" promise
    adr_021_cache_flat_naming: clean     # migrate-cache-flat.ts properly deleted; cache layout matches
    adr_022_chapter_ingestion: clean     # YAML config single source of truth; chapter_plaintext early-return clean; TS/Python boundary clean
  positive_findings:
    - chapter_plaintext.py early-return (ADR 022 §H) is a structural boundary, not a flag
    - corpus resolver registration pattern is consistent across all 17 corpora
    - render-time API (extractIdentifiers + batchResolve + substituteTokens) consumed by every render surface via @ab/sources/render
    - lifecycle state machine centralized in libs/sources/src/registry/lifecycle.ts
    - unknown: magic prefix correctly handled in validator row 0, distinct from CorpusResolver
    - YAML config under scripts/sources/config/ is the shared source of truth for both TS downloader and Python ingest
    - tools/handbook-ingest/ingest/paths.py centralizes cache-root resolution on the Python side
    - tier separation (cache vs. inline derivative vs. computed/generated) is respected in libs/sources writers
```
