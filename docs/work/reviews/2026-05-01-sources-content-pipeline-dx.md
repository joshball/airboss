---
feature: sources-content-pipeline
category: dx
date: 2026-05-01
branch: main
issues_found: 18
critical: 1
major: 7
minor: 7
nit: 3
---

## Summary

The sources & content pipeline is, for the most part, well-instrumented for DX. Errors carry the YAML field path, the URL, and the corpus context. The dispatcher index is well-grouped, every command has a what/why/how/links help block, the inventory output is genuinely diff-friendly, and the verifier already includes copy-pasteable JSON for AIM section count drift -- which is the gold standard the rest of `verify-urls` does not match. A handful of failure paths still hand back useless one-line errors (`describeError(error)` in `runDownloadSources` -> "failed to build plans: ..." with no plan/corpus context, network HEAD failures in `verify-urls` that say `HEAD failed: fetch failed` with nothing pointing at which YAML to edit), the `register handbooks` CLI silently throws on unknown doc/edition combinations (instead of returning a clean exit-2), and there are two real first-checkout footguns: `bun run setup` does not warm the source cache, and `bun run sources extract handbooks phak` will silently re-fall-back to system `python3` and fail somewhere deep in the pipeline if the venv is not installed.

The single critical finding is partial-state recovery on download failures: when one chapter PDF in a multi-step handbook ingest fails mid-run, there is no resume hint, no manifest preserved on disk for the partial set, and no log line that says "X of Y completed; re-run will pick up from manifest hits." The 2am-debug test fails here.

## Issues

### CRITICAL: Partial-download state recovery has no operator-facing log

- **File**: `scripts/sources/download/run.ts:76-91`, `scripts/sources/download/execute.ts:24-76`
- **Problem**: When `bun run sources download phak` fetches whole-doc + 17 chapter PDFs + 3 ancillaries and one chapter 404s mid-run, the loop continues, increments the corpus error counter, and prints a per-line `error` to stderr. There is **no end-of-run summary line that says "12/21 succeeded; re-run to pick up the rest"**, no per-failed-plan resume command, and the manifest is updated incrementally per-success (good) but a developer reading the output cannot tell at a glance whether the cache is in a coherent state or whether the next `--include-handbooks-extras` re-run will pick up only the failures or also re-fetch the successes. The current summary just prints `errors: 1`. At 2am, the on-call has no way to:
    1. Identify exactly which chapters failed without scrolling through hundreds of lines.
    2. Know whether re-running `bun run sources download` will resume idempotently or re-fetch everything.
- **Fix**: After the per-corpus loop in `run.ts:91`, when `result.errors > 0`, print a "failures by plan" block listing each failed plan (corpus/doc/kind/ordinal) plus the URL, and add an end-line: `(re-run \`bun run sources download --corpus=<corpus>\` to retry; cached files are skipped)`. The infrastructure already exists -- `executePlan` is logging each failure individually; capture them into `result.failedPlans: DownloadPlan[]` and dump them at end-of-run. Also update `printSummary` to emit a one-liner: `(N successful files written; M failed plans listed above; re-run is safe -- successful entries are cached)`. This costs ~30 lines and turns a "scroll through stderr" experience into a "read the last 5 lines and act" experience.

### MAJOR: `verify-urls` 404 messages are not copy-pasteable for the YAML edit

- **File**: `scripts/sources/verify-urls.ts:198`, `scripts/sources/verify-urls.ts:147-180`
- **Problem**: ADR 022 mandates that `verify-urls` surface 404s with copy-pasteable remediation. The AIM section-count branch does this beautifully (lines 167-173: prints the YAML field path, the actual count, and a `suggested edit (replace the array literal): sections_per_chapter: [...]` literal). The flat-URL branch, however, emits only `ERROR: ac.yaml#ac-61-65-j -- HEAD HTTP 404 for https://www.faa.gov/.../AC_61-65J.pdf`. There is no "the URL field for `ac-61-65-j` lives in `scripts/sources/config/ac.yaml` -- update the `url:` value and re-run", no link to the FAA's AC search page, and (notably) no suggestion that the operator might also need to bump `edition:` in the YAML when the FAA rotates a URL because of a revision bump.
- **Fix**: In `verify-urls.ts:198`, change the error template to a multi-line block that mirrors the AIM-count branch:

    ```text
    ERROR: ac.yaml#ac-61-65-j
      HEAD HTTP 404 for https://www.faa.gov/.../AC_61-65J.pdf
      Edit: scripts/sources/config/ac.yaml entry doc_id=ac-61-65-j
      Hint: FAA URL rotations often coincide with revision bumps; check whether the `edition:` field also needs to advance. Confirm with the FAA AC search: https://www.faa.gov/regulations_policies/advisory_circulars/
    ```

    The `fieldPath` already carries enough info to compute the absolute file path; just emit it explicitly. Same treatment for the handbooks ancillary, AIM whole-doc, and AIM appendix branches.

### MAJOR: `runExtractHandbooks` silently falls back to system `python3` with no preflight diagnostics

- **File**: `scripts/sources/extract/handbooks.ts:20-30`
- **Problem**: When `tools/handbook-ingest/.venv/bin/python` is missing, the script falls back to `python3` on PATH and just runs the command. If the venv was never created (a fresh checkout), or if `python3` exists but the user did not run `pip install -e .[dev]`, the failure mode is: the python interpreter starts up, then dies inside `python -m ingest` with an `ImportError: No module named ingest` (or a missing dep). The bun-side log says only `> /usr/bin/python3 -m ingest phak --edition FAA-H-8083-25C` followed by the python error, with no breadcrumb pointing the operator at `tools/handbook-ingest/README.md`'s "Setup" section.
- **Fix**: Before spawning, check whether the venv exists; if it does not, emit a one-line warning that points at the setup steps:

    ```text
    > /usr/bin/python3 -m ingest phak --edition FAA-H-8083-25C
    note: tools/handbook-ingest/.venv not found; using system python3.
          For first-time setup run:
            cd tools/handbook-ingest && python3 -m venv .venv && source .venv/bin/activate && pip install -e .[dev]
          See tools/handbook-ingest/README.md.
    ```

    Then keep the existing fallback (it's the right escape hatch for CI), but make the failure mode legible.

### MAJOR: `register handbooks` and `register cfr` swallow argument errors that the dispatcher's `--help` doesn't surface

- **File**: `libs/sources/src/handbooks/ingest.ts:166-175`, `libs/sources/src/handbooks/ingest.ts:294-318`
- **Problem**: `runHandbookIngest` throws `Error("handbook ingest: unknown doc/edition combination ${args.doc}/${args.edition}; extend HANDBOOK_DOC_EDITIONS in libs/sources/src/handbooks/resolver.ts")` for an unknown doc+edition. That error message is genuinely useful for a contributor adding a new edition (the file path is named); but `runIngestCli` does NOT catch it -- it lets the throw propagate out of the dispatcher, which surfaces as an unstructured stack trace via Bun's default unhandled-rejection handler. Same shape: the `parseCliArgs` error path returns a clean `{error: "..."}` shape with USAGE printed (good), but the runtime errors after parsing (unknown doc, missing manifest, malformed `fetched_at`) all bypass that path.
- **Fix**: In `runIngestCli` (libs/sources/src/handbooks/ingest.ts:294), wrap the `await runHandbookIngest(...)` call in a `try/catch` and emit the error message via `process.stderr.write(...)` returning exit code 1. Same shape for `runIngestCli` in `libs/sources/src/regs/ingest.ts:275`. The 2am operator should see one clean line, not a stack trace. The errors themselves are already well-worded; they just need to land on stderr without the noise.

### MAJOR: `manifest.json` reads silently swallow JSON-parse errors via `readJsonOrNull`

- **File**: `scripts/sources/download/manifest.ts:130-137`
- **Problem**: `readJsonOrNull(path)` catches every JSON parse error and returns `null`, which the freshness checker then treats as "no manifest -> stale -> re-download". This is the right *behavior*, but it's silent: if the manifest file got corrupted (e.g. a previous `Ctrl-C` mid-write -- though writes are atomic via tmp+rename, the *.tmp file is left behind), there's no log line saying "found unparseable manifest at `<path>`; treating as stale". A developer debugging "why is `bun run sources download phak` re-fetching everything every time" has no clue the manifest is poisoned.
- **Fix**: Change `readJsonOrNull` to `readJsonOrWarnNull(path)`: on parse failure, emit `console.warn("manifest at ${path} is not valid JSON; treating as missing. Inspect: cat ${path}")` then return null. Same treatment for `manifestPathFor`'s related callers.

### MAJOR: Empty `corpora` set after `--corpus=foo` typo silently downloads nothing

- **File**: `scripts/sources/download/args.ts:69-83`
- **Problem**: The flag parser builds `validated` from the user's `--corpus=` list; if the user passes `--corpus=handsbooks` (typo), `isCorpus` rejects it and throws a clear error. Good. But if the user passes `--corpus=` (empty), the loop runs zero iterations, `validated` is empty, and `corpora = validated`. The downloader then prints `No corpora selected. Use --corpus= or --include-handbooks-extras to expand.` (run.ts:53). At 2am that's vaguely OK, but there is no acknowledgment that the operator probably typed `--corpus=` by accident -- they'll keep adding flags trying to figure out what's wrong.
- **Fix**: In `parseArgs`, if the user passed `--corpus=` with an empty value (zero non-empty entries after split+filter), throw `--corpus= must list at least one of: ${ALL_CORPORA.join(', ')}`.

### MAJOR: `bun run setup` does not warm the source cache; new contributors hit a wall on first `bun run sources extract`

- **File**: `scripts/setup.ts:113-141`
- **Problem**: A fresh checkout runs `bun run setup`, which configures `/etc/hosts`, deps, `.env`, db container, schema, and dev users. It does NOT run `bun run sources download` (or even mention it). The contributor then runs `bun run sources extract handbooks phak ...` and hits `manifest not found` errors deep in the pipeline because no source bytes exist in the cache. Per the runbook in `docs/ingestion-pipeline/handbook-onboarding-checklist.md`, this is expected operator workflow; but the setup script doesn't mention it.
- **Fix**: At the end of `setup.ts:139`, add a one-line pointer:

    ```text
    Ready. Start the app with: bun run dev
    Then open http://study.airboss.test:9600 and sign in as joshua@ball.dev / Pa33word!

    For source-corpus work (handbooks, regs, ACs):
      bun run sources                  # show the source dispatcher index
      bun run sources download         # fetch source bytes into the cache (~hundreds of MB, FAA-rate-limited)
    See scripts/README.sources.md.
    ```

    Optionally make this a fenced step in `setup.ts` ("seed source cache (optional, can take 10+ min)") gated on a flag like `--sources` so a contributor opting in gets it as part of `bun run setup --sources`.

### MAJOR: `read manifest` two-tier validation has no fix-it message for unknown handbook doc slugs

- **File**: `libs/sources/src/handbooks/derivative-reader.ts:77-108`
- **Problem**: When `readManifest("FAA-H-8083-25C", "handbooks", "phak")` runs against a manifest that's missing `document_slug`, the throw is `handbook manifest at handbooks/phak/FAA-H-8083-25C/manifest.json missing required field: document_slug`. Helpful. But when the manifest exists, parses, and *has* a `document_slug` that disagrees with the caller, the check at `libs/sources/src/handbooks/ingest.ts:181-185` says: `handbook ingest: manifest document_slug "phak-old" does not match arg "phak"` -- which is a great error -- *but* there's no hint about whether the operator should rename the manifest, fix the YAML, or re-extract. The next debugger step is to `cat` the manifest and decide; the error message could include "(probably re-run `bun run sources extract handbooks phak --edition <e> --force` after fixing the YAML)".
- **Fix**: Append `; re-run \`bun run sources extract handbooks ${args.doc} --edition ${args.edition} --force\` after fixing` to the error message at ingest.ts:184. For the cross-cutting case where the YAML and the manifest disagree, also point at the YAML: `; or update scripts/sources/config/handbooks/${args.doc}.yaml`.

### MINOR: `inventory` writes the byte count to stdout but does not show what changed

- **File**: `scripts/sources/inventory.ts:332`
- **Problem**: `Wrote /Users/foo/.../docs/ingestion-pipeline/inventory.md (54321 bytes).` is the entire output. Operators run `bun run sources inventory` after a `bun run sources download`, expecting to see what changed. There's no `git diff docs/ingestion-pipeline/inventory.md` hint, and no "X corpora updated this run; Y rows changed" summary. The skill prompt explicitly calls out "is there a way to see only the diff vs last run?" -- there isn't.
- **Fix**: After writing, run `git diff --stat docs/ingestion-pipeline/inventory.md` (or read the previous file content via `readFileSync` before the write and diff manually) and print a 1-line summary: `(M lines changed; run \`git diff docs/ingestion-pipeline/inventory.md\` to inspect)`. If git is not available (CI sandboxes), fall back to "Wrote ... (54321 bytes). Compare with previous version via git diff."

### MINOR: `--fix` doesn't say which file got which stamp; only counts

- **File**: `libs/sources/src/fix.ts:106-108`
- **Problem**: `applyFixes` returns `{filesScanned, filesModified, identifiersStamped}` and the CLI prints exactly those three counts: `Reference identifier --fix: 12 lesson(s) scanned, 4 file(s) modified, 11 identifier(s) stamped.` That tells you *something* changed but not *what*. ADR 019 §1.3's spec for auto-stamp explicitly says the CLI should "clearly say what it modified and log a diff hint." The skill prompt asks for this explicitly.
- **Fix**: Per-file logging when verbose, plus an aggregate hint without it. After the summary line, append `(diff with: git diff <files>)`. To enable per-file logging, capture the per-edit `relPath -> Edit[]` mapping inside `applyFixes` and (in verbose mode) emit one line per modified file:

    ```text
    course/regulations/week-04-part-91-general-and-flight-rules/05-preflight-action.md: 3 identifier(s) stamped
    ```

    Add `--verbose` flag to `runFixCli`. Mirror the same convention used by `bun run sources download`.

### MINOR: Lesson-parser ruleId `-1` is opaque in the CLI output

- **File**: `libs/sources/src/check.ts:175-180`, `libs/sources/src/lesson-parser.ts:132-156`
- **Problem**: The validator's CLI formatter at `formatFinding` prints `lesson-parser: ${msg}` for `ruleId === -1` and `row N: ${msg}` for the rule engine. Why is the lesson-parser distinct? Because §1.5 ruleIds 0-14 are the rule engine's; orphan-ack and frontmatter-shape errors are lesson-parser-internal. Operators reading `lesson-parser: undefined reference label \`p91-103\`` cannot tell what subsystem fired this -- it could be a regex bug, a YAML parser quirk, or an MD walker miss. The string "lesson-parser" is the right label, but a curious operator looking up "what is lesson-parser" gets nothing in the docs.
- **Fix**: Either (a) give every lesson-parser-internal finding a **named** sub-rule tag (`lesson-parser:undefined-label`, `lesson-parser:malformed-frontmatter`, `lesson-parser:orphan-ack`, etc.) and print that named tag; or (b) add a `--explain` flag to the CLI that prints the rule's docs (one paragraph per rule from §1.5 + the lesson-parser-internal rules). (a) is the cheaper fix and covers the 2am debug case.

### MINOR: `parser.ts` and `lesson-parser.ts` exports overlap conceptually; module names are not self-evident

- **File**: `libs/sources/src/parser.ts`, `libs/sources/src/lesson-parser.ts`
- **Problem**: A new contributor looking at `libs/sources/src/` sees `parser.ts`, `lesson-parser.ts`, and `validator.ts` side-by-side and has to read the JSDoc of each to know which is which. `parser.ts` parses ONE URL (a single `airboss-ref:` string); `lesson-parser.ts` parses an entire MD file (frontmatter + body + occurrences); `validator.ts` runs ADR 019 §1.5 rules. The names are technically accurate but a contributor will at least once import the wrong module before realizing.
- **Fix**: Two acceptable options. Either (a) rename `parser.ts` -> `identifier-parser.ts` and `lesson-parser.ts` stays, both names self-narrating; or (b) leave the filenames alone but add a one-line block at the top of each export from `index.ts` reaffirming the intent (e.g. `// Parse a single airboss-ref: URL`). Option (a) is slightly more invasive but has the long-term win.

### MINOR: `evaluateFreshness` log of "fresh, etag match" only fires under `--verbose`

- **File**: `scripts/sources/download/execute.ts:38-46`
- **Problem**: Skipped entries are silent unless `--verbose` is set; the user only sees the per-corpus summary line at the end. For a fresh-cache run that's the right call (most files are skipped). But for an "I changed one URL in the YAML and want to verify only that one was re-fetched" workflow, the developer has to scroll up to find the green `ok` line and confirm the others stayed yellow. A non-verbose default of "log only re-fetches and errors" is clear; what's confusing is that the green/yellow legend is documented in the help block but not actually emitted unless `--verbose` is set.
- **Fix**: Change the default to print one yellow line per *corpus* showing the cumulative `skip` count: `\${corpus}: 17 skipped (cached)` instead of `(silent in non-verbose mode)`. That's already what `printSummary` does, but the inline log says nothing. The fix is to add (in `executePlan` after the skip branch) a counter-only side-effect at end-of-corpus, or pre-compute a "this corpus had N skipped" count and emit it in the per-corpus header line.

### MINOR: `unknown:` magic-prefix message is good but the row-0 ERROR is one-shot for the file

- **File**: `libs/sources/src/validator.ts:79-90`
- **Problem**: The user-facing message `Transitional reference; cannot publish. Replace with a real identifier or wait for ingestion of the relevant corpus.` is the spec-mandated string and ships verbatim, which is correct. However: the validator emits one ERROR per occurrence (which is right -- one bad `unknown:foo` ref = one ERROR), but per ADR 019 §1.7 "the publish gate fails when ANY identifier is `unknown:`," the failure should be summarized at the bottom of the run with a count: `${N} unknown: identifiers prevent publish`. Instead, the CLI just prints all the row-0 messages and the standard `1 ERROR(s)` count. The author has no fast way to see whether all errors are unknown (= all transitional, can defer) or whether some are real registry mismatches (= actually broken).
- **Fix**: In `runCli` (libs/sources/src/check.ts:143), partition findings into "transitional `unknown:` errors" vs "real errors" and emit a footer like:

    ```text
    Reference identifier validation: 12 ERROR(s)
      - 11 transitional (unknown: corpus)
      - 1 real (registry mismatch / parse error)
    ```

    The transitional count gives authors a concrete signal ("deferred ingestion = N references; real bug = M references").

### NIT: Color helpers don't honor `FORCE_COLOR=1` for piped output

- **File**: `scripts/lib/colors.ts` (referenced from `scripts/sources/download/summary.ts:13`)
- **Problem**: The download script lands in `setColorEnabled(false)` when `--no-color` is passed, but the underlying `colors.ts` (not read here, but referenced) likely defaults to `false` when stdout is not a TTY. CI loggers (Datadog, GitLab CI, etc.) often capture the buffer but DO support ANSI color when `FORCE_COLOR=1` is set. If color isn't already honoring this, it's a 2-line change. Mentioning as a polish item.
- **Fix**: Verify `scripts/lib/colors.ts` honors `FORCE_COLOR=1`; if not, add it. (Out of scope to read here without the file in hand.)

### NIT: `extract handbooks` python passthrough has no version banner

- **File**: `scripts/sources/extract/handbooks.ts:23-24`
- **Problem**: When the script spawns python it logs `> ${cmd.join(' ')}` then sits silent until python prints. A version banner would help diagnose "wait, is it using the venv or system python?" in one glance.
- **Fix**: After resolving `pythonBin`, log `(using ${pythonBin})` on a separate line before the command. Total cost: 2 lines.

### NIT: `discover-errata` exit codes 0/1/2 not documented in the dispatcher's --help

- **File**: `scripts/sources/discover/run.ts:222-237`, `scripts/sources.ts:91-108`
- **Problem**: `runDiscoverErrata` returns 0 (no candidates), 1 (every handbook scrape failed), or 2 (new candidates found). The COMMAND_HELP entry for `discover-errata` describes what it does but doesn't document these exit codes; an operator wiring this into a cron or CI gate has to read the source. Given the discovery system already auto-opens GitHub issues, this is a minor wart.
- **Fix**: Add a `Exit codes` line to the help block:

    ```text
    Exit codes:
      0 -- run completed; no new candidates
      1 -- run failed (no handbook scraped successfully)
      2 -- run completed; new candidates surfaced (check _pending.md or open GitHub issues)
    ```

## Summary by area

```yaml
errors:
  download: error messages are reasonable but partial-state recovery is the largest debugging gap (CRITICAL).
  verify-urls: AIM section-count remediation is exemplary; flat URL 404 messages need to match (MAJOR).
  register: argument-validation errors propagate cleanly; runtime errors leak as stack traces (MAJOR).
  fix-stamp: counts only, no diff hint, no per-file output (MINOR).
  inventory: bytes-written-only output; no "what changed" hint (MINOR).
  validator: ruleId -1 is opaque in CLI; unknown: count not partitioned in summary (MINOR).
logs:
  download: skips are silent without --verbose; ok/error/skip counts colored at end-of-run (MINOR).
  extract: python interp source not logged on the same line as the command (NIT).
  manifest: corrupt manifests treated silently as stale; no warn line (MAJOR).
docs:
  setup: bun run setup does not mention bun run sources at all (MAJOR onboarding gap).
  extract handbooks: silent fallback to system python when venv is missing (MAJOR).
  exit codes: discover-errata's 0/1/2 not documented in --help (NIT).
naming:
  parser.ts vs lesson-parser.ts: technically distinct, easy to mix up (MINOR).
runbook:
  handbook-onboarding-checklist.md is excellent; downloader/verify/inventory work well together; the gap is mostly small-grained log polish, not architectural.
```
