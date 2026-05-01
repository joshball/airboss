---
feature: sources-content-pipeline
category: patterns
date: 2026-05-01
branch: main
issues_found: 11
critical: 0
major: 4
minor: 5
nit: 2
---

## Summary

The sources / content pipeline is in strong overall shape against airboss conventions. ADR 022's YAML-as-single-source-of-truth migration landed cleanly, ADR 021's flat cache layout is honored, ADR 019's URI scheme + lifecycle states + validator severity tiers are intact, and there are no `any`, no non-null assertions, no raw SQL, no inline route strings, no direct `nanoid()`/`ulid()` calls, no `_errata/` subdir or `source.pdf` references, and no Unicode arrows or em-dash sentence separators in scope. Cross-lib imports use `@ab/*` aliases throughout. The remaining gaps are convention drift rather than rule breaks: the cache-root default path is duplicated as a magic string in six places, three handbook YAML configs still carry explicit `# Legacy field` markers (violating "no legacy in airboss -- retire on sight"), `scripts/README.sources.md` references the retired `AC_TARGETS`/`ACS_TARGETS`/`HANDBOOKS_EXTRAS_TARGETS`/`AIM_PDF_URL` constant names (the doc was not updated when ADR 022 landed), the `AIRBOSS_HANDBOOK_CACHE` env-var name is missing from the central `ENV_VARS` registry, and per-corpus "live URL" tables in `libs/sources/src/{acs,pts,handbooks}/url.ts` duplicate URL data that already lives in YAML. The render-token vocabulary is hardcoded inside each token definition rather than centralised.

## Issues

### MAJOR: Default cache-root path duplicated as a magic string in six locations

- **File**:
  - `libs/sources/src/regs/cache.ts:52`
  - `libs/sources/src/ac/ingest.ts:446`
  - `libs/sources/src/acs/ingest.ts:936`
  - `libs/sources/src/handbooks-extras/ingest.ts:398`
  - `libs/sources/src/aim/source-ingest.ts:40`
  - `scripts/lib/cache.ts:28`
- **Problem**: Each site writes its own variant of `process.env.AIRBOSS_HANDBOOK_CACHE ?? join(homedir(), 'Documents', 'airboss-handbook-cache')`. The literals `'AIRBOSS_HANDBOOK_CACHE'`, `'Documents'`, and `'airboss-handbook-cache'` are repeated without a single canonical definition. `scripts/lib/cache.ts` even acknowledges in a header comment that it "Mirrors the helper in `libs/sources/src/regs/cache.ts` -- duplicated up here because the script entry points are pure-Node + must not pull in the rest of `@ab/sources`." That justifies splitting the function, not duplicating the string literals.
- **Rule**: CLAUDE.md "All literal values in `libs/constants/`. Enums, routes, ports, config." + ADR 018 (`AIRBOSS_HANDBOOK_CACHE` env var, default `~/Documents/airboss-handbook-cache/`).
- **Fix**: Add a `SOURCE_CACHE` constant block to `libs/constants/src/sources.ts`:

  ```typescript
  export const SOURCE_CACHE = {
    ENV_VAR: 'AIRBOSS_HANDBOOK_CACHE',
    DEFAULT_PARENT_DIR: 'Documents',
    DEFAULT_DIR_NAME: 'airboss-handbook-cache',
  } as const;
  ```

  Have `libs/sources/src/regs/cache.ts` provide one `resolveCacheRoot()` helper that re-exports through `libs/sources/src/index.ts`. Have `scripts/lib/cache.ts` import the three string constants from `@ab/constants` (a constants-only import is the cheap path the comment was reaching for) so the duplication shrinks to a 3-line function.

### MAJOR: `AIRBOSS_HANDBOOK_CACHE` env var name not registered in `ENV_VARS`

- **File**: `libs/constants/src/env.ts:6` (the `ENV_VARS` object), referenced from every site listed above.
- **Problem**: `ENV_VARS` is documented as the "Single source of truth" for "Names of every environment variable the app reads." `AIRBOSS_HANDBOOK_CACHE` is read from at least 6 production sites and at least one CLI flag (`scripts/sources/discover/args.ts:48`) but is never added to that list, so the type-safe `getEnv()` / `requireEnv()` helpers can't be used and the literal sneaks through `process.env[...]` instead.
- **Rule**: CLAUDE.md "No magic strings. Use `libs/constants/`." + the file's own header.
- **Fix**: Add `AIRBOSS_HANDBOOK_CACHE: 'AIRBOSS_HANDBOOK_CACHE'` to `ENV_VARS`, then convert the `process.env.AIRBOSS_HANDBOOK_CACHE ?? ...` sites to `getEnv(ENV_VARS.AIRBOSS_HANDBOOK_CACHE, defaultRoot)`. Also surface `AIRBOSS_QUIET` and `GH_TOKEN` (currently only present as `DISCOVERY_QUIET_ENV` / `DISCOVERY_GITHUB_TOKEN_ENV` strings in `libs/constants/src/sources.ts:244-247`) the same way so every env var lives in one registry.

### MAJOR: Handbook YAML configs ship "Legacy field" markers (violates no-legacy rule)

- **File**:
  - `scripts/sources/config/handbooks/phak.yaml:45-47`
  - `scripts/sources/config/handbooks/afh.yaml:49-50`
  - `scripts/sources/config/handbooks/avwx.yaml:33-34`
- **Problem**: Each file carries a top-level `source_url:` block prefaced by:

  ```yaml
  # Legacy field used by the Python ingest tool when whole_doc is absent.
  # Kept here for backward-compatibility with code that hasn't migrated.
  source_url: https://...
  ```

  The user memory rule + CLAUDE.md state: "No legacy in airboss -- retire on sight. No `TODO(retire)`, no scheduled-cleanup cron jobs. If it's dead today, drop it today." Either the Python ingest tool still reads `source_url` (in which case it's not legacy and the comments are wrong) or it doesn't (in which case the field is dead and must be removed in this branch).
- **Rule**: CLAUDE.md (project) "No legacy in airboss -- retire on sight" + memory `feedback_no_legacy_in_airboss`.
- **Fix**: Verify which path in `tools/handbook-ingest/ingest/config_loader.py` consumes `source_url`. If still consumed, migrate that code to read `whole_doc.url` (which all three configs already provide on the line above), then delete the legacy field + its comments in one commit. If already unused, just delete the field. The phak.yaml `chapter_pdfs.errata[]` block at line 160 also has a `source_url` for each addendum; that one is a real field on a different schema and stays.

### MAJOR: Stale operator-facing doc references retired URL constants

- **File**: `scripts/README.sources.md:155`
- **Problem**: The README tells operators: "The verified list lives in `scripts/sources/download/plans.ts` (`AC_TARGETS`, `ACS_TARGETS`, `HANDBOOKS_EXTRAS_TARGETS`, `AIM_PDF_URL`). ... If `--verify` flags a target as 404, edit the URL in the file and re-run." Per ADR 022, those constants no longer exist in `plans.ts`; the verified list is now `scripts/sources/config/{ac,acs,handbooks-extras,aim}.yaml` plus `scripts/sources/config/handbooks/<slug>.yaml`. An operator who hits a 404 will follow the doc into a non-existent file.
- **Rule**: CLAUDE.md "Update docs as part of the work, not as a separate task." + ADR 022 §"YAML config consolidation."
- **Fix**: Replace the paragraph with the YAML file paths and the operator workflow ("edit the matching `entry.url` in the YAML, re-run `bun run sources verify-urls`"). Drop the `AC_TARGETS` / `ACS_TARGETS` / `HANDBOOKS_EXTRAS_TARGETS` / `AIM_PDF_URL` names entirely; per ADR 022 they're retired.

### MINOR: Per-corpus "live URL" tables duplicate URL data already in YAML

- **File**:
  - `libs/sources/src/handbooks/url.ts:25-41` (`HANDBOOK_LIVE_URLS`, 9 entries)
  - `libs/sources/src/acs/url.ts:32-38` (`ACS_PUBLICATION_LIVE_URLS`, 5 entries)
  - `libs/sources/src/pts/url.ts:23-25` (`PTS_PUBLICATION_LIVE_URLS`, 1 entry)
- **Problem**: ADR 022 §"YAML config consolidation" is unambiguous: `scripts/sources/config/` is the single source of truth for the source-corpus URL inventory, and the same files are read by both the TS downloader and the Python ingest tool. The three TS maps above hold a parallel inventory of FAA URLs keyed off locator slugs (`'ppl-airplane-6c'`, `'phak'`, `'cfii-airplane-9e'`). The values are not download targets (they're the "open this in a browser" URLs surfaced via citations), so they don't break the strict letter of ADR 022, but they are the same URL strings the YAML configs already own (`scripts/sources/config/acs.yaml` lists `private_airplane_acs_6.pdf`, `instrument_rating_airplane_acs_8.pdf`, etc.) keyed by `doc_id` instead of slug. When the FAA rotates a URL the operator now has two places to update; nothing wires them together.
- **Rule**: ADR 022 §"YAML config consolidation"; CLAUDE.md "all literal values in `libs/constants/`" (when a literal must exist; here the YAML is the better home).
- **Fix**: Either (a) add a `slug:` field to each YAML entry (mapping `doc_id: faa-s-acs-6` -> `slug: ppl-airplane-6c`) and have `getAcsLiveUrl` / `getHandbooksLiveUrl` / `getPtsLiveUrl` look the URL up via the loader, or (b) move the maps into the YAML schema as a sibling `live_urls:` object. Option (a) is the fewer-edits path because it preserves the existing downloader semantics. Either way: one place to update when an URL rotates.

### MINOR: Render-token vocabulary hardcoded inside each token definition

- **File**: `libs/sources/src/render/tokens.ts:67,75,83,91,103,163,175,...` and reused via regex at `libs/sources/src/render/batch-resolve.ts:121`.
- **Problem**: The token names (`'@short'`, `'@formal'`, `'@title'`, `'@cite'`, `'@list'`, `'@as-of'`, `'@text'`, `'@quote'`, ...) are inline string literals at every Token declaration. ADR 019 §1.3 defines this exact closed set; `batch-resolve.ts:121` reaches for the `@text|@quote` subset via a regex that re-encodes the names. A typo in either site breaks render-time substitution silently.
- **Rule**: CLAUDE.md "No magic strings. Use `libs/constants/`."
- **Fix**: Add `TOKEN_NAMES = { SHORT: '@short', FORMAL: '@formal', TITLE: '@title', CITE: '@cite', LIST: '@list', AS_OF: '@as-of', TEXT: '@text', QUOTE: '@quote', LAST_AMENDED: '@last-amended', DEEPLINK: '@deeplink', CHAPTER: '@chapter', SUBPART: '@subpart', PART: '@part' } as const` to `libs/constants/src/sources.ts` (or a new `libs/constants/src/render-tokens.ts`). Re-export through `@ab/constants`. Have `tokens.ts` set each `name: TOKEN_NAMES.SHORT`, and have `batch-resolve.ts` build its regex from `[TOKEN_NAMES.TEXT, TOKEN_NAMES.QUOTE]`.

### MINOR: `DEFAULT_TIMEOUT_MS = 30_000` in discover scrape duplicates `SOURCE_ACTION_LIMITS`

- **File**: `scripts/sources/discover/scrape.ts:45`
- **Problem**: The discover scraper defines a local `DEFAULT_TIMEOUT_MS = 30_000`. `libs/constants/src/sources.ts` already exposes `SOURCE_ACTION_LIMITS.HEAD_TIMEOUT_MS` (60_000) and `SOURCE_ACTION_LIMITS.DOWNLOAD_TIMEOUT_MS` (120_000) which the rest of the pipeline routes through. A third bespoke timeout means a single tuning knob no longer covers every fetch, and it's a magic number besides.
- **Rule**: CLAUDE.md "No magic numbers: timeouts, limits..."; the existing `SOURCE_ACTION_LIMITS` block is already the canonical home.
- **Fix**: Either reuse one of the existing limits (the discover scrape is closer to a HEAD-style poll) or add `DISCOVERY_SCRAPE_TIMEOUT_MS` to `SOURCE_ACTION_LIMITS`. Same treatment for `RETRY_DELAY_MS`/`MAX_REDIRECTS`/`NETWORK_TIMEOUT_MS` in `scripts/sources/download/constants.ts:11-13` -- they're per-script duplicates of the centrally-defined retry/backoff/timeout knobs.

### MINOR: `SCHEMA_VERSION = 1` and `USER_AGENT` in `scripts/sources/download/constants.ts` are project-level constants in script scope

- **File**: `scripts/sources/download/constants.ts:8-9`
- **Problem**: `SCHEMA_VERSION` (manifest schema version per ADR 022) and `USER_AGENT` (downloader user-agent string) are written at script scope. The user-agent already exists at `libs/constants/src/sources.ts:28` as `SOURCE_DOWNLOADER_USER_AGENT` -- so two different UA strings ship: one for the downloader CLI (`'airboss-source-downloader/1.0 (+https://github.com/joshball/airboss)'`) and one for the lib downloader (`'Mozilla/5.0 (compatible; airboss-hangar/1.0; aviation reference ingestion)'`). Servers that whitelist by UA see two different products from the same operator.
- **Rule**: CLAUDE.md "All literal values in `libs/constants/`."
- **Fix**: Move `SCHEMA_VERSION` to `libs/constants/src/sources.ts` (`SOURCE_MANIFEST_SCHEMA_VERSION`). Decide whether the two UA strings should be one (recommended) or remain split, and re-home both in `@ab/constants`. The script-side comment ("Pulled out of `plans.ts` to break a circular import...") doesn't need to change -- the const just becomes a re-export.

### MINOR: Inline FAA URL bases in `libs/sources/src/<corpus>/url.ts`

- **File**:
  - `libs/sources/src/regs/url.ts:19` (`ECFR_BASE`)
  - `libs/sources/src/regs/cache.ts:21` (`ECFR_BASE` again, with a different value: `https://www.ecfr.gov/api/versioner/v1/full`)
  - `libs/sources/src/ac/url.ts:21` (`FAA_AC_BASE`)
  - `libs/sources/src/tcds/url.ts:21` (`FAA_TCDS_BASE`)
  - `libs/sources/src/ntsb/url.ts:31` (`NTSB_CAROL_BASE`)
  - `libs/sources/src/asrs/url.ts:19` (`ASRS_DATABASE_BASE`)
  - `libs/sources/src/orders/url.ts:28` (`FAA_ORDERS_SEARCH_BASE`)
  - `libs/sources/src/info/url.ts:22` (`FAA_INFO_BASE`)
  - `libs/sources/src/safo/url.ts:22` (`FAA_SAFO_BASE`)
  - `libs/sources/src/plates/url.ts:22` (`FAA_DTPP_BASE`)
  - `libs/sources/src/statutes/url.ts:25` (`USCODE_BASE`)
  - `libs/sources/src/aim/url.ts:26` (`AIM_LIVE_URL`)
  - `libs/sources/src/acs/url.ts:25` (`ACS_TEST_STANDARDS_INDEX_URL`)
  - `libs/sources/src/pts/url.ts:16` (`PTS_TEST_STANDARDS_INDEX_URL`)
  - `libs/sources/src/interp/url.ts:35-36` (`FAA_LEGAL_INTERPS_BASE`, `NTSB_AVIATION_APPEALS_BASE`)
- **Problem**: Each corpus declares its own publisher-base URL constant. Most are not download targets (only `regs` and the YAML-driven corpora actually fetch); they're "live URL" / "open in browser" surfaces. The constants are at module scope so they're discoverable, but they're spread across 14 files and `regs/url.ts` and `regs/cache.ts` define `ECFR_BASE` twice with different paths (root vs versioner API). One of them being out-of-step on a publisher migration is a per-corpus-bug-finding-exercise.
- **Rule**: CLAUDE.md "All literal values in `libs/constants/`."
- **Fix**: Create `PUBLISHER_BASE_URLS` (or per-publisher: `FAA_BASES`, `ECFR_BASES`, `NTSB_BASES`, `USCODE_BASE`) in `libs/constants/src/sources.ts`, with named slots for each surface (`FAA_BASES.ADVISORY_CIRCULAR_DOC_LIBRARY`, `ECFR_BASES.WEBSITE`, `ECFR_BASES.VERSIONER_API`, etc.). Each `<corpus>/url.ts` imports from `@ab/constants` rather than declaring its own. This also gives the discovery surface and the validator a single place to keep an "is this URL still publisher-canonical?" check.

### NIT: `regs/cache.ts:21` and `regs/url.ts:19` both name a constant `ECFR_BASE`

- **File**: `libs/sources/src/regs/cache.ts:21`, `libs/sources/src/regs/url.ts:19`
- **Problem**: Two different values:
  - `cache.ts`: `'https://www.ecfr.gov/api/versioner/v1/full'`
  - `url.ts`: `'https://www.ecfr.gov'`

  Same name, different meaning. A reader hopping between files thinks they're the same constant.
- **Rule**: General readability; would be subsumed by the previous fix.
- **Fix**: Rename to `ECFR_VERSIONER_API_BASE` and `ECFR_WEBSITE_BASE` (and move both to `@ab/constants` per the previous finding).

### NIT: `USER_AGENT` string in `scripts/sources/download/constants.ts` references `github.com/joshball/airboss`

- **File**: `scripts/sources/download/constants.ts:9`
- **Problem**: The downloader UA is `'airboss-source-downloader/1.0 (+https://github.com/joshball/airboss)'`. Per `project_license_and_hosting` (memory, 2026-04-30): "No public repo, hosted-only by Joshua. Don't propose OSS or self-host work until Joshua reopens the question." The repo is not public, so the `+https://github.com/...` reference in the UA points at nothing. Not a security or correctness issue (publishers ignore the URL), but it advertises a public surface that doesn't exist.
- **Rule**: `project_license_and_hosting` memory.
- **Fix**: Either drop the URL from the UA (becomes `'airboss-source-downloader/1.0'`) or point at a contact mailto. Worth raising once with the user before changing.

---

```yaml
feature: sources-content-pipeline
category: patterns
date: 2026-05-01
branch: main
issues_found: 11
critical: 0
major: 4
minor: 5
nit: 2
```
