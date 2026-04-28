---
feature: full-codebase
category: dx
date: 2026-04-27
branch: main
issues_found: 18
critical: 0
major: 6
minor: 9
nit: 3
---

## Summary

Overall, debuggability is strong: a structured `createLogger` (libs/utils/src/logger.ts) with pretty-vs-prod modes, an env-var registry (libs/constants/src/env.ts), zero `: any` types in source, no `TODO`/`FIXME` sprinkled around, and most thrown errors include context (function name, offending value, path). The setup script is excellent -- idempotent, copy-paste remediation for missing /etc/hosts entries, friendly messages for missing thumbnail tools.

The biggest 2am risks are: a handful of error paths that drop the original cause (retried downloads, JSON parse, child-process spawn), several low-context error strings ("createGoal failed", "addGoalNode failed", "not a file"), and many `} catch {}` blocks in app code that swallow errors without even a `logger.warn`. There is no top-level README -- a fresh dev lands on `package.json` and has to discover `bun run setup` from CLAUDE.md. One-letter local variables (`c`, `s`, `w`, `m`) recur across scoring/engine code where the math is already non-obvious.

## Issues

### MAJOR: Retried download throws away the originating error

- **File**: libs/aviation/src/sources/download.ts:178
- **Problem**: After `DOWNLOAD_MAX_RETRIES` failures the function throws `failed to download ${url} after N attempts: ${lastError?.message ?? 'unknown error'}` -- but the original `Error` object is discarded. No stack chain, no `cause`, so when this fires in prod the on-call sees the message but cannot tell whether it was DNS, TLS, 5xx, or a write to a full disk.
- **Fix**: `throw new Error(\`failed to download ${url} after ${attempts} attempts\`, { cause: lastError });`. Drop the manual `: ${msg}` concat -- Node prints the cause chain.

### MAJOR: Child-process failure error omits captured stderr

- **File**: apps/hangar/src/lib/server/source-jobs.ts:189
- **Problem**: `runReferenceScript` captures stderr line-by-line into `result.stderr`, then on non-zero exit throws `${args.scriptPath} exited with code ${result.exitCode}` -- without including any of the stderr it just collected. The actual failure reason is right there in the local variable.
- **Fix**: Include the last N stderr lines (or full stderr if small) in the error message. `throw new Error(\`${args.scriptPath} exited with code ${result.exitCode}: ${result.stderr.slice(-10).join('\\n')}\`);`. The job log already has the full stream, but the throw is what crashes the worker -- it should say why.

### MAJOR: JSON-parse rethrow loses stack chain

- **File**: libs/sources/src/handbooks/derivative-reader.ts:74
- **Problem**: `throw new Error(\`handbook manifest is not valid JSON (${path}): ${(e as Error).message}\`)` discards the original parse error's position info from the stack chain. Same pattern likely elsewhere -- this is the canonical example.
- **Fix**: Use `throw new Error(\`...\`, { cause: e });` -- modern Node/Bun renders the chain. Bonus: drop the unsafe `as Error` cast; `cause` accepts `unknown`.

### MAJOR: Empty `catch {}` blocks in user-facing flows swallow errors with no logger trail

- **File**: apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte:330,378,425 (and 8 sibling sites in apps/study/src/routes)
- **Problem**: Pattern is `try { fetch(...) } catch { submitError = 'Network error doing X' }` with no `logger.warn` / `console.error` / Sentry hook. The user sees a toast, but the dev has nothing in the console -- not the URL, not the underlying TypeError. When a user reports "snooze keeps failing", the logs are empty.
- **Fix**: At minimum `} catch (err) { logger.warn('snooze fetch failed', { cardId: current.id, err: String(err) }); submitError = '...' }`. Pick one standard for client-side error reporting (browser logger, Sentry, or a thin "/api/client-error" endpoint) and wire all of these to it.

### MAJOR: Low-context "X failed" errors after DB inserts

- **File**: libs/bc/study/src/goals.ts:252,257,337,393; libs/bc/study/src/credentials.ts:492; libs/bc/study/src/syllabi.ts:466,496; libs/bc/sim/src/persistence.ts:68
- **Problem**: `throw new Error('createGoal failed')`, `throw new Error('addGoalNode failed')`, `throw new Error(\`upsertCredential failed for ${input.id}\`)`. Some include the id; several don't. None say *why* -- did the insert return zero rows because of an `onConflictDoNothing`, a constraint, an FK miss? At 2am there is no signal between "user input was bad" and "DB is wedged."
- **Fix**: Standardize on a `RowExpectedError` (or use `cause` to wrap the Drizzle error). At minimum include the user/owner id and the operation: `throw new Error(\`createGoal: insert returned no row (userId=${params.userId}, title=${row.title})\`)`. Better: don't throw a bare `Error` at all -- these are predictable "this should never happen" invariants and deserve a typed class so callers don't have to string-match.

### MAJOR: No top-level README

- **File**: (repo root) /Users/joshua/src/_me/aviation/airboss/README.md (missing)
- **Problem**: Fresh dev clones the repo, sees `apps/`, `libs/`, `course/`, `handbooks/`, `regulations/`, `tools/`, `scripts/`, `tests/`, `data/`, `drizzle/`, `docker-compose.yml`. No entry point. CLAUDE.md is excellent for an agent but not the document a human reads first. The session-start checklist (in CLAUDE.md) references docs/work/NOW.md; nothing tells a new contributor "run `bun run setup` then `bun run dev`."
- **Fix**: Add a 30-line top-level README with: what airboss is (one paragraph from PIVOT.md), prereqs (Bun, Docker/OrbStack), the three commands (`bun run setup`, `bun run dev`, `bun run check`), and links to CLAUDE.md, docs/platform/MULTI_PRODUCT_ARCHITECTURE.md, and docs/work/NOW.md.

### MINOR: Single-letter locals dominate scoring/engine math

- **File**: libs/bc/study/src/engine.ts:340 (`c`), :356 (`c`), :571 (`s`), :587 (`s`), :696 (`c`), :789 (`q`); libs/bc/study/src/lenses.ts:155 (`w`), :257 (`m`); libs/bc/study/src/calibration.ts:216 (`b`); libs/bc/study/src/credentials.ts:369 (`m`); libs/bc/study/src/cards.ts:553 (`c`); libs/bc/study/src/scenarios.ts:337 (`c`); libs/bc/sim/src/scenarios/grading.ts:164,179 (`f`), :320 (`t`), :328-332 (`a`,`b`,`u`); libs/bc/sim/src/replay/tape.ts:104,121 (`v`)
- **Problem**: This is the engine, calibration, lens, and grading code -- the math that decides what a learner sees and how their score is computed. `s = contributionTotal(contribution)` is barely two characters away from `score = contributionTotal(...)`, and the latter survives a stack trace much better. `for (const c of cards)` reads as "candidate" until you remember `c` is being shadowed by another `c` two scopes up.
- **Fix**: Rename to `score`, `card`, `weight`, `mastery`, `bucket`, `frame`, `time`, `value`. The performance argument doesn't apply -- minifier strips locals. The cost is one rename PR.

### MINOR: "not a file" / "thumbnail is not a file" / "archive path is not a file"

- **File**: apps/hangar/src/routes/(app)/sources/[id]/files/raw/+server.ts:81; apps/hangar/src/routes/(app)/sources/[id]/thumbnail/+server.ts:37; apps/hangar/src/routes/(app)/sources/[id]/download/+server.ts:35
- **Problem**: All three throw a bare-string error without the offending path. When this fires in prod, the on-call has the source id (from URL) but not which derived path the server expected.
- **Fix**: `throw new Error(\`not a file: ${absPath}\`)`. The path is already in scope -- include it.

### MINOR: `runCommand: empty cmd` / `spawn runner called with empty cmd`

- **File**: libs/aviation/src/sources/thumbnail.ts:89; apps/hangar/src/lib/server/source-jobs.ts:69
- **Problem**: These are programmer-error guards that the on-call will never debug at 2am directly -- but the message is still vague. A `cmd: readonly string[]` was empty; saying so without the call site doesn't help. (The stack trace will, but only in dev.)
- **Fix**: Include caller context if available: `throw new Error(\`spawn runner: cmd is empty (jobKind=${ctx?.job?.kind ?? 'unknown'})\`)`. Or, since this truly is "should never happen," just an `assert(head, 'runCommand: cmd[0] missing')` from a shared helper -- the throw vs `unreachable` distinction matters.

### MINOR: `download failed: HTTP ${response.status}` doesn't say what we were downloading

- **File**: libs/aviation/src/sources/download.ts:151
- **Problem**: The `url` is in scope right above. A 403 with no URL is a pain.
- **Fix**: `throw new Error(\`download failed: HTTP ${response.status} for ${url}\`);`

### MINOR: `recordSimAttempt: insert returned no row` lacks the user / scenario id

- **File**: libs/bc/sim/src/persistence.ts:68
- **Problem**: When `recordSimAttempt` silently produces no row (rare, but catastrophic for the user's gradebook), the message names the function but not the run.
- **Fix**: Include the userId + scenarioId from the input arg: `throw new Error(\`recordSimAttempt: insert returned no row (userId=${input.userId}, scenarioId=${input.scenarioId})\`)`.

### MINOR: `parseTape: serialized payload is not a valid ReplayTape` won't tell you why

- **File**: libs/bc/sim/src/replay/tape.ts:65
- **Problem**: The `isReplayTape` predicate is multi-clause; the failure mode is "something didn't match" with no hint which clause.
- **Fix**: Either return a `ReplayTapeParseError` with the failing field, or have `isReplayTape` populate a path/reason and include it: `throw new Error(\`parseTape: invalid ReplayTape (${reason})\`)`. Comment on line 59 already says "the debrief catches and surfaces 'tape unreadable'" -- give the dev who has to fix the tape *which field* is wrong.

### MINOR: HANGAR_EDITION_STUB_URL is documented in env.ts but missing from .env.example

- **File**: libs/constants/src/env.ts:28; .env.example
- **Problem**: ENV_VARS has a thorough JSDoc explaining the dev override and that it refuses to activate in prod. .env.example has the routine vars (DATABASE_URL, BETTER_AUTH_*, RESEND_API_KEY, LOG_LEVEL, DB_POOL_SIZE) but neither HANGAR_EDITION_STUB_URL nor HANGAR_SYNC_MODE nor AIRBOSS_ALLOW_DEV_SEED nor any of the DB_* timeout knobs. A new dev who runs into the binary-visual fetch path during the manual walkthrough has no breadcrumb showing the override exists.
- **Fix**: Mirror every name in `ENV_VARS` into `.env.example` as a commented line, with a short usage comment. Lifts the "single source of truth" from constants-only to constants + dotenv.

### MINOR: Setup-script success message hardcodes a dev password

- **File**: scripts/setup.ts:140
- **Problem**: `console.log('... sign in as joshua@ball.dev / Pa33word!')`. Friendly for the user-zero developer but (a) memory says Abby is the canonical seed user, (b) printing dev passwords in setup output trains a bad habit and shows up in CI logs/screen recordings.
- **Fix**: Print the email only and reference where the password lives (`scripts/db/seed-dev-users.ts` or a `docs/devops/dev-credentials.md`). Better: print "sign in as the dev user shown in `bun run db seed-check`" and have that command surface seeded credentials on-demand.

### MINOR: `--id requires a value` / `--source requires a value`

- **File**: scripts/references/extract.ts:247,252; scripts/references/build.ts:30
- **Problem**: When a CLI user types `bun scripts/references/build.ts --source` and forgets the value, the error doesn't mention the script name or show usage. Compare scripts/dev.ts which prints `printHelp()` on bad args.
- **Fix**: Either route through a tiny shared `parseArgs` helper that prints usage on missing values, or include the script name and a "see --help" suffix in each throw.

### NIT: Logger interface accepts `Error` separately but `LogContext` doesn't carry the err

- **File**: libs/utils/src/logger.ts:25-29
- **Problem**: `error: (msg, ctx, err) => ...` is a 3-arg shape that competes with the 2-arg `info`/`warn`. Most callers pass an error in `metadata` and skip the third arg, which means stack traces don't get printed in pretty mode (line 68: `if (err?.stack)`). 
- **Fix**: Pull `err?: unknown` into `LogContext` so all four levels can attach an error consistently, and let the formatter pull `ctx.err` out for the pretty/prod render. Reduces the chance of `logger.error('something broke', { metadata: { err } })` failing to print a stack.

### NIT: `ensureSvelteKitSync` is duplicated between scripts/check.ts and scripts/test.ts

- **File**: scripts/check.ts:5-15; scripts/test.ts:21-32
- **Problem**: Both bootstrap loops do the same thing (loop apps, exec `bunx svelte-kit sync` if `.svelte-kit/tsconfig.json` is missing). When one drifts (e.g. check.ts adds a new SvelteKit app, test.ts forgets), CI passes one and not the other.
- **Fix**: Hoist into `scripts/lib/svelte-sync.ts` (next to the existing `scripts/lib/spawn.ts`). Single import, single `SVELTE_APPS` constant.

### NIT: `process.stdout.write('\x1b[32mdone\x1b[0m...')` raw ANSI in setup.ts

- **File**: scripts/setup.ts:36,38; scripts/dev.ts:127
- **Problem**: ANSI codes are inlined as escape sequences. The repo already has `scripts/lib/colors.ts` (visible in the directory listing).
- **Fix**: Import from `./lib/colors` so a future "no-color/CI/dumb-terminal" detection lives in one place. Minor, but the indirection is already half-there.
