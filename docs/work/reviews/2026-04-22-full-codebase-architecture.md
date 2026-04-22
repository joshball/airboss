---
feature: full-codebase
category: architecture
date: 2026-04-22
branch: main
issues_found: 10
critical: 0
major: 3
minor: 4
nit: 3
---

## Summary

Overall architectural posture is strong. The dependency DAG is clean with no circular deps, no cross-BC imports, no libs importing from apps, no apps importing from other apps, and no direct Drizzle usage in app routes. BC boundaries are respected: `libs/bc/study` and `libs/bc/sim` both consume only primitive libs (`constants`, `db`, `utils`, `auth`) and never each other; `libs/aviation` depends only on `@ab/constants`. ADR 012 execution is complete -- `/reps/session` is gone, `SESSION_START` is the single entry point, and no dead inline references linger.

The issues that remain are boundary-edge: theme-token discipline slips in `libs/aviation/src/ui/*` (one missing token name used as a fallback, one chip color hardcoded with no token at all), the `@ab/bc-sim` alias is missing from the root `tsconfig.json` while being present in every other alias registry, `libs/activities/` diverges from the established lib structure (no `package.json`, no `src/`), and a few scripts reach into `libs/` via relative paths instead of the `@ab/*` aliases used elsewhere in the same script directory.

## Dependency DAG (verified)

```text
constants, types         (leaves, no @ab deps)
  -> utils               (constants)
  -> db                  (constants, utils)
  -> auth                (constants, db, utils)
  -> ui                  (constants)
  -> themes              (self-contained)
  -> aviation            (constants)
  -> activities          (no deps)
    -> bc/study          (auth, constants, db, utils)
    -> bc/sim            (constants)
      -> apps/study      (auth, bc-study, constants, themes, ui, utils, aviation, activities)
      -> apps/sim        (bc-sim, constants, themes, ui, utils)
```

No reverse edges. No cross-BC edges. No app-to-app edges. No lib-to-app edges.

## Issues

### MAJOR: `@ab/bc-sim` alias missing from root `tsconfig.json`

- **File**: `/Users/joshua/src/_me/aviation/airboss/tsconfig.json`
- **Problem**: Every other `@ab/*` alias (`constants`, `types`, `db`, `auth`, `themes`, `ui`, `utils`, `bc-study`, `aviation`, `activities`) is declared in the root `paths` block. `@ab/bc-sim` is not. It is declared in `apps/sim/svelte.config.js` (Vite) and in `vitest.config.ts` (tests), but any script, root-level type check, or future lib that imports from `@ab/bc-sim` will fail to resolve under the root `tsc`. Today only `apps/sim/src/**` imports it, so the app-local tsconfig (extending `.svelte-kit/tsconfig.json`) papers over the gap -- but that is a latent footgun.
- **Rule**: CLAUDE.md "Path aliases: `@ab/constants`, `@ab/types`, `@ab/db`, `@ab/auth`, `@ab/themes`, `@ab/ui`, `@ab/utils`, `@ab/bc-study`" is incomplete vs. reality. The root `tsconfig.json` should declare every working alias so root-level tooling has a single source of truth.
- **Fix**: Add to `tsconfig.json` `paths`:

  ```json
  "@ab/bc-sim": ["libs/bc/sim/src/index.ts"],
  "@ab/bc-sim/*": ["libs/bc/sim/src/*"]
  ```

  Also update the CLAUDE.md "Import Rules" section to list `@ab/bc-sim` and `@ab/aviation` alongside the others.

### MAJOR: theme-token boundary violation in `ReferenceCard.svelte`

- **File**: `libs/aviation/src/ui/ReferenceCard.svelte:103, 107-109`
- **Problem**: Two distinct violations of the "tokens are the source of truth" rule (ADR 003, PRs #22/#27/#28):
  1. Line 103: `border-color: var(--ab-color-primary-border, #bfdbfe);` references a token `--ab-color-primary-border` that does not exist in `libs/themes/tokens.css`. The canonical token is `--ab-color-primary-subtle-border`. Every theme will silently fall back to the hardcoded `#bfdbfe`.
  2. Lines 107-109 (`.chip.kind`):

     ```css
     background: #fefce8;
     color: #a16207;
     border-color: #fde047;
     ```

     Raw hex with no token at all. `libs/themes/tokens.css` already defines `--ab-color-warning-subtle`, `--ab-color-warning`, and `--ab-color-warning-subtle-border` which cover this exact palette role.
- **Rule**: CLAUDE.md Critical Rules: "All literal values in `libs/constants/`." For CSS, the equivalent is "all color literals come from `@ab/themes` tokens." `libs/aviation/src/ui/` is shared UI, must read tokens, must not hardcode palette.
- **Fix**: Line 103 -> `var(--ab-color-primary-subtle-border, #bfdbfe)`. Lines 107-109 -> `background: var(--ab-color-warning-subtle, #fefce8); color: var(--ab-color-warning, #a16207); border-color: var(--ab-color-warning-subtle-border, #fde047);` (or extend `tokens.css` if warning is semantically wrong for "kind" chips).

### MAJOR: `libs/activities/` diverges from the lib structural contract

- **File**: `/Users/joshua/src/_me/aviation/airboss/libs/activities/`
- **Problem**: Every other entry under `libs/` has the shape `libs/<name>/{package.json, src/**}` (themes is the one pre-existing exception, and it still has a `package.json`). `libs/activities/` has no `package.json` and no `src/`. It holds a single `crosswind-component/` directory with a `.svelte` file and a `README.md`. The root `package.json` `workspaces: ["apps/*", "libs/*", "libs/bc/*"]` glob expects a package at `libs/activities`; without one, Bun workspace resolution for this lib is inconsistent. The alias in `tsconfig.json` is also asymmetric (`"@ab/activities/*"` only, with no bare `"@ab/activities"`), which reflects this -- there is no barrel to import from. The README even advertises a stale import path (`@ab/activities-crosswind-component/CrosswindComponent.svelte`) that does not match the configured alias.
- **Rule**: [ADR 002 LIB_STRUCTURE.md] + CLAUDE.md Monorepo section. Every lib follows the same shape so tooling (vitest, biome, workspace install, svelte-check) treats them uniformly.
- **Fix**: Either (a) restructure to `libs/activities/{package.json, src/crosswind-component/CrosswindComponent.svelte, src/index.ts}` with `"name": "@ab/activities"` and a barrel, then add `"@ab/activities": ["libs/activities/src/index.ts"]` to root tsconfig, or (b) flatten the single component into `libs/ui/src/components/CrosswindComponent.svelte` if it does not warrant its own lib yet. Update `libs/activities/crosswind-component/README.md` line 35 either way -- the `@ab/activities-crosswind-component/*` path shown there is wrong.

### MINOR: theme-token fallbacks used as escape hatch in `libs/aviation/src/ui/*`

- **Files**: `libs/aviation/src/ui/ReferenceCard.svelte`, `ReferenceFilter.svelte`, `ReferencePage.svelte`, `ReferenceSidebar.svelte`, `ReferenceTerm.svelte`, `ReferenceText.svelte`
- **Problem**: Pattern like `color: var(--ab-color-fg-muted, #475569);` is used consistently -- the hex fallback duplicates the token's light-theme value. For a component that always renders under a `ThemeProvider` (per `libs/themes/index.ts`), the fallback is dead code that lies about the source of truth and will drift when tokens are retuned (e.g. if `--ab-color-fg-muted` changes, the fallback still says the old color). `libs/themes/tokens.css` is imported at the app root, so the var is always defined.
- **Rule**: Tokens are the source of truth; components should trust them. Fallbacks are fine for defensive code outside a themed boundary, but the aviation reference UI is always inside one.
- **Fix**: Drop the hex fallbacks in these six files (keep `var(--ab-color-*)` alone). If defensive fallbacks are wanted as a policy, they should all track the real token value and be regenerated from `tokens.css` -- not hand-maintained.

### MINOR: scripts use relative paths into `libs/` instead of `@ab/*` aliases

- **Files**: `scripts/dev.ts:16`, `scripts/db.ts:12`, `scripts/setup.ts:21`, `scripts/build-knowledge-index.ts:36`, `scripts/knowledge-new.ts:20`, `scripts/db/seed-all.ts:21`, `scripts/db/seed-cards.ts:29-31`, `scripts/db/seed-dev-users.ts:16-26`, `scripts/db/reset-study.ts:10`, `scripts/smoke/study-bc.ts:14-26`
- **Problem**: These scripts reach into `../libs/constants/src/index`, `../../libs/bc/study/src/index`, `../../libs/auth/src/schema`, etc. directly. Meanwhile `scripts/references/*.ts` and `scripts/db/apply-sql.ts` use `@ab/aviation`, `@ab/constants`, `@ab/db`. The mixed convention is the issue -- the same directory has both styles.
- **Rule**: CLAUDE.md Import Rules: "Always use `@ab/*` path aliases for cross-lib imports. Never relative paths across lib boundaries." Scripts are not technically a "lib," but they cross lib boundaries the same way apps do, and Bun + the root tsconfig resolve the aliases identically for script execution.
- **Fix**: Replace all `from '../../libs/foo/src/...'` with `from '@ab/foo'` (or the appropriate sub-path alias). The alias registry in root `tsconfig.json` already covers every import currently using relative paths (except `@ab/bc-sim`, which is the MAJOR issue above). Vite bootstrap files (`apps/*/vite.config.ts`) are the only legitimate exception -- they run before aliases are registered.

### MINOR: `REPS_*` route constants linger after ADR 012 substrate migration

- **File**: `libs/constants/src/routes.ts:76-78`
- **Problem**: ADR 012 moved all rep entry points to `SESSION_START`. The comment on line 74 correctly documents the retirement of `REPS_SESSION`. But `REPS: '/reps'`, `REPS_BROWSE: '/reps/browse'`, and `REPS_NEW: '/reps/new'` remain, and the corresponding route dirs (`apps/study/src/routes/(app)/reps/{browse,new}`) still exist. If ADR 012 intended to retire only the session-launch entry (not the browse/new routes), the comment is accurate but incomplete. If the substrate migration intended to retire the whole `/reps/*` hierarchy, this is a dead-code gap.
- **Rule**: ADR 012 claims rep flows now live under `SESSION_START`. The `/reps` surface either needs justification (what it still does that `/session/start` doesn't) or retirement.
- **Fix**: Confirm intent with ADR 012's author. Either (a) extend the comment on lines 74-75 to explain why `REPS`, `REPS_BROWSE`, `REPS_NEW` are kept while `REPS_SESSION` was retired (e.g. "browse and create-rep flows are independent of the session substrate"), or (b) retire the routes + constants + route dirs in one pass.

### MINOR: `docs/work-packages/knowledge-graph/spec.md` references deleted `scripts/knowledge-seed.ts`

- **File**: `docs/work-packages/knowledge-graph/spec.md:41`
- **Problem**: The spec tells users to run `bun run knowledge:seed --user <email>` (pointing at `scripts/knowledge-seed.ts`). That script was deleted (see `git status` at review time -- `D scripts/knowledge-seed.ts`) and replaced by `scripts/db/seed-all.ts` + `scripts/db/seed-cards.ts`. Not an architectural boundary violation, but it is an orphan reference inside the architecture documentation tree, and new contributors following the spec will hit a dead command.
- **Rule**: CLAUDE.md Doc Structure: "Never leave orphaned files. When moving or renaming, grep for references and update them." The seed script was renamed; the spec reference was not updated.
- **Fix**: Update spec.md line 41 to point at `scripts/db/seed-cards.ts` (or whichever script is now canonical for node-scoped card seeding) and update the `bun run` invocation to match `package.json`.

### NIT: `vitest.config.ts` alias list drifts from `tsconfig.json`

- **File**: `vitest.config.ts:7-18`
- **Problem**: Vitest resolves a custom alias block. It includes `@ab/constants/env` (a sub-path that tsconfig handles via the `@ab/constants/*` wildcard), `@ab/auth/schema` (same), but omits `@ab/themes` and `@ab/activities` entirely. Today no test imports those, so nothing breaks. But the vitest config is a third alias registry (after root tsconfig and per-app svelte.config.js) that drifts from the other two.
- **Rule**: Single source of truth for path aliases. Three separate registries means three places to update whenever a lib is added.
- **Fix**: Either (a) have vitest load aliases from tsconfig via `vite-tsconfig-paths`, or (b) backfill `@ab/themes` + `@ab/activities/*` and remove the sub-path-specific entries (`@ab/constants/env`, `@ab/auth/schema`) that are already covered by wildcards.

### NIT: sim instrument SVGs hardcode hex in `apps/sim/src/lib/instruments/*`

- **Files**: `apps/sim/src/lib/instruments/{Asi,Altimeter,AttitudeIndicator}.svelte`
- **Problem**: The instrument SVGs embed raw hex (`#111`, `#f5f5f5`, `#e9c53c`, `#2fb856`, `#e0443e`, `#ffe270`, etc.) directly in SVG `fill`/`stroke` attributes. Per CLAUDE.md "ALL visual/UI components live in `libs/ui/`" and the recent tokens work, these should read from tokens or live in a future `libs/avionics/` surface lib. Today sim is a "Phase 0 throwaway prototype" per `libs/bc/sim/src/index.ts`, so this is expected, not a bug.
- **Rule**: CLAUDE.md Component Placement + MULTI_PRODUCT_ARCHITECTURE.md surface taxonomy ("`avionics/` -- glass cockpit trainer" is planned).
- **Fix**: When `apps/sim` graduates past prototype, extract instruments to `libs/avionics/src/instruments/` (or `libs/ui/src/components/instruments/`) and introduce avionics-specific tokens (`--ab-instrument-face-bg`, `--ab-instrument-needle-primary`, `--ab-instrument-warning-arc`, etc.) in `libs/themes/tokens.css`. No action needed until then.

### NIT: `libs/aviation/src/sources/cfr/extract.ts` uses a 3-dot relative import across aviation sub-modules

- **File**: `libs/aviation/src/sources/cfr/extract.ts:13`
- **Problem**: `import type { SourceExtractor } from '../../schema/source';`. Intra-lib relative imports are allowed by CLAUDE.md, and this is inside a single lib (`libs/aviation/`). The 3-dot path is a style smell (readable is `../../` + `schema/source`, fine), but it's easy to reach for `@ab/aviation/schema/source` when the nesting deepens. Not a boundary violation; flagging so the pattern is deliberate.
- **Rule**: CLAUDE.md: "Intra-lib relative imports are fine." This follows the rule.
- **Fix**: None required. Consider collapsing `libs/aviation/src/sources/` if the hierarchy is only two levels; deeper nesting is fine as-is.
