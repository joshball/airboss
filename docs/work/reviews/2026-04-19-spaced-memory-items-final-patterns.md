---
date: 2026-04-19
machine: ouranos
branch: build/spaced-memory-items
revision: 1
reviewer: patterns (final pass)
scope: git diff docs/initial-migration..HEAD
status: unread
review_status: done
prompt: "Final PATTERNS review of the entire spaced-memory-items feature on branch build/spaced-memory-items. Check every CLAUDE.md rule."
context: Final pattern-compliance pass across Phases 0-4 of the spaced-memory-items feature. Focuses on CLAUDE.md rules: no any, no !, ROUTES, constants, @ab/ aliases, Drizzle, Svelte 5, prefixed ULIDs, bun-only, no AI attribution, no TODOs, no stubs, Biome, text formatting, Markdown, updateCard whitelist, auth magic-string consolidation, ENV_VARS, session todo.
---

# Spaced Memory Items -- Final Patterns Review

Scope: `git diff docs/initial-migration..HEAD` -- 83 files, +9,785 / -69 lines across Phase 0 (foundation port), Phase 1 (constants + schema + FSRS wrapper), Phase 2 (cards/reviews/stats BC), Phase 3 (card management UI), and Phase 4 (dashboard + review flow), with one post-phase fix commit per phase.

`bun run check` passes cleanly on the current HEAD (svelte-check: 0 errors, 0 warnings; biome: 70 files checked, no fixes). Biome is configured with `noExplicitAny: error` and `noNonNullAssertion: error`, so the two hardest PRIME DIRECTIVE rules are machine-enforced.

This review enumerates the remaining pattern deviations. No criticals. Two majors. The rest are minor/nit.

## Summary

| Severity | Count | Fix before merge? |
| -------- | ----- | ----------------- |
| Critical |     0 | n/a               |
| Major    |     2 | yes               |
| Minor    |     7 | preferred         |
| Nit      |     3 | optional          |

## Findings

### [MAJOR 1] Magic string `'personal'` in two `.svelte` files bypasses `CONTENT_SOURCES`

**Rule:** "No magic strings. No implicit types. All literal values in `libs/constants/`."

**Issue:** Two card-listing views compare `sourceType` against the string literal `'personal'`:

- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/[id]/+page.svelte:112` -- `{#if card.sourceType !== 'personal'}`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/browse/+page.svelte:151` -- `{#if c.sourceType !== 'personal'}`

The canonical value lives in `libs/constants/src/study.ts:70` as `CONTENT_SOURCES.PERSONAL`. Both files already import from `@ab/constants`; they just miss the symbol. If the slug value ever changes (e.g. to `'user'`) the check silently breaks while type checking passes.

**Fix:** Import `CONTENT_SOURCES` and use `CONTENT_SOURCES.PERSONAL`.

### [MAJOR 2] BC leaks typed-error information through string `.message` matching

**Rule:** "No magic strings... Fix all bugs directly."

**Issue:** The `[id]` route action matches error-class by substring on `err.message`:

- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/[id]/+page.server.ts:89` -- `err.message.includes('not editable')`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/[id]/+page.server.ts:92` -- `err.message.includes('not found')`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/new/+page.server.ts:87` -- `err.message.startsWith('source_ref')`

The study BC already models one typed error (`CardNotFoundError` in `libs/bc/study/src/reviews.ts:48`). `cards.ts` still throws plain `Error` for "not found", "not editable", and `source_ref` constraint violation. A wording tweak in the BC (e.g. rephrasing the message) silently changes which branch fires in the route.

**Fix:** Introduce typed subclasses in `libs/bc/study/src/cards.ts` -- `CardNotFoundError` (already exists in reviews.ts; export and reuse), `CardNotEditableError`, `SourceRefRequiredError` -- and switch routes to `instanceof` checks. Typed errors also let other BC consumers (and the future smoke/e2e scripts) distinguish classes of failure without parsing text.

### [MINOR 1] Unicode left-arrow `←` in card detail heading

**Rule (global):** "Never use unicode arrow (->), always `->` (hyphen-greater-than)."

**Issue:** `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/[id]/+page.svelte:103` renders `← Browse`. The global rule targets the rightward unicode arrow, but the spirit covers `←` too -- it's an inline unicode symbol the user can't easily type or grep for.

**Fix:** Use `<- Browse`, or (better) an aria-label + decorative SVG chevron. The CSS `.back` class already styles the link, so a plain `Browse` with a left-pointing chevron glyph (`\u{2039}` is lighter, or a CSS `::before`) reads cleanly without unicode in source.

### [MINOR 2] `PAGE_SIZE = 25` is a module-local magic number

**Rule:** "No magic strings/numbers. Use `libs/constants/`."

**Issue:** `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/browse/+page.server.ts:17` defines `const PAGE_SIZE = 25`. The sibling `REVIEW_BATCH_SIZE = 20` already lives in `libs/constants/src/study.ts:141`. Browse pagination size deserves the same treatment -- other lists (future Reps browse, calibration history) will want a single knob.

**Fix:** Add `CARD_BROWSE_PAGE_SIZE = 25` (or generalized `BROWSE_PAGE_SIZE`) to `libs/constants/src/study.ts` and import it.

### [MINOR 3] Duplicated `escapeLikePattern` implementation

**Rule:** "Link, don't inline. Reference other docs, don't copy content between files." (applied to code by analogy -- DRY.)

**Issue:** `libs/bc/study/src/cards.ts:68` re-implements `escapeLikePattern` even though `libs/db/src/escape.ts:5` already exports an identical function, and `libs/db/src/index.ts` re-exports it. Two copies, same regex, same behavior.

**Fix:** Import from `@ab/db` in `cards.ts` and delete the local copy.

### [MINOR 4] Scripts use relative paths instead of `@ab/*` aliases

**Rule:** "Always use `@ab/*` path aliases for cross-lib imports. Never relative paths across lib boundaries."

**Issue:**

- `/Users/joshua/src/_me/aviation/airboss/scripts/db/seed-dev-users.ts:16,17-25,26` -- imports `../../libs/auth/src/schema`, `../../libs/constants/src/index`, `../../libs/utils/src/ids`.
- `/Users/joshua/src/_me/aviation/airboss/scripts/smoke/study-bc.ts:14,15-23,24-25,26` -- imports `../../libs/auth/src/schema`, `../../libs/bc/study/src/index`, `../../libs/bc/study/src/schema`, `../../libs/constants/src/index`, `../../libs/constants/src/study`.
- `/Users/joshua/src/_me/aviation/airboss/apps/study/vite.config.ts:3` -- imports `../../libs/constants/src/hosts`.

Bun CLI scripts run without SvelteKit's alias config, but the root `tsconfig.json` declares `@ab/*` paths that Bun + tsconfig-paths should resolve. `vite.config.ts` runs at Vite bootstrap before SvelteKit aliases are wired, so it's arguably a forced exception; the scripts are not. The phase-0 patterns review explicitly called this out for `scripts/` and the author opted to keep relative paths for "bundler-less script execution," but the rule still says otherwise.

**Fix:** Either

1. verify Bun resolves `@ab/*` through `tsconfig.json` (it does, via `bunfig.toml` or default tsconfig paths) and switch scripts to alias imports, or
2. document an explicit carve-out in CLAUDE.md for `scripts/**` and `apps/*/vite.config.ts` -- currently the rule is absolute.

Recommendation: fix the scripts (option 1). The vite.config carve-out is justifiable; add a two-line comment explaining why.

### [MINOR 5] `scripts/smoke/study-bc.ts` uses a hardcoded DATABASE_URL fallback and raw env key

**Rule:** "All literal values in `libs/constants/`... ENV_VARS constant for env-variable names."

**Issue:** `/Users/joshua/src/_me/aviation/airboss/scripts/smoke/study-bc.ts:28` reads `process.env.DATABASE_URL` (raw string key, not `ENV_VARS.DATABASE_URL`) and falls back to a hardcoded `'postgresql://airboss:airboss@localhost:5435/airboss'`. The rest of the repo uses `ENV_VARS` and `DEV_DB_URL` from `@ab/constants`. The seed script (written in the same phase) does this correctly.

**Fix:** `const url = process.env[ENV_VARS.DATABASE_URL] ?? DEV_DB_URL;` with both imported from `@ab/constants`.

### [MINOR 6] `nanoid` remains a production dependency despite zero source usage

**Rule (CLAUDE.md):** "IDs: `prefix_ULID` format via `@ab/utils` `createId()`. Never call `nanoid()` or `ulid()` directly."

**Issue:** `/Users/joshua/src/_me/aviation/airboss/package.json:35` declares `"nanoid": "^5.1.7"`. Only `ulidx` is imported by source (`libs/utils/src/ids.ts`). `nanoid` is otherwise a transitive dep of postcss (a different version range, 3.x) and is unreferenced by first-party code.

**Fix:** Remove `nanoid` from `dependencies`. If something in a sibling repo still needs it, it should pull it explicitly.

### [MINOR 7] Doubled type casts in `hooks.server.ts` for better-auth additional fields

**Rule:** "No `any`. Prefer proper types, generics, `unknown` with guards."

**Issue:** `/Users/joshua/src/_me/aviation/airboss/apps/study/src/hooks.server.ts:68-69` reads first/last name from the better-auth user via:

```typescript
firstName: ((session.user as Record<string, unknown>).firstName as string) ?? '',
lastName:  ((session.user as Record<string, unknown>).lastName  as string) ?? '',
```

Two casts (`as Record<string, unknown>` then `as string`) to bridge better-auth's loosely typed session-user to our typed `AuthUser`. The `additionalFields` on `libs/auth/src/server.ts:38-48` declare these fields as required strings, so better-auth emits them -- the type definitions just don't propagate.

**Fix:** Define an augmented `BauthUser` type in `libs/auth/src/server.ts` that extends better-auth's inferred user with `firstName: string; lastName: string` and export it. Then `hooks.server.ts` narrows via a single `as BauthUser` or a type guard. This removes both casts and makes the contract visible at the lib boundary rather than hidden in a two-step app-level cast.

Same pattern: `apps/study/src/lib/server/auth.ts:15` uses `undefined as unknown as ReturnType<typeof createAuth>` to bypass the build-time undefined. Either narrow to `Auth | undefined` and make callers handle the build-mode branch, or move the `building` guard into `createAuth` itself (returning a proxy that throws on access during build). Optional.

### [NIT 1] Session todo `20260418-01-TODO.md` wasn't updated across 9 feature commits

**Rule (CLAUDE.md + global):** "Track everything in `docs/work/todos/YYYYMMDD-NN-TODO.md`... Session todos committed with work."

**Observation:** The only session todo is `/Users/joshua/src/_me/aviation/airboss/docs/work/todos/20260418-01-TODO.md` from the kickoff, with all three action-items still unchecked. Nine commits landed after it without progress checkmarks or a new session file. Not a rule violation (the todo is present and captures the intent), but the "mark completed, note skipped/ignored items" directive isn't being exercised.

**Fix:** Either update the existing todo's checklist at the end of this feature, or start a new dated session file for the final review / merge pass.

### [NIT 2] `libs/constants/src/study.ts` comment contains a "for now" qualifier

**Observation:** `/Users/joshua/src/_me/aviation/airboss/libs/constants/src/study.ts:4` says `Domains align (loosely for now) with the knowledge-graph taxonomy...`. The PRIME DIRECTIVE flags "for now" as a red flag. In context, this is forward-looking architectural documentation (ADR 011 explicitly deferred the graph projection), not a stub. It reads as "this list is authoritative until the knowledge graph lands, at which point it projects from there." No action required, but a phrasing tweak to "Domains currently align with..." removes the red-flag trigger from a future grep.

### [NIT 3] `DEV_PASSWORD` is rendered verbatim into the login page UI

**Observation:** `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/login/+page.svelte:89` renders `{DEV_PASSWORD}` in a `<code>` element behind `{#if dev}`. This is intended -- the dev-accounts panel pre-fills credentials for quick testing -- and dev-only guards prevent prod exposure. Fine. Flagging only because a future refactor could accidentally hoist this outside the `dev` check. Consider wrapping the render in `<strong aria-label="dev password">` with a comment anchoring why the plaintext is OK here.

## Passes (Spot-Checked Rules)

These rules were verified clean across the feature diff:

- **No `any`.** `grep ": any|<any>|as any"` in `apps/` + `libs/` returns 0 hits in source. Biome `noExplicitAny: error` enforces.
- **No non-null assertions `!`.** 0 hits in source. Biome `noNonNullAssertion: error` enforces.
- **All routes go through `ROUTES`.** Every `redirect(...)`, `href=`, and query string builder uses a symbol from `libs/constants/src/routes.ts`. 35 call sites reviewed, 0 inline path strings.
- **Drizzle ORM only, no raw SQL.** Three `sql`...`` templates exist: two `CHECK` constraints in `libs/bc/study/src/schema.ts:102-103` for rating/confidence ranges (correct -- CHECK can't be expressed in Drizzle helpers) and one `ORDER BY day desc` in `libs/bc/study/src/stats.ts:75` that references a column alias (also correct). No raw query builders, no Drizzle escape hatches.
- **Svelte 5 runes only.** 0 hits for `$:`, `export let`, `<slot>`, `writable(`, `readable(`, `$app/stores`. All components use `$props`, `$state`, `$derived`, `$effect`, `$bindable` and `{#snippet}/{@render}`.
- **IDs via `@ab/utils`.** `ulid()` is called only inside `libs/utils/src/ids.ts` (`createId` + `generateAuthId`). `generateCardId` / `generateReviewId` are the only IDs used in the BC. No `nanoid()` calls anywhere in source (the npm dep is a different issue -- see MINOR 6).
- **No npm/yarn/pnpm/npx.** `package.json` scripts all use `bun` / `bunx`. The only mentions in the diff are in review prose referring to npm naming rules.
- **No AI attribution.** `git log` across the feature has zero Co-Authored-By, Generated-with, or similar footers. No such strings in source or docs either.
- **No TODO/FIXME/HACK/XXX.** 0 hits for those tokens. "for now" appears twice: one architectural note (NIT 2 above) and review-prose references.
- **No `// stub` or `// MVP` placeholders.** 0 hits.
- **Biome compliance.** `bun run check` runs biome, exits clean. 70 files checked. Tabs (width 2), single quotes, trailing commas, semicolons, line 120 all verified via the config.
- **Markdown formatting in feature docs.** Design doc + review files use blank lines before lists and after headings, code fences are tagged (`typescript`, `sql`, `text`, etc.), and tables are aligned.
- **`updateCard` whitelists fields.** `libs/bc/study/src/cards.ts:152-159` builds a `Partial<CardRow>` explicitly copying only `front/back/domain/cardType/tags`. No `{...patch}` spread, so `status`, `sourceType`, `userId`, `isEditable` cannot leak through via crafted payloads. The comment at line 152-153 explains why. Same pattern applied in `setCardStatus` (line 252 `{ status, updatedAt: new Date() }`).
- **Better-auth magic strings moved to `libs/constants/src/auth.ts`.** `BETTER_AUTH_ENDPOINTS`, `BETTER_AUTH_COOKIES`, `BETTER_AUTH_PROVIDERS`, `DB_ADAPTER_PROVIDER` all defined and re-exported via `libs/constants/src/index.ts`. Login (`+page.server.ts:40`), logout (`+page.server.ts:17`), and auth setup (`libs/auth/src/server.ts:31`) import them instead of string literals.
- **`ENV_VARS` constant for env-variable names.** Defined in `libs/constants/src/env.ts:6`. Every `process.env[...]` in `libs/`, `apps/study/src/`, and `scripts/db/seed-dev-users.ts` reads through `ENV_VARS.X`. The one exception is `scripts/smoke/study-bc.ts:28` (MINOR 5).
- **Session todo present.** `/Users/joshua/src/_me/aviation/airboss/docs/work/todos/20260418-01-TODO.md` exists with kickoff context (not updated across commits -- NIT 1).
- **Cross-lib imports use `@ab/*` aliases.** Inside `apps/study/src/**` and `libs/**/src/**`, every cross-lib import uses an alias. The only relative-import deviations are in `scripts/` and `apps/study/vite.config.ts` (MINOR 4). Intra-lib relative imports (e.g. `./schema`, `./srs` inside `libs/bc/study/src/`) are correct and allowed.

## Priority Ordering

If merging before fixes, the MAJOR items above land in order of impact:

1. MAJOR 2 (typed errors in BC) -- small surface, prevents a silent-break class.
2. MAJOR 1 (`'personal'` magic string) -- trivial edit, removes a grep-bypass.
3. MINOR 3 (dedupe `escapeLikePattern`) -- one-line import swap.
4. MINOR 2 (`PAGE_SIZE` constant) -- one constant addition.
5. MINOR 7 (typed better-auth user) -- small surface, removes two casts.
6. MINOR 5, MINOR 4, MINOR 1, MINOR 6 -- small cleanups.
7. NITs are skippable.

## No Concerns

- No stubs, no hardcoded placeholders, no "for now" shortcuts in code paths.
- No destructive or system-wide change attempts.
- Commit history has clean separation per phase with paired "fix review findings" commits, matching the `/ball-wp-build` cadence.
- The feature ships with working tests (`libs/auth/src/auth.test.ts`, `libs/bc/study/src/srs.test.ts`), a smoke script, and the design/tasks/test-plan docs updated as part of the work.
