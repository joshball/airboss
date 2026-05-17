# Browser hydration regressions

The class of bug that produced the `/memory` `ReferenceError: Buffer is not defined` crash, costing four wrong-fix PRs (#656, #659, #661, #663) before #664 actually shipped the fix. This playbook is the path that should have been taken on minute one.

Read this before chasing any browser-only error in the airboss study app, especially anything involving server-only code (postgres, drizzle, `Buffer`, `process`, `node:*`) leaking into the client bundle.

## The trap

Tests pass. Type-check passes. `bun run check` passes. The page still crashes in the user's real browser. That gap is the failure mode.

| Layer                               | Sees the regression?                                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| TypeScript (`tsc`, `bun run check`) | No -- types resolve fine through type-only re-exports                                                                        |
| Biome (`noNodejsModules`)           | No -- only catches static `import 'node:*'` lines                                                                            |
| Vitest with happy-dom               | No -- happy-dom polyfills `Buffer` and `process`                                                                             |
| Playwright with chromium            | Sometimes -- depends on whether the chunk actually evaluates a `Buffer.allocUnsafe` at module top-level vs inside a function |
| The user's Firefox / Safari         | **Always** -- this is the only honest signal                                                                                 |

If the symptom is a real browser console error, **the verification is a real browser load**. Not a test run.

## The five-minute diagnostic

Run these in order. Stop at the first one that gives you the answer.

### 1. Reproduce in a real browser before touching code

```bash
bun scripts/dev.ts clean
bun run dev
```

Open the broken page with devtools open. Watch Network + Console. Note the failing chunk's filename (e.g. `chunk-VQMZUIKA.js`) and the exact error.

### 2. Diff a working page against the broken one

The most valuable diagnostic signal is "X is broken, Y works." Find the smallest difference between their import graphs.

```bash
# What does the broken page value-import from suspect libs?
grep -E "^import\s+\{" apps/study/src/routes/(app)/memory/+page.svelte | grep -v 'import type'

# What does a working page import?
grep -E "^import\s+\{" apps/study/src/routes/(app)/study/learn/+page.svelte | grep -v 'import type'
```

For the `/memory` crash this would have shown immediately: `/memory` had `import { summarizeDeckSpec } from '@ab/bc-study'` (a runtime value import); `/study/learn` had no value imports from `@ab/bc-study`. That's the smoking gun.

### 3. Check what Vite's deps optimizer pre-bundled

```bash
cat apps/study/node_modules/.vite/deps/_metadata.json | jq '.optimized | keys'
```

If `postgres` or `drizzle-orm/postgres-js` shows up, **something client-eligible reaches the postgres driver**. The optimizer doesn't distinguish client vs server -- if any module in the scan graph imports it, it's pre-bundled. Whether the browser actually fetches that chunk is determined by what the client code imports.

### 4. Inspect the actual browser-shipped module

With dev server running, fetch the transformed module Vite hands the browser:

```bash
curl -s 'http://127.0.0.1:9600/@fs/<absolute-path-to>/libs/bc/study/src/index.ts'
```

The response is what the browser loads after esbuild stripping. Type-only imports (`import type`, `export type`) are gone. Runtime value imports remain. Read the resulting import graph -- the leak is one of the surviving lines.

For automated walking of a whole runtime barrel, use [scripts/walk-browser-barrel.ts](../../../scripts/walk-browser-barrel.ts):

```bash
bun scripts/walk-browser-barrel.ts @ab/sources --paths
```

It curls `/@id/<pkg>`, follows every value-import edge across `/@fs/...` URLs, flags any module whose served output starts with `__vite-browser-external:node:*`, and (with `--paths`) prints the BFS path from the barrel to each leaking module. This is the exact tool that found the `render/batch-resolve.ts` and `render/tokens.ts` leaks in the 2026-05-12 Phase 3 fix after the grep-only diagnosis stalled.

### 5. Playwright + network trace as the verification

If you think you've identified the leak, write a 20-line script. Login as Abby, hit the page, watch for the suspect chunk:

```ts
page.on('request', (req) => {
  if (/\/postgres\.js(\?|$)/.test(req.url())) postgresLoads.push(req.url());
});
```

If `postgresLoads.length > 0`, the leak is still there. If `errors` contains `Buffer is not defined`, the fix didn't work. **Don't ship until both arrays are empty.**

The repeatable form of this lives at [tests/e2e/browser-hydration-smoke.spec.ts](../../../tests/e2e/browser-hydration-smoke.spec.ts) -- run that for the canonical surfaces before claiming any related fix done.

## How to bisect a candidate fix

```bash
# 1. Apply your candidate fix
# 2. Clear cache + restart dev
bun scripts/dev.ts clean && bun run dev

# 3. Run the smoke
bunx playwright test tests/e2e/browser-hydration-smoke.spec.ts

# 4. Stash the fix
git stash

# 5. Clear cache + restart dev
bun scripts/dev.ts clean && bun run dev

# 6. Re-run the smoke
bunx playwright test tests/e2e/browser-hydration-smoke.spec.ts
```

If both runs pass, the fix isn't doing what you think. If the second fails and the first passes, the diff is the fix. Pop the stash and ship.

## The five anti-patterns that cost time on the `/memory` crash

| Anti-pattern                                                | What to do instead                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Diagnosing from memory of the codebase                      | Read the actual files. Mental models go stale; source is ground truth.                           |
| Trusting an agent self-report ("no findings")               | Audit. Re-grep main for the symptom; walk the relevant barrel by hand.                           |
| Shipping a candidate fix without browser verification       | Playwright smoke first. If you can't repro the failure, you can't prove the fix.                 |
| Iterating on the same hypothesis 4 times                    | After attempt 2, switch to measuring (deps metadata, browser-shipped module diff).               |
| Treating "vitest passes" as evidence the regression is gone | Vitest passing means nothing for browser-only regressions. happy-dom polyfills the failure mode. |

## The static guard rail

[`scripts/check-browser-globals.ts`](../../../scripts/check-browser-globals.ts) catches three regression shapes at lint time, run by `bun run check`:

1. Bare `Buffer.` / `process.` references in browser-bundled libs.
2. Static `from '@ab/db/connection'` / `from 'postgres'` / `from 'node:*'` imports from client-eligible files.
3. Runtime barrel value re-exports whose transitive imports reach a server-only module.

If you make a barrel-shape change and `bun run check` passes, you're protected against re-introducing this regression class statically. Pair with the playwright smoke for runtime coverage.

## Why the `chunk-VQMZUIKA.js` cache-buster confused the diagnosis

Vite gives each optimized dep a stable content hash (`postgres.js`, `chunk-VQMZUIKA.js`). The `?v=...` query string changes per rebuild but the underlying file does not. So "the same chunk is loading despite cache clears" is technically true -- and misleading. The right diagnostic is whether the browser fetches the chunk at all, not whether the chunk's content changed.

## Lessons from the 2026-05-12 Phase 3 crash (`@ab/sources` `node:fs` leak)

A second crash of the same class, this time during the command-palette Phase 3 walk. The bug took 4+ wrong-fix iterations because every anti-pattern from the previous incident got repeated. Repeating them again here for emphasis -- if you find yourself doing any of these, STOP.

### What happened

`PaletteDetailPane.svelte` (new in Phase 3) value-imported `urlForReference` from `@ab/sources`. `@ab/sources/index.ts` (the runtime barrel) had:

1. 19 side-effect imports of corpus `index.ts` files, each of which imported a `resolver.ts` that static-imported `node:fs`.
2. A value re-export `export { ... productionRegistry } from './registry/index.ts'`, where `registry/index.ts` imports `registry/query.ts`, which also static-imports `node:fs`.

Either one was enough to ship `node:fs` access into the client bundle. In Vite's dev server, accessing any property of the externalized `node:fs` stub at module-load time throws `Module "node:fs" has been externalized for browser compatibility` -- on EVERY authenticated page, because `PaletteDetailPane` is mounted via `HelpSearch` in `(app)/+layout.svelte`.

The fix: move `productionRegistry`, `getCorpusResolver`, `initRegistry`, and the 19 side-effect imports OUT of the runtime barrel and INTO `@ab/sources/server`. Update `hooks.server.ts` and a handful of BC files to import from `@ab/sources/server`. Same canonical pattern as PRs #659 / #664.

### What I (the dispatcher) did wrong, and the rule for next time

1. **I trusted four agent self-reports in a row** -- "page hydrates fine, just a warning logged", "scanner is clean", "browser smoke passes". None of those reports were from agents that had loaded the actual page in a browser with `.env` in place. Their playwright probes hit unauthenticated routes or worktrees that crashed on auth bootstrap. **Rule: agent claims of "the browser works" are unverified until the dispatcher loads the page itself.**

2. **I merged two PRs (#857 and #921) without loading the page in my own browser first.** Both shipped broken to main. **Rule: any PR that touches `libs/help/`, `libs/sources/`, a runtime barrel of a browser-bundled lib, or a `(app)/+layout.svelte` import chain requires a real-browser load before merge. Not a Playwright probe -- a real browser. The CLAUDE.md rule "Vitest passing is not browser-correct" applies to playwright smoke too if the smoke doesn't cover authenticated routes / the same layout chain as the failure.**

3. **I iterated on five different "fix" hypotheses without re-measuring after each.** Removed value re-exports of `bootstrap.ts` (no effect). Removed type re-exports of `bootstrap.ts` (no effect). Cleared Vite cache (no effect). Each attempt was a guess from grep output, not a measurement. **Rule: after 2 failed candidate fixes, STOP iterating. Switch to measurement: `curl /@fs/<lib>/src/index.ts` to read the Vite-served module, walk every value-import, identify the actual leak chain. If grep-only diagnosis hasn't converged after 2 tries, grep was the wrong tool.**

4. **I had `docs/agents/debug-playbooks/browser-hydration.md` (this file) bookmarked from minute one and didn't read it until forced to.** The playbook says steps 1-5 in order: reproduce in browser, diff working vs broken page, check deps metadata, inspect served module, playwright trace. I started at step "blindly edit barrel" and stayed there. **Rule: for any browser-only error, read this playbook BEFORE the first code edit. Not after attempt 3.**

5. **The static guard at `scripts/check-browser-globals.ts` passed each time, and that made me complacent.** The guard catches `Buffer.allocUnsafe` patterns + `@ab/db/connection` imports + the postgres driver. It does NOT catch `import { existsSync } from 'node:fs'` in a server-only module that's transitively pulled into the browser via a runtime barrel value-re-export. The guard has a real blind spot on `node:*` patterns reached through value-re-exports of locator/registry modules. **Rule: `bun run check` passing is necessary, not sufficient. Browser load is the gate.**

### The cost

Two PRs (#857, #921) shipped broken. Every authenticated page in the study app threw a client-side error to the logging endpoint for the duration. Three rounds of wrong fixes (file-edits, two sub-agent dispatches), each one delivered with confidence. The fix that worked was a 7-line edit to `libs/sources/src/index.ts` + `server.ts` + 4 consumer updates, the kind of change that should have taken 15 minutes from the symptom report.

### The rule, distilled

**If a user reports a browser-only error and your fix attempt does not include `curl http://127.0.0.1:9600/@fs/<suspect-file>` to read what Vite is actually serving, you are guessing.** Stop. Run the dev server, fetch the served module, walk the import chain in the served output, identify the leak there. Then fix and re-fetch to confirm the chain is gone before claiming done.
